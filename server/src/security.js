// Password hashing, signed tokens, TOTP two-factor codes and TURN credentials.
import crypto from 'node:crypto';
import { config } from './config.js';

const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 32, SCRYPT);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, saltB64, hashB64] = stored.split('$');
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, SCRYPT);
  return crypto.timingSafeEqual(expected, actual);
}

// Fast hash for high-entropy random secrets (device secrets) — scrypt not needed there.
export function hashSecret(secret) {
  return crypto.createHash('sha256').update(secret).digest('base64');
}

export function secretMatches(secret, storedHash) {
  const a = Buffer.from(hashSecret(secret));
  const b = Buffer.from(storedHash || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const b64u = (buf) => Buffer.from(buf).toString('base64url');

export function signToken(payload, ttlHours = config.tokenTtlHours) {
  const body = b64u(JSON.stringify({ ...payload, exp: Date.now() + ttlHours * 3600_000 }));
  const sig = b64u(crypto.createHmac('sha256', config.tokenSecret).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = b64u(crypto.createHmac('sha256', config.tokenSecret).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

// ---- TOTP (RFC 6238), compatible with Google Authenticator, Aegis, 2FAS etc. ----
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function newTotpSecret() {
  const bytes = crypto.randomBytes(20);
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function base32Decode(str) {
  let bits = '';
  for (const c of str.replace(/=+$/, '').toUpperCase()) {
    const v = B32.indexOf(c);
    if (v < 0) continue;
    bits += v.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function totpCode(secret, time = Date.now(), step = 30) {
  const counter = Math.floor(time / 1000 / step);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  const code = ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString();
  return code.padStart(6, '0');
}

export function verifyTotp(secret, code) {
  if (!secret || !/^\d{6}$/.test(String(code || ''))) return false;
  const now = Date.now();
  return [-30_000, 0, 30_000].some((d) => totpCode(secret, now + d) === String(code));
}

// ---- TURN REST credentials (coturn "use-auth-secret") ----
export function iceServers(label) {
  const servers = [];
  if (config.stunUrls.length) servers.push({ urls: config.stunUrls });
  if (config.turnUrls.length && config.turnSecret) {
    const username = `${Math.floor(Date.now() / 1000) + 12 * 3600}:${label}`;
    const credential = crypto.createHmac('sha1', config.turnSecret).update(username).digest('base64');
    servers.push({ urls: config.turnUrls, username, credential });
  }
  return servers;
}

export function randomDeviceId() {
  // 9 digits, shown as 123 456 789. First digit never 0.
  return String(crypto.randomInt(100_000_000, 999_999_999));
}
