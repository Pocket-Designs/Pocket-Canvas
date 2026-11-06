/* Pocket-Canvas — renderer
 * Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
 * MIT licence.
 */
'use strict';

// ======================================================================
// Basics
// ======================================================================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => {
  const r = new Uint32Array(2); crypto.getRandomValues(r);
  return r[0].toString(36).padStart(7, '0').slice(0, 7) + r[1].toString(36).slice(0, 3) + Date.now().toString(36).slice(-4);
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const viewport = $('#viewport');
const world = $('#world');
const cardsEl = $('#cards');
const linksG = $('#links-g');

const COLORS = ['#e0673a', '#e8a33d', '#d9bf2b', '#5bb276', '#38a3a5', '#3a7be0',
  '#6a5fd6', '#c4579f', '#d0453b', '#8a7f70', '#57534e', null];

const DEFAULT_W = { note: 240, heading: 360, todo: 250, link: 280, image: 300, file: 270, board: 130, column: 280, swatch: 140, table: 380, sketch: 320, media: 320 };

const ICONS = {
  note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  todo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="5" height="5" rx="1"/><path d="M4.3 6.6l1 1 1.6-2"/><rect x="3" y="14" width="5" height="5" rx="1"/><path d="M11 6.5h10M11 16.5h10"/></svg>',
  line: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19L19 5"/><path d="M11 5h8v8"/></svg>',
  board: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/></svg>',
  column: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="7.5" height="18" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="12" rx="1.5"/></svg>',
  heading: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 5h14M12 5v15"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M3 17l5-4.5 4 3.5 3.5-3 5.5 4.5"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
  swatch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M3.5 12h8.5" opacity=".5"/></svg>',
  table: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.5h18M3 14.8h18M9 4v16M15 4v16"/></svg>',
  sketch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17c3-6 5-8 7-6s-1 5 1 6 4-5 6-7 3 1 4 2"/><path d="M15 3.5l3 3-8 8H7v-3z" opacity=".55"/></svg>',
  media: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.3v5.4l4.6-2.7z" fill="currentColor"/></svg>',
  comment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>'
};

const TOOLS = [
  ['note', 'Note'], ['link', 'Link'], ['todo', 'To-do'], ['line', 'Line'], ['board', 'Board'],
  ['column', 'Column'], ['table', 'Table'], ['sketch', 'Sketch'], 'sep',
  ['heading', 'Heading'], ['image', 'Image'], ['media', 'Media'], ['file', 'File'], ['swatch', 'Colour']
];

const IMAGE_RE = /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i;
const AUDIO_RE = /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|weba)$/i;
const VIDEO_RE = /\.(mp4|m4v|webm|ogv|mov|mkv)$/i;
function fileKind(name, type = '') {
  if (/^image\//.test(type) || IMAGE_RE.test(name)) return 'image';
  if (/^video\//.test(type) || VIDEO_RE.test(name)) return 'video';
  if (/^audio\//.test(type) || AUDIO_RE.test(name)) return 'audio';
  return 'file';
}

// ======================================================================
// State
// ======================================================================
let store = null;
let cur = null;               // current board id
let assetBase = '';
const selected = new Set();   // selected card ids
let selectedLink = null;
let tool = null;              // 'connect' while drawing a line
let connectFrom = null;
let spaceDown = false;
let undoStack = [];
let redoStack = [];
let editSnap = null;
let saveTimer = null;
const urlEditing = new Set(); // link cards showing the URL field
const previewLoading = new Set(); // link cards waiting for a preview
let syncIndex = new Map();
let lastDragEnd = 0;          // so a drag doesn't also count as a click    // what each item looked like at the last save (for sync change-tracking)
let settingsCache = { userName: 'Me', linkPreviews: true };
const EXPORT_MODE = new URLSearchParams(location.search).get('export');

const B = () => store.boards[cur];

function newBoard(title, parentId, color = '#8a7f70') {
  const b = { id: uid(), title, parentId, color, icon: 'board', cards: {}, order: [], links: [], view: DEFAULT_VIEW() };
  store.boards[b.id] = b;
  return b;
}

// Default fields for each card type (also used by templates).
function cardDefaults(type) {
  switch (type) {
    case 'note': return { html: '' };
    case 'heading': return { text: '' };
    case 'todo': return { title: '', items: [{ id: uid(), text: '', done: false }] };
    case 'link': return { url: '', title: '' };
    case 'image': return { asset: '', caption: '' };
    case 'file': return { asset: '', name: '', size: 0 };
    case 'column': return { title: '', items: [] };
    case 'swatch': return { hex: '#e0673a', title: '', nameAuto: true };
    case 'table': return { header: true, rows: [['', '', ''], ['', '', ''], ['', '', '']] };
    case 'sketch': return { vw: 640, vh: 440, strokes: [] };
    case 'media': return { asset: '', name: '', size: 0, kind: 'audio', caption: '' };
    default: return {};
  }
}

function makeCard(b, type, x, y, extra = {}) {
  const c = { id: uid(), type, x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)), w: DEFAULT_W[type] || 240, color: null, ...cardDefaults(type) };
  switch (type) {
    case 'board': {
      const child = newBoard(extra.title || 'Untitled board', b.id, extra.color || '#8a7f70');
      if (extra.icon) child.icon = extra.icon;
      c.boardId = child.id; c.color = child.color;
      break;
    }
  }
  Object.assign(c, extra);
  c.x = Math.max(0, Math.round(c.x)); c.y = Math.max(0, Math.round(c.y));
  if (type === 'board') { delete c.title; delete c.icon; }
  if (type === 'swatch' && !extra.title) { c.title = colourName(c.hex); c.nameAuto = true; }
  b.cards[c.id] = c;
  b.order.push(c.id);
  return c;
}

function defaultStore() {
  store = { version: 1, root: null, boards: {}, templates: {}, bin: {}, deleted: {}, ui: { theme: null, collapsed: {}, sidebar: true } };
  const home = newBoard('Home', null);
  store.root = home.id;
  const h = makeCard(home, 'heading', 60, 40, { text: 'Welcome to Pocket-Canvas', w: 460 });
  const n = makeCard(home, 'note', 60, 150, {
    w: 300,
    html: '<p><b>Pocket-Canvas</b> is a visual board for ideas, projects and mood boards.</p><p><br></p><ul><li>Drag tools from the left onto the board</li><li>Click a card to select it, click again to edit</li><li>Drag cards onto a <b>board</b> to file them away</li><li>Paste images or links straight onto the board</li></ul>'
  });
  const t = makeCard(home, 'todo', 420, 120, {
    title: 'Try these', items: [
      { id: uid(), text: 'Open “My first board”', done: false },
      { id: uid(), text: 'Draw a line between two cards', done: false },
      { id: uid(), text: 'Right-click a card to change its colour', done: true }
    ], color: '#5bb276'
  });
  makeCard(home, 'board', 720, 120, { title: 'My first board', color: '#3a7be0' });
  const col = makeCard(home, 'column', 880, 120, { title: 'Ideas', color: '#e8a33d' });
  const inCol = makeCard(home, 'note', 0, 0, { html: '<p>Columns keep cards neatly stacked. Drag cards in and out.</p>' });
  inCol.col = col.id; col.items.push(inCol.id);
  makeCard(home, 'swatch', 720, 300, { hex: '#e0673a', title: 'Accent' });
  home.links.push({ id: uid(), from: h.id, to: n.id });
  home.links.push({ id: uid(), from: n.id, to: t.id });
  cur = home.id;
}

// ======================================================================
// Persistence & history
// ======================================================================
function scheduleSave() {
  if (EXPORT_MODE) return;
  $('#save-state').textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 400);
}
let saving = null, saveAgain = false;
async function flushSave() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (EXPORT_MODE || !store) return;
  if (saving) { saveAgain = true; return saving; }
  saving = (async () => {
    store.ui.last = cur;
    try {
      // Locked boards are always saved encrypted (see lock.js).
      const sealed = await prepareSealed();
      await api.save(JSON.stringify(sealed));
      $('#save-state').textContent = 'Saved';
      if (typeof serverOnSaved === 'function') serverOnSaved(sealed); // your Pocket-Canvas Server, if you use one
    } catch (err) {
      $('#save-state').textContent = 'Save failed!';
      console.error(err);
    }
  })();
  await saving;
  saving = null;
  if (saveAgain) { saveAgain = false; await flushSave(); }
}

function pushUndo(snap) {
  undoStack.push(snap);
  if (undoStack.length > 80) undoStack.shift();
  redoStack = [];
  updateUndoBtns();
}
function checkpoint() { pushUndo(JSON.stringify(store)); }

function restore(snap) {
  const keepView = B() ? { ...B().view } : null;
  const keepCur = cur;
  store = JSON.parse(snap);
  cur = store.boards[keepCur] ? keepCur : store.root;
  if (keepView && cur === keepCur) B().view = keepView;
  selected.clear(); selectedLink = null;
  render(); scheduleSave();
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(store));
  restore(undoStack.pop());
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(store));
  restore(redoStack.pop());
}
function updateUndoBtns() {
  $('#undo-btn').disabled = !undoStack.length;
  $('#redo-btn').disabled = !redoStack.length;
}

// ======================================================================
// Sanitising rich text
// ======================================================================
const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'BR', 'P', 'DIV', 'SPAN', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'CODE', 'PRE', 'A']);
function sanitize(html) {
  const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  // Keep a link's web address and a span's text styles (font, size, colour, bold…); drop everything else.
  function walkOne(ch) {
    const style = ch.tagName === 'SPAN' && ch.getAttribute('style') ? cleanStyle(ch.style) : '';
    for (const a of [...ch.attributes]) {
      if (!(ch.tagName === 'A' && a.name === 'href' && /^https?:/i.test(a.value))) ch.removeAttribute(a.name);
    }
    if (style) ch.setAttribute('style', style);
    walk(ch);
  }
  function walk(node) {
    for (const ch of [...node.childNodes]) {
      if (ch.nodeType === 1) {
        if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED'].includes(ch.tagName)) { ch.remove(); continue; }
        if (ch.tagName === 'FONT') {
          // old-style <font color face> from pasted text becomes a styled <span>
          const span = doc.createElement('span');
          if (ch.getAttribute('color')) span.style.color = ch.getAttribute('color');
          if (ch.getAttribute('face')) span.style.fontFamily = ch.getAttribute('face');
          span.append(...ch.childNodes);
          ch.replaceWith(span);
          walkOne(span);
          continue;
        }
        if (!ALLOWED.has(ch.tagName)) {
          walk(ch);
          ch.replaceWith(...ch.childNodes);
          continue;
        }
        walkOne(ch);
      } else if (ch.nodeType !== 3) ch.remove();
    }
  }
  walk(root);
  return root.innerHTML;
}
const htmlToText = (html) => {
  const d = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html').body;
  $$('br', d).forEach((b) => b.replaceWith('\n'));
  $$('p,div,li,h1,h2,h3', d).forEach((b) => b.append('\n'));
  return d.textContent.replace(/\n{3,}/g, '\n\n').trim();
};

// ======================================================================
// View (pan / zoom)
// ======================================================================
// Every board starts at a fixed top-left corner (0, 0) and grows right and down.
// The corner sits flush with the window edge: you can't scroll left of it or above it.
// Cards are kept at least CARD_MARGIN from the corner, so nothing touches the edge.
const ORIGIN_PAD = 0;
const CARD_MARGIN = 40;
const DEFAULT_VIEW = () => ({ x: ORIGIN_PAD, y: ORIGIN_PAD, z: 1 });

