// Pocket-Canvas — prepares the browser version that a Pocket-Canvas Server serves at its address.
// Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
//
// Copies src/ (the same screens the desktop app uses) to build/web/ (or the folder given as the first
// argument) and adds web/api-web.js, which stands in for the desktop app's preload.js.
// The server finds build/web on its own when run from this repository; the Docker image builds it.
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.resolve(process.argv[2] || path.join(root, 'build', 'web'));
const version = require(path.join(root, 'package.json')).version;

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(root, 'src'), out, { recursive: true });

const shim = fs.readFileSync(path.join(root, 'web', 'api-web.js'), 'utf8').replace(/__VERSION__/g, version);
fs.writeFileSync(path.join(out, 'api-web.js'), shim);

const indexFile = path.join(out, 'index.html');
let html = fs.readFileSync(indexFile, 'utf8');
const first = '<script src="merge.js"></script>';
if (!html.includes(first)) throw new Error('index.html has changed: can’t find ' + first);
html = html.replace(first, '<script src="api-web.js"></script>\n  ' + first);
// a browser tab shows the app's name and icon
html = html.replace('<title>Pocket-Canvas</title>', '<title>Pocket-Canvas</title>\n  <link rel="icon" href="icon.png">');
fs.writeFileSync(indexFile, html);

console.log(`Browser version ready in ${path.relative(root, out) || out} (version ${version})`);
