/* Pocket-Canvas — text formatting (font, size, bold, italic, underline, strikethrough, colour)
 * Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
 *
 * A small bar appears above the card while you type.
 *  - In notes it changes the selected text (or the whole note when nothing is selected).
 *  - In other cards (headings, to-do lists, tables, columns…) it changes the whole card's text,
 *    stored as card.textStyle = { font, size, bold, italic, underline, strike, color }.
 */
'use strict';

const TEXT_FONTS = [
  ['', 'Default'],
  ["Inter, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif", 'Sans serif'],
  ["Georgia, 'Times New Roman', Times, serif", 'Serif'],
  ["ui-monospace, Consolas, 'Courier New', monospace", 'Monospace'],
  ["'Segoe Print', 'Bradley Hand', 'Comic Sans MS', 'Comic Neue', cursive", 'Handwriting'],
  ["'Trebuchet MS', Verdana, 'DejaVu Sans', sans-serif", 'Rounded'],
  ["Impact, 'Arial Black', 'Franklin Gothic Bold', sans-serif", 'Poster']
];
const TEXT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64];
const TEXT_COLOURS = ['#2b2823', '#57534e', '#8a7f70', '#ffffff', '#d0453b', '#e0673a', '#e8a33d', '#d9bf2b',
  '#5bb276', '#38a3a5', '#3a7be0', '#5a5bd1', '#6a5fd6', '#9d4ec4', '#c4579f', '#db4f74'];