function applyView() {
  if (!store) return;
  const v = B().view;
  if (!EXPORT_MODE) {
    v.x = Math.min(v.x, ORIGIN_PAD);
    v.y = Math.min(v.y, ORIGIN_PAD);
  }
  world.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.z})`;
  const g = 24 * v.z;
  viewport.style.backgroundSize = `${g}px ${g}px`;
  viewport.style.backgroundPosition = `${v.x}px ${v.y}px`;
  $('#zoom-label').textContent = Math.round(v.z * 100) + '%';
  if (typeof placeScrollbars === 'function') placeScrollbars();
}
function toWorld(cx, cy) {
  const r = viewport.getBoundingClientRect();
  const v = B().view;
  return { x: (cx - r.left - v.x) / v.z, y: (cy - r.top - v.y) / v.z };
}
function zoomAt(z, cx, cy) {
  const v = B().view;
  const r = viewport.getBoundingClientRect();
  if (cx == null) { cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
  const nz = clamp(z, 0.1, 3);
  const px = cx - r.left, py = cy - r.top;
  v.x = px - (px - v.x) * (nz / v.z);
  v.y = py - (py - v.y) * (nz / v.z);
  v.z = nz;
  applyView(); scheduleSave();
}
function viewCentre() {
  const r = viewport.getBoundingClientRect();
  return toWorld(r.left + r.width / 2, r.top + r.height / 2);
}
// Show everything from the top-left corner to the furthest card.
function fitContent() {
  const b = B();
  const els = $$(':scope > .card', cardsEl);
  if (!els.length) { b.view = DEFAULT_VIEW(); applyView(); drawLinks(); return; }
  let x2 = 0, y2 = 0;
  for (const el of els) {
    const c = b.cards[el.dataset.id];
    x2 = Math.max(x2, c.x + el.offsetWidth); y2 = Math.max(y2, c.y + el.offsetHeight);
  }
  const r = viewport.getBoundingClientRect();
  const z = clamp(Math.min((r.width - CARD_MARGIN) / x2, (r.height - CARD_MARGIN) / y2), 0.1, 1);
  b.view = { z, x: ORIGIN_PAD, y: ORIGIN_PAD };
  applyView(); drawLinks(); scheduleSave();
}

// Move a board's cards so none sit left of or above the top-left corner (older boards could).
function normaliseOrigin(b) {
  const top = Object.values(b.cards).filter((c) => !c.col);
  if (!top.length) return false;
  const minX = Math.min(...top.map((c) => c.x || 0)), minY = Math.min(...top.map((c) => c.y || 0));
  if (minX >= 0 && minY >= 0) return false;
  const dx = minX < 0 ? CARD_MARGIN - minX : 0, dy = minY < 0 ? CARD_MARGIN - minY : 0;
  for (const c of top) { c.x = Math.round((c.x || 0) + dx); c.y = Math.round((c.y || 0) + dy); }
  if (b.view) { b.view.x -= dx * b.view.z; b.view.y -= dy * b.view.z; }
  return true;
}
function centreOn(id) {
  const el = cardEl(id); if (!el) return;
  const b = B(), v = b.view, r = viewport.getBoundingClientRect();
  const er = el.getBoundingClientRect();
  v.x += (r.left + r.width / 2) - (er.left + er.width / 2);
  v.y += (r.top + r.height / 2) - (er.top + er.height / 2);
  applyView(); drawLinks();
}

// ======================================================================
// Rendering
// ======================================================================
const cardEl = (id) => cardsEl.querySelector(`.card[data-id="${CSS.escape(id)}"]`);

function render() {
  applyTheme();
  $('#app').classList.toggle('no-sidebar', store.ui.sidebar === false);
  renderCrumbs();
  renderTree();
  renderBoard();
  updateUndoBtns();
  updateBinButton();
}

function renderBoard() {
  const b = B();
  cardsEl.innerHTML = '';
  let z = 1;
  for (const id of b.order) {
    const c = b.cards[id];
    if (!c || c.col) continue;
    const el = buildCard(c, b);
    el.style.zIndex = z++;
    cardsEl.appendChild(el);
  }
  cleanupMedia();
  cleanupVideos();
  $('#empty-hint').hidden = b.order.length > 0 || !!EXPORT_MODE;
  applyView();
  refreshSelection();
  requestAnimationFrame(drawLinks);
  refreshComments();
  if (typeof updatePeers === 'function') updatePeers();
  if (typeof updatePageGuides === 'function') updatePageGuides();
  if (typeof updateScrollbars === 'function') updateScrollbars();
}

function editable(field, value, ph, rich = false) {
  return `<div class="editable" data-field="${field}" ${rich ? 'data-rich="1"' : ''} data-ph="${esc(ph)}" spellcheck="true">${rich ? sanitize(value) : esc(value)}</div>`;
}

function buildCard(c, b) {
  const el = document.createElement('div');
  el.className = `card ${c.type}${c.type === 'sketch' && sketchEditing === c.id ? ' drawing' : ''}`;
  el.dataset.id = c.id;
  if (!c.col) { el.style.left = c.x + 'px'; el.style.top = c.y + 'px'; el.style.width = c.w + 'px'; }
  if (c.color) el.style.setProperty('--c', c.color);
  let html = '';

  switch (c.type) {
    case 'note':
      html = editable('html', c.html, 'Type something…', true);
      break;
    case 'heading':
      html = editable('text', c.text, 'Heading');
      break;
    case 'todo': {
      const done = c.items.filter((i) => i.done).length;
      const pct = c.items.length ? Math.round((done / c.items.length) * 100) : 0;
      html = `<div class="todo-title">${editable('title', c.title, 'To-do list')}</div>
        <div class="todo-prog"><i style="width:${pct}%"></i></div>
        ${c.items.map((i) => `<div class="todo-item ${i.done ? 'done' : ''}" data-item="${i.id}">
          <input type="checkbox" ${i.done ? 'checked' : ''}>${editable('item:' + i.id, i.text, 'New task')}</div>`).join('')}
        <button class="todo-add">+ Add task</button>`;
      break;
    }
    case 'link': {
      let host = '';
      try { host = c.url ? new URL(c.url).hostname.replace(/^www\./, '') : ''; } catch {}
      const showEdit = !c.url || urlEditing.has(c.id);
      const fav = c.icon
        ? `<img src="${assetBase + encodeURIComponent(c.icon)}" alt="" draggable="false" data-letter="${esc((host || '?')[0])}">`
        : esc((host || '?')[0]);
      const video = !showEdit && showsPlayer(c);
      if (video) el.classList.add('video');
      html = `${video ? buildVideoHtml(c) : c.image ? `<div class="link-img"><img src="${assetBase + encodeURIComponent(c.image)}" alt="" draggable="false"></div>` : ''}
        <div class="link-body">
        <div class="link-top"><div class="link-fav">${fav}</div>
          <div class="link-title">${editable('title', c.title, host || 'Link title')}</div></div>
        ${c.desc ? `<div class="link-desc">${esc(c.desc)}</div>` : ''}
        ${showEdit
          ? `<input class="link-edit" placeholder="Paste or type a web address, then press Enter" value="${esc(c.url)}">`
          : video ? '' : `<span class="link-url" title="Open ${esc(c.url)}">${esc(c.site || host || c.url)}</span>`}
        ${previewLoading.has(c.id) ? '<div class="link-loading">Fetching preview…</div>' : ''}
        </div>`;
      break;
    }
    case 'image':
      html = c.asset
        ? `<img src="${assetBase + encodeURIComponent(c.asset)}" alt="" draggable="false">`
        : `<div class="img-empty">${ICONS.image}<button class="file-btn" data-act="pick-image">Choose picture</button><span>or drop or paste one here</span></div>`;
      html += `<div class="caption">${editable('caption', c.caption, 'Add a caption')}</div>`;
      break;
    case 'table':
      html = buildTableHtml(c);
      break;
    case 'sketch':
      html = buildSketchHtml(c);
      break;
    case 'media':
      html = buildMediaHtml(c);
      break;
    case 'file': {
      const ext = (c.name.split('.').pop() || 'file').slice(0, 4);
      html = `<div class="file-ico">${esc(ext)}</div>
        <div class="file-meta"><div class="file-name" title="${esc(c.name)}">${esc(c.name)}</div>
        <div class="file-size">${fmtSize(c.size)}</div></div>
        <button class="file-btn" data-act="open-file">Open</button>`;
      break;
    }
    case 'board': {
      const sub = store.boards[c.boardId];
      const n = sub ? Object.keys(sub.cards).length : 0;
      const locked = sub && sub.lock;
      html = `<div class="board-ico${sub && sub.iconAsset ? ' custom' : ''}${boardIconInfo(sub).tint ? '' : ' full'}" title="${locked ? 'Locked: open with password' : 'Open board'}">${boardIconImg(sub)}${locked ? `<span class="lock-badge">${LOCK_ICON}</span>` : ''}${sub && isSharedRoot(sub.id) ? `<span class="shared-badge" title="Shared with other people">${SHARED_ICON}</span>` : ''}</div>
        <div class="board-name">${editable('boardname', sub ? sub.title : '', 'Untitled board')}</div>
        <div class="board-count">${locked && !isUnlocked(sub.id) ? 'Locked' : `${n} card${n === 1 ? '' : 's'}`}</div>`;
      break;
    }
    case 'swatch':
      html = `<div class="swatch-chip" style="--sw:${esc(c.hex)}" title="Click to pick a colour"><input type="color" value="${esc(c.hex)}"></div>
        <div class="swatch-hex"><input class="swatch-hex-input" value="${esc(c.hex.toUpperCase())}" maxlength="7" spellcheck="false" title="Type a hex colour, e.g. #3A7BE0, then press Enter"></div>
        <div class="swatch-name">${editable('title', c.title, 'Name')}</div>`;
      break;
    case 'column':
      html = `<div class="col-title">${editable('title', c.title, 'Untitled column')}</div><div class="col-body"></div>`;
      break;
  }
  el.innerHTML = html;
  if (c.type === 'media') mountMedia(el, c);
  const open = (c.comments || []).filter((m) => !m.resolved).length;
  if (c.comments && c.comments.length && !EXPORT_MODE) {
    const badge = document.createElement('button');
    badge.className = 'cmt-badge' + (open ? '' : ' all-resolved');
    badge.title = open ? `${open} comment${open === 1 ? '' : 's'}` : 'All comments resolved';
    badge.innerHTML = ICONS.comment + (open ? `<span>${open}</span>` : '');
    el.appendChild(badge);
  }
  if (!EXPORT_MODE) {
    const del = document.createElement('button');
    del.className = 'card-del';
    del.dataset.act = 'delete-card';
    del.title = 'Move to Recycle bin (Delete)';
    del.innerHTML = BIN_ICON;
    el.appendChild(del);
  }
  if (c.type === 'column') {
    const body = $('.col-body', el);
    const kids = c.items.map((id) => b.cards[id]).filter(Boolean);
    if (!kids.length) body.innerHTML = '<div class="col-empty">Drag cards here</div>';
    for (const k of kids) body.appendChild(buildCard(k, b));
  }
  if (c.type === 'link') {
    const img = $('.link-img img', el);
    if (img) {
      img.onload = () => requestAnimationFrame(drawLinks);
      img.onerror = () => img.parentNode.remove();
    }
    const fav = $('.link-fav img', el);
    if (fav) fav.onerror = () => fav.replaceWith(document.createTextNode(fav.dataset.letter || '?'));
  }
  if (c.type === 'image') {
    const img = $(':scope > img', el);
    if (img) {
      img.onload = () => requestAnimationFrame(drawLinks);
      img.onerror = () => { img.replaceWith(Object.assign(document.createElement('div'), { className: 'missing', textContent: 'Image file missing' })); };
    }
  }
  if (!c.col && !['board', 'swatch'].includes(c.type)) {
    const r = document.createElement('div');
    r.className = 'resize';
    el.appendChild(r);
  }
  applyCardTextStyle(el, c);
  return el;
}

function rerenderCard(id) {
  const b = B(), c = b.cards[id], old = cardEl(id);
  if (!c || !old) return null;
  const el = buildCard(c, b);
  el.style.zIndex = old.style.zIndex;
  old.replaceWith(el);
  refreshSelection();
  requestAnimationFrame(drawLinks);
  return el;
}

function fmtSize(n) {
  if (!n) return '';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i ? 1 : 0)} ${u[i]}`;
}

