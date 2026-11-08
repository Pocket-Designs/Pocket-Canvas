// Certificate pinning for servers with private certificates.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

let settings = {};
const storePath = path.join(__dirname, '..', 'main', 'store.js');
require.cache[storePath] = {
  id: storePath, filename: storePath, loaded: true,
  exports: { getSettings: () => settings, getSecret: () => null, setSecret: () => {} },
};
const serverlink = require('../main/serverlink');

let server;
let port;
let fingerprint;
let haveOpenssl = true;

test.before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-pin-'));
  try {
    execFileSync('openssl', ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes',
      '-keyout', path.join(dir, 'key.pem'), '-out', path.join(dir, 'cert.pem'), '-days', '2', '-subj', '/CN=localhost',
      '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' });
  } catch {
    haveOpenssl = false;
    return;
  }
  const cert = fs.readFileSync(path.join(dir, 'cert.pem'));
  fingerprint = new crypto.X509Certificate(cert).fingerprint256;
  server = https.createServer({ key: fs.readFileSync(path.join(dir, 'key.pem')), cert }, (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, name: 'Pocket-Connect' }));
  });
  const { WebSocketServer } = require('ws');
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws) => ws.on('message', (m) => {
    const msg = JSON.parse(m.toString());
    if (msg.t === 'hello') ws.send(JSON.stringify({ t: 'welcome' }));
    else ws.send(JSON.stringify({ t: 'echo', got: msg }));
  }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
});

test.after(() => server?.close());

test('private certificate without a pin is refused', { skip: !haveOpenssl && 'openssl missing' }, async () => {
  settings = { serverUrl: `https://127.0.0.1:${port}` };
  await assert.rejects(serverlink.request('GET', '/api/health'), /not trusted|certificate/i);
});

test('the pinned certificate is accepted', { skip: !haveOpenssl && 'openssl missing' }, async () => {
  settings = { serverUrl: `https://127.0.0.1:${port}`, serverCertSha256: fingerprint };
  const r = await serverlink.request('GET', '/api/health');
  assert.equal(r.ok, true);
});

test('a different pin is refused', { skip: !haveOpenssl && 'openssl missing' }, async () => {
  const wrong = fingerprint.replace(/^../, fingerprint.startsWith('00') ? '11' : '00');
  settings = { serverUrl: `https://127.0.0.1:${port}`, serverCertSha256: wrong };
  await assert.rejects(serverlink.request('GET', '/api/health'), /pinned fingerprint/);
});

test('probe reports the fingerprint so the user can compare it', { skip: !haveOpenssl && 'openssl missing' }, async () => {
  const info = await serverlink.probeCertificate(`https://127.0.0.1:${port}`);
  assert.equal(info.fingerprint256, fingerprint);
  assert.equal(info.trusted, false);
});

function wsRound() {
  return new Promise((resolve) => {
    const link = serverlink.viewerSocket({ name: 'test' }, (msg) => {
      link.close();
      resolve(msg);
    });
    link.send({ t: 'ping-test' });
  });
}

test('websocket: pinned certificate works, wrong pin is refused', { skip: !haveOpenssl && 'openssl missing' }, async () => {
  settings = { serverUrl: `https://127.0.0.1:${port}`, serverCertSha256: fingerprint };
  assert.equal((await wsRound()).t, 'echo');
  settings = { serverUrl: `https://127.0.0.1:${port}`, serverCertSha256: 'AA'.repeat(32) };
  const r = await wsRound();
  assert.equal(r.t, 'error');
  settings = { serverUrl: `https://127.0.0.1:${port}` };
  assert.equal((await wsRound()).t, 'error');
});
