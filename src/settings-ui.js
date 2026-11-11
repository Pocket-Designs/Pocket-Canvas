/* Pocket-Canvas — Settings window
 * Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
 */
'use strict';

let settingsModal = null;
let settingsTab = 'general';
let syncStatus = { enabled: false };

async function openSettings(tab = settingsTab) {
  settingsTab = tab;
  if (settingsModal) settingsModal.close();
  settingsModal = openModal({ title: 'Settings', body: '', wide: true, onClose: () => { settingsModal = null; } });
  await renderSettings();
}

async function renderSettings() {
  if (!settingsModal) return;
  const body = settingsModal.body;
  body.classList.add('settings');
  const s = settingsCache = await api.getSettings();
  syncStatus = await api.syncStatus();
  const mobile = !!api.mobile; // the Android, iPhone and iPad apps
  // The Android app has no spelling settings (the keyboard does that), folder backups or browser extension.
  const tabs = api.web ? [['general', 'General'], ['appearance', 'Appearance'], ['server', 'Account']] // the browser version (served by the server)
    : mobile ? [['general', 'General'], ['appearance', 'Appearance'], ['sync', 'Sync'], ['server', 'Server']]
    : [['general', 'General'], ['appearance', 'Appearance'], ['spelling', 'Spelling'], ['backups', 'Backups'], ['sync', 'Sync'], ['server', 'Server'], ['clipper', 'Browser extension']];
  if (!tabs.some(([id]) => id === settingsTab)) settingsTab = 'general';
  let pane;
  if (settingsTab === 'spelling') pane = spellingPane(await api.spellGet());
  else if (settingsTab === 'backups') pane = backupsPane(await api.backupStatus());
  else if (settingsTab === 'sync') pane = syncPane(s, syncStatus);
  else if (settingsTab === 'clipper') pane = clipperPane(s);
  else if (settingsTab === 'server') pane = serverPane(serverStatus());
  else if (settingsTab === 'appearance') pane = appearancePane();
  else pane = generalPane(s);
  body.innerHTML = `
    <nav class="set-tabs">${tabs.map(([id, name]) => `<button data-tab="${id}" class="${settingsTab === id ? 'on' : ''}">${name}</button>`).join('')}</nav>
    <div class="set-pane">${pane}</div>`;
  bindSettings(body, s);
  bindSpelling(body);
  bindBackups(body);
  bindServer(body);
  bindAppearance(body);
}

function generalPane(s) {
  return `
    <label class="field"><span>Your name <small>shown on comments you write</small></span>
      <input data-set="userName" value="${esc(s.userName)}" maxlength="60"></label>
    <label class="field"><span>${api.web ? 'This browser’s name' : api.mobile ? 'This device’s name' : 'This computer’s name'} <small>shown to your other devices when syncing</small></span>
      <input data-set="deviceName" value="${esc(s.deviceName)}" maxlength="60"></label>
    <label class="check"><input type="checkbox" data-set="linkPreviews" ${s.linkPreviews ? 'checked' : ''}>
      <span><b>Link previews</b><br><small>When you add a link, Pocket-Canvas visits the page to fetch its title, description and picture. Turn this off if you’d rather it didn’t contact websites.</small></span></label>
    <p class="muted small">Pocket-Canvas ${esc(s.version)} · © 2026 Pocket-Designs</p>`;
}

