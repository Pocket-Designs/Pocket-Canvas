/* Pocket-Canvas — interface colours (Settings › Appearance)
 * Copyright (c) 2026 project-tech-me <project-tech-me@protonmail.com>
 *
 * Kept per device in store.ui.appearance = { accent, tint } (store.ui doesn't sync).
 *  - accent: buttons, highlights, the selected board, progress bars… (any #rrggbb)
 *  - tint:   the colour of the sidebar, top bar, board background and panels (a preset id or #rrggbb)
 * Light and dark mode each get their own shades, worked out from the chosen colour.
 */
'use strict';

const DEFAULT_ACCENT = '#e0673a';
const ACCENT_PRESETS = [
  ['#e0673a', 'Orange (standard)'], ['#d0453b', 'Red'], ['#db4f74', 'Raspberry'], ['#c4579f', 'Pink'], ['#8a55cf', 'Purple'],
  ['#5a5bd1', 'Indigo'], ['#3a7be0', 'Blue'], ['#2f9bb5', 'Sky'], ['#2a9d8f', 'Teal'], ['#4f9d4f', 'Green'],
  ['#c99a1e', 'Gold'], ['#8a6d55', 'Coffee'], ['#5f6b7a', 'Slate'], ['#2b2823', 'Charcoal']
];
// Interface tints: hue (0–360) and strength (0 = grey, 1 = like the standard warm sand)
const TINT_PRESETS = [
  ['sand', 'Warm sand (standard)', 37, 1], ['stone', 'Stone grey', 30, 0.15], ['slate', 'Cool slate', 215, 0.7],
  ['sky', 'Sky blue', 205, 1.2], ['sage', 'Sage green', 110, 0.8], ['mint', 'Mint', 160, 1],
  ['lavender', 'Lavender', 260, 1], ['rose', 'Rose', 345, 1], ['peach', 'Peach', 20, 1.3], ['lemon', 'Lemon', 52, 1.4]
];

