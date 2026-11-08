/* Pocket-Canvas — export a board as a picture (PNG) or PDF
 * Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
 */
'use strict';

function openExport(how = {}) {
  if (!B().order.length) { toast('This board is empty'); return; }
  const guides = typeof pageSetup === 'function' ? pageSetup() : { show: false };
  const useGuides = guides.show || how.guides;
  const guideName = `${guides.paper} ${guides.landscape ? 'landscape' : 'portrait'}${guides.scale !== 1 ? `, ${Math.round(guides.scale * 100)}% size` : ', actual size'}`;
  const body = document.createElement('form');
  body.className = 'form export-form';
  body.innerHTML = `
    <p class="muted">Exports everything on <b>${esc(B().title)}</b> exactly as it looks, at full size.</p>
    <fieldset><legend>Format</legend>
      <label class="radio"><input type="radio" name="format" value="png"${useGuides ? '' : ' checked'}> <span><b>Picture (PNG)</b><br><small>For sharing, chat apps and presentations</small></span></label>
      <label class="radio"><input type="radio" name="format" value="pdf"> <span><b>PDF, one big page</b><br><small>The whole board on a single page; text stays sharp at any zoom</small></span></label>
      <label class="radio"><input type="radio" name="format" value="pages"${useGuides ? ' checked' : ''}> <span><b>PDF for printing</b><br><small>A4 or Letter pages</small></span></label>
    </fieldset>
    <fieldset class="pages-only"><legend>Pages</legend>
      <label class="radio"><input type="radio" name="layout" value="guides"${useGuides ? ' checked' : ''}> <span><b>Follow the page guides</b><br><small>Exactly the pages shown on the board (${esc(guideName)}). Blank pages are left out.</small></span></label>
      <label class="radio"><input type="radio" name="layout" value="auto"${useGuides ? '' : ' checked'}> <span><b>Fit automatically</b><br><small>Scaled to the page width. Cards that would be cut by the edge of a page move to the next page.</small></span></label>
    </fieldset>
    <fieldset class="pages-only auto-only"><legend>Paper</legend>
      <label class="radio"><input type="radio" name="paper" value="A4" checked> <span>A4</span></label>
      <label class="radio"><input type="radio" name="paper" value="Letter"> <span>Letter</span></label>
    </fieldset>
    <fieldset class="pages-only auto-only"><legend>Page direction</legend>
      <label class="radio"><input type="radio" name="orientation" value="auto" checked> <span><b>Best fit</b><br><small>Picks whichever needs fewer pages, with bigger cards</small></span></label>
      <label class="radio"><input type="radio" name="orientation" value="portrait"> <span>Portrait (upright)</span></label>
      <label class="radio"><input type="radio" name="orientation" value="landscape"> <span>Landscape (sideways)</span></label>
    </fieldset>
    <fieldset class="png-only"><legend>Quality</legend>
      <label class="radio"><input type="radio" name="quality" value="standard"> <span>Standard</span></label>
      <label class="radio"><input type="radio" name="quality" value="high" checked> <span>High (sharper, bigger file)</span></label>
    </fieldset>
    <fieldset><legend>Background</legend>
      <label class="radio"><input type="radio" name="background" value="board" checked> <span>Board colour</span></label>
      <label class="radio"><input type="radio" name="background" value="white"> <span>White</span></label>
      <label class="radio png-only"><input type="radio" name="background" value="transparent"> <span>Transparent</span></label>
    </fieldset>`;
  const sync = () => {
    const pdf = body.elements.format.value !== 'png';
    body.querySelectorAll('.png-only').forEach((x) => { x.hidden = pdf; });
    body.querySelectorAll('.pages-only').forEach((x) => { x.hidden = body.elements.format.value !== 'pages'; });
    if (body.elements.format.value === 'pages' && body.elements.layout.value === 'guides') body.querySelectorAll('.auto-only').forEach((x) => { x.hidden = true; });
    if (pdf && body.elements.background.value === 'transparent') body.elements.background.value = 'white';
  };
  body.addEventListener('change', sync);
  sync();
  openModal({
    title: 'Export board',
    body,
    actions: [
      { label: 'Cancel' },
      {
        label: 'Export…', primary: true,
        run: async (close) => {
          const opts = {
            boardId: cur, title: B().title,
            format: body.elements.format.value,
            quality: body.elements.quality.value,
            background: body.elements.background.value,
            layout: body.elements.layout.value,
            paper: body.elements.layout.value === 'guides' ? guides.paper : body.elements.paper.value,
            orientation: body.elements.layout.value === 'guides' ? (guides.landscape ? 'landscape' : 'portrait') : body.elements.orientation.value,
            theme: document.documentElement.dataset.theme,
            data: JSON.stringify({ version: store.version, root: store.root, boards: store.boards, ui: {} })
          };
          close();
          await flushSave();
          toast('Exporting…');
          const r = await api.exportVisual(opts);
          if (r.canceled) return;
          if (r.error) { toast('Export failed: ' + r.error); return; }
          const what = opts.format === 'pages' ? `PDF (${r.pages} ${r.landscape ? 'landscape' : 'portrait'} page${r.pages === 1 ? '' : 's'})`
            : opts.format === 'pdf' ? `PDF (${r.width} × ${r.height})` : `picture (${r.width} × ${r.height})`;
          toast(`Exported ${what}`, r.filePath ? { label: 'Show file', run: () => api.showFile(r.filePath) } : undefined);
        }
      }
    ]
  });
}

