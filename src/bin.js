/* Pocket-Canvas — Recycle bin
 * Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
 *
 * Deleted cards and boards go to store.bin. Each entry holds everything needed to put
 * them back (cards, boards inside them, lines). Entries older than BIN_DAYS are removed
 * for good. The bin syncs between computers like everything else.
 */
'use strict';

const BIN_DAYS = 30;
const BIN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13M10 11v5M14 11v5"/></svg>';

function binCount() { return Object.keys(store.bin || {}).length; }

function updateBinButton() {
  const n = binCount();
  const b = $('#bin-btn');
  if (b) { b.querySelector('span').textContent = n ? String(n) : ''; b.title = n ? `Recycle bin (${n})` : 'Recycle bin (empty)'; }
}

// Move cards (and any boards they hold) from board `b` into the bin.
// The unlocked locked board that `boardId` is (or is inside), if any.
function lockedOwner(boardId) {
  for (let x = store.boards[boardId]; x; x = store.boards[x.parentId]) if (x.lock && isUnlocked(x.id)) return x.id;
  return null;
}

async function moveCardsToBin(b, ids, { quiet = false } = {}) {
  ids = ids.filter((id) => b.cards[id]);
  if (!ids.length) return null;
  store.bin = store.bin || {};
  const payload = serialize(ids, b);
  const inPayload = new Set(payload.cards.map((c) => c.id));
  // lines joining these cards to cards that stay behind
  const crossLinks = b.links.filter((l) => lineCards(l).some((id) => inPayload.has(id)) && !lineCards(l).every((id) => inPayload.has(id)));
  // Cards taken out of a column remember where the column was.
  const colPos = {};
  for (const c of payload.cards) {
    if (c.col && !inPayload.has(c.col) && b.cards[c.col]) colPos[c.id] = { x: b.cards[c.col].x, y: b.cards[c.col].y, col: c.col };
  }
  const first = b.cards[ids[0]];
  const boardTitle = (c) => (store.boards[c.boardId] && store.boards[c.boardId].title) || 'Untitled board';
  const label = ids.length === 1
    ? (first.type === 'board' ? boardTitle(first) : cardLabel(first))
    : `${ids.length} cards`;
  const entry = {
    id: uid(),
    kind: ids.length === 1 && first.type === 'board' ? 'board' : 'cards',
    label: label.slice(0, 120),
    types: [...new Set(ids.map((id) => b.cards[id].type))],
    count: payload.cards.length + Object.values(payload.boards).reduce((n, sb) => n + Object.keys(sb.cards).length, 0),
    from: b.id,
    fromTitle: b.title,
    deletedAt: Date.now(),
    payload, crossLinks, colPos
  };
  // Cards from inside a locked board are kept encrypted with that board's key.
  const owner = lockedOwner(b.id);
  if (owner) {
    const secret = JSON.stringify({ payload: entry.payload, crossLinks: entry.crossLinks, colPos: entry.colPos, label: entry.label });
    entry.sealed = await sealText(unlocked.get(owner).key, secret);
    entry.lockedBoard = owner;
    entry.label = ids.length === 1 ? 'A card from a locked board' : `${ids.length} cards from a locked board`;
    delete entry.payload; delete entry.crossLinks; delete entry.colPos;
  }
  removeCards(b, ids, { deleteBoards: true });
  store.bin[entry.id] = entry;
  updateBinButton();
  if (!quiet) {
    toast(`Moved ${entry.kind === 'board' ? `the board “${entry.label}”` : ids.length === 1 ? 'a card' : `${ids.length} cards`} to the Recycle bin`,
      { label: 'Undo', run: () => restoreFromBin(entry.id, { silent: true }) });
  }
  return entry;
}

// Delete a whole board (from the sidebar, or from inside it).
async function deleteBoard(boardId) {
  if (boardId === store.root) { toast('Home can’t be deleted'); return; }
  const sb = store.boards[boardId];
  if (!sb) return;
  const parent = store.boards[sb.parentId];
  const card = parent && Object.values(parent.cards).find((c) => c.type === 'board' && c.boardId === boardId);
  if (!card) return;
  if (cur === boardId || isDescendant(cur, boardId)) go(parent.id);
  // An open locked board is closed first, so it goes into the bin encrypted.
  for (const id of [...unlocked.keys()]) if (id === boardId || isDescendant(id, boardId)) await relock(id);
  checkpoint();
  await moveCardsToBin(parent, [card.id]);
  if (cur === parent.id) renderBoard();
  renderTree(); scheduleSave();
}

function idsInUse(payload) {
  const ids = [...payload.cards.map((c) => c.id), ...Object.keys(payload.boards)];
  for (const sb of Object.values(payload.boards)) ids.push(...Object.keys(sb.cards));
  const all = new Set();
  for (const b of Object.values(store.boards)) { all.add(b.id); for (const id of Object.keys(b.cards)) all.add(id); }
  return ids.some((id) => all.has(id));
}

