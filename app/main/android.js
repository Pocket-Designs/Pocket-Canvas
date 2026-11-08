// Android devices, controlled from the desktop over ADB (Android Debug Bridge).
//
//  - USB: plug the phone in with USB debugging switched on.
//  - Wi-Fi: Android 11+ "Wireless debugging" (pair once with a code, then connect), or
//    classic "adb tcpip 5555" + connect.
//
// The screen is captured with screencap and sent as JPEG frames; taps, swipes, keys and text
// go through one long-running "adb shell" per device so each action is quick. The console is
// a real "adb shell" in a terminal. If scrcpy is installed it can be launched for smooth video.
//
// A Pocket-Connect host also offers its ADB devices to remote viewers, so a phone plugged into
// a PC at home can be reached from anywhere through that PC.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFile } = require('child_process');
const { nativeImage } = require('electron');
const store = require('./store');

const EXE = process.platform === 'win32' ? '.exe' : '';

function candidates(name) {
  const list = [];
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const d of dirs) list.push(path.join(d, name + EXE));
  if (name === 'adb') {
    for (const sdk of [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT].filter(Boolean)) {
      list.push(path.join(sdk, 'platform-tools', 'adb' + EXE));
    }
    if (process.platform === 'win32') {
      list.push(path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe'));
      list.push('C:\\platform-tools\\adb.exe');
    } else {
      list.push(path.join(os.homedir(), 'Android', 'Sdk', 'platform-tools', 'adb'));
      list.push(path.join(os.homedir(), 'platform-tools', 'adb'));
      list.push('/usr/bin/adb', '/usr/local/bin/adb', '/opt/android-sdk/platform-tools/adb');
    }
  }
  if (name === 'scrcpy' && process.platform !== 'win32') list.push('/snap/bin/scrcpy', '/usr/local/bin/scrcpy');
  return list;
}

function findTool(name) {
  const custom = name === 'adb' ? store.getSettings().android?.adbPath : store.getSettings().android?.scrcpyPath;
  if (custom && fs.existsSync(custom)) return custom;
  return candidates(name).find((p) => {
    try {
      return fs.statSync(p).isFile();
    } catch {
      return false;
    }
  }) || null;
}

const adbPath = () => findTool('adb');

function run(args, { timeout = 15000, encoding = 'utf8', maxBuffer = 64 * 1024 * 1024 } = {}) {
  const adb = adbPath();
  if (!adb) return Promise.reject(new Error('ADB was not found. Install Android platform-tools, or set its location in Settings > Android.'));
  return new Promise((resolve, reject) => {
    execFile(adb, args, { timeout, encoding, maxBuffer, windowsHide: true }, (err, stdout, stderr) => {
      if (err) return reject(new Error((stderr && String(stderr).trim()) || err.message));
      resolve(stdout);
    });
  });
}

const SERIAL_RE = /^[A-Za-z0-9._:\-\[\]]{1,80}$/;
function checkSerial(serial) {
  if (!SERIAL_RE.test(String(serial || ''))) throw new Error('Not a valid device serial.');
  return serial;
}

async function list() {
  if (!adbPath()) return { adb: false, devices: [] };
  const out = await run(['devices', '-l']);
  const devices = [];
  for (const line of out.split(/\r?\n/).slice(1)) {
    const m = line.trim().match(/^(\S+)\s+(\S+)(.*)$/);
    if (!m) continue;
    const [, serial, state, rest] = m;
    const props = Object.fromEntries([...rest.matchAll(/(\w+):(\S+)/g)].map((x) => [x[1], x[2]]));
    devices.push({
      serial,
      state, // device | unauthorized | offline
      model: (props.model || '').replace(/_/g, ' '),
      product: props.product || '',
      transport: /:\d+$/.test(serial) || serial.includes('._adb-tls-connect') ? 'wifi' : 'usb',
    });
  }
  return { adb: true, devices };
}

