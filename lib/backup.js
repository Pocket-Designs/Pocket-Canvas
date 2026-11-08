// Pocket-Canvas — automatic backups to a folder you choose
// Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
//
// Layout of the backup folder:
//   Pocket-Canvas Backups/
//     snapshots/2026-10-15_19-30-05.json   all boards at that moment (locked boards stay encrypted)
//     assets/<id>                          pictures, files, audio, video (shared by every snapshot,
//                                          copied once, never changed, so backups stay small)
//     README.txt
'use strict';
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const FOLDER_NAME = 'Pocket-Canvas Backups';
const EVERY = { hour: 3600e3, day: 86400e3, week: 7 * 86400e3, manual: Infinity };
const CHECK_MS = 10 * 60e3;

const README = `This folder holds automatic backups made by Pocket-Canvas.

  snapshots/   your boards, one file per backup (named by date and time)
  assets/      pictures, files, audio and video used by the boards

To restore one: open Pocket-Canvas, go to Settings > Backups, and click Restore next to it.
Locked boards stay encrypted in backups; you'll need their passwords to open them.
`;

class Backups {
  constructor({ settings, assetDir, defaultParent, getLatest, version, send }) {
    Object.assign(this, { settings, assetDir, defaultParent, getLatest, version, send });
    this.timer = null;
    this.running = null;
    this.lastError = null;
  }

  get cfg() {
    const d = { enabled: true, folder: path.join(this.defaultParent, FOLDER_NAME), every: 'day', keep: 30, last: null };
    return { ...d, ...(this.settings.get('backup') || {}) };
  }

  set(patch) {
    this.settings.set({ backup: { ...this.cfg, ...patch } });
    this.emit();
  }

  static resolveFolder(chosen) {
    return path.basename(chosen) === FOLDER_NAME ? chosen : path.join(chosen, FOLDER_NAME);
  }

  start() {
    clearInterval(this.timer);
    this.timer = setInterval(() => this.runIfDue(), CHECK_MS);
    setTimeout(() => this.runIfDue(), 60e3); // shortly after start-up
  }

  stop() { clearInterval(this.timer); }

  due() {
    const c = this.cfg;
    if (!c.enabled || c.every === 'manual') return false;
    return !c.last || Date.now() - c.last >= (EVERY[c.every] || EVERY.day);
  }

  runIfDue() { if (this.due()) return this.run('automatic'); return null; }

  async run(reason = 'manual') {
    if (this.running) return this.running;
    this.running = (async () => {
      const json = this.getLatest();
      if (!json) return { error: 'Nothing to back up yet' };
      const c = this.cfg;
      try {
        const snaps = path.join(c.folder, 'snapshots');
        const assets = path.join(c.folder, 'assets');
        await fsp.mkdir(snaps, { recursive: true });
        await fsp.mkdir(assets, { recursive: true });
        if (!fs.existsSync(path.join(c.folder, 'README.txt'))) await fsp.writeFile(path.join(c.folder, 'README.txt'), README);
        // Pictures and files first, so a snapshot never points at something missing.
        const there = new Set(await fsp.readdir(assets));
        for (const f of await fsp.readdir(this.assetDir)) {
          if (there.has(f) || f.startsWith('.')) continue;
          const tmp = path.join(assets, '.' + f + '.tmp');
          await fsp.copyFile(path.join(this.assetDir, f), tmp);
          await fsp.rename(tmp, path.join(assets, f));
        }
        const now = new Date();
        const p2 = (n) => String(n).padStart(2, '0');
        const stem = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}_${p2(now.getHours())}-${p2(now.getMinutes())}-${p2(now.getSeconds())}`;
        let name = stem + '.json';
        for (let n = 2; fs.existsSync(path.join(snaps, name)); n++) name = `${stem}_${n}.json`; // never overwrite a backup
        const doc = `{"app":"Pocket-Canvas","version":${JSON.stringify(this.version)},"createdAt":${now.getTime()},"reason":${JSON.stringify(reason)},"data":${json}}`;
        const tmp = path.join(snaps, '.' + name + '.tmp');
        await fsp.writeFile(tmp, doc, 'utf8');
        await fsp.rename(tmp, path.join(snaps, name));
        await this.prune();
        this.lastError = null;
        this.set({ last: now.getTime() });
        return { ok: true, name };
      } catch (err) {
        this.lastError = `Couldn’t save a backup to ${c.folder}: ${err.message}`;
        this.emit();
        return { error: this.lastError };
      }
    })();
    try { return await this.running; } finally { this.running = null; }
  }

  async list() {
    const snaps = path.join(this.cfg.folder, 'snapshots');
    let names = [];
    try { names = (await fsp.readdir(snaps)).filter((n) => n.endsWith('.json') && !n.startsWith('.')); } catch { return []; }
    const out = [];
    for (const n of names) {
      try {
        const st = await fsp.stat(path.join(snaps, n));
        out.push({ name: n, size: st.size, time: st.mtimeMs });
      } catch {}
    }
    return out.sort((a, b) => b.name.localeCompare(a.name));
  }

  async prune() {
    const keep = Math.max(1, this.cfg.keep || 30);
    const list = await this.list();
    for (const s of list.slice(keep)) {
      try { await fsp.unlink(path.join(this.cfg.folder, 'snapshots', s.name)); } catch {}
    }
  }

  // Returns the boards saved in a snapshot, after copying back any pictures/files that are missing.
  async read(name) {
    const safe = path.basename(String(name));
    const file = path.join(this.cfg.folder, 'snapshots', safe);
    const doc = JSON.parse(await fsp.readFile(file, 'utf8'));
    if (!doc || doc.app !== 'Pocket-Canvas' || !doc.data || !doc.data.boards) throw new Error('That isn’t a Pocket-Canvas backup');
    const assets = path.join(this.cfg.folder, 'assets');
    try {
      const here = new Set(await fsp.readdir(this.assetDir));
      for (const f of await fsp.readdir(assets)) {
        if (here.has(f) || f.startsWith('.')) continue;
        await fsp.copyFile(path.join(assets, f), path.join(this.assetDir, f));
      }
    } catch {}
    return doc.data;
  }

  async status() {
    const c = this.cfg;
    const list = await this.list();
    return { enabled: c.enabled, folder: c.folder, every: c.every, keep: c.keep, last: c.last, error: this.lastError, snapshots: list.slice(0, 50), count: list.length };
  }

  emit() { this.status().then((s) => this.send('backup:status', s)).catch(() => {}); }
}

module.exports = { Backups, FOLDER_NAME };
