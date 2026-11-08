// Settings (plain JSON) and secrets (encrypted with the OS key store via Electron safeStorage).
const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

const DEFAULTS = {
  serverUrl: '',
  serverCertSha256: '', // optional pin for a server using a private/self-signed certificate
  deviceId: '',
  deviceName: '',
  account: null, // { email, name }
  host: {
    enabled: true,
    allowDesktop: true,
    allowTerminal: true,
    viewOnly: false,
    clipboard: true,
    confirm: 'guests', // 'never' | 'guests' | 'always'
    ownerNoPassword: true, // signed-in owner of this device connects without a password
    lanListen: true,
    lanPort: 47100,
    lanPrivateOnly: true,
    rotateOneTime: true, // new one-time password after every session
    shell: '', // empty = default for the OS
  },
  ui: { theme: 'system', view: 'grid' },
  book: { folders: [], devices: [] },
  bookVersion: 0,
  autostart: false,
};

let dir;
let settings;
let secrets;

const settingsFile = () => path.join(dir, 'settings.json');
const secretsFile = () => path.join(dir, 'secrets.json');

function merge(base, extra) {
  const out = { ...base };
  for (const [k, v] of Object.entries(extra || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])
      ? merge(base[k], v)
      : v;
  }
  return out;
}

function load() {
  dir = app.getPath('userData');
  fs.mkdirSync(dir, { recursive: true });
  try {
    settings = merge(DEFAULTS, JSON.parse(fs.readFileSync(settingsFile(), 'utf8')));
  } catch {
    settings = merge(DEFAULTS, {});
  }
  try {
    secrets = JSON.parse(fs.readFileSync(secretsFile(), 'utf8'));
  } catch {
    secrets = {};
  }
}

function writeAtomic(file, text) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, text, { mode: 0o600 });
  fs.renameSync(tmp, file);
}

function getSettings() {
  return JSON.parse(JSON.stringify(settings));
}

function setSettings(patch) {
  settings = merge(settings, patch);
  writeAtomic(settingsFile(), JSON.stringify(settings, null, 2));
  return getSettings();
}

function encryptionInfo() {
  const available = safeStorage.isEncryptionAvailable();
  const backend = process.platform === 'linux' && safeStorage.getSelectedStorageBackend
    ? safeStorage.getSelectedStorageBackend()
    : 'os';
  return { available, strong: available && backend !== 'basic_text', backend };
}

function setSecret(name, value) {
  if (value == null) delete secrets[name];
  else if (safeStorage.isEncryptionAvailable()) {
    secrets[name] = { e: safeStorage.encryptString(String(value)).toString('base64') };
  } else {
    // No OS key store (rare: Linux without a keyring). Stored obfuscated only; the UI warns about this.
    secrets[name] = { p: Buffer.from(String(value)).toString('base64') };
  }
  writeAtomic(secretsFile(), JSON.stringify(secrets));
}

function getSecret(name) {
  const s = secrets[name];
  if (!s) return null;
  try {
    if (s.e) return safeStorage.decryptString(Buffer.from(s.e, 'base64'));
    if (s.p) return Buffer.from(s.p, 'base64').toString('utf8');
  } catch {
    return null;
  }
  return null;
}

function listSecrets(prefix) {
  return Object.keys(secrets).filter((k) => k.startsWith(prefix));
}

module.exports = { load, getSettings, setSettings, getSecret, setSecret, listSecrets, encryptionInfo };