// ---------- Export mode: this page is being drawn in an invisible window ----------
async function runExportMode() {
  const q = new URLSearchParams(location.search);
  const format = ['pdf', 'pages'].includes(q.get('format')) ? q.get('format') : 'png';
  const high = q.get('quality') === 'high';
  const background = q.get('background') || 'board';
  document.documentElement.classList.add('export-mode');
  if (background === 'white') document.documentElement.classList.add('export-white');
  if (background === 'transparent' && format === 'png') document.documentElement.classList.add('export-transparent');
  if (format === 'pages') document.documentElement.classList.add('export-paged');

  assetBase = await api.assetBase();
  let data = null;
  try { const d = await api.exportData(); if (d) data = JSON.parse(d); } catch {}
  if (!data) data = await api.load();
  if (!data || !data.boards) throw new Error('No boards found');
  store = migrate(data);
  cur = store.boards[EXPORT_MODE] ? EXPORT_MODE : store.root;
  store.ui.theme = q.get('theme') === 'dark' ? 'dark' : 'light';
  applyTheme();
  B().view = { x: 0, y: 0, z: 1 };
  renderBoard();

  // Wait for pictures, video frames and fonts.
  await Promise.all($$('img', cardsEl).map((img) => (img.complete ? null : new Promise((r) => { img.addEventListener('load', r); img.addEventListener('error', r); setTimeout(r, 8000); }))));
  await Promise.all($$('video', cardsEl).map((v) => (v.readyState >= 2 ? null : new Promise((r) => { v.addEventListener('loadeddata', r); v.addEventListener('error', r); setTimeout(r, 4000); }))));
  if (document.fonts) await document.fonts.ready;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  drawLinks();

  const tops = $$(':scope > .card', cardsEl);
  if (!tops.length) throw new Error('This board is empty');
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const el of tops) {
    const r = worldRect(el);
    x1 = Math.min(x1, r.x); y1 = Math.min(y1, r.y);
    x2 = Math.max(x2, r.x + r.w); y2 = Math.max(y2, r.y + r.h);
  }
  try {
    const bb = $('#links-g').getBBox();
    if (bb.width || bb.height) { x1 = Math.min(x1, bb.x); y1 = Math.min(y1, bb.y); x2 = Math.max(x2, bb.x + bb.width); y2 = Math.max(y2, bb.y + bb.height); }
  } catch {}
  if (format === 'pages' && q.get('layout') === 'guides') {
    await api.exportReady(await layoutGuidedPages(pageSetup()));
    return;
  }
  if (format === 'pages') {
    const page = await layoutPages(tops, { x1, y1, x2, y2 }, q.get('paper') === 'Letter' ? 'Letter' : 'A4', q.get('orientation') || 'auto');
    await api.exportReady(page);
    return;
  }
  const pad = 48;
  const w = x2 - x1, h = y2 - y1;
  let z = format === 'pdf' ? 1 : high ? 2 : 1;
  const limit = format === 'pdf' ? 19000 : 16000;   // PDF page and picture size limits
  z = Math.min(z, (limit - pad * 2) / Math.max(w, h, 1));
  B().view = { x: pad - x1 * z, y: pad - y1 * z, z };
  applyView();
  drawLinks();
  await new Promise((r) => requestAnimationFrame(r));
  await api.exportReady({ width: Math.ceil(w * z + pad * 2), height: Math.ceil(h * z + pad * 2) });
}

