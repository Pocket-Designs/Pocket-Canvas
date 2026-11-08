// Hidden host page: one HostPeer per incoming session. All decisions (passwords, permissions,
// what is allowed) are made in the main process; this page only runs WebRTC and screen capture.
(function () {
  'use strict';
  const peers = new Map();
  const pending = new Map(); // signals that arrive before the peer exists

  const bridge = {
    sendSignal: (sid, data) => pc.invoke('host:signal', sid, data),
    info: (sid) => pc.invoke('host:info', sid),
    verify: (sid, payload) => pc.invoke('host:verify', sid, payload),
    pickDisplay: (sid, id) => pc.invoke('host:pick-display', sid, id),
    input: (sid, arr) => pc.invoke('host:input', sid, arr),
    termOpen: (sid, opts) => pc.invoke('host:term-open', sid, opts),
    termWrite: (sid, d) => pc.invoke('host:term-write', sid, d),
    termResize: (sid, c, r) => pc.invoke('host:term-resize', sid, c, r),
    termClose: (sid) => pc.invoke('host:term-close', sid),
    clipSet: (sid, text) => pc.invoke('host:clip-set', sid, text),
    androidList: (sid) => pc.invoke('host:android-list', sid),
    androidStart: (sid, serial, opts) => pc.invoke('host:android-start', sid, serial, opts),
    androidOpts: (sid, opts) => pc.invoke('host:android-opts', sid, opts),
    androidStop: (sid) => pc.invoke('host:android-stop', sid),
    closed: (sid) => {
      peers.delete(sid);
      pending.delete(sid);
      pc.invoke('host:closed', sid);
    },
  };

  pc.on('host:create', (sid, ice) => {
    if (peers.has(sid)) return;
    const peer = new PCProto.HostPeer(sid, ice, bridge);
    peers.set(sid, peer);
    for (const d of pending.get(sid) || []) peer.onSignal(d);
    pending.delete(sid);
  });

  pc.on('host:signal', (sid, data) => {
    const peer = peers.get(sid);
    if (peer) return peer.onSignal(data);
    if (!pending.has(sid)) pending.set(sid, []);
    pending.get(sid).push(data);
    setTimeout(() => pending.delete(sid), 30_000);
  });

  pc.on('host:kick', (sid) => {
    const peer = peers.get(sid);
    if (peer) peer.close();
    else bridge.closed(sid);
  });

  pc.on('host:waiting', (sid) => peers.get(sid)?.send({ t: 'waiting' }));
  pc.on('host:term-data', (sid, d) => peers.get(sid)?.termData(d));
  pc.on('host:term-exit', (sid, code) => peers.get(sid)?.send({ t: 'term-exit', code }));
  pc.on('host:clip', (text) => {
    for (const p of peers.values()) p.sendClipboard(text);
  });
  pc.on('host:android-frame', (sid, jpeg, size) => peers.get(sid)?.androidFrame(new Uint8Array(jpeg), size));
  pc.on('host:android-error', (sid, text) => peers.get(sid)?.send({ t: 'android-error', text }));
})();
