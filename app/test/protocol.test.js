// Checks the security-critical parts of the session protocol without Electron:
//  - the browser-side proof (ui/lib/proto.js + scrypt-js) matches the host check (main/hostauth.js)
//  - proofs are bound to the DTLS fingerprints, so a man in the middle is caught
//  - wrong passwords lock the host out for a while
//  - Android frames survive being split into chunks
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

// ---- fake store so hostauth.js runs without Electron
const secrets = {};
const storePath = path.join(__dirname, '..', 'main', 'store.js');
require.cache[storePath] = {
  id: storePath,
  filename: storePath,
  loaded: true,
  exports: {
    getSecret: (k) => secrets[k] ?? null,
    setSecret: (k, v) => (v == null ? delete secrets[k] : (secrets[k] = v)),
    getSettings: () => ({ host: {} }),
  },
};
const hostauth = require('../main/hostauth');

// ---- load the browser protocol into this process
globalThis.scrypt = require('scrypt-js');
require('../ui/lib/proto.js');
const P = globalThis.PCProto;

const FP_V = 'sha-256 AA:BB:CC';
const FP_H = 'sha-256 11:22:33';

async function viewerProof(password, salt, nonce, vnonce, fpV = FP_V, fpH = FP_H) {
  const key = await P.deriveKey(password, salt);
  return { key, proof: P.b64.from(await P.hmac(key, P.transcript('viewer', nonce, vnonce, fpV, fpH))) };
}

test('permanent password: viewer proof is accepted and host proves itself back', async () => {
  hostauth.setPermanentPassword('Correct-Horse-42');
  const salt = hostauth.salt();
  const nonce = P.randomB64();
  const vnonce = P.randomB64();
  const { key, proof } = await viewerProof('Correct-Horse-42', salt, nonce, vnonce);
  const r = hostauth.verifyProof({ nonce, vnonce, fpViewer: FP_V, fpHost: FP_H, proof });
  assert.equal(r.ok, true);
  assert.equal(r.which, 'permanent');
  const expectHost = P.b64.from(await P.hmac(key, P.transcript('host', nonce, vnonce, FP_V, FP_H)));
  assert.equal(r.hostProof, expectHost);
});

test('one-time password works, and a new one replaces it', async () => {
  const ot = hostauth.newOneTimePassword();
  const salt = hostauth.salt();
  let { proof } = await viewerProof(ot, salt, 'n1', 'v1');
  assert.equal(hostauth.verifyProof({ nonce: 'n1', vnonce: 'v1', fpViewer: FP_V, fpHost: FP_H, proof }).which, 'one-time');
  hostauth.newOneTimePassword();
  ({ proof } = await viewerProof(ot, salt, 'n2', 'v2'));
  assert.equal(hostauth.verifyProof({ nonce: 'n2', vnonce: 'v2', fpViewer: FP_V, fpHost: FP_H, proof }).ok, false);
});

test('a proof made for different encryption keys (man in the middle) is rejected', async () => {
  // reset lockout from the previous test
  hostauth._resetFailures?.();
  const salt = hostauth.salt();
  // attacker relays between viewer and host, so each side sees the attacker's certificate
  const { proof } = await viewerProof('Correct-Horse-42', salt, 'n3', 'v3', 'sha-256 EV:IL:00', FP_H);
  const r = hostauth.verifyProof({ nonce: 'n3', vnonce: 'v3', fpViewer: FP_V, fpHost: FP_H, proof });
  assert.equal(r.ok, false);
});

test('repeated wrong passwords lock the host out', async () => {
  const salt = hostauth.salt();
  let last;
  for (let i = 0; i < 4; i++) {
    const { proof } = await viewerProof(`wrong-${i}`, salt, `n${i}`, `v${i}`);
    last = hostauth.verifyProof({ nonce: `n${i}`, vnonce: `v${i}`, fpViewer: FP_V, fpHost: FP_H, proof });
  }
  assert.equal(last.ok, false);
  assert.ok(last.retryAfter > 0, 'expected a lock-out time');
  // even the right password is refused while locked
  const { proof } = await viewerProof('Correct-Horse-42', salt, 'nx', 'vx');
  assert.equal(hostauth.verifyProof({ nonce: 'nx', vnonce: 'vx', fpViewer: FP_V, fpHost: FP_H, proof }).ok, false);
});

test('permanent password must be at least 8 characters', () => {
  assert.throws(() => hostauth.setPermanentPassword('short'));
});

test('fingerprint is read from SDP', () => {
  const sdp = 'v=0\r\na=fingerprint:sha-256 ab:cd:ef:01\r\n';
  assert.equal(P.fingerprint(sdp), 'sha-256 AB:CD:EF:01');
});

test('android frames split into chunks and join back', () => {
  const big = new Uint8Array(200_000).map((_, i) => i % 251);
  const parts = P.splitFrame(7, big, 1080, 2400);
  assert.ok(parts.length > 1);
  let got = null;
  const j = new P.FrameJoiner((bytes, size) => (got = { bytes, size }));
  for (const p of parts.reverse()) j.push(p.buffer.slice(p.byteOffset, p.byteOffset + p.byteLength));
  assert.deepEqual(got.size, { width: 1080, height: 2400 });
  assert.equal(got.bytes.length, big.length);
  assert.deepEqual(Buffer.from(got.bytes), Buffer.from(big));
});

test('LAN private address check', () => {
  const lan = require('../main/lan');
  for (const a of ['192.168.1.5', '10.0.0.2', '172.20.1.1', '::ffff:192.168.0.9', '100.101.1.1', 'fd00::1', '127.0.0.1']) assert.equal(lan.isPrivate(a), true, a);
  for (const a of ['8.8.8.8', '172.32.0.1', '81.2.69.160', '2a00:1450::1']) assert.equal(lan.isPrivate(a), false, a);
});
