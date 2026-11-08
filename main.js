// Pocket-Canvas — main process
// Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, nativeImage, session } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { Settings } = require('./lib/settings');
const { FolderSync } = require('./lib/sync');
const { ClipServer } = require('./lib/clipper');
const { linkPreview } = require('./lib/link-preview');
const { exportBoard } = require('./lib/export');
const { Backups } = require('./lib/backup');

const DATA_DIR = () => app.getPath('userData');
const DATA_FILE = () => path.join(DATA_DIR(), 'pocket-canvas-data.json');
const ASSET_DIR = () => path.join(DATA_DIR(), 'assets');

let win;
let settings;
let sync;
let clipper;
let backups;
let lastJson = null;          // the most recent save, for sync and the browser extension
let rendererReady = false;
const clipQueue = [];         // clips that arrived before the window was ready

const send = (channel, payload) => { if (win && !win.isDestroyed()) win.webContents.send(channel, payload); };

function ensureDirs() {
  fs.mkdirSync(ASSET_DIR(), { recursive: true });
}

// One-time import of boards saved under the app's earlier name (PocketCanvas).
function importOldData() {
  if (fs.existsSync(DATA_FILE())) return;
  const oldDir = path.join(app.getPath('appData'), 'PocketCanvas');
  const oldFile = path.join(oldDir, 'pocketcanvas-data.json');
  if (!fs.existsSync(oldFile)) return;
  try {
    const oldAssets = path.join(oldDir, 'assets');
    if (fs.existsSync(oldAssets)) {
      for (const f of fs.readdirSync(oldAssets)) {
        const dest = path.join(ASSET_DIR(), f);
        if (!fs.existsSync(dest)) fs.copyFileSync(path.join(oldAssets, f), dest);
      }
    }
    fs.copyFileSync(oldFile, DATA_FILE());
  } catch (err) {
    console.error('Could not import PocketCanvas data:', err);
  }
}

function createWindow() {
  rendererReady = false;
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 500,
    title: 'Pocket-Canvas',
    backgroundColor: '#f4f1ec',
    icon: path.join(__dirname, 'src', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true
    }
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.on('closed', () => { win = null; rendererReady = false; });
  win.webContents.on('context-menu', (_e, params) => spellMenu(params));

  // Video players (YouTube and others) need to know which app is showing them; a page loaded from
  // a file has no web address, so tell them it's Pocket-Canvas.
  win.webContents.session.webRequest.onBeforeSendHeaders(
    { urls: ['https://www.youtube-nocookie.com/*', 'https://www.youtube.com/*', 'https://player.vimeo.com/*', 'https://www.dailymotion.com/*', 'https://geo.dailymotion.com/*', 'https://www.loom.com/*'] },
    (details, cb) => {
      const h = details.requestHeaders;
      if (!h.Referer && !h.referer) h.Referer = 'https://pocket-canvas.app/';
      cb({ requestHeaders: h });
    });

  // Open external links in the system browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) {
      e.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });
}

