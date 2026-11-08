// Talks to the self-hosted Pocket-Connect server: REST calls (account, devices, address book)
// and WebSockets (this device's always-on presence socket, and one socket per viewer session).
//
// If the server uses a private or self-signed certificate, the SHA-256 fingerprint of that
// certificate can be pinned in Settings. With a pin set, ONLY that exact certificate is accepted.
const http = require('http');
const https = require('https');
const tls = require('tls');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const WebSocket = require('ws');
const store = require('./store');

function base() {
  const raw = (store.getSettings().serverUrl || '').trim().replace(/\/+$/, '');
  if (!raw) return null;
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

const normFp = (s) => String(s || '').replace(/[^0-9a-f]/gi, '').toUpperCase();

// With a pin set, normal certificate-authority checks are replaced by an exact match against the
// pinned SHA-256 fingerprint (of the server certificate or any certificate above it in the chain,
// so a private CA can be pinned too). The check runs on the raw TLS socket BEFORE it is handed to
// HTTP or WebSocket code, so nothing is ever sent to a server that fails it.
function chainMatches(cert, pin) {
  const seen = new Set();
  for (let c = cert; c && !seen.has(c); c = c.issuerCertificate) {
    seen.add(c);
    if (normFp(c.fingerprint256) === pin) return true;
  }
  return false;
}

class PinnedAgent extends https.Agent {
  constructor(pin) {
    super({ keepAlive: false, maxCachedSessions: 0 });
    this.pin = pin;
  }

  createConnection(options, done) {
    const sock = tls.connect({ ...options, rejectUnauthorized: false, session: undefined });
    let finished = false;
    const finish = (err) => {
      if (finished) return;
      finished = true;
      if (err) {
        sock.destroy();
        done(err);
      } else done(null, sock);
    };
    sock.once('secureConnect', () => {
      const cert = sock.getPeerCertificate(true);
      if (cert && chainMatches(cert, this.pin)) finish();
      else finish(new Error(`Server certificate does not match the pinned fingerprint (got ${cert?.fingerprint256 || 'none'}).`));
    });
    sock.once('error', finish);
    return undefined; // the socket is handed over only after the check above
  }
}

function pinnedAgent() {
  const pin = normFp(store.getSettings().serverCertSha256);
  return pin ? new PinnedAgent(pin) : undefined;
}

// Pinning needs the check to run on every connection, so a fresh pinned agent is used per request.
function agentFor(url) {
  if (!url.startsWith('https:')) return undefined;
  return pinnedAgent();
}

function request(method, path, body, { token, url: override } = {}) {
  const b = override || base();
  if (!b) return Promise.reject(Object.assign(new Error('No server is set. Add one in Settings.'), { code: 'no_server' }));
  const url = new URL(b + path);
  const lib = url.protocol === 'https:' ? https : http;
  const data = body ? Buffer.from(JSON.stringify(body)) : null;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      url,
      {
        method,
        agent: agentFor(url.href),
        headers: {
          Accept: 'application/json',
          ...(data ? { 'Content-Type': 'application/json', 'Content-Length': data.length } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        timeout: 15000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          let json = {};
          try {
            json = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          } catch {}
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve(json);
          const err = new Error(json.error || `HTTP ${res.statusCode}`);
          err.code = json.error || `http_${res.statusCode}`;
          err.status = res.statusCode;
          err.body = json;
          reject(err);
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('The server did not answer in time.')));
    req.on('error', (e) => reject(Object.assign(new Error(friendlyNetError(e)), { code: 'network' })));
    if (data) req.write(data);
    req.end();
  });
}

function friendlyNetError(e) {
  if (/fingerprint/.test(e.message)) return e.message;
  if (e.code === 'ENOTFOUND') return 'Server name not found. Check the server address.';
  if (e.code === 'ECONNREFUSED') return 'The server refused the connection. Is it running?';
  if (/certificate|self.signed|UNABLE_TO_VERIFY/i.test(e.message + e.code)) {
    return 'The server certificate is not trusted. Use a public certificate, or pin its fingerprint in Settings.';
  }
  return e.message || 'Network error';
}

// Fetch the certificate fingerprint of a server so the user can confirm and pin it.
function probeCertificate(rawUrl) {
  return new Promise((resolve, reject) => {
    const url = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
    if (url.protocol !== 'https:') return reject(new Error('Only https servers have a certificate to pin.'));
    const req = https.request(url, { method: 'GET', path: '/api/health', rejectUnauthorized: false, agent: false, timeout: 8000 }, (res) => {
      const cert = res.socket.getPeerCertificate();
      res.resume();
      resolve({
        fingerprint256: cert.fingerprint256,
        subject: cert.subject?.CN || '',
        issuer: cert.issuer?.CN || cert.issuer?.O || '',
        validTo: cert.valid_to,
        trusted: res.socket.authorized,
      });
    });
    req.on('timeout', () => req.destroy(new Error('Timed out')));
    req.on('error', reject);
    req.end();
  });
}

