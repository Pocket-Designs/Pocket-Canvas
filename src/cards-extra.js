/* Pocket-Canvas — tables, sketches, audio/video, picture placeholders and link previews
 * Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
 */
'use strict';

// ======================================================================
// Card buttons (data-act="…")
// ======================================================================
async function cardAction(act, c, el, e) {
  switch (act) {
    case 'add-row': {
      checkpoint();
      tblInsertRow(c, c.rows.length);
      rerenderCard(c.id); scheduleSave();
      startEditOf(c.id, `[data-field="cell:${c.rows.length - 1}:0"]`);
      break;
    }
    case 'add-col': {
      checkpoint();
      tblInsertCol(c, tableCols(c));
      rerenderCard(c.id); scheduleSave();
      startEditOf(c.id, `[data-field="cell:0:${tableCols(c) - 1}"]`);
      break;
    }
    case 'del-row':
    case 'del-col': {
      const t = tableTarget(c);
      if (act === 'del-row') {
        if (c.rows.length <= 1) { toast('A table needs at least one row'); return; }
        checkpoint(); tblDeleteRow(c, t.r);
      } else {
        if (tableCols(c) <= 1) { toast('A table needs at least one column'); return; }
        checkpoint(); tblDeleteCol(c, t.k);
      }
      lastTableCell = null;
      rerenderCard(c.id); scheduleSave();
      break;
    }
    case 'pick-image': {
      const files = await api.pickFiles('image-one');
      if (!files[0]) return;
      const cc = B().cards[c.id]; if (!cc) return;
      checkpoint();
      cc.asset = files[0].id;
      rerenderCard(c.id); scheduleSave();
      break;
    }
    case 'delete-card': selectOnly(c.id); deleteSelection(); break;
    case 'video-play': case 'video-stop': case 'video-open': videoAction(act, c); break;
    case 'media-play': mediaToggle(c.id); break;
    case 'media-stop': mediaStop(c.id); break;
    case 'media-mute': mediaMute(c.id); break;
  }
}

// ======================================================================
// Tables
// ======================================================================
const tableCols = (c) => Math.max(1, ...c.rows.map((r) => r.length));

// The cell you last clicked in, so "− Row" / "− Column" know which one to remove.
// With no cell chosen they remove the last row / column.
let lastTableCell = null;
document.addEventListener('focusin', (e) => {
  const f = e.target.closest && e.target.closest('[data-field^="cell:"]');
  const card = f && f.closest('.card');
  if (!f || !card) return;
  const [, r, k] = f.dataset.field.split(':').map(Number);
  lastTableCell = { id: card.dataset.id, r, k };
});
function tableTarget(c) {
  const t = lastTableCell && lastTableCell.id === c.id ? lastTableCell : null;
  const cols = tableCols(c);
  return { r: t ? Math.min(t.r, c.rows.length - 1) : c.rows.length - 1, k: t ? Math.min(t.k, cols - 1) : cols - 1 };
}
// Shade the row or column a delete button will remove while the pointer is over it.
function tableHint(btn, on) {
  const cardNode = btn.closest('.card'); if (!cardNode) return;
  const c = B().cards[cardNode.dataset.id]; if (!c) return;
  $$('.tbl td.del-hint', cardNode).forEach((td) => td.classList.remove('del-hint'));
  if (!on) return;
  const t = tableTarget(c);
  const sel = btn.dataset.act === 'del-row' ? `td[data-r="${t.r}"]` : `td[data-c="${t.k}"]`;
  $$(`.tbl ${sel}`, cardNode).forEach((td) => td.classList.add('del-hint'));
}
document.addEventListener('mouseover', (e) => { const b = e.target.closest && e.target.closest('.tbl-btn.del'); if (b) tableHint(b, true); });
document.addEventListener('mouseout', (e) => { const b = e.target.closest && e.target.closest('.tbl-btn.del'); if (b) tableHint(b, false); });

function buildTableHtml(c) {
  const cols = tableCols(c);
  const rows = c.rows.map((r, ri) => `<tr>${Array.from({ length: cols }, (_, ci) => {
    const css = cellCss(cellLook(c, ri, ci));
    const ed = editable(`cell:${ri}:${ci}`, r[ci] || '', ri === 0 && c.header ? `Column ${ci + 1}` : '');
    return `<td data-r="${ri}" data-c="${ci}"${css.td ? ` class="styled" style="${css.td}"` : ''}>${tableGrips(ri, ci)}${tablePicHtml(c, ri, ci)}${css.text ? ed.replace('<div class="editable"', `<div class="editable" style="${css.text}"`) : ed}</td>`;
  }).join('')}</tr>`).join('');
  return `<div class="tbl-wrap"><table class="tbl ${c.header ? 'has-head' : ''}"><tbody>${rows}</tbody></table></div>
    <div class="tbl-tools"><button class="tbl-btn" data-act="add-row">+ Row</button><button class="tbl-btn" data-act="add-col">+ Column</button>
      <span class="tbl-sep"></span>
      <button class="tbl-btn del" data-act="del-row" title="Delete the row of the cell you last clicked (or the last row)">− Row</button><button class="tbl-btn del" data-act="del-col" title="Delete the column of the cell you last clicked (or the last column)">− Column</button></div>`;
}

