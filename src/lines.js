/* Pocket-Canvas — lines and arrows
 * Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
 *
 * A line has two ends. Each end is either attached to a card (from / to = card id)
 * or free on the board (from / to = null, fromPt / toPt = {x, y} in board units).
 *
 *   { id, from, to, fromPt?, toPt?,
 *     arrow: 'end' | 'start' | 'both' | 'none',   (older lines: undefined = 'end', false = 'none')
 *     dash:  'solid' | 'dashed' | 'dotted',
 *     width: 2 | 3 | 5,
 *     shape: 'curve' | 'straight',
 *     color }
 */
'use strict';

const LINE_ARROWS = [['none', 'No arrows'], ['end', 'Arrow at the end'], ['start', 'Arrow at the start'], ['both', 'Arrows at both ends']];
const LINE_DASHES = [['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']];
const LINE_WIDTHS = [[2, 'Thin'], [3, 'Medium'], [5, 'Thick']];
const LINE_SHAPES = [['curve', 'Curved'], ['straight', 'Straight']];
const DASH_ARRAY = { solid: '', dashed: '10 7', dotted: '0.1 7' };
const NEAR = 8; // a click that moves less than this is a click, not a drag

const lineArrow = (l) => (l.arrow === false ? 'none' : (typeof l.arrow === 'string' ? l.arrow : 'end'));
const lineDash = (l) => (DASH_ARRAY[l.dash] !== undefined ? l.dash : 'solid');
const lineWidth = (l) => ([2, 3, 5].includes(l.width) ? l.width : 2);
const lineShape = (l) => (l.shape === 'straight' ? 'straight' : 'curve');
const lineCards = (l) => [l.from, l.to].filter(Boolean);
const otherEnd = (which) => (which === 'from' ? 'to' : 'from');

// Settings new lines start with (remembered per computer, in the store's ui part).
function lineDefaults() {
  const d = (store && store.ui && store.ui.line) || {};
  return { arrow: d.arrow || 'end', dash: d.dash || 'solid', width: d.width || 2, shape: d.shape || 'curve' };
}

// A line is complete if each end is a card on this board or a free point.
function lineValid(l, b) {
  const ok = (w) => (l[w] ? !!b.cards[l[w]] : !!(l[w + 'Pt'] && isFinite(l[w + 'Pt'].x) && isFinite(l[w + 'Pt'].y)));
  return ok('from') && ok('to') && !(l.from && l.from === l.to);
}

// ---------- Geometry ----------
function endCentre(l, which) {
  if (l[which]) { const el = cardEl(l[which]); if (!el) return null; const r = worldRect(el); return { x: r.x + r.w / 2, y: r.y + r.h / 2, r }; }
  const p = l[which + 'Pt']; return p ? { x: p.x, y: p.y } : null;
}
function lineEnds(l) {
  const a = endCentre(l, 'from'), b = endCentre(l, 'to');
  if (!a || !b) return null;
  const pa = a.r ? edgePoint(a.r, b.x, b.y) : { x: a.x, y: a.y };
  const pb = b.r ? edgePoint(b.r, a.x, a.y) : { x: b.x, y: b.y };
  return { a: pa, b: pb };
}
function linePathD(l, ends) {
  const { a, b } = ends;
  if (lineShape(l) === 'straight') return `M${a.x},${a.y} L${b.x},${b.y}`;
  // a gentle curve looks more hand-drawn than a ruler line
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const nx = -(b.y - a.y) * 0.08, ny = (b.x - a.x) * 0.08;
  return `M${a.x},${a.y} Q${mx + nx},${my + ny} ${b.x},${b.y}`;
}

// ---------- Drawing ----------
// Handles for dragging the ends of the selected line sit above the cards.
const lineHandles = (() => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'line-handles';
  world.appendChild(svg);
  return svg;
})();

function markerId(colour) { return 'lm-' + (colour ? colour.replace(/[^0-9a-z]/gi, '') : 'default'); }

