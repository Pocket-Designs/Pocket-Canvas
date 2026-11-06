// Pocket-Canvas — safe bridge between the UI and the main process
// Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (fn) => ipcRenderer.on(channel, (_e, payload) => fn(payload));

contextBridge.exposeInMainWorld('api', {
  platform: 'desktop',
  // data
  load: () => ipcRenderer.invoke('data:load'),
  save: (json) => ipcRenderer.invoke('data:save', json),
  ready: () => ipcRenderer.invoke('app:ready'),
  // assets
  assetBase: () => ipcRenderer.invoke('assets:base'),
  saveBytes: (name, bytes) => ipcRenderer.invoke('assets:saveBytes', { name, bytes }),
  pickFiles: (kind) => ipcRenderer.invoke('assets:pick', kind),
  openAsset: (id) => ipcRenderer.invoke('assets:open', id),
  readAsset: (id) => ipcRenderer.invoke('assets:read', id),
  writeAsset: (id, bytes) => ipcRenderer.invoke('assets:write', { id, bytes }),
  hasAssets: (ids) => ipcRenderer.invoke('assets:missing', ids),
  saveAssetAs: (id, name) => ipcRenderer.invoke('assets:saveAs', { id, name }),
  // links
  openLink: (url) => ipcRenderer.invoke('link:open', url),
  linkPreview: (url) => ipcRenderer.invoke('link:preview', url),
  // files and dialogs
  saveText: (defaultName, text, filters) => ipcRenderer.invoke('file:saveText', { defaultName, text, filters }),
  openText: (filters) => ipcRenderer.invoke('file:openText', { filters }),
  confirm: (message, detail) => ipcRenderer.invoke('dialog:confirm', { message, detail }),
  showFile: (p) => ipcRenderer.invoke('file:show', p),
  // export
  exportVisual: (opts) => ipcRenderer.invoke('export:visual', opts),
  exportReady: (info) => ipcRenderer.invoke('export:ready', info),
  exportData: () => ipcRenderer.invoke('export:data'),
  // settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  forgetBrowser: (id) => ipcRenderer.invoke('clipper:forget', id),
  // backups
  backupStatus: () => ipcRenderer.invoke('backup:status'),
  backupNow: () => ipcRenderer.invoke('backup:now'),
  backupSet: (patch) => ipcRenderer.invoke('backup:set', patch),
  backupChoose: () => ipcRenderer.invoke('backup:choose'),
  backupOpen: () => ipcRenderer.invoke('backup:open'),
  backupRead: (name) => ipcRenderer.invoke('backup:read', name),
  onBackupStatus: on('backup:status'),
  onBackupDone: on('backup:done'),
  // spelling
  spellGet: () => ipcRenderer.invoke('spell:get'),
  spellSet: (patch) => ipcRenderer.invoke('spell:set', patch),
  spellRemoveWord: (w) => ipcRenderer.invoke('spell:removeWord', w),
  // sync
  syncStatus: () => ipcRenderer.invoke('sync:status'),
  syncChoose: () => ipcRenderer.invoke('sync:choose'),
  syncDisable: () => ipcRenderer.invoke('sync:disable'),
  syncNow: () => ipcRenderer.invoke('sync:now'),
  syncOpen: () => ipcRenderer.invoke('sync:open'),
  // events from the main process
  onMenu: on('menu'),
  onSyncIncoming: on('sync:incoming'),
  onSyncStatus: on('sync:status'),
  onAssetsArrived: on('assets:arrived'),
  onClip: on('clip:add'),
  clipDone: (reply) => ipcRenderer.send('clip:done', reply)
});
