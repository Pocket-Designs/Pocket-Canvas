// Pocket-Connect — main process.
//
// One app does both jobs:
//   Host:   this computer can be reached (Pocket ID through your server, or directly on the LAN).
//   Viewer: connect to other computers and Android devices (desktop, console or both).
//
// Windows:
//   main      – device list, folders, this device's ID/passwords, account, settings
//   host      – hidden page that runs the WebRTC side of incoming sessions
//   viewer    – one per outgoing session
//   sessionbar – small always-on-top bar shown while someone is connected to THIS computer
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const {
  app, BrowserWindow, ipcMain, session, desktopCapturer, screen, clipboard, dialog, shell, Tray, Menu,
  nativeImage, Notification, powerSaveBlocker,
} = require('electron');

const store = require('./store');
const hostauth = require('./hostauth');
const lan = require('./lan');
const serverlink = require('./serverlink');
const android = require('./android');
const terminal = require('./terminal');
const input = require('./input');

const UI = path.join(__dirname, '..', 'ui');
const ASSETS = path.join(__dirname, '..', 'assets');
const OS_NAME = { win32: 'windows', linux: 'linux', darwin: 'macos' }[process.platform] || 'unknown';
const isDev = process.argv.includes('--dev');
const startHidden = process.argv.includes('--hidden');

// Allow running two copies side by side for testing: --profile=name
const profileArg = process.argv.find((a) => a.startsWith('--profile='));
if (profileArg) app.setPath('userData', path.join(app.getPath('appData'), `Pocket-Connect-${profileArg.split('=')[1].replace(/[^\w-]/g, '')}`));

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showMain());
}

// Linux: allow screen capture through PipeWire on Wayland desktops.
if (process.platform === 'linux') app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer');

let mainWin = null;
let hostWin = null;
let barWin = null;
let tray = null;
let quitting = false;
const viewers = new Map(); // webContents.id -> BrowserWindow
const deviceLink = new serverlink.DeviceLink();

// ---------------------------------------------------------------- helpers
const send = (win, ch, ...args) => {
  if (win && !win.isDestroyed()) win.webContents.send(ch, ...args);
};

function hostName() {
  return store.getSettings().deviceName || os.hostname();
}

function hostInfo() {
  const s = store.getSettings();
  return { id: s.deviceId || '', name: hostName(), os: OS_NAME, hostname: os.hostname() };
}

function accountToken() {
  return store.getSecret('accountToken');
}

function webPrefs(extra = {}) {
  return {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    spellcheck: false,
    ...extra,
  };
}

function lockDown(win) {
  // No navigation away from our own pages and no pop-ups: links open in the real browser.
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) e.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

function appIcon() {
  const p = path.join(ASSETS, process.platform === 'win32' ? 'icon.ico' : 'icon.png');
  return fs.existsSync(p) ? p : undefined;
}

// ---------------------------------------------------------------- windows
function createMain() {
  mainWin = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 880,
    minHeight: 560,
    title: 'Pocket-Connect',
    icon: appIcon(),
    show: false,
    backgroundColor: '#101418',
    autoHideMenuBar: true,
    webPreferences: webPrefs(),
  });
  lockDown(mainWin);
  mainWin.loadFile(path.join(UI, 'index.html'));
  mainWin.once('ready-to-show', () => !startHidden && mainWin.show());
  mainWin.on('close', (e) => {
    // Closing the window keeps Pocket-Connect running in the tray so this computer stays reachable.
    if (!quitting && store.getSettings().host.enabled && tray) {
      e.preventDefault();
      mainWin.hide();
    }
  });
  if (isDev) mainWin.webContents.openDevTools({ mode: 'detach' });
}

function showMain() {
  if (!mainWin || mainWin.isDestroyed()) createMain();
  mainWin.show();
  mainWin.focus();
}

function createHostPage() {
  hostWin = new BrowserWindow({
    show: false,
    width: 400,
    height: 300,
    webPreferences: webPrefs({ backgroundThrottling: false }),
  });
  lockDown(hostWin);
  hostWin.loadFile(path.join(UI, 'host.html'));
  hostWin.on('closed', () => {
    hostWin = null;
    if (!quitting) setTimeout(createHostPage, 1000);
  });
}

function openViewer({ target, mode, name, os: targetOs, entryId }) {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 480,
    minHeight: 360,
    title: `${name || target} – Pocket-Connect`,
    icon: appIcon(),
    backgroundColor: '#0b0e11',
    autoHideMenuBar: true,
    webPreferences: webPrefs(),
  });
  lockDown(win);
  const id = win.webContents.id;
  viewers.set(id, win);
  const query = { target, mode: mode || 'desktop', name: name || target, os: targetOs || '', entry: entryId || '' };
  win.loadFile(path.join(UI, 'viewer.html'), { query });
  win.on('closed', () => {
    viewers.delete(id);
    closeViewerLinks(id);
    stopLocalAndroidFor(id);
  });
  if (isDev) win.webContents.openDevTools({ mode: 'detach' });
  return id;
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(ASSETS, 'tray.png'));
  if (icon.isEmpty()) return;
  tray = new Tray(icon);
  tray.setToolTip('Pocket-Connect');
  const menu = () => Menu.buildFromTemplate([
    { label: `ID: ${formatId(store.getSettings().deviceId) || 'LAN only'}`, enabled: false },
    { label: 'Open Pocket-Connect', click: showMain },
    { type: 'separator' },
    {
      label: 'Allow incoming connections',
      type: 'checkbox',
      checked: store.getSettings().host.enabled,
      click: (item) => {
        store.setSettings({ host: { enabled: item.checked } });
        applyHostSettings();
        refreshTray();
      },
    },
    { label: 'Disconnect everyone', enabled: hostSessions.size > 0, click: () => [...hostSessions.keys()].forEach(kick) },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        quitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu());
  tray.on('click', showMain);
  refreshTray = () => tray && tray.setContextMenu(menu());
}
let refreshTray = () => {};

