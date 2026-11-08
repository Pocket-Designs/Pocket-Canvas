/* Pocket-Canvas for Android, iPhone and iPad — the same `window.api` the desktop app gets from preload.js,
 * built on Capacitor's native plugins instead of Electron.
 * Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
 *
 * Where things live on the phone:
 *   <app files>/Pocket-Canvas/pocket-canvas-data.json   your boards
 *   <app files>/Pocket-Canvas/assets/                   pictures, files, audio and video
 *   <app files>/Pocket-Canvas/settings.json             this phone's settings (never synced)
 *
 * Sync works exactly like the desktop app: a folder that a sync app (for example Syncthing)
 * keeps the same on every device, chosen with Android's folder picker (SyncFolderPlugin.java).
 * This phone writes devices/<id>.json in it and reads the others'.
 */
'use strict';

(function () {
  const Cap = window.Capacitor;
  if (!Cap || !Cap.isNativePlatform || !Cap.isNativePlatform()) return; // not running inside the phone/tablet app
  const PLATFORM = Cap.getPlatform ? Cap.getPlatform() : 'android'; // 'android' or 'ios'
  const P = Cap.Plugins;
  const FS = P.Filesystem;
  const VERSION = '__VERSION__';
  const FOLDER_NAME = 'Pocket-Canvas Sync';
  const POLL_MS = 5000;
  const ASSET_POLL_MS = 20000;

  // ---------- small helpers ----------
  const listeners = {};
  const on = (ch) => (fn) => { (listeners[ch] = listeners[ch] || []).push(fn); };
  const emit = (ch, payload) => (listeners[ch] || []).forEach((fn) => { try { fn(payload); } catch (e) { console.error(e); } });
  // join path parts, keeping the "file://" at the start intact
  const join = (...parts) => {
    const s = parts.join('/');
    const pre = (/^[a-z]+:\/\//i.exec(s) || [''])[0];
    return pre + s.slice(pre.length).replace(/\/{2,}/g, '/');
  };
  const fileUri = (p) => (p.startsWith('file://') ? p : 'file://' + p);
  const rand = (n = 8) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const extOf = (name) => ((/\.[a-z0-9]{1,8}$/i.exec(name || '') || ['.bin'])[0]).toLowerCase();
  const newAssetId = (name) => rand(8) + extOf(name);

  async function readText(uri) {
    try { return (await FS.readFile({ path: uri, encoding: 'utf8' })).data; } catch { return null; }
  }
  async function writeText(uri, text) { await FS.writeFile({ path: uri, data: text, encoding: 'utf8', recursive: true }); }
  async function writeB64(uri, b64) { await FS.writeFile({ path: uri, data: b64, recursive: true }); }
  async function exists(uri) { try { await FS.stat({ path: uri }); return true; } catch { return false; } }
  async function mkdir(uri) { try { await FS.mkdir({ path: uri, recursive: true }); } catch { /* already there */ } }
  async function list(uri) { try { return (await FS.readdir({ path: uri })).files.map((f) => (typeof f === 'string' ? { name: f } : f)); } catch { return []; } }
  async function remove(uri) { try { await FS.deleteFile({ path: uri }); } catch {} }
  async function rename(from, to) { await remove(to); await FS.rename({ from, to }); }
  async function copy(from, to) { await FS.copy({ from, to }); }
  const toB64 = (bytes) => {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const fileToB64 = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

  // ---------- places ----------
  let ROOT = null, ASSETS = null, DATA = null, SETTINGS_FILE = null;
  const ready = (async () => {
    const base = (await FS.getUri({ directory: 'DATA', path: '' })).uri;
    ROOT = join(base, 'Pocket-Canvas');
    ASSETS = join(ROOT, 'assets');
    DATA = join(ROOT, 'pocket-canvas-data.json');
    SETTINGS_FILE = join(ROOT, 'settings.json');
    await mkdir(ASSETS);
    await loadSettings();
  })();

  // ---------- settings (this phone only) ----------
  let settings = null;
  async function loadSettings() {
    let saved = {};
    try { saved = JSON.parse(await readText(SETTINGS_FILE)) || {}; } catch {}
    settings = {
      deviceId: rand(8), deviceName: PLATFORM === 'ios' ? 'iPhone or iPad' : 'Android device', userName: 'Me', linkPreviews: true,
      ...saved, sync: { uri: null, ...(saved.sync || {}) }
    };
    if (settings.sync.folder && !settings.sync.uri) settings.sync = { uri: null }; // 1.4 test builds typed a path; choose the folder again
    await saveSettings();
  }
  const saveSettings = () => writeText(SETTINGS_FILE, JSON.stringify(settings, null, 1));

  // ---------- sync through a shared folder (same layout as the desktop app) ----------
  // The folder is chosen with Android's own folder picker, which gives Pocket-Canvas access to
  // that folder only (no "All files access"). settings.sync = { uri, name, sub }: `uri` is the
  // folder Android gave us; `sub` is "Pocket-Canvas Sync" when we made that folder inside it.
  const SF = P.SyncFolder;
  const sync = {
    seen: new Map(), devices: new Map(), timer: null, assetTimer: null, pushing: false, pulling: false,
    latest: null, pendingWrite: false,
    state: { ok: true, error: null, lastWrite: null, lastRead: null },
    get cfg() { return (settings && settings.sync) || {}; },
    get folder() { return this.cfg.uri ? this.cfg.name + (this.cfg.sub ? ' › ' + this.cfg.sub : '') : null; },
    get enabled() { return !!this.cfg.uri; },
    rel(path) { return this.cfg.sub ? this.cfg.sub + '/' + path : path; },
    op(name, path, extra = {}) { return SF[name]({ uri: this.cfg.uri, path: this.rel(path), ...extra }); },
    async list(path) { try { return (await this.op('list', path)).files || []; } catch { return []; } },

    async enable(picked) {
      const cfg = { uri: picked.uri, name: picked.name || 'Sync folder', sub: picked.name === FOLDER_NAME ? '' : FOLDER_NAME };
      const old = settings.sync;
      settings.sync = cfg;
      try {
        await this.op('mkdir', 'devices'); await this.op('mkdir', 'assets');
        await this.op('write', '.write-test', { data: 'ok' }); await this.op('delete', '.write-test');
        if (!(await this.op('stat', 'README.txt')).exists) {
          await this.op('write', 'README.txt', { data: 'This folder is used by Pocket-Canvas to keep your boards the same on all your devices.\n\n  devices/   one file per device\n  assets/    your pictures, files, audio and video\n\nPlease don’t edit or move these files.\n' });
        }
      } catch (err) { settings.sync = old; throw err; }
      await saveSettings();
      this.seen.clear();
      if (this.latest) await this.writeOwn(this.latest);
      this.start();
    },
    async disable() {
      this.stop();
      settings.sync = { uri: null }; await saveSettings();
      this.devices.clear(); this.seen.clear();
      this.emitStatus();
    },
    start() {
      this.stop();
      if (!this.enabled) return;
      this.timer = setInterval(() => this.poll(), POLL_MS);
      this.assetTimer = setInterval(() => this.pullAssets(), ASSET_POLL_MS);
      this.poll(); this.pullAssets();
    },
    stop() { clearInterval(this.timer); clearInterval(this.assetTimer); this.timer = this.assetTimer = null; },
    async folderOk() {
      if (!this.enabled) return false;
      let ok = false;
      try { ok = (await SF.check({ uri: this.cfg.uri })).ok && (await this.op('stat', 'devices')).exists; } catch {}
      if (!ok) {
        this.state.ok = false;
        this.state.error = 'The sync folder can’t be reached. Is your sync app running? If you moved or deleted the folder, choose it again.';
      }
      return ok;
    },
    async writeOwn(json) {
      this.latest = json;
      if (!(await this.folderOk())) { this.pendingWrite = true; this.emitStatus(); return; }
      this.pendingWrite = false;
      try {
        const doc = { format: 1, app: 'Pocket-Canvas', deviceId: settings.deviceId, deviceName: settings.deviceName, savedAt: Date.now(), state: PCSync.syncState(JSON.parse(json)) };
        await this.op('write', 'devices/' + settings.deviceId + '.json', { data: JSON.stringify(doc) });
        this.state.ok = true; this.state.error = null; this.state.lastWrite = Date.now();
        this.pushAssets();
      } catch (err) {
        this.pendingWrite = true;
        this.state.ok = false; this.state.error = 'Couldn’t write to the sync folder: ' + (err.message || err);
      }
      this.emitStatus();
    },
    async poll() {
      if (this.polling) return;
      this.polling = true;
      try {
        if (!(await this.folderOk())) { this.emitStatus(); return; }
        if (this.pendingWrite && this.latest) await this.writeOwn(this.latest);
        for (const f of await this.list('devices')) {
          const name = f.name;
          if (!name || !name.endsWith('.json') || name.startsWith('.')) continue;
          const key = f.mtime + ':' + f.size;
          if (this.seen.get(name) === key) continue;
          let doc;
          try { doc = JSON.parse((await this.op('read', 'devices/' + name)).data); } catch { continue; } // still arriving
          this.seen.set(name, key);
          if (!doc || doc.app !== 'Pocket-Canvas' || !doc.state || !doc.state.boards) continue;
          if (doc.deviceId === settings.deviceId) continue;
          this.devices.set(doc.deviceId, { id: doc.deviceId, name: doc.deviceName || 'Another device', savedAt: doc.savedAt });
          this.state.lastRead = Date.now();
          await this.pullAssets();
          emit('sync:incoming', { deviceId: doc.deviceId, deviceName: doc.deviceName, savedAt: doc.savedAt, state: doc.state });
        }
        this.state.ok = true; this.state.error = null;
        this.emitStatus();
      } finally { this.polling = false; }
    },
    async pushAssets() {
      if (this.pushing || !this.enabled) return;
      this.pushing = true;
      try {
        const there = new Set((await this.list('assets')).map((f) => f.name));
        for (const f of await list(ASSETS)) {
          if (there.has(f.name) || f.name.startsWith('.')) continue;
          await this.op('copyIn', 'assets/' + f.name, { from: join(ASSETS, f.name) });
        }
      } catch {} finally { this.pushing = false; }
    },
    async pullAssets() {
      if (this.pulling || !this.enabled) return;
      this.pulling = true;
      try {
        const here = new Set((await list(ASSETS)).map((f) => f.name));
        let got = 0;
        for (const f of await this.list('assets')) {
          if (!f.name || here.has(f.name) || f.name.startsWith('.') || f.dir) continue;
          await this.op('copyOut', 'assets/' + f.name, { to: join(ASSETS, f.name) });
          got++;
        }
        if (got) emit('assets:arrived', got);
      } catch {} finally { this.pulling = false; }
    },
    status() {
      return {
        enabled: this.enabled, folder: this.folder, ok: this.state.ok, error: this.state.error,
        lastWrite: this.state.lastWrite, lastRead: this.state.lastRead,
        devices: [...this.devices.values()].sort((a, b) => b.savedAt - a.savedAt)
      };
    },
    emitStatus() { emit('sync:status', this.status()); }
  };

  // ---------- link previews (the phone fetches the page itself, like the desktop app) ----------
  const Http = P.CapacitorHttp;
  const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 Pocket-Canvas';
  const decode = (s) => { const t = document.createElement('textarea'); t.innerHTML = String(s || ''); return t.value.replace(/\s+/g, ' ').trim(); };
  function parseHtml(html, baseUrl) {
    const doc = new DOMParser().parseFromString(String(html).slice(0, 400000), 'text/html');
    const meta = {};
    doc.querySelectorAll('meta').forEach((m) => {
      const k = (m.getAttribute('property') || m.getAttribute('name') || m.getAttribute('itemprop') || '').toLowerCase();
      if (k && m.getAttribute('content') != null && !(k in meta)) meta[k] = m.getAttribute('content');
    });
    let icon = null;
    doc.querySelectorAll('link[rel][href]').forEach((l) => { if (!icon && /(^|\s)(icon|apple-touch-icon)(\s|$)/i.test(l.getAttribute('rel'))) icon = l.getAttribute('href'); });
    const abs = (u) => { try { return u ? new URL(u, baseUrl).href : null; } catch { return null; } };
    return {
      title: decode(meta['og:title'] || meta['twitter:title'] || (doc.querySelector('title') || {}).textContent || ''),
      description: decode(meta['og:description'] || meta['twitter:description'] || meta.description || '').slice(0, 400),
      siteName: decode(meta['og:site_name'] || ''),
      image: abs(meta['og:image:secure_url'] || meta['og:image'] || meta['og:image:url'] || meta['twitter:image']),
      icon: abs(icon) || abs('/favicon.ico')
    };
  }
  async function download(url, maxBytes) {
    try {
      const r = await Http.request({ url, method: 'GET', responseType: 'blob', headers: { 'User-Agent': UA }, connectTimeout: 8000, readTimeout: 15000 });
      const type = String((r.headers && (r.headers['Content-Type'] || r.headers['content-type'])) || '').split(';')[0].toLowerCase();
      if (r.status >= 400 || !/^image\//.test(type) || typeof r.data !== 'string' || r.data.length * 0.75 > maxBytes) return null;
      const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/x-icon': '.ico', 'image/vnd.microsoft.icon': '.ico', 'image/avif': '.avif' }[type] || extOf(new URL(url).pathname);
      const id = rand(8) + ext;
      await writeB64(join(ASSETS, id), r.data);
      return id;
    } catch { return null; }
  }
  async function linkPreview(url) {
    if (!settings.linkPreviews || !/^https?:\/\//i.test(url)) return null;
    try {
      const r = await Http.request({ url, method: 'GET', responseType: 'text', headers: { 'User-Agent': UA, Accept: 'text/html,*/*;q=0.5' }, connectTimeout: 8000, readTimeout: 10000 });
      if (r.status >= 400) return { error: 'The website answered ' + r.status };
      const p = parseHtml(r.data, r.url || url);
      const [image, icon] = await Promise.all([p.image ? download(p.image, 8 << 20) : null, p.icon ? download(p.icon, 300 << 10) : null]);
      return { title: p.title, description: p.description, siteName: p.siteName, image, icon };
    } catch (err) { return { error: String(err.message || err) }; }
  }

  // ---------- choosing files with the phone's file picker ----------
  function chooseFiles(accept, multiple) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = accept || ''; input.multiple = !!multiple;
      input.style.display = 'none';
      let settled = false;
      const done = (files) => { if (settled) return; settled = true; input.remove(); resolve(files); };
      input.addEventListener('change', () => done([...input.files]));
      input.addEventListener('cancel', () => done([]));
      document.body.appendChild(input);
      input.click();
    });
  }
  async function shareFile(uri, title) {
    try { await P.Share.share({ title, files: [uri], dialogTitle: title }); return true; } catch { return false; }
  }

  // ---------- the API ----------
  window.api = {
    platform: PLATFORM,
    mobile: true,
    load: async () => {
      await ready;
      for (const f of [DATA, DATA + '.bak']) {
        const t = await readText(f);
        if (t) { try { sync.latest = t; return JSON.parse(t); } catch {} }
      }
      return null;
    },
    save: async (json) => {
      await ready;
      const tmp = DATA + '.tmp';
      if (await exists(DATA)) { try { await copy(DATA, DATA + '.bak'); } catch {} }
      await writeText(tmp, json);
      await rename(tmp, DATA);
      sync.latest = json;
      if (sync.enabled) sync.writeOwn(json);
      return true;
    },
    ready: async () => { await ready; if (sync.enabled) { sync.seen.clear(); sync.start(); } sync.emitStatus(); return true; },

    assetBase: async () => { await ready; return Cap.convertFileSrc(ASSETS + '/'); },
    saveBytes: async (name, bytes) => { const id = newAssetId(name); await writeB64(join(ASSETS, id), toB64(bytes)); return id; },
    pickFiles: async (kind) => {
      const accept = kind === 'image' || kind === 'image-one' ? 'image/*' : kind === 'media' ? 'audio/*,video/*' : '';
      const files = await chooseFiles(accept, kind !== 'image-one');
      const out = [];
      for (const f of files) {
        const id = newAssetId(f.name);
        await writeB64(join(ASSETS, id), await fileToB64(f));
        out.push({ id, name: f.name, size: f.size });
      }
      return out;
    },
    readAsset: async (id) => {
      if (!/^[0-9a-f]{16}\.[a-z0-9]{1,10}$/.test(String(id))) return null;
      try { const d = (await FS.readFile({ path: join(ASSETS, id) })).data; const bin = atob(d); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; } catch { return null; }
    },
    writeAsset: async (id, bytes) => {
      if (!/^[0-9a-f]{16}\.[a-z0-9]{1,10}$/.test(String(id))) return false;
      if (await exists(join(ASSETS, id))) return true;
      await writeB64(join(ASSETS, id), toB64(bytes)); return true;
    },
    hasAssets: async (ids) => {
      const here = new Set((await list(ASSETS)).map((f) => f.name));
      return (ids || []).filter((id) => /^[0-9a-f]{16}\.[a-z0-9]{1,10}$/.test(String(id)) && !here.has(id));
    },
    openAsset: (id) => shareFile(join(ASSETS, String(id).split('/').pop()), 'Open with…'),
    saveAssetAs: (id, name) => shareFile(join(ASSETS, String(id).split('/').pop()), name || 'Save'),

    openLink: async (url) => { if (/^https?:\/\//i.test(url)) { try { await P.Browser.open({ url }); } catch { window.open(url, '_blank'); } } },
    linkPreview,

    saveText: async (defaultName, text) => {
      const uri = (await FS.getUri({ directory: 'CACHE', path: '' })).uri;
      const file = join(uri, String(defaultName || 'export.txt').replace(/[\\/:*?"<>|]/g, '_'));
      await writeText(file, text);
      return shareFile(file, defaultName);
    },
    openText: async () => {
      const [f] = await chooseFiles('.json,.md,.txt,application/json,text/*', false);
      return f ? f.text() : null;
    },
    confirm: (message, detail) => new Promise((resolve) => {
      if (typeof openModal !== 'function') { resolve(window.confirm(message + (detail ? '\n\n' + detail : ''))); return; }
      const body = document.createElement('div');
      body.innerHTML = `<p>${esc(detail || '')}</p>`;
      let answer = false;
      openModal({
        title: message, body,
        actions: [{ label: 'Cancel' }, { label: 'OK', primary: true, run: (close) => { answer = true; close(); } }],
        onClose: () => resolve(answer)
      });
    }),
    showFile: async () => {},

    // Exporting pictures and PDFs needs the desktop app.
    // Pictures and PDFs are drawn inside the page (exportInPage in export-ui.js), then shared.
    exportVisual: async (opts) => {
      try {
        const r = await exportInPage(opts);
        const dir = (await FS.getUri({ directory: 'CACHE', path: '' })).uri;
        const name = String(opts.title || 'Board').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) + '.' + r.ext;
        const file = join(dir, name);
        await writeB64(file, toB64(r.bytes));
        await shareFile(file, name);
        return { ok: true, width: r.width, height: r.height, pages: r.pages, landscape: r.landscape };
      } catch (err) { return { error: String((err && err.message) || err) }; }
    },
    exportReady: async () => {},
    exportData: async () => null,

    getSettings: async () => { await ready; return { ...settings, clipperStatus: {}, clipper: { enabled: false, tokens: [] }, version: VERSION, platform: PLATFORM }; },
    setSettings: async (patch) => {
      await ready;
      for (const [k, v] of Object.entries(patch || {})) {
        if (['userName', 'deviceName', 'linkPreviews'].includes(k)) settings[k] = v;
        if (k === 'server' && v && typeof v === 'object') settings.server = { url: String(v.url || ''), token: v.token || null, user: v.user || null, personal: v.personal !== false };
      }
      await saveSettings();
      return window.api.getSettings();
    },
    forgetBrowser: async () => {},

    backupStatus: async () => ({ enabled: false, unsupported: true, snapshots: [] }),
    backupNow: async () => ({ error: 'Backups to another folder are available in the desktop app.' }),
    backupSet: async () => ({}), backupChoose: async () => ({ canceled: true }), backupOpen: async () => {}, backupRead: async () => null,
    onBackupStatus: on('backup:status'), onBackupDone: on('backup:done'),

    spellGet: async () => ({ enabled: true, languages: [], available: [], words: [] }),
    spellSet: async () => ({}), spellRemoveWord: async () => true,

    syncStatus: async () => { await ready; return sync.status(); },
    syncChoose: async () => {
      await ready;
      if (!SF) return { error: 'On iPhone and iPad, use a Pocket-Canvas Server to sync (Settings › Server).' };
      let picked;
      try { picked = await SF.pick(); } catch (err) { return { error: 'The folder picker couldn\u2019t open: ' + (err.message || err) }; }
      if (!picked || picked.canceled || !picked.uri) return { canceled: true };
      try { await sync.enable(picked); return sync.status(); } catch (err) { return { error: 'That folder can\u2019t be used: ' + (err.message || err) }; }
    },
    syncDisable: async () => { await sync.disable(); return sync.status(); },
    syncNow: async () => { sync.seen.clear(); if (sync.latest) await sync.writeOwn(sync.latest); await sync.poll(); return sync.status(); },
    syncOpen: async () => {},

    onMenu: on('menu'),
    onSyncIncoming: on('sync:incoming'),
    onSyncStatus: on('sync:status'),
    onAssetsArrived: on('assets:arrived'),
    onClip: on('clip:add'),
    clipDone: () => {},

    // Android only: the menu button and the back button send these
    menu: (cmd) => emit('menu', cmd)
  };
  document.documentElement.classList.add('mobile', PLATFORM);
})();
