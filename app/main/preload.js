// The only bridge between web pages and the main process. Pages get a small, fixed list of
// channels; the main process also checks which window each call came from.
const { contextBridge, ipcRenderer } = require('electron');

const INVOKE = /^(app|host|settings|server|account|book|lan|connect|session|open-external|copy|android|viewer|bar):?[\w-]*$/;
const EVENTS = new Set([
  'state', 'sessions', 'activity', 'book-changed',
  'host:create', 'host:waiting', 'host:signal', 'host:kick', 'host:term-data', 'host:term-exit', 'host:clip', 'host:android-frame', 'host:android-error',
  'viewer:signal', 'viewer:android-frame', 'viewer:android-error', 'viewer:term-data', 'viewer:term-exit',
]);

contextBridge.exposeInMainWorld('pc', {
  invoke(channel, ...args) {
    if (!INVOKE.test(channel)) return Promise.reject(new Error(`Unknown channel ${channel}`));
    return ipcRenderer.invoke(channel, ...args);
  },
  on(channel, fn) {
    if (!EVENTS.has(channel)) throw new Error(`Unknown event ${channel}`);
    const wrapped = (_e, ...args) => fn(...args);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
  platform: process.platform,
});
