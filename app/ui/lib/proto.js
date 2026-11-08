// Pocket-Connect session protocol shared by the viewer (desktop and Android) and the host page.
// Runs in a browser context: uses WebRTC, WebCrypto and scrypt-js (vendor/scrypt.js).
(function (global) {
  'use strict';

  const SCRYPT = { N: 16384, r: 8, p: 1, dkLen: 32 }; // must match main/hostauth.js
  const enc = new TextEncoder();

  const b64 = {
    from(bytes) {
      let s = '';
      const arr = new Uint8Array(bytes);
      for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
      return btoa(s);
    },
    to(str) {
      const s = atob(str);
      const out = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
      return out;
    },
  };

  function randomB64(n = 16) {
    const a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return b64.from(a);
  }

  async function deriveKey(password, saltB64) {
    const pw = enc.encode(String(password).normalize('NFKC'));
    const key = await global.scrypt.scrypt(pw, b64.to(saltB64), SCRYPT.N, SCRYPT.r, SCRYPT.p, SCRYPT.dkLen);
    return new Uint8Array(key);
  }

  async function hmac(keyBytes, text) {
    const k = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(text)));
  }

  function transcript(role, nonce, vnonce, fpViewer, fpHost) {
    return `pc-auth-v1|${role}|${nonce}|${vnonce}|${fpViewer}|${fpHost}`;
  }

  // DTLS certificate fingerprint from an SDP blob, normalised.
  function fingerprint(sdp) {
    const m = /a=fingerprint:(\S+) ([0-9A-Fa-f:]+)/.exec(sdp || '');
    return m ? `${m[1].toLowerCase()} ${m[2].toUpperCase()}` : '';
  }

  function sameBytes(a, b) {
    if (a.length !== b.length) return false;
    let d = 0;
    for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
    return d === 0;
  }

  // Android screen frames travel on their own binary channel, split into chunks:
  // header (12 bytes): frame id u32 | chunk index u16 | chunk count u16 | width u16 | height u16
  const CHUNK = 60 * 1024;
  function splitFrame(id, bytes, w, h) {
    const count = Math.max(1, Math.ceil(bytes.length / CHUNK));
    const out = [];
    for (let i = 0; i < count; i++) {
      const part = bytes.subarray(i * CHUNK, (i + 1) * CHUNK);
      const buf = new Uint8Array(12 + part.length);
      const dv = new DataView(buf.buffer);
      dv.setUint32(0, id);
      dv.setUint16(4, i);
      dv.setUint16(6, count);
      dv.setUint16(8, Math.min(65535, w));
      dv.setUint16(10, Math.min(65535, h));
      buf.set(part, 12);
      out.push(buf);
    }
    return out;
  }
  class FrameJoiner {
    constructor(onFrame) {
      this.onFrame = onFrame;
      this.id = -1;
      this.parts = [];
    }
    push(data) {
      const buf = new Uint8Array(data);
      const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      const id = dv.getUint32(0);
      const idx = dv.getUint16(4);
      const count = dv.getUint16(6);
      if (id !== this.id) {
        this.id = id;
        this.parts = new Array(count);
        this.got = 0;
      }
      if (!this.parts[idx]) {
        this.parts[idx] = buf.subarray(12);
        this.got++;
      }
      if (this.got === count) {
        const total = this.parts.reduce((n, p) => n + p.length, 0);
        const all = new Uint8Array(total);
        let o = 0;
        for (const p of this.parts) {
          all.set(p, o);
          o += p.length;
        }
        this.onFrame(all, { width: dv.getUint16(8), height: dv.getUint16(10) });
        this.id = -1;
      }
    }
  }

  // Simple event emitter
  class Emitter {
    constructor() {
      this._h = {};
    }
    on(ev, fn) {
      (this._h[ev] = this._h[ev] || []).push(fn);
      return this;
    }
    emit(ev, ...args) {
      for (const fn of this._h[ev] || []) {
        try {
          fn(...args);
        } catch (e) {
          console.error(e);
        }
      }
    }
  }

  const QUALITY = {
    speed: { maxBitrate: 1_500_000, maxFramerate: 30, scale: 1.5 },
    balanced: { maxBitrate: 4_000_000, maxFramerate: 30, scale: 1 },
    quality: { maxBitrate: 10_000_000, maxFramerate: 30, scale: 1 },
  };

  // ---------------------------------------------------------------- Viewer
  // transport: { open(target, mode, onMessage) -> { send(msg), close() } }
  // keyStore: { get(target) -> {salt, key} | null, set(target, {salt, key}) }
  // askPassword(info) -> Promise<{ password, remember } | null>
  class ViewerSession extends Emitter {
    constructor({ transport, target, mode, askPassword, keyStore }) {
      super();
      this.target = target;
      this.mode = mode;
      this.transport = transport;
      this.askPassword = askPassword;
      this.keyStore = keyStore;
      this.sid = randomB64(12).replace(/[^A-Za-z0-9]/g, '');
      this.state = 'idle';
      this.attempts = 0;
    }

    status(state, detail) {
      this.state = state;
      this.emit('status', state, detail);
    }

    start() {
      this.status('calling');
      this.link = this.transport.open(this.target, this.mode, this.sid, (msg) => this.onSignal(msg));
      this.timer = setTimeout(() => {
        if (this.state === 'calling') this.fail('The device did not answer. Check it is switched on and Pocket-Connect is running.');
      }, 25_000);
    }

    fail(reason) {
      if (this.state === 'closed') return;
      this.emit('error', reason);
      this.close(reason);
    }

    async onSignal(msg) {
      if (msg.sid && msg.sid !== this.sid) return;
      if (msg.t === 'error') {
        const text = {
          offline: 'That device is offline or the ID is wrong.',
          rate_limited: 'Too many connection attempts. Wait a few minutes and try again.',
          bad_session: 'Could not start the session. Try again.',
          bad_token: 'Your sign-in has expired. Sign in again.',
          unreachable: 'Could not reach that address. Check the address and that port 47100 is open on the device.',
          server: 'Could not reach the Pocket-Connect server.',
          no_server: 'Connecting by ID needs a Pocket-Connect server. Add one under Account, or connect by IP address.',
          busy: 'That device already has the maximum number of sessions.',
        }[msg.code] || `Connection failed (${msg.code}).`;
        return this.fail(text);
      }
      if (msg.t === 'rejected') {
        return this.fail({
          mode: 'The device does not allow that type of connection.',
          off: 'That device has incoming connections switched off.',
          busy: 'That device already has the maximum number of sessions.',
        }[msg.reason] || 'The device declined the connection.');
      }
      if (msg.t === 'bye') return this.close('The other side ended the session.');
      if (msg.t === 'accepted') {
        clearTimeout(this.timer);
        this.hostInfo = msg.host || {};
        this.emit('host', this.hostInfo);
        return this.createPeer(msg.ice || []);
      }
      if (msg.t === 'signal' && this.pc) {
        const d = msg.data || {};
        try {
          if (d.sdp) await this.pc.setRemoteDescription(d.sdp);
          else if (d.cand) await this.pc.addIceCandidate(d.cand);
        } catch (e) {
          console.warn('signal', e);
        }
      }
    }

    async createPeer(iceServers) {
      this.status('securing');
      const pc = (this.pc = new RTCPeerConnection({ iceServers, bundlePolicy: 'max-bundle' }));
      this.ctl = pc.createDataChannel('ctl', { ordered: true });
      this.input = pc.createDataChannel('input', { ordered: true });
      this.term = pc.createDataChannel('term', { ordered: true });
      this.android = pc.createDataChannel('android', { ordered: true });
      this.android.binaryType = 'arraybuffer';
      const joiner = new FrameJoiner((bytes, size) => this.emit('android-frame', bytes, size));
      this.android.onmessage = (e) => joiner.push(e.data);
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.ontrack = (e) => this.emit('video', e.streams[0] || new MediaStream([e.track]));
      pc.onicecandidate = (e) => e.candidate && this.link.send({ t: 'signal', sid: this.sid, data: { cand: e.candidate.toJSON() } });
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') this.fail('The connection was lost. If the devices are on different networks, the server may need a TURN relay.');
        if (pc.connectionState === 'connected') this.reportRoute();
      };
      this.ctl.onmessage = (e) => this.onCtl(JSON.parse(e.data));
      this.term.onmessage = (e) => this.emit('term-data', e.data);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.link.send({ t: 'signal', sid: this.sid, data: { sdp: pc.localDescription.toJSON() } });
    }

    async reportRoute() {
      try {
        const stats = await this.pc.getStats();
        let pair;
        stats.forEach((s) => {
          if (s.type === 'transport' && s.selectedCandidatePairId) pair = stats.get(s.selectedCandidatePairId);
        });
        if (!pair) stats.forEach((s) => s.type === 'candidate-pair' && s.nominated && s.state === 'succeeded' && (pair = s));
        const local = pair && stats.get(pair.localCandidateId);
        const remote = pair && stats.get(pair.remoteCandidateId);
        const relayed = local?.candidateType === 'relay' || remote?.candidateType === 'relay';
        this.emit('route', relayed ? 'relay' : 'direct');
      } catch {}
    }

    sendCtl(obj) {
      if (this.ctl?.readyState === 'open') this.ctl.send(JSON.stringify(obj));
    }

    async onCtl(m) {
      if (m.t === 'hello') {
        this.hello = m;
        return this.authenticate();
      }
      if (m.t === 'auth-fail') {
        const stale = this.usedStored;
        if (stale) this.keyStore?.set(this.target, null);
        if (m.retryAfter) return this.fail(`Too many wrong passwords. The device is locked for ${m.retryAfter} seconds.`);
        if (m.left <= 0) return this.fail('Wrong password.');
        return this.authenticate(stale ? 'The saved password no longer works (it was probably changed). Enter the current one.' : 'That password was not accepted. Try again.');
      }
      if (m.t === 'auth-ok') {
        if (this.key) {
          const expect = await hmac(this.key, transcript('host', this.hello.nonce, this.vnonce, this.fpViewer, this.fpHost));
          if (!sameBytes(expect, b64.to(m.hostProof || ''))) {
            return this.fail('Security check failed: the device could not prove it knows the password. The connection was closed.');
          }
          if (this.rememberKey) this.keyStore?.set(this.target, { salt: this.hello.salt, key: b64.from(this.key) });
        }
        this.features = m.features;
        this.displays = m.displays || [];
        this.shells = m.shells || [];
        this.androidDevices = m.android || [];
        this.status('connected', { which: m.which });
        this.emit('ready', m);
        return;
      }
      if (m.t === 'waiting') return this.status('waiting');
      if (m.t === 'denied') return this.fail('The person at the device declined the connection.');
      if (m.t === 'clip') return this.emit('clipboard', m.text);
      if (m.t === 'screen') return this.emit('screen', m);
      if (m.t === 'displays') {
        this.displays = m.displays;
        return this.emit('displays', m.displays);
      }
      if (m.t === 'term-exit') return this.emit('term-exit', m.code);
      if (m.t === 'term-ready') return this.emit('term-ready', m);
      if (m.t === 'notice') return this.emit('notice', m.text);
      if (m.t === 'android-list') return this.emit('android-list', m.devices || []);
      if (m.t === 'android-error') return this.emit('android-error', m.text);
      if (m.t === 'bye') return this.close(m.reason || 'The other side ended the session.');
    }

    async authenticate(retryNote) {
      const h = this.hello;
      this.fpViewer = fingerprint(this.pc.localDescription?.sdp);
      this.fpHost = fingerprint(this.pc.remoteDescription?.sdp);
      this.vnonce = randomB64(16);
      this.key = null;
      this.usedStored = false;
      if (h.needPassword) {
        const stored = !retryNote && this.keyStore?.get(this.target);
        if (stored && stored.salt === h.salt) {
          this.key = b64.to(stored.key);
          this.usedStored = true;
        } else {
          this.status('password');
          const ans = await this.askPassword({ host: h.host, note: retryNote });
          if (!ans) return this.close('Cancelled.');
          this.status('checking');
          this.key = await deriveKey(ans.password, h.salt);
          this.rememberKey = !!ans.remember;
        }
      }
      const proof = this.key ? b64.from(await hmac(this.key, transcript('viewer', h.nonce, this.vnonce, this.fpViewer, this.fpHost))) : '';
      this.sendCtl({ t: 'auth', vnonce: this.vnonce, proof });
    }

    // ---- actions
    startDesktop(display, quality) {
      this.sendCtl({ t: 'start-desktop', display, quality });
    }
    setDisplay(id) {
      this.sendCtl({ t: 'display', id });
    }
    setQuality(q) {
      this.sendCtl({ t: 'quality', q });
    }
    sendClipboard(text) {
      this.sendCtl({ t: 'clip', text: String(text).slice(0, 100_000) });
    }
    sendInput(arr) {
      if (this.input?.readyState === 'open') this.input.send(JSON.stringify(arr));
    }
    openTerminal(cols, rows, shell, androidSerial) {
      this.sendCtl({ t: 'term-open', cols, rows, shell, android: androidSerial || undefined });
    }
    listAndroid() {
      this.sendCtl({ t: 'android-list' });
    }
    androidStart(serial, opts) {
      this.sendCtl({ t: 'android-start', serial, opts });
    }
    androidOptions(opts) {
      this.sendCtl({ t: 'android-opts', opts });
    }
    androidStop() {
      this.sendCtl({ t: 'android-stop' });
    }
    resizeTerminal(cols, rows) {
      this.sendCtl({ t: 'term-resize', cols, rows });
    }
    writeTerminal(data) {
      if (this.term?.readyState === 'open') this.term.send(data);
    }

    close(reason) {
      if (this.state === 'closed') return;
      clearTimeout(this.timer);
      try {
        this.sendCtl({ t: 'bye' });
      } catch {}
      try {
        this.link?.send({ t: 'bye', sid: this.sid });
        this.link?.close();
      } catch {}
      try {
        this.pc?.close();
      } catch {}
      this.status('closed', reason);
      this.emit('closed', reason);
    }
  }

  // ---------------------------------------------------------------- Host (runs in the hidden host page)
  // bridge: { sendSignal(sid, data), info(sid), verify(sid, payload), pickDisplay(sid, id),
  //           input(sid, arr), termOpen(sid, opts), termWrite(sid, d), termResize(sid,c,r), termClose(sid),
  //           clipSet(sid, text), closed(sid) }
  class HostPeer {
    constructor(sid, iceServers, bridge) {
      this.sid = sid;
      this.bridge = bridge;
      this.authed = false;
      this.tries = 0;
      this.quality = 'balanced';
      const pc = (this.pc = new RTCPeerConnection({ iceServers, bundlePolicy: 'max-bundle' }));
      pc.onicecandidate = (e) => e.candidate && bridge.sendSignal(sid, { cand: e.candidate.toJSON() });
      pc.ondatachannel = (e) => this.onChannel(e.channel);
      pc.onconnectionstatechange = () => {
        if (['failed', 'closed'].includes(pc.connectionState)) this.close();
        // The viewer vanished (crash, network drop): give it a few seconds to come back, then end.
        clearTimeout(this.dropTimer);
        if (pc.connectionState === 'disconnected') this.dropTimer = setTimeout(() => pc.connectionState !== 'connected' && this.close(), 8000);
      };
      this.deadline = setTimeout(() => !this.authed && this.close(), 90_000);
    }

    async onSignal(d) {
      try {
        if (d.sdp) {
          await this.pc.setRemoteDescription(d.sdp);
          for (const t of this.pc.getTransceivers()) {
            if (t.receiver.track?.kind === 'video' || t.mid != null) t.direction = 'sendonly';
          }
          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);
          this.bridge.sendSignal(this.sid, { sdp: this.pc.localDescription.toJSON() });
        } else if (d.cand) {
          await this.pc.addIceCandidate(d.cand);
        }
      } catch (e) {
        console.warn('host signal', e);
      }
    }

    send(obj) {
      if (this.ctl?.readyState === 'open') this.ctl.send(JSON.stringify(obj));
    }

    async onChannel(ch) {
      if (ch.label === 'ctl') {
        this.ctl = ch;
        ch.onopen = async () => {
          const info = await this.bridge.info(this.sid);
          this.info = info;
          this.send({ t: 'hello', v: 1, nonce: info.nonce, salt: info.salt, needPassword: info.needPassword, host: info.host, features: info.features, mode: info.mode });
        };
        ch.onmessage = (e) => this.onCtl(JSON.parse(e.data));
        ch.onclose = () => this.close();
      } else if (ch.label === 'input') {
        ch.onmessage = (e) => this.authed && this.bridge.input(this.sid, JSON.parse(e.data));
      } else if (ch.label === 'android') {
        this.androidCh = ch;
        ch.binaryType = 'arraybuffer';
      } else if (ch.label === 'term') {
        this.term = ch;
        ch.onmessage = (e) => this.authed && this.termOpen && this.bridge.termWrite(this.sid, e.data);
      }
    }

    async onCtl(m) {
      if (m.t === 'auth' && !this.authed) {
        this.tries++;
        const r = await this.bridge.verify(this.sid, {
          vnonce: String(m.vnonce || ''),
          proof: String(m.proof || ''),
          fpViewer: fingerprint(this.pc.remoteDescription?.sdp),
          fpHost: fingerprint(this.pc.localDescription?.sdp),
        });
        if (r.denied) {
          this.send({ t: 'denied' });
          return setTimeout(() => this.close(), 300);
        }
        if (!r.ok) {
          this.send({ t: 'auth-fail', retryAfter: r.retryAfter || 0, left: 3 - this.tries });
          if (this.tries >= 3 || r.retryAfter) setTimeout(() => this.close(), 300);
          return;
        }
        this.authed = true;
        clearTimeout(this.deadline);
        this.features = r.features;
        return this.send({ t: 'auth-ok', hostProof: r.hostProof, which: r.which, features: r.features, displays: r.displays, shells: r.shells, android: r.android, mode: this.info.mode });
      }
      if (!this.authed) return;
      switch (m.t) {
        case 'start-desktop':
          if (!this.features.desktop) return this.send({ t: 'notice', text: 'Desktop access is turned off on this device.' });
          if (m.quality && QUALITY[m.quality]) this.quality = m.quality;
          return this.capture(m.display);
        case 'display':
          return this.capture(m.id);
        case 'quality':
          if (QUALITY[m.q]) {
            this.quality = m.q;
            this.applyQuality();
          }
          return;
        case 'clip':
          if (this.features.clipboard) this.bridge.clipSet(this.sid, String(m.text || ''));
          return;
        case 'term-open':
          if (!m.android && !this.features.terminal) return this.send({ t: 'notice', text: 'Console access is turned off on this device.' });
          try {
            const r = await this.bridge.termOpen(this.sid, { cols: m.cols, rows: m.rows, shell: m.shell, android: m.android ? String(m.android) : undefined });
            this.termOpen = true;
            this.send({ t: 'term-ready', shell: r.shell });
          } catch (e) {
            this.send({ t: 'notice', text: e.message });
          }
          return;
        case 'term-resize':
          return this.bridge.termResize(this.sid, m.cols, m.rows);
        case 'android-list':
          return this.send({ t: 'android-list', devices: await this.bridge.androidList(this.sid) });
        case 'android-start':
          try {
            await this.bridge.androidStart(this.sid, String(m.serial || ''), m.opts || {});
          } catch (e) {
            this.send({ t: 'android-error', text: e.message });
          }
          return;
        case 'android-opts':
          return this.bridge.androidOpts(this.sid, m.opts || {});
        case 'android-stop':
          return this.bridge.androidStop(this.sid);
        case 'bye':
          return this.close();
        default:
      }
    }

    async capture(displayId) {
      try {
        const chosen = await this.bridge.pickDisplay(this.sid, displayId);
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30, max: 30 } },
          audio: false,
        });
        const track = stream.getVideoTracks()[0];
        track.contentHint = 'detail';
        const sender = this.pc.getTransceivers().find((t) => t.sender && (t.direction === 'sendonly' || t.direction === 'sendrecv'))?.sender;
        if (!sender) throw new Error('No video channel was negotiated.');
        const old = this.track;
        await sender.replaceTrack(track);
        this.track = track;
        this.sender = sender;
        old?.stop();
        this.applyQuality();
        const s = track.getSettings();
        this.send({ t: 'screen', display: chosen.id, w: s.width, h: s.height });
      } catch (e) {
        this.send({ t: 'notice', text: `Screen capture failed: ${e.message}` });
      }
    }

    async applyQuality() {
      if (!this.sender) return;
      const q = QUALITY[this.quality];
      const p = this.sender.getParameters();
      if (!p.encodings || !p.encodings.length) p.encodings = [{}];
      p.encodings[0].maxBitrate = q.maxBitrate;
      p.encodings[0].maxFramerate = q.maxFramerate;
      p.encodings[0].scaleResolutionDownBy = q.scale;
      p.degradationPreference = this.quality === 'speed' ? 'maintain-framerate' : 'maintain-resolution';
      try {
        await this.sender.setParameters(p);
      } catch (e) {
        console.warn('quality', e);
      }
    }

    // Called by the host page with a JPEG frame from the attached Android device.
    androidFrame(bytes, size) {
      const ch = this.androidCh;
      if (!ch || ch.readyState !== 'open') return;
      if (ch.bufferedAmount > 1_500_000) return; // slow link: drop this frame, the next one replaces it
      this.frameId = ((this.frameId || 0) + 1) >>> 0;
      for (const part of splitFrame(this.frameId, bytes, size.width, size.height)) ch.send(part);
    }

    sendClipboard(text) {
      if (this.authed && this.features?.clipboard) this.send({ t: 'clip', text });
    }

    termData(d) {
      if (this.term?.readyState === 'open') this.term.send(d);
    }

    close() {
      if (this.closed) return;
      this.closed = true;
      clearTimeout(this.deadline);
      try {
        this.send({ t: 'bye' });
      } catch {}
      this.track?.stop();
      try {
        this.pc.close();
      } catch {}
      this.bridge.closed(this.sid);
    }
  }

  global.PCProto = { ViewerSession, HostPeer, deriveKey, hmac, transcript, fingerprint, b64, randomB64, QUALITY, splitFrame, FrameJoiner };
})(typeof window !== 'undefined' ? window : globalThis);
