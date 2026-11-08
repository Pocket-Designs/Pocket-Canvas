/* Pocket-Canvas — receiving changes from other computers and from the browser extension
 * Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
 */
'use strict';

const pendingRemote = [];
let remoteTimer = null;

function busy() {
  return isTyping() || sketchStroking || !!$('.card.dragging') || !$('#marquee').hidden;
}

let applying = false;
async function applyRemote() {
  clearTimeout(remoteTimer);
  if (!pendingRemote.length || !store || applying) return;
  if (busy() || saving) { remoteTimer = setTimeout(applyRemote, 1200); return; }
  applying = true;
  try {
    // Merge using the encrypted form, so locked boards are merged as sealed blobs.
    let merged = await prepareSealed();
    let changed = false;
    let from = '';
    for (const r of pendingRemote.splice(0)) {
      // a shared board's copy is first fitted into a whole-store copy (see server-sync.js)
      const res = PCSync.merge(merged, r.build ? r.build(merged) : r.state);
      merged = res.store;
      if (res.changed) { changed = true; from = r.deviceName || 'another computer'; }
    }
    // Boards from older versions may have cards above or left of the top-left corner.
    for (const b of Object.values(merged.boards)) normaliseOrigin(b);
    syncIndex = PCSync.buildIndex(merged);
    if (!changed) return;
    merged.ui = store.ui;
    await reopenUnlocked(merged); // boards you have open stay open
    store = merged;
    // Undo would otherwise be able to "undo" another computer's changes.
    undoStack = []; redoStack = [];
    if (!store.boards[cur]) cur = store.root;
    for (const id of [...selected]) if (!B().cards[id]) selected.delete(id);
    if (sketchEditing && !B().cards[sketchEditing]) stopSketch();
    render();
    flushSave();
    const el = $('#sync-state');
    if (el) { el.textContent = 'Updated'; el.title = `Changes from ${from}`; setTimeout(updateSyncLabel, 2500); }
  } finally {
    applying = false;
    if (pendingRemote.length) remoteTimer = setTimeout(applyRemote, 500);
  }
}

function initSyncClient() {
  api.onSyncIncoming((remote) => { pendingRemote.push(remote); applyRemote(); });
  api.onSyncStatus((st) => {
    syncStatus = st;
    updateSyncLabel();
    if (settingsModal && settingsTab === 'sync') {
      const active = document.activeElement;
      if (!active || !settingsModal.el.contains(active) || active.tagName === 'BUTTON') renderSettings();
    }
  });
  api.onAssetsArrived(() => {
    const redraw = () => { if (busy()) setTimeout(redraw, 1500); else renderBoard(); };
    redraw();
  });
  api.onClip((clip) => {
    let reply = { id: clip.id };
    try { reply = { id: clip.id, ...addClip(clip) }; } catch (err) { console.error(err); }
    api.clipDone(reply);
  });
  api.syncStatus().then((st) => { syncStatus = st; updateSyncLabel(); });
}

// ---------- Web clips ----------
function rightOfContent(b) {
  const top = Object.values(b.cards).filter((c) => !c.col);
  if (!top.length) return { x: 60, y: 60 };
  return {
    x: Math.max(...top.map((c) => c.x + (c.type === 'board' ? 130 : c.type === 'swatch' ? 140 : c.w))) + 60,
    y: Math.min(...top.map((c) => c.y))
  };
}

function addClip(clip) {
  let bid = store.boards[clip.boardId] ? clip.boardId : store.root;
  let note = '';
  if (isSealed(bid)) { note = ` (“${store.boards[bid].title}” is locked, so it went to Home)`; bid = store.root; }
  const b = store.boards[bid];
  checkpoint();
  let inbox = Object.values(b.cards).find((c) => c.type === 'column' && c.inbox);
  if (!inbox) {
    const p = rightOfContent(b);
    inbox = makeCard(b, 'column', p.x, p.y, { title: 'From the web', inbox: true, color: '#3a7be0', w: 300 });
  }
  const src = /^https?:\/\//i.test(clip.source || '') ? clip.source : '';
  const srcLink = src ? `<p>— <a href="${esc(src)}">${esc(clip.sourceTitle || src)}</a></p>` : '';
  const k = clip.card || {};
  let fields;
  switch (k.type) {
    case 'note':
      fields = ['note', { html: sanitize(String(k.text || '').split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('') + srcLink) }];
      break;
    case 'image':
      fields = ['image', { asset: k.asset, caption: k.caption || '', source: src }];
      break;
    case 'media':
      fields = ['media', { asset: k.asset, name: k.name || '', size: k.size || 0, kind: k.kind === 'video' ? 'video' : 'audio', source: src }];
      break;
    default: {
      let title = k.title || '';
      try { if (!title) title = new URL(k.url).hostname.replace(/^www\./, ''); } catch {}
      fields = ['link', { url: k.url, title }];
    }
  }
  const nc = makeCard(b, fields[0], 0, 0, fields[1]);
  nc.col = inbox.id;
  inbox.items.unshift(nc.id);
  if (clip.note) nc.comments = [{ id: uid(), author: settingsCache.userName || 'Me', text: clip.note.slice(0, 5000), at: Date.now() }];
  if (bid === cur) renderBoard();
  renderTree();
  scheduleSave();
  if (nc.type === 'link') fetchPreview(nc.id, false, bid);
  toast(`Saved to “${b.title}” from your browser${note}`);
  return { boardTitle: b.title };
}
