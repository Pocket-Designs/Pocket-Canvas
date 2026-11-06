/* Pocket-Canvas — page guides: dashed outlines of A4 / Letter pages drawn on the board
 * Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
 *
 * Pages are laid out from the board's top-left corner, left to right and top to bottom,
 * exactly as "PDF for printing › Follow the page guides" prints them. Cards that cross
 * a page edge are outlined, so you can move them before printing.
 *
 * Settings live on each board (and sync with it): b.pages = { show, paper, landscape, scale }.
 */
'use strict';

const GUIDE_SCALES = [1, 0.75, 0.5];
const GUIDE_SCALE_NAMES = { 1: 'Actual size (100%)', 0.75: 'Smaller (75%)', 0.5: 'Smallest (50%)' };

function pageSetup(b = B()) {
  const p = (b && b.pages) || {};
  return {
    show: !!p.show,
    paper: p.paper === 'Letter' ? 'Letter' : 'A4',
    landscape: !!p.landscape,
    scale: GUIDE_SCALES.includes(p.scale) ? p.scale : 1
  };
}

// One page's printable area: `print` in CSS pixels on paper, `w`/`h` in board units.
function guidePageSize(setup) {
  const size = PAPER[setup.paper] || PAPER.A4;
  const pw = (setup.landscape ? size.h : size.w) - PAGE_MARGIN * 2;
  const ph = (setup.landscape ? size.w : size.h) - PAGE_MARGIN * 2;
  return { print: { w: pw, h: ph }, w: pw / setup.scale, h: ph / setup.scale };
}

// Everything that would be printed: card rectangles plus lines, in board units.
function boardShapes(b = B()) {
  const rects = [];
  for (const el of $$(':scope > .card', cardsEl)) {
    const c = b.cards[el.dataset.id];
    if (!c) continue;
    rects.push({ id: c.id, x: c.x, y: c.y, w: el.offsetWidth, h: el.offsetHeight, card: true });
  }
  for (const p of $$('#links-g path.link')) {
    try { const bb = p.getBBox(); if (bb.width || bb.height) rects.push({ x: bb.x, y: bb.y, w: bb.width, h: bb.height }); } catch {}
  }
  return rects;
}

// The grid of pages covering everything on the board. Pages with nothing on them are
// "blank" and left out when printing; the others are numbered in printing order.
function planGuidePages(setup, shapes) {
  const size = guidePageSize(setup);
  let maxX = 0, maxY = 0;
  for (const r of shapes) { maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.h); }
  const cols = Math.max(1, Math.ceil(maxX / size.w - 1e-6));
  const rows = Math.max(1, Math.ceil(maxY / size.h - 1e-6));
  const pages = [];
  let n = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * size.w, y = row * size.h;
      const used = shapes.some((r) => r.x < x + size.w && r.x + r.w > x && r.y < y + size.h && r.y + r.h > y);
      pages.push({ col, row, x, y, w: size.w, h: size.h, number: used ? ++n : 0 });
    }
  }
  // cards cut by a page edge (a hair of tolerance so cards placed exactly on a line count as inside)
  const crossing = shapes.filter((r) => r.card && (
    Math.floor((r.x + 0.5) / size.w) !== Math.floor((r.x + r.w - 0.5) / size.w) ||
    Math.floor((r.y + 0.5) / size.h) !== Math.floor((r.y + r.h - 0.5) / size.h)
  )).map((r) => r.id);
  return { size, cols, rows, pages, printed: n, crossing };
}

let guideFrame = 0;
// Redraw soon (many things call this: moving, resizing, typing, zooming).
function updatePageGuides() {
  if (guideFrame) return;
  guideFrame = requestAnimationFrame(() => { guideFrame = 0; drawPageGuides(); });
}

function drawPageGuides() {
  if (!store || EXPORT_MODE) return;
  let layer = $('#page-guides');
  const setup = pageSetup();
  const chip = $('#pages-chip');
  $$('.card.crosses-page', cardsEl).forEach((el) => el.classList.remove('crosses-page'));
  $('#pages-btn') && $('#pages-btn').classList.toggle('on', setup.show);
  if (!setup.show) {
    if (layer) layer.remove();
    if (chip) chip.hidden = true;
    return;
  }
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'page-guides';
    world.insertBefore(layer, world.firstChild);
  }
  const plan = planGuidePages(setup, boardShapes());
  layer.innerHTML = plan.pages.map((p) =>
    `<div class="pg-page${p.number ? '' : ' blank'}" style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px">` +
    `<span class="pg-label">${p.number ? `Page ${p.number}` : 'Blank – not printed'}</span></div>`).join('');
  for (const id of plan.crossing) {
    const el = cardsEl.querySelector(`:scope > .card[data-id="${id}"]`);
    if (el) el.classList.add('crosses-page');
  }
  if (chip) {
    const crossing = plan.crossing.length;
    chip.hidden = false;
    chip.innerHTML = `<b>${setup.paper} ${setup.landscape ? 'landscape' : 'portrait'}</b>` +
      `${setup.scale !== 1 ? ` · ${Math.round(setup.scale * 100)}%` : ''} · ${plan.printed} page${plan.printed === 1 ? '' : 's'}` +
      (crossing ? ` · <span class="warn">${crossing} card${crossing === 1 ? '' : 's'} cross${crossing === 1 ? 'es' : ''} a page edge</span>` : '');
  }
}