function refreshSelection() {
  const del = $('#delete-btn'); if (del) del.disabled = !selected.size && !selectedLink;
  $$('.card', cardsEl).forEach((el) => el.classList.toggle('selected', selected.has(el.dataset.id)));
  drawLinks(); // redraws the selected line's end handles and the line style bar
  if (typeof serverPresence === 'function') serverPresence();
}
function selectOnly(id) { selected.clear(); if (id) selected.add(id); selectedLink = null; refreshSelection(); }
function clearSelection() { selected.clear(); selectedLink = null; refreshSelection(); }

// ---------- Lines between cards ----------
function worldRect(el) {
  const r = el.getBoundingClientRect(), vr = viewport.getBoundingClientRect(), v = B().view;
  return { x: (r.left - vr.left - v.x) / v.z, y: (r.top - vr.top - v.y) / v.z, w: r.width / v.z, h: r.height / v.z };
}
function edgePoint(r, tx, ty) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  const dx = tx - cx, dy = ty - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const t = Math.min((r.w / 2 + 6) / Math.abs(dx || 1e-9), (r.h / 2 + 6) / Math.abs(dy || 1e-9));
  return { x: cx + dx * Math.min(t, 1), y: cy + dy * Math.min(t, 1) };
}
// Drawing lines lives in lines.js.

// ---------- Sidebar tree & breadcrumbs ----------
function childBoards(bid) {
  const b = store.boards[bid], out = [];
  if (!b) return out;
  const visit = (id) => {
    const c = b.cards[id]; if (!c) return;
    if (c.type === 'board' && store.boards[c.boardId]) out.push(c.boardId);
    if (c.type === 'column') c.items.forEach(visit);
  };
  b.order.forEach((id) => { if (b.cards[id] && !b.cards[id].col) visit(id); });
  return out;
}
function renderTree() {
  const tree = $('#tree');
  const rows = [];
  const walk = (bid, depth) => {
    const b = store.boards[bid]; if (!b) return;
    const kids = childBoards(bid);
    const collapsed = store.ui.collapsed[bid];
    rows.push(`<div class="tree-row ${bid === cur ? 'active' : ''}" data-board="${bid}" style="padding-left:${6 + depth * 14}px">
      <span class="tree-tog" data-tog="${bid}">${kids.length ? (collapsed ? '▸' : '▾') : ''}</span>
      <span class="tree-ico${b.iconAsset ? ' custom' : ''}" style="background:${esc(b.color || '#8a7f70')}">${boardIconImg(b)}</span>
      <span class="tree-name">${esc(b.title || 'Untitled board')}</span>${isSharedRoot(bid) ? `<span class="tree-shared" title="Shared with other people">${SHARED_ICON}</span>` : ''}${b.lock ? `<span class="tree-lock" title="${isUnlocked(bid) ? 'Unlocked for now' : 'Locked'}">${LOCK_ICON}</span>` : ''}</div>`);
    if (!collapsed) kids.forEach((k) => walk(k, depth + 1));
  };
  walk(store.root, 0);
  tree.innerHTML = rows.join('');
}
function pathTo(bid) {
  const p = [];
  for (let b = store.boards[bid]; b; b = store.boards[b.parentId]) p.unshift(b);
  return p;
}
function renderCrumbs() {
  const p = pathTo(cur);
  $('#crumbs').innerHTML = p.map((b, i) => i === p.length - 1
    ? `<button class="crumb current" data-board="${b.id}" title="Click to rename">${esc(b.title || 'Untitled board')}</button>`
    : `<button class="crumb" data-board="${b.id}">${esc(b.title || 'Untitled board')}</button><span class="crumb-sep">/</span>`).join('');
  const owner = typeof lockedOwner === 'function' ? lockedOwner(cur) : null;
  if (owner) $('#crumbs').insertAdjacentHTML('beforeend', `<button class="unlocked-pill" data-relock="${owner}" title="This board is password-protected. It locks again when you leave it, or click to lock it now.">${LOCK_ICON}Unlocked · Lock now</button>`);
  document.title = `${B().title} — Pocket-Canvas`;
}
function isDescendant(bid, ancestor) {
  for (let b = store.boards[bid]; b; b = store.boards[b.parentId]) if (b.id === ancestor) return true;
  return false;
}

function go(bid, focusId) {
  if (!store.boards[bid]) return;
  if (lockGate(bid, focusId)) return; // asks for the password first
  blurEditing();
  if (sketchEditing) stopSketch();
  cur = bid;
  relockLeftBoards();
  // expand path in the tree
  pathTo(bid).forEach((b) => { delete store.ui.collapsed[b.id]; });
  clearSelection();
  cancelConnect();
  render();
  scheduleSave();
  if (focusId) {
    requestAnimationFrame(() => {
      const el = cardEl(focusId);
      if (!el) return;
      centreOn(focusId);
      selectOnly(focusId);
      el.classList.remove('highlight'); void el.offsetWidth; el.classList.add('highlight');
    });
  }
}

// ======================================================================
// Card operations
// ======================================================================
function addCard(type, pos, extra = {}) {
  checkpoint();
  const b = B();
  const w = extra.w || DEFAULT_W[type] || 240;
  const c = makeCard(b, type, pos.x - w / 2, pos.y - 24, extra);
  renderBoard(); renderTree();
  selectOnly(c.id);
  scheduleSave();
  return c;
}

function startEditOf(id, selector = '.editable') {
  requestAnimationFrame(() => {
    const el = cardEl(id); if (!el) return;
    if (el.classList.contains('link') && $('.link-edit', el)) { $('.link-edit', el).focus(); return; }
    const ed = $(selector, el);
    if (ed) { makeEditable(ed); caretToEnd(ed); }
  });
}

// Card fields for a stored file, choosing picture / audio / video / file by its name.
function cardForAsset(f, type = '') {
  const kind = fileKind(f.name || '', type);
  if (kind === 'image') return ['image', { asset: f.id }];
  if (kind === 'audio' || kind === 'video') return ['media', { asset: f.id, name: f.name, size: f.size || 0, kind }];
  return ['file', { asset: f.id, name: f.name, size: f.size || 0 }];
}

function addAssetCards(files, pos) {
  if (!files.length) return [];
  checkpoint();
  const b = B();
  const made = files.map((f, i) => {
    const [type, fields] = cardForAsset(f, f.type);
    const w = DEFAULT_W[type];
    return makeCard(b, type, pos.x - w / 2 + i * 30, pos.y - 24 + i * 30, fields);
  });
  renderBoard(); scheduleSave();
  selected.clear(); made.forEach((c) => selected.add(c.id)); refreshSelection();
  return made;
}

async function addTool(type, pos) {
  if (type === 'line') { toggleConnect(); return; }
  if (type === 'image' || type === 'file' || type === 'media') {
    const files = await api.pickFiles(type === 'file' ? 'any' : type);
    addAssetCards(files, pos);
    return;
  }
  const c = addCard(type, pos);
  if (type === 'board') renderTree();
  if (type === 'sketch') { startSketch(c.id); return; }
  if (type === 'table') { startEditOf(c.id, '[data-field="cell:0:0"]'); return; }
  if (type === 'swatch') {
    requestAnimationFrame(() => { const i = cardEl(c.id) && $('.swatch-hex-input', cardEl(c.id)); if (i) { i.focus(); i.select(); } });
    return;
  }
  startEditOf(c.id, type === 'board' ? '.board-name .editable' : '.editable');
}

// Collect cards (plus column children and nested boards) for copy/duplicate.
function serialize(ids, b = B()) {
  const out = { kind: 'pocket-canvas-cards', cards: [], boards: {}, links: [] };
  const seen = new Set();
  const addBoardTree = (bid) => {
    const sb = store.boards[bid]; if (!sb || out.boards[bid]) return;
    out.boards[bid] = sb;
    Object.values(sb.cards).forEach((c) => { if (c.type === 'board') addBoardTree(c.boardId); });
  };
  const add = (id) => {
    const c = b.cards[id]; if (!c || seen.has(id)) return;
    seen.add(id); out.cards.push(c);
    if (c.type === 'column') c.items.forEach(add);
    if (c.type === 'board') addBoardTree(c.boardId);
  };
  ids.forEach(add);
  // lines whose card ends are all being copied (free ends come along as they are)
  out.links = b.links.filter((l) => lineCards(l).length && lineCards(l).every((id) => seen.has(id)));
  return JSON.parse(JSON.stringify(out));
}

function insertPayload(payload, dx, dy, b = B()) {
  // give every card, board and line a fresh id
  const ids = new Set();
  payload.cards.forEach((c) => ids.add(c.id));
  payload.links.forEach((l) => ids.add(l.id));
  Object.values(payload.boards).forEach((sb) => {
    ids.add(sb.id);
    Object.keys(sb.cards).forEach((k) => ids.add(k));
    sb.links.forEach((l) => ids.add(l.id));
  });
  const map = {};
  ids.forEach((id) => { map[id] = uid(); });
  const keys = Object.keys(map).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!keys.length) return [];
  const re = new RegExp(`"(${keys.join('|')})"`, 'g');
  const p = JSON.parse(JSON.stringify(payload).replace(re, (_m, id) => `"${map[id]}"`));

  const cardIds = new Set(p.cards.map((c) => c.id));
  const added = [];
  // Never place cards left of or above the top-left corner.
  const tops = p.cards.filter((c) => !c.col || !cardIds.has(c.col));
  if (tops.length) {
    dx = Math.max(dx, -Math.min(...tops.map((c) => c.x)));
    dy = Math.max(dy, -Math.min(...tops.map((c) => c.y)));
  }
  for (const c of p.cards) {
    if (c.col && !cardIds.has(c.col)) delete c.col;
    if (!c.col) { c.x += dx; c.y += dy; added.push(c.id); }
    b.cards[c.id] = c;
    b.order.push(c.id);
  }
  Object.values(p.boards).forEach((sb) => {
    if (!p.boards[sb.parentId] && !Object.values(p.boards).some((o) => o.id === sb.parentId)) sb.parentId = b.id;
    store.boards[sb.id] = sb;
  });
  // boards directly referenced from inserted cards belong to this board
  p.cards.forEach((c) => { if (c.type === 'board' && store.boards[c.boardId]) store.boards[c.boardId].parentId = b.id; });
  for (const l of p.links) {
    for (const w of ['fromPt', 'toPt']) if (l[w]) l[w] = { x: l[w].x + dx, y: l[w].y + dy };
    b.links.push(l);
  }
  return added;
}