const formatId = (id) => (id ? String(id).replace(/(\d{3})(?=\d)/g, '$1 ') : '');

// ---------------------------------------------------------------- server identity
async function ensureDevice() {
  const s = store.getSettings();
  if (!s.serverUrl) {
    deviceLink.stop();
    return;
  }
  if (!s.deviceId || !store.getSecret('deviceSecret')) {
    try {
      const r = await serverlink.request('POST', '/api/devices/register', { os: OS_NAME, name: hostName(), hostname: os.hostname() });
      store.setSettings({ deviceId: r.id });
      store.setSecret('deviceSecret', r.secret);
    } catch (e) {
      deviceLink.setState('error', e.message);
      setTimeout(ensureDevice, 30_000);
      return;
    }
  }
  if (store.getSettings().host.enabled) {
    deviceLink.stop();
    deviceLink.start(() => ({
      id: store.getSettings().deviceId,
      secret: store.getSecret('deviceSecret'),
      os: OS_NAME,
      hostname: os.hostname(),
    }));
  } else deviceLink.stop();
  pushState();
}

deviceLink.on('state', () => {
  pushState();
  refreshTray();
});
deviceLink.on('welcome', async (msg) => {
  // A signed-in user's own computer attaches itself to their account automatically.
  if (!msg.attached && accountToken() && store.getSettings().autoAttach !== false) attachThisDevice().catch(() => {});
});
deviceLink.on('bad-device', () => {
  // The server no longer knows this device (e.g. it was reset). Ask for a new ID.
  store.setSettings({ deviceId: '' });
  store.setSecret('deviceSecret', null);
  deviceLink.stop();
  setTimeout(ensureDevice, 2000);
});
deviceLink.on('message', (msg) => {
  if (msg.t === 'incoming') return onIncoming({ ...msg, via: 'server' });
  if (msg.t === 'ice-config') {
    const s = hostSessions.get(msg.sid);
    if (s) send(hostWin, 'host:create', msg.sid, msg.ice || []);
    return;
  }
  if (msg.t === 'signal') return send(hostWin, 'host:signal', msg.sid, msg.data);
  if (msg.t === 'bye') return send(hostWin, 'host:kick', msg.sid);
});

async function attachThisDevice() {
  const token = accountToken();
  if (!token) throw new Error('Sign in first.');
  const s = store.getSettings();
  await serverlink.request('POST', '/api/devices/attach', { deviceId: s.deviceId, deviceSecret: store.getSecret('deviceSecret'), name: hostName() }, { token });
  return true;
}

// ---------------------------------------------------------------- host: incoming sessions
const hostSessions = new Map(); // sid -> session record
let blocker = null;

function modeAllowed(mode) {
  const h = store.getSettings().host;
  if (mode === 'desktop') return h.allowDesktop;
  if (mode === 'terminal') return h.allowTerminal;
  if (mode === 'android') return h.allowAndroid !== false;
  return h.allowDesktop || h.allowTerminal; // both
}

function onIncoming(info) {
  const h = store.getSettings().host;
  const reject = (reason) => {
    if (info.via === 'server') deviceLink.send({ t: 'reject', sid: info.sid, reason });
    else {
      lan.send(info.sid, { t: 'rejected', reason });
      lan.endSession(info.sid);
    }
  };
  if (!h.enabled) return reject('off');
  if (!['desktop', 'terminal', 'both', 'android'].includes(info.mode)) info.mode = 'desktop';
  if (!modeAllowed(info.mode)) return reject('mode');
  if (hostSessions.size >= 8) return reject('busy');
  const s = {
    sid: info.sid,
    via: info.via,
    mode: info.mode,
    owner: !!info.owner,
    from: String(info.from || 'Unknown').slice(0, 40),
    ip: info.ip || '',
    nonce: crypto.randomBytes(16).toString('base64'),
    needPassword: !(info.owner && h.ownerNoPassword),
    authed: false,
    started: Date.now(),
    display: null,
    android: null, // { serial, stream }
  };
  hostSessions.set(info.sid, s);
  if (info.via === 'server') {
    deviceLink.send({ t: 'accept', sid: info.sid });
  } else {
    lan.send(info.sid, { t: 'accepted', host: { os: OS_NAME, name: hostName() }, ice: [] });
    send(hostWin, 'host:create', info.sid, []);
  }
}

function hostSignal(sid, data) {
  const s = hostSessions.get(sid);
  if (!s) return;
  if (s.via === 'server') deviceLink.send({ t: 'signal', sid, data });
  else lan.send(sid, { t: 'signal', data });
}

