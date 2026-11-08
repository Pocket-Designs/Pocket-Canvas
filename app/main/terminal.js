// Remote console: a real pseudo-terminal on the host (PowerShell / cmd on Windows, the user's
// shell on Linux), streamed over the encrypted WebRTC data channel.
const os = require('os');
const fs = require('fs');

let pty = null;
let loadError = null;
try {
  pty = require('node-pty');
} catch (err) {
  loadError = err;
}

const terms = new Map(); // sid -> pty process
const store = () => require('./store');

function defaultShell(preferred) {
  if (preferred) return { file: preferred, args: [] };
  if (process.platform === 'win32') {
    const pwsh = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';
    if (fs.existsSync(pwsh)) return { file: pwsh, args: ['-NoLogo'] };
    return { file: 'powershell.exe', args: ['-NoLogo'] };
  }
  const sh = process.env.SHELL && fs.existsSync(process.env.SHELL) ? process.env.SHELL : '/bin/bash';
  return { file: fs.existsSync(sh) ? sh : '/bin/sh', args: ['-l'] };
}

function shellChoices() {
  if (process.platform === 'win32') {
    return [
      { id: 'powershell', label: 'PowerShell', file: 'powershell.exe' },
      { id: 'cmd', label: 'Command Prompt', file: 'cmd.exe' },
    ];
  }
  const list = [];
  for (const f of ['/bin/bash', '/usr/bin/zsh', '/usr/bin/fish', '/bin/sh']) if (fs.existsSync(f)) list.push({ id: f, label: f.split('/').pop(), file: f });
  return list;
}

// command: optional { file, args } to run instead of a shell (used for "adb shell").
function open(sid, { cols, rows, shell, command }, onData, onExit) {
  if (!pty) throw new Error(`Console is unavailable on this host: ${loadError && loadError.message}`);
  close(sid);
  const choice = shellChoices().find((s) => s.id === shell);
  const sh = command || (choice ? { file: choice.file, args: [] } : defaultShell(store().getSettings().host.shell));
  const p = pty.spawn(sh.file, sh.args, {
    name: 'xterm-256color',
    cols: Math.max(20, Math.min(500, cols | 0 || 100)),
    rows: Math.max(5, Math.min(300, rows | 0 || 30)),
    cwd: os.homedir(),
    env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', POCKET_CONNECT: '1' },
    useConpty: true,
  });
  p.onData(onData);
  p.onExit(({ exitCode }) => {
    terms.delete(sid);
    onExit(exitCode);
  });
  terms.set(sid, p);
  return { shell: sh.file };
}

function write(sid, data) {
  const p = terms.get(sid);
  if (p && typeof data === 'string') p.write(data);
}

function resize(sid, cols, rows) {
  const p = terms.get(sid);
  if (p) p.resize(Math.max(20, Math.min(500, cols | 0)), Math.max(5, Math.min(300, rows | 0)));
}

function close(sid) {
  const p = terms.get(sid);
  if (p) {
    terms.delete(sid);
    try {
      p.kill();
    } catch {}
  }
}

module.exports = { open, write, resize, close, shellChoices, available: () => !!pty };
