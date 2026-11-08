/* Pocket-Canvas — dialogs
 * Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
 */
'use strict';

// Open a dialog. `body` is an HTML string or a Node. Returns { el, close }.
function openModal({ title, body, wide = false, className = '', actions = [], onClose } = {}) {
  const root = $('#modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'modal';
  wrap.innerHTML = `<div class="modal-box ${wide ? 'wide' : ''} ${className}" role="dialog" aria-modal="true">
      <div class="modal-head"><h2>${esc(title || '')}</h2><button class="icon-btn modal-x" title="Close">✕</button></div>
      <div class="modal-body"></div>
      ${actions.length ? '<div class="modal-actions"></div>' : ''}
    </div>`;
  const bodyEl = $('.modal-body', wrap);
  if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
  let closed = false;
  const close = (result) => {
    if (closed) return;
    closed = true;
    wrap.remove();
    document.removeEventListener('keydown', onKey, true);
    if (onClose) onClose(result);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(null); }
  };
  document.addEventListener('keydown', onKey, true);
  $('.modal-x', wrap).onclick = () => close(null);
  wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) close(null); });
  const bar = $('.modal-actions', wrap);
  for (const a of actions) {
    const btn = document.createElement('button');
    btn.className = a.primary ? 'primary-btn' : a.danger ? 'ghost-btn danger' : 'ghost-btn';
    btn.textContent = a.label;
    btn.onclick = () => a.run ? a.run(close) : close(null);
    bar.appendChild(btn);
  }
  root.appendChild(wrap);
  hideMenu();
  return { el: wrap, body: bodyEl, close };
}

// Ask for one or more text values. Resolves to an object of values, or null if cancelled.
function askText({ title, fields, ok = 'Save', intro = '', validate = null }) {
  return new Promise((resolve) => {
    const body = document.createElement('form');
    body.className = 'form';
    body.innerHTML = (intro ? `<div class="form-intro">${intro}</div>` : '') + fields.map((f, i) => `<label class="field"><span>${esc(f.label)}</span>
      ${f.multiline
        ? `<textarea name="${esc(f.name)}" rows="3" placeholder="${esc(f.placeholder || '')}">${esc(f.value || '')}</textarea>`
        : `<input name="${esc(f.name)}" type="${f.type === 'password' ? 'password' : 'text'}" value="${esc(f.value || '')}" placeholder="${esc(f.placeholder || '')}" ${f.type === 'password' ? 'autocomplete="new-password" spellcheck="false"' : ''} ${i === 0 ? 'autofocus' : ''}>`}
      </label>`).join('') + '<div class="form-error" hidden></div>';
    let result = null;
    const m = openModal({
      title, body,
      actions: [
        { label: 'Cancel' },
        { label: ok, primary: true, run: (close) => submit(close) }
      ],
      onClose: () => resolve(result)
    });
    let busy = false;
    async function submit(close) {
      if (busy) return;
      const out = {};
      for (const f of fields) out[f.name] = f.type === 'password' ? body.elements[f.name].value : body.elements[f.name].value.trim();
      if (fields[0].required !== false && !out[fields[0].name]) { body.elements[fields[0].name].focus(); return; }
      if (validate) {
        const err = body.querySelector('.form-error');
        busy = true; err.hidden = true;
        let problem;
        try { problem = await validate(out); } finally { busy = false; }
        if (problem) { err.textContent = problem; err.hidden = false; const pw = body.querySelector('input[type=password]'); if (pw) { pw.select(); pw.focus(); } return; }
      }
      result = out;
      close(out);
    }
    body.addEventListener('submit', (e) => { e.preventDefault(); submit(m.close); });
    body.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); submit(m.close); }
    });
    requestAnimationFrame(() => { const first = body.querySelector('input,textarea'); if (first) { first.focus(); first.select && first.select(); } });
  });
}

// Relative time like "5 min ago".
function timeAgo(t) {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`;
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
