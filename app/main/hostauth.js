// Host-side passwords and the challenge–response check.
//
// The host never receives a password. The viewer proves it knows one by sending
//   HMAC-SHA256( scrypt(password, salt), transcript )
// where the transcript contains fresh random nonces from both sides AND the DTLS certificate
// fingerprints of both ends of the WebRTC link. Anyone sitting in the middle (a compromised
// server or someone on the LAN) would have to swap certificates, which changes the transcript,
// so the proof fails. The host then proves it knows the same password the same way, so the
// viewer knows it reached the real machine.
const crypto = require('crypto');
const store = require('./store');

const SCRYPT = { N: 16384, r: 8, p: 1 }; // must match ui/lib/proto.js
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

let oneTimePassword = '';
let oneTimeKey = null;
const failures = { count: 0, until: 0 };

function salt() {
  let s = store.getSecret('hostSalt');
  if (!s) {
    s = crypto.randomBytes(16).toString('base64');
    store.setSecret('hostSalt', s);
  }
  return s;
}

function derive(password) {
  return crypto.scryptSync(password.normalize('NFKC'), Buffer.from(salt(), 'base64'), 32, SCRYPT);
}

function newOneTimePassword() {
  let p = '';
  for (let i = 0; i < 8; i++) p += ALPHABET[crypto.randomInt(ALPHABET.length)];
  oneTimePassword = p;
  oneTimeKey = derive(p);
  return p;
}

function getOneTimePassword() {
  if (!oneTimePassword) newOneTimePassword();
  return oneTimePassword;
}

function setPermanentPassword(password) {
  if (!password) {
    store.setSecret('permanentKey', null);
    return { set: false };
  }
  if (password.length < 8) throw new Error('Use at least 8 characters for the permanent password.');
  store.setSecret('permanentKey', derive(password).toString('base64'));
  return { set: true };
}

const hasPermanentPassword = () => !!store.getSecret('permanentKey');

function transcript(role, nonce, vnonce, fpViewer, fpHost) {
  return `pc-auth-v1|${role}|${nonce}|${vnonce}|${fpViewer}|${fpHost}`;
}

function hmac(key, text) {
  return crypto.createHmac('sha256', key).update(text).digest();
}

function lockout() {
  const now = Date.now();
  return failures.until > now ? Math.ceil((failures.until - now) / 1000) : 0;
}

// Returns { ok, which, hostProof } or { ok: false, retryAfter }
function verifyProof({ nonce, vnonce, fpViewer, fpHost, proof }) {
  const wait = lockout();
  if (wait) return { ok: false, retryAfter: wait };
  const given = Buffer.from(String(proof || ''), 'base64');
  const keys = [['one-time', oneTimeKey]];
  const perm = store.getSecret('permanentKey');
  if (perm) keys.push(['permanent', Buffer.from(perm, 'base64')]);
  for (const [which, key] of keys) {
    if (!key) continue;
    const expected = hmac(key, transcript('viewer', nonce, vnonce, fpViewer, fpHost));
    if (given.length === expected.length && crypto.timingSafeEqual(given, expected)) {
      failures.count = 0;
      return { ok: true, which, hostProof: hmac(key, transcript('host', nonce, vnonce, fpViewer, fpHost)).toString('base64') };
    }
  }
  failures.count += 1;
  if (failures.count >= 3) failures.until = Date.now() + Math.min(2 ** (failures.count - 2), 300) * 1000;
  return { ok: false, retryAfter: lockout() };
}

module.exports = {
  salt, getOneTimePassword, newOneTimePassword, setPermanentPassword, hasPermanentPassword, verifyProof, lockout,
};