async function info(serial) {
  checkSerial(serial);
  const [model, release, size] = await Promise.all([
    run(['-s', serial, 'shell', 'getprop', 'ro.product.model']).catch(() => ''),
    run(['-s', serial, 'shell', 'getprop', 'ro.build.version.release']).catch(() => ''),
    run(['-s', serial, 'shell', 'wm', 'size']).catch(() => ''),
  ]);
  const m = size.match(/(\d+)x(\d+)\s*$/m);
  return {
    serial,
    model: model.trim() || serial,
    android: release.trim(),
    width: m ? +m[1] : 0,
    height: m ? +m[2] : 0,
  };
}

const ADDR_RE = /^[A-Za-z0-9.\-:\[\]]{3,80}$/;
async function connect(address) {
  if (!ADDR_RE.test(address)) throw new Error('Enter an address like 192.168.1.50:5555');
  const out = await run(['connect', address], { timeout: 20000 });
  if (/fail|cannot|unable/i.test(out)) throw new Error(out.trim());
  return out.trim();
}

async function pair(address, code) {
  if (!ADDR_RE.test(address)) throw new Error('Enter the pairing address shown on the phone, like 192.168.1.50:37123');
  if (!/^\d{6}$/.test(String(code))) throw new Error('The pairing code is 6 digits.');
  const out = await run(['pair', address, String(code)], { timeout: 30000 });
  if (!/success/i.test(out)) throw new Error(out.trim() || 'Pairing failed.');
  return out.trim();
}

async function disconnect(address) {
  if (!ADDR_RE.test(address)) throw new Error('Bad address');
  return (await run(['disconnect', address])).trim();
}

// ---------------------------------------------------------------- screen stream
// Captures frames as fast as the device allows (usually 2–8 per second over USB), scales them
// down and encodes JPEG so they are small enough for remote viewing.
class ScreenStream {
  constructor(serial, onFrame, onError, { maxWidth = 720, quality = 70 } = {}) {
    this.serial = checkSerial(serial);
    this.onFrame = onFrame;
    this.onError = onError;
    this.maxWidth = maxWidth;
    this.quality = quality;
    this.running = false;
    this.size = { width: 0, height: 0 };
    this.lastHash = 0;
  }

  setOptions({ maxWidth, quality }) {
    if (maxWidth) this.maxWidth = Math.max(240, Math.min(2000, maxWidth | 0));
    if (quality) this.quality = Math.max(20, Math.min(95, quality | 0));
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.fails = 0;
    this.loop();
  }

  async loop() {
    while (this.running) {
      const t0 = Date.now();
      try {
        const png = await run(['-s', this.serial, 'exec-out', 'screencap', '-p'], { encoding: 'buffer', timeout: 10000 });
        if (!this.running) break;
        const img = nativeImage.createFromBuffer(png);
        if (img.isEmpty()) throw new Error('The device returned an empty screen. Is it locked with a secure-screen app open?');
        const size = img.getSize();
        this.size = size;
        const scaled = size.width > this.maxWidth ? img.resize({ width: this.maxWidth, quality: 'good' }) : img;
        const jpeg = scaled.toJPEG(this.quality);
        // Skip sending identical frames (screen not changing) to save bandwidth.
        const hash = quickHash(jpeg);
        if (hash !== this.lastHash || Date.now() - (this.lastSent || 0) > 3000) {
          this.lastHash = hash;
          this.lastSent = Date.now();
          this.onFrame(jpeg, size);
        }
        this.fails = 0;
      } catch (e) {
        if (!this.running) break;
        if (++this.fails >= 3) {
          this.running = false;
          this.onError(e.message);
          break;
        }
      }
      const spent = Date.now() - t0;
      if (spent < 90) await sleep(90 - spent);
    }
  }

  stop() {
    this.running = false;
  }
}

