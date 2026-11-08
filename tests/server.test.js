// Pocket-Canvas Server tests (plain Node): accounts, syncing your own devices, shared boards,
// who's here, pictures and files, and keeping everything after a restart.
// Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
//   npm run test:server     (needs the server's packages: cd server && npm install)
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');

let createServer, WebSocket;
try {
  ({ createServer } = require('../server/pocket-canvas-server.js'));
  WebSocket = require(require.resolve('ws', { paths: [path.join(__dirname, '..', 'server')] }));
} catch {
  console.log('SKIP  The server\'s packages aren\'t installed. Run: cd server && npm install');
  process.exit(0);
}

let pass = 0, fail = 0;
const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); ok ? pass++ : fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-server-'));
  let srv = createServer({ dataDir: dir, joinCode: 'garden-gate', quiet: true });
  let port = await srv.listen(0, '127.0.0.1');
  const base = () => `http://127.0.0.1:${port}`;
  const post = async (p, body, token) => {
    const r = await fetch(base() + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
  };

  // A device: a WebSocket client that remembers what it was sent.
  function device(token, deviceId, deviceName = deviceId) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${encodeURIComponent(token)}`);
      const d = { ws, got: [], send: (m) => ws.send(JSON.stringify(m)), waitFor: async (fn, ms = 4000) => { const t = Date.now(); while (Date.now() - t < ms) { const m = d.got.find(fn); if (m) return m; await sleep(30); } return null; } };
      ws.on('message', (data) => d.got.push(JSON.parse(data.toString())));
      ws.on('open', () => { d.send({ t: 'hello', deviceId, deviceName }); resolve(d); });
      ws.on('close', (code) => { d.closed = code; });
      ws.on('error', reject);
    });
  }
  const board = (id, title, parentId, cards = {}) => ({ id, title, parentId, color: '#8a7f70', cards, order: Object.keys(cards), links: [], view: { x: 0, y: 0, z: 1 }, _mt: 1 });
  const note = (id, html, mt = 1) => ({ id, type: 'note', x: 40, y: 40, w: 240, html, _mt: mt });

  try {
    // ---------- accounts ----------
    const health = await (await fetch(base() + '/health')).json();
    check('the server says who it is', health.app === 'Pocket-Canvas Server' && health.signUp === true);
    check('a wrong join code is refused', (await post('/api/register', { name: 'Sam', password: 'longenough', joinCode: 'nope' })).status === 403);
    check('short passwords are refused', (await post('/api/register', { name: 'Sam', password: 'short', joinCode: 'garden-gate' })).status === 400);
    const sam = await post('/api/register', { name: 'Sam', password: 'correct horse', joinCode: 'garden-gate', device: 'Laptop' });
    check('an account can be made with the join code', sam.status === 200 && sam.body.token && sam.body.user.name === 'Sam');
    check('names can only be used once (any capitals)', (await post('/api/register', { name: 'sam', password: 'correct horse', joinCode: 'garden-gate' })).status === 409);
    const alex = (await post('/api/register', { name: 'Alex', password: 'another password', joinCode: 'garden-gate' })).body;
    check('a wrong password is refused', (await post('/api/login', { name: 'Sam', password: 'wrong one' })).status === 401);
    const sam2 = await post('/api/login', { name: 'SAM', password: 'correct horse', device: 'Phone' });
    check('signing in on another device gives it its own key', sam2.status === 200 && sam2.body.token !== sam.body.token);
    const users = await (await fetch(base() + '/api/users', { headers: { Authorization: 'Bearer ' + sam.body.token } })).json();
    check('signed-in people can see who else is on the server (names only)', users.users.length === 2 && !JSON.stringify(users).includes('hash') && !JSON.stringify(users).includes('salt'));
    check('without signing in, nothing is shown', (await fetch(base() + '/api/users')).status === 401);
    const stored = fs.readFileSync(path.join(dir, 'users.json'), 'utf8') + fs.readFileSync(path.join(dir, 'tokens.json'), 'utf8');
    check('passwords and keys are not stored as they are', !stored.includes('correct horse') && !stored.includes(sam.body.token));

    // ---------- your own devices ----------
    const laptop = await device(sam.body.token, 'laptop00001', 'Laptop');
    check('a device is welcomed with its account', !!(await laptop.waitFor((m) => m.t === 'welcome' && m.user.name === 'Sam')));
    const stateA = { root: 'home', boards: { home: board('home', 'Home', null, { n1: note('n1', '<p>From the laptop</p>') }) }, templates: {}, bin: {}, deleted: {} };
    laptop.send({ t: 'doc', scope: 'me', state: stateA });
    check('the server confirms it has the copy', !!(await laptop.waitFor((m) => m.t === 'saved' && m.scope === 'me')));
    const phone = await device(sam2.body.token, 'phone000001', 'Phone');
    const caught = await phone.waitFor((m) => m.t === 'doc' && m.scope === 'me');
    check('a device that was offline catches up when it connects', caught && caught.deviceName === 'Laptop' && caught.state.boards.home.cards.n1);
    phone.send({ t: 'doc', scope: 'me', state: { ...stateA, boards: { home: board('home', 'Home', null, { n2: note('n2', '<p>From the phone</p>', 5) }) } } });
    const live = await laptop.waitFor((m) => m.t === 'doc' && m.scope === 'me' && m.deviceName === 'Phone');
    check('changes go straight to your other devices', live && live.state.boards.home.cards.n2);
    const alexDev = await device(alex.token, 'alex0000001', 'Alex PC');
    await alexDev.waitFor((m) => m.t === 'welcome');
    await sleep(200);
    check('nobody else gets your boards', !alexDev.got.some((m) => m.t === 'doc'));

    // ---------- shared boards ----------
    const space = { root: 'garden', boards: { garden: board('garden', 'Garden plan', null, { g1: note('g1', '<p>Roses</p>', 2) }) }, templates: {}, bin: {}, deleted: {} };
    laptop.send({ t: 'share', root: 'garden', title: 'Garden plan', with: ['alex'], state: space });
    const toAlex = await alexDev.waitFor((m) => m.t === 'space');
    check('sharing a board tells the other person', toAlex && toAlex.space.title === 'Garden plan' && toAlex.space.members.length === 2 && toAlex.space.owner.name === 'Sam');
    const gotBoard = await alexDev.waitFor((m) => m.t === 'doc' && m.scope === toAlex.space.id);
    check('…and gives them the board straight away', gotBoard && gotBoard.state.boards.garden.cards.g1);
    check('your own other devices hear about it too', !!(await phone.waitFor((m) => m.t === 'space' && m.space.id === toAlex.space.id)));
    alexDev.send({ t: 'doc', scope: toAlex.space.id, state: { ...space, boards: { garden: board('garden', 'Garden plan', null, { g1: note('g1', '<p>Roses</p>', 2), g2: note('g2', '<p>Tulips (Alex)</p>', 9) }) } } });
    const back = await laptop.waitFor((m) => m.t === 'doc' && m.scope === toAlex.space.id && m.user && m.user.name === 'Alex');
    check('changes to a shared board reach everyone in about a second', back && back.state.boards.garden.cards.g2);
    const outsider = (await post('/api/register', { name: 'Kim', password: 'kims password', joinCode: 'garden-gate' })).body;
    const kim = await device(outsider.token, 'kim00000001', 'Kim');
    await kim.waitFor((m) => m.t === 'welcome');
    kim.send({ t: 'doc', scope: toAlex.space.id, state: space });
    check('people who weren’t invited can’t change a shared board', !!(await kim.waitFor((m) => m.t === 'error')));

    // who's here
    alexDev.send({ t: 'presence', space: toAlex.space.id, board: 'garden', card: 'g2', editing: true });
    const pres = await laptop.waitFor((m) => m.t === 'presence' && m.people.some((p) => p.user.name === 'Alex' && p.card === 'g2' && p.editing));
    check('you can see who is on a shared board and which card they’re typing in', !!pres);
    alexDev.ws.close();
    check('…and when they leave', !!(await laptop.waitFor((m) => m.t === 'presence' && m.space === toAlex.space.id && !m.people.some((p) => p.user.name === 'Alex'), 4000)));

    // ---------- pictures and files ----------
    const id = '0123456789abcdef.png';
    const auth = { Authorization: 'Bearer ' + sam.body.token };
    const miss = await post('/api/assets/missing', { ids: [id, 'bad id'] }, sam.body.token);
    check('the server says which pictures it doesn’t have yet', miss.body.missing.length === 1 && miss.body.missing[0] === id);
    const put = await fetch(base() + '/api/assets/' + id, { method: 'PUT', headers: { ...auth, 'Content-Type': 'application/octet-stream' }, body: Buffer.from('PNGDATA') });
    check('pictures can be uploaded', put.status === 200);
    const got = await fetch(base() + '/api/assets/' + id, { headers: { Authorization: 'Bearer ' + alex.token } });
    check('…and fetched by people the board is shared with', got.status === 200 && (await got.text()) === 'PNGDATA');
    check('only proper picture ids are accepted', (await fetch(base() + '/api/assets/..%2Fusers.json', { headers: auth })).status === 404);

    // ---------- after a restart ----------
    laptop.ws.close(); phone.ws.close(); kim.ws.close();
    await srv.close();
    srv = createServer({ dataDir: dir, joinCode: 'garden-gate', quiet: true });
    port = await srv.listen(0, '127.0.0.1');
    const again = await device(alex.token, 'alex0000002', 'Alex laptop');
    const w = await again.waitFor((m) => m.t === 'welcome');
    check('accounts and shared boards are kept when the server restarts', w && w.spaces.length === 1 && w.spaces[0].title === 'Garden plan');
    check('…and so are the latest copies', !!(await again.waitFor((m) => m.t === 'doc' && m.scope === w.spaces[0].id)));
    again.send({ t: 'leave', space: w.spaces[0].id });
    check('you can leave a shared board', !!(await again.waitFor((m) => m.t === 'unshared')));
    again.ws.close();
    const bad = await device('not-a-real-key', 'x00000001').catch(() => null);
    await sleep(300);
    check('a wrong key is turned away', bad && bad.closed === 4001);
  } catch (err) {
    check('test run finished without crashing: ' + err.stack, false);
  } finally {
    await srv.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
