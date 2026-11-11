// Pocket-Canvas — tests the browser version served by a real Pocket-Canvas Server.
// Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
//
// Builds build/web, starts the server on a free port with a temporary data folder, then uses Chromium
// as two separate browsers (and a pretend desktop device over the WebSocket) to check signing in,
// your boards arriving from other devices, saving, pictures, live changes, link previews and signing out.
//   npm run test:web      (needs:  cd server && npm install,  and  npm install --no-save playwright)
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

let chromium;
try { ({ chromium } = require('playwright')); } catch {
  console.log('SKIP  Playwright is not installed. Run: npm install --no-save playwright && npx playwright install chromium');
  process.exit(0);
}
const root = path.join(__dirname, '..');
let srvMod, WS;
try {
  srvMod = require(path.join(root, 'server', 'pocket-canvas-server.js'));
  WS = require(require.resolve('ws', { paths: [path.join(root, 'server')] }));
} catch {
  console.log('SKIP  The server’s packages aren’t installed. Run: cd server && npm install');
  process.exit(0);
}

const results = [];
const check = (name, ok) => { results.push({ name, ok: !!ok }); if (process.env.PC_VERBOSE) console.log((ok ? 'pass  ' : 'FAIL  ') + name); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 8000) { const t = Date.now(); while (Date.now() - t < ms) { try { if (await fn()) return true; } catch {} await sleep(100); } return false; }

