import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

export const db = new DatabaseSync(path.join(config.dataDir, 'pocket-connect.db'));

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  pw_hash TEXT NOT NULL,
  totp_secret TEXT,
  totp_enabled INTEGER NOT NULL DEFAULT 0,
  is_admin INTEGER NOT NULL DEFAULT 0,
  token_gen INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT '',
  os TEXT NOT NULL DEFAULT 'unknown',
  hostname TEXT NOT NULL DEFAULT '',
  created INTEGER NOT NULL,
  last_seen INTEGER
);
CREATE TABLE IF NOT EXISTS books (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  version INTEGER NOT NULL,
  updated INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  user_id INTEGER,
  device_id TEXT,
  event TEXT NOT NULL,
  detail TEXT
);
`);

export const q = {
  userCount: db.prepare('SELECT COUNT(*) AS n FROM users'),
  userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  userById: db.prepare('SELECT * FROM users WHERE id = ?'),
  insertUser: db.prepare(
    'INSERT INTO users (email, name, pw_hash, is_admin, created) VALUES (?, ?, ?, ?, ?)'
  ),
  setTotp: db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = ? WHERE id = ?'),
  setPassword: db.prepare('UPDATE users SET pw_hash = ?, token_gen = token_gen + 1 WHERE id = ?'),
  bumpTokenGen: db.prepare('UPDATE users SET token_gen = token_gen + 1 WHERE id = ?'),

  deviceById: db.prepare('SELECT * FROM devices WHERE id = ?'),
  insertDevice: db.prepare(
    'INSERT INTO devices (id, secret_hash, name, os, hostname, created) VALUES (?, ?, ?, ?, ?, ?)'
  ),
  updateDeviceInfo: db.prepare('UPDATE devices SET os = ?, hostname = ?, last_seen = ? WHERE id = ?'),
  setDeviceOwner: db.prepare('UPDATE devices SET owner_id = ? WHERE id = ?'),
  setDeviceName: db.prepare('UPDATE devices SET name = ? WHERE id = ? AND owner_id = ?'),
  devicesByOwner: db.prepare('SELECT id, name, os, hostname, last_seen FROM devices WHERE owner_id = ? ORDER BY name, id'),

  bookByUser: db.prepare('SELECT data, version, updated FROM books WHERE user_id = ?'),
  insertBook: db.prepare('INSERT INTO books (user_id, data, version, updated) VALUES (?, ?, 1, ?)'),
  updateBook: db.prepare(
    'UPDATE books SET data = ?, version = version + 1, updated = ? WHERE user_id = ? AND version = ?'
  ),

  audit: db.prepare('INSERT INTO audit (at, user_id, device_id, event, detail) VALUES (?, ?, ?, ?, ?)'),
  auditForUser: db.prepare(
    'SELECT at, device_id, event, detail FROM audit WHERE user_id = ? ORDER BY id DESC LIMIT 100'
  ),
};

export function audit(event, { userId = null, deviceId = null, detail = null } = {}) {
  q.audit.run(Date.now(), userId, deviceId, event, detail ? JSON.stringify(detail) : null);
}
