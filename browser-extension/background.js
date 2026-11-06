/* Pocket-Canvas Web Clipper — right-click menu
 * Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
 */
'use strict';
// Chrome loads this as a service worker (needs importScripts); Firefox loads lib.js first.
if (typeof importScripts === 'function' && typeof PC === 'undefined') importScripts('lib.js');

const MENUS = [
  { id: 'pc-page', title: 'Save page to Pocket-Canvas', contexts: ['page'] },
  { id: 'pc-link', title: 'Save link to Pocket-Canvas', contexts: ['link'] },
  { id: 'pc-image', title: 'Save picture to Pocket-Canvas', contexts: ['image'] },
  { id: 'pc-media', title: 'Save video / audio to Pocket-Canvas', contexts: ['video', 'audio'] },
  { id: 'pc-text', title: 'Save selected text to Pocket-Canvas', contexts: ['selection'] }
];

async function buildMenus() {
  try { await ext.contextMenus.removeAll(); } catch {}
  for (const m of MENUS) {
    try { ext.contextMenus.create(m, () => void ext.runtime.lastError); } catch {}
  }
}
ext.runtime.onInstalled.addListener(buildMenus);
if (ext.runtime.onStartup) ext.runtime.onStartup.addListener(buildMenus);

async function badge(tabId, ok, title) {
  try {
    await ext.action.setBadgeBackgroundColor({ color: ok ? '#3d9a5c' : '#d0453b', tabId });
    await ext.action.setBadgeText({ text: ok ? '✓' : '!', tabId });
    await ext.action.setTitle({ title: title || 'Save to Pocket-Canvas', tabId });
    setTimeout(() => {
      ext.action.setBadgeText({ text: '', tabId }).catch(() => {});
      ext.action.setTitle({ title: 'Save to Pocket-Canvas', tabId }).catch(() => {});
    }, ok ? 2500 : 8000);
  } catch {}
}

async function saveFromMenu(info, tab) {
  const cfg = await PC.cfg();
  const base = { pageUrl: info.pageUrl || (tab && tab.url) || '', pageTitle: (tab && tab.title) || '', boardId: cfg.boardId };
  let data;
  switch (info.menuItemId) {
    case 'pc-page': data = { ...base, kind: 'page', url: base.pageUrl, title: base.pageTitle }; break;
    case 'pc-link': data = { ...base, kind: 'link', url: info.linkUrl, title: info.linkText || '' }; break;
    case 'pc-image':
      data = { ...base, kind: 'image', srcUrl: info.srcUrl };
      if (/^data:image\//.test(info.srcUrl || '')) data.dataUrl = info.srcUrl;
      break;
    case 'pc-media': data = { ...base, kind: 'media', srcUrl: info.srcUrl }; break;
    case 'pc-text': data = { ...base, kind: 'text', text: info.selectionText || '' }; break;
    default: return;
  }
  const tabId = tab && tab.id;
  try {
    if (!cfg.token) throw Object.assign(new Error('Click the Pocket-Canvas button in the toolbar to connect first.'), { status: 401 });
    const r = await PC.clip(data);
    badge(tabId, true, `Saved to “${r.board || 'Pocket-Canvas'}”`);
    return r;
  } catch (err) {
    badge(tabId, false, err.status === 401 ? 'Not connected: click this button to connect to Pocket-Canvas' : err.message);
    return { error: err.message };
  }
}
ext.contextMenus.onClicked.addListener(saveFromMenu);
