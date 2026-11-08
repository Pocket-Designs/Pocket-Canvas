// Pocket-Canvas smoke test
// Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
//
// Starts the real app with a throw-away data folder, drives it with real mouse
// and keyboard input, and checks the results. Run with:  npm test
// (On a Linux machine with no screen:  xvfb-run -a npm test)

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pocket-canvas-test-'));
app.setPath('appData', tmp);
app.setPath('userData', path.join(tmp, 'Pocket-Canvas'));

// Old-name data, to check the one-time import from "PocketCanvas".
const oldDir = path.join(tmp, 'PocketCanvas');
fs.mkdirSync(path.join(oldDir, 'assets'), { recursive: true });
fs.writeFileSync(path.join(oldDir, 'assets', 'old.png'), 'x');
const OLD_HOME = 'Imported board';
fs.writeFileSync(path.join(oldDir, 'pocketcanvas-data.json'), JSON.stringify({
  version: 1, root: 'r', ui: {},
  boards: { r: { id: 'r', title: OLD_HOME, parentId: null, cards: {}, order: [], links: [], view: { x: 0, y: 0, z: 1 } } }
}));

const { waitForApp } = require('./wait-ready');
require(path.join(__dirname, '..', 'main.js'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, ok) { results.push({ name, ok: !!ok }); }

app.whenReady().then(run);

async function run() {
  let win;
  try { win = await waitForApp(); } catch (err) {
    console.log('FAIL  ' + err.message);
    const w = BrowserWindow.getAllWindows()[0];
    if (w) console.log('Window URL: ' + w.webContents.getURL());
    fs.rmSync(tmp, { recursive: true, force: true });
    return app.exit(1);
  }
  const wc = win.webContents;
  const errors = [];
  wc.on('console-message', (...a) => { if (a[1] >= 3) errors.push(a[2]); });
  const ex = (js) => wc.executeJavaScript(js);
  const centre = (sel) => ex(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return [Math.round(r.left+r.width/2),Math.round(r.top+r.height/2)]})()`);
  const click = async (x, y, button = 'left') => {
    wc.sendInputEvent({ type: 'mouseDown', x, y, button, clickCount: 1 }); await sleep(30);
    wc.sendInputEvent({ type: 'mouseUp', x, y, button, clickCount: 1 }); await sleep(60);
  };
  const drag = async (a, b) => {
    wc.sendInputEvent({ type: 'mouseDown', x: a[0], y: a[1], button: 'left', clickCount: 1 });
    for (let i = 1; i <= 10; i++) {
      wc.sendInputEvent({ type: 'mouseMove', x: Math.round(a[0] + (b[0] - a[0]) * i / 10), y: Math.round(a[1] + (b[1] - a[1]) * i / 10), button: 'left' });
      await sleep(25);
    }
    wc.sendInputEvent({ type: 'mouseUp', x: b[0], y: b[1], button: 'left', clickCount: 1 });
    await sleep(150);
  };

  try {
    // --- start-up and migration
    check('imports boards saved under the old PocketCanvas name', (await ex('B().title')) === OLD_HOME);
    check('copies old images and files', fs.existsSync(path.join(tmp, 'Pocket-Canvas', 'assets', 'old.png')));

    // Swap in the default welcome board so there is something to work with.
    await ex(`defaultStore(); render(); B().view={x:40,y:20,z:0.8}; applyView(); renderBoard();`);
    await sleep(200);
    const id = (type, extra = '') => ex(`Object.values(B().cards).find(c=>c.type==='${type}'${extra})?.id`);
    check('welcome board renders cards', (await ex('document.querySelectorAll("#cards .card").length')) >= 6);
    check('tool rail is built', (await ex('document.querySelectorAll("#rail .tool").length')) === 13);

    // --- adding
    const before = await ex('Object.keys(B().cards).length');
    const noteTool = await centre('.tool[data-tool="note"]');
    await click(...noteTool); await sleep(100);
    check('clicking the Note tool adds a note', (await ex('Object.keys(B().cards).length')) === before + 1);
    await ex('document.activeElement.blur(); clearSelection()');

    // --- editing with real typing
    const note = await id('note', '&&!c.col&&c.html.includes("visual board")');
    const ed = await centre(`.card[data-id="${note}"] .editable`);
    await click(...ed); await click(...ed);
    check('second click starts editing', await ex('document.activeElement.isContentEditable'));
    for (const ch of ' Hello') wc.sendInputEvent({ type: 'char', keyCode: ch });
    await sleep(120);
    check('typing is stored in the note', await ex(`B().cards['${note}'].html.includes('Hello')`));
    await click(1300, 820);
    check('clicking the empty board stops editing', !(await ex('document.activeElement.isContentEditable')));

    // --- columns
    const sw = await id('swatch'); const col = await id('column');
    await drag(await centre(`.card[data-id="${sw}"] .swatch-chip`), await centre(`.card[data-id="${col}"] .col-title`));
    check('dragging a card onto a column adds it', await ex(`B().cards['${col}'].items.includes('${sw}')`));
    await drag(await centre(`.card[data-id="${sw}"] .swatch-chip`), [800, 700]);
    check('dragging it back out removes it', await ex(`!B().cards['${sw}'].col && !B().cards['${col}'].items.includes('${sw}')`));

    // --- moving into a board, undo
    const hd = await id('heading');
    await drag(await centre(`.card[data-id="${hd}"]`), await centre('.card.board .board-ico'));
    check('dragging onto a board card moves the card inside', await ex(`!B().cards['${hd}'] && Object.values(store.boards).some(b=>b.cards['${hd}'])`));
    await ex('undo()'); await sleep(100);
    check('undo brings it back', await ex(`!!B().cards['${hd}']`));
    await ex('redo(); undo()');

    // --- lines
    const links = await ex('B().links.length');
    await ex('toggleConnect()');
    const todo = await id('todo');
    await click(...await centre(`.card[data-id="${todo}"] .todo-prog`));
    await click(...await centre('.card.board .board-count'));
    check('Line tool connects two cards', (await ex('B().links.length')) === links + 1);

    // --- selection, duplicate, delete
    await drag([345, 840], [1395, 55]);
    check('drag-box selects several cards', (await ex('selected.size')) >= 4);
    await ex(`selectOnly('${todo}')`);
    const n1 = await ex('Object.keys(B().cards).length');
    await ex('duplicateSelection()');
    check('duplicate adds a copy', (await ex('Object.keys(B().cards).length')) === n1 + 1);
    await ex('deleteSelection()'); await sleep(50);
    check('delete removes it', (await ex('Object.keys(B().cards).length')) === n1);

    // --- context menu
    await ex(`clearSelection()`);
    const nc = await centre(`.card[data-id="${note}"]`);
    await click(nc[0], nc[1], 'right'); await sleep(100);
    check('right-click opens the card menu', (await ex('document.querySelectorAll("#ctx button").length')) >= 5);
    await ex('hideMenu()');

    // --- search, navigation, export, theme
    await ex(`document.querySelector('#search').value='columns'; runSearch()`);
    check('search finds text inside a column', (await ex('document.querySelectorAll(".sr").length')) >= 1);
    await ex(`document.querySelector('#search').value=''; runSearch()`);
    const sub = await ex(`B().cards[Object.values(B().cards).find(c=>c.type==='board').id].boardId`);
    await ex(`go('${sub}')`); await sleep(100);
    check('opening a board changes the breadcrumb', (await ex('document.querySelectorAll("#crumbs .crumb").length')) === 2);
    await ex('go(store.root)');
    check('Markdown export includes sub-boards', await ex(`boardToMd(store.root,1).includes('# My first board')`));
    await ex('toggleTheme()');
    check('dark/light toggle works', !!(await ex('document.documentElement.dataset.theme')));

    // --- saving
    await ex('flushSave()'); await sleep(200);
    const saved = JSON.parse(fs.readFileSync(path.join(tmp, 'Pocket-Canvas', 'pocket-canvas-data.json'), 'utf8'));
    check('changes are saved to disk', saved.boards[saved.root].title === 'Home');

    check('no script errors in the window', errors.length === 0);
    if (errors.length) console.log('Script errors:\n  ' + errors.join('\n  '));
  } catch (err) {
    check('test run finished without crashing: ' + err.message, false);
  }

  let failed = 0;
  for (const r of results) { console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`); if (!r.ok) failed++; }
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  fs.rmSync(tmp, { recursive: true, force: true });
  app.exit(failed ? 1 : 0);
}
