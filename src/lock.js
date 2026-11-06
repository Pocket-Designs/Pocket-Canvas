/* Pocket-Canvas — password-protected boards
 * Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
 *
 * A locked board's contents (its cards, lines and every board inside it) are encrypted
 * with AES-256-GCM, using a key made from the password with PBKDF2-SHA256 (310,000
 * rounds) and a random salt. Only the encrypted form is ever saved, backed up or synced:
 *
 *   board.lock = { v: 1, salt, iter, iv, ct, hint }     (base64 strings)
 *   board.cards = {}, board.order = [], board.links = [] (the real ones are inside ct)
 *
 * While a board is unlocked, its decrypted contents live in memory as normal cards so
 * everything else works unchanged. Saving always goes through sealStore(), which swaps
 * unlocked boards back to their encrypted form. A board locks again when you leave it,
 * and every board is locked when the app starts.
 *
 * Pictures and files on a locked board are not encrypted (they're stored as separate
 * files), but you can't see which belong to it without the password.
 */
'use strict';

const LOCK_ITER = 310000;
const LOCK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const unlocked = new Map(); // boardId -> { key, plain, iv, ct }

const te = new TextEncoder(), td = new TextDecoder();
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function lockKey(password, salt, iter) {
  const base = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function sealText(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(text));
  return { iv: toB64(iv), ct: toB64(ct) };
}
async function openText(key, lock) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(lock.iv) }, key, fromB64(lock.ct));
  return td.decode(pt);
}

const isLocked = (id) => !!(store.boards[id] && store.boards[id].lock);
const isUnlocked = (id) => unlocked.has(id);
const isSealed = (id) => isLocked(id) && !isUnlocked(id);

// Every board below `id` (via board cards), in this store.
function descendantBoards(st, id, out = new Set()) {
  const b = st.boards[id];
  if (!b) return out;
  for (const c of Object.values(b.cards)) {
    if (c.type === 'board' && st.boards[c.boardId] && !out.has(c.boardId)) {
      out.add(c.boardId);
      descendantBoards(st, c.boardId, out);
    }
  }
  return out;
}

// What gets encrypted for board `id`: its cards and lines plus every board inside it.
// A locked board inside it is included only in its own encrypted form.
function contentsOf(st, id) {
  const b = st.boards[id];
  const mini = { boards: {} };
  mini.boards[id] = b;
  for (const d of descendantBoards(st, id)) mini.boards[d] = st.boards[d];
  const copy = JSON.parse(JSON.stringify(mini));
  for (const d of Object.keys(copy.boards)) {
    if (d === id || !copy.boards[d] || !copy.boards[d].lock) continue;
    const u = unlocked.get(d);
    if (u) copy.boards[d].lock = { ...copy.boards[d].lock, iv: u.iv, ct: u.ct };
    stripContents(copy, d);
  }
  const top = copy.boards[id];
  delete copy.boards[id];
  return { cards: top.cards, order: top.order, links: top.links, boards: copy.boards };
}

function depthOf(id) {
  let n = 0;
  for (let b = store.boards[id]; b && b.parentId; b = store.boards[b.parentId]) n++;
  return n;
}

function stripContents(st, id) {
  for (const d of descendantBoards(st, id)) delete st.boards[d];
  const b = st.boards[id];
  b.cards = {}; b.order = []; b.links = [];
}

// Re-encrypt unlocked boards whose contents changed since they were last sealed.
async function updateSeals() {
  // Innermost first, so an outer board encrypts the inner board's latest encrypted form.
  const order = [...unlocked.entries()].sort((a, b) => depthOf(b[0]) - depthOf(a[0]));
  for (const [id, u] of order) {
    const b = store.boards[id];
    if (!b || !b.lock) { unlocked.delete(id); continue; }
    const plain = JSON.stringify(contentsOf(store, id));
    if (plain !== u.plain) {
      const s = await sealText(u.key, plain);
      u.plain = plain; u.iv = s.iv; u.ct = s.ct;
    }
    if (b.lock.ct !== u.ct) b.lock = { ...b.lock, iv: u.iv, ct: u.ct };
  }
}

// A copy of the store that is safe to write anywhere: every locked board in encrypted form.
function sealStore(st) {
  const out = JSON.parse(JSON.stringify(st));
  // Outermost locked boards first, so a locked board inside another goes inside its blob.
  const locked = Object.values(out.boards).filter((b) => b.lock).map((b) => b.id);
  for (const id of locked) {
    if (!out.boards[id]) continue; // already inside an outer locked board
    const u = unlocked.get(id);
    if (u) out.boards[id].lock = { ...out.boards[id].lock, iv: u.iv, ct: u.ct };
    stripContents(out, id);
  }
  return out;
}