function syncPane(s, st) {
  if (!st.enabled && api.platform === 'ios') {
    return `
      <p>On iPhone and iPad, keep your boards in step with your other devices through a <b>Pocket-Canvas Server</b>: see the <b>Server</b> tab. (Sync folders work on computers and Android.)</p>
      <button class="primary-btn" data-tab="server">Set up the server…</button>`;
  }
  if (!st.enabled && api.platform === 'android') {
    return `
      <p>Keep your boards the same on this device and your computers by using a folder that a sync app keeps up to date.
      On Android, <b>Syncthing</b> works well (Syncthing-Fork from F-Droid or Google Play).</p>
      <ol class="steps">
        <li>In your sync app, share a folder between this device and your computer, for example <i>Pocket-Canvas Sync</i>.</li>
        <li>On your computer, choose that folder in Pocket-Canvas: Settings → Sync.</li>
        <li>Here, tap <b>Choose sync folder…</b>, pick that folder in Android's folder picker and tap <b>Use this folder</b> (then <b>Allow</b>). Pocket-Canvas can use that folder only.</li>
      </ol>
      <p class="muted small">Boards from each device are combined, never overwritten. Changes to the same card on two devices: the most recent change wins. Pictures and files sync too.</p>
      <button class="primary-btn" data-sync="choose">Choose sync folder…</button>`;
  }
  if (!st.enabled) {
    return `
      <p>Keep your boards the same on all your computers by saving them in a folder that a sync service keeps up to date, such as
      <b>Dropbox</b>, <b>OneDrive</b>, <b>Google Drive</b>, <b>iCloud Drive</b>, <b>Nextcloud</b> or <b>Syncthing</b>.</p>
      <ol class="steps">
        <li>Install your sync service on each computer, if it isn’t already.</li>
        <li>Click <b>Choose sync folder…</b> and pick a folder inside it, for example <i>Dropbox</i>. Pocket-Canvas makes a <i>Pocket-Canvas Sync</i> folder there.</li>
        <li>On your other computers, do the same and choose the <b>same</b> folder.</li>
      </ol>
      <p class="muted small">Boards from each computer are combined, never overwritten. Changes to the same card on two computers: the most recent change wins. Pictures and files sync too.</p>
      <button class="primary-btn" data-sync="choose">Choose sync folder…</button>`;
  }
  const devices = st.devices.length
    ? st.devices.map((d) => `<li><b>${esc(d.name)}</b> <span class="muted">· last change ${esc(timeAgo(d.savedAt))}</span></li>`).join('')
    : '<li class="muted">None yet. Set up sync on another computer and choose this same folder.</li>';
  return `
    <div class="sync-banner ${st.ok ? 'ok' : 'bad'}">${st.ok ? '✓ Sync is on' : '⚠ ' + esc(st.error || 'Sync has a problem')}</div>
    <div class="kv"><span>Folder</span><span class="path">${esc(st.folder)}</span></div>
    <div class="kv"><span>${api.mobile ? 'This device' : 'This computer'}</span><span>${esc(s.deviceName)}${st.lastWrite ? ` <span class="muted">· saved ${esc(timeAgo(st.lastWrite))}</span>` : ''}</span></div>
    <div class="kv"><span>Other devices</span><ul class="devices">${devices}</ul></div>
    <div class="btn-row">
      <button class="ghost-btn" data-sync="now">Sync now</button>
      ${api.mobile ? '' : '<button class="ghost-btn" data-sync="open">Open folder</button>'}
      <button class="ghost-btn" data-sync="choose">Change folder…</button>
      <button class="ghost-btn danger" data-sync="off">Stop syncing</button>
    </div>
    <p class="muted small">Stopping keeps all your boards on this computer; it just stops sharing changes.</p>`;
}

