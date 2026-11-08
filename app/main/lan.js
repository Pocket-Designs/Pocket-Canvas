// Direct connections on the local network, no server needed.
//  - TCP/WebSocket listener (default port 47100) carries the short WebRTC set-up messages.
//  - UDP port 47101 answers "who is there?" broadcasts so viewers can list nearby hosts.
// Session data itself is end-to-end encrypted by WebRTC (DTLS), and the password proof is
// bound to the DTLS certificates, so a LAN attacker who tampers with set-up messages is caught.
const os = require('os');
const dgram = require('dgram');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const DISCOVERY_PORT = 47101;
const PROBE = 'PCDISCOVER1';

let wss = null;
let udp = null;
const sockets = new Map(); // sid -> ws

function isPrivate(addr) {
  const a = String(addr || '').replace(/^::ffff:/, '');
  if (a === '::1' || /^127\./.test(a)) return true;
  if (/^10\./.test(a) || /^192\.168\./.test(a) || /^169\.254\./.test(a)) return true;
  const m = a.match(/^172\.(\d+)\./);
  if (m && +m[1] >= 16 && +m[1] <= 31) return true;
  const c = a.match(/^100\.(\d+)\./); // CGNAT range used by Tailscale and similar VPNs
  if (c && +c[1] >= 64 && +c[1] <= 127) return true;
  return /^f[cd]/i.test(a) || /^fe80:/i.test(a);
}

function addresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const i of list || []) {
      if (i.family === 'IPv4' && !i.internal) out.push({ name, address: i.address, netmask: i.netmask });
    }
  }
  return out;
}

function broadcastAddresses() {
  const set = new Set(['255.255.255.255']);
  for (const { address, netmask } of addresses()) {
    const a = address.split('.').map(Number);
    const m = netmask.split('.').map(Number);
    set.add(a.map((x, i) => (x & m[i]) | (~m[i] & 255)).join('.'));
  }
  return [...set];
}

// handlers: { onIncoming(info), onSignal(sid, data), onBye(sid), getInfo(), getSettings() }
function start(handlers) {
  stop();
  const { lanPort, lanPrivateOnly } = handlers.getSettings().host;
  wss = new WebSocketServer({ port: lanPort, path: '/pc', maxPayload: 128 * 1024 });
  wss.on('error', (err) => handlers.onError?.(err));
  wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    if (lanPrivateOnly && !isPrivate(ip)) return ws.close(4003, 'private networks only');
    let sid = null;
    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!sid && msg.t === 'connect' && typeof msg.sid === 'string') {
        sid = `lan-${crypto.randomBytes(8).toString('hex')}`;
        sockets.set(sid, ws);
        ws.peerSid = msg.sid.slice(0, 64);
        return handlers.onIncoming({
          sid, mode: msg.mode, owner: false, from: String(msg.name || 'LAN viewer').slice(0, 40),
          ip: ip.replace(/^::ffff:/, ''), via: 'lan',
        });
      }
      if (sid && msg.t === 'signal') handlers.onSignal(sid, msg.data);
      if (sid && msg.t === 'bye') handlers.onBye(sid);
    });
    ws.on('close', () => {
      if (sid && sockets.get(sid) === ws) {
        sockets.delete(sid);
        handlers.onSocketClosed?.(sid);
      }
    });
  });

  udp = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  udp.on('error', () => {});
  udp.on('message', (buf, rinfo) => {
    if (buf.toString() !== PROBE) return;
    if (lanPrivateOnly && !isPrivate(rinfo.address)) return;
    const info = handlers.getInfo();
    const reply = Buffer.from(JSON.stringify({ pc: 1, ...info, port: lanPort }));
    udp.send(reply, rinfo.port, rinfo.address);
  });
  udp.bind(DISCOVERY_PORT);
}

// Send a message to the viewer on a LAN session (translating our sid back to theirs).
function send(sid, msg) {
  const ws = sockets.get(sid);
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ ...msg, sid: ws.peerSid }));
}

function endSession(sid) {
  const ws = sockets.get(sid);
  if (ws) {
    sockets.delete(sid);
    try {
      ws.close();
    } catch {}
  }
}

function stop() {
  for (const ws of sockets.values()) ws.close();
  sockets.clear();
  wss?.close();
  wss = null;
  try {
    udp?.close();
  } catch {}
  udp = null;
}

function discover(timeoutMs = 1500) {
  return new Promise((resolve) => {
    const found = new Map();
    const s = dgram.createSocket('udp4');
    const own = new Set(addresses().map((a) => a.address));
    s.on('message', (buf, rinfo) => {
      try {
        const info = JSON.parse(buf.toString());
        if (info.pc !== 1) return;
        const key = `${rinfo.address}:${info.port}`;
        found.set(key, { ...info, address: rinfo.address, self: own.has(rinfo.address) });
      } catch {}
    });
    s.on('error', () => {});
    s.bind(0, () => {
      s.setBroadcast(true);
      for (const b of broadcastAddresses()) s.send(PROBE, DISCOVERY_PORT, b);
      s.send(PROBE, DISCOVERY_PORT, '127.0.0.1');
    });
    setTimeout(() => {
      try {
        s.close();
      } catch {}
      resolve([...found.values()]);
    }, timeoutMs);
  });
}

module.exports = { start, stop, send, endSession, discover, addresses, isPrivate };