// After stamping the sealed copy for sync, carry the change times back to the live store.
function copyBackMt(sealed, st) {
  for (const sb of Object.values(sealed.boards)) {
    const b = st.boards[sb.id];
    if (!b) continue;
    b._mt = sb._mt;
    for (const c of Object.values(sb.cards)) if (b.cards[c.id]) b.cards[c.id]._mt = c._mt;
    const lm = new Map(sb.links.map((l) => [l.id, l._mt]));
    for (const l of b.links) if (lm.has(l.id)) l._mt = lm.get(l.id);
  }
  for (const t of Object.values(sealed.templates || {})) if (st.templates[t.id]) st.templates[t.id]._mt = t._mt;
  for (const r of Object.values(sealed.bin || {})) if (st.bin[r.id]) st.bin[r.id]._mt = r._mt;
  st.deleted = sealed.deleted;
}

// Used by saving and by sync: an up-to-date, encrypted, change-stamped copy.
async function prepareSealed() {
  await updateSeals();
  const sealed = sealStore(store);
  syncIndex = PCSync.stamp(sealed, syncIndex, Date.now());
  copyBackMt(sealed, store);
  return sealed;
}

// Put decrypted contents into a store. Any ids that clash with cards elsewhere
// (for example a locked board that was duplicated) are given fresh ids.
function unsealInto(st, id, plain) {
  let contents = JSON.parse(plain);
  const ids = [...Object.keys(contents.cards), ...Object.keys(contents.boards)];
  for (const sb of Object.values(contents.boards)) ids.push(...Object.keys(sb.cards), ...sb.links.map((l) => l.id));
  ids.push(...contents.links.map((l) => l.id));
  const used = new Set();
  for (const b of Object.values(st.boards)) { used.add(b.id); for (const k of Object.keys(b.cards)) used.add(k); }
  let remapped = false;
  if (ids.some((x) => used.has(x))) {
    const map = {};
    ids.forEach((x) => { map[x] = uid(); });
    const re = new RegExp(`"(${Object.keys(map).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})"`, 'g');
    contents = JSON.parse(JSON.stringify(contents).replace(re, (_m, x) => `"${map[x]}"`));
    remapped = true;
  }
  const b = st.boards[id];
  b.cards = contents.cards; b.order = contents.order; b.links = contents.links;
  for (const sb of Object.values(contents.boards)) st.boards[sb.id] = sb;
  for (const c of Object.values(contents.cards)) if (c.type === 'board' && st.boards[c.boardId]) st.boards[c.boardId].parentId = id;
  return remapped;
}

// After sync brings in a new store: keep unlocked boards open (re-decrypting if they changed elsewhere).
async function reopenUnlocked(st) {
  for (const [id, u] of [...unlocked]) {
    const b = st.boards[id];
    if (!b || !b.lock) { unlocked.delete(id); continue; }
    let plain = u.plain;
    if (b.lock.ct !== u.ct) {
      try { plain = await openText(u.key, b.lock); } catch {
        // Password changed on another computer: lock it here too.
        unlocked.delete(id);
        continue;
      }
      u.plain = plain; u.iv = b.lock.iv; u.ct = b.lock.ct;
    }
    unsealInto(st, id, plain);
  }
}

// ---------- Unlocking ----------
async function askPasswordFor(id) {
  const b = store.boards[id];
  let key = null, plain = null;
  const v = await askText({
    title: `Unlock “${b.title}”`,
    ok: 'Unlock',
    intro: `<div class="lock-intro">${LOCK_ICON}<span>This board is protected with a password.${b.lock.hint ? `<br><span class="muted">Hint: ${esc(b.lock.hint)}</span>` : ''}</span></div>`,
    fields: [{ name: 'password', label: 'Password', type: 'password' }],
    validate: async (out) => {
      try {
        key = await lockKey(out.password, fromB64(b.lock.salt), b.lock.iter || LOCK_ITER);
        plain = await openText(key, b.lock);
        return null;
      } catch { return 'That password isn’t right. Check Caps Lock and try again.'; }
    }
  });
  if (!v) return false;
  const remapped = unsealInto(store, id, plain);
  unlocked.set(id, { key, plain: remapped ? null : plain, iv: b.lock.iv, ct: b.lock.ct });
  // Keep undo history from mixing locked and unlocked states.
  undoStack = []; redoStack = []; updateUndoBtns();
  if (remapped) scheduleSave();
  return true;
}

// Called by go(): returns true if go() should stop because a password is needed first.
function lockGate(bid, focusId) {
  // Opening a board that is (or is inside) a locked board that isn't open yet.
  for (let b = store.boards[bid]; b; b = store.boards[b.parentId]) {
    if (b.lock && !unlocked.has(b.id)) {
      askPasswordFor(b.id).then((ok) => { if (ok) { renderTree(); go(bid, focusId); } });
      return true;
    }
  }
  return false;
}

// Lock again any unlocked board that we're no longer inside.
async function relockLeftBoards() {
  for (const id of [...unlocked.keys()]) {
    if (cur === id || isDescendant(cur, id)) continue;
    await relock(id);
  }
}

