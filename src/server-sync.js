/* Pocket-Canvas — syncing through your own Pocket-Canvas Server, and boards shared with other people
 * Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
 *
 * The server (server/pocket-canvas-server.js) passes copies between devices and people:
 *   • scope "me": all your boards, between your own devices (like folder sync)
 *   • a shared board ("space"): that board and the boards inside it, between everyone it's shared with
 * Copies are combined card by card with the same merge as folder sync (src/merge.js), through the
 * same applyRemote() in sync-client.js. Changes go out about a second after you make them, and
 * you can see who else is on a shared board and which card they're on.
 *
 * settingsCache.server = { url, token, user: { id, name, display }, personal: true }
 */
'use strict';

const SRV = {
  ws: null, state: 'off', error: null, user: null,
  spaces: new Map(),      // space id → { id, root, title, owner, members }
  people: new Map(),      // space id → [{ user, deviceId, board, card, editing }]
  devices: new Map(),     // other devices of yours: deviceId → { name, savedAt }
  sent: new Map(),        // scope → JSON last sent (so unchanged copies aren't sent again)
  retry: 0, retryTimer: null, lastPresence: '', uploaded: new Set()
};
const SHARED_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.4 2.8-5.2 5.5-5.2s4.9 1.8 5.5 5.2"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 13.9c2.7-.4 4.6 1.3 5.1 4.6"/></svg>';
const serverCfg = () => (settingsCache && settingsCache.server) || {};
const serverOn = () => !!(serverCfg().url && serverCfg().token);
const httpBase = () => String(serverCfg().url || '').replace(/\/+$/, '');

async function serverFetch(path, opts = {}) {
  const res = await fetch(httpBase() + path, {
    ...opts,
    headers: { ...(opts.body && !(opts.body instanceof Uint8Array) ? { 'Content-Type': 'application/json' } : {}), ...(serverCfg().token ? { Authorization: 'Bearer ' + serverCfg().token } : {}), ...(opts.headers || {}) }
  });
  const isJson = (res.headers.get('content-type') || '').includes('json');
  const body = isJson ? await res.json() : await res.arrayBuffer();
  if (!res.ok) throw new Error((isJson && body.error) || 'The server answered ' + res.status);
  return body;
}

// ---------- signing in ----------
async function serverSignIn(url, name, password, joinCode) {
  url = String(url || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  let info;
  try { info = await (await fetch(url + '/health')).json(); } catch { throw new Error('Can’t reach a Pocket-Canvas Server at that address.'); }
  if (!info || info.app !== 'Pocket-Canvas Server') throw new Error('That address isn’t a Pocket-Canvas Server.');
  const path = joinCode ? '/api/register' : '/api/login';
  const res = await fetch(url + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, password, joinCode, device: settingsCache.deviceName || '' })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'The server said no (' + res.status + ').');
  settingsCache = await api.setSettings({ server: { url, token: body.token, user: body.user, personal: true } });
  serverConnect();
  return body.user;
}
async function serverSignOut() {
  try { await serverFetch('/api/logout', { method: 'POST' }); } catch {}
  serverDisconnect();
  settingsCache = await api.setSettings({ server: { url: serverCfg().url || '', token: null, user: null, personal: true } });
  SRV.spaces.clear(); SRV.people.clear(); SRV.devices.clear();
  renderTree(); updatePeers(); updateServerLabel();
}

// ---------- the live connection ----------
function serverConnect() {
  serverDisconnect();
  if (!serverOn()) { SRV.state = 'off'; updateServerLabel(); return; }
  SRV.state = 'connecting'; updateServerLabel();
  const wsUrl = httpBase().replace(/^http/i, 'ws') + '/ws?token=' + encodeURIComponent(serverCfg().token);
  let ws;
  try { ws = new WebSocket(wsUrl); } catch (err) { serverRetry(String(err.message || err)); return; }
  SRV.ws = ws;
  ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', deviceId: settingsCache.deviceId, deviceName: settingsCache.deviceName }));
  ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } serverMessage(m); };
  ws.onclose = (e) => {
    if (SRV.ws !== ws) return;
    SRV.ws = null;
    if (e.code === 4001) { SRV.state = 'error'; SRV.error = 'Please sign in to the server again.'; updateServerLabel(); return; }
    serverRetry('Offline: changes will be sent when the server is back.');
  };
  ws.onerror = () => {};
}
function serverDisconnect() {
  clearTimeout(SRV.retryTimer);
  if (SRV.ws) { const w = SRV.ws; SRV.ws = null; try { w.close(); } catch {} }
  SRV.people.clear(); updatePeers();
}
function serverRetry(msg) {
  SRV.state = 'offline'; SRV.error = msg; updateServerLabel();
  clearTimeout(SRV.retryTimer);
  const wait = Math.min(30000, 1000 * 2 ** Math.min(SRV.retry++, 5));
  SRV.retryTimer = setTimeout(serverConnect, wait);
}
function serverSend(m) { if (SRV.ws && SRV.ws.readyState === 1) { SRV.ws.send(JSON.stringify(m)); return true; } return false; }