function features() {
  const h = store.getSettings().host;
  return {
    desktop: !!h.allowDesktop,
    terminal: !!h.allowTerminal && terminal.available(),
    clipboard: !!h.clipboard,
    viewOnly: !!h.viewOnly,
    input: input.available() && !h.viewOnly,
    android: h.allowAndroid !== false && !!android.adbPath(),
  };
}

// What this particular session may use: the host settings narrowed by the mode asked for.
function sessionFeatures(s) {
  const f = features();
  const m = s.mode;
  return {
    ...f,
    desktop: f.desktop && (m === 'desktop' || m === 'both'),
    terminal: f.terminal && (m === 'terminal' || m === 'both'),
    android: f.android && (m === 'android' || m === 'both'),
  };
}

function displays() {
  const primary = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d, i) => ({
    id: String(d.id),
    label: `${d.id === primary ? 'Main screen' : `Screen ${i + 1}`} (${d.size.width}×${d.size.height})`,
    primary: d.id === primary,
  }));
}

async function confirmSession(s) {
  const h = store.getSettings().host;
  const need = h.confirm === 'always' || (h.confirm === 'guests' && !s.owner && s.which !== 'permanent');
  if (!need) return true;
  send(hostWin, 'host:waiting', s.sid);
  const what = { desktop: 'see and control the desktop', terminal: 'open a console', both: 'use the desktop and console', android: 'control Android devices attached here' }[s.mode];
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 30_000);
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.show();
    mainWin.focus();
  }
  try {
    const r = await dialog.showMessageBox(mainWin && !mainWin.isDestroyed() ? mainWin : undefined, {
      type: 'question',
      title: 'Incoming connection',
      message: `${s.from} wants to ${what}.`,
      detail: `From ${s.ip || 'unknown address'} (${s.via === 'lan' ? 'local network' : 'through your server'}).\nOnly allow people you know. This request is declined automatically in 30 seconds.`,
      buttons: ['Allow', 'Decline'],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
      signal: ac.signal,
    });
    return r.response === 0;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function verify(sid, payload) {
  const s = hostSessions.get(sid);
  if (!s) return { ok: false };
  if (s.needPassword) {
    const r = hostauth.verifyProof({ ...payload, nonce: s.nonce });
    if (!r.ok) {
      log(`Wrong password from ${s.from} (${s.ip})`);
      return r;
    }
    s.which = r.which;
    s.hostProof = r.hostProof;
  } else {
    s.which = 'account';
  }
  if (!(await confirmSession(s))) {
    log(`Declined ${s.from} (${s.ip})`);
    return { ok: false, denied: true };
  }
  s.authed = true;
  log(`${s.from} connected (${s.mode}, ${s.which === 'account' ? 'your account' : `${s.which} password`}, ${s.via === 'lan' ? 'LAN' : 'server'})`);
  sessionsChanged();
  if (Notification.isSupported()) {
    new Notification({ title: 'Pocket-Connect', body: `${s.from} is connected to this computer.`, silent: false }).show();
  }
  let androidDevices = [];
  if (sessionFeatures(s).android) androidDevices = (await android.list().catch(() => ({ devices: [] }))).devices;
  return {
    ok: true,
    which: s.which,
    hostProof: s.hostProof || '',
    features: sessionFeatures(s),
    displays: displays(),
    shells: terminal.shellChoices().map(({ id, label }) => ({ id, label })),
    android: androidDevices,
  };
}

function endHostSession(sid) {
  const s = hostSessions.get(sid);
  if (!s) return;
  hostSessions.delete(sid);
  terminal.close(sid);
  input.releaseAll();
  if (s.android) {
    s.android.stream?.stop();
    android.stopInput(s.android.serial);
  }
  if (s.via === 'server') deviceLink.send({ t: 'bye', sid });
  else lan.endSession(sid);
  if (s.authed) {
    log(`${s.from} disconnected`);
    if (s.which === 'one-time' && store.getSettings().host.rotateOneTime) hostauth.newOneTimePassword();
  }
  sessionsChanged();
}

function kick(sid) {
  send(hostWin, 'host:kick', sid);
  setTimeout(() => endHostSession(sid), 500);
}

function sessionsChanged() {
  const list = [...hostSessions.values()].filter((s) => s.authed).map((s) => ({
    sid: s.sid, from: s.from, ip: s.ip, mode: s.mode, via: s.via, started: s.started, which: s.which,
  }));
  send(mainWin, 'sessions', list);
  pushState();
  refreshTray();
  if (list.length) {
    if (blocker === null) blocker = powerSaveBlocker.start('prevent-display-sleep');
    showSessionBar(list);
  } else {
    if (blocker !== null) {
      powerSaveBlocker.stop(blocker);
      blocker = null;
    }
    if (barWin && !barWin.isDestroyed()) barWin.close();
  }
  if (tray) tray.setToolTip(list.length ? `Pocket-Connect – ${list.length} connected` : 'Pocket-Connect');
}

function showSessionBar(list) {
  if (!barWin || barWin.isDestroyed()) {
    const wa = screen.getPrimaryDisplay().workArea;
    barWin = new BrowserWindow({
      width: 340,
      height: 64,
      x: Math.round(wa.x + wa.width / 2 - 170),
      y: wa.y + 8,
      frame: false,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: true,
      transparent: false,
      backgroundColor: '#14191f',
      webPreferences: webPrefs(),
    });
    barWin.setAlwaysOnTop(true, 'screen-saver');
    // The bar is not shown to the viewer: excluded from capture where the OS supports it.
    barWin.setContentProtection(true);
    lockDown(barWin);
    barWin.loadFile(path.join(UI, 'sessionbar.html'));
    barWin.webContents.once('did-finish-load', () => send(barWin, 'sessions', list));
  } else {
    send(barWin, 'sessions', list);
    barWin.setSize(340, 40 + 24 * Math.min(list.length, 4));
  }
}

// Clipboard sharing: host -> viewer. Polls only while someone with clipboard access is connected.
let lastClip = '';
let lastClipFromRemote = '';
// Newer Electron versions return a Promise from readText(); older ones a string. Handle both.
async function readClipboard() {
  try {
    return String((await clipboard.readText()) ?? '');
  } catch {
    return '';
  }
}

setInterval(async () => {
  if (!store.getSettings().host?.clipboard) return;
  if (![...hostSessions.values()].some((s) => s.authed)) return;
  const t = await readClipboard();
  if (t && t !== lastClip && t !== lastClipFromRemote) send(hostWin, 'host:clip', t.slice(0, 100_000));
  lastClip = t;
}, 1000).unref();

// ---------------------------------------------------------------- activity log
const activity = [];
function log(text) {
  activity.unshift({ at: Date.now(), text });
  activity.length = Math.min(activity.length, 200);
  send(mainWin, 'activity', activity.slice(0, 50));
}

// ---------------------------------------------------------------- screen capture source
let nextDisplay = null;
function setupCapture() {
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    // Only the hidden host page may capture the screen.
    if (!hostWin || request.frame?.top?.processId !== hostWin.webContents.getProcessId()) {
      return callback({});
    }
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } });
      const pick = sources.find((s) => String(s.display_id) === String(nextDisplay)) || sources[0];
      callback(pick ? { video: pick } : {});
    } catch (e) {
      console.warn('capture', e);
      callback({});
    }
  }, { useSystemPicker: false });

  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => {
    cb(['clipboard-sanitized-write', 'fullscreen', 'notifications', 'media', 'display-capture'].includes(permission));
  });
}