// Tab / Shift+Tab / Enter move between cells. Returns true if the key was handled.
function tableKey(e, c, field) {
  const [, r, k] = field.split(':').map(Number);
  const cols = tableCols(c);
  const go = (nr, nk) => {
    if (nr >= c.rows.length) {
      checkpoint();
      tblInsertRow(c, c.rows.length);
      rerenderCard(c.id); scheduleSave();
    }
    startEditOf(c.id, `[data-field="cell:${nr}:${nk}"]`);
  };
  // Alt + arrow keys move the row or column you're typing in
  if (e.altKey && !e.ctrlKey && !e.metaKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
    e.stopPropagation(); // the editor is about to close; don't let Alt+← also go up to the parent board
    const row = e.key === 'ArrowUp' || e.key === 'ArrowDown';
    const d = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 1;
    const to = row ? r + d : k + d;
    setField(c, field, e.target);
    e.target.blur();
    if (!moveTablePart(c, row ? 'row' : 'col', row ? r : k, to, row ? { r: to, k } : { r, k: to })) startEditOf(c.id, `[data-field="cell:${r}:${k}"]`);
    return true;
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    let nr = r, nk = k + (e.shiftKey ? -1 : 1);
    if (nk >= cols) { nk = 0; nr++; }
    if (nk < 0) { nk = cols - 1; nr--; }
    if (nr < 0) return true;
    e.target.blur();
    go(nr, nk);
    return true;
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    e.target.blur();
    go(r + 1, k);
    return true;
  }
  return false;
}

// Right-click menu for a cell (or, from a grip, just for a row or a column).
function tableMenuItems(c, r, k, only) {
  const change = (fn) => () => { checkpoint(); fn(); rerenderCard(c.id); scheduleSave(); };
  const cols = tableCols(c);
  const rowItems = [
    { label: 'Move row up', hint: 'Alt+↑', run: () => moveTablePart(c, 'row', r, r - 1), off: r === 0 },
    { label: 'Move row down', hint: 'Alt+↓', run: () => moveTablePart(c, 'row', r, r + 1), off: r >= c.rows.length - 1 },
    { label: 'Insert row above', run: change(() => tblInsertRow(c, r)) },
    { label: 'Insert row below', run: change(() => tblInsertRow(c, r + 1)) },
    { label: 'Colour this row…', run: () => styleTablePart(c, r, k, 'row') },
    { label: 'Delete row', run: change(() => tblDeleteRow(c, r)), off: c.rows.length <= 1 }
  ];
  const colItems = [
    { label: 'Move column left', hint: 'Alt+←', run: () => moveTablePart(c, 'col', k, k - 1), off: k === 0 },
    { label: 'Move column right', hint: 'Alt+→', run: () => moveTablePart(c, 'col', k, k + 1), off: k >= cols - 1 },
    { label: 'Insert column left', run: change(() => tblInsertCol(c, k)) },
    { label: 'Insert column right', run: change(() => tblInsertCol(c, k + 1)) },
    { label: 'Colour this column…', run: () => styleTablePart(c, r, k, 'col') },
    { label: 'Delete column', run: change(() => tblDeleteCol(c, k)), off: cols <= 1 }
  ];
  const keep = (list) => list.filter((it) => !it.off).map(({ off, ...it }) => it);
  if (only === 'row') return keep(rowItems);
  if (only === 'col') return keep(colItems);
  const pic = cellPic(c, r, k);
  return [
    { label: pic ? 'Replace picture…' : 'Add a picture…', run: () => pickCellPic(c, r, k) },
    ...(pic ? [
      { label: 'Open picture', run: () => api.openAsset(pic) },
      { label: 'Save a copy of the picture…', run: () => api.saveAssetAs(pic, 'picture' + pic.slice(pic.lastIndexOf('.'))) },
      { label: 'Remove picture', run: change(() => setCellPic(c, r, k, null)) }
    ] : []),
    '-',
    { label: 'Colour this cell…', run: () => styleTablePart(c, r, k, 'cell') },
    { label: 'Text colour and style…', run: () => styleTablePart(c, r, k, 'cell', 'colour') },
    '-',
    ...keep(rowItems), '-', ...keep(colItems), '-',
    { label: c.header ? 'Turn off heading row' : 'Use first row as headings', run: change(() => { c.header = !c.header; }) }
  ];
}