function drawLinks() {
  if (!store) return;
  if (typeof updatePageGuides === 'function') updatePageGuides();
  if (typeof updateScrollbars === 'function') updateScrollbars();
  const b = B();
  const colours = new Set([null]);
  let html = '', handles = '';
  for (const l of b.links) {
    const ends = lineEnds(l);
    if (!ends) continue;
    const d = linePathD(l, ends);
    const colour = l.color && safeColor(l.color) === l.color ? l.color : null;
    colours.add(colour);
    const arrow = lineArrow(l), m = `url(#${markerId(colour)})`;
    const style = [colour ? `stroke:${colour}` : '', `stroke-width:${lineWidth(l)}`,
      DASH_ARRAY[lineDash(l)] ? `stroke-dasharray:${DASH_ARRAY[lineDash(l)]}` : ''].filter(Boolean).join(';');
    const sel = l.id === selectedLink;
    html += `<path class="hit" data-id="${esc(l.id)}" d="${d}"/>` +
      `<path class="link ${sel ? 'selected' : ''} ${lineDash(l)}" data-id="${esc(l.id)}" d="${d}" style="${style}"` +
      `${arrow === 'end' || arrow === 'both' ? ` marker-end="${m}"` : ''}${arrow === 'start' || arrow === 'both' ? ` marker-start="${m}"` : ''}/>`;
    if (sel) {
      for (const [w, p] of [['from', ends.a], ['to', ends.b]]) {
        handles += `<circle class="lh ${l[w] ? 'attached' : 'free'}" data-id="${esc(l.id)}" data-end="${w}" cx="${p.x}" cy="${p.y}" r="7"><title>${l[w] ? 'Drag to move this end off the card' : 'Drag onto a card to attach, or anywhere to move'}</title></circle>`;
      }
    }
  }
  const markers = [...colours].map((c) =>
    `<marker id="${markerId(c)}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" markerUnits="strokeWidth" orient="auto-start-reverse">` +
    `<path d="M0,0 L10,5 L0,10 z" style="fill:${c || 'var(--link)'}"/></marker>`).join('');
  linksG.innerHTML = `<defs>${markers}</defs>` + html;
  lineHandles.innerHTML = handles;
  drawGhost();
  updateLineBar();
}

// The dashed preview while drawing a new line.
let ghostTo = null;
function drawGhost() {
  $$('path.ghost', linksG).forEach((p) => p.remove());
  if (tool !== 'connect' || !connectFrom || !ghostTo) return;
  const tmp = { from: connectFrom.card || null, fromPt: connectFrom.pt, to: null, toPt: ghostTo, shape: lineDefaults().shape };
  const ends = lineEnds(tmp); if (!ends) return;
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('class', 'ghost');
  p.setAttribute('d', linePathD(tmp, ends));
  linksG.appendChild(p);
}

// ---------- Drawing new lines (the Line tool) ----------
// connectFrom is { card: id } or { pt: {x, y} } once the first end is placed.
function toggleConnect() {
  if (tool === 'connect') { cancelConnect(); return; }
  blurEditing();
  tool = 'connect'; connectFrom = null; selectedLink = null;
  viewport.classList.add('connecting');
  $('#connect-hint').hidden = false;
  $$('.tool[data-tool="line"]').forEach((x) => x.classList.add('active'));
  if (selected.size === 1) { const id = [...selected][0]; connectFrom = { card: id }; cardEl(id)?.classList.add('connect-from'); }
  updateLineBar();
}
function cancelConnect() {
  tool = null; connectFrom = null; ghostTo = null;
  viewport.classList.remove('connecting');
  $('#connect-hint').hidden = true;
  $$('.tool.active').forEach((x) => x.classList.remove('active'));
  $$('.connect-from').forEach((x) => x.classList.remove('connect-from'));
  drawGhost(); updateLineBar();
}

// What is under the pointer: a card to attach to, or a free spot on the board.
function endAt(clientX, clientY) {
  const hit = document.elementFromPoint(clientX, clientY);
  const el = hit && hit.closest && hit.closest('#cards .card');
  if (el) return { card: el.dataset.id };
  const p = toWorld(clientX, clientY);
  return { pt: { x: Math.max(0, Math.round(p.x)), y: Math.max(0, Math.round(p.y)) } };
}
const sameSpot = (a, b) => (a.card || b.card ? a.card === b.card : Math.hypot(a.pt.x - b.pt.x, a.pt.y - b.pt.y) < NEAR);

