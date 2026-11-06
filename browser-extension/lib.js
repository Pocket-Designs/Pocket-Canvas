/* Pocket-Canvas Web Clipper — talking to the Pocket-Canvas app on this computer
 * Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
 *
 * Works in Chrome, Edge, Brave, Opera, Vivaldi (chrome.*) and Firefox (browser.*).
 * Everything goes to http://127.0.0.1 — your own computer. Nothing is sent anywhere else.
 */
'use strict';

const ext = globalThis.browser ?? globalThis.chrome;
const DEFAULT_PORT = 47652;

const PC = {
  async cfg() {
    const c = await ext.storage.local.get(['port', 'token', 'boardId']);
    return { port: c.port || DEFAULT_PORT, token: c.token || null, boardId: c.boardId || '' };
  },

  set(values) { return ext.storage.local.set(values); },

  async call(method, path, body, timeout = 30000) {
    const c = await PC.cfg();
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeout);
    let res;
    try {
      res = await fetch(`http://127.0.0.1:${c.port}${path}`, {
        method,
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(c.token ? { Authorization: 'Bearer ' + c.token } : {})
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctl.signal
      });
    } catch {
      const e = new Error('Can’t reach Pocket-Canvas. Make sure the app is open on this computer.');
      e.status = 0;
      throw e;
    } finally {
      clearTimeout(timer);
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = new Error(json.error || `Pocket-Canvas answered ${res.status}`);
      e.status = res.status;
      throw e;
    }
    return json;
  },

  status() { return PC.call('GET', '/status', null, 4000); },

  async pair() {
    // Firefox may ask the user to allow talking to this computer first.
    try {
      if (ext.permissions && ext.permissions.request) {
        await ext.permissions.request({ origins: ['http://127.0.0.1/*'] });
      }
    } catch {}
    const j = await PC.call('POST', '/pair', { browser: PC.browserName() }, 180000);
    await PC.set({ token: j.token });
    return j;
  },

  async forget() { await ext.storage.local.remove('token'); },

  async boards() { return (await PC.call('GET', '/boards')).boards || []; },

  clip(data) { return PC.call('POST', '/clip', data, 180000); },

  browserName() {
    const ua = navigator.userAgent;
    if (/Edg\//.test(ua)) return 'Microsoft Edge';
    if (/OPR\//.test(ua)) return 'Opera';
    if (/Vivaldi/.test(ua)) return 'Vivaldi';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (navigator.brave) return 'Brave';
    if (/Chrome\//.test(ua)) return 'Chrome';
    return 'Browser';
  }
};
