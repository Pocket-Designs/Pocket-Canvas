/* Pocket-Canvas — scroll bars along the bottom and right of the board
 * Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
 *
 * They appear when something on the board is out of view, and show where you are.
 * Drag the handle to move along; click the track either side of it to jump a screen.
 * The range runs from the board's top-left corner to the furthest card or line
 * (plus a margin), or to what's on screen if that's further.
 */
'use strict';

const SB_MARGIN = CARD_MARGIN;   // room left after the furthest card (the same as “Fit to content” leaves)
let sbExtent = { x: 0, y: 0 };   // furthest card/line edge, in board units
let sbFrame = 0;

function measureExtent() {
  const b = B();
  let x = 0, y = 0;
  for (const el of $$(':scope > .card', cardsEl)) {
    const c = b.cards[el.dataset.id];
    if (!c) continue;
    x = Math.max(x, c.x + el.offsetWidth);
    y = Math.max(y, c.y + el.offsetHeight);
  }
  try {
    const bb = $('#links-g').getBBox();
    if (bb.width || bb.height) { x = Math.max(x, bb.x + bb.width); y = Math.max(y, bb.y + bb.height); }
  } catch {}
  sbExtent = { x, y };
}

// Re-measure soon (cards moved, resized, added or removed).
function updateScrollbars() {
  if (sbFrame || EXPORT_MODE) return;
  sbFrame = requestAnimationFrame(() => { sbFrame = 0; measureExtent(); placeScrollbars(); });
}

// Work out one direction: how big the whole range is and where the screen sits in it.
function sbAxis(axis) {
  const v = B().view;
  const size = axis === 'x' ? viewport.clientWidth : viewport.clientHeight;
  const start = -(axis === 'x' ? v.x : v.y) / v.z;      // left/top edge of the screen, in board units
  const visible = size / v.z;
  const total = Math.max((sbExtent[axis] ? sbExtent[axis] + SB_MARGIN : 0), start + visible);
  return { size, start, visible, total };
}

function placeScrollbars() {
  if (!store || EXPORT_MODE) return;
  for (const axis of ['x', 'y']) {
    const bar = $(axis === 'x' ? '#hscroll' : '#vscroll');
    if (!bar) continue;
    const a = sbAxis(axis);
    const needed = a.total > a.visible + 2 || a.start > 2;
    bar.hidden = !needed;
    if (!needed) continue;
    const track = axis === 'x' ? bar.clientWidth : bar.clientHeight;
    const len = Math.max(28, track * (a.visible / a.total));
    const pos = (track - len) * (a.start / Math.max(a.total - a.visible, 1e-6));
    const thumb = bar.firstElementChild;
    if (axis === 'x') { thumb.style.width = len + 'px'; thumb.style.left = Math.max(0, Math.min(track - len, pos)) + 'px'; }
    else { thumb.style.height = len + 'px'; thumb.style.top = Math.max(0, Math.min(track - len, pos)) + 'px'; }
  }
}

// Scroll so the screen's left (or top) edge is at `start` board units.
function sbScrollTo(axis, start) {
  const v = B().view;
  const a = sbAxis(axis);
  const s = Math.max(0, Math.min(start, a.total - a.visible));
  if (axis === 'x') v.x = -s * v.z; else v.y = -s * v.z;
  applyView();
  scheduleSave();
}

function makeScrollbar(axis) {
  const bar = document.createElement('div');
  bar.id = axis === 'x' ? 'hscroll' : 'vscroll';
  bar.className = 'sb ' + (axis === 'x' ? 'sb-h' : 'sb-v');
  bar.hidden = true;
  bar.innerHTML = '<div class="sb-thumb"></div>';
  bar.title = axis === 'x' ? 'Scroll left and right' : 'Scroll up and down';
  const thumb = bar.firstElementChild;

  bar.addEventListener('pointerdown', (e) => {
    e.stopPropagation();  // don't start a selection box or pan on the board underneath
    e.preventDefault();
    hideMenu();
    const a = sbAxis(axis);
    const track = axis === 'x' ? bar.clientWidth : bar.clientHeight;
    const len = axis === 'x' ? thumb.offsetWidth : thumb.offsetHeight;
    const per = (a.total - a.visible) / Math.max(track - len, 1);   // board units per pixel of handle movement
    if (e.target !== thumb) {
      // click on the track: jump one screen towards the click
      const r = thumb.getBoundingClientRect();
      const before = axis === 'x' ? e.clientX < r.left : e.clientY < r.top;
      sbScrollTo(axis, a.start + (before ? -1 : 1) * a.visible * 0.9);
      return;
    }
    const from = axis === 'x' ? e.clientX : e.clientY, start = a.start;
    bar.classList.add('dragging');
    thumb.setPointerCapture(e.pointerId);
    const move = (ev) => sbScrollTo(axis, start + ((axis === 'x' ? ev.clientX : ev.clientY) - from) * per);
    const up = () => {
      bar.classList.remove('dragging');
      thumb.removeEventListener('pointermove', move);
      thumb.removeEventListener('pointerup', up);
      thumb.removeEventListener('pointercancel', up);
    };
    thumb.addEventListener('pointermove', move);
    thumb.addEventListener('pointerup', up);
    thumb.addEventListener('pointercancel', up);
  });
  bar.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
  bar.addEventListener('dblclick', (e) => e.stopPropagation());
  bar.addEventListener('contextmenu', (e) => { e.stopPropagation(); e.preventDefault(); });
  viewport.appendChild(bar);
}

if (!EXPORT_MODE) {
  makeScrollbar('x');
  makeScrollbar('y');
  new ResizeObserver(() => placeScrollbars()).observe(viewport);
  cardsEl.addEventListener('input', () => updateScrollbars());
  document.addEventListener('pointerup', () => { if (store) updateScrollbars(); });
}