function buildMenu() {
  const cmd = (c) => () => send('menu', c);
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'New Board Card', accelerator: 'CmdOrCtrl+Shift+B', click: cmd('add-board') },
        { label: 'New Board from Template…', accelerator: 'CmdOrCtrl+Shift+N', click: cmd('new-from-template') },
        { label: 'Insert Template Here…', click: cmd('insert-template') },
        { label: 'Save Board as Template…', click: cmd('save-template') },
        { type: 'separator' },
        { label: 'Export Board as Picture or PDF…', accelerator: 'CmdOrCtrl+Shift+E', click: cmd('export-visual') },
        { label: 'Export Board as Markdown…', click: cmd('export-md') },
        { label: 'Export All Data (Backup)…', click: cmd('export-json') },
        { label: 'Import Backup…', click: cmd('import-json') },
        { label: 'Back Up Now', click: () => backups.run('manual').then((r) => send('backup:done', r)) },
        { label: 'Backups…', click: cmd('settings-backups') },
        { type: 'separator' },
        { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: cmd('settings') },
        { label: 'Open Data Folder', click: () => shell.openPath(DATA_DIR()) },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: cmd('undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', click: cmd('redo') },
        { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
        { type: 'separator' },
        { label: 'Duplicate', accelerator: 'CmdOrCtrl+D', click: cmd('duplicate') },
        { label: 'Select All Cards', accelerator: 'CmdOrCtrl+A', click: cmd('select-all') },
        { label: 'Find…', accelerator: 'CmdOrCtrl+F', click: cmd('find') },
        { label: 'Comments', accelerator: 'CmdOrCtrl+Shift+M', click: cmd('comments') },
        { type: 'separator' },
        { label: 'Move to Recycle Bin', click: cmd('delete') },
        { label: 'Recycle Bin…', click: cmd('bin') },
        { label: 'Spelling…', click: cmd('settings-spelling') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: cmd('zoom-in') },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: cmd('zoom-out') },
        { label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', click: cmd('zoom-reset') },
        { label: 'Fit to Content', accelerator: 'CmdOrCtrl+1', click: cmd('zoom-fit') },
        { label: 'Page Guides On / Off', accelerator: 'CmdOrCtrl+Shift+G', click: cmd('page-guides') },
        { type: 'separator' },
        { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+\\', click: cmd('toggle-sidebar') },
        { label: 'Toggle Dark Mode', accelerator: 'CmdOrCtrl+Shift+L', click: cmd('toggle-theme') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Keyboard Shortcuts', accelerator: 'F1', click: cmd('help') },
        { label: 'Sync Status…', click: cmd('settings-sync') },
        { label: 'Browser Extension…', click: cmd('settings-clipper') },
        {
          label: 'About Pocket-Canvas',
          click: () => dialog.showMessageBox(win, {
            type: 'info',
            icon: nativeImage.createFromPath(path.join(__dirname, 'src', 'icon.png')).resize({ width: 96, height: 96 }),
            title: 'About Pocket-Canvas',
            message: `Pocket-Canvas ${app.getVersion()}`,
            detail: 'A visual board for organising ideas.\n\n© 2026 Pocket-Designs\npocket-designs@proton.me'
          })
        }
      ]
    }
  ];
  if (process.platform === 'darwin') template.unshift({ role: 'appMenu' });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------- Data ----------
ipcMain.handle('data:load', () => {
  try {
    if (fs.existsSync(DATA_FILE())) {
      lastJson = fs.readFileSync(DATA_FILE(), 'utf8');
      return JSON.parse(lastJson);
    }
  } catch (err) {
    // Corrupt file: keep a copy and fall back to the last backup.
    const bak = DATA_FILE() + '.bak';
    try { fs.copyFileSync(DATA_FILE(), DATA_FILE() + '.corrupt-' + Date.now()); } catch {}
    if (fs.existsSync(bak)) {
      try { lastJson = fs.readFileSync(bak, 'utf8'); return JSON.parse(lastJson); } catch {}
    }
  }
  lastJson = null;
  return null;
});

ipcMain.handle('data:save', (_e, json) => {
  const file = DATA_FILE();
  const tmp = file + '.tmp';
  if (fs.existsSync(file)) {
    try { fs.copyFileSync(file, file + '.bak'); } catch {}
  }
  fs.writeFileSync(tmp, json, 'utf8');
  fs.renameSync(tmp, file);
  lastJson = json;
  if (sync && sync.enabled) sync.writeOwn(json);
  if (backups) backups.runIfDue();
  return true;
});

ipcMain.handle('app:ready', () => {
  rendererReady = true;
  while (clipQueue.length) {
    const { clip, resolve } = clipQueue.shift();
    deliverClip(clip).then(resolve);
  }
  if (sync && sync.enabled) { sync.seen.clear(); sync.poll(); } // anything sent before the window was listening
  if (sync) sync.emitStatus();
  return true;
});