function duplicateSelection() {
  if (!selected.size) return;
  checkpoint();
  const added = insertPayload(serialize([...selected]), 30, 30);
  renderBoard(); renderTree();
  selected.clear(); added.forEach((id) => selected.add(id));
  refreshSelection(); scheduleSave();
}

function deleteBoardTree(bid) {
  const sb = store.boards[bid]; if (!sb) return;
  Object.values(sb.cards).forEach((c) => { if (c.type === 'board') deleteBoardTree(c.boardId); });
  delete store.boards[bid];
}

function removeCards(b, ids, { deleteBoards }) {
  const all = new Set();
  const add = (id) => {
    const c = b.cards[id]; if (!c || all.has(id)) return;
    all.add(id);
    if (c.type === 'column') c.items.forEach(add);
  };
  ids.forEach(add);
  for (const id of all) {
    const c = b.cards[id];
    if (c.col && b.cards[c.col] && !all.has(c.col)) b.cards[c.col].items = b.cards[c.col].items.filter((x) => x !== id);
    if (deleteBoards && c.type === 'board') deleteBoardTree(c.boardId);
    delete b.cards[id];
  }
  b.order = b.order.filter((id) => !all.has(id));
  const removedLinks = b.links.filter((l) => all.has(l.from) || all.has(l.to));
  b.links = b.links.filter((l) => !(all.has(l.from) || all.has(l.to)));
  return { all, removedLinks };
}

async function deleteSelection() {
  const b = B();
  if (selectedLink) {
    checkpoint();
    b.links = b.links.filter((l) => l.id !== selectedLink);
    selectedLink = null; drawLinks(); scheduleSave();
    return;
  }
  if (!selected.size) return;
  if (sketchEditing && selected.has(sketchEditing)) stopSketch();
  // Open locked boards among the selection are closed first so they go to the bin encrypted.
  for (const id of [...selected]) {
    const c = b.cards[id];
    if (c && c.type === 'board') for (const u of [...unlocked.keys()]) if (u === c.boardId || isDescendant(u, c.boardId)) await relock(u);
  }
  checkpoint();
  await moveCardsToBin(b, [...selected]);
  clearSelection();
  renderBoard(); renderTree(); scheduleSave();
}

function moveToBoard(ids, targetId) {
  const b = B();
  if (targetId === cur || !store.boards[targetId]) return false;
  if (isSealed(targetId)) { toast(`“${store.boards[targetId].title}” is locked. Open it with its password first.`); return false; }
  ids = ids.filter((id) => {
    const c = b.cards[id];
    if (c && c.type === 'board' && (c.boardId === targetId || isDescendant(targetId, c.boardId))) {
      toast("A board can't go inside itself");
      return false;
    }
    return !!c;
  });
  if (!ids.length) return false;
  const t = store.boards[targetId];
  const cards = serialize(ids).cards.map((c) => b.cards[c.id]);
  const top = cards.filter((c) => !c.col || !cards.some((o) => o.id === c.col));
  const minX = Math.min(...top.map((c) => c.x || 0)), minY = Math.min(...top.map((c) => c.y || 0));
  const ox = (60 - t.view.x) / t.view.z, oy = (60 - t.view.y) / t.view.z;
  const { all } = removeCards(b, ids, { deleteBoards: false });
  const moved = cards.filter((c) => all.has(c.id));
  for (const c of moved) {
    if (c.col && !all.has(c.col)) delete c.col;
    if (!c.col) { c.x = Math.max(0, Math.round(ox + (c.x - minX))); c.y = Math.max(0, Math.round(oy + (c.y - minY))); }
    t.cards[c.id] = c;
    t.order.push(c.id);
    if (c.type === 'board' && store.boards[c.boardId]) store.boards[c.boardId].parentId = targetId;
  }
  toast(`Moved ${top.length} card${top.length === 1 ? '' : 's'} to “${t.title}”`);
  return true;
}

function addToColumn(ids, colId, index) {
  const b = B(), col = b.cards[colId];
  ids = ids.filter((id) => id !== colId && b.cards[id] && b.cards[id].type !== 'column');
  if (!ids.length) return false;
  for (const id of ids) {
    const c = b.cards[id];
    if (c.col && b.cards[c.col]) b.cards[c.col].items = b.cards[c.col].items.filter((x) => x !== id);
  }
  index = clamp(index, 0, col.items.length);
  col.items.splice(index, 0, ...ids);
  ids.forEach((id) => { b.cards[id].col = colId; });
  return true;
}

function detachFromColumn(id) {
  const b = B(), c = b.cards[id];
  if (!c || !c.col) return;
  const el = cardEl(id);
  const r = el ? worldRect(el) : { x: 0, y: 0, w: c.w };
  const col = b.cards[c.col];
  if (col) col.items = col.items.filter((x) => x !== id);
  delete c.col;
  c.x = Math.max(0, Math.round(r.x)); c.y = Math.max(0, Math.round(r.y));
  c.w = Math.max(DEFAULT_W[c.type] || 240, Math.round(r.w));
  b.order = b.order.filter((x) => x !== id); b.order.push(id);
}

function bringToFront(ids) { const b = B(); b.order = b.order.filter((x) => !ids.includes(x)).concat(ids); }
function sendToBack(ids) { const b = B(); b.order = ids.concat(b.order.filter((x) => !ids.includes(x))); }

function setColor(ids, color) {
  checkpoint();
  const b = B();
  for (const id of ids) {
    const c = b.cards[id]; if (!c) continue;
    c.color = color;
    if (c.type === 'board' && store.boards[c.boardId]) store.boards[c.boardId].color = color || '#8a7f70';
  }
  renderBoard(); renderTree(); scheduleSave();
}

// ======================================================================
// Editing text
// ======================================================================
function isTyping() {
  const a = document.activeElement;
  return a && (a.isContentEditable || a.tagName === 'INPUT' || a.tagName === 'TEXTAREA');
}
function blurEditing() { if (isTyping()) document.activeElement.blur(); }
function makeEditable(ed) {
  ed.contentEditable = ed.dataset.rich ? 'true' : 'plaintext-only';
}
function caretToEnd(ed) {
  ed.focus();
  const r = document.createRange();
  r.selectNodeContents(ed); r.collapse(false);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}

function setField(c, field, ed) {
  if (field === 'html') c.html = sanitize(ed.innerHTML);
  else if (field === 'boardname') {
    const sb = store.boards[c.boardId];
    if (sb) sb.title = ed.textContent.trim() || 'Untitled board';
  } else if (field.startsWith('item:')) {
    const it = c.items.find((i) => i.id === field.slice(5));
    if (it) it.text = ed.textContent;
  } else if (field.startsWith('cell:')) {
    const [, r, k] = field.split(':').map(Number);
    if (c.rows[r] && k < c.rows[r].length) c.rows[r][k] = ed.textContent;
  } else {
    c[field] = ed.textContent;
    if (c.type === 'swatch' && field === 'title') c.nameAuto = !ed.textContent.trim();
  }
}

cardsEl.addEventListener('input', (e) => {
  const ed = e.target.closest('.editable');
  if (!ed) return;
  const c = B().cards[ed.closest('.card').dataset.id];
  if (!c) return;
  setField(c, ed.dataset.field, ed);
  scheduleSave();
  requestAnimationFrame(drawLinks);
});

cardsEl.addEventListener('focusin', (e) => {
  const t = e.target;
  if (!(t.classList.contains('editable') || t.tagName === 'INPUT')) return;
  const now = JSON.stringify(store);
  if (editSnap && editSnap !== now) pushUndo(editSnap);
  editSnap = now;
});

cardsEl.addEventListener('focusout', (e) => {
  const ed = e.target;
  if (ed.classList && ed.classList.contains('editable')) {
    ed.contentEditable = 'false';
    getSelection().removeAllRanges();
    if (ed.dataset.field === 'boardname') { renderTree(); renderCrumbs(); }
  }
  if (editSnap && editSnap !== JSON.stringify(store)) pushUndo(editSnap);
  editSnap = null;
});

cardsEl.addEventListener('keydown', (e) => {
  const ed = e.target.closest('.editable');
  if (!ed || !ed.isContentEditable) return;
  const cardNode = ed.closest('.card');
  const b = B(), c = b.cards[cardNode.dataset.id];
  if (e.key === 'Escape') { e.preventDefault(); ed.blur(); return; }
  const f = ed.dataset.field;
  if (f.startsWith('cell:') && tableKey(e, c, f)) return;

  // To-do: Enter adds a task, Backspace on an empty task removes it
  if (f.startsWith('item:')) {
    const idx = c.items.findIndex((i) => i.id === f.slice(5));
    if (e.key === 'Enter') {
      e.preventDefault();
      const it = { id: uid(), text: '', done: false };
      c.items.splice(idx + 1, 0, it);
      rerenderCard(c.id); startEditOf(c.id, `[data-field="item:${it.id}"]`); scheduleSave();
    } else if (e.key === 'Backspace' && !ed.textContent && c.items.length > 1) {
      e.preventDefault();
      c.items.splice(idx, 1);
      const prev = c.items[Math.max(0, idx - 1)];
      rerenderCard(c.id); startEditOf(c.id, `[data-field="item:${prev.id}"]`); scheduleSave();
    }
    return;
  }
  if (f === 'title' && c.type === 'todo' && e.key === 'Enter') {
    e.preventDefault(); startEditOf(c.id, `[data-field="item:${c.items[0]?.id}"]`); return;
  }
  // Single-line fields: Enter finishes
  if (!ed.dataset.rich && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ed.blur(); return; }

  // Notes: simple markdown shortcuts at the start of a line
  if (ed.dataset.rich && e.key === ' ') {
    const sel = getSelection();
    const node = sel.anchorNode;
    if (!node || node.nodeType !== 3) return;
    const before = node.textContent.slice(0, sel.anchorOffset);
    const cmds = { '-': ['insertUnorderedList'], '*': ['insertUnorderedList'], '1.': ['insertOrderedList'], '#': ['formatBlock', 'H2'], '##': ['formatBlock', 'H3'], '>': ['formatBlock', 'BLOCKQUOTE'] };
    if (cmds[before] && (node.previousSibling == null)) {
      e.preventDefault();
      node.textContent = node.textContent.slice(before.length);
      const r = document.createRange(); r.setStart(node, 0); r.collapse(true);
      sel.removeAllRanges(); sel.addRange(r);
      document.execCommand(...[cmds[before][0], false, cmds[before][1]]);
      setField(c, 'html', ed); scheduleSave();
    }
  }
});

// Paste plain text into text fields (keeps notes clean)
cardsEl.addEventListener('paste', (e) => {
  const ed = e.target.closest('.editable');
  if (!ed || !ed.isContentEditable) return;
  e.preventDefault();
  e.stopPropagation();
  const text = e.clipboardData.getData('text/plain');
  document.execCommand('insertText', false, ed.dataset.rich ? text : text.replace(/\n+/g, ' '));
});

