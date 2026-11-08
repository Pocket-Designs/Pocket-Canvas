// WebSocket signalling hub. Devices (hosts) keep one socket open; viewers open one per session
// or per app window. The hub only passes WebRTC set-up messages between the two ends of a
// session; screen, input and terminal data travel end-to-end encrypted (DTLS) and never pass
// through here unless the TURN relay is used — and the relay only sees encrypted packets.
import crypto from 'node:crypto';
import { q, audit } from './db.js';
import { iceServers, secretMatches } from './security.js';
import { allow } from './ratelimit.js';

const OS_VALUES = new Set(['windows', 'linux', 'android', 'macos', 'unknown']);

class Hub {
  constructor() {
    this.devices = new Map(); // deviceId -> ws
    this.viewersByUser = new Map(); // userId -> Set<ws>
    this.sessions = new Map(); // sid -> { viewer, host, deviceId, accepted, created }
  }

  isOnline(id) {
    return this.devices.has(id);
  }

  send(ws, msg) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  }

  notifyUser(userId, msg) {
    for (const ws of this.viewersByUser.get(userId) || []) this.send(ws, msg);
  }

  dropUser(userId) {
    for (const ws of this.viewersByUser.get(userId) || []) ws.close(4001, 'signed out');
  }

  refreshOwner(deviceId, ownerId) {
    const ws = this.devices.get(deviceId);
    if (ws) ws.ctx.ownerId = ownerId;
    if (ownerId) this.notifyUser(ownerId, { t: 'presence', id: deviceId, online: !!ws });
  }

  attach(ws, req, userFromToken) {
    ws.ctx = { role: null, ip: req.socket.remoteAddress };
    ws.isAlive = true;
    ws.on('pong', () => (ws.isAlive = true));
    const helloTimer = setTimeout(() => !ws.ctx.role && ws.close(4000, 'no hello'), 10_000);

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!ws.ctx.role) {
        clearTimeout(helloTimer);
        return this.hello(ws, msg, userFromToken);
      }
      this.route(ws, msg);
    });

    ws.on('close', () => {
      clearTimeout(helloTimer);
      this.cleanup(ws);
    });
  }

  hello(ws, msg, userFromToken) {
    if (msg.t !== 'hello') return ws.close(4000, 'expected hello');
    if (msg.role === 'device') {
      const dev = q.deviceById.get(String(msg.id || ''));
      if (!dev || !secretMatches(String(msg.secret || ''), dev.secret_hash)) {
        this.send(ws, { t: 'error', code: 'bad_device' });
        return ws.close(4003, 'bad device');
      }
      const old = this.devices.get(dev.id);
      if (old) old.close(4002, 'replaced');
      const os = OS_VALUES.has(msg.os) ? msg.os : dev.os;
      q.updateDeviceInfo.run(os, String(msg.hostname || dev.hostname).slice(0, 120), Date.now(), dev.id);
      ws.ctx = { ...ws.ctx, role: 'device', deviceId: dev.id, ownerId: dev.owner_id, os, name: dev.name || msg.hostname };
      this.devices.set(dev.id, ws);
      this.send(ws, { t: 'welcome', id: dev.id, attached: !!dev.owner_id });
      if (dev.owner_id) this.notifyUser(dev.owner_id, { t: 'presence', id: dev.id, online: true });
      return;
    }
    if (msg.role === 'viewer') {
      const user = msg.token ? userFromToken(msg.token) : null;
      if (msg.token && !user) {
        this.send(ws, { t: 'error', code: 'bad_token' });
        return ws.close(4001, 'bad token');
      }
      ws.ctx = {
        ...ws.ctx,
        role: 'viewer',
        userId: user?.id ?? null,
        label: user ? user.name : String(msg.name || 'Guest').slice(0, 40),
      };
      if (user) {
        if (!this.viewersByUser.has(user.id)) this.viewersByUser.set(user.id, new Set());
        this.viewersByUser.get(user.id).add(ws);
      }
      this.send(ws, { t: 'welcome', user: user ? { id: user.id, name: user.name } : null });
      return;
    }
    ws.close(4000, 'bad role');
  }

  route(ws, msg) {
    const { role } = ws.ctx;
    const sid = typeof msg.sid === 'string' ? msg.sid.slice(0, 64) : '';

    if (msg.t === 'ping') return this.send(ws, { t: 'pong' });

    if (role === 'viewer' && msg.t === 'connect') {
      const to = String(msg.to || '').replace(/\D/g, '');
      if (!sid || this.sessions.has(sid)) return this.send(ws, { t: 'error', sid, code: 'bad_session' });
      // Throttle connection attempts per viewer IP and per target device.
      if (!allow(`conn-ip:${ws.ctx.ip}`, 30, 600_000) || !allow(`conn-dev:${to}`, 60, 600_000)) {
        return this.send(ws, { t: 'error', sid, code: 'rate_limited' });
      }
      const host = this.devices.get(to);
      if (!host) return this.send(ws, { t: 'error', sid, code: 'offline' });
      const owner = !!(ws.ctx.userId && host.ctx.ownerId === ws.ctx.userId);
      this.sessions.set(sid, { viewer: ws, host, deviceId: to, accepted: false, created: Date.now() });
      audit('connect_request', { userId: ws.ctx.userId, deviceId: to, detail: { ip: ws.ctx.ip, owner } });
      return this.send(host, {
        t: 'incoming',
        sid,
        mode: ['desktop', 'terminal', 'both', 'android'].includes(msg.mode) ? msg.mode : 'desktop',
        owner,
        from: ws.ctx.label,
        ip: ws.ctx.ip,
      });
    }

    const s = this.sessions.get(sid);
    if (!s) return;
    const isHost = role === 'device' && s.host === ws;
    const isViewer = role === 'viewer' && s.viewer === ws;
    if (!isHost && !isViewer) return;

    if (isHost && msg.t === 'accept' && !s.accepted) {
      s.accepted = true;
      const label = crypto.randomBytes(6).toString('hex');
      this.send(s.viewer, { t: 'accepted', sid, ice: iceServers(label), host: { os: ws.ctx.os, name: ws.ctx.name } });
      this.send(s.host, { t: 'ice-config', sid, ice: iceServers(label) });
      return;
    }
    if (isHost && msg.t === 'reject') {
      this.send(s.viewer, { t: 'rejected', sid, reason: String(msg.reason || 'declined').slice(0, 40) });
      this.sessions.delete(sid);
      return;
    }
    if (msg.t === 'signal' && s.accepted) {
      return this.send(isHost ? s.viewer : s.host, { t: 'signal', sid, data: msg.data });
    }
    if (msg.t === 'bye') {
      this.send(isHost ? s.viewer : s.host, { t: 'bye', sid });
      this.sessions.delete(sid);
    }
  }

  cleanup(ws) {
    const { role } = ws.ctx;
    if (role === 'device' && this.devices.get(ws.ctx.deviceId) === ws) {
      this.devices.delete(ws.ctx.deviceId);
      if (ws.ctx.ownerId) this.notifyUser(ws.ctx.ownerId, { t: 'presence', id: ws.ctx.deviceId, online: false });
    }
    if (role === 'viewer' && ws.ctx.userId) this.viewersByUser.get(ws.ctx.userId)?.delete(ws);
    for (const [sid, s] of this.sessions) {
      if (s.viewer === ws || s.host === ws) {
        // Signalling sockets can drop after the WebRTC link is up; only tell the other side for
        // sessions that never finished setting up.
        if (!s.accepted) this.send(s.viewer === ws ? s.host : s.viewer, { t: 'bye', sid });
        this.sessions.delete(sid);
      }
    }
  }

  startHeartbeat(wss) {
    setInterval(() => {
      for (const ws of wss.clients) {
        if (!ws.isAlive) {
          ws.terminate();
          continue;
        }
        ws.isAlive = false;
        ws.ping();
      }
      const cutoff = Date.now() - 120_000;
      for (const [sid, s] of this.sessions) if (s.created < cutoff) this.sessions.delete(sid);
    }, 30_000).unref();
  }
}

export const hub = new Hub();