async function relock(id) {
  if (!unlocked.has(id)) return;
  await updateSeals();
  // Boards inside it that have their own lock are sealed first.
  for (const inner of [...unlocked.keys()]) if (inner !== id && isDescendant(inner, id)) await relock(inner);
  if (store.boards[id]) stripContents(store, id);
  unlocked.delete(id);
  // Undo history could otherwise bring decrypted cards back.
  undoStack = []; redoStack = []; updateUndoBtns();
  if (cur === id || isDescendant(cur, id)) { const p = store.boards[id].parentId; go(p || store.root); }
  renderTree();
  if (store.boards[cur]) renderBoard();
  scheduleSave();
}

// ---------- Locking, changing and removing ----------
const PASSWORD_WARNING = `<div class="lock-warn"><b>Don’t forget it.</b> The board is encrypted with this password. If it’s lost, nobody can open the board, not even Pocket-Designs. A hint can help you remember.</div>`;

function checkNewPassword(out) {
  if (out.password.length < 6) return 'Use at least 6 characters.';
  if (out.password !== out.repeat) return 'The two passwords don’t match.';
  if (out.hint && out.password && out.hint.toLowerCase().includes(out.password.toLowerCase())) return 'The hint mustn’t contain the password.';
  return null;
}

async function lockBoard(id) {
  if (id === store.root) { toast('Home can’t be locked. Put private things on a board of their own.'); return; }
  const b = store.boards[id];
  if (!b || b.lock) return;
  const v = await askText({
    title: `Lock “${b.title}” with a password`,
    ok: 'Lock board',
    intro: PASSWORD_WARNING,
    fields: [
      { name: 'password', label: 'Password', type: 'password' },
      { name: 'repeat', label: 'Type it again', type: 'password' },
      { name: 'hint', label: 'Hint (optional, not secret)', required: false }
    ],
    validate: checkNewPassword
  });
  if (!v) return;
  // A board inside that has its own lock must be closed first.
  for (const inner of [...unlocked.keys()]) if (isDescendant(inner, id)) await relock(inner);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await lockKey(v.password, salt, LOCK_ITER);
  const plain = JSON.stringify(contentsOf(store, id));
  const s = await sealText(key, plain);
  checkpoint();
  b.lock = { v: 1, salt: toB64(salt), iter: LOCK_ITER, iv: s.iv, ct: s.ct, hint: (v.hint || '').slice(0, 100) };
  unlocked.set(id, { key, plain, iv: s.iv, ct: s.ct });
  undoStack = []; redoStack = []; updateUndoBtns();
  if (!(cur === id || isDescendant(cur, id))) await relock(id);
  renderTree(); renderBoard(); scheduleSave();
  toast(`“${b.title}” is locked. It will ask for the password when opened.`);
}

async function changePassword(id) {
  const b = store.boards[id], u = unlocked.get(id);
  if (!b || !u) return;
  const v = await askText({
    title: `New password for “${b.title}”`,
    ok: 'Change password',
    intro: PASSWORD_WARNING,
    fields: [
      { name: 'password', label: 'New password', type: 'password' },
      { name: 'repeat', label: 'Type it again', type: 'password' },
      { name: 'hint', label: 'Hint (optional, not secret)', value: b.lock.hint || '', required: false }
    ],
    validate: checkNewPassword
  });
  if (!v) return;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const oldKey = u.key;
  const newKey = await lockKey(v.password, salt, LOCK_ITER);
  // Recycle-bin items from this board are re-encrypted with the new password too.
  for (const e of Object.values(store.bin || {})) {
    if (!e.sealed || e.lockedBoard !== id) continue;
    try { e.sealed = await sealText(newKey, await openText(oldKey, e.sealed)); } catch {}
  }
  u.key = newKey;
  u.plain = null; // forces re-encryption with the new key
  b.lock = { ...b.lock, salt: toB64(salt), iter: LOCK_ITER, hint: (v.hint || '').slice(0, 100) };
  await updateSeals();
  scheduleSave();
  toast('Password changed');
}

async function removePassword(id) {
  const b = store.boards[id];
  if (!b || !unlocked.has(id)) return;
  if (!(await api.confirm(`Remove the password from “${b.title}”?`, 'Its contents will no longer be encrypted, and anyone using this computer can open it.'))) return;
  checkpoint();
  delete b.lock;
  unlocked.delete(id);
  renderTree(); renderBoard(); scheduleSave();
  toast('Password removed');
}

function lockMenuItems(id) {
  if (id === store.root) return [];
  const b = store.boards[id];
  if (!b) return [];
  if (!b.lock && typeof spaceOfBoard === 'function' && spaceOfBoard(id)) return []; // shared boards can't have a password
  if (!b.lock) return [{ label: 'Lock with a password…', run: () => lockBoard(id) }];
  if (!unlocked.has(id)) return [{ label: 'Unlock…', run: () => go(id) }];
  return [
    { label: 'Lock now', run: () => relock(id) },
    { label: 'Change password…', run: () => changePassword(id) },
    { label: 'Remove password…', run: () => removePassword(id) }
  ];
}
