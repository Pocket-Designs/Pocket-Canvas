// Pocket-Canvas — browser extension test in a real Chromium browser
// Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
//
// Starts the Pocket-Canvas app, loads the extension into Chromium (via Playwright),
// connects them and saves things from the browser.
//   npm run test:extension     (needs:  npm install --no-save playwright  &&  npx playwright install chromium)
//   Linux without a screen:  xvfb-run -a npm run test:extension
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');

let chromium;
try { ({ chromium } = require('playwright')); } catch {
  console.log('SKIP  Playwright is not installed. Run: npm install --no-save playwright && npx playwright install chromium');
  process.exit(0);
}

const root = path.join(__dirname, '..');
const extDir = path.join(root, 'browser-extension');
const results = [];
const check = (name, ok) => results.push({ name, ok: !!ok });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((r) => { const s = http.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-ext-test-'));
  const appDir = path.join(tmp, 'app'); fs.mkdirSync(appDir);
  const PORT = await freePort();

  // A small web page to save things from.
  const site = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><title>Garden ideas</title><h1>Garden ideas</h1><p id="t">Plant lavender along the path.</p>');
  });
  await new Promise((r) => site.listen(0, '127.0.0.1', r));
  const SITE = `http://127.0.0.1:${site.address().port}/`;

  // Start the app.
  const electron = require('electron'); // path to the Electron binary
  const appProc = spawn(electron, ['--no-sandbox', path.join(__dirname, 'app-harness.js')], {
    env: { ...process.env, PC_TEST_DIR: appDir, PC_TEST_PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe']
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('App did not start')), 120000);
    appProc.stdout.on('data', (d) => { if (String(d).includes('PC-READY')) { clearTimeout(t); resolve(); } });
  });
  const dataFile = path.join(appDir, 'pocket-canvas-data.json');
  const readStore = () => { try { return JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch { return null; } };
  const allCards = () => { const s = readStore(); return s ? Object.values(s.boards).flatMap((b) => Object.values(b.cards)) : []; };
  const until = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(200); } return false; };

  let ctx;
  try {
    ctx = await chromium.launchPersistentContext(path.join(tmp, 'profile'), {
      headless: false,
      args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`]
    });
    let [sw] = ctx.serviceWorkers();
    if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
    const extId = new URL(sw.url()).host;
    check('extension: Chromium loads it (manifest accepted, background running)', !!extId);

    const opt = await ctx.newPage();
    const errors = [];
    opt.on('pageerror', (e) => errors.push(e.message));
    await opt.goto(`chrome-extension://${extId}/options.html`);
    await opt.evaluate((p) => chrome.storage.local.set({ port: p }), PORT);
    check('extension: finds the app on this computer', (await opt.evaluate(() => PC.status())).app === 'Pocket-Canvas');
    check('extension: starts out not connected', (await opt.evaluate(() => PC.status())).paired === false);

    await opt.evaluate(() => PC.pair());
    check('extension: Connect pairs with the app (after you click Allow there)', (await opt.evaluate(() => PC.status())).paired === true);
    const boards = await opt.evaluate(() => PC.boards());
    check('extension: lists your boards', boards.some((b) => b.title === 'Home'));

    // Popup
    const pop = await ctx.newPage();
    pop.on('pageerror', (e) => errors.push(e.message));
    await pop.goto(`chrome-extension://${extId}/popup.html`);
    await pop.waitForSelector('#ready:not([hidden])', { timeout: 8000 });
    check('popup: shows the board picker once connected', (await pop.$$eval('#board option', (o) => o.length)) >= 2);
    // A picture of the popup, for looking at by hand. Only taken when SHOT_DIR is
    // set, and never fails the test: screen-less cloud machines often can't capture.
    if (process.env.SHOT_DIR) {
      await pop.screenshot({ path: path.join(process.env.SHOT_DIR, 'popup.png') })
        .catch((e) => console.log('(popup screenshot skipped: ' + e.message.split('\n')[0] + ')'));
    }

    // Right-click menu actions, run through the extension's own background code.
    const page = await ctx.newPage();
    await page.goto(SITE);
    const tab = { id: 1, title: 'Garden ideas', url: SITE };
    const r1 = await sw.evaluate(({ tab }) => saveFromMenu({ menuItemId: 'pc-text', selectionText: 'Plant lavender along the path.', pageUrl: tab.url }, tab), { tab });
    check('right-click: “Save selected text” reaches the app', !r1.error && await until(() => allCards().some((c) => c.type === 'note' && (c.html || '').includes('Plant lavender'))));
    await sw.evaluate(({ tab }) => saveFromMenu({ menuItemId: 'pc-page', pageUrl: tab.url }, tab), { tab });
    check('right-click: “Save page” adds a link card', await until(() => allCards().some((c) => c.type === 'link' && c.url === SITE)));
    check('saved items go into a “From the web” column', await until(() => allCards().some((c) => c.type === 'column' && c.inbox && c.items.length >= 2)));

    // A web page must not be able to use the app's connection.
    const fromWeb = await page.evaluate(async (port) => {
      try { const r = await fetch(`http://127.0.0.1:${port}/clip`, { method: 'POST', body: '{"kind":"text","text":"evil"}' }); return r.status; } catch { return 'blocked'; }
    }, PORT);
    check('security: an ordinary web page cannot save to your boards', fromWeb === 'blocked' || fromWeb === 403);
    check('security: nothing from the web page was saved', !allCards().some((c) => (c.html || '').includes('evil')));

    // Disconnect
    await opt.evaluate(() => PC.forget());
    const r2 = await sw.evaluate(({ tab }) => saveFromMenu({ menuItemId: 'pc-page', pageUrl: tab.url }, tab), { tab });
    check('after disconnecting, saving asks you to connect again', !!r2.error);

    check('no script errors in the extension pages', errors.length === 0);
    if (errors.length) console.log(errors.join('\n'));
  } catch (err) {
    check('test finished without crashing: ' + err.message, false);
  } finally {
    if (ctx) await ctx.close().catch(() => {});
    const exited = new Promise((r) => appProc.once('exit', r));
    appProc.kill();
    await Promise.race([exited, sleep(5000)]);
    site.close();
  }

  let failed = 0;
  for (const r of results) { console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`); if (!r.ok) failed++; }
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch {}
  process.exit(failed ? 1 : 0);
})();