function clipperPane(s) {
  const c = s.clipper, st = s.clipperStatus || {};
  const status = !c.enabled ? '<span class="muted">Turned off</span>'
    : st.running ? `<span class="ok-text">✓ Ready on this computer (port ${st.port})</span>`
      : `<span class="bad-text">⚠ ${esc(st.error || 'Not running')}</span>`;
  return `
    <p>The Pocket-Canvas browser extension saves web pages, pictures, videos, sounds and selected text from your browser straight onto a board. It works in Chrome, Edge, Brave, Opera, Vivaldi and Firefox.</p>
    <label class="check"><input type="checkbox" data-clip="enabled" ${c.enabled ? 'checked' : ''}>
      <span><b>Allow the browser extension to connect</b><br><small>It can only connect from this computer, and only after you approve it.</small></span></label>
    <div class="kv"><span>Status</span><span>${status}</span></div>
    <div class="kv"><span>Port</span><span><input class="port" data-clip="port" value="${esc(c.port)}" inputmode="numeric"> <button class="ghost-btn" data-clip="save-port">Change</button><br><small class="muted">Only change this if another program uses ${esc(c.port)}. Set the same number in the extension’s options.</small></span></div>
    <div class="kv"><span>Connected browsers</span><ul class="devices">${c.browsers.length ? c.browsers.map((b) => `<li><b>${esc(b.name)}</b> <span class="muted">· since ${esc(new Date(b.created).toLocaleDateString())}</span> <button class="link-btn danger" data-forget="${esc(b.id)}">Disconnect</button></li>`).join('') : '<li class="muted">None yet. In the extension, click <b>Connect</b>; Pocket-Canvas will ask you to allow it.</li>'}</ul></div>
    <details class="howto"><summary>How to install the extension</summary>
      <ul>
        <li><b>From your browser’s add-on store:</b> search for “Pocket-Canvas”.</li>
        <li><b>Chrome, Edge, Brave, Opera, Vivaldi without a store:</b> unzip the extension, open <code>chrome://extensions</code> (or <code>edge://extensions</code>), turn on <b>Developer mode</b>, click <b>Load unpacked</b> and choose the unzipped folder.</li>
        <li><b>Firefox without a store:</b> open <code>about:debugging</code> › <b>This Firefox</b> › <b>Load Temporary Add-on</b> and choose the extension’s <code>manifest.json</code>. (Firefox removes temporary add-ons when it closes; for a permanent install use the signed version.)</li>
      </ul>
      <p class="muted small">Full instructions are in the User Guide.</p>
    </details>`;
}

function bindSettings(body, s) {
  body.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { settingsTab = b.dataset.tab; renderSettings(); }; });
  body.querySelectorAll('input[data-set]').forEach((inp) => {
    inp.addEventListener('change', async () => {
      const key = inp.dataset.set;
      const val = inp.type === 'checkbox' ? inp.checked : inp.value;
      settingsCache = await api.setSettings({ [key]: val });
      if (key === 'userName') refreshComments();
      toast('Saved');
    });
  });
  body.querySelectorAll('[data-sync]').forEach((b) => {
    b.onclick = async () => {
      const act = b.dataset.sync;
      if (act === 'choose') {
        await flushSave();
        const r = await api.syncChoose();
        if (r && r.error) toast(r.error);
        else if (r && !r.canceled) toast('Sync is on. Changes from your other computers will appear in a few seconds.');
      }
      if (act === 'now') { await flushSave(); await api.syncNow(); toast('Checking for changes…'); }
      if (act === 'open') api.syncOpen();
      if (act === 'off') {
        if (!(await api.confirm('Stop syncing on this computer?', 'Your boards stay on this computer. Other computers keep their copies.'))) return;
        await api.syncDisable();
      }
      renderSettings();
      updateSyncLabel();
    };
  });
  const enabled = body.querySelector('[data-clip="enabled"]');
  if (enabled) enabled.onchange = async () => { settingsCache = await api.setSettings({ clipper: { enabled: enabled.checked } }); renderSettings(); };
  const savePort = body.querySelector('[data-clip="save-port"]');
  if (savePort) savePort.onclick = async () => {
    const port = parseInt(body.querySelector('[data-clip="port"]').value, 10);
    if (!(port >= 1024 && port <= 65535)) { toast('Choose a port number between 1024 and 65535'); return; }
    settingsCache = await api.setSettings({ clipper: { port } });
    renderSettings();
  };
  body.querySelectorAll('[data-forget]').forEach((b) => {
    b.onclick = async () => { await api.forgetBrowser(b.dataset.forget); renderSettings(); };
  });
}

