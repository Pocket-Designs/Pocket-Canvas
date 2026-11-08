import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';

const PORT = 18000 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;
let proc;
let dataDir;

async function api(method, p, body, token) {
  const res = await fetch(BASE + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

function ws() {
  return new Promise((resolve, reject) => {
    const s = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    s.queue = [];
    s.waiters = [];
    s.on('message', (m) => {
      const msg = JSON.parse(m.toString());
      const w = s.waiters.findIndex((x) => x.pred(msg));
      if (w >= 0) s.waiters.splice(w, 1)[0].resolve(msg);
      else s.queue.push(msg);
    });
    s.next = (pred = () => true) =>
      new Promise((res) => {
        const i = s.queue.findIndex(pred);
        if (i >= 0) return res(s.queue.splice(i, 1)[0]);
        s.waiters.push({ pred, resolve: res });
      });
    s.j = (o) => s.send(JSON.stringify(o));
    s.on('open', () => resolve(s));
    s.on('error', reject);
  });
}

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcs-'));
  proc = spawn(process.execPath, ['src/index.js'], {
    env: {
      ...process.env, PC_PORT: String(PORT), PC_HOST: '127.0.0.1', PC_DATA_DIR: dataDir,
      PC_TURN_URLS: 'turn:example.test:3478', PC_TURN_SECRET: 'test-secret', PC_STUN_URLS: 'stun:example.test:3478',
    },
    stdio: 'pipe',
  });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
});

