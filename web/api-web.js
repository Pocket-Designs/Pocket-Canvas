/* Pocket-Canvas in a web browser — served by your Pocket-Canvas Server.
 * The same `window.api` the desktop app gets from preload.js, built on the server instead of the computer.
 * Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
 *
 * The browser is just another of your devices:
 *  - it signs in to the server it was opened from, and keeps a copy of your boards in the browser
 *    (IndexedDB) so a reload is quick and nothing typed is lost if the connection drops;
 *  - on opening, it starts from the latest copies your other devices left on the server,
 *    then stays in step live, exactly like the desktop and phone apps;
 *  - pictures and files are stored on the server and shown straight from it.
 */
'use strict';

(function () {
  if (window.api) return;
  const VERSION = '__VERSION__';
  const ORIGIN = location.origin;
  const ASSET_ID = /^[0-9a-f]{16}\.[a-z0-9]{1,10}$/;
  const LS = { session: 'pc-web-session', device: 'pc-web-device' };

  // ---------- small helpers ----------
  const listeners = {};
  const on = (ch) => (fn) => { (listeners[ch] = listeners[ch] || []).push(fn); };
  const emit = (ch, payload) => (listeners[ch] || []).forEach((fn) => { try { fn(payload); } catch (e) { console.error(e); } });
  const rand = (n = 8) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const extOf = (name) => ((/\.[a-z0-9]{1,8}$/i.exec(name || '') || ['.bin'])[0]).toLowerCase();
  const newAssetId = (name) => rand(8) + extOf(name);
  const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- the copy kept in this browser (IndexedDB) ----------
  const idb = (() => {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((resolve, reject) => {
      const r = indexedDB.open('pocket-canvas', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    }));
    const tx = async (mode, fn) => { const db = await open(); return new Promise((resolve, reject) => { const t = db.transaction('kv', mode); const req = fn(t.objectStore('kv')); t.oncomplete = () => resolve(req && req.result); t.onerror = () => reject(t.error); }); };
    return {
      get: (k) => tx('readonly', (s) => s.get(k)).catch(() => null),
      set: (k, v) => tx('readwrite', (s) => s.put(v, k)).catch(() => null),
      del: (k) => tx('readwrite', (s) => s.delete(k)).catch(() => null)
    };
  })();

  // ---------- this browser's identity ----------
  let device = lsGet(LS.device);
  if (!device || !/^[\w-]{4,64}$/.test(device.id)) {
    const ua = navigator.userAgent;
    const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'a browser';
    const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '';
    device = { id: 'web-' + rand(8), name: `Web (${browser}${os ? ' on ' + os : ''})` };
    lsSet(LS.device, device);
  }
  let session = lsGet(LS.session); // { token, user }
  const dataKey = () => 'data:' + (session && session.user ? session.user.id : 'none');
  const settings = Object.assign({ userName: '', deviceName: device.name, linkPreviews: true }, lsGet('pc-web-settings') || {});

  async function srv(path, opts = {}) {
    const res = await fetch(ORIGIN + path, {
      ...opts,
      headers: { ...(opts.json ? { 'Content-Type': 'application/json' } : {}), ...(session ? { Authorization: 'Bearer ' + session.token } : {}), ...(opts.headers || {}) },
      body: opts.json ? JSON.stringify(opts.json) : opts.body
    });
    const isJson = (res.headers.get('content-type') || '').includes('json');
    const body = isJson ? await res.json() : res;
    if (res.status === 401 && session && !opts.signingIn) { signedOut('Please sign in again.'); throw new Error('Signed out'); }
    if (!res.ok) throw new Error((isJson && body && body.error) || 'The server answered ' + res.status);
    return body;
  }
  function signedOut(why) {
    lsSet(LS.session, null);
    if (why) try { sessionStorage.setItem('pc-web-signin-msg', why); } catch {}
    location.reload();
  }

  // ---------- the sign-in screen ----------
  const signedIn = new Promise((resolve) => {
    if (session && session.token) { resolve(); return; }
    const show = async () => {
      let info = {};
      try { info = await (await fetch(ORIGIN + '/health')).json(); } catch {}
      let msg = ''; try { msg = sessionStorage.getItem('pc-web-signin-msg') || ''; sessionStorage.removeItem('pc-web-signin-msg'); } catch {}
      const wrap = document.createElement('div');
      wrap.id = 'web-signin';
      wrap.innerHTML = `
        <form class="ws-card" autocomplete="on">
          <img src="icon.png" alt="" class="ws-logo">
          <h1>Pocket-Canvas</h1>
          <p class="ws-sub">Sign in to your boards on <b>${escHtml(location.host)}</b></p>
          <label><span>Your name</span><input name="name" autocomplete="username" spellcheck="false" required></label>
          <label><span>Password</span><input name="password" type="password" autocomplete="current-password" required minlength="8"></label>
          <label class="ws-join" hidden><span>Join code <small>ask whoever runs this server</small></span><input name="joinCode" autocomplete="off" spellcheck="false"></label>
          <div class="ws-error" ${msg ? '' : 'hidden'}>${escHtml(msg)}</div>
          <button class="ws-go" type="submit">Sign in</button>
          ${info.signUp ? '<button class="ws-switch" type="button">New here? Create an account</button>' : ''}
          <p class="ws-foot">Pocket-Canvas ${escHtml(VERSION)} · You can also use the desktop, Android and iPhone apps with the same account.</p>
        </form>`;
      document.body.appendChild(wrap);
      document.documentElement.classList.add('web-signing-in');
      const f = wrap.querySelector('form');
      let creating = false;
      const sw = wrap.querySelector('.ws-switch');
      if (sw) sw.onclick = () => {
        creating = !creating;
        wrap.querySelector('.ws-join').hidden = !creating;
        wrap.querySelector('.ws-go').textContent = creating ? 'Create account' : 'Sign in';
        sw.textContent = creating ? 'Already have an account? Sign in' : 'New here? Create an account';
        f.password.autocomplete = creating ? 'new-password' : 'current-password';
      };
      f.name.focus();
      f.onsubmit = async (e) => {
        e.preventDefault();
        const err = wrap.querySelector('.ws-error');
        err.hidden = true;
        const go = wrap.querySelector('.ws-go'); go.disabled = true;
        try {
          const body = await srv(creating ? '/api/register' : '/api/login', {
            method: 'POST', signingIn: true,
            json: { name: f.name.value.trim(), password: f.password.value, joinCode: creating ? f.joinCode.value.trim() : undefined, device: device.name, web: true }
          });
          session = { token: body.token, user: body.user };
          lsSet(LS.session, session);
          if (!settings.userName) settings.userName = body.user.display || body.user.name;
          wrap.remove();
          document.documentElement.classList.remove('web-signing-in');
          resolve();
        } catch (ex) {
          err.textContent = ex.message; err.hidden = false; go.disabled = false;
        }
      };
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show); else show();
  });

  // ---------- files ----------
  function chooseFiles(accept, multiple) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = accept || ''; input.multiple = !!multiple;
      input.style.display = 'none';
      input.onchange = () => { resolve([...input.files]); input.remove(); };
      window.addEventListener('focus', () => setTimeout(() => { if (!input.files.length) { resolve([]); input.remove(); } }, 800), { once: true });
      document.body.appendChild(input);
      input.click();
    });
  }
  async function upload(id, bytes) {
    await srv('/api/assets/' + id, { method: 'PUT', body: bytes instanceof Blob ? bytes : new Blob([bytes]) });
    return id;
  }
  function download(name, data, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: type || 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = String(name || 'download').replace(/[\\/:*?"<>|]+/g, '-');
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    return true;
  }

  // ---------- keyboard shortcuts (the desktop app's menu bar has these) ----------
  const KEYS = [
    ['B', true, 'add-board'], ['N', true, 'new-from-template'], ['E', true, 'export-visual'], [',', false, 'settings'],
    ['Z', false, 'undo'], ['Z', true, 'redo'], ['Y', false, 'redo'], ['D', false, 'duplicate'], ['A', false, 'select-all'], ['F', false, 'find'],
    ['M', true, 'comments'], ['=', false, 'zoom-in'], ['+', false, 'zoom-in'], ['-', false, 'zoom-out'], ['0', false, 'zoom-reset'], ['1', false, 'zoom-fit'],
    ['G', true, 'page-guides'], ['\\', false, 'toggle-sidebar'], ['L', true, 'toggle-theme']
  ];
  window.addEventListener('keydown', (e) => {
    if (document.documentElement.classList.contains('web-signing-in')) return;
    if (e.key === 'F1') { e.preventDefault(); emit('menu', 'help'); return; }
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    const hit = KEYS.find(([key, shift]) => key === k && shift === e.shiftKey) || (k === '+' && KEYS.find(([key]) => key === '+'));
    if (!hit) return;
    const typing = document.activeElement && (document.activeElement.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName));
    if (typing && ['undo', 'redo', 'select-all'].includes(hit[2])) return; // the browser does these itself while you type
    if (typing && ['duplicate', 'add-board'].includes(hit[2])) return;
    e.preventDefault();
    emit('menu', hit[2]);
  });

  // ---------- the API ----------
  window.api = {
    platform: 'web',
    web: true,
    mobile: false,
    load: async () => {
      await signedIn;
      let local = null;
      try { const t = await idb.get(dataKey()); if (t) local = JSON.parse(t); } catch {}
      let docs = [];
      try { docs = (await srv('/api/docs')).docs || []; } catch (err) { if (!local) console.warn('Couldn’t fetch your boards:', err.message); }
      if (!docs.length) return local;
      // start from this browser's copy, or the newest copy on the server, then add the rest
      let merged = local;
      for (const d of docs) {
        if (!merged) { merged = JSON.parse(JSON.stringify(d.state)); continue; }
        try { merged = PCSync.merge(merged, d.state).store; } catch (err) { console.warn(err); }
      }
      return merged;
    },
    save: async (json) => { await idb.set(dataKey(), json); return true; },
    ready: async () => true,

    assetBase: async () => { await signedIn; return ORIGIN + '/api/assets/'; },
    saveBytes: async (name, bytes) => upload(newAssetId(name), bytes),
    pickFiles: async (kind) => {
      const accept = kind === 'image' || kind === 'image-one' ? 'image/*' : kind === 'media' ? 'audio/*,video/*' : '';
      const files = await chooseFiles(accept, kind !== 'image-one');
      const out = [];
      for (const f of files) {
        try { out.push({ id: await upload(newAssetId(f.name), f), name: f.name, size: f.size }); }
        catch (err) { if (typeof toast === 'function') toast(`${f.name}: ${err.message}`); }
      }
      return out;
    },
    // pictures already live on the server, so there's nothing to copy back and forth
    readAsset: async (id) => {
      if (!ASSET_ID.test(String(id))) return null;
      try { const r = await fetch(ORIGIN + '/api/assets/' + id, { headers: { Authorization: 'Bearer ' + session.token } }); return r.ok ? new Uint8Array(await r.arrayBuffer()) : null; } catch { return null; }
    },
    writeAsset: async () => true,
    hasAssets: async () => [],
    openAsset: (id) => { if (ASSET_ID.test(String(id))) window.open(ORIGIN + '/api/assets/' + id, '_blank', 'noopener'); },
    saveAssetAs: async (id, name) => {
      if (!ASSET_ID.test(String(id))) return false;
      const r = await fetch(ORIGIN + '/api/assets/' + id, { headers: { Authorization: 'Bearer ' + session.token } });
      return r.ok ? download(name || id, await r.blob()) : false;
    },

    openLink: async (url) => { if (/^https?:\/\//i.test(url)) window.open(url, '_blank', 'noopener'); },
    linkPreview: async (url) => {
      if (settings.linkPreviews === false) return null;
      try { return await srv('/api/preview?url=' + encodeURIComponent(url)); } catch (err) { return { error: err.message }; }
    },

    saveText: async (defaultName, text) => download(defaultName || 'export.txt', text, /\.json$/i.test(defaultName || '') ? 'application/json' : 'text/plain;charset=utf-8'),
    openText: async () => {
      const [f] = await chooseFiles('.json,.md,.txt,application/json,text/*', false);
      return f ? f.text() : null;
    },
    confirm: (message, detail) => new Promise((resolve) => {
      if (typeof openModal !== 'function') { resolve(window.confirm(message + (detail ? '\n\n' + detail : ''))); return; }
      const body = document.createElement('div');
      body.innerHTML = `<p>${escHtml(detail || '')}</p>`;
      let answer = false;
      openModal({
        title: message, body,
        actions: [{ label: 'Cancel' }, { label: 'OK', primary: true, run: (close) => { answer = true; close(); } }],
        onClose: () => resolve(answer)
      });
    }),
    showFile: async () => {},

    // Pictures and PDFs are drawn inside the page (exportInPage in export-ui.js), then downloaded.
    exportVisual: async (opts) => {
      try {
        const r = await exportInPage(opts);
        const name = String(opts.title || 'Board').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) + '.' + r.ext;
        download(name, new Blob([r.bytes], { type: r.mime }));
        return { ok: true, width: r.width, height: r.height, pages: r.pages, landscape: r.landscape };
      } catch (err) { return { error: String((err && err.message) || err) }; }
    },
    exportReady: async () => {},
    exportData: async () => null,

    getSettings: async () => {
      await signedIn;
      return {
        ...settings, deviceId: device.id, deviceName: settings.deviceName || device.name,
        userName: settings.userName || (session && session.user ? session.user.display || session.user.name : ''),
        clipperStatus: {}, clipper: { enabled: false, tokens: [] }, version: VERSION, platform: 'web',
        server: { url: ORIGIN, token: session ? session.token : null, user: session ? session.user : null, personal: true }
      };
    },
    setSettings: async (patch) => {
      for (const [k, v] of Object.entries(patch || {})) if (['userName', 'deviceName', 'linkPreviews'].includes(k)) settings[k] = v;
      lsSet('pc-web-settings', { userName: settings.userName, deviceName: settings.deviceName, linkPreviews: settings.linkPreviews });
      if (patch && patch.server && !patch.server.token && session) {
        // signing out: forget this browser's copy too, then show the sign-in screen
        try { await fetch(ORIGIN + '/api/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + session.token } }); } catch {}
        await idb.del(dataKey());
        signedOut();
      }
      return window.api.getSettings();
    },
    forgetBrowser: async () => {},

    backupStatus: async () => ({ enabled: false, unsupported: true, snapshots: [] }),
    backupNow: async () => ({ error: 'Automatic backups to a folder are in the desktop app. Use “Save a backup of all boards…” to download one.' }),
    backupSet: async () => ({}), backupChoose: async () => ({ canceled: true }), backupOpen: async () => {}, backupRead: async () => null,
    onBackupStatus: on('backup:status'), onBackupDone: on('backup:done'),

    spellGet: async () => ({ enabled: true, languages: [], available: [], words: [] }),
    spellSet: async () => ({}), spellRemoveWord: async () => true,

    // sync folders aren't used in a browser: the server keeps everything in step
    syncStatus: async () => ({ enabled: false, folder: null, devices: [], unsupported: true }),
    syncChoose: async () => ({ error: 'In a web browser your boards stay in step through this server.' }),
    syncDisable: async () => ({ enabled: false }), syncNow: async () => ({ enabled: false }), syncOpen: async () => {},

    onMenu: on('menu'),
    onSyncIncoming: on('sync:incoming'),
    onSyncStatus: on('sync:status'),
    onAssetsArrived: on('assets:arrived'),
    onClip: on('clip:add'),
    clipDone: () => {},

    menu: (cmd) => emit('menu', cmd)
  };
  document.documentElement.classList.add('web');
  if (matchMedia('(pointer: coarse)').matches) document.documentElement.classList.add('mobile');
})();
