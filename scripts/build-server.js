// Pocket-Canvas — packs the Pocket-Canvas Server, with the browser version built in, into one zip
// for installing without Docker (see server/README.md, option B).
// Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
//   node scripts/build-server.js   →   dist/Pocket-Canvas-Server-<version>.zip
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const version = require(path.join(root, 'package.json')).version;
const stage = path.join(root, 'build', 'server-zip');
const dir = path.join(stage, 'Pocket-Canvas-Server');
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(path.join(dir, 'lib'), { recursive: true });
for (const f of ['pocket-canvas-server.js', 'package.json', 'package-lock.json', 'README.md']) {
  if (fs.existsSync(path.join(root, 'server', f))) fs.copyFileSync(path.join(root, 'server', f), path.join(dir, f));
}
fs.copyFileSync(path.join(root, 'lib', 'link-preview.js'), path.join(dir, 'lib', 'link-preview.js'));
execFileSync(process.execPath, [path.join(root, 'scripts', 'build-web.js'), path.join(dir, 'public')], { stdio: 'inherit' });
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', `Pocket-Canvas-Server-${version}.zip`);
fs.rmSync(out, { force: true });
execFileSync('zip', ['-qr', out, 'Pocket-Canvas-Server'], { cwd: stage });
console.log('Server package ready: ' + path.relative(root, out));
