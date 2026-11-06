/* Pocket-Canvas — start-up (loads last, after all the feature scripts)
 * Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
 */
'use strict';

(async function init() {
  if (EXPORT_MODE) {
    runExportMode().catch((err) => api.exportReady({ error: String((err && err.message) || err) }));
    return;
  }
  buildRail();
  $('#bin-btn').innerHTML = BIN_ICON + '<span></span>';
  $('#bin-btn').onclick = () => openBin();
  $('#delete-btn').innerHTML = BIN_ICON;
  $('#delete-btn').onclick = () => deleteSelection();
  buildSketchBar();
  initComments();
  initSyncClient();
  assetBase = await api.assetBase();
  try { settingsCache = await api.getSettings(); } catch {}
  const data = await api.load();
  let fresh = false;
  if (data && data.boards && data.boards[data.root]) {
    store = migrate(data);
    cur = store.boards[store.ui.last] ? store.ui.last : store.root;
  } else {
    defaultStore();
    fresh = true;
  }
  syncIndex = PCSync.buildIndex(store);
  render();
  if (fresh) {
    flushSave();
    requestAnimationFrame(() => requestAnimationFrame(fitContent));
  }
  api.ready();
  applyRemote(); // changes from other computers that arrived while starting up
  serverConnect(); // your Pocket-Canvas Server, if you've signed in to one
  $('#server-state').onclick = () => openSettings('server');
  purgeBin();
  setInterval(purgeBin, 3600e3);
  api.onBackupDone((r) => toast(r && r.ok ? 'Backup saved' : (r && r.error) || 'Backup failed'));
  api.onBackupStatus((st) => { if (st.error) toast(st.error); });
})();
