// Pocket-Canvas — sync merge tests (plain Node, no Electron needed)
// Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
// Run: node tests/merge.test.js
'use strict';
const S = require('../src/merge.js');

let pass = 0, fail = 0;
function check(name, ok) { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); ok ? pass++ : fail++; }
const clone = (o) => JSON.parse(JSON.stringify(o));

function board(id, title, parentId, cards = [], links = []) {
  const b = { id, title, parentId, color: '#8a7f70', cards: {}, order: [], links, view: { x: 0, y: 0, z: 1 } };
  for (const c of cards) { b.cards[c.id] = c; b.order.push(c.id); }
  return b;
}
const note = (id, text, x = 0) => ({ id, type: 'note', x, y: 0, w: 240, color: null, html: text });

// One computer's copy with its own change-tracking index.
class Device {
  constructor(store, t) { this.s = clone(store); this.t = t; this.idx = S.buildIndex(this.s); }
  edit(fn) { fn(this.s); this.t += 1000; this.idx = S.stamp(this.s, this.idx, this.t); }
  receive(other) {
    this.idx = S.stamp(this.s, this.idx, this.t);
    const r = S.merge(this.s, S.syncState(other.s), this.t);
    this.s = r.store; this.idx = S.buildIndex(this.s);
    return r.changed;
  }
  cards(bid = this.s.root) { return Object.keys(this.s.boards[bid].cards).sort(); }
}

const base = { version: 1, root: 'home', ui: {}, templates: {}, deleted: {},
  boards: { home: board('home', 'Home', null, [note('n1', 'one'), note('n2', 'two', 300)]) } };

// 1. Different cards added on each computer both survive.
{
  const a = new Device(base, 1e6), b = new Device(base, 1e6);
  a.edit((s) => { s.boards.home.cards.a1 = note('a1', 'from A'); s.boards.home.order.push('a1'); });
  b.edit((s) => { s.boards.home.cards.b1 = note('b1', 'from B'); s.boards.home.order.push('b1'); });
  a.receive(b); b.receive(a);
  check('cards added on two computers both survive', a.cards().join() === 'a1,b1,n1,n2' && b.cards().join() === a.cards().join());
  check('both computers end up identical', S.fingerprint(a.s) === S.fingerprint(b.s));
}

// 2. Same card edited on both: the later edit wins.
{
  const a = new Device(base, 1e6), b = new Device(base, 1e6);
  a.edit((s) => { s.boards.home.cards.n1.html = 'A edit'; });
  b.t += 5000;
  b.edit((s) => { s.boards.home.cards.n1.html = 'B edit (later)'; });
  a.receive(b); b.receive(a);
  check('later edit to the same card wins', a.s.boards.home.cards.n1.html === 'B edit (later)' && b.s.boards.home.cards.n1.html === 'B edit (later)');
}

// 3. Deleted on one computer, untouched on the other: stays deleted.
{
  const a = new Device(base, 1e6), b = new Device(base, 1e6);
  a.edit((s) => { delete s.boards.home.cards.n2; s.boards.home.order = ['n1']; });
  b.receive(a);
  check('a deletion reaches the other computer', !b.s.boards.home.cards.n2);
  b.edit((s) => { s.boards.home.cards.n1.html = 'still here'; });
  a.receive(b);
  check('the deleted card does not come back later', !a.s.boards.home.cards.n2 && !b.s.boards.home.cards.n2);
}

// 4. Deleted on one, edited later on the other: the edit wins (nothing lost).
{
  const a = new Device(base, 1e6), b = new Device(base, 1e6);
  a.edit((s) => { delete s.boards.home.cards.n2; });
  b.t += 9000;
  b.edit((s) => { s.boards.home.cards.n2.html = 'edited after delete'; });
  a.receive(b);
  check('editing after a deletion keeps the card', a.s.boards.home.cards.n2 && a.s.boards.home.cards.n2.html === 'edited after delete');
}

// 5. Card moved into a sub-board on one computer, edited on the other.
{
  const withSub = clone(base);
  withSub.boards.sub = board('sub', 'Sub', 'home');
  withSub.boards.home.cards.bc = { id: 'bc', type: 'board', boardId: 'sub', x: 600, y: 0, w: 130, color: null };
  withSub.boards.home.order.push('bc');
  const a = new Device(withSub, 1e6), b = new Device(withSub, 1e6);
  a.edit((s) => { s.boards.sub.cards.n1 = s.boards.home.cards.n1; delete s.boards.home.cards.n1; });
  a.receive(b); b.receive(a);
  check('a card moved to another board moves on both computers', b.s.boards.sub.cards.n1 && !b.s.boards.home.cards.n1);
}