// ---------- Printing on pages (A4 / Letter) ----------
// Page sizes in CSS pixels (96 per inch); PAGE_MARGIN is the white border printed round each page.
const PAPER = { A4: { w: 8.27 * 96, h: 11.69 * 96 }, Letter: { w: 8.5 * 96, h: 11 * 96 } };
const PAGE_MARGIN = 0.4 * 96;

// Decide where every card goes so none is cut by the edge of a page.
// Cards are taken top to bottom; when one would cross the bottom of its page, it — and everything
// below it — moves down to start on the next page, like a page break in a document.
// Returns { scale, pages, moves: Map(card element → extra y in board units), breaks: [[fromY, extra]…] }.
function planPages(items, box, printable) {
  const width = Math.max(box.x2 - box.x1, 1);
  const scale = Math.min(1, printable.w / width);
  const pageH = printable.h / scale; // one page's height in board units
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  let extra = 0, bottom = 0;
  const moves = new Map(), breaks = [];
  for (const it of sorted) {
    const top = it.y - box.y1 + extra;
    const page = Math.floor(top / pageH + 1e-9);
    const pageEnd = (page + 1) * pageH;
    if (top + it.h > pageEnd + 0.5 && top > page * pageH + 0.5) {
      // too tall to fit even on a fresh page? still start it at the top of the next one
      const shift = pageEnd - top;
      extra += shift;
      breaks.push([it.y, extra]);
    }
    moves.set(it.el, extra);
    bottom = Math.max(bottom, it.y - box.y1 + extra + it.h);
  }
  return { scale, pageH, pages: Math.max(1, Math.ceil(bottom / pageH - 1e-9)), moves, breaks };
}

async function layoutPages(tops, box, paper, orientation) {
  const items = tops.map((el) => { const r = worldRect(el); return { el, x: r.x, y: r.y, w: r.w, h: r.h }; });
  const size = PAPER[paper] || PAPER.A4;
  const option = (landscape) => {
    const pw = (landscape ? size.h : size.w) - PAGE_MARGIN * 2, ph = (landscape ? size.w : size.h) - PAGE_MARGIN * 2;
    return { landscape, printable: { w: pw, h: ph }, plan: planPages(items, box, { w: pw, h: ph }) };
  };
  let pick;
  if (orientation === 'portrait') pick = option(false);
  else if (orientation === 'landscape') pick = option(true);
  else {
    // best fit: fewer pages first, then bigger cards
    const a = option(false), b = option(true);
    pick = b.plan.pages < a.plan.pages || (b.plan.pages === a.plan.pages && b.plan.scale > a.plan.scale + 0.01) ? b : a;
  }
  const { plan, printable, landscape } = pick;
  // move the cards (this window has its own copy of the boards, so nothing is saved)
  const b = B();
  for (const it of items) {
    const extra = plan.moves.get(it.el);
    const c = b.cards[it.el.dataset.id];
    if (c && extra) c.y += extra;
  }
  const extraAt = (y) => { let e = 0; for (const [from, x] of plan.breaks) if (y >= from) e = x; return e; };
  for (const l of b.links) for (const w of ['fromPt', 'toPt']) if (l[w]) l[w] = { x: l[w].x, y: l[w].y + extraAt(l[w].y) };
  renderBoard();
  await Promise.all($$('img', cardsEl).map((img) => (img.complete ? null : new Promise((r) => { img.addEventListener('load', r); img.addEventListener('error', r); setTimeout(r, 8000); }))));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  // one long strip, exactly `pages` printable areas tall; the printer cuts it into pages
  const total = plan.pages * printable.h;
  document.documentElement.style.setProperty('--page-w', printable.w + 'px');
  document.documentElement.style.setProperty('--page-strip', total + 'px');
  B().view = { x: -box.x1 * plan.scale, y: -box.y1 * plan.scale, z: plan.scale };
  applyView();
  drawLinks();
  await new Promise((r) => requestAnimationFrame(r));
  return { paged: true, paper, landscape, pages: plan.pages, margin: PAGE_MARGIN / 96, width: Math.ceil(printable.w), height: Math.ceil(total) };
}

// ======================================================================
// Exporting inside the page (the Android app has no off-screen window)
// ======================================================================
// The board is drawn into an SVG <foreignObject> with the app's own styles, turned into a
// picture on a <canvas>, and saved as PNG, or as JPEG pages inside a PDF made here.