// ======================================================================
// Sketches (freehand drawing)
// ======================================================================
let sketchEditing = null;
let sketchStroking = false;
// mode: 'pen' | 'line' | 'arrow' | 'rect' | 'ellipse'; eraser switches the eraser on instead
const sketchTool = { color: '#2b2823', size: 4, eraser: false, mode: 'pen', fill: false };
const SKETCH_MODES = [['pen', 'Pen'], ['line', 'Line'], ['arrow', 'Arrow'], ['rect', 'Rectangle'], ['ellipse', 'Ellipse']];
const SKETCH_MODE_ICONS = {
  pen: '<svg viewBox="0 0 24 24"><path d="M4 18c3-1 4-6 7-7s3 4 5 3 3-6 4-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  line: '<svg viewBox="0 0 24 24"><path d="M5 19L19 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="M5 19L19 5M11 5h8v8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  rect: '<svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  ellipse: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="8" ry="6" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
};
const SKETCH_COLORS = ['#2b2823', '#d0453b', '#e0673a', '#e8a33d', '#5bb276', '#3a7be0', '#6a5fd6', '#c4579f', '#ffffff'];
const SKETCH_SIZES = [[2, 'Fine'], [4, 'Medium'], [9, 'Thick'], [18, 'Marker']];

const safeColor = (v) => (/^#[0-9a-f]{3,8}$/i.test(v) ? v : '#2b2823');

function strokeD(p) {
  if (p.length < 4) return `M${p[0]},${p[1]} l0.01,0`;
  let d = `M${p[0]},${p[1]}`;
  for (let i = 2; i < p.length - 2; i += 2) {
    const mx = (p[i] + p[i + 2]) / 2, my = (p[i + 1] + p[i + 3]) / 2;
    d += ` Q${p[i]},${p[i + 1]} ${mx},${my}`;
  }
  d += ` L${p[p.length - 2]},${p[p.length - 1]}`;
  return d;
}
// A pressure-sensitive line is drawn as a filled outline whose width follows the pen pressure.
// st.pr holds one pressure (0–1) per point; 0.5 draws the chosen size.
const pressureWidth = (size, pr) => size * Math.max(0.15, Math.min(1.9, 0.25 + 1.5 * pr));
function pressureOutline(p, pr, size) {
  const n = p.length / 2;
  if (n < 2) { const r = pressureWidth(size, pr[0] || 0.5) / 2; return `M${p[0] - r},${p[1]} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0`; }
  const left = [], right = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    let dx = p[b * 2] - p[a * 2], dy = p[b * 2 + 1] - p[a * 2 + 1];
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const r = pressureWidth(size, pr[i] == null ? 0.5 : pr[i]) / 2;
    left.push([p[i * 2] - dy * r, p[i * 2 + 1] + dx * r]);
    right.push([p[i * 2] + dy * r, p[i * 2 + 1] - dx * r]);
  }
  const smooth = (pts) => { let d = ''; for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; d += ` Q${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`; } return d; };
  const rEnd = pressureWidth(size, pr[n - 1] == null ? 0.5 : pr[n - 1]) / 2, rStart = pressureWidth(size, pr[0] == null ? 0.5 : pr[0]) / 2;
  const L = left, R = right.slice().reverse();
  return `M${L[0][0].toFixed(1)},${L[0][1].toFixed(1)}${smooth(L)} L${L[n - 1][0].toFixed(1)},${L[n - 1][1].toFixed(1)}` +
    ` A${rEnd.toFixed(1)},${rEnd.toFixed(1)} 0 0,1 ${R[0][0].toFixed(1)},${R[0][1].toFixed(1)}${smooth(R)} L${R[n - 1][0].toFixed(1)},${R[n - 1][1].toFixed(1)}` +
    ` A${rStart.toFixed(1)},${rStart.toFixed(1)} 0 0,1 ${L[0][0].toFixed(1)},${L[0][1].toFixed(1)}Z`;
}
// Points along a shape's outline, used by the eraser.
function shapePoints(st) {
  const { x1, y1, x2, y2 } = st;
  if (st.t === 'rect') return [x1, y1, x2, y1, x2, y2, x1, y2, x1, y1];
  if (st.t === 'ellipse') {
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2, out = [];
    for (let i = 0; i <= 32; i++) { const a = i / 32 * Math.PI * 2; out.push(cx + rx * Math.cos(a), cy + ry * Math.sin(a)); }
    return out;
  }
  return [x1, y1, x2, y2];
}
function strokeSvg(st) {
  const col = safeColor(st.c), w = Math.max(0.5, Math.min(60, +st.s || 4));
  const line = `stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
  if (st.t) {
    const x1 = +st.x1 || 0, y1 = +st.y1 || 0, x2 = +st.x2 || 0, y2 = +st.y2 || 0;
    const fill = st.f ? `fill="${col}" fill-opacity="0.18"` : 'fill="none"';
    if (st.t === 'rect') return `<rect x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}" width="${Math.abs(x2 - x1)}" height="${Math.abs(y2 - y1)}" rx="${Math.min(6, w)}" ${line} ${fill}/>`;
    if (st.t === 'ellipse') return `<ellipse cx="${(x1 + x2) / 2}" cy="${(y1 + y2) / 2}" rx="${Math.abs(x2 - x1) / 2}" ry="${Math.abs(y2 - y1) / 2}" ${line} ${fill}/>`;
    let svg = `<path d="M${x1},${y1} L${x2},${y2}" ${line} fill="none"/>`;
    if (st.t === 'arrow') {
      const ang = Math.atan2(y2 - y1, x2 - x1), head = Math.max(10, w * 3.2);
      const hx = (a) => (x2 - head * Math.cos(ang + a)).toFixed(1), hy = (a) => (y2 - head * Math.sin(ang + a)).toFixed(1);
      svg += `<path d="M${hx(0.45)},${hy(0.45)} L${x2},${y2} L${hx(-0.45)},${hy(-0.45)}" ${line} fill="none"/>`;
    }
    return svg;
  }
  if (Array.isArray(st.pr) && st.pr.length) return `<path d="${pressureOutline(st.p, st.pr, w)}" fill="${col}" stroke="none"/>`;
  return `<path d="${strokeD(st.p)}" ${line} fill="none"/>`;
}