after(() => {
  proc?.kill();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

let token;
let device;

test('first account registers and becomes admin; second is refused (first-only)', async () => {
  const weak = await api('POST', '/api/register', { email: 'a@b.c', password: 'short' });
  assert.equal(weak.body.error, 'weak_password');
  const r = await api('POST', '/api/register', { email: 'me@home.lan', name: 'Me', password: 'correct horse battery' });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.admin, true);
  token = r.body.token;
  const r2 = await api('POST', '/api/register', { email: 'other@home.lan', password: 'another long password' });
  assert.equal(r2.body.error, 'registration_closed');
});

test('login, wrong password and two-factor', async () => {
  assert.equal((await api('POST', '/api/login', { email: 'me@home.lan', password: 'nope' })).status, 401);
  const setup = await api('POST', '/api/2fa/setup', {}, token);
  assert.match(setup.body.uri, /^otpauth:\/\/totp\//);
  const { totpCode } = await import('../src/security.js');
  assert.equal((await api('POST', '/api/2fa/enable', { code: totpCode(setup.body.secret) }, token)).status, 200);
  const need = await api('POST', '/api/login', { email: 'me@home.lan', password: 'correct horse battery' });
  assert.equal(need.body.error, 'need_totp');
  const ok = await api('POST', '/api/login', {
    email: 'ME@home.lan', password: 'correct horse battery', totp: totpCode(setup.body.secret),
  });
  assert.equal(ok.status, 200);
  token = ok.body.token;
});

test('device registers, attaches to account and appears in device list', async () => {
  const r = await api('POST', '/api/devices/register', { os: 'linux', hostname: 'lab-01' });
  assert.match(r.body.id, /^\d{9}$/);
  device = r.body;
  const bad = await api('POST', '/api/devices/attach', { deviceId: device.id, deviceSecret: 'wrong' }, token);
  assert.equal(bad.status, 403);
  const ok = await api('POST', '/api/devices/attach', { deviceId: device.id, deviceSecret: device.secret, name: 'Lab box' }, token);
  assert.equal(ok.status, 200);
  const list = await api('GET', '/api/devices', null, token);
  assert.equal(list.body.devices[0].name, 'Lab box');
  assert.equal(list.body.devices[0].online, false);
});

test('address book sync with version conflict detection', async () => {
  const empty = await api('GET', '/api/book', null, token);
  assert.equal(empty.body.version, 0);
  const book = {
    folders: [{ id: 'f1', name: 'Home lab', parent: null }],
    devices: [{ id: 'd1', name: 'NAS', address: '192.168.1.20', os: 'linux', folder: 'f1', password: 'MUST NOT BE STORED' }],
  };
  const v1 = await api('PUT', '/api/book', { data: book, version: 0 }, token);
  assert.equal(v1.body.version, 1);
  const got = await api('GET', '/api/book', null, token);
  assert.equal(got.body.data.devices[0].password, undefined, 'passwords are stripped');
  const stale = await api('PUT', '/api/book', { data: book, version: 0 }, token);
  assert.equal(stale.status, 409);
  assert.equal(stale.body.version, 1);
});

test('signalling: owner flag, accept, TURN credentials and relay', async () => {
  const host = await ws();
  host.j({ t: 'hello', role: 'device', id: device.id, secret: device.secret, os: 'linux', hostname: 'lab-01' });
  assert.equal((await host.next()).t, 'welcome');

  const owner = await ws();
  owner.j({ t: 'hello', role: 'viewer', token });
  assert.equal((await owner.next((m) => m.t === 'welcome')).user.name, 'Me');

  const guest = await ws();
  guest.j({ t: 'hello', role: 'viewer', name: 'Visitor' });
  await guest.next();

  guest.j({ t: 'connect', sid: 'g1', to: device.id, mode: 'terminal' });
  const inc1 = await host.next((m) => m.t === 'incoming');
  assert.equal(inc1.owner, false);
  assert.equal(inc1.from, 'Visitor');
  // Signals before acceptance are dropped
  guest.j({ t: 'signal', sid: 'g1', data: { x: 1 } });
  host.j({ t: 'reject', sid: 'g1', reason: 'busy' });
  assert.equal((await guest.next((m) => m.t === 'rejected')).reason, 'busy');

  owner.j({ t: 'connect', sid: 'o1', to: device.id.replace(/(\d{3})/g, '$1 '), mode: 'both' });
  const inc2 = await host.next((m) => m.t === 'incoming');
  assert.equal(inc2.owner, true);
  assert.equal(inc2.mode, 'both');
  host.j({ t: 'accept', sid: 'o1' });
  const acc = await owner.next((m) => m.t === 'accepted');
  assert.equal(acc.ice[1].urls[0], 'turn:example.test:3478');
  assert.match(acc.ice[1].username, /^\d+:[0-9a-f]+$/);
  owner.j({ t: 'signal', sid: 'o1', data: { sdp: 'offer' } });
  assert.deepEqual((await host.next((m) => m.t === 'signal')).data, { sdp: 'offer' });
  host.j({ t: 'signal', sid: 'o1', data: { sdp: 'answer' } });
  assert.deepEqual((await owner.next((m) => m.t === 'signal')).data, { sdp: 'answer' });

  // Guest cannot inject into the owner's session
  guest.j({ t: 'signal', sid: 'o1', data: { evil: true } });
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(host.queue.find((m) => m.data?.evil), undefined);

  // Presence: owner sees the device go offline
  host.close();
  const pres = await owner.next((m) => m.t === 'presence');
  assert.deepEqual([pres.id, pres.online], [device.id, false]);
  owner.close();
  guest.close();
});

test('device with wrong secret is refused; offline target reported', async () => {
  const s = await ws();
  s.j({ t: 'hello', role: 'device', id: device.id, secret: 'nope' });
  assert.equal((await s.next()).code, 'bad_device');
  const v = await ws();
  v.j({ t: 'hello', role: 'viewer' });
  await v.next();
  v.j({ t: 'connect', sid: 'x1', to: '123456789' });
  assert.equal((await v.next((m) => m.t === 'error')).code, 'offline');
  v.close();
});

test('sign out everywhere revokes tokens', async () => {
  await api('POST', '/api/logout-everywhere', {}, token);
  assert.equal((await api('GET', '/api/me', null, token)).status, 401);
});
