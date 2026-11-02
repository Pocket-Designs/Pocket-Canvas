// Pocket-Canvas — tests the Android app's screens in Chromium, with a stand-in for the phone.
// Copyright (c) 2026 project-tech-me <project-tech-me@protonmail.com>
//
// Builds build/mobile-www (exactly what goes into the Android, iPhone and iPad apps), then runs it in a phone-sized,
// touch-screen Chromium window. Capacitor's native plugins are replaced by a pretend phone
// (an in-memory file system), so saving, sync, touch gestures and the Back button can be checked
// without an Android device. The real APK is built by GitHub Actions (see docs/ANDROID.md).
//   npm run test:mobile      (needs:  npm install --no-save playwright  &&  npx playwright install chromium)
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
const { execFileSync } = require('child_process');

let chromium;
try { ({ chromium } = require('playwright')); } catch {
  console.log('SKIP  Playwright is not installed. Run: npm install --no-save playwright && npx playwright install chromium');
  process.exit(0);
}

const root = path.join(__dirname, '..');
const www = path.join(root, 'build', 'mobile-www');
const results = [];
const check = (name, ok) => { results.push({ name, ok: !!ok }); if (process.env.PC_VERBOSE) console.log((ok ? 'pass  ' : 'FAIL  ') + name); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The pretend phone: Capacitor plugins backed by an in-memory file system.
const FAKE_PHONE = `(() => {
  const files = new Map();   // path -> { data, b64, mtime }
  const dirs = new Set(['/']);
  const norm = (p) => decodeURIComponent(String(p).replace(/^file:\\/\\//, '')).replace(/\\/+$/, '') || '/';
  const parent = (p) => p.slice(0, p.lastIndexOf('/')) || '/';
  const mkdirs = (p) => { while (p && p !== '/') { dirs.add(p); p = parent(p); } };
  const fail = (m) => { throw new Error(m); };
  const listeners = {};
  window.__phone = { files, dirs, listeners, shared: [], opened: [] };
  const FS = {
    getUri: async ({ directory }) => ({ uri: directory === 'CACHE' ? 'file:///data/app/cache' : 'file:///data/app/files' }),
    readFile: async ({ path }) => { const f = files.get(norm(path)); if (!f) fail('File does not exist'); return { data: f.data }; },
    writeFile: async ({ path, data, encoding }) => { const p = norm(path); mkdirs(parent(p)); files.set(p, { data, b64: !encoding, mtime: Date.now() + Math.random() }); return { uri: 'file://' + p }; },
    mkdir: async ({ path }) => { const p = norm(path); if (dirs.has(p)) fail('exists'); mkdirs(p); },
    readdir: async ({ path }) => {
      const p = norm(path); if (!dirs.has(p)) fail('Directory does not exist');
      const out = [];
      for (const [k, f] of files) if (parent(k) === p) out.push({ name: k.slice(p.length + 1), type: 'file', size: f.data.length, mtime: f.mtime, uri: 'file://' + k });
      for (const d of dirs) if (d !== p && parent(d) === p) out.push({ name: d.slice(p.length + 1), type: 'directory', size: 0, mtime: 0, uri: 'file://' + d });
      return { files: out };
    },
    stat: async ({ path }) => { const p = norm(path); const f = files.get(p); if (f) return { type: 'file', size: f.data.length, mtime: f.mtime, uri: 'file://' + p }; if (dirs.has(p)) return { type: 'directory', size: 0, mtime: 0 }; fail('Does not exist'); },
    rename: async ({ from, to }) => { const a = norm(from), b = norm(to); const f = files.get(a); if (!f) fail('missing'); files.delete(a); f.mtime = Date.now() + Math.random(); files.set(b, f); },
    copy: async ({ from, to }) => { const f = files.get(norm(from)); if (!f) fail('missing'); mkdirs(parent(norm(to))); files.set(norm(to), { ...f, mtime: Date.now() + Math.random() }); },
    deleteFile: async ({ path }) => { if (!files.delete(norm(path))) fail('missing'); },
    requestPermissions: async () => ({ publicStorage: 'granted' })
  };
  window.Capacitor = {
    isNativePlatform: () => true,
    convertFileSrc: (u) => 'https://localhost/_capacitor_file_' + norm(u) + (String(u).endsWith('/') ? '/' : ''),
    Plugins: {
      Filesystem: FS,
      // Android's folder picker: the person picks /storage/emulated/0/Syncthing/Boards
      SyncFolder: (() => {
        const TREE = '/storage/emulated/0/Syncthing/Boards';
        const p = (o) => TREE + (o.path ? '/' + String(o.path).split('/').filter(Boolean).join('/') : '');
        return {
          pick: async () => (window.__phone.pickCancel ? { canceled: true } : { uri: 'content://com.android.externalstorage.documents/tree/primary%3ASyncthing%2FBoards', name: 'Boards' }),
          check: async () => ({ ok: true }),
          list: async (o) => ({ files: (await FS.readdir({ path: p(o) }).catch(() => ({ files: [] }))).files.map((f) => ({ name: f.name, size: f.size, mtime: f.mtime, dir: f.type === 'directory' })) }),
          stat: async (o) => { try { const st = await FS.stat({ path: p(o) }); return { exists: true, size: st.size, mtime: st.mtime, dir: st.type === 'directory' }; } catch { return { exists: false }; } },
          read: async (o) => ({ data: (await FS.readFile({ path: p(o) })).data }),
          write: async (o) => { await FS.writeFile({ path: p(o), data: o.data, encoding: o.encoding || 'utf8' }); },
          mkdir: async (o) => { mkdirs(p(o)); },
          delete: async (o) => { files.delete(p(o)); },
          copyIn: async (o) => { await FS.copy({ from: o.from, to: p(o) }); },
          copyOut: async (o) => { await FS.copy({ from: p(o), to: o.to }); }
        };
      })(),
      App: { addListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); return { remove() {} }; }, exitApp: () => { window.__phone.exited = true; } },
      Share: { share: async (o) => { window.__phone.shared.push(o); } },
      Browser: { open: async ({ url }) => { window.__phone.opened.push(url); } },
      CapacitorHttp: { request: async ({ url, responseType }) => responseType === 'text'
        ? { status: 200, url, headers: { 'Content-Type': 'text/html' }, data: '<html><head><title>Garden ideas</title><meta property="og:description" content="Plant lavender"></head></html>' }
        : { status: 404, headers: {}, data: '' } }
    }
  };
})();`;

(async () => {
  execFileSync(process.execPath, [path.join(root, 'scripts', 'build-mobile-web.js')], { stdio: 'inherit' });
  const server = http.createServer((req, res) => {
    const p = path.join(www, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(www) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' }[path.extname(p)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type }); fs.createReadStream(p).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const URL_ = `http://127.0.0.1:${server.address().port}/index.html`;

  const browser = await chromium.launch(process.env.PC_CHROMIUM ? { executablePath: process.env.PC_CHROMIUM } : {});
  const errors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await ctx.addInitScript(FAKE_PHONE);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/_capacitor_file_|Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.goto(URL_);
    await page.waitForFunction(() => typeof store !== 'undefined' && store && document.querySelectorAll('#rail .tool').length > 0, null, { timeout: 20000 });
    await sleep(500);
    const ex = (fn, arg) => page.evaluate(fn, arg);
    const shot = async (name) => { if (process.env.SHOT_DIR) await page.screenshot({ path: path.join(process.env.SHOT_DIR, name) }); };

    // ---------- start-up ----------
    check('android: the app starts with the phone stand-in', await ex(() => api.platform === 'android' && api.mobile && document.documentElement.classList.contains('mobile')));
    check('android: a first board is made on first start', await ex(() => !!store.boards[store.root] && Object.keys(B().cards).length >= 6));
    check('android: the sidebar starts closed on a phone', await ex(() => document.querySelector('#app').classList.contains('no-sidebar')));
    check('android: there is a ⋮ menu instead of a menu bar', await ex(() => !!document.querySelector('#more-btn')));
    await shot('android-home.png');

    // ---------- saving ----------
    await ex(() => { addCard('note', { x: 60, y: 60 }); flushSave(); });
    await sleep(400);
    const saved = await ex(() => { const f = __phone.files.get('/data/app/files/Pocket-Canvas/pocket-canvas-data.json'); return f && JSON.parse(f.data); });
    check('android: boards are saved in the app’s own storage', saved && saved.boards && Object.values(saved.boards[saved.root].cards).length >= 7);
    check('android: settings are kept on the phone', await ex(() => __phone.files.has('/data/app/files/Pocket-Canvas/settings.json')));
    const id = await ex(() => api.saveBytes('photo.png', new Uint8Array([137, 80, 78, 71])));
    check('android: pictures are stored as files', await ex((i) => { const f = __phone.files.get('/data/app/files/Pocket-Canvas/assets/' + i); return !!f && f.b64 && atob(f.data).charCodeAt(1) === 80; }, id));
    check('android: pictures are shown from app storage', await ex(() => assetBase.startsWith('https://localhost/_capacitor_file_/data/app/files/Pocket-Canvas/assets/')));

    // ---------- the menu ----------
    await page.tap('#more-btn'); await sleep(200);
    const menu = await ex(() => [...document.querySelectorAll('#ctx button')].map((b) => b.textContent));
    check('android: the ⋮ menu has templates, recycle bin and settings', ['New board from a template…', 'Recycle bin', 'Settings'].every((t) => menu.includes(t)));
    await shot('android-menu.png');
    await ex(() => hideMenu());

    // ---------- settings ----------
    await ex(() => openSettings()); await sleep(300);
    const tabs = await ex(() => [...document.querySelectorAll('.set-tabs button')].map((b) => b.textContent));
    check('android: settings show General, Appearance, Sync and Server', tabs.join() === 'General,Appearance,Sync,Server');
    await ex(() => openSettings('sync')); await sleep(300);
    check('android: sync settings explain using a sync app such as Syncthing', await ex(() => /Syncthing/.test(document.querySelector('.set-pane').textContent)));
    await shot('android-sync-settings.png');

    // ---------- sync ----------
    await ex(() => settingsModal && settingsModal.close());
    await ex(() => { __phone.pickCancel = true; });
    check('android: cancelling the folder picker leaves sync off', await ex(async () => { const r = await api.syncChoose(); return r.canceled === true && !(await api.syncStatus()).enabled; }));
    await ex(() => { __phone.pickCancel = false; });
    const choose = ex(() => api.syncChoose()).catch((e) => ({ error: e.message }));
    const st = await choose;
    check('android: sync is switched on with Android’s folder picker (no “All files access”)', st && st.enabled && st.folder === 'Boards › Pocket-Canvas Sync');
    await ex(() => { addCard('note', { x: 400, y: 60 }); flushSave(); });
    await sleep(600);
    const own = await ex(() => [...__phone.files.keys()].find((k) => /Pocket-Canvas Sync\/devices\/[0-9a-f]+\.json$/.test(k)));
    check('android: this phone writes its own file in the sync folder', !!own);
    check('android: pictures are copied to the sync folder', await ex((i) => __phone.files.has('/storage/emulated/0/Syncthing/Boards/Pocket-Canvas Sync/assets/' + i), id));

    // a computer adds a card; the phone picks it up
    await ex(() => {
      const state = PCSync.syncState(JSON.parse(JSON.stringify(store)));
      const b = state.boards[state.root];
      b.cards.fromdesktop1 = { id: 'fromdesktop1', type: 'note', x: 700, y: 400, w: 240, color: null, html: '<p>Written on the desktop</p>', _mt: Date.now() + 1000 };
      b.order.push('fromdesktop1');
      const doc = { format: 1, app: 'Pocket-Canvas', deviceId: 'desktop0000001', deviceName: 'My PC', savedAt: Date.now(), state };
      const dir = '/storage/emulated/0/Syncthing/Boards/Pocket-Canvas Sync';
      __phone.files.set(dir + '/devices/desktop0000001.json', { data: JSON.stringify(doc), mtime: Date.now() });
      __phone.files.set(dir + '/assets/desktopphoto.jpg', { data: btoa('jpgdata'), b64: true, mtime: Date.now() });
    });
    let got = false;
    for (let i = 0; i < 40 && !got; i++) { await sleep(250); got = await ex(() => !!(store.boards[store.root].cards.fromdesktop1)); }
    check('android: a card written on a computer appears on the phone', got);
    check('android: pictures from the computer are copied to the phone', await ex(() => __phone.files.has('/data/app/files/Pocket-Canvas/assets/desktopphoto.jpg')));
    check('android: sync status lists the computer', await ex(async () => (await api.syncStatus()).devices.some((d) => d.name === 'My PC')));

    // ---------- link previews and sharing ----------
    const pv = await ex(() => api.linkPreview('https://example.com/garden'));
    check('android: link previews fetch the page title', pv && pv.title === 'Garden ideas' && pv.description === 'Plant lavender');
    await ex(() => api.openLink('https://example.com/'));
    check('android: links open in the browser', await ex(() => __phone.opened.includes('https://example.com/')));
    await ex(() => exportMarkdown()); await sleep(200);
    check('android: “Share board as Markdown” hands a file to Android’s share sheet', await ex(() => __phone.shared.length === 1 && /\.md$/.test(__phone.shared[0].files[0])));

    // ---------- export as picture or PDF ----------
    const png = await ex(async () => { __phone.shared = []; const r = await api.exportVisual({ boardId: cur, title: 'Home', format: 'png', quality: 'standard', background: 'board' }); const f = __phone.files.get(String(__phone.shared[0].files[0]).replace('file://', '')); return { r, sig: f && atob(f.data).slice(1, 4), n: __phone.shared.length }; });
    check('android: a board can be exported as a picture and shared', png.r.ok && png.sig === 'PNG' && png.n === 1);
    const pdf = await ex(async () => { __phone.shared = []; const r = await api.exportVisual({ boardId: cur, title: 'Home', format: 'pages', paper: 'A4', orientation: 'portrait', background: 'white' }); const f = __phone.files.get(String(__phone.shared[0].files[0]).replace('file://', '')); const t = atob(f.data); return { r, head: t.slice(0, 5), pages: (t.match(/\/Type \/Page /g) || []).length, a4: /\/MediaBox \[0 0 595\.\d+ 841\.\d+\]/.test(t) }; });
    check('android: a board can be exported as A4 PDF pages', pdf.r.ok && pdf.head === '%PDF-' && pdf.pages === pdf.r.pages && pdf.a4);
    check('android: exporting leaves the board as it was', await ex(() => !document.documentElement.classList.contains('export-paged') && Object.keys(B().cards).length > 5));
    // page guides on a phone
    await ex(() => setPageSetup({ show: true, paper: 'A4', landscape: false, scale: 1 })); await sleep(300);
    check('android: page guides can be shown from the ⋮ menu', await ex(() => { document.querySelector('#more-btn').click(); const b = [...document.querySelectorAll('#ctx button')].find((x) => x.textContent.includes('Page guides')); if (b) b.click(); const ok = !!b && [...document.querySelectorAll('#ctx button')].some((x) => x.textContent.includes('Show page guides')); hideMenu(); return ok && document.querySelectorAll('#page-guides .pg-page').length > 0; }));
    const gpdf = await ex(async () => { __phone.shared = []; const want = planGuidePages(pageSetup(), boardShapes()).printed; const r = await api.exportVisual({ boardId: cur, title: 'Guides', format: 'pages', layout: 'guides', paper: 'A4', orientation: 'portrait', background: 'white' }); const f = __phone.files.get(String(__phone.shared[0].files[0]).replace('file://', '')); const t = atob(f.data); return { r, want, pages: (t.match(/\/Type \/Page /g) || []).length, a4: /\/MediaBox \[0 0 595\.\d+ 841\.\d+\]/.test(t) }; });
    check('android: “Follow the page guides” prints the pages shown on the board', gpdf.r.ok && gpdf.pages === gpdf.want && gpdf.r.pages === gpdf.want && gpdf.a4);
    check('android: the guides stay on the board after exporting', await ex(() => document.querySelectorAll('#page-guides .pg-page').length > 0 && pageSetup().show));
    await ex(() => setPageSetup({ show: false }));
    if (process.env.SHOT_DIR) {
      const b64 = await ex(() => { const k = [...__phone.files.keys()].find((x) => x.endsWith('Home.png')); return __phone.files.get(k).data; });
      fs.writeFileSync(path.join(process.env.SHOT_DIR, 'android-export.png'), Buffer.from(b64, 'base64'));
      const pb = await ex(() => { const k = [...__phone.files.keys()].find((x) => x.endsWith('Home.pdf')); return __phone.files.get(k).data; });
      fs.writeFileSync(path.join(process.env.SHOT_DIR, 'android-export.pdf'), Buffer.from(pb, 'base64'));
    }

    // ---------- touch ----------
    await ex(() => { go(store.root); B().view = { x: -200, y: -200, z: 1 }; applyView(); });
    const empty = await ex(() => {
      const r = document.querySelector('#viewport').getBoundingClientRect();
      for (let y = r.top + 40; y < r.bottom - 40; y += 20) for (let x = r.left + 30; x < r.right - 30; x += 20) {
        const e = document.elementFromPoint(x, y); if (e && e.id === 'viewport') return [x, y];
      }
      return null;
    });
    const touch = (type, id, x, y) => ex(([t, i, px, py]) => {
      const target = t === 'pointerdown' ? document.elementFromPoint(px, py) : document;
      target.dispatchEvent(new PointerEvent(t, { pointerId: i, pointerType: 'touch', clientX: px, clientY: py, bubbles: true, cancelable: true, isPrimary: i === 1, button: 0, buttons: 1 }));
    }, [type, id, x, y]);
    const v0 = await ex(() => ({ ...B().view }));
    await touch('pointerdown', 1, empty[0], empty[1]);
    for (let i = 1; i <= 5; i++) await touch('pointermove', 1, empty[0] - i * 20, empty[1] - i * 25);
    await touch('pointerup', 1, empty[0] - 100, empty[1] - 125);
    const v1 = await ex(() => ({ ...B().view }));
    check('touch: one finger on the empty board moves it', Math.abs(v1.x - v0.x + 100) < 2 && Math.abs(v1.y - v0.y + 125) < 2);
    check('touch: …instead of drawing a selection box', await ex(() => document.querySelector('#marquee').hidden));
    await touch('pointerdown', 1, empty[0] - 40, empty[1]);
    await touch('pointerdown', 2, empty[0] + 40, empty[1]);
    for (let i = 1; i <= 5; i++) { await touch('pointermove', 1, empty[0] - 40 - i * 8, empty[1]); await touch('pointermove', 2, empty[0] + 40 + i * 8, empty[1]); }
    await touch('pointerup', 1, empty[0] - 80, empty[1]); await touch('pointerup', 2, empty[0] + 80, empty[1]);
    const v2 = await ex(() => ({ ...B().view }));
    check('touch: two fingers pinch to zoom', Math.abs(v2.z - 2) < 0.05);
    const note = await ex(() => {
      B().view.z = 1; applyView();
      const c = Object.values(B().cards).find((c) => c.type === 'note' && !c.col); centreOn(c.id);
      const r = document.querySelector(`.card[data-id="${c.id}"]`).getBoundingClientRect(), v = document.querySelector('#viewport').getBoundingClientRect();
      return [(Math.max(r.left, v.left) + Math.min(r.right, v.right)) / 2, (Math.max(r.top, v.top) + Math.min(r.bottom, v.bottom)) / 2];
    });
    await touch('pointerdown', 1, note[0], note[1]); await sleep(750);
    check('touch: press and hold opens the card menu', await ex(() => !document.querySelector('#ctx').hidden && document.querySelectorAll('#ctx button').length >= 5));
    await touch('pointerup', 1, note[0], note[1]);
    await shot('android-hold-menu.png');
    await ex(() => hideMenu());

    // ---------- the Back button ----------
    const back = () => ex(() => __phone.listeners.backButton.forEach((f) => f()));
    await ex(() => openSettings()); await sleep(200);
    await back();
    check('back: closes an open window first', await ex(() => !document.querySelector('#modal-root .modal')));
    const sub = await ex(() => { const c = Object.values(B().cards).find((x) => x.type === 'board'); go(c.boardId); return c.boardId; });
    await back();
    check('back: steps out of a board to its parent', await ex((s) => cur !== s && cur === store.root, sub));
    await back();
    check('back: leaves the app from the top board', await ex(() => !!__phone.exited));

    // ---------- phone layout ----------
    check('layout: nothing is wider than the phone screen', await ex(() => document.documentElement.scrollWidth <= innerWidth));
    check('layout: the tool rail is narrow, without labels', await ex(() => document.querySelector('#rail').offsetWidth <= 60));
    await ex(() => { go(store.root); fitContent(); }); await sleep(300);
    await shot('android-board.png');

    // ---------- the same screens on an iPhone or iPad ----------
    const ictx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await ictx.addInitScript(FAKE_PHONE + ';window.Capacitor.getPlatform = () => "ios"; delete window.Capacitor.Plugins.SyncFolder;');
    const ip = await ictx.newPage();
    ip.on('pageerror', (e) => errors.push('iOS: ' + e.message));
    await ip.goto(URL_);
    await ip.waitForFunction(() => typeof store !== 'undefined' && store && document.querySelectorAll('#rail .tool').length > 0, null, { timeout: 20000 });
    check('ios: the app starts on iPhone and iPad', await ip.evaluate(() => api.platform === 'ios' && api.mobile && document.documentElement.classList.contains('ios')));
    await ip.evaluate(() => openSettings('sync')); await sleep(300);
    check('ios: sync settings point to the Pocket-Canvas Server', await ip.evaluate(() => /Pocket-Canvas Server/.test(document.querySelector('.set-pane').textContent) && [...document.querySelectorAll('.set-tabs button')].some((b) => b.textContent === 'Server')));
    check('ios: choosing a sync folder explains to use the server instead', await ip.evaluate(async () => /Pocket-Canvas Server/.test((await api.syncChoose()).error || '')));
    if (process.env.SHOT_DIR) await ip.screenshot({ path: path.join(process.env.SHOT_DIR, 'ios-sync-settings.png') });
    await ictx.close();
  } catch (err) {
    check('test run finished without crashing: ' + err.stack, false);
  } finally {
    await browser.close();
    server.close();
  }
  check('no script errors in the app', errors.length === 0);
  if (errors.length) console.log('Script errors:\n  ' + errors.join('\n  '));
  let failed = 0;
  for (const r of results) { console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`); if (!r.ok) failed++; }
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