// ---------------------------------------------------------------- LAN
function applyHostSettings() {
  const s = store.getSettings();
  if (s.host.enabled && s.host.lanListen) {
    try {
      lan.start({
        getSettings: () => store.getSettings(),
        getInfo: () => ({ name: hostName(), os: OS_NAME, id: store.getSettings().deviceId || '' }),
        onIncoming: (info) => onIncoming(info),
        onSignal: (sid, data) => send(hostWin, 'host:signal', sid, data),
        onBye: (sid) => send(hostWin, 'host:kick', sid),
        onSocketClosed: (sid) => {
          const sess = hostSessions.get(sid);
          // After WebRTC is up the LAN socket is no longer needed, so only clean up unfinished set-ups.
          if (sess && !sess.authed) send(hostWin, 'host:kick', sid);
        },
        onError: (err) => log(`LAN listener: ${err.code === 'EADDRINUSE' ? `port ${s.host.lanPort} is already in use` : err.message}`),
      });
    } catch (e) {
      log(`LAN listener failed: ${e.message}`);
    }
  } else lan.stop();
  ensureDevice();
}

// ---------------------------------------------------------------- viewer transports
const viewerLinks = new Map(); // `${wcId}:${sid}` -> link

function isPocketId(t) {
  return /^\d{9}$/.test(String(t).replace(/\s/g, ''));
}

function openViewerLink(wc, target, mode, sid) {
  const key = `${wc.id}:${sid}`;
  const deliver = (msg) => send(viewers.get(wc.id), 'viewer:signal', { ...msg, sid: msg.sid || sid });
  const clean = String(target).trim();
  let link;
  try {
    if (isPocketId(clean)) {
      if (!store.getSettings().serverUrl) throw Object.assign(new Error('no server'), { code: 'no_server' });
      link = serverlink.viewerSocket({ token: accountToken(), name: store.getSettings().account?.name || hostName() }, deliver);
      link.send({ t: 'connect', sid, to: clean.replace(/\s/g, ''), mode });
    } else {
      link = serverlink.lanSocket(clean, deliver);
      link.send({ t: 'connect', sid, mode, name: store.getSettings().account?.name || hostName() });
    }
  } catch (e) {
    return deliver({ t: 'error', code: e.code === 'no_server' ? 'no_server' : 'unreachable' });
  }
  viewerLinks.set(key, link);
}

function closeViewerLinks(wcId) {
  for (const [k, link] of viewerLinks) {
    if (k.startsWith(`${wcId}:`)) {
      link.close();
      viewerLinks.delete(k);
    }
  }
}

// ---------------------------------------------------------------- local Android (no host needed)
const localAndroid = new Map(); // `${wcId}:${serial}` -> { stream, wcId, serial }

function stopLocalAndroidFor(wcId) {
  for (const [k, v] of localAndroid) {
    if (v.wcId === wcId) {
      v.stream.stop();
      android.stopInput(v.serial);
      localAndroid.delete(k);
    }
  }
  for (const id of [...termOwners.keys()]) if (termOwners.get(id) === wcId) terminal.close(id), termOwners.delete(id);
}
const termOwners = new Map(); // terminal id -> wcId (local android consoles)