// ---------- Assets ----------
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'];
const MEDIA_EXT = ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus', 'weba', 'mp4', 'm4v', 'webm', 'ogv', 'mov', 'mkv'];

const newAssetId = (name) => crypto.randomBytes(8).toString('hex') +
  (path.extname(name || '') || '.bin').toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 10);

ipcMain.handle('assets:base', () => pathToFileURL(ASSET_DIR() + path.sep).href);

ipcMain.handle('assets:saveBytes', (_e, { name, bytes }) => {
  const id = newAssetId(name);
  fs.writeFileSync(path.join(ASSET_DIR(), id), Buffer.from(bytes));
  return id;
});

ipcMain.handle('assets:pick', async (_e, kind) => {
  const filters = kind === 'image' ? [{ name: 'Images', extensions: IMAGE_EXT }]
    : kind === 'media' ? [{ name: 'Audio and video', extensions: MEDIA_EXT }]
      : [{ name: 'All files', extensions: ['*'] }];
  const res = await dialog.showOpenDialog(win, { properties: ['openFile', ...(kind === 'image-one' ? [] : ['multiSelections'])], filters: kind === 'image-one' ? [{ name: 'Images', extensions: IMAGE_EXT }] : filters });
  if (res.canceled) return [];
  return res.filePaths.map((p) => {
    const id = newAssetId(p);
    fs.copyFileSync(p, path.join(ASSET_DIR(), id));
    return { id, name: path.basename(p), size: fs.statSync(p).size };
  });
});

// Pictures and files sent to / fetched from your Pocket-Canvas Server.
const ASSET_ID = /^[0-9a-f]{16}\.[a-z0-9]{1,10}$/;
ipcMain.handle('assets:read', (_e, id) => {
  if (!ASSET_ID.test(String(id))) return null;
  try { return fs.readFileSync(path.join(ASSET_DIR(), String(id))); } catch { return null; }
});
ipcMain.handle('assets:write', (_e, { id, bytes }) => {
  if (!ASSET_ID.test(String(id)) || !bytes) return false;
  const file = path.join(ASSET_DIR(), String(id));
  if (fs.existsSync(file)) return true;
  fs.writeFileSync(file + '.tmp', Buffer.from(bytes));
  fs.renameSync(file + '.tmp', file);
  return true;
});
ipcMain.handle('assets:missing', (_e, ids) => (Array.isArray(ids) ? ids : []).filter((id) => ASSET_ID.test(String(id)) && !fs.existsSync(path.join(ASSET_DIR(), String(id)))));

ipcMain.handle('assets:open', (_e, id) => {
  const safe = path.basename(String(id));
  return shell.openPath(path.join(ASSET_DIR(), safe));
});

ipcMain.handle('assets:saveAs', async (_e, { id, name }) => {
  const safe = path.basename(String(id));
  const res = await dialog.showSaveDialog(win, { defaultPath: name || safe });
  if (res.canceled || !res.filePath) return false;
  fs.copyFileSync(path.join(ASSET_DIR(), safe), res.filePath);
  return true;
});