function serverMessage(m) {
  if (m.t === 'welcome') {
    SRV.state = 'online'; SRV.error = null; SRV.retry = 0; SRV.user = m.user;
    SRV.spaces = new Map(m.spaces.map((s) => [s.id, s]));
    SRV.sent.clear(); SRV.lastPresence = '';
    updateServerLabel(); renderTree(); if (store) renderBoard();
    flushSave(); // send what we have
    serverPresence();
  } else if (m.t === 'doc') {
    if (m.scope === 'me') {
      if (!serverCfg().personal) return;
      SRV.devices.set(m.deviceId, { name: m.deviceName || 'Another device', savedAt: m.savedAt });
      receiveRemote(m.state, m.deviceName || 'another device');
    } else {
      const sp = SRV.spaces.get(m.scope);
      if (!sp) return;
      const remote = m.state;
      const who = (m.user && (m.user.display || m.user.name)) || 'someone';
      receiveRemote(null, who, (local) => composeSpace(local, sp.root, remote));
    }
    serverFetchAssets(m.state);
  } else if (m.t === 'space') {
    const known = SRV.spaces.has(m.space.id);
    SRV.spaces.set(m.space.id, m.space);
    renderTree(); if (store) renderBoard();
    if (!known && m.space.owner && SRV.user && m.space.owner.id !== SRV.user.id) toast(`${m.space.owner.display || m.space.owner.name} shared “${m.space.title}” with you`);
  } else if (m.t === 'unshared') {
    const sp = SRV.spaces.get(m.space);
    SRV.spaces.delete(m.space); SRV.people.delete(m.space);
    renderTree(); if (store) renderBoard(); updatePeers();
    if (sp) toast(`“${sp.title}” is no longer shared with you. Your copy stays here.`);
  } else if (m.t === 'presence') {
    SRV.people.set(m.space, (m.people || []).filter((p) => p.deviceId !== settingsCache.deviceId));
    updatePeers();
  } else if (m.t === 'error') {
    toast('Server: ' + m.error);
  }
}

// Hand a copy to the same merge used by folder sync.
function receiveRemote(state, from, build) {
  pendingRemote.push(build ? { deviceName: from, build } : { deviceName: from, state });
  applyRemote();
}

// ---------- shared boards ----------
// The boards that are `rootId` or inside it.
function subtreeIds(st, rootId) {
  const ids = new Set();
  if (!st.boards[rootId]) return ids;
  ids.add(rootId);
  let grew = true;
  while (grew) {
    grew = false;
    for (const b of Object.values(st.boards)) if (!ids.has(b.id) && ids.has(b.parentId)) { ids.add(b.id); grew = true; }
  }
  return ids;
}
// The part of a (sealed) store that is shared: the board and everything inside it.
function extractSpace(st, rootId) {
  const ids = subtreeIds(st, rootId);
  const boards = {};
  for (const id of ids) boards[id] = id === rootId ? { ...st.boards[id], parentId: null } : st.boards[id];
  return { root: rootId, boards, templates: {}, bin: {}, deleted: st.deleted || {} };
}
// A whole-store copy to merge: your own boards, with the shared board replaced by the copy that came in.
function composeSpace(local, rootId, remote) {
  if (!remote || remote.root !== rootId || !remote.boards || !remote.boards[rootId]) return { ...local, boards: local.boards };
  const mine = subtreeIds(local, rootId), theirs = subtreeIds(remote, rootId);
  const boards = {};
  for (const [id, b] of Object.entries(local.boards)) if (!mine.has(id)) boards[id] = b;
  for (const id of theirs) if (!local.boards[id] || mine.has(id)) boards[id] = remote.boards[id];
  const parent = local.boards[rootId] ? local.boards[rootId].parentId : local.root;
  boards[rootId] = { ...remote.boards[rootId], parentId: parent || local.root };
  return { root: local.root, boards, templates: local.templates || {}, bin: local.bin || {}, deleted: remote.deleted || {} };
}
// Which shared board (space) a board belongs to, if any.
function spaceOfBoard(bid) {
  if (!store || !SRV.spaces.size) return null;
  const seen = new Set();
  let b = store.boards[bid];
  while (b && !seen.has(b.id)) {
    seen.add(b.id);
    for (const sp of SRV.spaces.values()) if (sp.root === b.id && sp.members.length > 1) return sp;
    b = store.boards[b.parentId];
  }
  return null;
}
// A board counts as shared while at least one other person is in it.
const isSharedRoot = (bid) => { for (const sp of SRV.spaces.values()) if (sp.root === bid && sp.members.length > 1) return sp; return null; };

