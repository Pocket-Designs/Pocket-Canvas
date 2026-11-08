// REST API: accounts, two-factor, devices and the synced address book.
import crypto from 'node:crypto';
import { config } from './config.js';
import { q, audit } from './db.js';
import {
  hashPassword, verifyPassword, signToken, verifyToken, newTotpSecret, verifyTotp,
  hashSecret, secretMatches, randomDeviceId,
} from './security.js';
import { allow } from './ratelimit.js';
import { hub } from './hub.js';

const MAX_BODY = 512 * 1024;
const OS_VALUES = new Set(['windows', 'linux', 'android', 'macos', 'unknown']);

class HttpError extends Error {
  constructor(status, code, extra = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

function clientIp(req) {
  if (config.trustProxy && req.headers['x-forwarded-for']) {
    return String(req.headers['x-forwarded-for']).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw new HttpError(413, 'too_large');
    chunks.push(c);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'bad_json');
  }
}

function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  });
  res.end(data);
}

const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function userFromToken(token) {
  const data = verifyToken(token);
  if (!data || data.kind !== 'user') return null;
  const user = q.userById.get(data.uid);
  if (!user || user.token_gen !== data.gen) return null;
  return user;
}

function requireUser(req) {
  const auth = String(req.headers.authorization || '');
  const user = userFromToken(auth.startsWith('Bearer ') ? auth.slice(7) : '');
  if (!user) throw new HttpError(401, 'unauthorized');
  return user;
}

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, totp: !!u.totp_enabled, admin: !!u.is_admin });