(async () => {
  execFileSync(process.execPath, [path.join(root, 'scripts', 'build-web.js')], { stdio: 'inherit' });
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-web-'));
  const srv = srvMod.createServer({ dataDir: data, joinCode: 'open-sesame', quiet: true, webDir: path.join(root, 'build', 'web') });
  const port = await srv.listen(0, '127.0.0.1');
  const URL_ = `http://127.0.0.1:${port}`;
  const post = async (p, body, token) => (await fetch(URL_ + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) })).json();

  const launch = { headless: true };
  if (process.env.PC_CHROMIUM) launch.executablePath = process.env.PC_CHROMIUM;
  const browser = await chromium.launch(launch);
  const errors = [];
  try {
    // ---------- the server hosts the app ----------
    const home = await fetch(URL_ + '/');
    check('server: the browser version is served at the server’s address', home.ok && (await home.text()).includes('api-web.js'));
    const health = await (await fetch(URL_ + '/health')).json();
    check('server: /health still answers for the apps', health.app === 'Pocket-Canvas Server' && health.web === true);
    const sneak = async (p) => { const r = await fetch(URL_ + p); const t = await r.text(); return r.status !== 200 && !t.includes('"devDependencies"') && !t.includes('createServer'); };
    check('server: files outside the web folder can’t be fetched', await sneak('/..%2f..%2fpackage.json') && await sneak('/%2e%2e/%2e%2e/server/pocket-canvas-server.js') && await sneak('/..%5c..%5cpackage.json'));

    // Sam already uses the desktop app: a pretend desktop device with a board and a picture
    const acc = await post('/api/register', { name: 'Sam', password: 'correct horse', joinCode: 'open-sesame' });
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a3f2b9d40000000049454e44ae426082', 'hex');
    const picId = '0123456789abcdef.png';
    await fetch(URL_ + '/api/assets/' + picId, { method: 'PUT', headers: { Authorization: 'Bearer ' + acc.token }, body: png });
    const now = Date.now();
    const desktopState = {
      root: 'rootboard01',
      boards: { rootboard01: { id: 'rootboard01', title: 'Home', parentId: null, order: ['deskcard01', 'deskpic01'], cards: {
        deskcard01: { id: 'deskcard01', type: 'note', x: 60, y: 60, w: 240, color: null, html: '<p>Written on the desktop</p>', _mt: now },
        deskpic01: { id: 'deskpic01', type: 'image', x: 360, y: 60, w: 200, color: null, asset: picId, caption: 'A picture', _mt: now }
      }, view: { x: 0, y: 0, z: 1 }, _mt: now } },
      templates: {}, bin: {}, deleted: {}
    };
    const desk = await new Promise((resolve) => {
      const ws = new WS(`ws://127.0.0.1:${port}/ws?token=${encodeURIComponent(acc.token)}`);
      const d = { ws, got: [], send: (m) => ws.send(JSON.stringify(m)), waitFor: async (fn, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { const m = [...d.got].reverse().find(fn); if (m) return m; await sleep(80); } return null; } };
      ws.on('message', (x) => d.got.push(JSON.parse(x.toString())));
      ws.on('open', () => { d.send({ t: 'hello', deviceId: 'desktop0001', deviceName: 'Sam’s laptop' }); resolve(d); });
    });
    desk.send({ t: 'doc', scope: 'me', state: desktopState });
    await desk.waitFor((m) => m.t === 'saved');

    // ---------- browser 1: sign in ----------
    const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const p1 = await ctx1.newPage();
    p1.on('pageerror', (e) => errors.push('browser 1: ' + e.message));
    await p1.goto(URL_ + '/');
    await p1.waitForSelector('#web-signin form', { timeout: 15000 });
    check('web: opening the server’s address shows a sign-in screen', await p1.evaluate(() => /Sign in to your boards/.test(document.querySelector('#web-signin').textContent) && document.documentElement.classList.contains('web-signing-in')));
    if (process.env.SHOT_DIR) await p1.screenshot({ path: path.join(process.env.SHOT_DIR, 'web-signin.png') });
    await p1.fill('#web-signin input[name=name]', 'Sam');
    await p1.fill('#web-signin input[name=password]', 'wrong password');
    await p1.click('#web-signin .ws-go');
    check('web: a wrong password is refused, with a message', await until(() => p1.evaluate(() => !document.querySelector('#web-signin .ws-error').hidden && /don’t match/.test(document.querySelector('#web-signin .ws-error').textContent))));
    await p1.fill('#web-signin input[name=password]', 'correct horse');
    await p1.click('#web-signin .ws-go');
    check('web: after signing in, the app opens', await until(() => p1.evaluate(() => !document.querySelector('#web-signin') && typeof store !== 'undefined' && store && !!store.boards), 15000));
    check('web: your boards from your other devices are there straight away', await until(() => p1.evaluate(() => !!document.querySelector('.card[data-id="deskcard01"]') && document.querySelector('.card[data-id="deskcard01"]').textContent.includes('Written on the desktop'))));
    check('web: no welcome board is added on top of your own boards', await p1.evaluate(() => store.root === 'rootboard01' && Object.keys(store.boards).length === 1));
    check('web: pictures show, straight from the server', await until(() => p1.evaluate(() => { const img = document.querySelector('.card[data-id="deskpic01"] img'); return !!img && img.complete && img.naturalWidth === 1; })));
    check('web: it connects live (● Live)', await until(() => p1.evaluate(() => SRV.state === 'online' && document.querySelector('#server-state').textContent === 'Live')));
    check('web: it has the ⋮ menu instead of a menu bar', await p1.evaluate(() => { document.querySelector('#more-btn').click(); const t = [...document.querySelectorAll('#ctx button')].map((b) => b.textContent); hideMenu(); return t.includes('Sign out') && t.some((x) => x.startsWith('Export as picture or PDF')); }));
    check('web: Settings shows General, Appearance and Account', await p1.evaluate(async () => { openSettings(); await new Promise((r) => setTimeout(r, 300)); const t = [...document.querySelectorAll('.set-tabs button')].map((b) => b.textContent).join(); settingsModal.close(); return t === 'General,Appearance,Account'; }));

    // ---------- saving and live changes ----------
    await p1.evaluate(() => { addCard('note', { x: 700, y: 300 }, { html: '<p>Typed in the browser</p>' }); flushSave(); });
    const fromWeb = await desk.waitFor((m) => m.t === 'doc' && m.scope === 'me' && JSON.stringify(m.state).includes('Typed in the browser'));
    check('web: what you add in the browser reaches your other devices', !!fromWeb);
    const st2 = JSON.parse(JSON.stringify(fromWeb.state));
    st2.boards.rootboard01.cards.deskcard02 = { id: 'deskcard02', type: 'note', x: 60, y: 400, w: 240, color: null, html: '<p>Added on the laptop later</p>', _mt: Date.now() + 1000 };
    st2.boards.rootboard01.order.push('deskcard02');
    desk.send({ t: 'doc', scope: 'me', state: st2 });
    check('web: changes from your other devices appear live', await until(() => p1.evaluate(() => !!document.querySelector('.card[data-id="deskcard02"]'))));
    // keyboard shortcuts from the menu bar
    await p1.click('#viewport', { position: { x: 900, y: 600 } });
    const z0 = await p1.evaluate(() => B().view.z);
    await p1.keyboard.press('Control+=');
    check('web: the desktop keyboard shortcuts work (Ctrl+= zooms in, not the browser)', await until(() => p1.evaluate((z) => B().view.z > z, z0)));
    await p1.keyboard.press('Control+0');
    await p1.evaluate(() => { const c = Object.values(B().cards).find((x) => (x.html || '').includes('Typed in the browser')); selectOnly(c.id); });
    await p1.keyboard.press('Control+d');
    check('web: Ctrl+D duplicates, instead of making a browser bookmark', await until(() => p1.evaluate(() => Object.values(B().cards).filter((x) => (x.html || '').includes('Typed in the browser')).length === 2)));
    await p1.keyboard.press('Control+z');
    check('web: Ctrl+Z undoes', await until(() => p1.evaluate(() => Object.values(B().cards).filter((x) => (x.html || '').includes('Typed in the browser')).length === 1)));

    // ---------- adding a picture in the browser ----------
    const [chooser] = await Promise.all([p1.waitForEvent('filechooser'), p1.evaluate(() => { addTool('image', { x: 900, y: 120 }); })]);
    await chooser.setFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png });
    check('web: a picture you add is uploaded to the server and shown', await until(() => p1.evaluate(() => { const c = Object.values(B().cards).find((x) => x.type === 'image' && x.id !== 'deskpic01'); if (!c) return false; const img = document.querySelector(`.card[data-id="${c.id}"] img`); return !!img && img.complete && img.naturalWidth === 1; }), 10000));
    const newPic = await p1.evaluate(() => Object.values(B().cards).find((x) => x.type === 'image' && x.id !== 'deskpic01').asset);
    check('web: …and stored on the server for your other devices', fs.existsSync(path.join(data, 'assets', newPic)));
    const assetRes = await fetch(URL_ + '/api/assets/' + newPic, { headers: { Authorization: 'Bearer ' + acc.token } });
    check('server: pictures are sent with their real type, locked down so they can’t run scripts', assetRes.headers.get('content-type') === 'image/png' && /sandbox/.test(assetRes.headers.get('content-security-policy') || '') && assetRes.headers.get('x-content-type-options') === 'nosniff');
    check('server: pictures can’t be fetched without signing in', (await fetch(URL_ + '/api/assets/' + newPic)).status === 401);
    const ranged = await fetch(URL_ + '/api/assets/' + newPic, { headers: { Authorization: 'Bearer ' + acc.token, Range: 'bytes=0-7' } });
    check('server: videos can be skipped through (partial downloads)', ranged.status === 206 && (await ranged.arrayBuffer()).byteLength === 8);
    check('server: the sign-in cookie can’t be used to change anything', (await fetch(URL_ + '/api/assets/missing', { method: 'POST', headers: { Cookie: 'pc_session=' + (await ctx1.cookies()).find((c) => c.name === 'pc_session').value, 'Content-Type': 'application/json' }, body: '{"ids":[]}' })).status === 401);
    check('web: the sign-in cookie is HttpOnly and SameSite=Strict', await (async () => { const c = (await ctx1.cookies()).find((x) => x.name === 'pc_session'); return !!c && c.httpOnly && c.sameSite === 'Strict'; })());

    // ---------- reloading keeps everything ----------
    await p1.evaluate(() => flushSave()); await sleep(400);
    await p1.reload();
    check('web: after a reload you’re still signed in, with everything there', await until(() => p1.evaluate(() => typeof store !== 'undefined' && store && !document.querySelector('#web-signin') && !!document.querySelector('.card[data-id="deskcard02"]') && Object.values(B().cards).some((x) => (x.html || '').includes('Typed in the browser'))), 15000));
    if (process.env.SHOT_DIR) { await sleep(500); await p1.screenshot({ path: path.join(process.env.SHOT_DIR, 'web-app.png') }); }

    // ---------- browser 2: a different computer ----------
    const ctx2 = await browser.newContext({ viewport: { width: 1100, height: 760 } });
    const p2 = await ctx2.newPage();
    p2.on('pageerror', (e) => errors.push('browser 2: ' + e.message));
    await p2.goto(URL_ + '/');
    await p2.waitForSelector('#web-signin form');
    await p2.fill('#web-signin input[name=name]', 'sam');
    await p2.fill('#web-signin input[name=password]', 'correct horse');
    await p2.click('#web-signin .ws-go');
    check('web: on another computer, the same boards appear, including ones added in a browser', await until(() => p2.evaluate(() => typeof store !== 'undefined' && store && Object.values(B().cards).some((x) => (x.html || '').includes('Typed in the browser')) && !!document.querySelector('.card[data-id="deskcard02"]')), 15000));
    await p2.evaluate(() => { const c = B().cards.deskcard01; c.html = '<p>Edited in browser 2</p>'; rerenderCard(c.id); scheduleSave(); });
    check('web: two browsers stay in step live', await until(() => p1.evaluate(() => (B().cards.deskcard01.html || '').includes('Edited in browser 2')), 10000));

    // creating an account
    const ctx3 = await browser.newContext();
    const p3 = await ctx3.newPage();
    p3.on('pageerror', (e) => errors.push('browser 3: ' + e.message));
    await p3.goto(URL_ + '/');
    await p3.waitForSelector('#web-signin .ws-switch');
    await p3.click('#web-signin .ws-switch');
    await p3.fill('#web-signin input[name=name]', 'Alex');
    await p3.fill('#web-signin input[name=password]', 'another password');
    await p3.fill('#web-signin input[name=joinCode]', 'open-sesame');
    await p3.click('#web-signin .ws-go');
    check('web: a new account can be made in the browser (with the join code), starting with the welcome board', await until(() => p3.evaluate(() => typeof store !== 'undefined' && store && Object.keys(B().cards).length > 3 && !Object.values(B().cards).some((x) => (x.html || '').includes('desktop'))), 15000));
    check('web: other people’s boards stay private', !(await p3.evaluate(() => JSON.stringify(store).includes('Typed in the browser'))));

    // ---------- link previews through the server ----------
    const local = await p1.evaluate(() => api.linkPreview('http://127.0.0.1:1/secret'));
    check('server: link previews never fetch addresses on your own network', !!local && !!local.error && !local.title);
    const res = await fetch(URL_ + '/api/preview?url=' + encodeURIComponent('http://192.168.1.1/'), { headers: { Authorization: 'Bearer ' + acc.token } });
    check('server: …including your router and other home-network addresses', !!(await res.json()).error);

    // ---------- signing out ----------
    await p1.evaluate(() => serverSignOut());
    check('web: signing out returns to the sign-in screen and forgets this browser’s copy', await until(() => p1.evaluate(async () => {
      if (!document.querySelector('#web-signin')) return false;
      const keys = await new Promise((r) => { const q = indexedDB.open('pocket-canvas'); q.onsuccess = () => { const t = q.result.transaction('kv').objectStore('kv').getAllKeys(); t.onsuccess = () => r(t.result); }; });
      return !keys.some((k) => String(k).startsWith('data:u'));
    }), 15000));
    check('web: after signing out the old key no longer works', (await fetch(URL_ + '/api/docs', { headers: { Cookie: 'pc_session=x' } })).status === 401);
    check('web: no script errors in the browser', errors.length === 0 || (console.log(errors.join('\n')), false));
    desk.ws.close();
  } catch (err) {
    check('test run finished without crashing: ' + err.stack, false);
  } finally {
    await browser.close();
    await srv.close();
    fs.rmSync(data, { recursive: true, force: true });
  }
  const failed = results.filter((r) => !r.ok);
  for (const r of results) if (!process.env.PC_VERBOSE && !r.ok) console.log('FAIL  ' + r.name);
  console.log(`${results.length - failed.length} passed, ${failed.length} failed`);
  process.exit(failed.length ? 1 : 0);
})();
