#!/usr/bin/env node
// Pocket-Canvas Server — sync your boards through your own server, and share boards with other
// people so you can edit them together.
// Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me> · MIT licence
//
// What it does
//   • Accounts: people sign up with the server's join code, then sign in with their own password.
//   • Your boards: each of your devices sends its copy of your boards; the server passes it to your
//     other devices (and keeps the latest one from each device for devices that were offline).
//     Devices combine copies card by card, exactly like folder sync (src/merge.js).
//   • Shared boards: a board (with the boards inside it) can be shared with other people on the
//     server. Changes are passed to everyone in about a second, and you can see who else is there.
//   • Pictures and files are stored once, by their id.
//
// Run:   JOIN_CODE=choose-a-code node pocket-canvas-server.js
// Settings (environment variables):
//   PORT        port to listen on (default 8787)
//   DATA_DIR    where to keep everything (default ./data)
//   JOIN_CODE   code people need to create an account (required to allow sign-ups)
//   MAX_ASSET_MB  largest picture/file accepted (default 500)
// Put it behind HTTPS (for example Caddy or nginx) before using it over the internet.
'use strict';

const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const VERSION = '1.5.5';
const PROTOCOL = 1;

// ---------- fetching web pages for link previews, safely ----------
// Only public internet addresses: never this machine or your home network (otherwise anyone signed in
// could use the server to look at things only it can reach).
const dns = require('dns').promises;
const net = require('net');
function privateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return privateIp(v.slice(7));
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('ff');
}
async function publicAddress(u) {
  let url;
  try { url = new URL(u); } catch { return false; }
  if (!/^https?:$/.test(url.protocol)) return false;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (/^localhost$/i.test(host) || /\.local$/i.test(host)) return false;
  try {
    const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
    return addrs.length > 0 && addrs.every((a) => !privateIp(a.address));
  } catch { return false; }
}
// fetch that checks every address it's sent on to
async function safeFetch(url, opts = {}) {
  for (let hops = 0; hops < 6; hops++) {
    if (!(await publicAddress(url))) throw new Error('That address can’t be fetched from the server.');
    const res = await fetch(url, { ...opts, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      try { res.body && res.body.cancel(); } catch {}
      url = new URL(res.headers.get('location'), url).href;
      continue;
    }
    Object.defineProperty(res, 'url', { value: url });
    return res;
  }
  throw new Error('Too many redirects');
}

function createServer(opts = {}) {
  const DATA = path.resolve(opts.dataDir || process.env.DATA_DIR || path.join(process.cwd(), 'data'));
  const JOIN_CODE = opts.joinCode ?? process.env.JOIN_CODE ?? '';
  const MAX_ASSET = (opts.maxAssetMb || +process.env.MAX_ASSET_MB || 500) * 1024 * 1024;
  // The browser version of Pocket-Canvas (built by scripts/build-web.js), served at the server's address.
  const WEB_DIR = [opts.webDir, process.env.WEB_DIR, path.join(__dirname, 'public'), path.join(__dirname, '..', 'build', 'web')]
    .find((d) => d && fs.existsSync(path.join(d, 'index.html'))) || null;
  // Link previews for the browser version (the server fetches the page, as the desktop app does).
  const PREVIEWS = (opts.linkPreviews ?? process.env.LINK_PREVIEWS ?? 'on') !== 'off';
  let preview = null;
  if (PREVIEWS) {
    for (const p of [path.join(__dirname, 'lib', 'link-preview.js'), path.join(__dirname, '..', 'lib', 'link-preview.js')]) {
      if (fs.existsSync(p)) { try { preview = require(p); break; } catch {} }
    }
  }
  const log = opts.quiet ? () => {} : (...a) => console.log(new Date().toISOString(), ...a);
  for (const d of ['', 'docs', 'assets']) fs.mkdirSync(path.join(DATA, d), { recursive: true });

  // ---------- small JSON "database" ----------
  const file = (name) => path.join(DATA, name);
  const readJson = (name, fallback) => { try { return JSON.parse(fs.readFileSync(file(name), 'utf8')); } catch { return fallback; } };
  const writeJson = (name, value) => {
    const tmp = file(name) + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(value));
    fs.renameSync(tmp, file(name));
  };
  const db = {
    users: readJson('users.json', {}),     // name(lowercase) -> { id, name, display, salt, hash, created }
    tokens: readJson('tokens.json', {}),   // sha256(token) -> { user, created, device }
    spaces: readJson('spaces.json', {})    // spaceId -> { id, root, title, owner, members: [userId], created }
  };
  const save = (what) => writeJson(what + '.json', db[what]);

  const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
  const hashPassword = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
  const userById = (id) => Object.values(db.users).find((u) => u.id === id);
  const publicUser = (u) => u && { id: u.id, name: u.name, display: u.display || u.name };
  const validName = (n) => typeof n === 'string' && /^[\p{L}\p{N}._ -]{2,40}$/u.test(n.trim());
  const validId = (s) => typeof s === 'string' && /^[\w-]{4,64}$/.test(s);
  const ASSET_ID = /^[0-9a-f]{16}\.[a-z0-9]{1,10}$/;

  function issueToken(user, device) {
    const token = crypto.randomBytes(32).toString('base64url');
    db.tokens[sha(token)] = { user: user.id, created: Date.now(), device: String(device || '').slice(0, 60) };
    save('tokens');
    return token;
  }
  function authUser(token) {
    const t = token && db.tokens[sha(String(token))];
    return t ? userById(t.user) : null;
  }

  // ---------- documents: the latest copy from each device ----------
  // scope "me:<userId>" for someone's own boards, or a shared space id.
  const docDir = (scope) => path.join(DATA, 'docs', sha(scope).slice(0, 32));
  async function storeDoc(scope, doc) {
    const dir = docDir(scope);
    await fsp.mkdir(dir, { recursive: true });
    const name = sha(doc.deviceId).slice(0, 24) + '.json';
    await fsp.writeFile(path.join(dir, name + '.tmp'), JSON.stringify(doc));
    await fsp.rename(path.join(dir, name + '.tmp'), path.join(dir, name));
  }
  async function loadDocs(scope) {
    const dir = docDir(scope);
    let names = [];
    try { names = await fsp.readdir(dir); } catch { return []; }
    const out = [];
    for (const n of names) {
      if (!n.endsWith('.json')) continue;
      try { out.push(JSON.parse(await fsp.readFile(path.join(dir, n), 'utf8'))); } catch {}
    }
    return out;
  }

  // ---------- HTTP ----------
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS'
  };
  const send = (res, code, body, type = 'application/json') => {
    res.writeHead(code, { ...cors, 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(type === 'application/json' ? JSON.stringify(body) : body);
  };
  const readBody = (req, limit) => new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('too big')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
  const bearer = (req) => (/^Bearer (.+)$/.exec(req.headers.authorization || '') || [])[1];
  // The browser version also signs in with a cookie, so pictures and videos (<img>, <video>) can load.
  // It's only accepted for reading (GET); anything that changes something needs the Bearer key.
  const COOKIE = 'pc_session';
  const cookieToken = (req) => { const m = new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)').exec(req.headers.cookie || ''); return m ? decodeURIComponent(m[1]) : null; };
  const isHttps = (req) => req.socket.encrypted || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  const sessionCookie = (req, token) => `${COOKIE}=${token ? encodeURIComponent(token) : ''}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token ? 31536000 : 0}${isHttps(req) ? '; Secure' : ''}`;
  const sendWithCookie = (req, res, code, body, token) => {
    res.writeHead(code, { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Set-Cookie': sessionCookie(req, token) });
    res.end(JSON.stringify(body));
  };

  // ---------- serving the browser version ----------
  const WEB_TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };
  function serveWeb(req, res, pathname) {
    if (!WEB_DIR || (req.method !== 'GET' && req.method !== 'HEAD')) return false;
    let rel;
    try { rel = decodeURIComponent(pathname); } catch { return false; }
    if (rel === '/' || rel === '') rel = '/index.html';
    const file = path.resolve(WEB_DIR, '.' + rel);
    if (!file.startsWith(path.resolve(WEB_DIR) + path.sep)) return false; // stay inside the web folder
    let st; try { st = fs.statSync(file); } catch { return false; }
    if (!st.isFile()) return false;
    res.writeHead(200, {
      'Content-Type': WEB_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': /index\.html$/.test(file) ? 'no-cache' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'SAMEORIGIN'
    });
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
    return true;
  }

  // Pictures, video and audio are served with their real type (so they show and play in a browser),
  // in a locked-down "sandbox" so a file can never run scripts on this site.
  const ASSET_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif',
    '.bmp': 'image/bmp', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8',
    '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg', '.flac': 'audio/flac', '.weba': 'audio/webm',
    '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.ogv': 'video/ogg', '.mov': 'video/quicktime' };
  function sendAsset(req, res, p, id) {
    const size = fs.statSync(p).size;
    const type = ASSET_TYPES[path.extname(id)] || 'application/octet-stream';
    const head = {
      ...cors, 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'",
      'Content-Disposition': type === 'application/octet-stream' ? 'attachment' : 'inline'
    };
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range && size) {
      let start = range[1] === '' ? size - +range[2] : +range[1];
      let end = range[1] === '' || range[2] === '' ? size - 1 : Math.min(+range[2], size - 1);
      if (start < 0) start = 0;
      if (start > end || start >= size) { res.writeHead(416, { ...head, 'Content-Range': `bytes */${size}` }); res.end(); return; }
      res.writeHead(206, { ...head, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
      fs.createReadStream(p, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, { ...head, 'Content-Length': size });
    fs.createReadStream(p).pipe(res);
  }

  // slow down password guessing: 10 tries per minute per address
  const tries = new Map();
  const tooMany = (ip) => {
    const now = Date.now(), t = (tries.get(ip) || []).filter((x) => now - x < 60e3);
    t.push(now); tries.set(ip, t);
    return t.length > 10;
  };

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
      if (url.pathname === '/health' || (url.pathname === '/' && !WEB_DIR)) {
        send(res, 200, { app: 'Pocket-Canvas Server', version: VERSION, protocol: PROTOCOL, signUp: !!JOIN_CODE, web: !!WEB_DIR });
        return;
      }
      if (!url.pathname.startsWith('/api/') && serveWeb(req, res, url.pathname)) return;
      if (url.pathname === '/api/register' && req.method === 'POST') {
        if (tooMany(req.socket.remoteAddress)) { send(res, 429, { error: 'Too many tries. Wait a minute.' }); return; }
        const b = JSON.parse((await readBody(req, 10e3)).toString() || '{}');
        if (!JOIN_CODE) { send(res, 403, { error: 'This server doesn’t allow new accounts.' }); return; }
        if (String(b.joinCode || '') !== JOIN_CODE) { send(res, 403, { error: 'The join code isn’t right.' }); return; }
        if (!validName(b.name)) { send(res, 400, { error: 'Names can be 2 to 40 letters, numbers, spaces, dots, dashes or underscores.' }); return; }
        if (typeof b.password !== 'string' || b.password.length < 8) { send(res, 400, { error: 'Passwords need at least 8 characters.' }); return; }
        const key = b.name.trim().toLowerCase();
        if (db.users[key]) { send(res, 409, { error: 'That name is taken.' }); return; }
        const salt = crypto.randomBytes(16).toString('hex');
        const user = { id: 'u' + crypto.randomBytes(8).toString('hex'), name: b.name.trim(), display: String(b.display || b.name).trim().slice(0, 60), salt, hash: hashPassword(b.password, salt), created: Date.now() };
        db.users[key] = user; save('users');
        log('new account', user.name);
        const token = issueToken(user, b.device);
        sendWithCookie(req, res, 200, { token, user: publicUser(user) }, b.web ? token : null);
        return;
      }
      if (url.pathname === '/api/login' && req.method === 'POST') {
        if (tooMany(req.socket.remoteAddress)) { send(res, 429, { error: 'Too many tries. Wait a minute.' }); return; }
        const b = JSON.parse((await readBody(req, 10e3)).toString() || '{}');
        const user = db.users[String(b.name || '').trim().toLowerCase()];
        const ok = user && typeof b.password === 'string' &&
          crypto.timingSafeEqual(Buffer.from(hashPassword(b.password, user.salt), 'hex'), Buffer.from(user.hash, 'hex'));
        if (!ok) { send(res, 401, { error: 'That name and password don’t match.' }); return; }
        const token = issueToken(user, b.device);
        sendWithCookie(req, res, 200, { token, user: publicUser(user) }, b.web ? token : null);
        return;
      }
      // everything below needs a signed-in person
      const user = authUser(bearer(req) || (req.method === 'GET' || req.method === 'HEAD' ? cookieToken(req) : null));
      if (!user) { send(res, 401, { error: 'Please sign in again.' }); return; }
      if (url.pathname === '/api/logout' && req.method === 'POST') {
        delete db.tokens[sha(bearer(req) || '')]; save('tokens');
        sendWithCookie(req, res, 200, { ok: true }, null);
        return;
      }
      // the latest copy of your boards from each of your devices (the browser version starts from these)
      if (url.pathname === '/api/docs' && req.method === 'GET') {
        const docs = (await loadDocs('me:' + user.id)).filter((d) => d && d.state && d.state.boards);
        docs.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
        send(res, 200, { docs });
        return;
      }
      if (url.pathname === '/api/preview' && req.method === 'GET') {
        if (!preview) { send(res, 200, null); return; }
        const target = url.searchParams.get('url') || '';
        if (!(await publicAddress(target))) { send(res, 200, { error: 'That address can’t be previewed from the server.' }); return; }
        try { send(res, 200, await preview.linkPreview(target, path.join(DATA, 'assets'), { fetch: safeFetch })); } catch (err) { send(res, 200, { error: err.message }); }
        return;
      }
      if (url.pathname === '/api/users' && req.method === 'GET') {
        send(res, 200, { users: Object.values(db.users).map(publicUser) });
        return;
      }
      if (url.pathname === '/api/assets/missing' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req, 2e6)).toString() || '{}');
        const ids = (Array.isArray(b.ids) ? b.ids : []).filter((id) => ASSET_ID.test(id)).slice(0, 5000);
        const missing = ids.filter((id) => !fs.existsSync(path.join(DATA, 'assets', id)));
        send(res, 200, { missing });
        return;
      }
      const am = /^\/api\/assets\/([0-9a-f]{16}\.[a-z0-9]{1,10})$/.exec(url.pathname);
      if (am) {
        const p = path.join(DATA, 'assets', am[1]);
        if (req.method === 'PUT') {
          if (fs.existsSync(p)) { req.resume(); send(res, 200, { ok: true }); return; }
          const body = await readBody(req, MAX_ASSET);
          const tmp = p + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
          await fsp.writeFile(tmp, body);
          await fsp.rename(tmp, p);
          send(res, 200, { ok: true });
          return;
        }
        if (req.method === 'GET' || req.method === 'HEAD') {
          if (!fs.existsSync(p)) { send(res, 404, { error: 'Not found' }); return; }
          if (req.method === 'HEAD') { res.writeHead(200, cors); res.end(); return; }
          sendAsset(req, res, p, am[1]);
          return;
        }
      }
      send(res, 404, { error: 'Not found' });
    } catch (err) {
      send(res, err.message === 'too big' ? 413 : 400, { error: err.message === 'too big' ? 'That file is too big for this server.' : 'Bad request' });
    }
  });

  // ---------- live connections ----------
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 * 1024 });
  const clients = new Set(); // { ws, user, deviceId, deviceName, presence }

  const spacesOf = (userId) => Object.values(db.spaces).filter((s) => s.members.includes(userId));
  const spaceInfo = (s) => ({ id: s.id, root: s.root, title: s.title, owner: publicUser(userById(s.owner)), members: s.members.map((m) => publicUser(userById(m))).filter(Boolean) });
  const out = (c, msg) => { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(msg)); };
  const toUser = (userId, msg, except) => { for (const c of clients) if (c.user.id === userId && c !== except) out(c, msg); };
  const toSpace = (space, msg, except) => { for (const c of clients) if (space.members.includes(c.user.id) && c !== except) out(c, msg); };

  function presenceFor(space) {
    const list = [];
    for (const c of clients) {
      if (!space.members.includes(c.user.id) || !c.presence || c.presence.space !== space.id) continue;
      list.push({ user: publicUser(c.user), deviceId: c.deviceId, board: c.presence.board, card: c.presence.card || null, editing: !!c.presence.editing });
    }
    return list;
  }
  const sendPresence = (space) => toSpace(space, { t: 'presence', space: space.id, people: presenceFor(space) });

  wss.on('connection', async (ws, req) => {
    const token = new URL(req.url, 'http://x').searchParams.get('token');
    const user = authUser(token);
    if (!user) { ws.close(4001, 'Please sign in again.'); return; }
    const c = { ws, user, deviceId: null, deviceName: '', presence: null, alive: true };
    ws.on('pong', () => { c.alive = true; });
    ws.on('message', async (data) => {
      let m;
      try { m = JSON.parse(data.toString()); } catch { return; }
      try { await handle(c, m); } catch (err) { out(c, { t: 'error', error: String(err.message || err) }); }
    });
    ws.on('close', () => {
      clients.delete(c);
      for (const s of spacesOf(user.id)) if (c.presence && c.presence.space === s.id) sendPresence(s);
    });
  });

  async function handle(c, m) {
    if (m.t === 'hello') {
      if (!validId(m.deviceId)) throw new Error('Bad device id');
      c.deviceId = m.deviceId; c.deviceName = String(m.deviceName || '').slice(0, 60);
      clients.add(c);
      out(c, { t: 'welcome', protocol: PROTOCOL, version: VERSION, user: publicUser(c.user), spaces: spacesOf(c.user.id).map(spaceInfo) });
      // catch up: the latest copy from every other device
      for (const d of await loadDocs('me:' + c.user.id)) if (d.deviceId !== c.deviceId) out(c, { t: 'doc', scope: 'me', ...d });
      for (const s of spacesOf(c.user.id)) {
        for (const d of await loadDocs(s.id)) if (d.deviceId !== c.deviceId) out(c, { t: 'doc', scope: s.id, ...d });
        out(c, { t: 'presence', space: s.id, people: presenceFor(s) });
      }
      return;
    }
    if (!c.deviceId) throw new Error('Say hello first');

    if (m.t === 'doc') {
      if (!m.state || typeof m.state !== 'object' || !m.state.boards) throw new Error('Bad document');
      const doc = { deviceId: c.deviceId, deviceName: c.deviceName, user: publicUser(c.user), savedAt: Date.now(), state: m.state };
      if (m.scope === 'me') {
        await storeDoc('me:' + c.user.id, doc);
        toUser(c.user.id, { t: 'doc', scope: 'me', ...doc }, c);
      } else {
        const s = db.spaces[m.scope];
        if (!s || !s.members.includes(c.user.id)) throw new Error('You’re not part of that shared board');
        await storeDoc(s.id, doc);
        toSpace(s, { t: 'doc', scope: s.id, ...doc }, c);
      }
      out(c, { t: 'saved', scope: m.scope, savedAt: doc.savedAt });
      return;
    }

    if (m.t === 'share') {
      // create or update a shared board; m.root = board id, m.with = [user names]
      if (!validId(m.root)) throw new Error('Bad board');
      const id = 'sp-' + m.root;
      let s = db.spaces[id];
      if (s && s.owner !== c.user.id && !s.members.includes(c.user.id)) throw new Error('Someone else already shares that board');
      const names = (Array.isArray(m.with) ? m.with : []).map((n) => String(n).trim().toLowerCase());
      const members = new Set([c.user.id]);
      for (const n of names) { const u = db.users[n]; if (u) members.add(u.id); }
      const before = s ? new Set(s.members) : new Set();
      if (!s) s = db.spaces[id] = { id, root: m.root, title: String(m.title || 'Shared board').slice(0, 120), owner: c.user.id, members: [], created: Date.now() };
      if (s.owner !== c.user.id) { for (const u of before) members.add(u); } // only the owner can remove people
      else if (s.owner) members.add(s.owner);
      s.members = [...members];
      if (m.title) s.title = String(m.title).slice(0, 120);
      save('spaces');
      if (m.state && m.state.boards) await storeDoc(s.id, { deviceId: c.deviceId, deviceName: c.deviceName, user: publicUser(c.user), savedAt: Date.now(), state: m.state });
      const info = spaceInfo(s);
      for (const uid of s.members) toUser(uid, { t: 'space', space: info });
      for (const uid of before) if (!s.members.includes(uid)) toUser(uid, { t: 'unshared', space: s.id, root: s.root });
      // newcomers get the board straight away
      for (const cl of clients) {
        if (s.members.includes(cl.user.id) && !before.has(cl.user.id) && cl !== c) for (const d of await loadDocs(s.id)) out(cl, { t: 'doc', scope: s.id, ...d });
      }
      log('shared', s.title, 'with', s.members.length, 'people');
      return;
    }

    if (m.t === 'unshare' || m.t === 'leave') {
      const s = db.spaces[m.space];
      if (!s || !s.members.includes(c.user.id)) return;
      if (m.t === 'unshare' && s.owner === c.user.id) {
        for (const uid of s.members) toUser(uid, { t: 'unshared', space: s.id, root: s.root });
        delete db.spaces[s.id];
        await fsp.rm(docDir(s.id), { recursive: true, force: true });
      } else {
        s.members = s.members.filter((x) => x !== c.user.id);
        toUser(c.user.id, { t: 'unshared', space: s.id, root: s.root });
        if (!s.members.length) delete db.spaces[s.id];
        else for (const uid of s.members) toUser(uid, { t: 'space', space: spaceInfo(s) });
      }
      save('spaces');
      return;
    }

    if (m.t === 'presence') {
      const was = c.presence && c.presence.space;
      c.presence = m.space ? { space: String(m.space), board: String(m.board || ''), card: m.card ? String(m.card) : null, editing: !!m.editing } : null;
      for (const s of spacesOf(c.user.id)) if (s.id === was || (c.presence && s.id === c.presence.space)) sendPresence(s);
      return;
    }

    if (m.t === 'ping') { out(c, { t: 'pong' }); return; }
  }

  // drop connections that went away without saying
  const heartbeat = setInterval(() => {
    for (const c of clients) {
      if (!c.alive) { c.ws.terminate(); continue; }
      c.alive = false;
      try { c.ws.ping(); } catch {}
    }
  }, 30000);
  server.on('close', () => clearInterval(heartbeat));

  return {
    server, wss, db,
    listen(port = opts.port ?? (+process.env.PORT || 8787), host = opts.host || process.env.HOST || '0.0.0.0') {
      return new Promise((resolve) => server.listen(port, host, () => resolve(server.address().port)));
    },
    close() { for (const c of clients) c.ws.terminate(); wss.close(); return new Promise((r) => server.close(r)); },
    webDir: WEB_DIR
  };
}

module.exports = { createServer };

if (require.main === module) {
  const s = createServer();
  s.listen().then((port) => {
    console.log(`Pocket-Canvas Server ${VERSION} is running on port ${port}.`);
    console.log(s.webDir ? `The browser version is at http://<this machine's address>:${port}/ (or your HTTPS address).` : 'The browser version isn’t included (see server/README.md to add it); the apps can still sign in.');
    if (!process.env.JOIN_CODE) console.log('No JOIN_CODE set, so nobody can create an account. Set JOIN_CODE to allow sign-ups.');
  });
}