// ---------------------------------------------------------------- address book sync
async function pushBook(book) {
  const token = accountToken();
  if (!token) return { synced: false };
  const s = store.getSettings();
  try {
    const r = await serverlink.request('PUT', '/api/book', { data: book, version: s.bookVersion || 0 }, { token });
    store.setSettings({ bookVersion: r.version });
    return { synced: true };
  } catch (e) {
    if (e.code === 'version_conflict') {
      // Someone changed the book on another computer: merge (local wins per item) and retry once.
      const merged = mergeBooks(e.body.data || { folders: [], devices: [] }, book);
      store.setSettings({ book: merged, bookVersion: e.body.version });
      const r = await serverlink.request('PUT', '/api/book', { data: merged, version: e.body.version }, { token });
      store.setSettings({ bookVersion: r.version });
      send(mainWin, 'book-changed');
      return { synced: true, merged: true };
    }
    return { synced: false, error: e.message };
  }
}

function mergeBooks(remote, local) {
  const byId = (list) => new Map((list || []).map((x) => [x.id, x]));
  const f = byId(remote.folders);
  for (const x of local.folders || []) f.set(x.id, x);
  const d = byId(remote.devices);
  for (const x of local.devices || []) d.set(x.id, x);
  const removed = new Set(local.removed || []);
  return {
    folders: [...f.values()].filter((x) => !removed.has(x.id)),
    devices: [...d.values()].filter((x) => !removed.has(x.id)),
  };
}

async function pullBook() {
  const token = accountToken();
  if (!token) return null;
  const r = await serverlink.request('GET', '/api/book', null, { token });
  if (!r.data) {
    await pushBook(store.getSettings().book);
    return store.getSettings().book;
  }
  // Saved passwords stay on this computer; the server copy never has them.
  store.setSettings({ book: r.data, bookVersion: r.version });
  send(mainWin, 'book-changed');
  return r.data;
}

// ---------------------------------------------------------------- state for the UI
function state() {
  const s = store.getSettings();
  return {
    version: app.getVersion(),
    os: OS_NAME,
    settings: s,
    device: hostInfo(),
    oneTime: hostauth.getOneTimePassword(),
    hasPermanent: hostauth.hasPermanentPassword(),
    server: { url: s.serverUrl, state: deviceLink.state, detail: deviceLink.detail || '' },
    signedIn: !!accountToken(),
    encryption: store.encryptionInfo(),
    lan: lan.addresses(),
    capabilities: {
      input: input.available(),
      inputError: input.loadError(),
      terminal: terminal.available(),
      adb: !!android.adbPath(),
      scrcpy: !!android.findTool('scrcpy'),
      wayland: process.platform === 'linux' && (process.env.XDG_SESSION_TYPE === 'wayland' || !!process.env.WAYLAND_DISPLAY),
    },
    sessions: [...hostSessions.values()].filter((x) => x.authed).map((x) => ({ sid: x.sid, from: x.from, ip: x.ip, mode: x.mode, via: x.via, started: x.started })),
    activity: activity.slice(0, 50),
  };
}

let stateTimer = null;
function pushState() {
  clearTimeout(stateTimer);
  stateTimer = setTimeout(() => send(mainWin, 'state', state()), 50);
}

// ---------------------------------------------------------------- autostart
function setAutostart(on) {
  if (process.platform === 'linux') {
    const dir = path.join(os.homedir(), '.config', 'autostart');
    const file = path.join(dir, 'pocket-connect.desktop');
    if (on) {
      fs.mkdirSync(dir, { recursive: true });
      const exe = process.env.APPIMAGE || process.execPath;
      fs.writeFileSync(file, `[Desktop Entry]\nType=Application\nName=Pocket-Connect\nExec="${exe}" --hidden\nX-GNOME-Autostart-enabled=true\n`);
    } else if (fs.existsSync(file)) fs.unlinkSync(file);
  } else {
    app.setLoginItemSettings({ openAtLogin: on, args: ['--hidden'] });
  }
}

// ---------------------------------------------------------------- IPC
// Each window kind may only use its own channels.
function from(kind, handler) {
  return (event, ...args) => {
    const wc = event.sender;
    const ok = (kind === 'main' && mainWin && wc === mainWin.webContents)
      || (kind === 'host' && hostWin && wc === hostWin.webContents)
      || (kind === 'viewer' && viewers.has(wc.id))
      || (kind === 'bar' && barWin && !barWin.isDestroyed() && wc === barWin.webContents)
      || (kind === 'any' && (wc === mainWin?.webContents || viewers.has(wc.id)));
    if (!ok) throw new Error('Not allowed from this window');
    return handler(event, ...args);
  };
}
const handle = (ch, kind, fn) => ipcMain.handle(ch, from(kind, fn));

function errorText(e) {
  const map = {
    bad_credentials: 'Wrong email or password.',
    need_totp: 'need_totp',
    bad_totp: 'That two-factor code is not right.',
    rate_limited: 'Too many attempts. Wait a few minutes.',
    registration_closed: 'This server is not accepting new accounts.',
    email_taken: 'An account with that email already exists.',
    weak_password: 'Use at least 10 characters for the account password.',
    bad_email: 'That email address does not look right.',
    unauthorized: 'Your sign-in has expired. Sign in again.',
  };
  return map[e.code] || e.message;
}

