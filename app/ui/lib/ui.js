// Tiny DOM helpers shared by the Pocket-Connect pages.
(function (global) {
  'use strict';

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v; // only ever used with our own icon SVG strings
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (sk.startsWith('--')) el.style.setProperty(sk, sv);
          else el.style[sk] = sv;
        }
      }
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  const ico = (name) => h('i', { class: 'ico', html: PCIcons.UI[name] || '' });

  function hydrateIcons(root = document) {
    for (const el of root.querySelectorAll('[data-ico]')) {
      el.innerHTML = PCIcons.UI[el.dataset.ico] || '';
      el.classList.add('ico');
    }
  }

  function toast(text, kind) {
    const wrap = document.getElementById('toasts');
    if (!wrap) return;
    const t = h('div', { class: `toast ${kind || ''}` }, text);
    wrap.append(t);
    setTimeout(() => t.remove(), kind === 'bad' ? 5000 : 2600);
  }

  // modal({ title, body: Node|Node[], actions: [{label, primary, danger, onClick -> false keeps open}] })
  function modal({ title, body, actions = [], wide, onClose }) {
    const back = h('div', { class: 'modal-back' });
    const close = () => {
      back.remove();
      document.removeEventListener('keydown', esc);
      onClose?.();
    };
    const esc = (e) => e.key === 'Escape' && close();
    document.addEventListener('keydown', esc);
    const footer = h('footer');
    for (const a of actions) {
      const b = h('button', { class: `btn ${a.primary ? 'primary' : ''} ${a.danger ? 'danger' : ''}` }, a.label);
      b.addEventListener('click', async () => {
        if (!a.onClick) return close();
        b.disabled = true;
        try {
          const keep = await a.onClick();
          if (keep !== false) close();
        } catch (e) {
          toast(e.message || String(e), 'bad');
        } finally {
          b.disabled = false;
        }
      });
      footer.append(b);
    }
    const m = h('div', { class: 'modal', style: wide ? { width: 'min(640px, calc(100vw - 32px))' } : null },
      h('header', {}, h('h2', {}, title), h('button', { class: 'btn ghost small icon', title: 'Close', onclick: close }, ico('close'))),
      h('div', { class: 'body' }, body),
      actions.length ? footer : null);
    back.append(m);
    back.addEventListener('mousedown', (e) => e.target === back && close());
    document.body.append(back);
    const first = m.querySelector('input:not([type=checkbox]), select, textarea');
    setTimeout(() => first?.focus(), 30);
    // Enter submits with the primary action
    m.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        const p = footer.querySelector('.btn.primary');
        if (p) {
          e.preventDefault();
          p.click();
        }
      }
    });
    return { close, el: m };
  }

  function menu(x, y, items) {
    document.querySelectorAll('.menu').forEach((m) => m.remove());
    const el = h('div', { class: 'menu' });
    for (const it of items) {
      if (it === '-') {
        el.append(h('hr'));
        continue;
      }
      el.append(h('button', { class: it.danger ? 'danger' : '', onclick: () => { el.remove(); it.onClick(); } }, it.icon ? ico(it.icon) : null, it.label));
    }
    document.body.append(el);
    const r = el.getBoundingClientRect();
    el.style.left = `${Math.min(x, innerWidth - r.width - 8)}px`;
    el.style.top = `${Math.min(y, innerHeight - r.height - 8)}px`;
    const off = (e) => {
      if (!el.contains(e.target)) {
        el.remove();
        document.removeEventListener('mousedown', off, true);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', off, true), 0);
  }

  function field(label, input, hint) {
    return h('label', { class: 'field' }, h('span', {}, label), input, hint ? h('small', {}, hint) : null);
  }

  function check(label, sub, checked, onChange) {
    const box = h('input', { type: 'checkbox' });
    box.checked = !!checked;
    box.addEventListener('change', () => onChange(box.checked));
    return h('label', { class: 'check' }, box, h('span', {}, h('b', {}, label), sub ? h('small', {}, sub) : null));
  }

  const formatId = (id) => (id ? String(id).replace(/\s/g, '').replace(/(\d{3})(?=\d)/g, '$1 ') : '');
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  function ago(ts) {
    if (!ts) return 'never';
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return new Date(ts).toLocaleDateString();
  }

  function applyTheme(theme) {
    const t = theme === 'system' || !theme ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme;
    document.documentElement.dataset.theme = t;
  }

  global.UIKit = { h, ico, hydrateIcons, toast, modal, menu, field, check, formatId, uid, ago, applyTheme };
})(window);