function quickHash(buf) {
  let h = buf.length;
  const step = Math.max(1, Math.floor(buf.length / 2048));
  for (let i = 0; i < buf.length; i += step) h = (h * 31 + buf[i]) | 0;
  return h;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- input
// One persistent shell per device; each action is one "input ..." line.
const shells = new Map(); // serial -> child

function inputShell(serial) {
  let sh = shells.get(serial);
  if (sh && !sh.killed && sh.exitCode === null) return sh;
  const adb = adbPath();
  if (!adb) throw new Error('ADB not found');
  sh = spawn(adb, ['-s', serial, 'shell'], { stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true });
  sh.on('exit', () => shells.get(serial) === sh && shells.delete(serial));
  sh.on('error', () => shells.delete(serial));
  shells.set(serial, sh);
  return sh;
}

const KEYS = {
  back: 4, home: 3, recents: 187, power: 26, volup: 24, voldown: 25, enter: 66, del: 67,
  tab: 61, escape: 111, up: 19, down: 20, left: 21, right: 22, menu: 82, forwardDel: 112,
  wake: 224, sleep: 223, notifications: 83, screenshot: 120, playpause: 85,
};

function shellQuote(text) {
  return `'${String(text).replace(/'/g, `'\\''`)}'`;
}

// size: the device's current screen size in pixels (from the latest frame)
function handleInput(serial, size, msg) {
  if (!Array.isArray(msg)) return;
  checkSerial(serial);
  const w = size?.width || 0;
  const h = size?.height || 0;
  const px = (nx) => Math.round(Math.max(0, Math.min(1, Number(nx) || 0)) * (w - 1));
  const py = (ny) => Math.round(Math.max(0, Math.min(1, Number(ny) || 0)) * (h - 1));
  let line = null;
  switch (msg[0]) {
    case 'a-tap':
      if (w) line = `input tap ${px(msg[1])} ${py(msg[2])}`;
      break;
    case 'a-swipe': {
      const ms = Math.max(10, Math.min(5000, Number(msg[5]) | 0 || 200));
      if (w) line = `input swipe ${px(msg[1])} ${py(msg[2])} ${px(msg[3])} ${py(msg[4])} ${ms}`;
      break;
    }
    case 'a-key': {
      const code = KEYS[msg[1]] ?? (Number.isInteger(msg[1]) && msg[1] >= 0 && msg[1] < 400 ? msg[1] : null);
      if (code != null) line = `input keyevent ${code}`;
      break;
    }
    case 'a-text': {
      const t = String(msg[1] || '').slice(0, 500).replace(/[\r\n]/g, '');
      // "input text" uses %s for spaces.
      if (t) line = `input text ${shellQuote(t.replace(/%/g, '\\%').replace(/ /g, '%s'))}`;
      break;
    }
    default:
  }
  if (!line) return;
  try {
    inputShell(serial).stdin.write(`${line}\n`);
  } catch (e) {
    console.warn('android input:', e.message);
  }
}

function stopInput(serial) {
  const sh = shells.get(serial);
  if (sh) {
    shells.delete(serial);
    try {
      sh.stdin.end('exit\n');
      sh.kill();
    } catch {}
  }
}

// Console: the terminal module runs this command inside a pseudo-terminal.
function shellCommand(serial) {
  const adb = adbPath();
  if (!adb) throw new Error('ADB was not found on this computer.');
  return { file: adb, args: ['-s', checkSerial(serial), 'shell'] };
}

function launchScrcpy(serial) {
  const exe = findTool('scrcpy');
  if (!exe) throw new Error('scrcpy is not installed. Get it from github.com/Genymobile/scrcpy for smooth, full-speed video.');
  const env = { ...process.env };
  const adb = adbPath();
  if (adb) env.ADB = adb;
  const child = spawn(exe, ['-s', checkSerial(serial), '--window-title', `Pocket-Connect – ${serial}`], { detached: true, stdio: 'ignore', env, windowsHide: false });
  child.unref();
  return true;
}

function stopAll() {
  for (const s of [...shells.keys()]) stopInput(s);
}

module.exports = {
  adbPath, findTool, list, info, connect, pair, disconnect, ScreenStream, handleInput, stopInput, stopAll, shellCommand, launchScrcpy, KEYS,
};