// 6. Board deleted on one computer while a card was added inside it on the other.
{
  const withSub = clone(base);
  withSub.boards.sub = board('sub', 'Sub', 'home');
  withSub.boards.home.cards.bc = { id: 'bc', type: 'board', boardId: 'sub', x: 600, y: 0, w: 130, color: null };
  const a = new Device(withSub, 1e6), b = new Device(withSub, 1e6);
  a.edit((s) => { delete s.boards.sub; delete s.boards.home.cards.bc; });
  b.t += 3000;
  b.edit((s) => { s.boards.sub.cards.x1 = note('x1', 'new idea inside the board'); });
  a.receive(b);
  const where = Object.values(a.s.boards).find((bb) => bb.cards.x1);
  check('a card added inside a board deleted elsewhere is rescued, not lost', !!where);
  check('…and the result has no broken board cards', Object.values(a.s.boards).every((bb) => Object.values(bb.cards).every((c) => c.type !== 'board' || a.s.boards[c.boardId])));
}

// 7. Two computers that started separately (different Home boards) combine into one Home.
{
  const other = { version: 1, root: 'zhome', ui: {}, templates: {}, deleted: {},
    boards: { zhome: board('zhome', 'Home', null, [note('z1', 'from second computer')]) } };
  const a = new Device(base, 1e6), b = new Device(other, 1e6);
  a.receive(b); b.receive(a);
  check('separate Home boards combine into one', a.s.root === b.s.root && Object.keys(a.s.boards).length === 1);
  check('…keeping the cards from both', a.cards().join() === 'n1,n2,z1' && b.cards().join() === 'n1,n2,z1');
}

// 8. Columns stay consistent when cards move in and out on different computers.
{
  const withCol = clone(base);
  withCol.boards.home.cards.col = { id: 'col', type: 'column', x: 0, y: 300, w: 280, color: null, title: 'Col', items: [] };
  withCol.boards.home.order.push('col');
  const a = new Device(withCol, 1e6), b = new Device(withCol, 1e6);
  a.edit((s) => { s.boards.home.cards.n1.col = 'col'; s.boards.home.cards.col.items.push('n1'); });
  b.edit((s) => { s.boards.home.cards.n2.col = 'col'; s.boards.home.cards.col.items.push('n2'); });
  a.receive(b); b.receive(a); a.receive(b);
  const items = a.s.boards.home.cards.col.items.slice().sort().join();
  check('cards added to a column on both computers are both in it', items === 'n1,n2');
  check('…and every column card points back at the column', ['n1', 'n2'].every((id) => a.s.boards.home.cards[id].col === 'col'));
}

// 9. Lines to deleted cards are removed; templates sync.
{
  const withLine = clone(base);
  withLine.boards.home.links = [{ id: 'l1', from: 'n1', to: 'n2' }];
  const a = new Device(withLine, 1e6), b = new Device(withLine, 1e6);
  b.edit((s) => { delete s.boards.home.cards.n2; });
  a.edit((s) => { s.templates.t1 = { id: 't1', name: 'My template', payload: { cards: [], boards: {}, links: [] } }; });
  a.receive(b); b.receive(a);
  check('lines to a deleted card disappear', a.s.boards.home.links.length === 0);
  check('saved templates sync', !!b.s.templates.t1);
}

// 10. Board views (scroll/zoom) stay per computer.
{
  const a = new Device(base, 1e6), b = new Device(base, 1e6);
  a.edit((s) => { s.boards.home.view = { x: 500, y: 500, z: 2 }; s.boards.home.cards.n1.html = 'x'; });
  b.receive(a);
  check('scroll and zoom position are not synced', b.s.boards.home.view.z === 1);
}

// 12. Free lines (ends not attached to cards) sync, and lines keep their style.
{
  const a = new Device(base, 1e6), b = new Device(base, 1e6);
  a.edit((s) => {
    s.boards.home.links.push({ id: 'free1', from: null, to: null, fromPt: { x: 10, y: 20 }, toPt: { x: 300, y: 40 }, arrow: 'both', dash: 'dotted' });
    s.boards.home.links.push({ id: 'half1', from: 'n1', to: null, toPt: { x: 500, y: 500 }, arrow: 'none' });
    s.boards.home.links.push({ id: 'bad1', from: null, to: null, fromPt: { x: 1, y: 1 } });
  });
  b.receive(a);
  const ids = b.s.boards.home.links.map((l) => l.id).sort().join();
  check('free-floating lines and half-attached lines sync', ids.includes('free1') && ids.includes('half1'));
  check('…keeping their arrows and dots', b.s.boards.home.links.find((l) => l.id === 'free1').dash === 'dotted' && b.s.boards.home.links.find((l) => l.id === 'free1').arrow === 'both');
  check('…but a line with a missing end is dropped', !ids.includes('bad1'));
}

// 11. Receiving the same thing twice changes nothing.
{
  const a = new Device(base, 1e6), b = new Device(base, 1e6);
  a.edit((s) => { s.boards.home.cards.n1.html = 'v2'; });
  b.receive(a);
  check('receiving the same changes twice is harmless', b.receive(a) === false);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
