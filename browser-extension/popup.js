/* Pocket-Canvas Web Clipper — toolbar popup
 * Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
 */
'use strict';
const $ = (id) => document.getElementById(id);
let tab = null;
let selection = '';

function show(pane) {
  for (const p of ['loading', 'offline', 'connect', 'ready']) $(p).hidden = p !== pane;
}
function status(text, kind = 'ok') {
  const s = $('status');
  s.textContent = text; s.className = kind; s.hidden = !text;
}

async function activeTab() {
  const [t] = await ext.tabs.query({ active: true, currentWindow: true });
  return t || null;
}

async function readSelection() {
  if (!tab || !/^https?:|^file:/.test(tab.url || '')) return '';
  try {
    const [r] = await ext.scripting.executeScript({ target: { tabId: tab.id }, func: () => String(getSelection()) });
    return (r && r.result) || '';
  } catch { return ''; }
}

async function start() {
  show('loading'); status('');
  tab = await activeTab();
  let st;
  try { st = await PC.status(); } catch (err) {
    $('offline-detail').textContent = '';
    show('offline');
    return;
  }
  if (!st.paired) { await PC.forget(); show('connect'); return; }

  // Connected: fill in the page and the board list.
  $('page-title').textContent = (tab && tab.title) || 'This page';
  $('page-url').textContent = (tab && tab.url) || '';
  if (tab && tab.favIconUrl && /^(https?|data):/.test(tab.favIconUrl)) $('fav').src = tab.favIconUrl; else $('fav').hidden = true;
  const canSave = tab && /^https?:/.test(tab.url || '');
  $('save-page').disabled = !canSave;
  if (!canSave) $('save-page').title = 'Only web pages (http/https) can be saved';
  try {
    const boards = await PC.boards();
    const { boardId } = await PC.cfg();
    const sel = $('board');
    sel.innerHTML = '';
    for (const b of boards) {
      const o = document.createElement('option');
      o.value = b.id;
      o.textContent = '   '.repeat(b.depth) + b.title;
      sel.appendChild(o);
    }
    if (boards.some((b) => b.id === boardId)) sel.value = boardId;
  } catch (err) {
    if (err.status === 401) { await PC.forget(); show('connect'); return; }
    status(err.message, 'bad');
  }
  selection = await readSelection();
  $('save-selection').disabled = !selection.trim();
  if (selection.trim()) $('save-selection').title = selection.slice(0, 120);
  show('ready');
}

async function save(kind) {
  const boardId = $('board').value;
  await PC.set({ boardId });
  const data = { kind, boardId, pageUrl: tab && tab.url, pageTitle: tab && tab.title, note: $('note').value.trim() };
  if (kind === 'page') { data.url = tab.url; data.title = tab.title; }
  if (kind === 'text') data.text = selection;
  if (kind === 'screenshot') {
    try { data.dataUrl = await ext.tabs.captureVisibleTab(tab.windowId, { format: 'png' }); } catch (err) {
      status('This page can’t be captured: ' + (err.message || err), 'bad'); return;
    }
  }
  for (const b of document.querySelectorAll('.actions button')) b.disabled = true;
  status('Saving…', 'busy');
  try {
    const r = await PC.clip(data);
    status(`✓ Saved to “${r.board || $('board').selectedOptions[0].textContent.trim()}”`, 'ok');
    $('note').value = '';
    setTimeout(() => window.close(), 1400);
  } catch (err) {
    status(err.message, 'bad');
    if (err.status === 401) { await PC.forget(); show('connect'); }
  } finally {
    for (const b of document.querySelectorAll('.actions button')) b.disabled = false;
    $('save-selection').disabled = !selection.trim();
  }
}

$('retry').onclick = start;
$('open-options').onclick = (e) => { e.preventDefault(); ext.runtime.openOptionsPage(); };
$('connect-btn').onclick = async () => {
  $('connect-btn').disabled = true;
  $('connect-msg').textContent = 'Switch to Pocket-Canvas and click Allow…';
  try {
    await PC.pair();
    $('connect-msg').textContent = '';
    start();
  } catch (err) {
    $('connect-msg').textContent = err.message;
  } finally {
    $('connect-btn').disabled = false;
  }
};
$('save-page').onclick = () => save('page');
$('save-selection').onclick = () => save('text');
$('save-shot').onclick = () => save('screenshot');
$('board').onchange = () => PC.set({ boardId: $('board').value });

start();