let exportCss = null;
async function exportStyles() {
  if (exportCss == null) {
    try { exportCss = await (await fetch('styles.css')).text(); } catch { exportCss = ''; }
  }
  return exportCss;
}
const blobToDataUrl = (blob) => new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => resolve(null); r.readAsDataURL(blob); });

// Draw the current view of #world (already laid out at the wanted scale) as one picture.
async function worldToImage(width, height, background) {
  const css = await exportStyles();
  const clone = world.cloneNode(true);
  // pictures must be inside the SVG itself
  await Promise.all([...clone.querySelectorAll('img')].map(async (img) => {
    try { const r = await fetch(img.src); img.src = r.ok ? await blobToDataUrl(await r.blob()) : ''; } catch { img.removeAttribute('src'); }
  }));
  clone.querySelectorAll('iframe, video, audio, script, #line-handles, #page-guides').forEach((n) => n.remove());
  clone.querySelectorAll('.crosses-page').forEach((n) => n.classList.remove('crosses-page'));
  // the colours etc. come from CSS variables on <html>; copy their current values across
  const root = getComputedStyle(document.documentElement);
  const vars = [...new Set(css.match(/--[a-z0-9-]+(?=\s*:)/gi) || [])].map((v) => `${v}:${root.getPropertyValue(v)}`).join(';');
  const bg = background === 'transparent' ? 'transparent' : background === 'white' ? '#ffffff' : getComputedStyle(document.body).backgroundColor;
  const wrap = document.createElement('div');
  wrap.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  wrap.className = document.documentElement.className + ' export-mode';
  wrap.setAttribute('style', `${vars};position:relative;width:${width}px;height:${height}px;overflow:hidden;background:${bg};font-family:${getComputedStyle(document.body).fontFamily};color:${getComputedStyle(document.body).color}`);
  clone.style.transform = world.style.transform;
  wrap.appendChild(clone);
  const xhtml = new XMLSerializer().serializeToString(wrap);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject x="0" y="0" width="100%" height="100%"><style><![CDATA[${css.replace(/]]>/g, ']] >')}]]></style>${xhtml}</foreignObject></svg>`;
  const img = new Image();
  img.decoding = 'sync';
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error('The board couldn’t be drawn')); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
  return { img, bg };
}
// Copy part of that picture (x, y, w, h in page pixels) onto a canvas, `ratio` times sharper.
function imageToCanvas({ img, bg }, x, y, w, h, ratio, background) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio);
  const g = canvas.getContext('2d');
  if (background !== 'transparent') { g.fillStyle = bg; g.fillRect(0, 0, canvas.width, canvas.height); }
  g.drawImage(img, x, y, w, h, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// A small PDF writer: each page shows one JPEG picture filling the area inside the margins.
function makePdf(pages) {
  const enc = new TextEncoder();
  const parts = [], offsets = [];
  let size = 0;
  const add = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); size += b.length; };
  const obj = (n, body) => { offsets[n] = size; add(`${n} 0 obj\n`); body(); add('\nendobj\n'); };
  add('%PDF-1.4\n%âãÏÓ\n');
  const n = pages.length, kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  obj(1, () => add('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => add(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`));
  pages.forEach((p, i) => {
    const pg = 3 + i * 3, content = pg + 1, image = pg + 2;
    const f = (v) => v.toFixed(2);
    const draw = `q ${f(p.drawW)} 0 0 ${f(p.drawH)} ${f(p.drawX)} ${f(p.pageH - p.drawY - p.drawH)} cm /Im0 Do Q`;
    obj(pg, () => add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(p.pageW)} ${f(p.pageH)}] /Resources << /XObject << /Im0 ${image} 0 R >> >> /Contents ${content} 0 R >>`));
    obj(content, () => { add(`<< /Length ${draw.length} >>\nstream\n`); add(draw); add('\nendstream'); });
    obj(image, () => { add(`<< /Type /XObject /Subtype /Image /Width ${p.imgW} /Height ${p.imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`); add(p.jpeg); add('\nendstream'); });
  });
  const xref = size, count = 3 + n * 3;
  add(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let k = 1; k < count; k++) add(String(offsets[k]).padStart(10, '0') + ' 00000 n \n');
  add(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(size);
  let o = 0; for (const b of parts) { out.set(b, o); o += b.length; }
  return out;
}
const canvasJpeg = async (canvas) => new Uint8Array(await (await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.9))).arrayBuffer());

// opts as from openExport(). Returns { bytes, mime, ext, width, height, pages?, landscape? }.
async function exportInPage(opts) {
  const snap = JSON.stringify(store), view = { ...B().view }, wasCur = cur;
  const theme = document.documentElement.dataset.theme;
  try {
    if (opts.boardId && opts.boardId !== cur && store.boards[opts.boardId]) { cur = opts.boardId; }
    clearSelection();
    B().view = { x: 0, y: 0, z: 1 }; renderBoard();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    drawLinks();
    const tops = $$(':scope > .card', cardsEl);
    if (!tops.length) throw new Error('This board is empty');
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const el of tops) { const r = worldRect(el); x1 = Math.min(x1, r.x); y1 = Math.min(y1, r.y); x2 = Math.max(x2, r.x + r.w); y2 = Math.max(y2, r.y + r.h); }
    const box = { x1, y1, x2, y2 };
    if (opts.format === 'pages' && opts.layout === 'guides') {
      const setup = { ...pageSetup(), paper: opts.paper === 'Letter' ? 'Letter' : 'A4', landscape: opts.orientation === 'landscape' };
      const r = await guidedPdfInPage(setup, opts.background === 'board' ? 'board' : 'white');
      return { bytes: r.bytes, mime: 'application/pdf', ext: 'pdf', pages: r.pages, landscape: setup.landscape };
    }
    if (opts.format === 'pages') {
      const page = await layoutPages(tops, box, opts.paper === 'Letter' ? 'Letter' : 'A4', opts.orientation || 'auto');
      const bgMode = opts.background === 'board' ? 'board' : 'white';
      const picture = await worldToImage(page.width, page.height, bgMode);
      const size = PAPER[page.paper] || PAPER.A4;
      const pw = (page.landscape ? size.h : size.w) * 0.75, ph = (page.landscape ? size.w : size.h) * 0.75, m = PAGE_MARGIN * 0.75;
      const sliceH = page.height / page.pages, pdfPages = [];
      for (let k = 0; k < page.pages; k++) {
        const c = imageToCanvas(picture, 0, k * sliceH, page.width, sliceH, 2, bgMode); // 2× sharp enough to print
        pdfPages.push({ jpeg: await canvasJpeg(c), imgW: c.width, imgH: c.height, pageW: pw, pageH: ph, drawX: m, drawY: m, drawW: pw - m * 2, drawH: ph - m * 2 });
      }
      return { bytes: makePdf(pdfPages), mime: 'application/pdf', ext: 'pdf', pages: page.pages, landscape: page.landscape, width: page.width, height: page.height };
    }
    const pad = 48, w = x2 - x1, h = y2 - y1;
    const ratio = opts.format === 'png' && opts.quality === 'high' ? 2 : 1;
    const z = Math.min(1, 8000 / Math.max(w, h, 1)); // phones can't make huge pictures
    B().view = { x: pad - x1 * z, y: pad - y1 * z, z }; applyView(); drawLinks();
    await new Promise((r) => requestAnimationFrame(r));
    const W = Math.ceil(w * z + pad * 2), H = Math.ceil(h * z + pad * 2);
    const bgMode = opts.format === 'png' ? opts.background : (opts.background === 'transparent' ? 'white' : opts.background);
    const canvas = imageToCanvas(await worldToImage(W, H, bgMode), 0, 0, W, H, ratio, bgMode);
    if (opts.format === 'pdf') {
      const pw = W * 0.75, ph = H * 0.75;
      return { bytes: makePdf([{ jpeg: await canvasJpeg(canvas), imgW: canvas.width, imgH: canvas.height, pageW: pw, pageH: ph, drawX: 0, drawY: 0, drawW: pw, drawH: ph }]), mime: 'application/pdf', ext: 'pdf', width: W, height: H };
    }
    const png = new Uint8Array(await (await new Promise((r) => canvas.toBlob(r, 'image/png'))).arrayBuffer());
    return { bytes: png, mime: 'image/png', ext: 'png', width: canvas.width, height: canvas.height };
  } finally {
    // put everything back exactly as it was
    store = JSON.parse(snap);
    cur = wasCur;
    store.boards[cur].view = view;
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.remove('export-paged');
    renderBoard();
  }
}
