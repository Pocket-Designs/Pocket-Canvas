// Pocket-Canvas — local connection for the browser extension ("web clipper")
// Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
//
// Security:
//  • Listens on 127.0.0.1 only, so other computers on the network can't reach it.
//  • Requests from ordinary web pages are refused (their Origin isn't a browser extension).
//  • An extension must be approved once by the user ("pairing"), which gives it a secret
//    token. Every other request must carry that token.
'use strict';
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { downloadAsset } = require('./link-preview');

const EXT_ORIGIN = /^(chrome-extension|moz-extension|safari-web-extension|ms-browser-extension|extension):\/\//i;
const MAX_BODY = 60 * 1024 * 1024;

class ClipServer {
  constructor({ settings, assetDir, version, getStore, confirmPair, deliver }) {
    Object.assign(this, { settings, assetDir, version, getStore, confirmPair, deliver });
    this.server = null;
    this.status = { running: false, error: null, port: null };
    this.pairing = false;
  }

  start() {
    this.stop();
    const cfg = this.settings.get('clipper');
    if (!cfg.enabled) { this.status = { running: false, error: null, port: cfg.port }; return; }
    const srv = http.createServer((req, res) => this.handle(req, res).catch((err) => {
      this.reply(req, res, 500, { error: err.message || 'Something went wrong' });
    }));
    srv.on('error', (err) => {
      this.status = {
        running: false, port: cfg.port,
        error: err.code === 'EADDRINUSE' ? `Port ${cfg.port} is already in use by another program. Choose a different port.` : err.message
      };
    });
    srv.listen(cfg.port, '127.0.0.1', () => { this.status = { running: true, error: null, port: cfg.port }; });
    this.server = srv;
  }

  stop() {
    if (this.server) { try { this.server.close(); } catch {} }
    this.server = null;
    this.status = { ...this.status, running: false };
  }