async function restoreFromBin(entryId, { silent = false } = {}) {
  let e = store.bin && store.bin[entryId];
  if (!e) return;
  if (e.sealed) {
    const u = unlocked.get(e.lockedBoard);
    const lb = store.boards[e.lockedBoard];
    if (!u) { toast(lb ? `Open “${lb.title}” with its password first, then restore this.` : 'The locked board this came from no longer exists, so it can’t be opened.'); return; }
    try { e = { ...e, ...JSON.parse(await openText(u.key, e.sealed)) }; } catch { toast('This item can’t be opened with the board’s current password.'); return; }
  }
  let target = store.boards[e.from];
  if (!target || (target.lock && !isUnlocked(target.id))) target = store.boards[store.root];
  checkpoint();
  const p = JSON.parse(JSON.stringify(e.payload));
  if (idsInUse(p)) {
    insertPayload(p, 0, 0, target); // already back somewhere (e.g. restored on another computer): add a copy
  } else {
    const inP = new Set(p.cards.map((c) => c.id));
    for (const c of p.cards) {
      if (c.col && !inP.has(c.col)) {
        const col = target.cards[c.col];
        if (col && col.type === 'column') { if (!col.items.includes(c.id)) col.items.push(c.id); }
        else { const pos = e.colPos && e.colPos[c.id]; delete c.col; c.x = pos ? pos.x + 320 : 40; c.y = pos ? pos.y : 40; }
      }
      target.cards[c.id] = c;
      target.order.push(c.id);
    }
    for (const sb of Object.values(p.boards)) store.boards[sb.id] = sb;
    for (const c of p.cards) if (c.type === 'board' && store.boards[c.boardId]) store.boards[c.boardId].parentId = target.id;
    target.links.push(...p.links);
    for (const l of e.crossLinks || []) if (lineValid(l, target)) target.links.push(l);
  }
  delete store.bin[entryId];
  updateBinButton();
  if (target.id === cur) renderBoard();
  renderTree(); scheduleSave();
  if (!silent) toast(`Restored “${e.label}” to ${target.title}`, target.id === cur ? null : { label: 'Go there', run: () => go(target.id) });
  if (binModal) drawBin();
}

function deleteForever(entryId) {
  if (!store.bin || !store.bin[entryId]) return;
  checkpoint();
  delete store.bin[entryId];
  updateBinButton(); scheduleSave();
}

// Remove entries older than BIN_DAYS. Runs at start-up and every hour.
function purgeBin() {
  if (!store || !store.bin) return;
  const cutoff = Date.now() - BIN_DAYS * 864e5;
  let n = 0;
  for (const [id, e] of Object.entries(store.bin)) if (e.deletedAt < cutoff) { delete store.bin[id]; n++; }
  if (n) { updateBinButton(); scheduleSave(); }
}

// ---------- The Recycle bin window ----------
let binModal = null;

function daysLeft(e) {
  return Math.max(0, Math.ceil((e.deletedAt + BIN_DAYS * 864e5 - Date.now()) / 864e5));
}

function drawBin() {
  if (!binModal) return;
  const list = Object.values(store.bin || {}).sort((a, b) => b.deletedAt - a.deletedAt);
  const icon = (e) => e.kind === 'board' ? ICONS.board : ICONS[e.types && e.types.length === 1 ? e.types[0] : 'note'] || ICONS.note;
  binModal.body.innerHTML = list.length ? `
    <p class="muted small">Deleted cards and boards stay here for ${BIN_DAYS} days, then they’re removed for good.</p>
    <div class="bin-list">${list.map((e) => `
      <div class="bin-row" data-id="${esc(e.id)}">
        <div class="bin-ico">${icon(e)}</div>
        <div class="bin-main">
          <div class="bin-label">${esc(e.kind === 'board' ? 'Board: ' + e.label : e.label)}</div>
          <div class="muted small">From ${esc(e.fromTitle || 'a board')} · deleted ${esc(timeAgo(e.deletedAt))}${e.count > 1 ? ` · ${e.count} cards` : ''} · <span title="Removed for good after ${BIN_DAYS} days">${daysLeft(e)} day${daysLeft(e) === 1 ? '' : 's'} left</span></div>
        </div>
        <button class="ghost-btn" data-bin="restore">Restore</button>
        <button class="ghost-btn danger" data-bin="forever" title="Delete for good">Delete</button>
      </div>`).join('')}
    </div>`
    : `<div class="bin-empty">${BIN_ICON}<p>The Recycle bin is empty.</p><p class="muted small">Cards and boards you delete come here, and can be restored for ${BIN_DAYS} days.</p></div>`;
  const empty = binModal.el.querySelector('[data-bin-empty]');
  if (empty) empty.disabled = !list.length;
}

function openBin() {
  binModal = openModal({
    title: 'Recycle bin', body: '', wide: true, className: 'bin-modal',
    actions: [
      { label: 'Empty Recycle bin', danger: true, run: async () => {
        if (!binCount()) return;
        if (!(await api.confirm(`Delete everything in the Recycle bin for good?`, `${binCount()} item${binCount() === 1 ? '' : 's'} will be deleted. This can be undone with Ctrl+Z straight afterwards.`))) return;
        checkpoint(); store.bin = {}; updateBinButton(); scheduleSave(); drawBin();
      } },
      { label: 'Close', primary: true }
    ],
    onClose: () => { binModal = null; }
  });
  const btns = binModal.el.querySelectorAll('.modal-actions button');
  btns[0].setAttribute('data-bin-empty', '');
  binModal.body.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-bin]');
    if (!b) return;
    const id = b.closest('.bin-row').dataset.id;
    if (b.dataset.bin === 'restore') restoreFromBin(id);
    if (b.dataset.bin === 'forever') {
      const e = store.bin[id];
      if (!(await api.confirm(`Delete “${e.label}” for good?`, 'It will be removed from the Recycle bin.'))) return;
      deleteForever(id); drawBin();
    }
  });
  drawBin();
}