// ---------- Sync status in the top bar ----------
function updateSyncLabel() {
  const el = $('#sync-state');
  if (!el) return;
  if (!syncStatus.enabled) { el.hidden = true; return; }
  el.hidden = false;
  el.classList.toggle('bad', !syncStatus.ok);
  el.textContent = syncStatus.ok ? 'Synced' : 'Sync problem';
  const others = (syncStatus.devices || []).map((d) => `${d.name} (${timeAgo(d.savedAt)})`).join(', ');
  el.title = syncStatus.ok ? `Syncing through ${syncStatus.folder}${others ? '\nOther computers: ' + others : ''}` : syncStatus.error || '';
}

// ---------- Spelling ----------
const langName = (code) => {
  try { return new Intl.DisplayNames(['en-GB'], { type: 'language' }).of(code) || code; } catch { return code; }
};

function spellingPane(sp) {
  const avail = (sp.available && sp.available.length ? sp.available : ['en-GB', 'en-US']).slice().sort((a, b) => langName(a).localeCompare(langName(b)));
  const opts = (sel, withNone) => (withNone ? '<option value="">None</option>' : '') + avail.map((l) => `<option value="${esc(l)}" ${l === sel ? 'selected' : ''}>${esc(langName(l))}</option>`).join('');
  return `
    <label class="check"><input type="checkbox" data-spell="enabled" ${sp.enabled ? 'checked' : ''}>
      <span><b>Check spelling as I type</b><br><small>Misspelt words are underlined in red. <b>Right-click</b> one for suggestions, or to add it to your dictionary.</small></span></label>
    ${sp.platform === 'darwin'
      ? '<p class="muted small">On a Mac, Pocket-Canvas uses the languages chosen in System Settings › Keyboard › Text Input.</p>'
      : `<div class="kv"><span>Language</span><span><select data-spell="lang1">${opts(sp.languages[0] || 'en-GB')}</select></span></div>
         <div class="kv"><span>Also check</span><span><select data-spell="lang2">${opts(sp.languages[1] || '', true)}</select><br><small class="muted">Useful if you write in two languages.</small></span></div>
         <p class="muted small">The first time you use a language, its dictionary may be downloaded, which needs an internet connection.</p>`}
    <div class="kv"><span>Your dictionary</span><span>${sp.words.length
      ? `<ul class="devices words">${sp.words.map((w) => `<li>${esc(w)} <button class="link-btn danger" data-word="${esc(w)}">Remove</button></li>`).join('')}</ul>`
      : '<span class="muted">No words added yet. Right-click an underlined word › <b>Add to dictionary</b>.</span>'}</span></div>`;
}

function bindSpelling(body) {
  const en = body.querySelector('[data-spell="enabled"]');
  if (!en) return;
  en.onchange = async () => { await api.spellSet({ enabled: en.checked }); toast(en.checked ? 'Spell checking on' : 'Spell checking off'); };
  const l1 = body.querySelector('[data-spell="lang1"]'), l2 = body.querySelector('[data-spell="lang2"]');
  const saveLangs = async () => {
    const langs = [l1.value, l2.value].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
    await api.spellSet({ languages: langs });
    toast('Spelling language saved');
  };
  if (l1) l1.onchange = saveLangs;
  if (l2) l2.onchange = saveLangs;
  body.querySelectorAll('[data-word]').forEach((b) => { b.onclick = async () => { await api.spellRemoveWord(b.dataset.word); renderSettings(); }; });
}

