// Pocket-Canvas — per-computer settings (never synced)
// Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const DEFAULT_PORT = 47652;

function defaults() {
  let user = '';
  try { user = os.userInfo().username; } catch {}
  return {
    deviceId: crypto.randomBytes(8).toString('hex'),
    deviceName: os.hostname() || 'This computer',
    userName: user || 'Me',
    linkPreviews: true,
    sync: { folder: null },
    clipper: { enabled: true, port: DEFAULT_PORT, tokens: [] }
  };
}

class Settings {
  constructor(dir) {
    this.file = path.join(dir, 'settings.json');
    this.data = defaults();
    try {
      const saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.data = {
        ...this.data, ...saved,
        sync: { ...this.data.sync, ...(saved.sync || {}) },
        clipper: { ...this.data.clipper, ...(saved.clipper || {}) }
      };
    } catch {}
    // A data folder copied to another computer must not reuse this computer's sync identity.
    const host = os.hostname();
    if (this.data.deviceHost !== host) {
      if (this.data.deviceHost) this.data.deviceName = host || this.data.deviceName;
      this.data.deviceId = crypto.randomBytes(8).toString('hex');
      this.data.deviceHost = host;
    }
    this.save();
  }

  get(key) { return key ? this.data[key] : this.data; }

  set(patch) {
    for (const [k, v] of Object.entries(patch || {})) {
      if (v && typeof v === 'object' && !Array.isArray(v) && this.data[k] && typeof this.data[k] === 'object') {
        this.data[k] = { ...this.data[k], ...v };
      } else {
        this.data[k] = v;
      }
    }
    this.save();
    return this.data;
  }

  save() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
    fs.renameSync(tmp, this.file);
  }

  // What the interface is allowed to see (no access tokens).
  public() {
    const d = this.data;
    return {
      deviceId: d.deviceId,
      deviceName: d.deviceName,
      userName: d.userName,
      linkPreviews: d.linkPreviews,
      sync: { folder: d.sync.folder },
      // the interface connects to your Pocket-Canvas Server itself, so it needs its sign-in token
      server: d.server ? { url: d.server.url || '', token: d.server.token || null, user: d.server.user || null, personal: d.server.personal !== false } : { url: '', token: null, user: null, personal: true },
      clipper: {
        enabled: d.clipper.enabled,
        port: d.clipper.port,
        browsers: d.clipper.tokens.map((t) => ({ id: t.id, name: t.name, created: t.created }))
      }
    };
  }
}

module.exports = { Settings, DEFAULT_PORT };
