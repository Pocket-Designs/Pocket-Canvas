// Pocket-Canvas — prepares the web part of the Android, iPhone and iPad apps.
// Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
//
// Copies src/ (the same screens the desktop app uses) to build/mobile-www/ and adds
// mobile/api-mobile.js, which stands in for the desktop app's preload.js.
// Then:  npx cap sync android   or   npx cap sync ios   (see docs/ANDROID.md and docs/IOS.md)
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'build', 'mobile-www');
const version = require(path.join(root, 'package.json')).version;

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(root, 'src'), out, { recursive: true });

// the Android stand-in for preload.js, with the version filled in
const shim = fs.readFileSync(path.join(root, 'mobile', 'api-mobile.js'), 'utf8').replace(/__VERSION__/g, version);
fs.writeFileSync(path.join(out, 'api-mobile.js'), shim);

// load it before everything else
const indexFile = path.join(out, 'index.html');
let html = fs.readFileSync(indexFile, 'utf8');
const first = '<script src="merge.js"></script>';
if (!html.includes(first)) throw new Error('index.html has changed: can’t find ' + first);
html = html.replace(first, '<script src="api-mobile.js"></script>\n  ' + first);
fs.writeFileSync(indexFile, html);

console.log(`Phone and tablet app files ready in ${path.relative(root, out)} (version ${version})`);