const routes = {
  'GET /api/health': () => ({ ok: true, name: 'Pocket-Connect', version: '0.1.0' }),

  'GET /api/info': () => ({
    registration: config.registration === 'open' || (config.registration === 'first-only' && q.userCount.get().n === 0),
  }),

  'POST /api/register': async (req) => {
    const ip = clientIp(req);
    if (!allow(`reg:${ip}`, 5, 3600_000)) throw new HttpError(429, 'rate_limited');
    const body = await readJson(req);
    const email = str(body.email, 120).toLowerCase();
    const name = str(body.name, 60) || email.split('@')[0];
    const password = typeof body.password === 'string' ? body.password : '';
    const count = q.userCount.get().n;
    const open = config.registration === 'open' || (config.registration === 'first-only' && count === 0);
    if (!open) throw new HttpError(403, 'registration_closed');
    if (!/^[^@\s]+@[^@\s]+$/.test(email)) throw new HttpError(400, 'bad_email');
    if (password.length < 10) throw new HttpError(400, 'weak_password');
    if (q.userByEmail.get(email)) throw new HttpError(409, 'email_taken');
    const r = q.insertUser.run(email, name, hashPassword(password), count === 0 ? 1 : 0, Date.now());
    audit('register', { userId: Number(r.lastInsertRowid), detail: { ip } });
    const user = q.userById.get(r.lastInsertRowid);
    return { token: signToken({ kind: 'user', uid: user.id, gen: user.token_gen }), user: publicUser(user) };
  },

  'POST /api/login': async (req) => {
    const ip = clientIp(req);
    const body = await readJson(req);
    const email = str(body.email, 120).toLowerCase();
    if (!allow(`login-ip:${ip}`, 20, 600_000) || !allow(`login-user:${email}`, 10, 600_000)) {
      throw new HttpError(429, 'rate_limited');
    }
    const user = q.userByEmail.get(email);
    const ok = user && verifyPassword(String(body.password || ''), user.pw_hash);
    if (!ok) {
      audit('login_failed', { userId: user?.id ?? null, detail: { ip } });
      throw new HttpError(401, 'bad_credentials');
    }
    if (user.totp_enabled) {
      if (!body.totp) throw new HttpError(401, 'need_totp');
      if (!verifyTotp(user.totp_secret, body.totp)) {
        audit('login_failed_totp', { userId: user.id, detail: { ip } });
        throw new HttpError(401, 'bad_totp');
      }
    }
    audit('login', { userId: user.id, detail: { ip } });
    return { token: signToken({ kind: 'user', uid: user.id, gen: user.token_gen }), user: publicUser(user) };
  },

  'GET /api/me': (req) => ({ user: publicUser(requireUser(req)) }),

  'POST /api/logout-everywhere': (req) => {
    const user = requireUser(req);
    q.bumpTokenGen.run(user.id);
    hub.dropUser(user.id);
    return { ok: true };
  },

  'POST /api/password': async (req) => {
    const user = requireUser(req);
    const body = await readJson(req);
    if (!verifyPassword(String(body.current || ''), user.pw_hash)) throw new HttpError(401, 'bad_credentials');
    if (typeof body.next !== 'string' || body.next.length < 10) throw new HttpError(400, 'weak_password');
    q.setPassword.run(hashPassword(body.next), user.id);
    audit('password_changed', { userId: user.id });
    const fresh = q.userById.get(user.id);
    hub.dropUser(user.id);
    return { token: signToken({ kind: 'user', uid: fresh.id, gen: fresh.token_gen }) };
  },

  'POST /api/2fa/setup': (req) => {
    const user = requireUser(req);
    if (user.totp_enabled) throw new HttpError(409, 'already_enabled');
    const secret = newTotpSecret();
    q.setTotp.run(secret, 0, user.id);
    const label = encodeURIComponent(`Pocket-Connect:${user.email}`);
    return { secret, uri: `otpauth://totp/${label}?secret=${secret}&issuer=Pocket-Connect` };
  },

  'POST /api/2fa/enable': async (req) => {
    const user = requireUser(req);
    const body = await readJson(req);
    if (!verifyTotp(user.totp_secret, body.code)) throw new HttpError(400, 'bad_totp');
    q.setTotp.run(user.totp_secret, 1, user.id);
    audit('totp_enabled', { userId: user.id });
    return { ok: true };
  },

  'POST /api/2fa/disable': async (req) => {
    const user = requireUser(req);
    const body = await readJson(req);
    if (!verifyPassword(String(body.password || ''), user.pw_hash) || !verifyTotp(user.totp_secret, body.code)) {
      throw new HttpError(401, 'bad_credentials');
    }
    q.setTotp.run(null, 0, user.id);
    audit('totp_disabled', { userId: user.id });
    return { ok: true };
  },

  // A host app asks for its permanent Pocket ID. No account needed.
  'POST /api/devices/register': async (req) => {
    const ip = clientIp(req);
    if (!allow(`devreg:${ip}`, 10, 3600_000)) throw new HttpError(429, 'rate_limited');
    const body = await readJson(req);
    const os = OS_VALUES.has(body.os) ? body.os : 'unknown';
    let id;
    do id = randomDeviceId(); while (q.deviceById.get(id));
    const secret = crypto.randomBytes(32).toString('base64url');
    q.insertDevice.run(id, hashSecret(secret), str(body.name, 60), os, str(body.hostname, 120), Date.now());
    audit('device_registered', { deviceId: id, detail: { ip, os } });
    return { id, secret };
  },

  // Signed-in host app attaches itself to the account (proves it is the device with its secret).
  'POST /api/devices/attach': async (req) => {
    const user = requireUser(req);
    const body = await readJson(req);
    const dev = q.deviceById.get(str(body.deviceId, 12));
    if (!dev || !secretMatches(String(body.deviceSecret || ''), dev.secret_hash)) throw new HttpError(403, 'bad_device');
    q.setDeviceOwner.run(user.id, dev.id);
    if (body.name) q.setDeviceName.run(str(body.name, 60), dev.id, user.id);
    audit('device_attached', { userId: user.id, deviceId: dev.id });
    hub.refreshOwner(dev.id, user.id);
    return { ok: true };
  },

  'POST /api/devices/detach': async (req) => {
    const user = requireUser(req);
    const body = await readJson(req);
    const dev = q.deviceById.get(str(body.deviceId, 12));
    if (!dev || dev.owner_id !== user.id) throw new HttpError(404, 'not_found');
    q.setDeviceOwner.run(null, dev.id);
    audit('device_detached', { userId: user.id, deviceId: dev.id });
    hub.refreshOwner(dev.id, null);
    return { ok: true };
  },

  'GET /api/devices': (req) => {
    const user = requireUser(req);
    return {
      devices: q.devicesByOwner.all(user.id).map((d) => ({ ...d, online: hub.isOnline(d.id) })),
    };
  },

  'PATCH /api/devices': async (req) => {
    const user = requireUser(req);
    const body = await readJson(req);
    q.setDeviceName.run(str(body.name, 60), str(body.deviceId, 12), user.id);
    return { ok: true };
  },

  // Address book: folders + saved devices. Never contains passwords (those stay on each client).
  'GET /api/book': (req) => {
    const user = requireUser(req);
    const row = q.bookByUser.get(user.id);
    return row ? { data: JSON.parse(row.data), version: row.version, updated: row.updated } : { data: null, version: 0 };
  },

  'PUT /api/book': async (req) => {
    const user = requireUser(req);
    const body = await readJson(req);
    if (!body.data || typeof body.data !== 'object') throw new HttpError(400, 'bad_book');
    const clean = sanitizeBook(body.data);
    const json = JSON.stringify(clean);
    const existing = q.bookByUser.get(user.id);
    if (!existing) {
      q.insertBook.run(user.id, json, Date.now());
      return { version: 1 };
    }
    const r = q.updateBook.run(json, Date.now(), user.id, Number(body.version));
    if (!r.changes) {
      throw new HttpError(409, 'version_conflict', { data: JSON.parse(existing.data), version: existing.version });
    }
    hub.notifyUser(user.id, { t: 'book-changed', version: existing.version + 1 });
    return { version: existing.version + 1 };
  },

  'GET /api/audit': (req) => {
    const user = requireUser(req);
    return { events: q.auditForUser.all(user.id) };
  },
};

function sanitizeBook(data) {
  const folders = Array.isArray(data.folders) ? data.folders.slice(0, 500) : [];
  const devices = Array.isArray(data.devices) ? data.devices.slice(0, 5000) : [];
  return {
    folders: folders.map((f) => ({
      id: str(f.id, 40),
      name: str(f.name, 60),
      parent: f.parent ? str(f.parent, 40) : null,
      color: str(f.color, 20),
    })),
    devices: devices.map((d) => ({
      id: str(d.id, 40),
      name: str(d.name, 80),
      address: str(d.address, 200),
      os: OS_VALUES.has(d.os) ? d.os : 'unknown',
      folder: d.folder ? str(d.folder, 40) : null,
      mode: ['desktop', 'terminal', 'both', 'android'].includes(d.mode) ? d.mode : 'desktop',
      notes: str(d.notes, 500),
    })),
  };
}

export async function handleHttp(req, res) {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const route = routes[`${req.method} ${url.pathname}`];
  if (!route) return send(res, 404, { error: 'not_found' });
  try {
    send(res, 200, await route(req, url));
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.code, ...err.extra });
    console.error(err);
    send(res, 500, { error: 'server_error' });
  }
}