// Checkboxes, buttons, URL field, colour picker
cardsEl.addEventListener('change', (e) => {
  const cardNode = e.target.closest('.card'); if (!cardNode) return;
  const c = B().cards[cardNode.dataset.id];
  if (e.target.type === 'checkbox') {
    checkpoint();
    const it = c.items.find((i) => i.id === e.target.closest('.todo-item').dataset.item);
    if (it) it.done = e.target.checked;
    rerenderCard(c.id); scheduleSave();
  } else if (e.target.type === 'color') {
    setSwatchColour(c, e.target.value);
  } else if (e.target.classList.contains('swatch-hex-input')) {
    const hex = normaliseHex(e.target.value);
    if (!hex) { toast('Type a colour code like #3A7BE0 (or 3A7BE0)'); e.target.value = c.hex.toUpperCase(); return; }
    setSwatchColour(c, hex);
  }
});
cardsEl.addEventListener('input', (e) => {
  if (e.target.type === 'color') {
    // live preview while the picker is open
    const card = e.target.closest('.card');
    e.target.closest('.swatch-chip').style.setProperty('--sw', e.target.value);
    const inp = $('.swatch-hex-input', card); if (inp) inp.value = e.target.value.toUpperCase();
    const c = B().cards[card.dataset.id];
    const name = $('.swatch-name .editable', card);
    if (c && name && swatchAutoName(c)) name.textContent = colourName(e.target.value);
  } else if (e.target.classList && e.target.classList.contains('swatch-hex-input')) {
    const hex = normaliseHex(e.target.value);
    if (hex) e.target.closest('.card').querySelector('.swatch-chip').style.setProperty('--sw', hex);
  }
});
cardsEl.addEventListener('keydown', (e) => {
  if (e.target.classList.contains('swatch-hex-input')) {
    if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
    if (e.key === 'Escape') { const c = B().cards[e.target.closest('.card').dataset.id]; e.target.value = c.hex.toUpperCase(); e.target.blur(); }
    return;
  }
  if (!e.target.classList.contains('link-edit')) return;
  if (e.key === 'Escape') { urlEditing.delete(e.target.closest('.card').dataset.id); e.target.blur(); rerenderCard(e.target.closest('.card').dataset.id); }
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const id = e.target.closest('.card').dataset.id;
  const c = B().cards[id];
  let u = e.target.value.trim();
  if (!u) return;
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try { new URL(u); } catch { toast("That doesn't look like a web address"); return; }
  const changed = c.url !== u;
  c.url = u;
  if (!c.title) c.title = new URL(u).hostname.replace(/^www\./, '');
  urlEditing.delete(id);
  e.target.blur();
  rerenderCard(id); scheduleSave();
  if (changed) fetchPreview(id);
});
cardsEl.addEventListener('click', (e) => {
  const cardNode = e.target.closest('.card'); if (!cardNode || tool === 'connect') return;
  const c = B().cards[cardNode.dataset.id]; if (!c) return;
  if (e.target.closest('.cmt-badge')) { openComments(c.id); return; }
  if (e.target.closest('.swatch-chip') && Date.now() - lastDragEnd > 250) {
    // A click (not a drag) on the colour opens the colour picker.
    const inp = $('.swatch-chip input', cardNode);
    try { inp.showPicker(); } catch { inp.click(); }
    return;
  }
  const act = e.target.closest('[data-act]');
  if (act && act.dataset.act !== 'open-file' && cardNode.contains(act)) { cardAction(act.dataset.act, c, act, e); return; }
  if (e.target.closest('.todo-add')) {
    checkpoint();
    const it = { id: uid(), text: '', done: false };
    c.items.push(it);
    rerenderCard(c.id); startEditOf(c.id, `[data-field="item:${it.id}"]`); scheduleSave();
  } else if (e.target.closest('.link-url')) {
    api.openLink(c.url);
  } else if (e.target.closest('[data-act="open-file"]')) {
    api.openAsset(c.asset);
  } else if (e.target.closest('.board-ico')) {
    go(c.boardId);
  }
});
cardsEl.addEventListener('dblclick', (e) => {
  const cardNode = e.target.closest('.card'); if (!cardNode) return;
  const c = B().cards[cardNode.dataset.id]; if (!c) return;
  if (c.type === 'image' && c.asset && !e.target.closest('.caption')) api.openAsset(c.asset);
  if (c.type === 'board' && !e.target.closest('.editable')) go(c.boardId);
  if (c.type === 'sketch' && sketchEditing !== c.id) startSketch(c.id);
  if (c.type === 'link' && c.url && e.target.closest('.link-img')) api.openLink(c.url);
  if (c.type === 'link' && e.target.closest('.link-fav')) api.openLink(c.url);
});

// ======================================================================
// Pointer interaction: select, drag, resize, marquee, pan, connect
// ======================================================================
viewport.addEventListener('pointerdown', (e) => {
  hideMenu();
  const active = document.activeElement;
  if (isTyping() && !active.contains(e.target) && active.closest('#viewport')) active.blur();

  if (spaceDown || e.button === 1) { e.preventDefault(); startPan(e); return; }
  if (e.button !== 0) return;

  // Drawing on a sketch card
  if (sketchEditing) {
    const sk = e.target.closest(`.card[data-id="${CSS.escape(sketchEditing)}"]`);
    if (sk && e.target.closest('.sketch-wrap')) { e.preventDefault(); startStroke(e, sketchEditing); return; }
    if (!sk) stopSketch();
  }

  if (tool === 'connect') { e.preventDefault(); connectDown(e); return; }

  const handle = e.target.closest('circle.lh');
  if (handle) { e.preventDefault(); startEndDrag(e, handle.dataset.id, handle.dataset.end); return; }

  const linkHit = e.target.closest('path.hit, path.link');
  if (linkHit) {
    e.preventDefault();
    selected.clear(); selectedLink = linkHit.dataset.id; refreshSelection();
    startLineDrag(e, linkHit.dataset.id);
    return;
  }

  const el = e.target.closest('.card');
  if (!el) {
    e.preventDefault();
    viewport.focus({ preventScroll: true });
    startMarquee(e);
    return;
  }

  const id = el.dataset.id;

  const ed = e.target.closest('.editable');
  if (ed && ed.isContentEditable) return; // already editing — let the caret move
  if (e.target.closest('.resize')) { e.preventDefault(); selectOnly(id); startResize(e, id); return; }
  if (e.target.closest('input, button, .link-url, .board-ico')) {
    if (!selected.has(id)) selectOnly(id);
    return;
  }
  if (ed && selected.size === 1 && selected.has(id)) {
    // second click on a selected card: start editing where the user clicked
    makeEditable(ed);
    return;
  }
  e.preventDefault();
  viewport.focus({ preventScroll: true });
  if (e.shiftKey || e.ctrlKey || e.metaKey) {
    if (selected.has(id)) selected.delete(id); else selected.add(id);
    selectedLink = null;
    refreshSelection();
    if (!selected.has(id)) return;
  } else if (!selected.has(id)) selectOnly(id);
  startDrag(e, id);
});

function startPan(e) {
  const v = B().view;
  const sx = e.clientX, sy = e.clientY, ox = v.x, oy = v.y;
  viewport.classList.add('panning');
  const move = (ev) => { v.x = ox + ev.clientX - sx; v.y = oy + ev.clientY - sy; applyView(); };
  const up = () => {
    viewport.classList.remove('panning');
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
    scheduleSave();
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}

function startMarquee(e) {
  const vr = viewport.getBoundingClientRect();
  const sx = e.clientX, sy = e.clientY;
  const m = $('#marquee');
  const base = e.shiftKey ? new Set(selected) : new Set();
  let moved = false;
  const move = (ev) => {
    if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
    moved = true;
    const x1 = Math.min(sx, ev.clientX), y1 = Math.min(sy, ev.clientY);
    const x2 = Math.max(sx, ev.clientX), y2 = Math.max(sy, ev.clientY);
    Object.assign(m.style, { left: x1 - vr.left + 'px', top: y1 - vr.top + 'px', width: x2 - x1 + 'px', height: y2 - y1 + 'px' });
    m.hidden = false;
    selected.clear(); base.forEach((id) => selected.add(id)); selectedLink = null;
    for (const el of $$(':scope > .card', cardsEl)) {
      const r = el.getBoundingClientRect();
      if (r.right > x1 && r.left < x2 && r.bottom > y1 && r.top < y2) selected.add(el.dataset.id);
    }
    refreshSelection();
  };
  const up = () => {
    m.hidden = true;
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
    if (!moved && !e.shiftKey) clearSelection();
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}

function startResize(e, id) {
  const b = B(), c = b.cards[id];
  const sx = e.clientX, ow = c.w;
  const snap = JSON.stringify(store);
  const move = (ev) => {
    c.w = Math.round(clamp(ow + (ev.clientX - sx) / b.view.z, 120, 1600));
    const el = cardEl(id); if (el) el.style.width = c.w + 'px';
    drawLinks();
  };
  const up = () => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
    if (c.w !== ow) { pushUndo(snap); scheduleSave(); }
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}

function startDrag(e, id) {
  const b = B();
  const sx = e.clientX, sy = e.clientY;
  let moved = false, snap = null, ids = [], origin = [];
  let target = null; // {kind:'board'|'column', id, index, el}
  let dropLine = null;

  const clearTarget = () => {
    $$('.drop-target').forEach((x) => x.classList.remove('drop-target'));
    $$('.col-body.drop-over').forEach((x) => x.classList.remove('drop-over'));
    if (dropLine) { dropLine.remove(); dropLine = null; }
    target = null;
  };

  const begin = () => {
    snap = JSON.stringify(store);
    const c = b.cards[id];
    if (c.col) {
      // pull the card out of its column first
      selectOnly(id);
      detachFromColumn(id);
      renderBoard();
    }
    ids = [...selected].filter((x) => b.cards[x] && !b.cards[x].col);
    bringToFront(ids);
    ids.forEach((x, i) => { const el = cardEl(x); if (el) { el.classList.add('dragging'); el.style.zIndex = 100000 + i; } });
    origin = ids.map((x) => ({ id: x, x: b.cards[x].x, y: b.cards[x].y }));
  };

  const findTarget = (ev) => {
    clearTarget();
    const dragged = ids.map(cardEl).filter(Boolean);
    const under = document.elementsFromPoint(ev.clientX, ev.clientY)
      .filter((n) => !dragged.some((d) => d.contains(n)));
    for (const n of under) {
      const row = n.closest('.tree-row, .crumb');
      if (row && row.dataset.board) {
        if (row.dataset.board !== cur) { row.classList.add('drop-target'); target = { kind: 'board', id: row.dataset.board }; }
        return;
      }
      const cn = n.closest('.card');
      if (!cn) continue;
      const tc = b.cards[cn.dataset.id];
      if (!tc) continue;
      if (tc.type === 'board' && !ids.includes(tc.id)) {
        cn.classList.add('drop-target'); target = { kind: 'board', id: tc.boardId };
        return;
      }
      // the column itself, or any card sitting inside a column
      const colNode = tc.type === 'column' ? cn : (tc.col ? cn.closest('.card.column') : null);
      if (colNode && !ids.some((x) => b.cards[x].type === 'column')) {
        const body = $('.col-body', colNode);
        body.classList.add('drop-over');
        const kids = $$(':scope > .card', body);
        let index = kids.length;
        for (let i = 0; i < kids.length; i++) {
          const r = kids[i].getBoundingClientRect();
          if (ev.clientY < r.top + r.height / 2) { index = i; break; }
        }
        dropLine = document.createElement('div'); dropLine.className = 'drop-line';
        body.insertBefore(dropLine, kids[index] || null);
        target = { kind: 'column', id: colNode.dataset.id, index };
        return;
      }
      return; // over some other card
    }
  };

  const move = (ev) => {
    if (!moved) {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
      moved = true; begin();
    }
    let dx = (ev.clientX - sx) / b.view.z, dy = (ev.clientY - sy) / b.view.z;
    // Cards can't go past the top-left corner.
    dx = Math.max(dx, -Math.min(...origin.map((o) => o.x)));
    dy = Math.max(dy, -Math.min(...origin.map((o) => o.y)));
    for (const o of origin) {
      const c = b.cards[o.id];
      c.x = Math.round(o.x + dx); c.y = Math.round(o.y + dy);
      const el = cardEl(o.id);
      if (el) { el.style.left = c.x + 'px'; el.style.top = c.y + 'px'; }
    }
    drawLinks();
    findTarget(ev);
  };
  const up = () => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
    if (!moved) return;
    lastDragEnd = Date.now();
    const t = target;
    clearTarget();
    let changed = true;
    if (t && t.kind === 'board') {
      // put the cards back where they started on this board before moving them
      origin.forEach((o) => { b.cards[o.id].x = o.x; b.cards[o.id].y = o.y; });
      changed = moveToBoard(ids, t.id);
      if (changed) clearSelection();
    } else if (t && t.kind === 'column') {
      changed = addToColumn(ids, t.id, t.index);
    }
    pushUndo(snap);
    renderBoard(); renderTree(); scheduleSave();
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}

// Line tool (connect mode) lives in lines.js.

// ---------- Wheel: scroll to pan, Ctrl+scroll to zoom ----------
viewport.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) {
    zoomAt(B().view.z * Math.exp(-e.deltaY * 0.0022), e.clientX, e.clientY);
  } else {
    const v = B().view;
    v.x -= e.shiftKey ? e.deltaY : e.deltaX;
    v.y -= e.shiftKey ? 0 : e.deltaY;
    applyView(); scheduleSave();
  }
}, { passive: false });