function buildSketchHtml(c) {
  const hint = !c.strokes.length && sketchEditing !== c.id && !EXPORT_MODE ? '<div class="sketch-hint">Double-click to draw</div>' : '';
  return `<div class="sketch-wrap" style="aspect-ratio:${c.vw} / ${c.vh}"><svg viewBox="0 0 ${c.vw} ${c.vh}" preserveAspectRatio="none">${c.strokes.map(strokeSvg).join('')}</svg>${hint}</div>`;
}

function buildSketchBar() {
  const bar = $('#sketch-bar');
  bar.innerHTML = `
    <div class="sk-group">${SKETCH_MODES.map(([m, name]) => `<button class="sk-mode" data-mode="${m}" title="${name}${m === 'pen' ? ' (pressure-sensitive with a pen)' : m === 'line' || m === 'arrow' ? ' — hold Shift for straight angles' : ' — hold Shift for a square/circle'}">${SKETCH_MODE_ICONS[m]}</button>`).join('')}
      <button class="sk-btn sk-fill" data-sk="fill" title="Fill rectangles and ellipses with a light tint of the colour">Fill</button></div>
    <div class="sk-group">${SKETCH_COLORS.map((col) => `<button class="sk-color" data-color="${col}" style="--sw:${col}" title="${col}"></button>`).join('')}</div>
    <div class="sk-group">${SKETCH_SIZES.map(([s, name]) => `<button class="sk-size" data-size="${s}" title="${name}"><i style="width:${Math.min(16, s + 2)}px;height:${Math.min(16, s + 2)}px"></i></button>`).join('')}</div>
    <div class="sk-group">
      <button class="sk-btn" data-sk="eraser" title="Eraser: drag over lines to remove them">Eraser</button>
      <button class="sk-btn" data-sk="undo" title="Remove the last line">Undo line</button>
      <button class="sk-btn" data-sk="clear" title="Clear the whole sketch">Clear</button>
    </div>
    <button class="primary-btn sk-done" data-sk="done">Done</button>`;
  bar.addEventListener('pointerdown', (e) => e.stopPropagation());
  bar.addEventListener('click', (e) => {
    const col = e.target.closest('[data-color]');
    const size = e.target.closest('[data-size]');
    const b = e.target.closest('[data-sk]');
    const mode = e.target.closest('[data-mode]');
    if (mode) { sketchTool.mode = mode.dataset.mode; sketchTool.eraser = false; }
    if (b && b.dataset.sk === 'fill') sketchTool.fill = !sketchTool.fill;
    if (col) { sketchTool.color = col.dataset.color; sketchTool.eraser = false; }
    if (size) { sketchTool.size = +size.dataset.size; sketchTool.eraser = false; }
    if (b) {
      const c = sketchEditing && B().cards[sketchEditing];
      if (b.dataset.sk === 'eraser') sketchTool.eraser = !sketchTool.eraser;
      if (b.dataset.sk === 'done') { stopSketch(); return; }
      if (c && b.dataset.sk === 'undo' && c.strokes.length) { checkpoint(); c.strokes.pop(); redrawSketch(c); scheduleSave(); }
      if (c && b.dataset.sk === 'clear' && c.strokes.length) { checkpoint(); c.strokes = []; redrawSketch(c); scheduleSave(); }
    }
    updateSketchBar();
  });
}
function updateSketchBar() {
  $$('#sketch-bar .sk-color').forEach((x) => x.classList.toggle('on', !sketchTool.eraser && x.dataset.color === sketchTool.color));
  $$('#sketch-bar .sk-size').forEach((x) => x.classList.toggle('on', !sketchTool.eraser && +x.dataset.size === sketchTool.size));
  const er = $('#sketch-bar [data-sk="eraser"]'); if (er) er.classList.toggle('on', sketchTool.eraser);
  $$('#sketch-bar .sk-mode').forEach((x) => x.classList.toggle('on', !sketchTool.eraser && x.dataset.mode === sketchTool.mode));
  const fl = $('#sketch-bar [data-sk="fill"]'); if (fl) fl.classList.toggle('on', sketchTool.fill);
}

