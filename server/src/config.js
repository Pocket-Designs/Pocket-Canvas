import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const env = process.env;

export const config = {
  port: Number(env.PC_PORT || 8443),
  host: env.PC_HOST || '0.0.0.0',
  dataDir: env.PC_DATA_DIR || path.resolve('data'),
  // Public address of this server as clients see it, e.g. connect.example.com
  publicHost: env.PC_PUBLIC_HOST || 'localhost',
  // Who may create accounts: "open", "first-only" (first account only, it becomes admin), "closed"
  registration: env.PC_REGISTRATION || 'first-only',
  tokenTtlHours: Number(env.PC_TOKEN_TTL_HOURS || 24 * 14),
  // TURN relay (coturn with use-auth-secret). Leave empty to use STUN only.
  turnUrls: (env.PC_TURN_URLS || '').split(',').map((s) => s.trim()).filter(Boolean),
  turnSecret: env.PC_TURN_SECRET || '',
  stunUrls: (env.PC_STUN_URLS || '').split(',').map((s) => s.trim()).filter(Boolean),
  trustProxy: env.PC_TRUST_PROXY === '1',
};

fs.mkdirSync(config.dataDir, { recursive: true });

// Token signing key: from env, or generated once and kept in the data folder.
function loadSecret() {
  if (env.PC_TOKEN_SECRET) return Buffer.from(env.PC_TOKEN_SECRET);
  const file = path.join(config.dataDir, 'token.key');
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, crypto.randomBytes(48).toString('base64'), { mode: 0o600 });
  }
  return Buffer.from(fs.readFileSync(file, 'utf8').trim());
}

config.tokenSecret = loadSecret();