viewport.addEventListener('dblclick', (e) => {
  if (e.target.closest('.card') || e.target.closest('path')) return;
  const c = addCard('note', toWorld(e.clientX, e.clientY));
  startEditOf(c.id);
});

// ======================================================================
// Drag & drop from the tool rail and from the desktop
// ======================================================================
function buildRail() {
  $('#rail').innerHTML = TOOLS.map((t) => t === 'sep' ? '<div class="rail-sep"></div>'
    : `<div class="tool" draggable="true" data-tool="${t[0]}" title="${t[1]} — drag onto the board or click">${ICONS[t[0]]}<span>${t[1]}</span></div>`).join('');
  $$('#rail .tool').forEach((el) => {
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('application/x-pocket-canvas-tool', el.dataset.tool);
      e.dataTransfer.effectAllowed = 'copy';
    });
    el.addEventListener('click', () => {
      const p = viewCentre();
      const jitter = () => (Math.random() - 0.5) * 80;
      addTool(el.dataset.tool, { x: p.x + jitter(), y: p.y + jitter() });
    });
  });
}

viewport.addEventListener('dragover', (e) => {
  const types = [...e.dataTransfer.types];
  if (types.includes('application/x-pocket-canvas-tool') || types.includes('Files')) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    viewport.classList.add('drop-over');
  }
});
viewport.addEventListener('dragleave', (e) => { if (e.target === viewport) viewport.classList.remove('drop-over'); });
viewport.addEventListener('drop', async (e) => {
  viewport.classList.remove('drop-over');
  e.preventDefault();
  const pos = toWorld(e.clientX, e.clientY);
  const t = e.dataTransfer.getData('application/x-pocket-canvas-tool');
  if (t) { addTool(t, pos); return; }
  if (e.dataTransfer.files.length) {
    const ph = e.target.closest && e.target.closest('.card.image');
    if (ph && !B().cards[ph.dataset.id]?.asset && fileKind(e.dataTransfer.files[0].name, e.dataTransfer.files[0].type) === 'image') {
      await fillImage(ph.dataset.id, e.dataTransfer.files[0]);
      return;
    }
    await importFiles([...e.dataTransfer.files], pos);
    return;
  }
  const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
  if (url && /^https?:\/\//i.test(url.trim())) addLinkCard(url.trim(), pos);
});

async function storeFile(f) {
  const name = f.name || (/^image\//.test(f.type) ? 'pasted.' + (f.type.split('/')[1] || 'png') : 'file.bin');
  const bytes = new Uint8Array(await f.arrayBuffer());
  const id = await api.saveBytes(name, bytes);
  return { id, name, size: f.size, type: f.type };
}

async function importFiles(files, pos) {
  const stored = [];
  for (const f of files) stored.push(await storeFile(f));
  addAssetCards(stored, pos);
}

// Put a picture into an empty picture card (a template placeholder).
async function fillImage(cardId, file) {
  const f = await storeFile(file);
  const c = B().cards[cardId]; if (!c) return;
  checkpoint();
  c.asset = f.id;
  rerenderCard(cardId); scheduleSave();
}

function addLinkCard(url, pos) {
  let title = '';
  try { title = new URL(url).hostname.replace(/^www\./, ''); } catch { return; }
  const c = addCard('link', pos, { url, title, ...(videoEmbed(url) ? { w: 420 } : {}) });
  fetchPreview(c.id);
}

// ======================================================================
// Clipboard
// ======================================================================
document.addEventListener('copy', (e) => {
  if (isTyping() || !selected.size) return;
  const payload = serialize([...selected]);
  e.clipboardData.setData('application/x-pocket-canvas', JSON.stringify(payload));
  e.clipboardData.setData('text/plain', payload.cards.map(cardText).filter(Boolean).join('\n\n'));
  e.preventDefault();
});
document.addEventListener('cut', (e) => {
  if (isTyping() || !selected.size) return;
  const payload = serialize([...selected]);
  e.clipboardData.setData('application/x-pocket-canvas', JSON.stringify(payload));
  e.clipboardData.setData('text/plain', payload.cards.map(cardText).filter(Boolean).join('\n\n'));
  e.preventDefault();
  deleteSelection();
});
document.addEventListener('paste', async (e) => {
  if (isTyping()) return;
  e.preventDefault();
  const pos = viewCentre();
  const own = e.clipboardData.getData('application/x-pocket-canvas');
  if (own) {
    try {
      const payload = JSON.parse(own);
      if (payload.kind === 'pocket-canvas-cards') {
        checkpoint();
        const top = payload.cards.filter((c) => !c.col);
        const minX = Math.min(...top.map((c) => c.x)), minY = Math.min(...top.map((c) => c.y));
        const added = insertPayload(payload, pos.x - minX - 100, pos.y - minY - 60);
        renderBoard(); renderTree();
        selected.clear(); added.forEach((id) => selected.add(id)); refreshSelection();
        scheduleSave();
        return;
      }
    } catch {}
  }
  // (checked before pictures: Excel also puts a picture of the cells on the clipboard)
  // a table copied from a spreadsheet, document or web page becomes a table card (table-style.js)
  const tbl = typeof clipboardTable === 'function' && clipboardTable(e.clipboardData);
  if (tbl) {
    addPastedTable(tbl, pos); // (to fill an existing table instead, click into a cell and paste there)
    return;
  }
  const files = [...e.clipboardData.files];
  if (files.length) {
    const one = selected.size === 1 && B().cards[[...selected][0]];
    if (one && one.type === 'image' && !one.asset && fileKind(files[0].name, files[0].type) === 'image') { await fillImage(one.id, files[0]); return; }
    await importFiles(files, pos);
    return;
  }
  const text = e.clipboardData.getData('text/plain').trim();
  if (!text) return;
  if (/^https?:\/\/\S+$/i.test(text)) { addLinkCard(text, pos); return; }
  const html = text.split(/\n/).map((l) => `<p>${esc(l) || '<br>'}</p>`).join('');
  addCard('note', pos, { html });
});

function cardText(c) {
  switch (c.type) {
    case 'note': return htmlToText(c.html);
    case 'heading': return c.text;
    case 'todo': return [c.title, ...c.items.map((i) => (i.done ? '[x] ' : '[ ] ') + i.text)].filter(Boolean).join('\n');
    case 'link': return [c.title, c.url].filter(Boolean).join(' — ');
    case 'image': return c.caption;
    case 'file': return c.name;
    case 'column': return c.title;
    case 'swatch': return [c.hex, c.title].filter(Boolean).join(' ');
    case 'board': return store.boards[c.boardId]?.title || '';
    case 'table': return c.rows.map((r) => r.join('\t')).join('\n');
    case 'media': return [c.name, c.caption].filter(Boolean).join(' — ');
    case 'sketch': return '';
    default: return '';
  }
}

// ======================================================================
// Context menu
// ======================================================================
const ctx = $('#ctx');
function hideMenu() { ctx.hidden = true; }
function showMenu(x, y, items) {
  ctx.innerHTML = '';
  for (const it of items) {
    if (it === '-') { ctx.appendChild(document.createElement('hr')); continue; }
    if (it.colors) {
      const row = document.createElement('div');
      row.className = 'colors';
      COLORS.forEach((col) => {
        const s = document.createElement('span');
        if (col) s.style.background = col; else { s.className = 'none'; s.title = 'No colour'; }
        if (col === it.current) s.classList.add('on');
        s.onclick = () => { hideMenu(); it.colors(col); };
        row.appendChild(s);
      });
      ctx.appendChild(row);
      continue;
    }
    const btn = document.createElement('button');
    btn.innerHTML = `<span>${it.checked !== undefined ? `<i class="tick">${it.checked ? '✓' : ''}</i>` : ''}${esc(it.label)}</span>${it.hint ? `<span class="hint">${esc(it.hint)}</span>` : ''}`;
    if (it.danger) btn.className = 'danger';
    if (it.checked) btn.classList.add('checked');
    btn.onclick = () => { hideMenu(); it.run(); };
    ctx.appendChild(btn);
  }
  ctx.hidden = false;
  const r = ctx.getBoundingClientRect();
  ctx.style.left = Math.min(x, innerWidth - r.width - 8) + 'px';
  ctx.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
}
document.addEventListener('pointerdown', (e) => { if (!ctx.contains(e.target)) hideMenu(); });

viewport.addEventListener('contextmenu', (e) => {
  // While typing, let the spelling menu (suggestions, Add to dictionary, cut/copy/paste) appear.
  const t = e.target;
  if (t.isContentEditable || (t.tagName === 'INPUT' && t.type !== 'checkbox' && t.type !== 'color' && t.type !== 'range') || t.tagName === 'TEXTAREA') return;
  e.preventDefault();
  const b = B();
  const linkHit = e.target.closest('path.hit, path.link');
  if (linkHit) {
    const l = b.links.find((x) => x.id === linkHit.dataset.id);
    selectedLink = l.id; selected.clear(); refreshSelection();
    showMenu(e.clientX, e.clientY, lineMenuItems(l));
    return;
  }
  const el = e.target.closest('.card');
  if (!el) {
    const pos = toWorld(e.clientX, e.clientY);
    showMenu(e.clientX, e.clientY, [
      { label: 'Add note here', run: () => startEditOf(addCard('note', pos).id) },
      { label: 'Add to-do list here', run: () => startEditOf(addCard('todo', pos).id) },
      { label: 'Add heading here', run: () => startEditOf(addCard('heading', pos).id) },
      { label: 'Add board here', run: () => addTool('board', pos) },
      { label: 'Add column here', run: () => startEditOf(addCard('column', pos).id) },
      { label: 'Add table here', run: () => addTool('table', pos) },
      { label: 'Add sketch here', run: () => addTool('sketch', pos) },
      '-',
      { label: 'Insert a template…', run: () => openTemplates('insert') },
      { label: 'Change this board’s icon…', run: () => openBoardIcon(cur) },
      ...lockMenuItems(cur),
      ...(cur !== store.root ? [{ label: 'Delete this board', danger: true, run: () => deleteBoard(cur) }] : []),
      { label: 'Save this board as a template…', run: () => saveBoardAsTemplate(cur) },
      { label: 'Export board as picture or PDF…', hint: 'Ctrl+Shift+E', run: () => openExport() },
      { label: pageSetup().show ? 'Hide page guides' : 'Show page guides', hint: 'Ctrl+Shift+G', run: togglePageGuides },
      { label: 'Page guide settings…', run: () => openPageGuideMenu($('#pages-btn')) },
      '-',
      { label: 'Fit to content', hint: 'Ctrl+1', run: fitContent },
      { label: 'Select all', hint: 'Ctrl+A', run: selectAll }
    ]);
    return;
  }
  const id = el.dataset.id, c = b.cards[id];
  if (!selected.has(id)) selectOnly(id);
  const ids = [...selected];
  const items = [];
  if (c.type !== 'swatch' && c.type !== 'sketch') items.push({ colors: (col) => setColor(ids, col), current: c.color });
  const cell = c.type === 'table' && e.target.closest('td[data-r]');
  if (cell) items.push(...tableMenuItems(c, +cell.dataset.r, +cell.dataset.c), '-');
  if (c.type === 'board') {
    items.push({ label: 'Open board', run: () => go(c.boardId) });
    items.push({ label: 'Change icon…', run: () => openBoardIcon(c.boardId) });
    items.push(...lockMenuItems(c.boardId));
    items.push({ label: isSharedRoot(c.boardId) ? 'Shared with…' : 'Share with people…', run: () => openShare(c.boardId) });
    items.push({ label: 'Save as a template…', run: () => saveBoardAsTemplate(c.boardId) });
  }
  if (c.type === 'link') {
    if (c.url) items.push({ label: 'Open link', run: () => api.openLink(c.url) });
    items.push({ label: 'Edit web address', run: () => { urlEditing.add(id); rerenderCard(id); startEditOf(id); } });
    if (c.url) items.push({ label: 'Refresh preview', run: () => fetchPreview(id, true) });
    if (c.image) items.push({ label: 'Remove preview picture', run: () => { checkpoint(); delete c.image; rerenderCard(id); scheduleSave(); } });
    if (videoEmbed(c.url)) {
      items.push(showsPlayer(c)
        ? { label: 'Show as link card', run: () => { checkpoint(); c.player = false; playingVideos.delete(id); rerenderCard(id); scheduleSave(); } }
        : { label: 'Show as video player', run: () => { checkpoint(); delete c.player; if (c.w < 360) c.w = 420; rerenderCard(id); scheduleSave(); } });
    }
  }
  if (c.type === 'sketch') items.push({ label: 'Draw', hint: 'Double-click', run: () => startSketch(id) });
  if (c.type === 'image' && !c.asset) items.push({ label: 'Choose picture…', run: () => cardAction('pick-image', c) });
  if ((c.type === 'image' || c.type === 'file' || c.type === 'media') && c.asset) {
    items.push({ label: 'Open with default app', run: () => api.openAsset(c.asset) });
    items.push({ label: 'Save a copy…', run: () => api.saveAssetAs(c.asset, c.name || ('image' + (c.asset.match(/\.[^.]+$/)?.[0] || ''))) });
  }
  const n = (c.comments || []).length;
  items.push({ label: n ? `Comments (${n})` : 'Add comment', hint: 'Ctrl+Shift+M', run: () => openComments(id) });
  items.push('-');
  items.push({ label: 'Draw line from here', run: () => { selectOnly(id); toggleConnect(); } });
  if (c.col) {
    items.push({ label: 'Take out of column', run: () => { checkpoint(); detachFromColumn(id); const cc = b.cards[id]; cc.x += 320; renderBoard(); scheduleSave(); } });
  } else {
    items.push({ label: 'Bring to front', run: () => { checkpoint(); bringToFront(ids); renderBoard(); scheduleSave(); } });
    items.push({ label: 'Send to back', run: () => { checkpoint(); sendToBack(ids); renderBoard(); scheduleSave(); } });
  }
  items.push({ label: 'Duplicate', hint: 'Ctrl+D', run: duplicateSelection });
  const others = Object.values(store.boards).filter((x) => x.id !== cur);
  if (others.length) {
    items.push({ label: 'Move to board…', run: () => moveMenu(e.clientX, e.clientY, ids) });
  }
  items.push('-');
  items.push({ label: 'Move to Recycle bin', hint: 'Del', danger: true, run: deleteSelection });
  showMenu(e.clientX, e.clientY, items);
});

function moveMenu(x, y, ids) {
  const list = [];
  const walk = (bid, depth) => {
    const sb = store.boards[bid]; if (!sb) return;
    if (bid !== cur) list.push({ label: '  '.repeat(depth) + (sb.title || 'Untitled board'), run: () => {
      const snap = JSON.stringify(store);
      if (moveToBoard(ids, bid)) { pushUndo(snap); clearSelection(); renderBoard(); renderTree(); scheduleSave(); }
    } });
    childBoards(bid).forEach((k) => walk(k, depth + 1));
  };
  walk(store.root, 0);
  showMenu(x, y, list.slice(0, 40));
}

// ======================================================================
// Sidebar, breadcrumbs, search
// ======================================================================
$('#tree').addEventListener('click', (e) => {
  const tog = e.target.closest('[data-tog]');
  if (tog && tog.textContent) {
    const id = tog.dataset.tog;
    if (store.ui.collapsed[id]) delete store.ui.collapsed[id]; else store.ui.collapsed[id] = true;
    renderTree(); scheduleSave();
    return;
  }
  const row = e.target.closest('.tree-row');
  if (row) go(row.dataset.board);
});

$('#tree').addEventListener('contextmenu', (e) => {
  const row = e.target.closest('.tree-row');
  if (!row) return;
  e.preventDefault();
  const id = row.dataset.board, b = store.boards[id];
  const items = [
    { label: 'Open', run: () => go(id) },
    { label: 'Rename…', run: async () => {
      const v = await askText({ title: 'Rename board', fields: [{ name: 'title', label: 'Name', value: b.title }] });
      if (v && v.title && v.title !== b.title) { checkpoint(); b.title = v.title.slice(0, 120); renderTree(); renderCrumbs(); if (store.boards[cur].cards) renderBoard(); scheduleSave(); }
    } },
    { label: 'Change icon…', run: () => openBoardIcon(id) },
    ...lockMenuItems(id),
    ...(id !== store.root ? [{ label: isSharedRoot(id) ? 'Shared with…' : 'Share with people…', run: () => openShare(id) }] : [])
  ];
  if (id !== store.root) items.push('-', { label: 'Move to Recycle bin', danger: true, run: () => deleteBoard(id) });
  showMenu(e.clientX, e.clientY, items);
});

$('#crumbs').addEventListener('click', (e) => {
  const rl = e.target.closest('[data-relock]');
  if (rl) { relock(rl.dataset.relock); return; }
  const cr = e.target.closest('.crumb'); if (!cr) return;
  if (!cr.classList.contains('current')) { go(cr.dataset.board); return; }
  // rename current board inline
  const b = B();
  const input = document.createElement('input');
  input.className = 'crumb-input'; input.value = b.title;
  cr.replaceWith(input); input.focus(); input.select();
  const done = (save) => {
    if (save && input.value.trim() && input.value.trim() !== b.title) {
      checkpoint(); b.title = input.value.trim(); scheduleSave();
      renderBoard();
    }
    renderCrumbs(); renderTree();
  };
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') input.blur();
    if (ev.key === 'Escape') { input.value = b.title; input.blur(); }
  });
  input.addEventListener('blur', () => done(true), { once: true });
});

