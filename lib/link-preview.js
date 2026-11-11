// Pocket-Canvas — link previews (title, description, picture) and downloads
// Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
'use strict';
// Electron's network stack in the desktop app; Node's fetch elsewhere (the Pocket-Canvas Server).
let net = null;
try { const e = require('electron'); if (e && typeof e === 'object' && e.net) net = e.net; } catch {}
let fetchImpl = (url, opts) => (net ? net.fetch(url, opts) : fetch(url, opts));
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Pocket-Canvas';
const MAX_HTML = 1.5 * 1024 * 1024;

const isWeb = (u) => { try { return /^https?:$/.test(new URL(u).protocol); } catch { return false; } };

async function fetchWithTimeout(url, ms, opts = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetchImpl(url, { redirect: 'follow', signal: ctl.signal, headers: { 'User-Agent': UA, Accept: opts.accept || '*/*' } });
  } finally { clearTimeout(t); }
}

// Read at most `limit` bytes of a response body.
async function readLimited(res, limit) {
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) { try { reader.cancel(); } catch {} return null; }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

async function readTextHead(res, limit) {
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value));
    total += value.length;
    if (total >= limit) { try { reader.cancel(); } catch {} break; }
  }
  return Buffer.concat(chunks).toString('utf8');
}

const decode = (s) => String(s || '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

function attrs(tag) {
  const out = {};
  tag.replace(/([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g, (_, k, _v, a, b, c) => { out[k.toLowerCase()] = a ?? b ?? c ?? ''; });
  return out;
}

function parseHtml(html, baseUrl) {
  const head = html.slice(0, 400000);
  const meta = {};
  for (const m of head.match(/<meta\b[^>]*>/gi) || []) {
    const a = attrs(m);
    const key = (a.property || a.name || a.itemprop || '').toLowerCase();
    if (key && a.content != null && !(key in meta)) meta[key] = a.content;
  }
  let icon = null;
  for (const l of head.match(/<link\b[^>]*>/gi) || []) {
    const a = attrs(l);
    if (/(^|\s)(icon|apple-touch-icon)(\s|$)/i.test(a.rel || '') && a.href) { icon = a.href; if (/apple/i.test(a.rel)) break; }
  }
  const titleTag = (head.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
  const abs = (u) => { try { return u ? new URL(decode(u), baseUrl).href : null; } catch { return null; } };
  return {
    title: decode(meta['og:title'] || meta['twitter:title'] || titleTag || ''),
    description: decode(meta['og:description'] || meta['twitter:description'] || meta.description || '').slice(0, 400),
    siteName: decode(meta['og:site_name'] || ''),
    image: abs(meta['og:image:secure_url'] || meta['og:image'] || meta['og:image:url'] || meta['twitter:image'] || meta['twitter:image:src']),
    icon: abs(icon) || abs('/favicon.ico')
  };
}

const EXT_BY_TYPE = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg',
  'image/x-icon': '.ico', 'image/vnd.microsoft.icon': '.ico', 'image/avif': '.avif', 'image/bmp': '.bmp',
  'audio/mpeg': '.mp3', 'audio/mp4': '.m4a', 'audio/ogg': '.ogg', 'audio/wav': '.wav', 'audio/x-wav': '.wav', 'audio/webm': '.weba', 'audio/flac': '.flac', 'audio/aac': '.aac',
  'video/mp4': '.mp4', 'video/webm': '.webm', 'video/ogg': '.ogv', 'video/quicktime': '.mov'
};

// Download a URL into the assets folder. Returns { id, name, size, type } or null.
async function downloadAsset(url, assetDir, { maxBytes = 25 * 1024 * 1024, accept = /^(image|audio|video)\//, timeout = 20000 } = {}) {
  if (!isWeb(url)) return null;
  const res = await fetchWithTimeout(url, timeout);
  if (!res.ok) return null;
  const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (accept && !accept.test(type)) return null;
  const len = +res.headers.get('content-length') || 0;
  if (len > maxBytes) return null;
  const buf = await readLimited(res, maxBytes);
  if (!buf || !buf.length) return null;
  let name = '';
  try { name = decodeURIComponent(path.basename(new URL(res.url || url).pathname)) || ''; } catch {}
  let ext = (path.extname(name) || EXT_BY_TYPE[type] || '').toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 6);
  if (!ext) ext = '.bin';
  const id = crypto.randomBytes(8).toString('hex') + ext;
  fs.writeFileSync(path.join(assetDir, id), buf);
  return { id, name: name || 'download' + ext, size: buf.length, type };
}

async function linkPreview(url, assetDir, options = {}) {
  if (!isWeb(url)) return null;
  if (options.fetch) fetchImpl = options.fetch;
  const res = await fetchWithTimeout(url, 10000, { accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' });
  if (!res.ok) return { error: `The website answered ${res.status}` };
  const type = (res.headers.get('content-type') || '').toLowerCase();
  const finalUrl = res.url || url;
  // A direct link to a picture: use it as the preview.
  if (type.startsWith('image/')) {
    try { res.body.cancel(); } catch {}
    const img = await downloadAsset(finalUrl, assetDir, { maxBytes: 10 * 1024 * 1024, accept: /^image\// }).catch(() => null);
    return { title: path.basename(new URL(finalUrl).pathname), description: '', siteName: new URL(finalUrl).hostname, image: img && img.id };
  }
  if (!type.includes('html')) { try { res.body.cancel(); } catch {} return { title: '', description: '', siteName: '' }; }
  const html = await readTextHead(res, MAX_HTML);
  const p = parseHtml(html, finalUrl);
  const out = { title: p.title, description: p.description, siteName: p.siteName, image: null, icon: null };
  const [img, icon] = await Promise.all([
    p.image ? downloadAsset(p.image, assetDir, { maxBytes: 8 * 1024 * 1024, accept: /^image\// }).catch(() => null) : null,
    p.icon ? downloadAsset(p.icon, assetDir, { maxBytes: 300 * 1024, accept: /^image\//, timeout: 6000 }).catch(() => null) : null
  ]);
  if (img) out.image = img.id;
  if (icon) out.icon = icon.id;
  return out;
}

module.exports = { linkPreview, downloadAsset, parseHtml, isWeb };
