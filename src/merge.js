/* Pocket-Canvas — sync merge engine
 * Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
 *
 * Shared by the interface (window.PCSync) and the tests (require('./src/merge.js')).
 *
 * Every board, card, line and template carries `_mt`: the time it last changed.
 * Deleted things leave a "tombstone" in store.deleted[id] = time.
 * Merging two copies keeps, for each item, whichever version changed last, unless
 * it was deleted after that. The result is then tidied so it is always valid
 * (no orphan cards, no broken columns, every board reachable from Home).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PCSync = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TOMBSTONE_DAYS = 60;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const strip = (o) => { const { _mt, ...rest } = o; return rest; };
  const boardMeta = (b) => ({ title: b.title, parentId: b.parentId, color: b.color, icon: b.icon, iconAsset: b.iconAsset, lock: b.lock, order: b.order, pages: b.pages });

  // Flatten a store into keyed items with a comparable fingerprint.
  function items(state) {
    const m = new Map();
    for (const b of Object.values(state.boards || {})) {
      m.set('b:' + b.id, { kind: 'b', id: b.id, obj: b, mt: b._mt || 0, json: JSON.stringify(boardMeta(b)) });
      for (const c of Object.values(b.cards || {})) {
        m.set('c:' + c.id, { kind: 'c', id: c.id, boardId: b.id, obj: c, mt: c._mt || 0, json: JSON.stringify([b.id, strip(c)]) });
      }
      for (const l of b.links || []) {
        m.set('l:' + l.id, { kind: 'l', id: l.id, boardId: b.id, obj: l, mt: l._mt || 0, json: JSON.stringify([b.id, strip(l)]) });
      }
    }
    for (const r of Object.values(state.bin || {})) {
      m.set('r:' + r.id, { kind: 'r', id: r.id, obj: r, mt: r._mt || 0, json: JSON.stringify(strip(r)) });
    }
    for (const t of Object.values(state.templates || {})) {
      m.set('t:' + t.id, { kind: 't', id: t.id, obj: t, mt: t._mt || 0, json: JSON.stringify(strip(t)) });
    }
    return m;
  }

  function buildIndex(state) {
    const idx = new Map();
    for (const [k, it] of items(state)) idx.set(k, it.json);
    return idx;
  }

  function pruneTombstones(deleted, now) {
    const cutoff = now - TOMBSTONE_DAYS * 864e5;
    for (const [id, t] of Object.entries(deleted)) if (t < cutoff) delete deleted[id];
  }

  // Mark everything that changed since `index` with time `now`, and record deletions.
  // Mutates `store`; returns the new index.
  function stamp(store, index, now) {
    store.deleted = store.deleted || {};
    const cur = items(store);
    const next = new Map();
    for (const [k, it] of cur) {
      next.set(k, it.json);
      if (index.get(k) !== it.json) it.obj._mt = now;
      if (store.deleted[it.id] !== undefined) delete store.deleted[it.id];
    }
    for (const k of index.keys()) {
      if (!next.has(k)) store.deleted[k.slice(2)] = now;
    }
    pruneTombstones(store.deleted, now);
    return next;
  }

  // The part of the store shared with other computers.
  function syncState(store) {
    return { root: store.root, boards: store.boards, templates: store.templates || {}, bin: store.bin || {}, deleted: store.deleted || {} };
  }

  function fingerprint(state) {
    const boards = {};
    for (const b of Object.values(state.boards || {})) {
      const { view, ...rest } = b;
      rest.cards = sortKeys(rest.cards || {});
      boards[b.id] = rest;
    }
    return JSON.stringify([state.root, sortKeys(boards), sortKeys(state.templates || {}), sortKeys(state.bin || {}), sortKeys(state.deleted || {})]);
  }
  function sortKeys(o) {
    const out = {};
    for (const k of Object.keys(o).sort()) out[k] = o[k];
    return out;
  }

  // Merge `remote` into `local`. Returns { store, changed }. `local.ui` and board views are kept.
  function merge(local, remote, now = Date.now()) {
    const L = items(local);
    const R = items(remote);
    const deleted = { ...(local.deleted || {}) };
    for (const [id, t] of Object.entries(remote.deleted || {})) deleted[id] = Math.max(deleted[id] || 0, t);

    const win = new Map();
    for (const k of new Set([...L.keys(), ...R.keys()])) {
      const a = L.get(k), b = R.get(k);
      let pick;
      if (!a) pick = b;
      else if (!b) pick = a;
      else if (b.mt !== a.mt) pick = b.mt > a.mt ? b : a;
      else pick = b.json > a.json ? b : a; // same time, different content: same choice on every computer
      if (deleted[pick.id] !== undefined && deleted[pick.id] >= pick.mt) continue;
      win.set(k, pick);
    }

    // Rebuild boards.
    const boards = {};
    for (const it of win.values()) {
      if (it.kind !== 'b') continue;
      const src = it.obj;
      const localBoard = (local.boards || {})[it.id];
      boards[it.id] = {
        id: src.id, title: src.title, parentId: src.parentId ?? null, color: src.color,
        ...(src.icon ? { icon: src.icon } : {}), ...(src.iconAsset ? { iconAsset: src.iconAsset } : {}),
        ...(src.lock ? { lock: clone(src.lock) } : {}),
        ...(src.pages ? { pages: clone(src.pages) } : {}),
        cards: {}, order: [...(src.order || [])], links: [],
        view: clone((localBoard && localBoard.view) || src.view || { x: 40, y: 40, z: 1 }),
        _mt: src._mt || 0
      };
    }
    const templates = {};
    const bin = {};
    const orphans = [];
    for (const it of win.values()) {
      if (it.kind === 'c') {
        const c = clone(it.obj);
        if (boards[it.boardId]) boards[it.boardId].cards[c.id] = c;
        else orphans.push(c);
      } else if (it.kind === 'l') {
        if (boards[it.boardId]) boards[it.boardId].links.push(clone(it.obj));
      } else if (it.kind === 't') {
        templates[it.id] = clone(it.obj);
      } else if (it.kind === 'r') {
        bin[it.id] = clone(it.obj);
      }
    }

    // Choose Home. Two computers that started separately each have their own Home board:
    // both pick the same one (the smaller id) and the other's cards move into it.
    let rootId = null;
    const lr = local.root, rr = remote.root;
    if (boards[lr] && boards[rr] && lr !== rr) {
      rootId = lr < rr ? lr : rr;
      const other = rootId === lr ? rr : lr;
      absorbBoard(boards, rootId, other, deleted, now);
    } else rootId = boards[lr] ? lr : boards[rr] ? rr : null;
    if (!rootId) {
      // Should never happen, but never return a store without Home.
      rootId = lr || rr || 'home';
      boards[rootId] = { id: rootId, title: 'Home', parentId: null, color: '#8a7f70', cards: {}, order: [], links: [], view: { x: 40, y: 40, z: 1 }, _mt: now };
    }
    boards[rootId].parentId = null;

    // Cards whose board was deleted elsewhere: rescue them onto Home.
    for (const c of orphans) {
      delete c.col;
      c._mt = now;
      boards[rootId].cards[c.id] = c;
    }

    tidy(boards, rootId, deleted, now);
    pruneTombstones(deleted, now);

    const store = { ...local, root: rootId, boards, templates, bin, deleted };
    const changed = fingerprint(store) !== fingerprint(local);
    return { store, changed };
  }

  function absorbBoard(boards, intoId, fromId, deleted, now) {
    const into = boards[intoId], from = boards[fromId];
    const top = (b) => Object.values(b.cards).filter((c) => !c.col);
    const maxX = Math.max(0, ...top(into).map((c) => (c.x || 0) + (c.w || 240)));
    const minX = Math.min(...top(from).map((c) => c.x || 0), Infinity);
    const dx = top(into).length && isFinite(minX) ? maxX + 200 - minX : 0;
    for (const c of Object.values(from.cards)) {
      if (!c.col) c.x = (c.x || 0) + dx;
      c._mt = now;
      into.cards[c.id] = c;
      into.order.push(c.id);
    }
    for (const l of from.links) { l._mt = now; into.links.push(l); }
    for (const b of Object.values(boards)) if (b.parentId === fromId) { b.parentId = intoId; b._mt = now; }
    delete boards[fromId];
    deleted[fromId] = now;
  }

  // Make the merged result consistent.
  function tidy(boards, rootId, deleted, now) {
    // Columns and their cards must agree.
    for (const b of Object.values(boards)) {
      for (const c of Object.values(b.cards)) {
        if (c.col) {
          const col = b.cards[c.col];
          if (!col || col.type !== 'column') { delete c.col; c._mt = now; }
        }
      }
      for (const col of Object.values(b.cards)) {
        if (col.type !== 'column') continue;
        const before = JSON.stringify(col.items || []);
        const items = (col.items || []).filter((id, i, arr) => b.cards[id] && b.cards[id].col === col.id && arr.indexOf(id) === i);
        for (const c of Object.values(b.cards)) if (c.col === col.id && !items.includes(c.id)) items.push(c.id);
        col.items = items;
        if (JSON.stringify(items) !== before) col._mt = now;
      }
    }

    // Board cards must point at a board that exists.
    for (const b of Object.values(boards)) {
      for (const c of Object.values(b.cards)) {
        if (c.type === 'board' && !boards[c.boardId]) {
          delete b.cards[c.id];
          deleted[c.id] = now;
          if (c.col && b.cards[c.col]) b.cards[c.col].items = b.cards[c.col].items.filter((x) => x !== c.id);
        }
      }
    }

    // Every board except Home is shown by exactly one board card, and parentId says where that card is.
    const holder = {};
    for (const b of Object.values(boards)) {
      for (const c of Object.values(b.cards)) {
        if (c.type !== 'board') continue;
        if (holder[c.boardId] || c.boardId === rootId) { // a second card for the same board: drop it
          delete b.cards[c.id]; deleted[c.id] = now;
          if (c.col && b.cards[c.col]) b.cards[c.col].items = b.cards[c.col].items.filter((x) => x !== c.id);
          continue;
        }
        holder[c.boardId] = { board: b.id, card: c };
      }
    }
    for (const b of Object.values(boards)) {
      if (b.id === rootId) continue;
      if (!holder[b.id]) {
        const parent = boards[b.parentId] && b.parentId !== b.id ? boards[b.parentId] : boards[rootId];
        const card = { id: 'bc-' + b.id, type: 'board', boardId: b.id, x: 40, y: 40, w: 130, color: b.color || null, _mt: now };
        parent.cards[card.id] = card;
        delete deleted[card.id];
        holder[b.id] = { board: parent.id, card };
      }
      if (b.parentId !== holder[b.id].board) { b.parentId = holder[b.id].board; b._mt = now; }
    }
    // No loops: every board must lead back to Home.
    for (const b of Object.values(boards)) {
      const seen = new Set();
      let p = b;
      while (p && p.id !== rootId && !seen.has(p.id)) { seen.add(p.id); p = boards[p.parentId]; }
      if (!p || p.id !== rootId) {
        const h = holder[b.id];
        const card = boards[h.board].cards[h.card.id];
        if (card) {
          delete boards[h.board].cards[card.id];
          if (card.col && boards[h.board].cards[card.col]) {
            const col = boards[h.board].cards[card.col];
            col.items = col.items.filter((x) => x !== card.id); col._mt = now;
          }
          delete card.col;
          card._mt = now;
          boards[rootId].cards[card.id] = card;
        }
        b.parentId = rootId; b._mt = now;
        holder[b.id] = { board: rootId, card };
      }
    }

    // Stacking order and lines.
    for (const b of Object.values(boards)) {
      const order = b.order.filter((id, i, arr) => b.cards[id] && arr.indexOf(id) === i);
      for (const id of Object.keys(b.cards)) if (!order.includes(id)) order.push(id);
      b.order = order;
      // each end must be a card on this board or a free point on it
      const endOk = (l, w) => (l[w] ? !!b.cards[l[w]] : !!(l[w + 'Pt'] && isFinite(l[w + 'Pt'].x) && isFinite(l[w + 'Pt'].y)));
      b.links = b.links.filter((l) => endOk(l, 'from') && endOk(l, 'to') && !(l.from && l.from === l.to));
    }
  }

  return { stamp, buildIndex, merge, syncState, fingerprint, TOMBSTONE_DAYS };
});