// ---------- Links ----------
ipcMain.handle('link:open', (_e, url) => {
  if (/^https?:\/\//i.test(url)) shell.openExternal(url);
});

ipcMain.handle('link:preview', async (_e, url) => {
  if (!settings.get('linkPreviews')) return null;
  try { return await linkPreview(String(url), ASSET_DIR()); } catch (err) { return { error: err.message }; }
});

// ---------- Files and dialogs ----------
ipcMain.handle('file:saveText', async (_e, { defaultName, text, filters }) => {
  const res = await dialog.showSaveDialog(win, { defaultPath: defaultName, filters });
  if (res.canceled || !res.filePath) return false;
  fs.writeFileSync(res.filePath, text, 'utf8');
  return true;
});

ipcMain.handle('file:openText', async (_e, { filters }) => {
  const res = await dialog.showOpenDialog(win, { properties: ['openFile'], filters });
  if (res.canceled || !res.filePaths[0]) return null;
  return fs.readFileSync(res.filePaths[0], 'utf8');
});

ipcMain.handle('dialog:confirm', async (_e, { message, detail }) => {
  const res = await dialog.showMessageBox(win, {
    type: 'question', buttons: ['Cancel', 'OK'], defaultId: 1, cancelId: 0, message, detail
  });
  return res.response === 1;
});

// ---------- Export ----------
ipcMain.handle('export:visual', async (_e, opts) => {
  const format = ['pdf', 'pages'].includes(opts.format) ? opts.format : 'png';
  const ext = format === 'png' ? 'png' : 'pdf';
  const safeName = String(opts.title || 'Board').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || 'Board';
  const res = await dialog.showSaveDialog(win, {
    defaultPath: `${safeName}.${ext}`,
    filters: ext === 'pdf' ? [{ name: 'PDF document', extensions: ['pdf'] }] : [{ name: 'PNG picture', extensions: ['png'] }]
  });
  if (res.canceled || !res.filePath) return { canceled: true };
  try {
    const out = await exportBoard({
      appDir: __dirname, boardId: String(opts.boardId), format,
      quality: opts.quality === 'high' ? 'high' : 'standard',
      background: ['board', 'white', 'transparent'].includes(opts.background) ? opts.background : 'board',
      theme: opts.theme === 'dark' ? 'dark' : 'light',
      filePath: res.filePath,
      data: typeof opts.data === 'string' ? opts.data : null,
      paper: opts.paper === 'Letter' ? 'Letter' : 'A4',
      orientation: ['portrait', 'landscape'].includes(opts.orientation) ? opts.orientation : 'auto',
      layout: opts.layout === 'guides' ? 'guides' : 'auto'
    });
    return { ...out, filePath: res.filePath };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('file:show', (_e, p) => { if (p) shell.showItemInFolder(String(p)); });

// ---------- Settings ----------
ipcMain.handle('settings:get', () => ({ ...settings.public(), clipperStatus: clipper.status, version: app.getVersion() }));

ipcMain.handle('settings:set', (_e, patch) => {
  const p = patch || {};
  const clean = {};
  if (typeof p.userName === 'string') clean.userName = p.userName.trim().slice(0, 60) || 'Me';
  if (typeof p.deviceName === 'string') clean.deviceName = p.deviceName.trim().slice(0, 60) || 'This computer';
  if (typeof p.linkPreviews === 'boolean') clean.linkPreviews = p.linkPreviews;
  if (p.server && typeof p.server === 'object') {
    const s = p.server;
    const url = typeof s.url === 'string' && /^https?:\/\/[^\s]+$/i.test(s.url.trim()) ? s.url.trim().replace(/\/+$/, '') : '';
    const user = s.user && typeof s.user === 'object' ? { id: String(s.user.id || '').slice(0, 40), name: String(s.user.name || '').slice(0, 60), display: String(s.user.display || s.user.name || '').slice(0, 60) } : null;
    clean.server = { url, token: typeof s.token === 'string' ? s.token.slice(0, 200) : null, user, personal: s.personal !== false };
  }
  let restartClipper = false;
  if (p.clipper) {
    const c = {};
    if (typeof p.clipper.enabled === 'boolean') c.enabled = p.clipper.enabled;
    const port = parseInt(p.clipper.port, 10);
    if (port >= 1024 && port <= 65535) c.port = port;
    clean.clipper = c;
    restartClipper = true;
  }
  settings.set(clean);
  if (restartClipper) clipper.start();
  if (clean.deviceName && sync.enabled && lastJson) sync.writeOwn(lastJson);
  return new Promise((r) => setTimeout(() => r({ ...settings.public(), clipperStatus: clipper.status, version: app.getVersion() }), 150));
});

ipcMain.handle('clipper:forget', (_e, id) => {
  const cfg = settings.get('clipper');
  settings.set({ clipper: { tokens: cfg.tokens.filter((t) => t.id !== id) } });
  return settings.public();
});

// ---------- Backups ----------
ipcMain.handle('backup:status', () => backups.status());
ipcMain.handle('backup:now', () => backups.run('manual'));
ipcMain.handle('backup:set', (_e, patch) => {
  const p = patch || {}, clean = {};
  if (typeof p.enabled === 'boolean') clean.enabled = p.enabled;
  if (['hour', 'day', 'week', 'manual'].includes(p.every)) clean.every = p.every;
  const keep = parseInt(p.keep, 10);
  if (keep >= 1 && keep <= 1000) clean.keep = keep;
  backups.set(clean);
  return backups.status();
});
ipcMain.handle('backup:choose', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: 'Choose where to keep backups',
    buttonLabel: 'Use this folder',
    properties: ['openDirectory', 'createDirectory']
  });
  if (res.canceled || !res.filePaths[0]) return { canceled: true };
  const folder = Backups.resolveFolder(res.filePaths[0]);
  try {
    fs.mkdirSync(folder, { recursive: true });
    const probe = path.join(folder, '.write-test'); fs.writeFileSync(probe, 'ok'); fs.unlinkSync(probe);
  } catch (err) { return { error: 'That folder can’t be used: ' + err.message }; }
  backups.set({ folder });
  backups.run('new folder');
  return backups.status();
});
ipcMain.handle('backup:open', () => { const f = backups.cfg.folder; fs.mkdirSync(f, { recursive: true }); shell.openPath(f); });
ipcMain.handle('backup:read', async (_e, name) => {
  try {
    await backups.run('before restore'); // so the current boards can be got back too
    return { data: await backups.read(name) };
  } catch (err) { return { error: err.message }; }
});

// ---------- Spelling ----------
function spellLanguages() {
  try { return session.defaultSession.availableSpellCheckerLanguages || []; } catch { return []; }
}
function applySpelling() {
  const sp = { enabled: true, languages: ['en-GB'], ...(settings.get('spell') || {}) };
  const ses = session.defaultSession;
  try { ses.setSpellCheckerEnabled(sp.enabled); } catch {}
  if (process.platform !== 'darwin') {
    const avail = spellLanguages();
    const langs = sp.languages.filter((l) => !avail.length || avail.includes(l));
    try { if (langs.length) ses.setSpellCheckerLanguages(langs); } catch {}
  }
}
function spellMenu(params) {
  if (!params.isEditable) return;
  const wc = win.webContents;
  const items = [];
  if (params.misspelledWord) {
    for (const s of params.dictionarySuggestions.slice(0, 6)) items.push({ label: s, click: () => wc.replaceMisspelling(s) });
    if (!params.dictionarySuggestions.length) items.push({ label: 'No suggestions', enabled: false });
    items.push({ type: 'separator' });
    items.push({ label: `Add “${params.misspelledWord}” to dictionary`, click: () => session.defaultSession.addWordToSpellCheckerDictionary(params.misspelledWord) });
    items.push({ type: 'separator' });
  }
  const f = params.editFlags;
  items.push(
    { label: 'Cut', role: 'cut', enabled: f.canCut },
    { label: 'Copy', role: 'copy', enabled: f.canCopy },
    { label: 'Paste', role: 'paste', enabled: f.canPaste },
    { type: 'separator' },
    { label: 'Select all', role: 'selectAll', enabled: f.canSelectAll }
  );
  Menu.buildFromTemplate(items).popup({ window: win });
}
ipcMain.handle('spell:get', async () => {
  const sp = { enabled: true, languages: ['en-GB'], ...(settings.get('spell') || {}) };
  let words = [];
  try { words = await session.defaultSession.listWordsInSpellCheckerDictionary(); } catch {}
  return { ...sp, available: spellLanguages(), words: words.sort((a, b) => a.localeCompare(b)), platform: process.platform };
});
ipcMain.handle('spell:set', (_e, patch) => {
  const sp = { enabled: true, languages: ['en-GB'], ...(settings.get('spell') || {}) };
  if (typeof patch.enabled === 'boolean') sp.enabled = patch.enabled;
  if (Array.isArray(patch.languages)) sp.languages = patch.languages.filter((l) => typeof l === 'string' && /^[a-zA-Z-]{2,12}$/.test(l)).slice(0, 4);
  settings.set({ spell: sp });
  applySpelling();
  return sp;
});
ipcMain.handle('spell:removeWord', (_e, word) => { try { session.defaultSession.removeWordFromSpellCheckerDictionary(String(word)); } catch {} return true; });

// ---------- Sync ----------
ipcMain.handle('sync:status', () => sync.status());

ipcMain.handle('sync:choose', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: 'Choose a folder that your sync service keeps up to date',
    buttonLabel: 'Use this folder',
    properties: ['openDirectory', 'createDirectory']
  });
  if (res.canceled || !res.filePaths[0]) return { canceled: true };
  try {
    sync.enable(res.filePaths[0], lastJson);
    return sync.status();
  } catch (err) {
    return { error: 'That folder can’t be used: ' + err.message };
  }
});