// Called by the board's pointerdown handler while the Line tool is on.
// Click, click — or press, drag and let go — to draw a line.
function connectDown(e) {
  const end = endAt(e.clientX, e.clientY);
  if (connectFrom) { connectFinish(end); return; }
  connectFrom = end;
  if (end.card) cardEl(end.card)?.classList.add('connect-from');
  ghostTo = toWorld(e.clientX, e.clientY); drawGhost();
  const sx = e.clientX, sy = e.clientY;
  const up = (ev) => {
    window.removeEventListener('pointerup', up);
    if (tool === 'connect' && connectFrom === end && Math.hypot(ev.clientX - sx, ev.clientY - sy) > NEAR) connectFinish(endAt(ev.clientX, ev.clientY));
  };
  window.addEventListener('pointerup', up);
}
function connectClick(id) { // kept for older callers: attach to a card
  if (!connectFrom) { connectFrom = { card: id }; cardEl(id)?.classList.add('connect-from'); return; }
  connectFinish({ card: id });
}
function connectFinish(end) {
  if (!connectFrom || sameSpot(connectFrom, end)) return;
  const b = B();
  const a = connectFrom;
  const dup = a.card && end.card && b.links.some((l) => (l.from === a.card && l.to === end.card) || (l.from === end.card && l.to === a.card));
  let id = null;
  if (!dup) {
    checkpoint();
    const l = { id: uid(), from: a.card || null, to: end.card || null, ...lineDefaults() };
    if (a.pt) l.fromPt = a.pt;
    if (end.pt) l.toPt = end.pt;
    b.links.push(l); id = l.id;
    scheduleSave();
  }
  cancelConnect();
  if (id) { selected.clear(); selectedLink = id; refreshSelection(); }
  drawLinks();
}
viewport.addEventListener('pointermove', (e) => {
  if (tool === 'connect' && connectFrom) { ghostTo = toWorld(e.clientX, e.clientY); drawGhost(); }
});

// ---------- Moving lines and their ends ----------
// Dragging a line moves its free ends (ends attached to cards stay put).
function startLineDrag(e, id) {
  const l = B().links.find((x) => x.id === id); if (!l) return;
  const free = ['from', 'to'].filter((w) => !l[w] && l[w + 'Pt']);
  if (!free.length) return;
  const start = toWorld(e.clientX, e.clientY);
  const orig = Object.fromEntries(free.map((w) => [w, { ...l[w + 'Pt'] }]));
  let moved = false;
  const move = (ev) => {
    const p = toWorld(ev.clientX, ev.clientY);
    let dx = p.x - start.x, dy = p.y - start.y;
    if (!moved && Math.hypot(dx, dy) * B().view.z < 3) return;
    if (!moved) { checkpoint(); moved = true; }
    // never past the top-left corner
    dx = Math.max(dx, -Math.min(...free.map((w) => orig[w].x)));
    dy = Math.max(dy, -Math.min(...free.map((w) => orig[w].y)));
    for (const w of free) l[w + 'Pt'] = { x: Math.round(orig[w].x + dx), y: Math.round(orig[w].y + dy) };
    drawLinks();
  };
  const up = () => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
    if (moved) scheduleSave();
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}

// Dragging an end handle: drop it on a card to attach, anywhere else to leave it free.
function startEndDrag(e, id, which) {
  const l = B().links.find((x) => x.id === id); if (!l) return;
  const sx = e.clientX, sy = e.clientY;
  let moved = false, target = null;
  lineHandles.classList.add('dragging');
  const mark = (cardId) => {
    if (target === cardId) return;
    if (target) cardEl(target)?.classList.remove('line-target');
    target = cardId;
    if (target) cardEl(target)?.classList.add('line-target');
  };
  const move = (ev) => {
    if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 3) return;
    if (!moved) { checkpoint(); moved = true; }
    const end = endAt(ev.clientX, ev.clientY);
    const other = l[otherEnd(which)];
    mark(end.card && end.card !== other ? end.card : null);
    const p = toWorld(ev.clientX, ev.clientY);
    l[which] = null; l[which + 'Pt'] = { x: Math.max(0, Math.round(p.x)), y: Math.max(0, Math.round(p.y)) };
    drawLinks();
  };
  const up = () => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
    lineHandles.classList.remove('dragging');
    if (moved) {
      if (target) { l[which] = target; delete l[which + 'Pt']; }
      mark(null);
      drawLinks(); scheduleSave();
    }
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}

// ---------- Changing a line's look ----------
function setLineProp(key, value) {
  const l = selectedLink && B().links.find((x) => x.id === selectedLink);
  if (l) { checkpoint(); l[key] = value; if (key === 'arrow' && value === 'none') l.arrow = 'none'; drawLinks(); scheduleSave(); }
  // whatever you pick also becomes the style for the next new line
  store.ui.line = Object.assign(lineDefaults(), { [key]: value });
  scheduleSave(); updateLineBar();
}
function reverseLine(l) {
  checkpoint();
  [l.from, l.to] = [l.to, l.from];
  const fp = l.fromPt, tp = l.toPt;
  delete l.fromPt; delete l.toPt;
  if (tp) l.fromPt = tp;
  if (fp) l.toPt = fp;
  drawLinks(); scheduleSave();
}
function detachLine(l) {
  checkpoint();
  for (const w of ['from', 'to']) {
    if (!l[w]) continue;
    const p = endCentre(l, w), o = endCentre(l, otherEnd(w));
    const pt = p && p.r && o ? edgePoint(p.r, o.x, o.y) : p;
    if (pt) { l[w + 'Pt'] = { x: Math.round(pt.x), y: Math.round(pt.y) }; l[w] = null; }
  }
  drawLinks(); scheduleSave();
}