  cors(req, res) {
    const origin = req.headers.origin;
    if (origin && EXT_ORIGIN.test(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
  }

  reply(req, res, code, body) {
    this.cors(req, res);
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  }

  token(req) {
    const h = req.headers.authorization || '';
    const m = /^Bearer\s+([a-f0-9]{64})$/i.exec(h);
    if (!m) return null;
    const given = Buffer.from(m[1].toLowerCase());
    return this.settings.get('clipper').tokens.find((t) => {
      const want = Buffer.from(t.token);
      return want.length === given.length && crypto.timingSafeEqual(want, given);
    }) || null;
  }

  readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = []; let size = 0;
      req.on('data', (c) => {
        size += c.length;
        if (size > MAX_BODY) { reject(new Error('Too large')); req.destroy(); return; }
        chunks.push(c);
      });
      req.on('end', () => {
        try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
        catch { reject(new Error('Not valid JSON')); }
      });
      req.on('error', reject);
    });
  }

  async handle(req, res) {
    const origin = req.headers.origin;
    // Ordinary websites must never be able to talk to the app.
    if (origin && !EXT_ORIGIN.test(origin)) return this.reply(req, res, 403, { error: 'Not allowed' });
    if (req.method === 'OPTIONS') { this.cors(req, res); res.writeHead(204); return res.end(); }
    const url = new URL(req.url, 'http://127.0.0.1');
    const route = req.method + ' ' + url.pathname;

    if (route === 'GET /status') {
      return this.reply(req, res, 200, { app: 'Pocket-Canvas', version: this.version, paired: !!this.token(req) });
    }

    if (route === 'POST /pair') {
      const body = await this.readBody(req);
      if (this.pairing) return this.reply(req, res, 409, { error: 'Already waiting for you to answer in Pocket-Canvas' });
      this.pairing = true;
      try {
        const browser = String(body.browser || 'A browser').replace(/[^\w .()-]/g, '').slice(0, 40) || 'A browser';
        const ok = await this.confirmPair(browser);
        if (!ok) return this.reply(req, res, 403, { error: 'Connection was not allowed in Pocket-Canvas' });
        const entry = { id: crypto.randomBytes(4).toString('hex'), name: browser, token: crypto.randomBytes(32).toString('hex'), created: Date.now() };
        const cfg = this.settings.get('clipper');
        this.settings.set({ clipper: { tokens: [...cfg.tokens, entry] } });
        return this.reply(req, res, 200, { token: entry.token });
      } finally { this.pairing = false; }
    }

    const who = this.token(req);
    if (!who) return this.reply(req, res, 401, { error: 'Not connected. Open the extension and click Connect.' });

    if (route === 'GET /boards') {
      return this.reply(req, res, 200, { boards: this.boardList() });
    }

    if (route === 'POST /clip') {
      const body = await this.readBody(req);
      const clip = await this.prepare(body);
      const result = await this.deliver(clip);
      return this.reply(req, res, 200, { ok: true, board: result && result.boardTitle });
    }

    return this.reply(req, res, 404, { error: 'Unknown request' });
  }

  boardList() {
    const store = this.getStore();
    if (!store || !store.boards || !store.boards[store.root]) return [];
    const out = [];
    const walk = (id, depth, seen) => {
      const b = store.boards[id];
      if (!b || seen.has(id)) return;
      seen.add(id);
      out.push({ id, title: b.title || 'Untitled board', depth });
      const kids = [];
      const visit = (cid) => {
        const c = b.cards[cid];
        if (!c) return;
        if (c.type === 'board' && store.boards[c.boardId]) kids.push(c.boardId);
        if (c.type === 'column') (c.items || []).forEach(visit);
      };
      (b.order || []).forEach((cid) => { if (b.cards[cid] && !b.cards[cid].col) visit(cid); });
      kids.forEach((k) => walk(k, depth + 1, seen));
    };
    walk(store.root, 0, new Set());
    return out;
  }

  saveDataUrl(dataUrl, fallbackName) {
    const m = /^data:([\w/+.-]+);base64,(.+)$/s.exec(dataUrl || '');
    if (!m) return null;
    const type = m[1].toLowerCase();
    const ext = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg' }[type] || '.bin';
    const buf = Buffer.from(m[2], 'base64');
    const id = crypto.randomBytes(8).toString('hex') + ext;
    fs.writeFileSync(path.join(this.assetDir, id), buf);
    return { id, name: fallbackName + ext, size: buf.length, type };
  }

  // Turn what the extension sent into a card description for the interface.
  async prepare(b) {
    const str = (v, n = 2000) => (typeof v === 'string' ? v : '').slice(0, n);
    const isWeb = (u) => /^https?:\/\//i.test(u || '');
    const pageUrl = isWeb(b.pageUrl) ? str(b.pageUrl) : '';
    const pageTitle = str(b.pageTitle, 300);
    const base = { boardId: str(b.boardId, 40), note: str(b.note, 5000), source: pageUrl, sourceTitle: pageTitle };

    switch (b.kind) {
      case 'text':
        return { ...base, card: { type: 'note', text: str(b.text, 100000) } };
      case 'image':
      case 'screenshot': {
        let a = b.dataUrl ? this.saveDataUrl(b.dataUrl, b.kind === 'screenshot' ? 'screenshot' : 'image') : null;
        if (!a && isWeb(b.srcUrl)) a = await downloadAsset(b.srcUrl, this.assetDir, { maxBytes: 30 * 1024 * 1024, accept: /^image\// }).catch(() => null);
        if (!a) return { ...base, card: { type: 'link', url: isWeb(b.srcUrl) ? b.srcUrl : pageUrl, title: pageTitle } };
        const caption = b.kind === 'screenshot' ? `Screenshot: ${pageTitle}` : (str(b.alt, 300) || '');
        return { ...base, card: { type: 'image', asset: a.id, caption } };
      }
      case 'media': {
        const a = isWeb(b.srcUrl)
          ? await downloadAsset(b.srcUrl, this.assetDir, { maxBytes: 500 * 1024 * 1024, accept: /^(audio|video)\//, timeout: 120000 }).catch(() => null)
          : null;
        if (!a) return { ...base, card: { type: 'link', url: isWeb(b.srcUrl) ? b.srcUrl : pageUrl, title: pageTitle || 'Media' } };
        return { ...base, card: { type: 'media', asset: a.id, name: a.name, size: a.size, kind: /^video\//.test(a.type) ? 'video' : 'audio' } };
      }
      case 'link':
      case 'page':
      default: {
        const url = isWeb(b.url) ? str(b.url) : pageUrl;
        if (!url) throw new Error('Nothing to save on this page');
        return { ...base, card: { type: 'link', url, title: str(b.title, 300) || (b.kind === 'page' ? pageTitle : '') } };
      }
    }
  }
}

module.exports = { ClipServer, EXT_ORIGIN };