ipcMain.handle('sync:disable', () => { sync.disable(); return sync.status(); });
ipcMain.handle('sync:now', () => { sync.seen.clear(); if (lastJson) sync.writeOwn(lastJson); sync.poll(); return sync.status(); });
ipcMain.handle('sync:open', () => { if (sync.folder) shell.openPath(sync.folder); });

// ---------- Browser extension ----------
function deliverClip(clip) {
  if (!win) createWindow();
  if (!rendererReady) return new Promise((resolve) => clipQueue.push({ clip, resolve }));
  return new Promise((resolve) => {
    const id = crypto.randomBytes(6).toString('hex');
    const done = (_e, reply) => { if (reply && reply.id === id) { ipcMain.removeListener('clip:done', done); resolve(reply); } };
    ipcMain.on('clip:done', done);
    send('clip:add', { id, ...clip });
    setTimeout(() => { ipcMain.removeListener('clip:done', done); resolve({}); }, 10000);
  });
}

async function confirmPair(browser) {
  if (!win) createWindow();
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
  const res = await dialog.showMessageBox(win, {
    type: 'question',
    buttons: ['Don’t allow', 'Allow'],
    defaultId: 1, cancelId: 0,
    title: 'Connect browser extension',
    message: `Let the Pocket-Canvas extension in ${browser} save to your boards?`,
    detail: 'It will be able to add web pages, pictures, videos and text you choose to save. You can disconnect it any time in Settings › Browser extension.'
  });
  return res.response === 1;
}

// ---------- Start-up ----------
app.whenReady().then(() => {
  ensureDirs();
  importOldData();
  settings = new Settings(DATA_DIR());
  sync = new FolderSync({ settings, assetDir: ASSET_DIR(), send });
  clipper = new ClipServer({
    settings, assetDir: ASSET_DIR(), version: app.getVersion(),
    getStore: () => { try { return lastJson ? JSON.parse(lastJson) : null; } catch { return null; } },
    confirmPair, deliver: deliverClip
  });
  backups = new Backups({
    settings, assetDir: ASSET_DIR(), defaultParent: app.getPath('documents'),
    getLatest: () => lastJson, version: app.getVersion(), send
  });
  applySpelling();
  buildMenu();
  createWindow();
  sync.start();
  clipper.start();
  backups.start();
  app.on('activate', () => { if (!win) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { if (sync) sync.stop(); if (clipper) clipper.stop(); if (backups) backups.stop(); });