// Right-click menu for a line.
function lineMenuItems(l) {
  const tick = (on, label) => (on ? '✓ ' : '    ') + label;
  return [
    { colors: (col) => { checkpoint(); l.color = col; drawLinks(); scheduleSave(); }, current: l.color || null },
    ...LINE_ARROWS.map(([v, label]) => ({ label: tick(lineArrow(l) === v, label), run: () => setLineProp('arrow', v) })),
    '-',
    ...LINE_DASHES.map(([v, label]) => ({ label: tick(lineDash(l) === v, label + ' line'), run: () => setLineProp('dash', v) })),
    '-',
    ...LINE_WIDTHS.map(([v, label]) => ({ label: tick(lineWidth(l) === v, label), run: () => setLineProp('width', v) })),
    { label: lineShape(l) === 'curve' ? 'Make straight' : 'Make curved', run: () => setLineProp('shape', lineShape(l) === 'curve' ? 'straight' : 'curve') },
    '-',
    { label: 'Reverse direction', run: () => reverseLine(l) },
    ...(lineCards(l).length ? [{ label: 'Detach from cards', run: () => detachLine(l) }] : []),
    '-',
    { label: 'Delete line', hint: 'Del', danger: true, run: deleteSelection }
  ];
}

// ---------- Line style bar (shown while drawing, or with a line selected) ----------
const LINE_ICONS = {
  none: '<svg viewBox="0 0 28 14"><path d="M3 7h22"/></svg>',
  end: '<svg viewBox="0 0 28 14"><path d="M3 7h19"/><path class="fill" d="M19 3l6 4-6 4z"/></svg>',
  start: '<svg viewBox="0 0 28 14"><path d="M6 7h19"/><path class="fill" d="M9 3l-6 4 6 4z"/></svg>',
  both: '<svg viewBox="0 0 28 14"><path d="M6 7h16"/><path class="fill" d="M19 3l6 4-6 4z"/><path class="fill" d="M9 3l-6 4 6 4z"/></svg>',
  solid: '<svg viewBox="0 0 28 14"><path d="M3 7h22"/></svg>',
  dashed: '<svg viewBox="0 0 28 14"><path d="M3 7h22" stroke-dasharray="6 4"/></svg>',
  dotted: '<svg viewBox="0 0 28 14"><path d="M3 7h22" stroke-dasharray="0.1 4.5" stroke-linecap="round" stroke-width="2.6"/></svg>',
  curve: '<svg viewBox="0 0 28 14"><path d="M3 11Q14 0 25 11"/></svg>',
  straight: '<svg viewBox="0 0 28 14"><path d="M3 11L25 3"/></svg>'
};
const lineBar = (() => {
  const bar = document.createElement('div');
  bar.id = 'line-bar'; bar.hidden = true;
  const group = (key, opts) => `<div class="lb-group" role="group">${opts.map(([v, label]) =>
    `<button class="lb-btn" data-lb="${key}" data-v="${v}" title="${esc(label)}" aria-label="${esc(label)}">${LINE_ICONS[v] || `<i style="height:${v}px"></i>`}</button>`).join('')}</div>`;
  bar.innerHTML = group('arrow', LINE_ARROWS) + group('dash', LINE_DASHES) + group('width', LINE_WIDTHS) + group('shape', LINE_SHAPES) +
    '<button class="lb-btn lb-text" data-lb="delete" title="Delete line (Del)">Delete</button>';
  viewport.appendChild(bar);
  bar.addEventListener('pointerdown', (e) => e.stopPropagation());
  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-lb]'); if (!btn) return;
    if (btn.dataset.lb === 'delete') { deleteSelection(); return; }
    const v = btn.dataset.lb === 'width' ? +btn.dataset.v : btn.dataset.v;
    setLineProp(btn.dataset.lb, v);
  });
  return bar;
})();
function updateLineBar() {
  const l = selectedLink && store && B().links.find((x) => x.id === selectedLink);
  const show = !!l || tool === 'connect';
  lineBar.hidden = !show;
  if (!show) return;
  const cur = l ? { arrow: lineArrow(l), dash: lineDash(l), width: lineWidth(l), shape: lineShape(l) } : lineDefaults();
  $$('[data-lb]', lineBar).forEach((b) => b.classList.toggle('on', b.dataset.lb !== 'delete' && String(cur[b.dataset.lb]) === b.dataset.v));
  $('[data-lb="delete"]', lineBar).hidden = !l;
  lineBar.classList.toggle('drawing', tool === 'connect');
}
