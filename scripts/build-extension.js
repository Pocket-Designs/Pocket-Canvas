// Pocket-Canvas — package the browser extension as a .zip for any add-on store
// Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
//
//   npm run extension
//
// Produces dist/pocket-canvas-web-clipper-<version>.zip with manifest.json at the top
// level, which is what the Chrome Web Store, Microsoft Edge Add-ons, Opera add-ons and
// Firefox Add-ons (AMO) all expect. The extension's version is kept in step with the app.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.join(__dirname, '..');
const src = path.join(root, 'browser-extension');
const outDir = path.join(root, 'dist');
const version = require(path.join(root, 'package.json')).version;

// Keep the extension version the same as the app.
const manifestPath = path.join(src, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest.version !== version) {
  manifest.version = version;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Updated extension version to ${version}`);
}

const SKIP = new Set(['README.md', '.DS_Store', 'Thumbs.db']);
function listFiles(dir, base = '') {
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (SKIP.has(name) || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const rel = base ? base + '/' + name : name;
    if (fs.statSync(full).isDirectory()) out.push(...listFiles(full, rel));
    else out.push({ rel, full });
  }
  return out;
}

// --- minimal ZIP writer (deflate) ---
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

function zip(files) {
  const local = [], central = [];
  let offset = 0;
  const d = new Date();
  const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const f of files) {
    const data = fs.readFileSync(f.full);
    const comp = zlib.deflateRawSync(data, { level: 9 });
    const name = Buffer.from(f.rel, 'utf8');
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(dosTime, 10); lh.writeUInt16LE(dosDate, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    local.push(lh, name, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(dosTime, 12); ch.writeUInt16LE(dosDate, 14); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, name);
    offset += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, cd, end]);
}

const files = listFiles(src);
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `pocket-canvas-web-clipper-${version}.zip`);
fs.writeFileSync(out, zip(files));
console.log(`Built ${path.relative(root, out)} (${files.length} files)`);