const searchInput = $('#search');
const searchBox = $('#search-results');
searchInput.addEventListener('input', runSearch);
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { searchInput.value = ''; runSearch(); searchInput.blur(); }
  if (e.key === 'Enter') { const f = $('.sr', searchBox); if (f) f.click(); }
});
function runSearch() {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) { searchBox.hidden = true; return; }
  const hits = [];
  for (const sb of Object.values(store.boards)) {
    if ((sb.title || '').toLowerCase().includes(q)) hits.push({ board: sb.parentId || sb.id, card: null, text: sb.title, where: 'Board', go: sb.id });
    for (const c of Object.values(sb.cards)) {
      if (c.type === 'board') continue;
      const t = cardText(c) + (c.type === 'link' && c.desc ? ' — ' + c.desc : '');
      const i = t.toLowerCase().indexOf(q);
      if (i >= 0) hits.push({ board: sb.id, card: c.id, text: t, i, where: sb.title });
      for (const m of c.comments || []) {
        const j = m.text.toLowerCase().indexOf(q);
        if (j >= 0) hits.push({ board: sb.id, card: c.id, text: m.text, i: j, where: `${sb.title} · comment by ${m.author}` });
      }
    }
    if (hits.length > 60) break;
  }
  searchBox.hidden = false;
  if (!hits.length) { searchBox.innerHTML = '<div class="sr-empty">No matches</div>'; return; }
  searchBox.innerHTML = hits.slice(0, 60).map((h, n) => {
    const i = h.i ?? h.text.toLowerCase().indexOf(q);
    const s = Math.max(0, i - 30);
    const snippet = (s ? '…' : '') + esc(h.text.slice(s, i)) + '<mark>' + esc(h.text.slice(i, i + q.length)) + '</mark>' + esc(h.text.slice(i + q.length, i + q.length + 60));
    return `<div class="sr" data-n="${n}">${snippet}<small>${esc(h.where)}</small></div>`;
  }).join('');
  $$('.sr', searchBox).forEach((el) => {
    el.onclick = () => { const h = hits[+el.dataset.n]; if (h.go) go(h.go); else go(h.board, h.card); };
  });
}

