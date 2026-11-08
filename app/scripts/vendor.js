// Copies browser libraries and fonts into ui/vendor so the UI works offline and the same
// files can be bundled into the Android app.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'ui', 'vendor');
fs.mkdirSync(path.join(out, 'fonts'), { recursive: true });

const copy = (from, to) => {
  const src = path.join(root, 'node_modules', from);
  if (!fs.existsSync(src)) return console.warn('vendor: missing', from);
  fs.copyFileSync(src, path.join(out, to));
};

copy('@xterm/xterm/lib/xterm.js', 'xterm.js');
copy('@xterm/xterm/css/xterm.css', 'xterm.css');
copy('@xterm/addon-fit/lib/addon-fit.js', 'addon-fit.js');
copy('scrypt-js/scrypt.js', 'scrypt.js');
copy('qrcode-generator/qrcode.js', 'qrcode.js');
for (const [pkg, files] of [
  ['manrope', ['manrope-latin-400-normal.woff2', 'manrope-latin-600-normal.woff2', 'manrope-latin-800-normal.woff2']],
  ['jetbrains-mono', ['jetbrains-mono-latin-400-normal.woff2', 'jetbrains-mono-latin-600-normal.woff2']],
]) {
  for (const f of files) copy(`@fontsource/${pkg}/files/${f}`, `fonts/${f}`);
}
console.log('vendor: UI libraries copied');