async function api(method, p, body) {
  try {
    return await serverlink.request(method, p, body, { token: accountToken() });
  } catch (e) {
    if (e.code === 'unauthorized') {
      store.setSecret('accountToken', null);
      store.setSettings({ account: null });
      pushState();
    }
    throw new Error(errorText(e));
  }
}

function registerIpc() {
  // ---- main window
  handle('app:state', 'main', () => state());
  handle('host:new-one-time', 'main', () => {
    hostauth.newOneTimePassword();
    pushState();
    return hostauth.getOneTimePassword();
  });
  handle('host:set-permanent', 'main', (e, pw) => {
    const r = hostauth.setPermanentPassword(pw ? String(pw) : '');
    // Every viewer's remembered key for this host stops working after a change. That is intended.
    pushState();
    return r;
  });
  handle('settings:set', 'main', (e, patch) => {
    const before = store.getSettings();
    const allowed = {};
    for (const k of ['deviceName', 'host', 'ui', 'autostart', 'android', 'autoAttach']) if (k in patch) allowed[k] = patch[k];
    const after = store.setSettings(allowed);
    if ('autostart' in patch) setAutostart(!!patch.autostart);
    if (JSON.stringify(before.host) !== JSON.stringify(after.host)) applyHostSettings();
    refreshTray();
    pushState();
    return after;
  });
  handle('server:probe', 'main', async (e, url) => {
    const health = await serverlink.request('GET', '/api/health', null, { url: normaliseUrl(url) }).catch((err) => ({ error: err.message }));
    let cert = null;
    if (/^https:/i.test(normaliseUrl(url))) cert = await serverlink.probeCertificate(url).catch(() => null);
    return { health, cert };
  });
  handle('server:set', 'main', async (e, { url, pin }) => {
    const prev = store.getSettings().serverUrl;
    const next = url ? normaliseUrl(url) : '';
    store.setSettings({ serverUrl: next, serverCertSha256: pin || '' });
    if (prev !== next) {
      // A different server means a different ID and account.
      store.setSettings({ deviceId: '', account: null, bookVersion: 0 });
      store.setSecret('deviceSecret', null);
      store.setSecret('accountToken', null);
    }
    await ensureDevice();
    pushState();
    return state();
  });
  handle('server:info', 'main', () => api('GET', '/api/info'));

  handle('account:register', 'main', async (e, { email, name, password }) => {
    const r = await api('POST', '/api/register', { email, name, password });
    return signedIn(r);
  });
  handle('account:login', 'main', async (e, { email, password, totp }) => {
    try {
      const r = await serverlink.request('POST', '/api/login', { email, password, totp: totp || undefined });
      return signedIn(r);
    } catch (err) {
      if (err.code === 'need_totp') return { needTotp: true };
      throw new Error(errorText(err));
    }
  });
  handle('account:logout', 'main', () => {
    store.setSecret('accountToken', null);
    store.setSettings({ account: null });
    pushState();
    return true;
  });
  handle('account:logout-all', 'main', async () => {
    await api('POST', '/api/logout-everywhere');
    store.setSecret('accountToken', null);
    store.setSettings({ account: null });
    pushState();
    return true;
  });
  handle('account:me', 'main', () => api('GET', '/api/me'));
  handle('account:devices', 'main', () => api('GET', '/api/devices'));
  handle('account:attach', 'main', async () => {
    try {
      return await attachThisDevice();
    } catch (err) {
      throw new Error(errorText(err));
    }
  });
  handle('account:detach', 'main', (e, deviceId) => api('POST', '/api/devices/detach', { deviceId }));
  handle('account:rename-device', 'main', (e, deviceId, name) => api('PATCH', '/api/devices', { deviceId, name }));
  handle('account:2fa-setup', 'main', () => api('POST', '/api/2fa/setup'));
  handle('account:2fa-enable', 'main', (e, code) => api('POST', '/api/2fa/enable', { code }));
  handle('account:2fa-disable', 'main', (e, password, code) => api('POST', '/api/2fa/disable', { password, code }));
  handle('account:password', 'main', async (e, current, next) => {
    const r = await api('POST', '/api/password', { current, next });
    store.setSecret('accountToken', r.token);
    return true;
  });
  handle('account:audit', 'main', () => api('GET', '/api/audit'));

  handle('book:get', 'main', () => store.getSettings().book);
  handle('book:save', 'main', async (e, book) => {
    const clean = { folders: book.folders || [], devices: book.devices || [], removed: book.removed || [] };
    store.setSettings({ book: { folders: clean.folders, devices: clean.devices } });
    // Forget saved password keys for removed devices.
    for (const id of clean.removed) store.setSecret(`key:${id}`, null);
    return pushBook(clean);
  });
  handle('book:pull', 'main', () => pullBook().catch((err) => {
    throw new Error(errorText(err));
  }));
  handle('book:forget-password', 'main', (e, entryId) => {
    store.setSecret(`key:${entryId}`, null);
    return true;
  });
  handle('book:has-password', 'main', (e, ids) => Object.fromEntries((ids || []).map((id) => [id, !!store.getSecret(`key:${id}`)])));

  handle('lan:discover', 'main', () => lan.discover(1500));
  handle('connect', 'main', (e, opts) => openViewer(opts));
  handle('session:kick', 'main', (e, sid) => kick(sid));
  handle('open-external', 'any', (e, url) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
  });
  handle('copy', 'any', (e, text) => clipboard.writeText(String(text)));

  // ---- Android, used by both the main window (list / pair) and viewers (local devices)
  handle('android:list', 'any', () => android.list());
  handle('android:connect', 'main', (e, addr) => android.connect(String(addr)));
  handle('android:pair', 'main', (e, addr, code) => android.pair(String(addr), String(code)));
  handle('android:disconnect', 'main', (e, addr) => android.disconnect(String(addr)));
  handle('android:info', 'any', (e, serial) => android.info(String(serial)));
  handle('android:scrcpy', 'any', (e, serial) => android.launchScrcpy(String(serial)));
  handle('android:pick-adb', 'main', async () => {
    const r = await dialog.showOpenDialog(mainWin, { title: 'Find adb', properties: ['openFile'], filters: process.platform === 'win32' ? [{ name: 'adb', extensions: ['exe'] }] : [] });
    if (r.canceled || !r.filePaths[0]) return null;
    store.setSettings({ android: { adbPath: r.filePaths[0] } });
    pushState();
    return r.filePaths[0];
  });

  // ---- viewer windows
  handle('viewer:open-link', 'viewer', (e, target, mode, sid) => openViewerLink(e.sender, target, mode, String(sid).slice(0, 64)));
  handle('viewer:send', 'viewer', (e, sid, msg) => viewerLinks.get(`${e.sender.id}:${sid}`)?.send(msg));
  handle('viewer:close-link', 'viewer', (e, sid) => {
    const k = `${e.sender.id}:${sid}`;
    viewerLinks.get(k)?.close();
    viewerLinks.delete(k);
  });
  handle('viewer:key-get', 'viewer', (e, entry) => {
    const v = store.getSecret(`key:${entry}`);
    try {
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  });
  handle('viewer:key-set', 'viewer', (e, entry, value) => store.setSecret(`key:${entry}`, value ? JSON.stringify(value) : null));
  handle('viewer:clip-read', 'viewer', async () => (await readClipboard()).slice(0, 100_000));
  handle('viewer:clip-write', 'viewer', (e, text) => clipboard.writeText(String(text)));
  handle('viewer:title', 'viewer', (e, title) => viewers.get(e.sender.id)?.setTitle(String(title).slice(0, 120)));
  handle('viewer:fullscreen', 'viewer', (e, on) => {
    const w = viewers.get(e.sender.id);
    if (w) w.setFullScreen(on == null ? !w.isFullScreen() : !!on);
    return w?.isFullScreen();
  });
  handle('viewer:info', 'viewer', () => ({ name: hostName(), signedIn: !!accountToken(), os: OS_NAME }));

  handle('viewer:android-start', 'viewer', (e, serial, opts) => {
    const wcId = e.sender.id;
    const key = `${wcId}:${serial}`;
    localAndroid.get(key)?.stream.stop();
    const stream = new android.ScreenStream(String(serial), (jpeg, size) => send(viewers.get(wcId), 'viewer:android-frame', serial, jpeg, size), (err) => send(viewers.get(wcId), 'viewer:android-error', serial, err), opts || {});
    localAndroid.set(key, { stream, wcId, serial });
    stream.start();
    return true;
  });
  handle('viewer:android-opts', 'viewer', (e, serial, opts) => localAndroid.get(`${e.sender.id}:${serial}`)?.stream.setOptions(opts || {}));
  handle('viewer:android-input', 'viewer', (e, serial, msg) => {
    const s = localAndroid.get(`${e.sender.id}:${serial}`);
    android.handleInput(String(serial), s?.stream.size, msg);
  });
  handle('viewer:android-stop', 'viewer', (e, serial) => {
    const k = `${e.sender.id}:${serial}`;
    localAndroid.get(k)?.stream.stop();
    localAndroid.delete(k);
    android.stopInput(String(serial));
  });
  handle('viewer:android-term-open', 'viewer', (e, serial, cols, rows) => {
    const wcId = e.sender.id;
    const tid = `local-${wcId}-${serial}`;
    termOwners.set(tid, wcId);
    terminal.open(tid, { cols, rows, command: android.shellCommand(String(serial)) }, (d) => send(viewers.get(wcId), 'viewer:term-data', tid, d), (code) => send(viewers.get(wcId), 'viewer:term-exit', tid, code));
    return tid;
  });
  handle('viewer:term-write', 'viewer', (e, tid, d) => termOwners.get(tid) === e.sender.id && terminal.write(tid, d));
  handle('viewer:term-resize', 'viewer', (e, tid, c, r) => termOwners.get(tid) === e.sender.id && terminal.resize(tid, c, r));
  handle('viewer:term-close', 'viewer', (e, tid) => {
    if (termOwners.get(tid) === e.sender.id) {
      terminal.close(tid);
      termOwners.delete(tid);
    }
  });

  // ---- hidden host page
  handle('host:info', 'host', (e, sid) => {
    const s = hostSessions.get(sid);
    if (!s) throw new Error('no session');
    return { nonce: s.nonce, salt: hostauth.salt(), needPassword: s.needPassword, host: { name: hostName(), os: OS_NAME, id: store.getSettings().deviceId }, features: sessionFeatures(s), mode: s.mode };
  });
  handle('host:verify', 'host', (e, sid, payload) => verify(sid, payload));
  handle('host:signal', 'host', (e, sid, data) => hostSignal(sid, data));
  handle('host:pick-display', 'host', (e, sid, id) => {
    const s = hostSessions.get(sid);
    if (!s?.authed || !['desktop', 'both'].includes(s.mode)) throw new Error('Desktop was not requested for this session.');
    const list = displays();
    const chosen = list.find((d) => d.id === String(id)) || list.find((d) => d.primary) || list[0];
    s.display = chosen.id;
    nextDisplay = chosen.id;
    return chosen;
  });
  handle('host:input', 'host', (e, sid, msg) => {
    const s = hostSessions.get(sid);
    if (!s?.authed || store.getSettings().host.viewOnly) return;
    if (Array.isArray(msg) && typeof msg[0] === 'string' && msg[0].startsWith('a-')) {
      if (s.android) android.handleInput(s.android.serial, s.android.stream?.size, msg);
      return;
    }
    if (s.mode === 'terminal') return;
    input.handle(s.display, msg);
  });
  handle('host:term-open', 'host', (e, sid, opts) => {
    const s = hostSessions.get(sid);
    if (!s?.authed) throw new Error('not authorised');
    let command;
    if (opts?.android) {
      if (!features().android) throw new Error('Android access is turned off on this computer.');
      if (!['android', 'both'].includes(s.mode)) throw new Error('Android was not requested for this session.');
      command = android.shellCommand(String(opts.android));
    } else if (!store.getSettings().host.allowTerminal) throw new Error('Console access is turned off on this computer.');
    else if (!['terminal', 'both'].includes(s.mode)) throw new Error('Console was not requested for this session.');
    return terminal.open(sid, { ...opts, command }, (d) => send(hostWin, 'host:term-data', sid, d), (code) => send(hostWin, 'host:term-exit', sid, code));
  });
  handle('host:term-write', 'host', (e, sid, d) => hostSessions.get(sid)?.authed && terminal.write(sid, d));
  handle('host:term-resize', 'host', (e, sid, c, r) => hostSessions.get(sid)?.authed && terminal.resize(sid, c, r));
  handle('host:term-close', 'host', (e, sid) => terminal.close(sid));
  handle('host:clip-set', 'host', (e, sid, text) => {
    if (!hostSessions.get(sid)?.authed || !store.getSettings().host.clipboard) return;
    lastClipFromRemote = String(text);
    lastClip = lastClipFromRemote;
    clipboard.writeText(lastClipFromRemote);
  });
  handle('host:android-list', 'host', async (e, sid) => {
    if (!hostSessions.get(sid)?.authed || !features().android) return [];
    return (await android.list()).devices;
  });
  handle('host:android-start', 'host', (e, sid, serial, opts) => {
    const s = hostSessions.get(sid);
    if (!s?.authed || !features().android) throw new Error('Android access is turned off on this computer.');
    if (!['android', 'both'].includes(s.mode)) throw new Error('Android was not requested for this session.');
    s.android?.stream?.stop();
    const stream = new android.ScreenStream(String(serial), (jpeg, size) => send(hostWin, 'host:android-frame', sid, jpeg, size), (err) => send(hostWin, 'host:android-error', sid, err), opts || {});
    s.android = { serial: String(serial), stream };
    stream.start();
    log(`${s.from} opened Android device ${serial}`);
    return true;
  });
  handle('host:android-opts', 'host', (e, sid, opts) => hostSessions.get(sid)?.android?.stream?.setOptions(opts || {}));
  handle('host:android-stop', 'host', (e, sid) => {
    const s = hostSessions.get(sid);
    if (s?.android) {
      s.android.stream.stop();
      android.stopInput(s.android.serial);
      s.android = null;
    }
  });
  handle('host:closed', 'host', (e, sid) => endHostSession(sid));

  // ---- session bar
  handle('bar:kick', 'bar', (e, sid) => (sid ? kick(sid) : [...hostSessions.keys()].forEach(kick)));
  handle('bar:open', 'bar', () => showMain());
}

function normaliseUrl(u) {
  const t = String(u || '').trim().replace(/\/+$/, '');
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function signedIn(r) {
  store.setSecret('accountToken', r.token);
  store.setSettings({ account: { email: r.user.email, name: r.user.name, totp: r.user.totp, admin: r.user.admin } });
  // Attach this computer to the account and fetch the synced address book.
  attachThisDevice().catch(() => {});
  pullBook().catch(() => {});
  pushState();
  return { ok: true, user: r.user };
}

// ---------------------------------------------------------------- start up
app.whenReady().then(() => {
  store.load();
  Menu.setApplicationMenu(null);
  setupCapture();
  registerIpc();
  createHostPage();
  createMain();
  createTray();
  applyHostSettings();
  hostauth.getOneTimePassword();
  if (startHidden && !tray) mainWin.show();
});

app.on('window-all-closed', () => {
  if (!tray || !store.getSettings().host.enabled) {
    quitting = true;
    app.quit();
  }
});

app.on('before-quit', () => {
  quitting = true;
  for (const sid of [...hostSessions.keys()]) endHostSession(sid);
  lan.stop();
  deviceLink.stop();
  android.stopAll();
});