function startSketch(id) {
  if (sketchEditing && sketchEditing !== id) stopSketch();
  blurEditing();
  cancelConnect();
  sketchEditing = id;
  selectOnly(id);
  const el = rerenderCard(id);
  if (el) el.classList.add('drawing');
  $('#sketch-bar').hidden = false;
  updateSketchBar();
}
function stopSketch() {
  if (!sketchEditing) return;
  const id = sketchEditing;
  sketchEditing = null;
  $('#sketch-bar').hidden = true;
  if (B().cards[id]) rerenderCard(id);
}
function redrawSketch(c) {
  const el = cardEl(c.id);
  const svg = el && $('svg', el);
  if (svg) svg.innerHTML = c.strokes.map(strokeSvg).join('');
}

// Distance from point (x,y) to the line segment a–b.
function segDist(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = dx || dy ? clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1) : 0;
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

function startStroke(e, id) {
  const c = B().cards[id];
  const el = cardEl(id);
  const svg = el && $('.sketch-wrap svg', el);
  if (!c || !svg) return;
  const snap = JSON.stringify(store);
  const r = svg.getBoundingClientRect();
  const pt = (ev) => [
    Math.round(clamp((ev.clientX - r.left) / r.width, 0, 1) * c.vw * 10) / 10,
    Math.round(clamp((ev.clientY - r.top) / r.height, 0, 1) * c.vh * 10) / 10
  ];
  sketchStroking = true;
  let changed = false;
  let move, path, st;

  if (sketchTool.eraser) {
    const rad = 10 * c.vw / Math.max(r.width, 1);
    const erase = (ev) => {
      const [x, y] = pt(ev);
      const before = c.strokes.length;
      c.strokes = c.strokes.filter((s) => {
        const p = s.t ? shapePoints(s) : s.p, lim = rad + s.s / 2;
        if (p.length < 4) return Math.hypot(p[0] - x, p[1] - y) >= lim;
        for (let i = 0; i < p.length - 2; i += 2) if (segDist(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) < lim) return false;
        return true;
      });
      if (c.strokes.length !== before) { changed = true; redrawSketch(c); }
    };
    erase(e);
    move = erase;
  } else if (sketchTool.mode !== 'pen') {
    // shapes: drag from one corner (or end) to the other
    const [x1, y1] = pt(e);
    st = { t: sketchTool.mode, c: sketchTool.color, s: sketchTool.size, x1, y1, x2: x1, y2: y1 };
    if (sketchTool.fill && (st.t === 'rect' || st.t === 'ellipse')) st.f = 1;
    path = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(path);
    move = (ev) => {
      let [x2, y2] = pt(ev);
      if (ev.shiftKey) {
        const dx = x2 - x1, dy = y2 - y1;
        if (st.t === 'rect' || st.t === 'ellipse') { const m = Math.max(Math.abs(dx), Math.abs(dy)); x2 = x1 + Math.sign(dx || 1) * m; y2 = y1 + Math.sign(dy || 1) * m; }
        else { const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), len = Math.hypot(dx, dy); x2 = x1 + Math.cos(a) * len; y2 = y1 + Math.sin(a) * len; }
      }
      st.x2 = Math.round(x2 * 10) / 10; st.y2 = Math.round(y2 * 10) / 10;
      if (!changed && Math.hypot(st.x2 - x1, st.y2 - y1) > 2) { c.strokes.push(st); changed = true; }
      path.innerHTML = changed ? strokeSvg(st) : '';
    };
  } else {
    // a pen or stylus that reports pressure draws a line that thickens as you press harder
    const usesPressure = (ev) => ev.pointerType === 'pen' || (ev.pointerType === 'touch' && ev.pressure > 0 && ev.pressure !== 0.5 && ev.pressure !== 1);
    const pressure = (ev) => Math.round(Math.max(0.05, Math.min(1, ev.pressure || 0.5)) * 100) / 100;
    st = { c: sketchTool.color, s: sketchTool.size, p: pt(e) };
    if (usesPressure(e)) st.pr = [pressure(e)];
    c.strokes.push(st);
    path = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(path);
    path.innerHTML = strokeSvg(st);
    changed = true;
    move = (ev) => {
      const events = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev];
      for (const ce of events.length ? events : [ev]) {
        const [x, y] = pt(ce);
        const n = st.p.length;
        if (Math.hypot(x - st.p[n - 2], y - st.p[n - 1]) >= 1.5) {
          st.p.push(x, y);
          if (st.pr) st.pr.push(pressure(ce));
          else if (usesPressure(ce)) st.pr = st.p.map(() => pressure(ce)).slice(0, st.p.length / 2);
        }
      }
      path.innerHTML = strokeSvg(st);
    };
  }
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    sketchStroking = false;
    if (changed) { pushUndo(snap); scheduleSave(); }
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