function wsUrl() {
  const b = base();
  if (!b) return null;
  return b.replace(/^http/i, 'ws') + '/ws';
}

function openSocket() {
  const url = wsUrl();
  if (!url) throw Object.assign(new Error('No server is set.'), { code: 'no_server' });
  const agent = url.startsWith('wss:') ? pinnedAgent() : undefined;
  return new WebSocket(url, { agent, handshakeTimeout: 10000, maxPayload: 256 * 1024 });
}

// ---------------------------------------------------------------- device presence socket
class DeviceLink extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.state = 'off'; // off | connecting | online | error
    this.retry = 0;
    this.timer = null;
    this.stopped = true;
  }

  start(hello) {
    this.hello = hello;
    this.stopped = false;
    this.connect();
  }

  setState(state, detail) {
    this.state = state;
    this.detail = detail || '';
    this.emit('state', state, this.detail);
  }

  connect() {
    clearTimeout(this.timer);
    if (this.stopped) return;
    let ws;
    try {
      ws = openSocket();
    } catch (e) {
      return this.setState('off', e.message);
    }
    this.ws = ws;
    this.setState('connecting');
    ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', role: 'device', ...this.hello() })));
    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.t === 'welcome') {
        this.retry = 0;
        this.setState('online');
        this.emit('welcome', msg);
        return;
      }
      if (msg.t === 'error' && msg.code === 'bad_device') {
        this.emit('bad-device');
        return;
      }
      this.emit('message', msg);
    });
    ws.on('error', (e) => this.setState('error', friendlyNetError(e)));
    ws.on('close', (code) => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.stopped) return this.setState('off');
      if (code === 4003) return this.setState('error', 'The server did not recognise this device.');
      const delay = Math.min(60_000, 1000 * 2 ** Math.min(this.retry++, 6)) + Math.random() * 1000;
      this.setState(this.state === 'error' ? 'error' : 'connecting', this.detail);
      this.timer = setTimeout(() => this.connect(), delay);
    });
  }

  send(msg) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg));
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    const ws = this.ws;
    this.ws = null;
    try {
      ws?.close();
    } catch {}
    this.setState('off');
  }

  restart() {
    this.stop();
    if (this.hello) this.start(this.hello);
  }
}

// ---------------------------------------------------------------- viewer socket (one per session)
function viewerSocket({ token, name }, onMessage, onClose) {
  const ws = openSocket();
  const queue = [];
  let ready = false;
  ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', role: 'viewer', token: token || undefined, name })));
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.t === 'welcome') {
      ready = true;
      for (const m of queue.splice(0)) ws.send(JSON.stringify(m));
      return;
    }
    onMessage(msg);
  });
  ws.on('error', (e) => onMessage({ t: 'error', code: 'server', detail: friendlyNetError(e) }));
  ws.on('close', (code) => {
    if (!ready && code === 4001) onMessage({ t: 'error', code: 'bad_token' });
    onClose?.();
  });
  return {
    send(msg) {
      if (ready && ws.readyState === 1) ws.send(JSON.stringify(msg));
      else queue.push(msg);
    },
    close() {
      try {
        ws.close();
      } catch {}
    },
  };
}

// LAN direct: connect to a host's own listener (ws://address:47100/pc).
function lanSocket(address, onMessage, onClose) {
  let host = address.trim();
  let port = 47100;
  const m = host.match(/^\[?([^\]]+?)\]?(?::(\d+))?$/);
  if (m) {
    host = m[1];
    if (m[2]) port = Number(m[2]);
  }
  const url = `ws://${host.includes(':') ? `[${host}]` : host}:${port}/pc`;
  const ws = new WebSocket(url, { handshakeTimeout: 6000, maxPayload: 128 * 1024 });
  const queue = [];
  ws.on('open', () => {
    for (const msg of queue.splice(0)) ws.send(JSON.stringify(msg));
  });
  ws.on('message', (raw) => {
    try {
      onMessage(JSON.parse(raw.toString()));
    } catch {}
  });
  ws.on('error', () => onMessage({ t: 'error', code: 'unreachable' }));
  ws.on('close', () => onClose?.());
  return {
    send(msg) {
      if (ws.readyState === 1) ws.send(JSON.stringify(msg));
      else if (ws.readyState === 0) queue.push(msg);
    },
    close() {
      try {
        ws.close();
      } catch {}
    },
  };
}

module.exports = {
  request, probeCertificate, DeviceLink, viewerSocket, lanSocket, base, sha256: (s) => crypto.createHash('sha256').update(s).digest('hex'),
};