function setPageSetup(patch) {
  const b = B();
  b.pages = { ...pageSetup(b), ...patch };
  drawPageGuides();
  scheduleSave();
}
function togglePageGuides() {
  const on = !pageSetup().show;
  setPageSetup({ show: on });
  toast(on ? 'Page guides on' : 'Page guides off');
}

// The menu behind the page button (also used by the ⋮ menu and right-click).
function pageGuideMenuItems() {
  const s = pageSetup();
  const tick = (on, label) => ({ label, checked: on });
  return [
    { ...tick(s.show, 'Show page guides'), hint: 'Ctrl+Shift+G', run: togglePageGuides },
    '-',
    { ...tick(s.paper === 'A4', 'A4'), run: () => setPageSetup({ paper: 'A4', show: true }) },
    { ...tick(s.paper === 'Letter', 'Letter'), run: () => setPageSetup({ paper: 'Letter', show: true }) },
    '-',
    { ...tick(!s.landscape, 'Portrait (upright)'), run: () => setPageSetup({ landscape: false, show: true }) },
    { ...tick(s.landscape, 'Landscape (sideways)'), run: () => setPageSetup({ landscape: true, show: true }) },
    '-',
    ...GUIDE_SCALES.map((k) => ({ ...tick(s.scale === k, GUIDE_SCALE_NAMES[k]), run: () => setPageSetup({ scale: k, show: true }) })),
    '-',
    { label: 'Print these pages as a PDF…', run: () => openExport({ guides: true }) }
  ];
}
function openPageGuideMenu(anchor) {
  const r = anchor ? anchor.getBoundingClientRect() : { left: innerWidth / 2, top: 80, bottom: 80 };
  const items = pageGuideMenuItems();
  // the status chip sits at the bottom of the board, so open upwards from it
  if (anchor && anchor.id === 'pages-chip') { showMenu(r.left, r.top - 420, items); return; }
  showMenu(r.left, r.bottom + 4, items);
}

// ---------- Printing exactly the pages the guides show ----------
// The pages that have something on them, in printing order.
function guidePrintPages(setup) {
  const plan = planGuidePages(setup, boardShapes());
  return { plan, pages: plan.pages.filter((p) => p.number) };
}

// Export window (desktop): build one element per page, each showing its part of the board,
// with a page break after it. The printer then gives one sheet per element.
async function layoutGuidedPages(setup) {
  const { plan, pages } = guidePrintPages(setup);
  const { print } = plan.size;
  const pageH = Math.floor(print.h); // a hair short of the page so nothing spills onto an extra sheet
  const holder = document.createElement('div');
  holder.id = 'print-pages';
  const bg = getComputedStyle(document.body).backgroundColor;
  for (const p of pages) {
    const sheet = document.createElement('div');
    sheet.className = 'print-page';
    sheet.style.cssText = `width:${print.w}px;height:${pageH}px;background:${bg}`;
    const copy = world.cloneNode(true);
    copy.removeAttribute('id');
    copy.style.transform = `translate(${-p.x * setup.scale}px, ${-p.y * setup.scale}px) scale(${setup.scale})`;
    sheet.appendChild(copy);
    holder.appendChild(sheet);
  }
  document.body.appendChild(holder);
  document.documentElement.classList.add('export-guided');
  await Promise.all($$('#print-pages img').map((img) => (img.complete ? null : new Promise((r) => { img.addEventListener('load', r); img.addEventListener('error', r); setTimeout(r, 8000); }))));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return { paged: true, guided: true, paper: setup.paper, landscape: setup.landscape, pages: pages.length, margin: PAGE_MARGIN / 96, width: Math.ceil(print.w), height: Math.ceil(pageH * pages.length) };
}

// In the page (Android, iPhone, iPad): one picture per page.
async function guidedPdfInPage(setup, background) {
  const { plan, pages } = guidePrintPages(setup);
  const { print } = plan.size;
  const size = PAPER[setup.paper] || PAPER.A4;
  const pw = (setup.landscape ? size.h : size.w) * 0.75, ph = (setup.landscape ? size.w : size.h) * 0.75, m = PAGE_MARGIN * 0.75;
  const W = Math.round(print.w), H = Math.round(print.h);
  const out = [];
  for (const p of pages) {
    B().view = { x: -p.x * setup.scale, y: -p.y * setup.scale, z: setup.scale };
    applyView(); drawLinks();
    await new Promise((r) => requestAnimationFrame(r));
    const c = imageToCanvas(await worldToImage(W, H, background), 0, 0, W, H, 2, background);
    out.push({ jpeg: await canvasJpeg(c), imgW: c.width, imgH: c.height, pageW: pw, pageH: ph, drawX: m, drawY: m, drawW: pw - m * 2, drawH: ph - m * 2 });
  }
  return { bytes: makePdf(out), pages: out.length };
}