// ======================================================================
// Audio and video
// ======================================================================
// Players are kept between re-draws so playback isn't interrupted when the board changes.
const mediaEls = new Map(); // cardId -> { el, asset }

const PLAY_SVG = '<svg viewBox="0 0 24 24"><path d="M7 5v14l12-7z" fill="currentColor"/></svg>';
const PAUSE_SVG = '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>';
const STOP_SVG = '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor"/></svg>';
const VOL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" stroke-linecap="round"/></svg>';
const MUTE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6" stroke-linecap="round"/></svg>';
const NOTE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></svg>';

const fmtTime = (t) => {
  if (!isFinite(t)) return '0:00';
  t = Math.floor(t);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
};

function buildMediaHtml(c) {
  if (!c.asset) return '<div class="missing">No media file</div>';
  const video = c.kind === 'video';
  return `${video ? '<div class="media-stage"></div>' : `<div class="media-audio"><div class="media-note">${NOTE_SVG}</div><div class="media-name">${esc(c.name || 'Audio')}</div></div>`}
    <div class="media-bar">
      <button class="m-btn" data-act="media-play" title="Play">${PLAY_SVG}</button>
      <button class="m-btn" data-act="media-stop" title="Stop">${STOP_SVG}</button>
      <input type="range" class="m-seek" min="0" max="1000" value="0" step="1" title="Position">
      <span class="m-time">0:00</span>
      <button class="m-btn" data-act="media-mute" title="Mute">${VOL_SVG}</button>
    </div>
    ${video ? `<div class="media-name small" title="${esc(c.name)}">${esc(c.name || 'Video')}</div>` : ''}
    <div class="caption">${editable('caption', c.caption, 'Add a caption')}</div>`;
}

function mountMedia(el, c) {
  if (!c.asset) return;
  let m = mediaEls.get(c.id);
  if (!m || m.asset !== c.asset || m.el.tagName.toLowerCase() !== (c.kind === 'video' ? 'video' : 'audio')) {
    if (m) { m.el.pause(); m.el.removeAttribute('src'); }
    const node = document.createElement(c.kind === 'video' ? 'video' : 'audio');
    node.preload = 'metadata';
    node.src = assetBase + encodeURIComponent(c.asset) + (c.kind === 'video' ? '#t=0.1' : '');
    if (c.kind === 'video') { node.playsInline = true; node.disablePictureInPicture = false; }
    m = { el: node, asset: c.asset };
    mediaEls.set(c.id, m);
    const id = c.id;
    const ui = () => updateMediaUi(id);
    ['timeupdate', 'loadedmetadata', 'play', 'pause', 'ended', 'volumechange'].forEach((ev) => node.addEventListener(ev, ui));
    node.addEventListener('loadedmetadata', () => requestAnimationFrame(drawLinks));
    node.addEventListener('play', () => { for (const [oid, o] of mediaEls) if (oid !== id) o.el.pause(); });
    node.addEventListener('ended', () => { node.currentTime = 0; });
    node.addEventListener('error', () => {
      const card = cardEl(id);
      const t = card && $('.m-time', card);
      if (t) t.textContent = 'Can’t play this file';
    });
  }
  if (c.kind === 'video') $('.media-stage', el).appendChild(m.el);
  else { m.el.hidden = true; el.appendChild(m.el); }
  const seek = $('.m-seek', el);
  seek.addEventListener('input', () => {
    const mm = mediaEls.get(c.id);
    if (mm && isFinite(mm.el.duration)) mm.el.currentTime = (seek.value / 1000) * mm.el.duration;
  });
  updateMediaUi(c.id, el);
}