async function openShare(bid) {
  if (!serverOn()) { toast('Sign in to a Pocket-Canvas Server first (Settings › Server)'); openSettings('server'); return; }
  if (SRV.state !== 'online') { toast('The server isn’t connected right now'); return; }
  const b = store.boards[bid];
  if (!b) return;
  if (bid === store.root) { toast('Home can’t be shared. Share a board inside it instead.'); return; }
  if ([...subtreeIds(store, bid)].some((id) => store.boards[id].lock)) { toast('Boards with a password can’t be shared'); return; }
  let users = [];
  try { users = (await serverFetch('/api/users')).users; } catch (err) { toast(err.message); return; }
  const sp = [...SRV.spaces.values()].find((x) => x.root === bid) || null;
  const members = new Set(sp ? sp.members.map((m) => m.id) : []);
  const me = SRV.user && SRV.user.id;
  const others = users.filter((u) => u.id !== me);
  const amOwner = !sp || (sp.owner && sp.owner.id === me);
  const body = document.createElement('div');
  body.className = 'share-box';
  body.innerHTML = `
    <p>People you share <b>${esc(b.title)}</b> with can see and change it, and the boards inside it, at the same time as you. Changes appear for everyone in about a second.</p>
    ${others.length ? `<div class="share-list">${others.map((u) => `<label class="check"><input type="checkbox" name="u" value="${esc(u.name)}" ${members.has(u.id) ? 'checked' : ''} ${!amOwner && members.has(u.id) ? 'disabled' : ''}>
      <span><b>${esc(u.display)}</b> <span class="muted small">${esc(u.name)}</span></span></label>`).join('')}</div>`
      : '<p class="muted">Nobody else has an account on this server yet. Give them the server address and the join code, and they can create one in Settings › Server.</p>'}
    ${sp ? `<p class="muted small">Shared by ${esc(sp.owner ? sp.owner.display || sp.owner.name : 'someone')}.</p>` : ''}`;
  const actions = [{ label: 'Cancel' }];
  if (sp) actions.unshift(amOwner
    ? { label: 'Stop sharing', danger: true, run: (close) => { serverSend({ t: 'unshare', space: sp.id }); close(); } }
    : { label: 'Leave', danger: true, run: (close) => { serverSend({ t: 'leave', space: sp.id }); close(); } });
  actions.push({
    label: sp ? 'Save' : 'Share', primary: true,
    run: async (close) => {
      const names = [...body.querySelectorAll('input[name="u"]:checked')].map((i) => i.value);
      if (!names.length && !sp) { toast('Tick at least one person'); return; }
      await flushSave();
      const sealed = await prepareSealed();
      serverSend({ t: 'share', root: bid, title: b.title, with: names, state: extractSpace(sealed, bid) });
      close();
      toast(sp ? 'Sharing updated' : `“${b.title}” is now shared`);
    }
  });
  openModal({ title: sp ? 'Shared board' : 'Share board', body, actions });
}

// ---------- sending changes (called by flushSave after every save) ----------
function serverOnSaved(sealed) {
  if (!serverOn() || SRV.state !== 'online') return;
  const send = (scope, state) => {
    const json = JSON.stringify(state);
    if (SRV.sent.get(scope) === json) return;
    if (serverSend({ t: 'doc', scope, state })) SRV.sent.set(scope, json);
  };
  if (serverCfg().personal) send('me', PCSync.syncState(sealed));
  for (const sp of SRV.spaces.values()) if (sealed.boards[sp.root]) send(sp.id, extractSpace(sealed, sp.root));
  serverUploadAssets(sealed);
}