// ---------- Backups ----------
function snapLabel(name) {
  const m = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/.exec(name);
  if (!m) return name;
  const d = new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function backupsPane(st) {
  const every = [['hour', 'Every hour'], ['day', 'Every day'], ['week', 'Every week'], ['manual', 'Only when I click “Back up now”']];
  return `
    <p>Pocket-Canvas keeps copies of all your boards in a backup folder, so you can go back to an earlier day. For the best protection, choose a folder on another drive, a USB stick or a cloud folder.</p>
    ${st.error ? `<div class="sync-banner bad">⚠ ${esc(st.error)}</div>` : ''}
    <label class="check"><input type="checkbox" data-bk="enabled" ${st.enabled ? 'checked' : ''}><span><b>Back up automatically</b></span></label>
    <div class="kv"><span>How often</span><span><select data-bk="every" ${st.enabled ? '' : 'disabled'}>${every.map(([v, n]) => `<option value="${v}" ${v === st.every ? 'selected' : ''}>${n}</option>`).join('')}</select></span></div>
    <div class="kv"><span>Keep</span><span><input class="port" data-bk="keep" value="${esc(st.keep)}" inputmode="numeric"> most recent backups <small class="muted">(older ones are deleted)</small></span></div>
    <div class="kv"><span>Folder</span><span class="path">${esc(st.folder)}</span></div>
    <div class="kv"><span>Last backup</span><span>${st.last ? esc(timeAgo(st.last)) : '<span class="muted">Not yet</span>'}</span></div>
    <div class="btn-row">
      <button class="primary-btn" data-bk="now">Back up now</button>
      <button class="ghost-btn" data-bk="choose">Change folder…</button>
      <button class="ghost-btn" data-bk="open">Open folder</button>
    </div>
    <h3 class="set-h">Restore from a backup</h3>
    ${st.snapshots.length
      ? `<ul class="snaps">${st.snapshots.map((x) => `<li><span>${esc(snapLabel(x.name))}</span><span class="muted small">${esc(fmtSize(x.size))}</span><button class="ghost-btn" data-restore="${esc(x.name)}">Restore</button></li>`).join('')}</ul>
         ${st.count > st.snapshots.length ? `<p class="muted small">Showing the newest ${st.snapshots.length} of ${st.count}.</p>` : ''}`
      : '<p class="muted">No backups in this folder yet.</p>'}
    <p class="muted small">Backups include every board, template and the Recycle bin. Locked boards stay encrypted. Pictures and files are kept once in the folder and shared between backups, so they don’t take up space repeatedly.</p>`;
}

function bindBackups(body) {
  const q = (k) => body.querySelector(`[data-bk="${k}"]`);
  if (!q('now')) return;
  q('enabled').onchange = async () => { await api.backupSet({ enabled: q('enabled').checked }); renderSettings(); };
  q('every').onchange = async () => { await api.backupSet({ every: q('every').value }); toast('Saved'); };
  q('keep').onchange = async () => {
    const n = parseInt(q('keep').value, 10);
    if (!(n >= 1 && n <= 1000)) { toast('Choose a number from 1 to 1000'); return; }
    await api.backupSet({ keep: n }); toast('Saved');
  };
  q('now').onclick = async () => {
    q('now').disabled = true; q('now').textContent = 'Backing up…';
    await flushSave();
    const r = await api.backupNow();
    toast(r && r.ok ? 'Backup saved' : (r && r.error) || 'Backup failed');
    renderSettings();
  };
  q('choose').onclick = async () => {
    await flushSave();
    const r = await api.backupChoose();
    if (r && r.error) toast(r.error);
    else if (r && !r.canceled) toast('Backups will be saved there from now on');
    setTimeout(renderSettings, 400);
  };
  q('open').onclick = () => api.backupOpen();
  body.querySelectorAll('[data-restore]').forEach((b) => {
    b.onclick = async () => {
      const when = snapLabel(b.dataset.restore);
      if (!(await api.confirm(`Restore your boards as they were on ${when}?`,
        'All your boards will be replaced with that backup. A backup of your boards as they are now is made first, so you can come back. If you use sync, your other computers will get the restored boards too.'))) return;
      await flushSave();
      const r = await api.backupRead(b.dataset.restore);
      if (r.error) { toast('Couldn’t restore: ' + r.error); return; }
      checkpoint();
      unlocked.clear();
      store = migrate(r.data);
      cur = store.root;
      clearSelection();
      render(); flushSave();
      if (settingsModal) settingsModal.close();
      toast(`Restored the backup from ${when}`);
    };
  });
}

// ---------- Pocket-Canvas Server ----------
function serverPane(st) {
  if (!st.on) {
    return `
      <p>Run your own <b>Pocket-Canvas Server</b> (for example on a home server or a small cloud machine) to keep your boards in step on all your devices without a sync folder, and to <b>share boards with other people</b> and edit them together. How to set one up is in the Developer Guide (server/README.md).</p>
      <form class="form server-form">
        <label class="field"><span>Server address</span><input name="url" placeholder="https://boards.example.com" value="${esc(st.url)}" autocomplete="url"></label>
        <label class="field"><span>Your name on the server</span><input name="name" autocomplete="username" spellcheck="false"></label>
        <label class="field"><span>Password <small>at least 8 characters</small></span><input name="password" type="password" autocomplete="current-password"></label>
        <label class="field join"><span>Join code <small>only to create a new account; ask whoever runs the server</small></span><input name="joinCode" autocomplete="off" spellcheck="false"></label>
        <div class="form-error" hidden></div>
        <div class="btn-row">
          <button type="button" class="primary-btn" data-srv="signin">Sign in</button>
          <button type="button" class="ghost-btn" data-srv="register">Create account</button>
        </div>
      </form>`;
  }
  const label = { online: '✓ Connected', connecting: 'Connecting…', offline: '⚠ Offline', error: '⚠ Please sign in again' }[st.state] || st.state;
  const spaces = st.spaces.length
    ? st.spaces.map((sp) => `<li><b>${esc(sp.title)}</b> <span class="muted">· ${sp.members.map((m) => esc(m.display || m.name)).join(', ')}</span></li>`).join('')
    : '<li class="muted">None yet. Right-click a board › <b>Share with people…</b></li>';
  return `
    <div class="sync-banner ${st.state === 'online' ? 'ok' : 'bad'}">${label}${st.error && st.state !== 'online' ? ' — ' + esc(st.error) : ''}</div>
    <div class="kv"><span>Server</span><span class="path">${esc(st.url)}</span></div>
    <div class="kv"><span>Signed in as</span><span>${esc(st.user ? st.user.display || st.user.name : '')}</span></div>
    ${api.web ? '<p class="muted small">In a web browser your boards always stay in step through this server, with your other devices signed in as you.</p>' : `<label class="check"><input type="checkbox" data-srv="personal" ${st.personal ? 'checked' : ''}>
      <span><b>Keep all my boards in step through this server</b><br><small>Your other devices signed in as you get every change. You can use this instead of, or as well as, a sync folder.</small></span></label>`}
    <div class="kv"><span>Shared boards</span><ul class="devices">${spaces}</ul></div>
    <div class="btn-row">
      <button class="ghost-btn" data-srv="reconnect">Reconnect</button>
      <button class="ghost-btn danger" data-srv="signout">Sign out</button>
    </div>`;
}
function bindServer(body) {
  const form = body.querySelector('.server-form');
  const err = form && form.querySelector('.form-error');
  body.querySelectorAll('[data-srv]').forEach((el) => {
    const act = el.dataset.srv;
    if (act === 'personal') {
      el.onchange = async () => { settingsCache = await api.setSettings({ server: { ...serverCfg(), personal: el.checked } }); SRV.sent.clear(); flushSave(); toast('Saved'); };
      return;
    }
    el.onclick = async () => {
      if (act === 'signin' || act === 'register') {
        const v = (n) => form.elements[n].value.trim();
        err.hidden = true;
        if (act === 'register' && !v('joinCode')) { err.textContent = 'To create an account, type the server’s join code.'; err.hidden = false; return; }
        el.disabled = true;
        try {
          const u = await serverSignIn(v('url'), v('name'), form.elements.password.value, act === 'register' ? v('joinCode') : '');
          toast(`Signed in as ${u.display || u.name}`);
          renderSettings();
        } catch (e) { err.textContent = e.message; err.hidden = false; } finally { el.disabled = false; }
      }
      if (act === 'reconnect') { SRV.retry = 0; serverConnect(); }
      if (act === 'signout') {
        if (!(await api.confirm('Sign out of the server?', 'Your boards stay on this device. Shared boards stop updating until you sign in again.'))) return;
        await serverSignOut(); renderSettings();
      }
    };
  });
}