function updateMediaUi(id, el = cardEl(id)) {
  const m = mediaEls.get(id);
  if (!m || !el) return;
  const v = m.el;
  const play = $('[data-act="media-play"]', el);
  if (play) { play.innerHTML = v.paused ? PLAY_SVG : PAUSE_SVG; play.title = v.paused ? 'Play' : 'Pause'; }
  const mute = $('[data-act="media-mute"]', el);
  if (mute) { mute.innerHTML = v.muted ? MUTE_SVG : VOL_SVG; mute.title = v.muted ? 'Unmute' : 'Mute'; }
  const seek = $('.m-seek', el);
  if (seek && document.activeElement !== seek) seek.value = isFinite(v.duration) && v.duration ? Math.round((v.currentTime / v.duration) * 1000) : 0;
  const t = $('.m-time', el);
  if (t && !v.error) t.textContent = `${fmtTime(v.currentTime)} / ${fmtTime(v.duration)}`;
  el.classList.toggle('playing', !v.paused);
}

function mediaToggle(id) {
  const m = mediaEls.get(id); if (!m) return;
  if (m.el.paused) m.el.play().catch(() => toast('This file can’t be played here. Right-click › Open with default app.'));
  else m.el.pause();
}
function mediaStop(id) {
  const m = mediaEls.get(id); if (!m) return;
  m.el.pause();
  m.el.currentTime = 0;
  updateMediaUi(id);
}
function mediaMute(id) {
  const m = mediaEls.get(id); if (!m) return;
  m.el.muted = !m.el.muted;
}

// Stop players whose cards are no longer on screen (another board, deleted…).
function cleanupMedia() {
  for (const [id, m] of mediaEls) {
    if (!m.el.isConnected) {
      m.el.pause();
      m.el.removeAttribute('src');
      try { m.el.load(); } catch {}
      mediaEls.delete(id);
    }
  }
}

// ======================================================================
// Link previews
// ======================================================================
async function fetchPreview(id, force = false, boardId = cur) {
  const board = store.boards[boardId];
  const c = board && board.cards[id];
  if (!c || !c.url) return;
  if (!settingsCache.linkPreviews) { if (force) toast('Link previews are turned off in Settings'); return; }
  const url = c.url;
  previewLoading.add(id);
  if (boardId === cur) rerenderCard(id);
  let p = null;
  try { p = await api.linkPreview(url); } catch {}
  previewLoading.delete(id);
  const cc = store.boards[boardId] && store.boards[boardId].cards[id];
  if (!cc || cc.url !== url) { if (boardId === cur && cardEl(id)) rerenderCard(id); return; }
  if (p && !p.error) {
    let host = '';
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch {}
    if (p.title && (!cc.title || cc.title === host || force)) cc.title = p.title.slice(0, 200);
    if (p.description) cc.desc = p.description;
    if (p.siteName) cc.site = p.siteName.slice(0, 80);
    if (p.image) cc.image = p.image;
    if (p.icon) cc.icon = p.icon;
    scheduleSave();
  } else if (force) {
    toast((p && p.error) || 'Couldn’t get a preview for that page');
  }
  if (boardId === cur && cardEl(id)) rerenderCard(id);
}

// ======================================================================
// Colour cards
// ======================================================================
// The name follows the colour until you type your own name (clear the name to switch back).
function swatchAutoName(c) {
  if (c.nameAuto === false) return false;
  if (c.nameAuto === true) return true;
  return !c.title || c.title === colourName(c.hex); // older cards without the flag
}

function setSwatchColour(c, value) {
  const hex = normaliseHex(value);
  if (!hex) return;
  if (hex === c.hex) { rerenderCard(c.id); return; }
  checkpoint();
  const auto = swatchAutoName(c);
  c.hex = hex;
  if (auto) { c.title = colourName(hex); c.nameAuto = true; }
  rerenderCard(c.id);
  scheduleSave();
}

// ======================================================================
// Board icons
// ======================================================================
function boardIconInfo(b) {
  const id = (b && b.icon) || 'board';
  return BOARD_ICONS.find((i) => i.id === id) || BOARD_ICONS[0];
}

function boardIconImg(b) {
  if (b && b.iconAsset) return `<img src="${assetBase + encodeURIComponent(b.iconAsset)}" alt="" draggable="false">`;
  return `<img src="board-icons/${encodeURIComponent(boardIconInfo(b).file)}" alt="" draggable="false">`;
}