// ---------- Checking stored styles (from notes or from another computer) ----------
const STYLE_RULES = {
  'color': (v) => /^([a-z]{3,20}|#[0-9a-f]{3,8}|rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+\s*)?\))$/i.test(v),
  'font-family': (v) => /^[\w\s,'"-]{1,140}$/.test(v),
  'font-size': (v) => { const m = /^(\d{1,3}(?:\.\d+)?)px$/.exec(v); return !!m && +m[1] >= 6 && +m[1] <= 120; },
  'font-weight': (v) => /^(bold|bolder|normal|[1-9]00)$/.test(v),
  'font-style': (v) => /^(italic|normal)$/.test(v),
  'text-decoration': (v) => /^(none|underline|line-through|underline line-through|line-through underline)$/.test(v),
  'text-decoration-line': (v) => /^(none|underline|line-through|underline line-through|line-through underline)$/.test(v)
};
function cleanStyle(style) {
  const out = [];
  for (const prop of Object.keys(STYLE_RULES)) {
    const v = style.getPropertyValue(prop).trim();
    if (v && STYLE_RULES[prop](v)) out.push(`${prop}: ${v}`);
  }
  return out.join('; ');
}
function cleanTextStyle(ts) {
  if (!ts || typeof ts !== 'object') return null;
  const o = {};
  if (typeof ts.font === 'string' && ts.font && STYLE_RULES['font-family'](ts.font)) o.font = ts.font;
  if (+ts.size >= 6 && +ts.size <= 120) o.size = Math.round(+ts.size);
  for (const k of ['bold', 'italic', 'underline', 'strike']) if (ts[k]) o[k] = true;
  if (typeof ts.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(ts.color)) o.color = ts.color;
  return Object.keys(o).length ? o : null;
}

// Whole-card styles go on the card as CSS variables (see styles.css: .card.ts).
function applyCardTextStyle(el, c) {
  const ts = c.type === 'note' ? null : cleanTextStyle(c.textStyle);
  el.classList.toggle('ts', !!ts);
  const set = (k, v) => (v ? el.style.setProperty(k, v) : el.style.removeProperty(k));
  set('--ts-font', ts && ts.font);
  set('--ts-size', ts && ts.size ? ts.size + 'px' : '');
  set('--ts-weight', ts && ts.bold ? '700' : '');
  set('--ts-style', ts && ts.italic ? 'italic' : '');
  set('--ts-deco', ts && (ts.underline || ts.strike) ? [ts.underline && 'underline', ts.strike && 'line-through'].filter(Boolean).join(' ') : '');
  set('--ts-color', ts && ts.color);
  ['font', 'size', 'weight', 'style', 'deco', 'color'].forEach((k) => el.classList.toggle('ts-' + k, !!el.style.getPropertyValue('--ts-' + k)));
}

// ---------- The bar ----------
const fmtBar = (() => {
  const bar = document.createElement('div');
  bar.id = 'format-bar'; bar.hidden = true;
  bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Text formatting');
  bar.innerHTML = `
    <button class="fb-drop" data-fb="font" title="Font"><span class="fb-font-label">Font</span> ▾</button>
    <button class="fb-drop" data-fb="size" title="Text size"><span class="fb-size-label">Size</span> ▾</button>
    <span class="fb-sep"></span>
    <button class="fb-btn" data-fb="bold" title="Bold (Ctrl+B)"><b>B</b></button>
    <button class="fb-btn" data-fb="italic" title="Italic (Ctrl+I)"><i>I</i></button>
    <button class="fb-btn" data-fb="underline" title="Underline (Ctrl+U)"><u>U</u></button>
    <button class="fb-btn" data-fb="strike" title="Strikethrough (Ctrl+Shift+X)"><s>S</s></button>
    <span class="fb-sep"></span>
    <button class="fb-drop fb-colour" data-fb="colour" title="Text colour"><span class="fb-a">A</span><span class="fb-bar-col"></span></button>
    <button class="fb-btn" data-fb="clear" title="Clear formatting">⌫<span class="fb-small">Aa</span></button>
    <div class="fb-pop" hidden></div>`;
  document.body.appendChild(bar);
  return bar;
})();
const fbPop = $('.fb-pop', fmtBar);
let fmtEd = null; // the field being edited

function fmtCard() { const n = fmtEd && fmtEd.closest('.card'); return n ? B().cards[n.dataset.id] : null; }
const isRich = () => !!(fmtEd && fmtEd.dataset.rich);

function showFormatBar(ed) {
  fmtEd = ed;
  fmtBar.hidden = false;
  fbPop.hidden = true;
  placeFormatBar(); updateFormatBar();
}
function hideFormatBar() { fmtBar.hidden = true; fbPop.hidden = true; fmtEd = null; }
function placeFormatBar() {
  if (!fmtEd || fmtBar.hidden) return;
  const card = fmtEd.closest('.card') || fmtEd;
  const r = card.getBoundingClientRect(), vr = viewport.getBoundingClientRect();
  const bw = fmtBar.offsetWidth, bh = fmtBar.offsetHeight;
  let top = r.top - bh - 8;
  if (top < vr.top + 4) top = Math.min(r.bottom + 8, innerHeight - bh - 8);
  const left = Math.max(vr.left + 6, Math.min(r.left, innerWidth - bw - 8));
  fmtBar.style.top = Math.max(4, top) + 'px';
  fmtBar.style.left = left + 'px';
}

// What's currently on, for the button highlights and labels.
function currentFormat() {
  if (isRich()) {
    const sel = getSelection();
    const node = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
    const cs = node && fmtEd.contains(node) ? getComputedStyle(node) : getComputedStyle(fmtEd);
    const q = (cmd) => { try { return document.queryCommandState(cmd); } catch { return false; } };
    return { bold: q('bold'), italic: q('italic'), underline: q('underline'), strike: q('strikeThrough'),
      size: Math.round(parseFloat(cs.fontSize)), font: cs.fontFamily, color: cs.color };
  }
  const c = fmtCard(); const ts = (c && cleanTextStyle(c.textStyle)) || {};
  const cs = getComputedStyle(fmtEd);
  return { ...ts, size: ts.size || Math.round(parseFloat(cs.fontSize)), font: ts.font || cs.fontFamily, color: ts.color || cs.color };
}
function updateFormatBar() {
  if (!fmtEd) return;
  const f = currentFormat();
  for (const k of ['bold', 'italic', 'underline', 'strike']) $(`[data-fb="${k}"]`, fmtBar).classList.toggle('on', !!f[k]);
  const font = TEXT_FONTS.find(([v]) => v && f.font && f.font.replace(/"/g, "'").startsWith(v.split(',')[0]));
  $('.fb-font-label', fmtBar).textContent = font ? font[1] : 'Font';
  $('.fb-size-label', fmtBar).textContent = f.size || 'Size';
  $('.fb-bar-col', fmtBar).style.background = f.color || 'currentColor';
}

// ---------- Applying ----------
// In a note, with nothing selected, a change applies to the whole note.
function withRichSelection(fn) {
  const sel = getSelection();
  let whole = false;
  if (!sel.rangeCount || sel.isCollapsed || !fmtEd.contains(sel.anchorNode)) {
    const r = document.createRange(); r.selectNodeContents(fmtEd);
    sel.removeAllRanges(); sel.addRange(r); whole = true;
  }
  fn();
  if (whole) sel.collapseToEnd();
  fmtEd.dispatchEvent(new Event('input', { bubbles: true })); // saves the note
}
function exec(cmd, value = null, css = false) {
  document.execCommand('styleWithCSS', false, css);
  document.execCommand(cmd, false, value);
}
// execCommand can only set sizes 1–7, so mark with 7 and swap in the real size.
function richFontSize(px) {
  exec('fontSize', '7');
  const made = [];
  $$('font[size="7"]', fmtEd).forEach((f) => {
    const s = document.createElement('span');
    s.style.fontSize = px + 'px';
    s.append(...f.childNodes);
    // inner sizes would win over the new one, so take them off
    $$('span', s).forEach((x) => { x.style.removeProperty('font-size'); if (!x.getAttribute('style')) x.replaceWith(...x.childNodes); });
    f.replaceWith(s);
    made.push(s);
  });
  // keep the same words selected so further changes apply to them too
  if (made.length) {
    const r = document.createRange();
    r.setStartBefore(made[0]); r.setEndAfter(made[made.length - 1]);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  }
}
function richClear() {
  exec('removeFormat');
  $$('span[style]', fmtEd).forEach((s) => { if (getSelection().containsNode(s, true)) s.replaceWith(...s.childNodes); });
}

function applyFormat(kind, value) {
  if (!fmtEd) return;
  // in a table cell, bold / italic / underline / strikethrough / colour / clear go to the cell, row, column or table (table-style.js)
  if (typeof tableFormat === 'function' && tableFormat(kind, value)) { updateFormatBar(); placeFormatBar(); return; }
  if (isRich()) {
    withRichSelection(() => {
      if (kind === 'bold') exec('bold');
      else if (kind === 'italic') exec('italic');
      else if (kind === 'underline') exec('underline');
      else if (kind === 'strike') exec('strikeThrough');
      else if (kind === 'font') exec('fontName', value || 'inherit', true);
      else if (kind === 'size') richFontSize(value);
      else if (kind === 'colour') value ? exec('foreColor', value, true) : richClear();
      else if (kind === 'clear') richClear();
    });
  } else {
    const c = fmtCard(); if (!c) return;
    checkpoint();
    const ts = Object.assign({}, cleanTextStyle(c.textStyle));
    if (['bold', 'italic', 'underline', 'strike'].includes(kind)) ts[kind] = !ts[kind];
    else if (kind === 'font') ts.font = value;
    else if (kind === 'size') ts.size = value;
    else if (kind === 'colour') ts.color = value;
    if (kind === 'clear') c.textStyle = null; else c.textStyle = cleanTextStyle(ts);
    if (!c.textStyle) delete c.textStyle;
    applyCardTextStyle(fmtEd.closest('.card'), c);
    scheduleSave();
    requestAnimationFrame(drawLinks);
  }
  updateFormatBar(); placeFormatBar();
}

function openFormatPop(kind, btn) {
  if (!fbPop.hidden && fbPop.dataset.kind === kind) { fbPop.hidden = true; return; }
  const f = currentFormat();
  fbPop.dataset.kind = kind;
  if (kind === 'font') {
    fbPop.innerHTML = TEXT_FONTS.map(([v, label]) =>
      `<button class="fb-item" data-v="${esc(v)}" style="font-family:${esc(v || 'inherit')}">${esc(label)}</button>`).join('');
  } else if (kind === 'size') {
    fbPop.innerHTML = `<button class="fb-item" data-v="">Default</button>` + TEXT_SIZES.map((s) =>
      `<button class="fb-item ${s === f.size ? 'on' : ''}" data-v="${s}">${s}</button>`).join('');
  } else {
    fbPop.innerHTML = `<div class="fb-cols">${TEXT_COLOURS.map((col) =>
      `<button class="fb-col" data-v="${col}" style="--sw:${col}" title="${esc(colourName(col))}"></button>`).join('')}</div>
      ${isRich() ? '' : '<label class="fb-item fb-custom">Pick any colour… <input type="color" value="#3a7be0"></label>'}
      <button class="fb-item" data-v="">Default colour</button>`;
    const inp = fbPop.querySelector('input[type=color]');
    if (inp) inp.addEventListener('change', () => { fbPop.hidden = true; applyFormat('colour', inp.value); });
  }
  fbPop.className = 'fb-pop ' + kind;
  fbPop.hidden = false;
  fbPop.style.left = (btn.offsetLeft) + 'px';
}

// Buttons must not take the focus away from the text being edited.
fmtBar.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); });
fmtBar.addEventListener('mousedown', (e) => e.preventDefault());
fmtBar.addEventListener('click', (e) => {
  const item = e.target.closest('.fb-pop [data-v]');
  if (item) {
    const kind = fbPop.dataset.kind;
    const v = item.dataset.v;
    fbPop.hidden = true;
    if (kind === 'size') applyFormat('size', v ? +v : (isRich() ? Math.round(parseFloat(getComputedStyle(fmtEd).fontSize)) : null));
    else applyFormat(kind, v || null);
    return;
  }
  const btn = e.target.closest('[data-fb]'); if (!btn) return;
  const k = btn.dataset.fb;
  if (['font', 'size', 'colour'].includes(k)) openFormatPop(k, btn);
  else applyFormat(k);
});

// Show while editing a card's text; hide when editing stops.
cardsEl.addEventListener('focusin', (e) => {
  const ed = e.target.closest && e.target.closest('.editable');
  if (ed && ed.isContentEditable && !EXPORT_MODE) showFormatBar(ed);
});
cardsEl.addEventListener('focusout', (e) => {
  if (e.target === fmtEd) setTimeout(() => { if (fmtEd && document.activeElement !== fmtEd) hideFormatBar(); }, 0);
});
document.addEventListener('selectionchange', () => { if (fmtEd && !fmtBar.hidden) updateFormatBar(); });
cardsEl.addEventListener('input', () => { if (fmtEd) requestAnimationFrame(placeFormatBar); });
viewport.addEventListener('wheel', () => requestAnimationFrame(placeFormatBar), { passive: true });

// Keyboard shortcuts while editing: Ctrl+B / I / U work natively in notes;
// in other cards they change the whole card. Ctrl+Shift+X is strikethrough.
cardsEl.addEventListener('keydown', (e) => {
  if (!fmtEd || !(e.ctrlKey || e.metaKey)) return;
  const k = e.key.toLowerCase();
  if (e.shiftKey && k === 'x') { e.preventDefault(); applyFormat('strike'); return; }
  if (!isRich() && !e.shiftKey && ['b', 'i', 'u'].includes(k)) {
    e.preventDefault(); applyFormat({ b: 'bold', i: 'italic', u: 'underline' }[k]);
  }
  if (isRich() && ['b', 'i', 'u'].includes(k)) requestAnimationFrame(updateFormatBar);
});