// ======================================================================
// Export / import
// ======================================================================
function htmlToMd(html) {
  const d = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html').body.firstElementChild;
  const walk = (n) => {
    if (n.nodeType === 3) return n.textContent;
    const inner = [...n.childNodes].map(walk).join('');
    switch (n.tagName) {
      case 'B': case 'STRONG': return inner.trim() ? `**${inner}**` : inner;
      case 'I': case 'EM': return inner.trim() ? `_${inner}_` : inner;
      case 'S': case 'STRIKE': return `~~${inner}~~`;
      case 'CODE': return '`' + inner + '`';
      case 'A': return `[${inner}](${n.getAttribute('href') || ''})`;
      case 'BR': return '\n';
      case 'H1': return `\n## ${inner}\n`;
      case 'H2': return `\n### ${inner}\n`;
      case 'H3': return `\n#### ${inner}\n`;
      case 'BLOCKQUOTE': return `\n> ${inner}\n`;
      case 'LI': return `\n${n.parentNode.tagName === 'OL' ? '1.' : '-'} ${inner.trim()}`;
      case 'UL': case 'OL': return inner + '\n';
      case 'P': case 'DIV': return `\n${inner}\n`;
      default: return inner;
    }
  };
  return walk(d).replace(/\n{3,}/g, '\n\n').trim();
}
function boardToMd(bid, depth) {
  const sb = store.boards[bid];
  let md = `${'#'.repeat(Math.min(depth, 6))} ${sb.title}\n\n`;
  const top = sb.order.map((id) => sb.cards[id]).filter((c) => c && !c.col).sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const one = (c, d) => {
    switch (c.type) {
      case 'note': return htmlToMd(c.html) + '\n\n';
      case 'heading': return `**${c.text}**\n\n`;
      case 'todo': return (c.title ? `**${c.title}**\n\n` : '') + c.items.map((i) => `- [${i.done ? 'x' : ' '}] ${i.text}`).join('\n') + '\n\n';
      case 'link': return `[${c.title || c.url}](${c.url})` + (c.desc ? `  \n${c.desc}` : '') + '\n\n';
      case 'image': return `![${c.caption || ''}](assets/${c.asset})\n\n`;
      case 'file': return `📎 ${c.name} (assets/${c.asset})\n\n`;
      case 'swatch': return `\`${c.hex}\` ${c.title || ''}\n\n`;
      case 'table': {
        if (!c.rows.length) return '';
        const cell = (t, r, k) => { const p = cellPic(c, r, k); return (p ? `![](assets/${p}) ` : '') + String(t || '').replace(/\|/g, '\\|').replace(/\n/g, ' '); };
        const rowMd = (row, r) => `| ${row.map((t, k) => cell(t, r, k)).join(' | ')} |`;
        const head = c.header ? c.rows[0] : c.rows[0].map(() => '');
        const body = c.header ? c.rows.slice(1) : c.rows;
        return [c.header ? rowMd(head, 0) : `| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...body.map((r, i) => rowMd(r, i + (c.header ? 1 : 0)))].join('\n') + '\n\n';
      }
      case 'media': return `${c.kind === 'video' ? '🎬' : '🎵'} [${c.name || 'Media'}](assets/${c.asset})` + (c.caption ? ` — ${c.caption}` : '') + '\n\n';
      case 'sketch': return '_(sketch — export the board as a picture or PDF to see it)_\n\n';
      case 'column': return `**${c.title || 'Column'}**\n\n` + c.items.map((id) => sb.cards[id]).filter(Boolean).map((k) => one(k, d)).join('');
      case 'board': return store.boards[c.boardId] ? boardToMd(c.boardId, d + 1) : '';
      default: return '';
    }
  };
  for (const c of top) md += one(c, depth);
  return md;
}
async function exportMarkdown() {
  const ok = await api.saveText(`${B().title}.md`, boardToMd(cur, 1), [{ name: 'Markdown', extensions: ['md'] }]);
  if (ok) toast('Board exported');
}
async function exportJson() {
  await updateSeals();
  const ok = await api.saveText('pocket-canvas-backup.json', JSON.stringify(sealStore(store), null, 1), [{ name: 'Pocket-Canvas backup', extensions: ['json'] }]);
  if (ok) toast('Backup saved (images and files stay in the data folder)');
}
async function importJson() {
  const text = await api.openText([{ name: 'Pocket-Canvas backup', extensions: ['json'] }]);
  if (!text) return;
  let data;
  try { data = JSON.parse(text); } catch { toast('That file is not a Pocket-Canvas backup'); return; }
  if (!data || !data.boards || !data.root || !data.boards[data.root]) { toast('That file is not a Pocket-Canvas backup'); return; }
  if (!(await api.confirm('Replace all boards with this backup?', 'You can undo this with Ctrl+Z.'))) return;
  checkpoint();
  unlocked.clear();
  store = migrate(data);
  cur = store.root;
  clearSelection(); render(); scheduleSave();
}

// ======================================================================
// Misc UI
// ======================================================================
let toastTimer;
function toast(msg, action) {
  const t = $('#toast');
  t.textContent = msg;
  if (action) {
    const b = document.createElement('button');
    b.textContent = action.label;
    b.onclick = () => { t.hidden = true; action.run(); };
    t.appendChild(b);
  }
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, action ? 6000 : 2600);
}
function applyTheme() {
  const theme = store.ui.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
  if (typeof applyAppearance === 'function') applyAppearance(); // your own interface colours (appearance.js)
}
function toggleTheme() {
  const now = document.documentElement.dataset.theme;
  store.ui.theme = now === 'dark' ? 'light' : 'dark';
  applyTheme(); scheduleSave();
}
function toggleSidebar() {
  store.ui.sidebar = store.ui.sidebar === false;
  $('#app').classList.toggle('no-sidebar', store.ui.sidebar === false);
  scheduleSave();
}
function selectAll() {
  selected.clear();
  $$(':scope > .card', cardsEl).forEach((el) => selected.add(el.dataset.id));
  selectedLink = null; refreshSelection();
}
function showHelp() { $('#help').hidden = false; }

$('#theme-btn').onclick = toggleTheme;
$('#help-btn').onclick = showHelp;
$('#help-close').onclick = () => { $('#help').hidden = true; };
$('#help').onclick = (e) => { if (e.target.id === 'help') $('#help').hidden = true; };
$('#sidebar-btn').onclick = toggleSidebar;
$('#undo-btn').onclick = undo;
$('#redo-btn').onclick = redo;
$('#zoom-in').onclick = () => zoomAt(B().view.z * 1.2);
$('#zoom-out').onclick = () => zoomAt(B().view.z / 1.2);
$('#zoom-label').onclick = () => zoomAt(1);
$('#zoom-fit').onclick = fitContent;
$('#pages-btn').innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4" /><path d="M9 12h6M9 16h6" stroke-dasharray="2 2"/></svg>';
$('#pages-btn').onclick = (e) => { e.stopPropagation(); openPageGuideMenu($('#pages-btn')); };
$('#pages-chip').onclick = (e) => { e.stopPropagation(); openPageGuideMenu($('#pages-chip')); };
cardsEl.addEventListener('input', () => updatePageGuides());
document.addEventListener('pointerup', () => { if (store && pageSetup().show) updatePageGuides(); });
$('#settings-btn').innerHTML = ICONS.settings;
$('#settings-btn').onclick = () => openSettings();
$('#sync-state').onclick = () => openSettings('sync');
$('#empty-template').onclick = () => openTemplates('insert');

document.addEventListener('keydown', (e) => {
  if (!$('#help').hidden && e.key === 'Escape') { $('#help').hidden = true; return; }
  if (isTyping()) return;
  if (e.key === ' ' && !spaceDown) { spaceDown = true; viewport.classList.add('space'); e.preventDefault(); return; }
  if (e.key === 'Escape') { hideMenu(); if (sketchEditing) stopSketch(); else if (tool) cancelConnect(); else clearSelection(); return; }
  if (api.mobile && (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'g') { e.preventDefault(); togglePageGuides(); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelection(); return; }
  if (e.altKey && e.key === 'ArrowLeft') { const p = B().parentId; if (p) go(p); return; }
  if (e.key === 'Enter' && selected.size === 1) {
    const id = [...selected][0], c = B().cards[id];
    if (c.type === 'board') go(c.boardId);
    else if (c.type === 'sketch') startSketch(id);
    else if (c.type === 'table') startEditOf(id, '[data-field="cell:0:0"]');
    else startEditOf(id);
    e.preventDefault(); return;
  }
  if (e.key.startsWith('Arrow') && selected.size && !e.altKey) {
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    const b = B();
    if (!e.repeat) checkpoint();
    for (const id of selected) {
      const c = b.cards[id]; if (!c || c.col) continue;
      c.x = Math.max(0, c.x + d[0]); c.y = Math.max(0, c.y + d[1]);
      const el = cardEl(id); if (el) { el.style.left = c.x + 'px'; el.style.top = c.y + 'px'; }
    }
    drawLinks(); scheduleSave();
    return;
  }
  // single-letter shortcuts for quick adding
  if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    const map = { n: 'note', t: 'todo', h: 'heading', b: 'board', l: 'line', c: 'column', k: 'link', g: 'table', s: 'sketch' };
    const type = map[e.key.toLowerCase()];
    if (type) { e.preventDefault(); const p = viewCentre(); addTool(type, p); }
  }
});
document.addEventListener('keyup', (e) => {
  if (e.key === ' ') { spaceDown = false; viewport.classList.remove('space'); }
});
window.addEventListener('blur', () => { spaceDown = false; viewport.classList.remove('space'); });
window.addEventListener('resize', () => requestAnimationFrame(drawLinks));
// Don't close until the last change is saved.
let closingAfterSave = false;
window.addEventListener('beforeunload', (e) => {
  if (EXPORT_MODE || closingAfterSave) return;
  if (saveTimer || saving) {
    e.returnValue = false;
    closingAfterSave = true;
    flushSave().finally(() => window.close());
  }
});

api.onMenu((cmd) => {
  const typing = isTyping();
  switch (cmd) {
    case 'undo': typing ? document.execCommand('undo') : undo(); break;
    case 'redo': typing ? document.execCommand('redo') : redo(); break;
    case 'duplicate': if (!typing) duplicateSelection(); break;
    case 'select-all': typing ? document.execCommand('selectAll') : selectAll(); break;
    case 'find':
      store.ui.sidebar = true; $('#app').classList.remove('no-sidebar');
      searchInput.focus(); searchInput.select(); break;
    case 'zoom-in': zoomAt(B().view.z * 1.2); break;
    case 'zoom-out': zoomAt(B().view.z / 1.2); break;
    case 'zoom-reset': zoomAt(1); break;
    case 'zoom-fit': fitContent(); break;
    case 'toggle-sidebar': toggleSidebar(); break;
    case 'toggle-theme': toggleTheme(); break;
    case 'add-board': addTool('board', viewCentre()); break;
    case 'export-md': exportMarkdown(); break;
    case 'export-json': exportJson(); break;
    case 'import-json': importJson(); break;
    case 'help': showHelp(); break;
    case 'new-from-template': openTemplates('new-board'); break;
    case 'insert-template': openTemplates('insert'); break;
    case 'save-template': saveBoardAsTemplate(cur); break;
    case 'export-visual': openExport(); break;
    case 'page-guides': togglePageGuides(); break;
    case 'settings': openSettings(); break;
    case 'settings-sync': openSettings('sync'); break;
    case 'settings-clipper': openSettings('clipper'); break;
    case 'comments': if (selected.size === 1) openComments([...selected][0]); else toast('Select a card first'); break;
    case 'delete': if (!typing) { if (selected.size || selectedLink) deleteSelection(); else toast('Select a card first'); } break;
    case 'bin': openBin(); break;
    case 'settings-backups': openSettings('backups'); break;
    case 'settings-spelling': openSettings('spelling'); break;
  }
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

// ======================================================================
// Start-up
// ======================================================================
function migrate(data) {
  data.ui = Object.assign({ theme: null, collapsed: {}, sidebar: true }, data.ui || {});
  data.templates = data.templates || {};
  data.bin = data.bin || {};
  data.deleted = data.deleted || {};
  for (const b of Object.values(data.boards)) {
    b.cards = b.cards || {}; b.order = b.order || []; b.links = b.links || [];
    b.view = b.view || DEFAULT_VIEW();
    normaliseOrigin(b);
    b.order = b.order.filter((id) => b.cards[id]);
    for (const id of Object.keys(b.cards)) if (!b.order.includes(id)) b.order.push(id);
    b.links = b.links.filter((l) => lineValid(l, b));
    // Colour cards named automatically get today's (more accurate) colour names.
    for (const c of Object.values(b.cards)) {
      if (c.type === 'swatch' && c.nameAuto === true && normaliseHex(c.hex)) {
        const name = colourName(c.hex);
        if (c.title !== name) c.title = name;
      }
    }
  }
  return data;
}

// init() lives in start.js, which loads after the feature scripts.