// Board icon background colours: 17 hues, each in a light, middle and deep shade.
const BOARD_ICON_COLOURS = [
  ['#f19a93', '#d0453b', '#8f2a23'], ['#f2a77f', '#e0673a', '#9c4220'], ['#f3c97e', '#e8a33d', '#a8701f'],
  ['#ece17a', '#d9bf2b', '#8f7c14'], ['#bfdc7c', '#8fbc3a', '#5a7a22'], ['#94d3a6', '#5bb276', '#2f7346'],
  ['#8ccfc9', '#38a3a5', '#1f6a6b'], ['#8fd5ec', '#2fa9d6', '#1a6c8c'], ['#9bbcf0', '#3a7be0', '#22509c'],
  ['#a9a8ee', '#5a5bd1', '#353694'], ['#bdb2ee', '#6a5fd6', '#43389a'], ['#d3a6e6', '#9d4ec4', '#64287f'],
  ['#ecaad3', '#c4579f', '#85305f'], ['#f3a3b5', '#db4f74', '#93283f'], ['#d1b394', '#9a6b44', '#5e3e24'],
  ['#c9c2b8', '#8a7f70', '#57534e'], ['#e4e4e4', '#9a9a9a', '#2f2f2f']
];

function openBoardIcon(boardId) {
  const b = store.boards[boardId];
  if (!b) return;
  const body = document.createElement('div');
  body.className = 'icon-picker';
  const draw = () => {
    const cur = b.iconAsset ? null : (b.icon || 'board');
    body.innerHTML = `
      <div class="ip-preview">
        <div class="board-ico big${b.iconAsset ? ' custom' : ''}${boardIconInfo(b).tint ? '' : ' full'}" style="--c:${safeColor(b.color || '#8a7f70')}">${boardIconImg(b)}</div>
        <div><div class="ip-title">${esc(b.title || 'Untitled board')}</div>
          <div class="muted small">Pick an icon and a colour. They show on the board’s card and in the sidebar.</div></div>
      </div>
      <h3>Colour</h3>
      <div class="ip-colours grid">${[0, 1, 2].map((shade) => BOARD_ICON_COLOURS.map((h) => h[shade]).map((col) =>
        `<button class="ip-col ${b.color && col === b.color.toLowerCase() ? 'on' : ''}" data-col="${col}" style="--sw:${col}" title="${esc(colourName(col))} ${col}"></button>`).join('')).join('')}</div>
      <div class="ip-custom">
        <span class="muted small">Your own colour</span>
        <input type="color" class="ip-picker" value="${safeColor(normaliseHex(b.color || '') || '#8a7f70')}" title="Pick any colour">
        <input type="text" class="ip-hex" maxlength="7" spellcheck="false" value="${esc(b.color || '')}" placeholder="#3a7be0" aria-label="Hex colour code">
        <span class="muted small ip-name">${b.color ? esc(colourName(b.color)) : ''}</span>
      </div>
      <h3>Icon</h3>
      <div class="ip-grid">${BOARD_ICONS.map((i) => `<button class="ip-ico ${i.id === cur ? 'on' : ''} ${i.tint ? '' : 'full'}" data-icon="${esc(i.id)}" title="${esc(i.name)}" style="--c:${safeColor(b.color || '#8a7f70')}"><img src="board-icons/${encodeURIComponent(i.file)}" alt=""><span>${esc(i.name)}</span></button>`).join('')}</div>
      <div class="btn-row">
        <button class="ghost-btn" data-ip="own">Use my own picture…</button>
        ${b.iconAsset ? '<button class="ghost-btn" data-ip="clear">Remove my picture</button>' : ''}
      </div>`;
  };
  const apply = (fn) => {
    checkpoint(); fn(); scheduleSave();
    renderBoard(); renderTree(); draw();
  };
  const setColour = (hex) => apply(() => {
    b.color = hex;
    for (const pb of Object.values(store.boards)) for (const c of Object.values(pb.cards)) if (c.type === 'board' && c.boardId === b.id) c.color = b.color;
  });
  body.addEventListener('change', (e) => {
    if (e.target.classList.contains('ip-picker')) setColour(e.target.value);
    if (e.target.classList.contains('ip-hex')) {
      const hex = normaliseHex(e.target.value);
      if (hex) setColour(hex); else { e.target.classList.add('bad'); toast('That isn’t a colour code — try something like #3a7be0'); }
    }
  });
  body.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList.contains('ip-hex')) { e.preventDefault(); e.target.dispatchEvent(new Event('change', { bubbles: true })); } });
  body.addEventListener('click', async (e) => {
    const ic = e.target.closest('[data-icon]');
    const col = e.target.closest('[data-col]');
    const act = e.target.closest('[data-ip]');
    if (ic) apply(() => { b.icon = ic.dataset.icon; delete b.iconAsset; });
    if (col) setColour(col.dataset.col);
    if (act && act.dataset.ip === 'own') {
      const files = await api.pickFiles('image-one');
      if (files[0]) apply(() => { b.iconAsset = files[0].id; });
    }
    if (act && act.dataset.ip === 'clear') apply(() => { delete b.iconAsset; });
  });
  draw();
  openModal({ title: 'Board icon', body, wide: true, actions: [{ label: 'Done', primary: true }] });
}
