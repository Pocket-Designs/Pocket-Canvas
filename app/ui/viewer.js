// Pocket-Connect viewer window: one outgoing session.
//   Desktop / Console / Both – a WebRTC session to another Pocket-Connect computer.
//   Android (adb:SERIAL)      – a phone attached to THIS computer, driven over ADB directly.
//   Android (HOST#adb:SERIAL) – a phone attached to another Pocket-Connect computer.
(function () {
  'use strict';
  const { h, ico, hydrateIcons, toast, check, field, formatId, applyTheme } = UIKit;
  const $ = (s) => document.querySelector(s);
  const q = new URLSearchParams(location.search);
  const target = q.get('target') || '';
  const mode = q.get('mode') || 'desktop';
  const name = q.get('name') || target;
  const entry = q.get('entry') || `adhoc:${target}`;
  const osHint = q.get('os') || '';

  applyTheme(matchMedia('(prefers-color-scheme: light)').matches ? 'dark' : 'dark'); // the viewer is always dark: less glare around remote screens
  hydrateIcons();

  const android = parseAndroid(target);
  const S = {
    session: null,
    tab: null,
    quality: 'balanced',
    scale: 'fit',
    viewOnly: false,
    clipSync: true,
    display: null,
    lastClip: '',
    androidSerial: android?.serial || null,
    androidSize: { width: 0, height: 0 },
  };

  function parseAndroid(t) {
    let m = t.match(/^adb:(.+)$/i);
    if (m) return { local: true, serial: m[1] };
    m = t.match(/^(.+?)#adb:(.+)$/i);
    if (m) return { local: false, host: m[1], serial: m[2] };
    return null;
  }

  // ------------------------------------------------------------ header & overlay
  function setTitle(text) {
    $('#title').textContent = text;
    pc.invoke('viewer:title', `${text} – Pocket-Connect`);
  }
  function setOs(os) {
    const o = PCIcons.os(os);
    $('#osBadge').innerHTML = o.svg;
    $('#osBadge').style.setProperty('--oc', o.color);
  }
  function status(text, kind) {
    $('#stText').textContent = text;
    $('#stDot').className = `dot ${kind || ''}`;
  }

  const STEPS = ['calling', 'securing', 'password', 'connected'];
  function overlay(kind, opts = {}) {
    const ov = $('#overlay');
    const card = $('#ovCard');
    if (kind === null) {
      ov.classList.add('hidden');
      return;
    }
    ov.classList.remove('hidden');
    const steps = h('div', { class: 'steps' }, STEPS.map((s, i) => h('span', { class: STEPS.indexOf(opts.step || kind) >= i ? 'on' : '' })));
    if (kind === 'busy') {
      card.replaceChildren(h('div', { class: 'spinner' }), h('h2', {}, opts.title), h('p', {}, opts.text || ''), opts.step ? steps : null,
        h('button', { class: 'btn ghost', style: { marginTop: '14px' }, onclick: () => hangup() }, 'Cancel'));
    } else if (kind === 'error') {
      card.replaceChildren(h('div', { class: 'big-ico bad', html: PCIcons.UI.close }), h('h2', {}, opts.title || 'Not connected'), h('p', {}, opts.text || ''),
        h('div', { class: 'row', style: { justifyContent: 'center' } },
          h('button', { class: 'btn primary', onclick: () => location.reload() }, 'Try again'),
          h('button', { class: 'btn', onclick: () => window.close() }, 'Close')));
    } else if (kind === 'password') {
      const pw = h('input', { class: 'input', type: 'password', autocomplete: 'off', placeholder: 'One-time or permanent password' });
      let remember = false;
      const ok = h('button', { class: 'btn primary' }, 'Connect');
      const cancel = h('button', { class: 'btn' }, 'Cancel');
      card.replaceChildren(h('div', { class: 'big-ico', html: PCIcons.UI.lock }),
        h('h2', {}, `Password for ${opts.host?.name || name}`),
        h('p', {}, opts.note || 'Type the password shown on the other computer. It never leaves this computer – only a proof of it is sent.'),
        field('Password', pw),
        check('Remember on this computer', 'Stores a key derived from it, encrypted with your system keyring. Not synced.', false, (v) => (remember = v)),
        h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '6px' } }, ok, cancel), steps);
      setTimeout(() => pw.focus(), 30);
      return new Promise((resolve) => {
        ok.onclick = () => pw.value && resolve({ password: pw.value, remember });
        pw.addEventListener('keydown', (e) => e.key === 'Enter' && ok.click());
        cancel.onclick = () => resolve(null);
      });
    }
    return null;
  }

  // ------------------------------------------------------------ tabs and tools
  function setTabs(list) {
    const tabs = $('#tabs');
    tabs.replaceChildren(...list.map(([id, label, icon]) => h('button', { 'data-tab': id, onclick: () => showTab(id) }, ico(icon), label)));
    tabs.classList.toggle('hidden', list.length < 2);
  }

  function showTab(id) {
    S.tab = id;
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === id));
    document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('hidden', p.id !== `pane-${id}`));
    renderTools();
    if (id === 'terminal') term.ensure();
    if (id === 'aterm') aterm.ensure();
    if (id === 'desktop') $('#video').focus();
    if (id === 'android') $('#androidCanvas').focus();
  }

  function renderTools() {
    const tools = $('#tools');
    const items = [];
    const sess = S.session;
    if (S.tab === 'desktop' && sess) {
      if ((sess.displays || []).length > 1) {
        const sel = h('select', { class: 'input', title: 'Screen' }, sess.displays.map((d) => {
          const o = h('option', { value: d.id }, d.label);
          if (d.id === S.display) o.selected = true;
          return o;
        }));
        sel.onchange = () => {
          S.display = sel.value;
          sess.setDisplay(sel.value);
        };
        items.push(sel);
      }
      const qs = h('select', { class: 'input', title: 'Picture quality' }, [['speed', 'Speed'], ['balanced', 'Balanced'], ['quality', 'Best quality']].map(([v, l]) => {
        const o = h('option', { value: v }, l);
        if (v === S.quality) o.selected = true;
        return o;
      }));
      qs.onchange = () => {
        S.quality = qs.value;
        sess.setQuality(qs.value);
      };
      items.push(qs);
      items.push(toggle(S.scale === 'actual', 'Actual size (scroll)', 'screens', () => {
        S.scale = S.scale === 'fit' ? 'actual' : 'fit';
        $('#video').classList.toggle('actual', S.scale === 'actual');
        $('#pane-desktop').classList.toggle('scroll', S.scale === 'actual');
      }));
      if (sess.features?.input) {
        items.push(toggle(S.viewOnly, 'View only (do not send mouse/keyboard)', 'eye', () => (S.viewOnly = !S.viewOnly)));
        items.push(h('button', { class: 'btn small icon', title: 'Send keys', onclick: (e) => keysMenu(e) }, ico('keyboard')));
      }
    }
    if ((S.tab === 'desktop' || S.tab === 'terminal') && sess?.features?.clipboard) {
      items.push(toggle(S.clipSync, 'Share clipboard', 'clipboard', () => (S.clipSync = !S.clipSync)));
    }
    if (S.tab === 'android') {
      const qs = h('select', { class: 'input', title: 'Picture size' }, [[480, 'Small (fast)'], [720, 'Medium'], [1080, 'Large'], [1600, 'Full']].map(([v, l]) => {
        const o = h('option', { value: v }, l);
        if (v === (S.androidWidth || 720)) o.selected = true;
        return o;
      }));
      qs.onchange = () => {
        S.androidWidth = Number(qs.value);
        androidSrc?.options({ maxWidth: S.androidWidth, quality: S.androidWidth > 1000 ? 80 : 70 });
      };
      items.push(qs);
      if (android?.local) items.push(h('button', { class: 'btn small', title: 'Open in scrcpy for smooth full-speed video', onclick: () => pc.invoke('android:scrcpy', S.androidSerial).catch((e) => toast(e.message, 'bad')) }, 'scrcpy'));
    }
    items.push(h('button', { class: 'btn small icon', title: 'Full screen (F11)', onclick: () => fullscreen() }, ico('fullscreen')));
    tools.replaceChildren(...items);
  }

  function toggle(on, title, icon, fn) {
    const b = h('button', { class: `btn small icon ${on ? 'on' : ''}`, title }, ico(icon));
    b.onclick = () => {
      fn();
      b.classList.toggle('on');
    };
    return b;
  }

  function keysMenu(e) {
    const send = (codes) => S.session.sendInput(['combo', codes]);
    const r = e.currentTarget.getBoundingClientRect();
    UIKit.menu(r.left, r.bottom + 6, [
      { label: 'Ctrl + Alt + Del', onClick: () => send(['ControlLeft', 'AltLeft', 'Delete']) },
      { label: 'Alt + Tab', onClick: () => send(['AltLeft', 'Tab']) },
      { label: 'Alt + F4', onClick: () => send(['AltLeft', 'F4']) },
      { label: 'Windows / Super key', onClick: () => send(['MetaLeft']) },
      { label: 'Win + L (lock)', onClick: () => send(['MetaLeft', 'KeyL']) },
      { label: 'Print Screen', onClick: () => send(['PrintScreen']) },
      '-',
      { label: 'Type my clipboard', onClick: async () => { const t = await pc.invoke('viewer:clip-read'); if (t) S.session.sendInput(['t', t.slice(0, 1000)]); } },
    ]);
  }

  async function fullscreen(on) {
    const full = await pc.invoke('viewer:fullscreen', on);
    document.body.classList.toggle('full', !!full);
  }
  document.addEventListener('mousemove', (e) => {
    if (document.body.classList.contains('full')) $('#bar').classList.toggle('peek', e.clientY < 8 || $('#bar').matches(':hover'));
  });

  function hangup() {
    S.session?.close('You disconnected.');
    androidSrc?.stop();
    window.close();
  }
  $('#hangup').onclick = hangup;
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F11') {
      e.preventDefault();
      fullscreen();
    }
  }, true);

  // ------------------------------------------------------------ remote desktop input
  const video = $('#video');
  function videoPoint(e) {
    const r = video.getBoundingClientRect();
    const vw = video.videoWidth || r.width;
    const vh = video.videoHeight || r.height;
    let x = r.left;
    let y = r.top;
    let w = r.width;
    let hh = r.height;
    if (S.scale === 'fit') {
      // object-fit: contain – find the letterboxed picture inside the element
      const s = Math.min(r.width / vw, r.height / vh);
      w = vw * s;
      hh = vh * s;
      x = r.left + (r.width - w) / 2;
      y = r.top + (r.height - hh) / 2;
    }
    return [(e.clientX - x) / w, (e.clientY - y) / hh];
  }
  const canInput = () => S.session?.state === 'connected' && S.session.features?.input && !S.viewOnly && S.tab === 'desktop';
  let pendingMove = null;
  video.addEventListener('mousemove', (e) => {
    if (!canInput()) return;
    const first = !pendingMove;
    pendingMove = videoPoint(e);
    if (first) requestAnimationFrame(() => {
      if (pendingMove) S.session.sendInput(['m', ...pendingMove]);
      pendingMove = null;
    });
  });
  video.addEventListener('mousedown', (e) => {
    video.focus();
    if (!canInput()) return;
    e.preventDefault();
    S.session.sendInput(['m', ...videoPoint(e)]);
    S.session.sendInput(['d', e.button]);
  });
  video.addEventListener('mouseup', (e) => canInput() && (e.preventDefault(), S.session.sendInput(['u', e.button])));
  video.addEventListener('contextmenu', (e) => e.preventDefault());
  let wheelAcc = [0, 0];
  video.addEventListener('wheel', (e) => {
    if (!canInput()) return;
    e.preventDefault();
    wheelAcc[0] += e.deltaX;
    wheelAcc[1] += e.deltaY;
    const sx = Math.trunc(wheelAcc[0] / 60);
    const sy = Math.trunc(wheelAcc[1] / 60);
    if (sx || sy) {
      S.session.sendInput(['w', sx, sy]);
      wheelAcc = [wheelAcc[0] - sx * 60, wheelAcc[1] - sy * 60];
    }
  }, { passive: false });
  const down = new Set();
  video.addEventListener('keydown', (e) => {
    if (!canInput() || e.key === 'F11') return;
    e.preventDefault();
    down.add(e.code);
    S.session.sendInput(['kd', e.code]);
  });
  video.addEventListener('keyup', (e) => {
    if (!canInput()) return;
    e.preventDefault();
    down.delete(e.code);
    S.session.sendInput(['ku', e.code]);
  });
  // Never leave a key held down on the other computer when this window loses focus.
  window.addEventListener('blur', () => {
    for (const c of down) S.session?.sendInput(['ku', c]);
    down.clear();
  });

  // ------------------------------------------------------------ terminals
  function makeTerminal(el, backend) {
    let t = null;
    let fit = null;
    let opened = false;
    const api = {
      ensure() {
        if (!t) {
          t = new Terminal({
            fontFamily: "'JetBrains Mono', Consolas, monospace",
            fontSize: 14,
            cursorBlink: true,
            allowProposedApi: false,
            scrollback: 5000,
            theme: { background: '#0c1014', foreground: '#e8edf2', cursor: '#ff7a45', selectionBackground: 'rgba(255,122,69,.3)' },
          });
          fit = new FitAddon.FitAddon();
          t.loadAddon(fit);
          t.open(el);
          t.onData((d) => backend.write(d));
          t.attachCustomKeyEventHandler((e) => {
            // Ctrl+Shift+C / V copy & paste like a normal terminal
            if (e.type === 'keydown' && e.ctrlKey && e.shiftKey && e.code === 'KeyC') {
              pc.invoke('copy', t.getSelection());
              return false;
            }
            if (e.type === 'keydown' && e.ctrlKey && e.shiftKey && e.code === 'KeyV') {
              pc.invoke('viewer:clip-read').then((txt) => txt && backend.write(txt));
              return false;
            }
            return true;
          });
          new ResizeObserver(() => {
            if (el.offsetParent === null) return;
            fit.fit();
            if (opened) backend.resize(t.cols, t.rows);
          }).observe(el);
        }
        requestAnimationFrame(() => {
          fit.fit();
          if (!opened) {
            opened = true;
            t.write('\x1b[2mOpening console…\x1b[0m\r\n');
            backend.open(t.cols, t.rows);
          }
          t.focus();
        });
      },
      data(d) {
        t?.write(d);
      },
      exit(code) {
        t?.write(`\r\n\x1b[33m[Console closed${code != null ? ` – exit code ${code}` : ''}. Press Enter to open a new one.]\x1b[0m\r\n`);
        opened = false;
        const sub = t.onData(() => {
          sub.dispose();
          t.clear();
          api.ensure();
        });
      },
      notice(text) {
        t?.write(`\r\n\x1b[31m${text}\x1b[0m\r\n`);
      },
    };
    return api;
  }

  const term = makeTerminal($('#term'), {
    open: (c, r) => S.session.openTerminal(c, r),
    write: (d) => S.session.writeTerminal(d),
    resize: (c, r) => S.session.resizeTerminal(c, r),
  });

  // Android shell: local ADB, or through the remote host
  let localTid = null;
  const aterm = makeTerminal($('#aterm'), {
    open: async (c, r) => {
      if (android.local) {
        try {
          localTid = await pc.invoke('viewer:android-term-open', S.androidSerial, c, r);
        } catch (e) {
          aterm.notice(e.message);
        }
      } else S.session.openTerminal(c, r, null, S.androidSerial);
    },
    write: (d) => (android.local ? localTid && pc.invoke('viewer:term-write', localTid, d) : S.session.writeTerminal(d)),
    resize: (c, r) => (android.local ? localTid && pc.invoke('viewer:term-resize', localTid, c, r) : S.session.resizeTerminal(c, r)),
  });
  pc.on('viewer:term-data', (tid, d) => tid === localTid && aterm.data(d));
  pc.on('viewer:term-exit', (tid, code) => tid === localTid && aterm.exit(code));

  // ------------------------------------------------------------ android screen
  let androidSrc = null;
  const canvas = $('#androidCanvas');
  const ctx = canvas.getContext('2d');
  let drawing = false;
  let nextFrame = null;

  function drawFrame(bytes, size) {
    S.androidSize = size;
    nextFrame = bytes;
    if (drawing) return;
    drawing = true;
    const blob = new Blob([nextFrame], { type: 'image/jpeg' });
    nextFrame = null;
    createImageBitmap(blob).then((bmp) => {
      if (canvas.width !== bmp.width || canvas.height !== bmp.height) {
        canvas.width = bmp.width;
        canvas.height = bmp.height;
      }
      ctx.drawImage(bmp, 0, 0);
      bmp.close();
      if (S.tab === 'android') overlay(null);
    }).catch(() => {}).finally(() => {
      drawing = false;
    });
  }

  function canvasPoint(e) {
    const r = canvas.getBoundingClientRect();
    const border = 6;
    return [(e.clientX - r.left - border) / (r.width - border * 2), (e.clientY - r.top - border) / (r.height - border * 2)];
  }

  let press = null;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.focus();
    canvas.setPointerCapture(e.pointerId);
    press = { p: canvasPoint(e), t: Date.now(), button: e.button };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!press || !androidSrc) return;
    const p = canvasPoint(e);
    const dt = Date.now() - press.t;
    const dist = Math.hypot((p[0] - press.p[0]) * canvas.width, (p[1] - press.p[1]) * canvas.height);
    if (press.button === 2) androidSrc.input(['a-key', 'back']);
    else if (dist < 8 && dt < 400) androidSrc.input(['a-tap', ...p]);
    else if (dist < 8) androidSrc.input(['a-swipe', ...press.p, ...press.p, dt]); // long press
    else androidSrc.input(['a-swipe', ...press.p, ...p, Math.max(80, Math.min(dt, 1500))]);
    press = null;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  let wheelTimer = null;
  let wheelSum = 0;
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (!androidSrc) return;
    wheelSum += e.deltaY;
    const at = canvasPoint(e);
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => {
      const dy = Math.max(-0.45, Math.min(0.45, -wheelSum / 1200));
      wheelSum = 0;
      androidSrc.input(['a-swipe', at[0], at[1], at[0], Math.max(0.02, Math.min(0.98, at[1] + dy)), 250]);
    }, 60);
  }, { passive: false });
  let typed = '';
  let typeTimer = null;
  canvas.addEventListener('keydown', (e) => {
    if (!androidSrc || e.ctrlKey || e.metaKey) return;
    const map = { Enter: 'enter', Backspace: 'del', Delete: 'forwardDel', Tab: 'tab', Escape: 'back', ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Home: 'home' };
    if (map[e.key]) {
      e.preventDefault();
      flushTyped();
      androidSrc.input(['a-key', map[e.key]]);
    } else if (e.key.length === 1) {
      e.preventDefault();
      typed += e.key;
      clearTimeout(typeTimer);
      typeTimer = setTimeout(flushTyped, 150);
    }
  });
  canvas.addEventListener('paste', (e) => {
    const t = e.clipboardData.getData('text');
    if (t && androidSrc) androidSrc.input(['a-text', t.slice(0, 500)]);
  });
  function flushTyped() {
    if (typed && androidSrc) androidSrc.input(['a-text', typed]);
    typed = '';
  }

  function phoneKeys() {
    const k = (key, icon, title) => h('button', { class: 'btn', title, onclick: () => { flushTyped(); androidSrc?.input(['a-key', key]); } }, ico(icon));
    $('#phoneKeys').replaceChildren(
      k('back', 'back', 'Back (or right-click the screen)'), k('home', 'home', 'Home'), k('recents', 'recents', 'Recent apps'),
      h('hr'), k('volup', 'volup', 'Volume up'), k('voldown', 'voldown', 'Volume down'), k('power', 'power', 'Power / screen on-off'),
      h('hr'), h('button', { class: 'btn', title: 'Type text…', onclick: typeDialog }, ico('keyboard')));
  }
  function typeDialog() {
    const t = h('input', { class: 'input', placeholder: 'Text to type on the device' });
    UIKit.modal({ title: 'Type on the device', body: field('Text', t), actions: [{ label: 'Cancel' }, { label: 'Send', primary: true, onClick: () => androidSrc?.input(['a-text', t.value]) }] });
  }

  function localAndroidSource(serial) {
    const offFrame = pc.on('viewer:android-frame', (s, jpeg, size) => s === serial && drawFrame(new Uint8Array(jpeg), size));
    const offErr = pc.on('viewer:android-error', (s, err) => s === serial && overlay('error', { title: 'Lost the Android screen', text: err }));
    pc.invoke('viewer:android-start', serial, { maxWidth: S.androidWidth || 720 });
    return {
      input: (msg) => pc.invoke('viewer:android-input', serial, msg),
      options: (o) => pc.invoke('viewer:android-opts', serial, o),
      stop: () => {
        offFrame();
        offErr();
        pc.invoke('viewer:android-stop', serial);
      },
    };
  }

  function remoteAndroidSource(sess, serial) {
    sess.on('android-frame', drawFrame);
    sess.on('android-error', (text) => overlay('error', { title: 'Android device problem', text }));
    sess.androidStart(serial, { maxWidth: S.androidWidth || 720 });
    return {
      input: (msg) => sess.sendInput(msg),
      options: (o) => sess.androidOptions(o),
      stop: () => sess.androidStop(),
    };
  }

  // ------------------------------------------------------------ start a session
  async function startLocalAndroid() {
    setOs('android');
    setTitle(name);
    status(`USB / Wi-Fi ADB · ${S.androidSerial}`, 'ok');
    setTabs([['android', 'Screen', 'phone'], ['aterm', 'Shell', 'terminal']]);
    phoneKeys();
    overlay('busy', { title: 'Opening the phone screen', text: 'If nothing appears, unlock the phone and allow USB debugging.' });
    showTab('android');
    try {
      const info = await pc.invoke('android:info', S.androidSerial);
      setTitle(`${name}${info.android ? ` · Android ${info.android}` : ''}`);
    } catch (e) {
      return overlay('error', { title: 'Cannot reach the device', text: e.message });
    }
    androidSrc = localAndroidSource(S.androidSerial);
  }

  async function startSession() {
    const via = android ? android.host : target;
    const sessMode = android ? 'android' : mode;
    setOs(android ? 'android' : osHint || 'unknown');
    setTitle(name);
    const viewerInfo = await pc.invoke('viewer:info');
    void viewerInfo;

    const transport = {
      open(t, m, sid, onMessage) {
        const off = pc.on('viewer:signal', (msg) => msg.sid === sid && onMessage(msg));
        pc.invoke('viewer:open-link', t, m, sid);
        return {
          send: (msg) => pc.invoke('viewer:send', sid, msg),
          close: () => {
            off();
            pc.invoke('viewer:close-link', sid);
          },
        };
      },
    };
    const keyStore = {
      get: () => cachedKey,
      set: (_t, v) => pc.invoke('viewer:key-set', entry, v),
    };
    const cachedKey = await pc.invoke('viewer:key-get', entry);

    const sess = new PCProto.ViewerSession({
      transport,
      target: via,
      mode: sessMode,
      keyStore,
      askPassword: (info) => overlay('password', info),
    });
    S.session = sess;

    sess.on('status', (st, detail) => {
      const label = /^\d{9}$/.test(via) ? `ID ${formatId(via)}` : via;
      if (st === 'calling') {
        status(`Calling ${label}…`, 'warn');
        overlay('busy', { title: `Calling ${name}`, text: 'Waiting for the other computer to answer.', step: 'calling' });
      } else if (st === 'securing') {
        status('Setting up encryption…', 'warn');
        overlay('busy', { title: 'Securing the connection', text: 'Creating an end-to-end encrypted link.', step: 'securing' });
      } else if (st === 'password') {
        status('Encrypted · waiting for password', 'warn');
      } else if (st === 'checking') {
        status('Encrypted · checking password', 'warn');
        overlay('busy', { title: 'Checking password', text: '', step: 'password' });
      } else if (st === 'waiting') {
        status('Encrypted · waiting for permission', 'warn');
        overlay('busy', { title: 'Waiting for permission', text: 'Someone at the other computer needs to click Allow.', step: 'password' });
      } else if (st === 'connected') {
        status(`Connected · ${detail?.which === 'account' ? 'your account' : `${detail?.which || ''} password`}${S.route ? ` · ${S.route}` : ''}`, 'ok');
      }
    });
    sess.on('route', (r) => (S.route = r === 'relay' ? 'via relay' : 'direct'));
    sess.on('host', (hinfo) => {
      if (hinfo?.os) setOs(android ? 'android' : hinfo.os);
    });
    sess.on('error', (text) => overlay('error', { title: 'Could not connect', text }));
    sess.on('closed', (reason) => {
      status('Disconnected', 'bad');
      if ($('#overlay').classList.contains('hidden') || !$('#ovCard .big-ico.bad')) overlay('error', { title: 'Session ended', text: reason || '' });
    });
    sess.on('notice', (text) => {
      toast(text, 'bad');
      if (S.tab === 'terminal') term.notice(text);
    });
    sess.on('video', (stream) => {
      video.srcObject = stream;
      video.play().catch(() => {});
    });
    sess.on('screen', (m) => {
      S.display = m.display;
      if (S.tab === 'desktop') overlay(null);
      renderTools();
    });
    sess.on('term-data', (d) => (android ? aterm : term).data(d));
    sess.on('term-exit', (code) => (android ? aterm : term).exit(code));
    sess.on('clipboard', (text) => {
      if (S.clipSync && typeof text === 'string') {
        S.lastClip = text;
        pc.invoke('viewer:clip-write', text);
      }
    });

    sess.on('ready', (m) => {
      const f = m.features || {};
      if (android) {
        if (!f.android) return overlay('error', { title: 'Android access is off', text: 'The other computer does not allow Android access. It can be turned on in its Settings.' });
        setTabs([['android', 'Screen', 'phone'], ['aterm', 'Shell', 'terminal']]);
        phoneKeys();
        showTab('android');
        overlay('busy', { title: 'Opening the phone screen', text: `On ${m.host?.name || via}` });
        androidSrc = remoteAndroidSource(sess, S.androidSerial);
        return;
      }
      const tabs = [];
      if (f.desktop) tabs.push(['desktop', 'Desktop', 'desktop']);
      if (f.terminal) tabs.push(['terminal', 'Console', 'terminal']);
      if (!tabs.length) return overlay('error', { title: 'Nothing allowed', text: 'The other computer does not allow this kind of connection. It can be changed in its Settings.' });
      setTabs(tabs);
      if (f.desktop) {
        const primary = (sess.displays || []).find((d) => d.primary) || sess.displays?.[0];
        S.display = primary?.id;
        sess.startDesktop(S.display, S.quality);
        showTab('desktop');
        overlay('busy', { title: 'Starting the screen', text: '' });
      } else {
        showTab('terminal');
        overlay(null);
      }
      if (f.terminal && mode === 'terminal') showTab('terminal'), overlay(null);
      if (!f.input && f.desktop) toast('This computer only allows viewing.');
    });

    sess.start();
  }

  // Clipboard: send local changes while this window is focused.
  setInterval(async () => {
    const sess = S.session;
    if (!sess || sess.state !== 'connected' || !S.clipSync || !sess.features?.clipboard || !document.hasFocus()) return;
    const t = await pc.invoke('viewer:clip-read');
    if (t && t !== S.lastClip) {
      S.lastClip = t;
      sess.sendClipboard(t);
    }
  }, 1000);

  window.addEventListener('beforeunload', () => {
    S.session?.close();
    androidSrc?.stop();
    if (localTid) pc.invoke('viewer:term-close', localTid);
  });

  if (android?.local) startLocalAndroid();
  else startSession().catch((e) => overlay('error', { title: 'Could not start', text: e.message }));
})();