const clamp01 = (x) => Math.max(0, Math.min(1, x));
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
function hsl(h, s, l) {
  s = clamp01(s); l = clamp01(l);
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}
const validHex = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
// How bright a colour looks (0 = black, 1 = white).
function luminance(hex) {
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = hexToRgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function appearance() {
  const a = (store && store.ui && store.ui.appearance) || {};
  return {
    accent: validHex(a.accent) ? a.accent.toLowerCase() : DEFAULT_ACCENT,
    tint: validHex(a.tint) || TINT_PRESETS.some(([id]) => id === a.tint) ? a.tint : 'sand'
  };
}

// The shades for one tint in one mode, as CSS variables.
function tintVars(tint, dark) {
  let h, k;
  const preset = TINT_PRESETS.find(([id]) => id === tint);
  if (preset) { h = preset[2]; k = preset[3]; }
  else { const [hh, s] = rgbToHsl(hexToRgb(tint)); h = hh; k = Math.min(1.6, s * 1.6); }
  if (!dark) {
    return {
      '--bg': hsl(h, 0.30 * k, 0.94), '--dot': hsl(h, 0.18 * k, 0.82), '--panel': hsl(h, 0.36 * k, 0.975),
      '--panel-2': hsl(h, 0.24 * k, 0.92), '--line': hsl(h, 0.20 * k, 0.86), '--col-bg': hsl(h, 0.21 * k, 0.90),
      '--muted': hsl(h, 0.08 * k, 0.48), '--link': hsl(h, 0.08 * k, 0.57), '--text': hsl(h, 0.10 * k, 0.15)
    };
  }
  const d = 0.13 * k; // dark shades carry less colour, but enough to tell the tints apart
  return {
    '--bg': hsl(h, d, 0.11), '--dot': hsl(h, d, 0.21), '--panel': hsl(h, d, 0.14),
    '--panel-2': hsl(h, d, 0.17), '--line': hsl(h, d, 0.215), '--card': hsl(h, d, 0.165),
    '--col-bg': hsl(h, d, 0.135), '--input': hsl(h, d, 0.115),
    '--muted': hsl(h, 0.6 * d, 0.58), '--link': hsl(h, 0.6 * d, 0.41), '--text': hsl(h, 0.20 * k, 0.90)
  };
}
function accentVars(accent, dark) {
  let a = accent;
  if (dark) { const [h, s, l] = rgbToHsl(hexToRgb(accent)); a = hsl(h, s, Math.min(0.75, Math.max(l + 0.07, 0.45))); } // a little brighter on dark
  const [r, g, b] = hexToRgb(a);
  return {
    '--accent': a,
    '--accent-soft': `rgba(${r}, ${g}, ${b}, ${dark ? 0.2 : 0.14})`,
    '--on-accent': luminance(a) > 0.45 ? '#2b2823' : '#ffffff' // readable text on accent buttons
  };
}

const APPEARANCE_VARS = ['--bg', '--dot', '--panel', '--panel-2', '--line', '--col-bg', '--muted', '--link', '--text', '--card', '--input', '--accent', '--accent-soft', '--on-accent'];
// Put the chosen colours on the page (called by applyTheme in app.js whenever the theme changes).
function applyAppearance() {
  if (!store) return;
  const root = document.documentElement;
  APPEARANCE_VARS.forEach((v) => root.style.removeProperty(v));
  const a = appearance();
  const dark = root.dataset.theme === 'dark';
  const vars = { ...(a.tint !== 'sand' ? tintVars(a.tint, dark) : {}), ...(a.accent !== DEFAULT_ACCENT ? accentVars(a.accent, dark) : {}) };
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
}
function setAppearance(patch) {
  store.ui.appearance = { ...appearance(), ...patch };
  if (store.ui.appearance.accent === DEFAULT_ACCENT && store.ui.appearance.tint === 'sand') delete store.ui.appearance;
  applyAppearance();
  scheduleSave();
}

// ---------- Settings › Appearance ----------
function appearancePane() {
  const a = appearance();
  const mode = store.ui.theme || 'system';
  // a stronger sample than the real shades, so the choices are easy to tell apart
  const tintHex = (id) => { const p = TINT_PRESETS.find(([x]) => x === id); if (p) return hsl(p[2], Math.min(0.85, 0.45 * p[3]), 0.80); const [h, sat] = rgbToHsl(hexToRgb(id)); return hsl(h, Math.min(0.85, sat), 0.80); };
  const customAccent = !ACCENT_PRESETS.some(([c]) => c === a.accent);
  const customTint = validHex(a.tint);
  return `
    <fieldset class="ap-group"><legend>Light or dark</legend>
      <div class="ap-modes">
        ${[['light', 'Light'], ['dark', 'Dark'], ['system', 'Match this ' + (api.mobile ? 'device' : 'computer')]].map(([v, l]) =>
          `<label class="radio"><input type="radio" name="ap-mode" value="${v}" ${mode === v ? 'checked' : ''}> <span>${l}</span></label>`).join('')}
      </div>
    </fieldset>
    <fieldset class="ap-group"><legend>Accent colour <small>buttons, highlights and the board you’re on</small></legend>
      <div class="ap-swatches">
        ${ACCENT_PRESETS.map(([c, name]) => `<button class="ap-sw ${a.accent === c ? 'on' : ''}" data-accent="${c}" style="--sw:${c}" title="${esc(name)}" aria-label="${esc(name)}"></button>`).join('')}
        <label class="ap-sw ap-custom ${customAccent ? 'on' : ''}" title="Pick any colour" style="--sw:${customAccent ? a.accent : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)'}"><input type="color" data-accent-pick value="${a.accent}"></label>
      </div>
      <p class="ap-now"><span class="ap-chip" style="background:${a.accent}"></span> <b>${esc(customAccent ? colourName(a.accent) : ACCENT_PRESETS.find(([c]) => c === a.accent)[1])}</b> <code>${a.accent}</code></p>
    </fieldset>
    <fieldset class="ap-group"><legend>Interface colour <small>sidebar, top bar, board background and panels</small></legend>
      <div class="ap-tints">
        ${TINT_PRESETS.map(([id, name]) => `<button class="ap-tint ${a.tint === id ? 'on' : ''}" data-tint="${id}" title="${esc(name)}"><span style="background:${tintHex(id)}"></span>${esc(name.replace(' (standard)', ''))}</button>`).join('')}
        <label class="ap-tint ${customTint ? 'on' : ''}" title="Pick any colour"><span style="background:${customTint ? tintHex(a.tint) : 'conic-gradient(#f4c7c3, #fbe8b2, #cdeccd, #c8e3f5, #e1d4f5, #f4c7c3)'}"></span>Your own…<input type="color" data-tint-pick value="${customTint ? a.tint : '#7aa6d8'}"></label>
      </div>
    </fieldset>
    <div class="ap-actions"><button class="ghost-btn" data-ap-reset ${a.accent === DEFAULT_ACCENT && a.tint === 'sand' ? 'disabled' : ''}>Back to the standard colours</button></div>
    <p class="muted small">These colours are kept on this ${api.mobile ? 'device' : 'computer'} only. Card colours and board colours don’t change.</p>`;
}
function bindAppearance(body) {
  const rerender = () => { const y = body.querySelector('.set-pane') && body.querySelector('.set-pane').scrollTop; renderSettings().then(() => { const p = body.querySelector('.set-pane'); if (p && y) p.scrollTop = y; }); };
  body.querySelectorAll('input[name="ap-mode"]').forEach((r) => r.addEventListener('change', () => {
    store.ui.theme = r.value === 'system' ? null : r.value;
    applyTheme(); scheduleSave();
  }));
  body.querySelectorAll('[data-accent]').forEach((b) => b.addEventListener('click', () => { setAppearance({ accent: b.dataset.accent }); rerender(); }));
  body.querySelectorAll('[data-tint]').forEach((b) => b.addEventListener('click', () => { setAppearance({ tint: b.dataset.tint }); rerender(); }));
  const ap = body.querySelector('[data-accent-pick]');
  if (ap) { ap.addEventListener('input', () => setAppearance({ accent: ap.value.toLowerCase() })); ap.addEventListener('change', rerender); }
  const tp = body.querySelector('[data-tint-pick]');
  if (tp) { tp.addEventListener('input', () => setAppearance({ tint: tp.value.toLowerCase() })); tp.addEventListener('change', rerender); }
  const reset = body.querySelector('[data-ap-reset]');
  if (reset) reset.addEventListener('click', () => { setAppearance({ accent: DEFAULT_ACCENT, tint: 'sand' }); rerender(); });
}
