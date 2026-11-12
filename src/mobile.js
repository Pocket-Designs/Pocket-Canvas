/* Pocket-Canvas — touch screens and the Android app
 * Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
 *
 * On any touch screen:
 *   one finger on an empty part of the board  → move around (pan)
 *   two fingers                               → pinch to zoom
 *   press and hold                            → the right-click menu
 * In the phone and tablet apps also: a ⋮ menu button (in place of the desktop menu bar) and, on Android, the Back button.
 */
'use strict';

(function touchGestures() {
  const pts = new Map(); // touch pointers on the board
  let mode = null, start = null, longTimer = null, ourMenuAt = 0;

  const onEmpty = (t) => !t.closest('.card, path.hit, path.link, text.link-label, circle.lh, #line-bar, #sketch-bar, #format-bar, #empty-hint button');
  const mid = () => { const [a, b] = [...pts.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) || 1 }; };
  const cancelLong = () => { clearTimeout(longTimer); longTimer = null; };

  function begin(kind) {
    const v = B().view;
    mode = kind;
    if (kind === 'pan') { const [p] = pts.values(); start = { x: p.x, y: p.y, vx: v.x, vy: v.y }; }
    else { const m = mid(); start = { ...m, vx: v.x, vy: v.y, z: v.z }; }
  }

  viewport.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || !store) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // press and hold for the menu (not while typing — that's for selecting text)
    cancelLong();
    if (pts.size === 1 && !e.target.isContentEditable) {
      const x = e.clientX, y = e.clientY, target = e.target;
      longTimer = setTimeout(() => {
        longTimer = null;
        if (pts.size !== 1) return;
        mode = 'menu'; ourMenuAt = Date.now();
        target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
      }, 550);
    }
    if (pts.size === 2) {
      cancelLong();
      begin('pinch');
      e.preventDefault(); e.stopPropagation();
      return;
    }
    if (pts.size === 1 && tool !== 'connect' && !sketchEditing && onEmpty(e.target)) {
      // one finger on the empty board moves it, instead of drawing a selection box
      begin('pan');
      e.preventDefault(); e.stopPropagation();
      viewport.focus({ preventScroll: true });
      if (selected.size || selectedLink) clearSelection();
    }
  }, true);

  window.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    const p = pts.get(e.pointerId);
    if (longTimer && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) cancelLong();
    if (mode === 'pan' || mode === 'pinch') { p.x = e.clientX; p.y = e.clientY; } else return;
    const v = B().view;
    if (mode === 'pan') {
      v.x = start.vx + (p.x - start.x); v.y = start.vy + (p.y - start.y);
    } else if (pts.size >= 2) {
      const m = mid(), r = viewport.getBoundingClientRect();
      const z = clamp(start.z * m.d / start.d, 0.1, 3);
      // keep the point between the fingers under the fingers
      const wx = (start.x - r.left - start.vx) / start.z, wy = (start.y - r.top - start.vy) / start.z;
      v.z = z; v.x = m.x - r.left - wx * z; v.y = m.y - r.top - wy * z;
    }
    applyView();
  }, { passive: true });

  const end = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    cancelLong();
    if (mode === 'pan' || mode === 'pinch') {
      scheduleSave(); requestAnimationFrame(drawLinks);
      if (mode === 'pinch' && pts.size === 1) { begin('pan'); return; } // lift one finger: carry on moving
    }
    if (!pts.size) mode = null;
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);

  // Android may also open its own menu on a long press; show ours only once.
  viewport.addEventListener('contextmenu', (e) => {
    if (e.isTrusted && Date.now() - ourMenuAt < 1200 && !e.target.isContentEditable) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (e.isTrusted) cancelLong();
  }, true);
})();

// ---------- Phone and tablet app extras (Android, iPhone, iPad) ----------
(function mobileApp() {
  if (!window.api || !(api.mobile || api.web)) return; // the Android, iPhone and iPad apps, and the browser version
  const P = window.Capacitor && window.Capacitor.Plugins;

  // A ⋮ button with what's in the desktop menu bar.
  const btn = document.createElement('button');
  btn.className = 'icon-btn'; btn.id = 'more-btn'; btn.title = 'Menu'; btn.textContent = '⋮';
  $('#topbar .top-right').appendChild(btn);
  btn.addEventListener('click', () => {
    const r = btn.getBoundingClientRect();
    showMenu(r.right - 220, r.bottom + 4, [
      { label: 'New board from a template…', run: () => openTemplates('new-board') },
      { label: 'Insert a template…', run: () => openTemplates('insert') },
      { label: 'Save this board as a template…', run: () => saveBoardAsTemplate(cur) },
      '-',
      { label: 'Fit to screen', run: () => fitContent() },
      { label: 'Comments', run: () => api.menu('comments') },
      { label: 'Recycle bin', run: () => openBin() },
      '-',
      { label: 'Export as picture or PDF…', run: () => openExport() },
      { label: 'Page guides…', run: () => openPageGuideMenu($('#more-btn')) },
      { label: 'Share board as Markdown…', run: () => exportMarkdown() },
      { label: 'Save a backup of all boards…', run: () => exportJson() },
      { label: 'Restore from a backup…', run: () => importJson() },
      '-',
      { label: 'Dark / light', run: () => toggleTheme() },
      { label: 'Settings', run: () => openSettings() },
      ...(api.web ? [
        { label: 'Keyboard shortcuts', hint: 'F1', run: () => api.menu('help') },
        { label: 'Account…', run: () => openSettings('server') },
        { label: 'Sign out', run: () => serverSignOut() }
      ] : [{ label: 'Sync settings', run: () => openSettings('sync') }])
    ]);
  });

  // On a phone the sidebar starts closed and slides over the board.
  const waitForBoards = setInterval(() => {
    if (!store || !store.ui) return;
    clearInterval(waitForBoards);
    if (innerWidth < 760) { store.ui.sidebar = false; $('#app').classList.add('no-sidebar'); }
  }, 50);
  $('#viewport').addEventListener('pointerdown', () => {
    if (innerWidth < 760 && store && store.ui.sidebar !== false) toggleSidebar();
  });

  // The Back button: close what's open, step out of a board, then leave the app.
  if (P && P.App) {
    P.App.addListener('backButton', () => {
      const modals = $$('#modal-root .modal');
      if (modals.length) { $('.modal-x', modals[modals.length - 1]).click(); return; }
      if (!$('#ctx').hidden) { hideMenu(); return; }
      if (isTyping()) { document.activeElement.blur(); return; }
      if (sketchEditing) { stopSketch(); return; }
      if (tool) { cancelConnect(); return; }
      if (selected.size || selectedLink) { clearSelection(); return; }
      if (innerWidth < 760 && store.ui.sidebar !== false) { toggleSidebar(); return; }
      const b = B();
      if (b.parentId && store.boards[b.parentId]) { go(b.parentId); return; }
      P.App.exitApp();
    });
    // Save straight away when the app is put in the background.
    P.App.addListener('pause', () => { try { flushSave(); } catch {} });
  }
})();