// ---------- pictures and files ----------
function assetIds(st) {
  const ids = new Set();
  const ok = (v) => typeof v === 'string' && /^[0-9a-f]{16}\.[a-z0-9]{1,10}$/.test(v);
  for (const b of Object.values((st && st.boards) || {})) {
    if (ok(b.iconAsset)) ids.add(b.iconAsset);
    for (const c of Object.values(b.cards || {})) {
      for (const k of ['asset', 'image', 'icon']) if (ok(c[k])) ids.add(c[k]);
      if (Array.isArray(c.pics)) for (const row of c.pics) if (Array.isArray(row)) for (const p of row) if (ok(p)) ids.add(p);
    }
  }
  return [...ids];
}
let uploading = false;
async function serverUploadAssets(st) {
  if (uploading || !api.readAsset) return;
  const ids = assetIds(st).filter((id) => !SRV.uploaded.has(id));
  if (!ids.length) return;
  uploading = true;
  try {
    const { missing } = await serverFetch('/api/assets/missing', { method: 'POST', body: JSON.stringify({ ids }) });
    for (const id of ids) if (!missing.includes(id)) SRV.uploaded.add(id);
    for (const id of missing) {
      const bytes = await api.readAsset(id);
      if (!bytes) continue;
      await serverFetch('/api/assets/' + id, { method: 'PUT', body: bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), headers: { 'Content-Type': 'application/octet-stream' } });
      SRV.uploaded.add(id);
    }
  } catch (err) { console.warn('asset upload', err); } finally { uploading = false; }
}
async function serverFetchAssets(st) {
  if (!api.hasAssets) return;
  const ids = assetIds(st);
  if (!ids.length) return;
  try {
    const missing = await api.hasAssets(ids);
    let got = 0;
    for (const id of missing) {
      try {
        const buf = await serverFetch('/api/assets/' + id);
        if (await api.writeAsset(id, new Uint8Array(buf))) { got++; SRV.uploaded.add(id); }
      } catch {}
    }
    if (got) { const redraw = () => { if (busy()) setTimeout(redraw, 1500); else renderBoard(); }; redraw(); }
  } catch {}
}

// ---------- who else is here ----------
let presenceTimer = null;
function serverPresence() {
  clearTimeout(presenceTimer);
  presenceTimer = setTimeout(() => {
    if (SRV.state !== 'online' || !store) return;
    const sp = spaceOfBoard(cur);
    const editingEl = isTyping() && document.activeElement.closest && document.activeElement.closest('.card');
    const card = editingEl ? editingEl.dataset.id : (selected.size === 1 ? [...selected][0] : null);
    const msg = sp ? { t: 'presence', space: sp.id, board: cur, card, editing: !!editingEl } : { t: 'presence', space: null };
    const key = JSON.stringify(msg);
    if (key === SRV.lastPresence) return;
    SRV.lastPresence = key;
    serverSend(msg);
  }, 150);
}
const peerColour = (id) => { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return COLORS[h % (COLORS.length - 1)]; };
const initials = (u) => String(u.display || u.name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
function updatePeers() {
  const box = $('#peers');
  $$('.card.peer').forEach((el) => { el.classList.remove('peer'); el.removeAttribute('data-peer'); el.style.removeProperty('--peer'); });
  if (!box) return;
  const here = [];
  for (const list of SRV.people.values()) for (const p of list) if (p.board === cur && !here.some((x) => x.deviceId === p.deviceId)) here.push(p);
  box.hidden = !here.length;
  box.innerHTML = here.map((p) => `<span class="peer-dot" style="--peer:${peerColour(p.user.id)}" title="${esc(p.user.display || p.user.name)}${p.editing ? ' is typing' : ' is here'}">${esc(initials(p.user))}</span>`).join('');
  for (const p of here) {
    const el = p.card && cardEl(p.card);
    if (el) { el.classList.add('peer'); el.style.setProperty('--peer', peerColour(p.user.id)); el.dataset.peer = (p.user.display || p.user.name) + (p.editing ? ' ✎' : ''); }
  }
}
document.addEventListener('focusin', serverPresence);
document.addEventListener('focusout', serverPresence);

function updateServerLabel() {
  const el = $('#server-state');
  if (!el) return;
  if (!serverOn()) { el.hidden = true; return; }
  el.hidden = false;
  el.className = 'server-state ' + SRV.state;
  el.textContent = { online: 'Live', connecting: 'Connecting…', offline: 'Offline', error: 'Sign in' }[SRV.state] || '';
  el.title = SRV.state === 'online' ? `Connected to ${httpBase()} as ${SRV.user ? SRV.user.display || SRV.user.name : ''}` : (SRV.error || '');
  if (settingsModal && settingsTab === 'server') { const a = document.activeElement; if (!a || !settingsModal.el.contains(a) || a.tagName === 'BUTTON') renderSettings(); }
}

function serverStatus() {
  return { on: serverOn(), state: SRV.state, error: SRV.error, url: serverCfg().url || '', user: SRV.user || serverCfg().user || null, personal: serverCfg().personal !== false, spaces: [...SRV.spaces.values()], devices: [...SRV.devices.values()] };
}
