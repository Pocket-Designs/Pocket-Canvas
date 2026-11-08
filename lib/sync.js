// Pocket-Canvas — sync through a shared folder (Dropbox, OneDrive, Google Drive, iCloud, Nextcloud, Syncthing…)
// Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
//
// Layout of the sync folder:
//   Pocket-Canvas Sync/
//     devices/<deviceId>.json   one file per computer; only that computer ever writes it
//     assets/<id>               pictures, files, audio and video (never changed once written)
//     README.txt
//
// Because no two computers write the same file, the sync service never has to choose
// between versions. Each computer reads the others' files and merges them card by card
// (see src/merge.js), then writes the merged result back to its own file.
'use strict';
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { syncState } = require('../src/merge.js');

const FOLDER_NAME = 'Pocket-Canvas Sync';
const POLL_MS = 4000;
const ASSET_POLL_MS = 15000;

const README = `This folder is used by Pocket-Canvas to keep your boards the same on all your computers.

  devices/   one file per computer
  assets/    your pictures, files, audio and video

Please don't edit or move these files. To stop syncing, open Pocket-Canvas, go to
Settings > Sync and click "Stop syncing" on each computer.
`;

class FolderSync {
  constructor({ settings, assetDir, send }) {
    this.settings = settings;
    this.assetDir = assetDir;
    this.send = send;
    this.seen = new Map();      // deviceId -> "mtime:size" already processed
    this.devices = new Map();   // deviceId -> { id, name, savedAt }
    this.timer = null;
    this.assetTimer = null;
    this.state = { ok: true, error: null, lastWrite: null, lastRead: null };
    this.pushing = false;
  }

  get folder() { return this.settings.get('sync').folder; }
  get enabled() { return !!this.folder; }
  devicesDir() { return path.join(this.folder, 'devices'); }
  syncAssets() { return path.join(this.folder, 'assets'); }
  ownFile() { return path.join(this.devicesDir(), this.settings.get('deviceId') + '.json'); }

  static resolveFolder(chosen) {
    return path.basename(chosen) === FOLDER_NAME ? chosen : path.join(chosen, FOLDER_NAME);
  }

  enable(chosen, currentJson) {
    const dir = FolderSync.resolveFolder(chosen);
    fs.mkdirSync(path.join(dir, 'devices'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
    const probe = path.join(dir, '.write-test');
    fs.writeFileSync(probe, 'ok'); fs.unlinkSync(probe);
    if (!fs.existsSync(path.join(dir, 'README.txt'))) fs.writeFileSync(path.join(dir, 'README.txt'), README);
    this.settings.set({ sync: { folder: dir } });
    this.seen.clear();
    if (currentJson) this.writeOwn(currentJson);
    this.start();
    return dir;
  }

  disable() {
    this.stop();
    this.settings.set({ sync: { folder: null } });
    this.devices.clear();
    this.seen.clear();
    this.emitStatus();
  }

  start() {
    this.stop();
    if (!this.enabled) return;
    this.timer = setInterval(() => this.poll(), POLL_MS);
    this.assetTimer = setInterval(() => this.pullAssets(), ASSET_POLL_MS);
    this.poll();
    this.pullAssets();
  }

  stop() {
    clearInterval(this.timer); clearInterval(this.assetTimer);
    this.timer = this.assetTimer = null;
  }

  folderOk() {
    if (!this.enabled) return false;
    if (!fs.existsSync(this.devicesDir())) {
      this.state.ok = false;
      this.state.error = 'The sync folder can’t be found. Is the drive connected and the sync app running?';
      return false;
    }
    return true;
  }

  // Write this computer's copy. Called after every save.
  writeOwn(json) {
    this.latest = json;
    if (!this.enabled || !this.folderOk()) { this.pendingWrite = true; this.emitStatus(); return; }
    this.pendingWrite = false;
    try {
      const store = JSON.parse(json);
      const doc = {
        format: 1,
        app: 'Pocket-Canvas',
        deviceId: this.settings.get('deviceId'),
        deviceName: this.settings.get('deviceName'),
        savedAt: Date.now(),
        state: syncState(store)
      };
      const file = this.ownFile();
      const tmp = path.join(this.devicesDir(), '.' + path.basename(file) + '.tmp');
      fs.writeFileSync(tmp, JSON.stringify(doc), 'utf8');
      fs.renameSync(tmp, file);
      this.state.ok = true; this.state.error = null; this.state.lastWrite = Date.now();
      this.pushAssets();
    } catch (err) {
      this.pendingWrite = true;
      this.state.ok = false; this.state.error = 'Couldn’t write to the sync folder: ' + err.message;
    }
    this.emitStatus();
  }

  // Look for changes from other computers.
  poll() {
    if (!this.folderOk()) { this.emitStatus(); return; }
    if (this.pendingWrite && this.latest) this.writeOwn(this.latest); // folder is back: share what changed meanwhile
    const own = this.settings.get('deviceId');
    let names;
    try { names = fs.readdirSync(this.devicesDir()); } catch { return; }
    for (const name of names) {
      if (!name.endsWith('.json') || name.startsWith('.')) continue;
      const file = path.join(this.devicesDir(), name);
      let st;
      try { st = fs.statSync(file); } catch { continue; }
      const key = st.mtimeMs + ':' + st.size;
      if (this.seen.get(name) === key) continue;
      let doc;
      try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; } // still arriving: try again next time
      this.seen.set(name, key);
      if (!doc || doc.app !== 'Pocket-Canvas' || !doc.state || !doc.state.boards) continue;
      if (doc.deviceId === own) continue;
      this.devices.set(doc.deviceId, { id: doc.deviceId, name: doc.deviceName || 'Another computer', savedAt: doc.savedAt });
      this.state.lastRead = Date.now();
      this.pullAssets().finally(() => this.send('sync:incoming', { deviceId: doc.deviceId, deviceName: doc.deviceName, savedAt: doc.savedAt, state: doc.state }));
    }
    this.state.ok = true; this.state.error = null;
    this.emitStatus();
  }

  async pushAssets() {
    if (this.pushing || !this.enabled) return;
    this.pushing = true;
    try {
      const there = new Set(await fsp.readdir(this.syncAssets()));
      for (const f of await fsp.readdir(this.assetDir)) {
        if (there.has(f) || f.startsWith('.')) continue;
        const tmp = path.join(this.syncAssets(), '.' + f + '.tmp');
        await fsp.copyFile(path.join(this.assetDir, f), tmp);
        await fsp.rename(tmp, path.join(this.syncAssets(), f));
      }
    } catch {} finally { this.pushing = false; }
  }

  async pullAssets() {
    if (!this.enabled) return;
    try {
      const here = new Set(await fsp.readdir(this.assetDir));
      let got = 0;
      for (const f of await fsp.readdir(this.syncAssets())) {
        if (here.has(f) || f.startsWith('.')) continue;
        const tmp = path.join(this.assetDir, '.' + f + '.tmp');
        await fsp.copyFile(path.join(this.syncAssets(), f), tmp);
        await fsp.rename(tmp, path.join(this.assetDir, f));
        got++;
      }
      if (got) this.send('assets:arrived', got);
    } catch {}
  }

  status() {
    return {
      enabled: this.enabled,
      folder: this.folder,
      ok: this.state.ok,
      error: this.state.error,
      lastWrite: this.state.lastWrite,
      lastRead: this.state.lastRead,
      devices: [...this.devices.values()].sort((a, b) => b.savedAt - a.savedAt)
    };
  }

  emitStatus() { this.send('sync:status', this.status()); }
}

module.exports = { FolderSync, FOLDER_NAME };
