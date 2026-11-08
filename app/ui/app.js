// Pocket-Connect main window.
(function () {
  'use strict';
  const { h, ico, hydrateIcons, toast, modal, menu, field, check, formatId, uid, ago, applyTheme } = UIKit;
  const $ = (s) => document.querySelector(s);

  let S = null; // app state from the main process
  let book = { folders: [], devices: [] };
  let removed = [];
  let savedKeys = {};
  let accountDevices = [];
  const ui = { folder: 'all', view: 'grid', search: '', open: new Set(), quickMode: 'desktop', showOt: false, nav: 'devices' };

  const FOLDER_COLORS = ['#ff7a45', '#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ec4899', '#14b8a6', '#94a3b8'];
  const MODE_LABEL = { desktop: 'Desktop', terminal: 'Console', both: 'Desktop + console', android: 'Android' };

  // ------------------------------------------------------------ targets
  function parseTarget(raw) {
    const t = String(raw || '').trim();
    if (!t) return null;
    let m = t.match(/^adb:(.+)$/i);
    if (m) return { kind: 'adb-local', serial: m[1].trim(), target: `adb:${m[1].trim()}` };
    m = t.match(/^(.+?)#adb:(.+)$/i);
    if (m) {
      const host = parseTarget(m[1]);
      if (!host || host.kind.startsWith('adb')) return null;
      return { kind: 'adb-remote', host: host.target, serial: m[2].trim(), target: `${host.target}#adb:${m[2].trim()}` };
    }
    const digits = t.replace(/[\s-]/g, '');
    if (/^\d{9}$/.test(digits)) return { kind: 'id', target: digits };
    if (/^(\[[0-9a-f:]+\]|[0-9a-z.\-]+)(:\d{2,5})?$/i.test(t)) return { kind: 'lan', target: t };
    return null;
  }

  function targetLabel(addr) {
    const p = parseTarget(addr);
    if (!p) return addr;
    if (p.kind === 'id') return formatId(p.target);
    if (p.kind === 'adb-remote') return `${/^\d{9}$/.test(p.host) ? formatId(p.host) : p.host} › ${p.serial}`;
    return p.target;
  }

  function connect({ address, mode, name, os, entryId }) {
    const p = parseTarget(address);
    if (!p) return toast('Enter a 9-digit ID, an IP address, or adb:serial for an Android device.', 'bad');
    if (p.kind === 'id' && !S.settings.serverUrl) return toast('Connecting by ID needs a server. Add yours under Account, or connect by IP address on your network.', 'bad');
    const m = p.kind.startsWith('adb') ? 'android' : mode || 'desktop';
    pc.invoke('connect', { target: p.target, mode: m, name: name || targetLabel(p.target), os: os || (m === 'android' ? 'android' : ''), entryId: entryId || `adhoc:${p.target}` });
  }

  // ------------------------------------------------------------ state & sidebar
  async function refresh() {
    S = await pc.invoke('app:state');
    renderSide();
  }

  function renderSide() {
    if (!S) return;
    applyTheme(S.settings.ui.theme);
    const srv = S.server;
    const dot = $('#srvDot');
    dot.className = 'dot';
    let text;
    if (!S.settings.host.enabled) {
      text = 'Incoming connections off';
      dot.classList.add('bad');
    } else if (!srv.url) {
      text = 'Local network only';
      dot.classList.add('warn');
    } else if (srv.state === 'online') {
      text = 'Ready – reachable by ID';
      dot.classList.add('ok');
    } else if (srv.state === 'connecting') {
      text = 'Connecting to server…';
      dot.classList.add('warn');
    } else {
      text = srv.detail || 'Server unreachable';
      dot.classList.add('bad');
    }
    $('#srvText').textContent = text;
    $('#srvText').title = srv.detail || '';
    $('#myId').textContent = S.device.id ? formatId(S.device.id) : '—';
    $('#myId').title = S.device.id ? '' : 'Add a server under Account to get a Pocket ID';
    const lanTxt = S.settings.host.lanListen && S.lan.length ? S.lan.map((a) => a.address).slice(0, 2).join(' · ') : '';
    $('#myLan').textContent = lanTxt ? `LAN ${lanTxt}` : '';
    $('#oneTime').textContent = ui.showOt ? S.oneTime : '••••••••';
    const perm = $('#permBtn');
    perm.classList.toggle('set', S.hasPermanent);
    perm.querySelector('.perm-ico').innerHTML = PCIcons.UI[S.hasPermanent ? 'shield' : 'key'];
    $('#permTitle').textContent = S.hasPermanent ? 'Permanent password set' : 'Set a permanent password';
    $('#permSub').textContent = S.hasPermanent ? 'For unattended access. Click to change.' : 'For connecting without someone here';
    renderLive(S.sessions);
  }

  function renderLive(list) {
    const live = $('#live');
    live.classList.toggle('hidden', !list.length);
    const box = $('#liveList');
    box.replaceChildren(...list.map((s) => h('div', { class: 'live-item' },
      h('span', { class: 'grow' }, h('b', {}, s.from), h('div', { class: 'faint' }, `${MODE_LABEL[s.mode]} · ${s.via === 'lan' ? 'LAN' : 'server'} · ${s.ip}`)),
      h('button', { class: 'btn small danger', onclick: () => pc.invoke('session:kick', s.sid) }, 'Disconnect'))));
  }

  function setupSide() {
    $('#copyId').innerHTML = PCIcons.UI.copy;
    $('#copyOt').innerHTML = PCIcons.UI.copy;
    $('#showOt').innerHTML = PCIcons.UI.eye;
    $('#newOt').innerHTML = PCIcons.UI.refresh;
    $('#copyId').onclick = () => S.device.id && (pc.invoke('copy', S.device.id), toast('ID copied'));
    $('#copyOt').onclick = () => (pc.invoke('copy', S.oneTime), toast('Password copied'));
    $('#showOt').onclick = () => {
      ui.showOt = !ui.showOt;
      renderSide();
    };
    $('#newOt').onclick = async () => {
      await pc.invoke('host:new-one-time');
      ui.showOt = true;
      await refresh();
      toast('New one-time password made');
    };
    $('#permBtn').onclick = permanentDialog;
    for (const b of document.querySelectorAll('#nav button')) b.onclick = () => go(b.dataset.view);
    for (const b of document.querySelectorAll('#quickMode button')) {
      b.onclick = () => {
        ui.quickMode = b.dataset.mode;
        document.querySelectorAll('#quickMode button').forEach((x) => x.classList.toggle('on', x === b));
      };
    }
    const qt = $('#quickTarget');
    qt.addEventListener('keydown', (e) => e.key === 'Enter' && $('#quickGo').click());
    qt.addEventListener('input', () => {
      const digits = qt.value.replace(/\D/g, '');
      if (/^\d+$/.test(qt.value.replace(/\s/g, '')) && digits.length <= 9) {
        const f = formatId(digits);
        if (f !== qt.value) qt.value = f;
      }
    });
    $('#quickGo').onclick = () => connect({ address: qt.value, mode: ui.quickMode });
  }

  function permanentDialog() {
    const a = h('input', { class: 'input', type: 'password', autocomplete: 'new-password' });
    const b = h('input', { class: 'input', type: 'password', autocomplete: 'new-password' });
    const meter = h('div', { class: 'faint', style: { fontSize: '12px', marginTop: '-6px', marginBottom: '10px' } }, ' ');
    a.addEventListener('input', () => {
      const s = strength(a.value);
      meter.textContent = a.value ? `Strength: ${s.label}` : ' ';
      meter.style.color = s.color;
    });
    const actions = [{ label: 'Cancel' }];
    if (S.hasPermanent) {
      actions.unshift({
        label: 'Remove', danger: true, onClick: async () => {
          await pc.invoke('host:set-permanent', '');
          await refresh();
          toast('Permanent password removed');
        },
      });
    }
    actions.push({
      label: 'Save', primary: true, onClick: async () => {
        if (a.value.length < 8) throw new Error('Use at least 8 characters. Longer is better: try 3–4 random words.');
        if (strength(a.value).score < 2) throw new Error('That password is too easy to guess. Make it longer or mix words and numbers.');
        if (a.value !== b.value) throw new Error('The two passwords do not match.');
        await pc.invoke('host:set-permanent', a.value);
        await refresh();
        toast('Permanent password saved');
      },
    });
    modal({
      title: S.hasPermanent ? 'Change permanent password' : 'Set a permanent password',
      body: [
        h('p', { class: 'muted', style: { marginTop: 0 } }, 'Use this to reach this computer any time, even when nobody is here to read out the one-time password. It is stored only as a salted hash on this computer and is never sent over the network.'),
        field('New password', a), meter, field('Type it again', b),
        h('div', { class: 'notice warn' }, 'Anyone with this password and your ID can control this computer. Changing it signs out every device that remembered the old one.'),
      ],
      actions,
    });
  }

  function strength(pw) {
    let score = 0;
    if (pw.length >= 10) score++;
    if (pw.length >= 14) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (/^(.)\1+$/.test(pw) || /^(password|12345|qwerty)/i.test(pw)) score = 0;
    const labels = [['weak', 'var(--bad)'], ['weak', 'var(--bad)'], ['fair', 'var(--warn)'], ['good', 'var(--ok)'], ['strong', 'var(--ok)'], ['very strong', 'var(--ok)']];
    return { score, label: labels[score][0], color: labels[score][1] };
  }

  function go(view) {
    ui.nav = view;
    document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('hidden', v.id !== `view-${view}`));
    render();
  }

  function render() {
    ({ devices: renderDevices, nearby: renderNearby, android: renderAndroid, account: renderAccount, settings: renderSettings, activity: renderActivity })[ui.nav]();
  }

  // ------------------------------------------------------------ address book
  async function loadBook() {
    book = await pc.invoke('book:get');
    book.folders ||= [];
    book.devices ||= [];
    savedKeys = await pc.invoke('book:has-password', book.devices.map((d) => d.id));
  }

  async function saveBook() {
    const r = await pc.invoke('book:save', { ...book, removed });
    removed = [];
    if (r.merged) await loadBook();
    if (ui.nav === 'devices') renderDevices();
    if (r.error) toast(`Saved here, but could not sync: ${r.error}`, 'bad');
  }

  const childFolders = (parent) => book.folders.filter((f) => (f.parent || null) === parent).sort((a, b) => a.name.localeCompare(b.name));
  const folderById = (id) => book.folders.find((f) => f.id === id);
  function descendants(id) {
    const out = new Set([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const f of book.folders) if (f.parent && out.has(f.parent) && !out.has(f.id)) out.add(f.id), (grew = true);
    }
    return out;
  }
  function countIn(id) {
    const ids = descendants(id);
    return book.devices.filter((d) => ids.has(d.folder)).length;
  }
  function folderPath(id) {
    const out = [];
    let f = folderById(id);
    while (f) {
      out.unshift(f);
      f = folderById(f.parent);
    }
    return out;
  }

  function renderDevices() {
    const root = $('#view-devices');
    const tree = h('div', { class: 'tree' });
    const item = (id, label, icon, count, extra = {}) => {
      const el = h('div', { class: `tree-item ${ui.folder === id ? 'on' : ''}`, onclick: () => { ui.folder = id; renderDevices(); } },
        extra.twist || null, h('span', { class: 'fico', style: extra.color ? { '--fc': extra.color } : null, html: PCIcons.UI[icon] }), h('span', {}, label), count != null ? h('span', { class: 'count' }, count) : null);
      if (extra.drop) makeDropTarget(el, extra.drop);
      return el;
    };
    tree.append(item('all', 'All devices', 'grid', book.devices.length, { drop: null }));
    tree.append(item('none', 'Not in a folder', 'list', book.devices.filter((d) => !d.folder).length, { drop: '__none' }));
    if (S.signedIn) tree.append(item('account', 'My account', 'cloud', accountDevices.length));
    tree.append(h('div', { class: 'tree-sep' }));
    const addFolders = (parent, depth) => {
      for (const f of childFolders(parent)) {
        const kids = childFolders(f.id).length;
        const open = ui.open.has(f.id);
        const twist = h('span', { class: 'twist', html: kids ? PCIcons.UI.chevron : '', onclick: (e) => { e.stopPropagation(); open ? ui.open.delete(f.id) : ui.open.add(f.id); renderDevices(); } });
        const el = item(f.id, f.name, 'folder', countIn(f.id), { color: f.color, twist, drop: f.id });
        el.style.paddingLeft = `${9 + depth * 16}px`;
        if (open) el.classList.add('open');
        el.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          folderMenu(e.clientX, e.clientY, f);
        });
        tree.append(el);
        if (open) addFolders(f.id, depth + 1);
      }
    };
    addFolders(null, 0);
    tree.append(h('button', { class: 'btn ghost small', style: { justifyContent: 'flex-start', marginTop: '6px' }, onclick: () => folderDialog(null, typeof ui.folder === 'string' && folderById(ui.folder) ? ui.folder : null) }, ico('folderPlus'), 'New folder'));

    // toolbar
    const search = h('input', { placeholder: 'Search devices', value: ui.search, spellcheck: 'false' });
    search.addEventListener('input', () => {
      ui.search = search.value;
      renderList();
    });
    const crumbs = h('div', { class: 'crumbs grow' });
    if (ui.folder === 'all') crumbs.append('All devices');
    else if (ui.folder === 'none') crumbs.append('Not in a folder');
    else if (ui.folder === 'account') crumbs.append('My account');
    else {
      const path = folderPath(ui.folder);
      path.forEach((f, i) => {
        if (i) crumbs.append(h('span', { class: 'sep' }, '/'));
        crumbs.append(i < path.length - 1 ? h('span', { class: 'link', onclick: () => { ui.folder = f.id; renderDevices(); } }, f.name) : h('span', {}, f.name));
      });
    }
    const viewSeg = h('div', { class: 'seg' },
      h('button', { class: ui.view === 'grid' ? 'on' : '', title: 'Tiles', onclick: () => { ui.view = 'grid'; renderDevices(); } }, ico('grid')),
      h('button', { class: ui.view === 'list' ? 'on' : '', title: 'List', onclick: () => { ui.view = 'list'; renderDevices(); } }, ico('list')));
    const toolbar = h('div', { class: 'toolbar' }, crumbs,
      h('div', { class: 'search' }, ico('search'), search), viewSeg,
      h('button', { class: 'btn primary', onclick: () => deviceDialog() }, ico('plus'), 'Add device'));

    const listBox = h('div', { id: 'devList' });
    root.replaceChildren(h('div', { class: 'dev-layout' }, tree, h('div', {}, toolbar, listBox)));
    renderList();
  }

  function renderList() {
    const box = $('#devList');
    if (!box) return;
    const q = ui.search.trim().toLowerCase();
    const match = (d) => !q || [d.name, d.address, d.notes, PCIcons.os(d.os).label].some((v) => String(v || '').toLowerCase().includes(q));

    if (ui.folder === 'account') return renderAccountDevices(box, match);

    let devices = book.devices;
    let folders = [];
    if (ui.folder === 'none') devices = devices.filter((d) => !d.folder);
    else if (ui.folder !== 'all') {
      folders = q ? [] : childFolders(ui.folder);
      devices = q ? devices.filter((d) => descendants(ui.folder).has(d.folder)) : devices.filter((d) => d.folder === ui.folder);
    }
    devices = devices.filter(match).sort((a, b) => a.name.localeCompare(b.name));

    if (!devices.length && !folders.length) {
      box.replaceChildren(h('div', { class: 'empty' },
        h('b', {}, q ? 'Nothing matches that search' : book.devices.length ? 'This folder is empty' : 'No saved devices yet'),
        q ? '' : 'Add a computer or phone by its ID, IP address or ADB serial. Drag devices onto folders to sort them.',
        q ? null : h('div', { style: { marginTop: '14px' } }, h('button', { class: 'btn primary', onclick: () => deviceDialog() }, ico('plus'), 'Add device'))));
      return;
    }

    if (ui.view === 'list') {
      const rows = devices.map((d) => {
        const o = PCIcons.os(d.os);
        const tr = h('tr', { class: 'rowlink', draggable: 'true', ondblclick: () => connectEntry(d) },
          h('td', { style: { width: '44px' } }, h('div', { class: 'os-sm', style: { '--oc': o.color }, html: o.svg })),
          h('td', {}, h('b', {}, d.name), d.notes ? h('div', { class: 'faint', style: { fontSize: '12px' } }, d.notes) : null),
          h('td', { class: 'mono muted' }, targetLabel(d.address)),
          h('td', { class: 'muted' }, d.folder ? folderById(d.folder)?.name || '' : ''),
          h('td', { style: { textAlign: 'right', whiteSpace: 'nowrap' } }, actionButtons(d, true)));
        makeDraggable(tr, d);
        tr.addEventListener('contextmenu', (e) => (e.preventDefault(), deviceMenu(e.clientX, e.clientY, d)));
        return tr;
      });
      const ft = folders.map((f) => h('tr', { class: 'rowlink', onclick: () => { ui.folder = f.id; renderDevices(); } },
        h('td', {}, h('div', { class: 'os-sm', style: { '--oc': f.color || 'var(--muted)' }, html: PCIcons.UI.folder })),
        h('td', {}, h('b', {}, f.name)), h('td', { class: 'muted' }, `${countIn(f.id)} devices`), h('td'), h('td')));
      box.replaceChildren(h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th'), h('th', {}, 'Name'), h('th', {}, 'Address'), h('th', {}, 'Folder'), h('th'))), h('tbody', {}, ft, rows)));
      return;
    }

    const grid = h('div', { class: 'grid' });
    for (const f of folders) {
      const t = h('div', { class: 'tile folder-tile', style: { '--fc': f.color || 'var(--muted)' }, onclick: () => { ui.folder = f.id; renderDevices(); } },
        h('div', { class: 'os', html: PCIcons.UI.folder }),
        h('div', {}, h('div', { class: 'name' }, f.name), h('div', { class: 'addr' }, `${countIn(f.id)} devices`)));
      makeDropTarget(t, f.id);
      t.addEventListener('contextmenu', (e) => (e.preventDefault(), folderMenu(e.clientX, e.clientY, f)));
      grid.append(t);
    }
    for (const d of devices) grid.append(deviceTile(d));
    box.replaceChildren(grid);
  }

  function deviceTile(d) {
    const o = PCIcons.os(d.os);
    const online = accountDevices.find((a) => a.id === parseTarget(d.address)?.target);
    const t = h('div', { class: 'tile', draggable: 'true', ondblclick: () => connectEntry(d) },
      h('div', { class: 'os', style: { '--oc': o.color }, html: o.svg, title: o.label }),
      online ? h('span', { class: `dot status ${online.online ? 'ok' : ''}`, title: online.online ? 'Online' : 'Offline' }) : null,
      h('button', { class: 'btn ghost small icon more', title: 'More', onclick: (e) => { e.stopPropagation(); deviceMenu(e.clientX, e.clientY, d); } }, ico('more')),
      h('div', {}, h('div', { class: 'name', title: d.name }, d.name), h('div', { class: 'addr' }, targetLabel(d.address))),
      h('div', { class: 'meta' },
        h('span', { class: 'pill' }, MODE_LABEL[d.mode] || 'Desktop'),
        savedKeys[d.id] ? h('span', { class: 'pill', title: 'Password remembered on this computer' }, ico('lock'), 'Saved') : null,
        d.folder && ui.folder === 'all' ? h('span', { class: 'pill' }, folderById(d.folder)?.name || '') : null),
      h('div', { class: 'acts' }, actionButtons(d)));
    makeDraggable(t, d);
    t.addEventListener('contextmenu', (e) => (e.preventDefault(), deviceMenu(e.clientX, e.clientY, d)));
    return t;
  }

  function actionButtons(d, compact) {
    const isAndroid = d.mode === 'android' || /(^|#)adb:/i.test(d.address);
    const b = (mode, label, icon) => h('button', { class: `btn small ${compact ? '' : ''}`, title: label, onclick: (e) => { e.stopPropagation(); connectEntry(d, mode); } }, ico(icon), compact ? null : label);
    if (isAndroid) return [b('android', 'Open', 'phone')];
    return [b('desktop', 'Desktop', 'desktop'), b('terminal', 'Console', 'terminal')];
  }

  function connectEntry(d, mode) {
    connect({ address: d.address, mode: mode || d.mode || 'desktop', name: d.name, os: d.os, entryId: d.id });
    d.lastUsed = Date.now();
  }

  let dragId = null;
  function makeDraggable(el, d) {
    el.addEventListener('dragstart', (e) => {
      dragId = d.id;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', d.id);
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      dragId = null;
    });
  }
  function makeDropTarget(el, folderId) {
    if (folderId === null) return;
    el.addEventListener('dragover', (e) => {
      if (!dragId) return;
      e.preventDefault();
      el.classList.add('drop');
    });
    el.addEventListener('dragleave', () => el.classList.remove('drop'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drop');
      const d = book.devices.find((x) => x.id === dragId);
      if (!d) return;
      d.folder = folderId === '__none' ? null : folderId;
      saveBook();
      toast(`Moved ${d.name} to ${folderId === '__none' ? 'no folder' : folderById(folderId)?.name}`);
    });
  }

  function deviceMenu(x, y, d) {
    const isAndroid = d.mode === 'android' || /(^|#)adb:/i.test(d.address);
    const items = isAndroid
      ? [{ label: 'Open Android device', icon: 'phone', onClick: () => connectEntry(d, 'android') }]
      : [
        { label: 'Remote desktop', icon: 'desktop', onClick: () => connectEntry(d, 'desktop') },
        { label: 'Console', icon: 'terminal', onClick: () => connectEntry(d, 'terminal') },
        { label: 'Desktop + console', icon: 'both', onClick: () => connectEntry(d, 'both') },
      ];
    items.push('-', { label: 'Edit', icon: 'edit', onClick: () => deviceDialog(d) });
    items.push({ label: 'Copy address', icon: 'copy', onClick: () => (pc.invoke('copy', d.address), toast('Copied')) });
    if (savedKeys[d.id]) items.push({ label: 'Forget saved password', icon: 'lock', onClick: async () => { await pc.invoke('book:forget-password', d.id); savedKeys[d.id] = false; renderList(); toast('Saved password forgotten'); } });
    items.push('-', { label: 'Delete', icon: 'trash', danger: true, onClick: () => confirmDelete(d) });
    menu(x, y, items);
  }

  function confirmDelete(d) {
    modal({
      title: `Delete ${d.name}?`,
      body: h('p', { class: 'muted', style: { marginTop: 0 } }, 'It is removed from your device list (and from your account if you are signed in). Any password remembered for it is forgotten.'),
      actions: [{ label: 'Cancel' }, {
        label: 'Delete', danger: true, onClick: async () => {
          book.devices = book.devices.filter((x) => x.id !== d.id);
          removed.push(d.id);
          await saveBook();
        },
      }],
    });
  }

  function folderMenu(x, y, f) {
    menu(x, y, [
      { label: 'Open', icon: 'folder', onClick: () => { ui.folder = f.id; renderDevices(); } },
      { label: 'New folder inside', icon: 'folderPlus', onClick: () => folderDialog(null, f.id) },
      { label: 'Add device here', icon: 'plus', onClick: () => deviceDialog(null, f.id) },
      '-',
      { label: 'Rename / colour', icon: 'edit', onClick: () => folderDialog(f) },
      { label: 'Delete folder', icon: 'trash', danger: true, onClick: () => deleteFolder(f) },
    ]);
  }

  function deleteFolder(f) {
    const n = countIn(f.id);
    modal({
      title: `Delete folder ${f.name}?`,
      body: h('p', { class: 'muted', style: { marginTop: 0 } }, n ? `The ${n} device(s) and any sub-folders inside move up one level. Nothing else is deleted.` : 'The folder is empty.'),
      actions: [{ label: 'Cancel' }, {
        label: 'Delete folder', danger: true, onClick: async () => {
          for (const d of book.devices) if (d.folder === f.id) d.folder = f.parent || null;
          for (const c of book.folders) if (c.parent === f.id) c.parent = f.parent || null;
          book.folders = book.folders.filter((x) => x.id !== f.id);
          removed.push(f.id);
          if (ui.folder === f.id) ui.folder = f.parent || 'all';
          await saveBook();
        },
      }],
    });
  }

  function folderOptions(selected, exclude) {
    const sel = h('select', { class: 'input' }, h('option', { value: '' }, '— None —'));
    const bad = exclude ? descendants(exclude) : new Set();
    const add = (parent, depth) => {
      for (const f of childFolders(parent)) {
        if (bad.has(f.id)) continue;
        const o = h('option', { value: f.id }, `${' '.repeat(depth)}${f.name}`);
        if (f.id === selected) o.selected = true;
        sel.append(o);
        add(f.id, depth + 1);
      }
    };
    add(null, 0);
    return sel;
  }

  function folderDialog(existing, parent) {
    const f = existing ? { ...existing } : { id: `f-${uid()}`, name: '', parent: parent || null, color: FOLDER_COLORS[book.folders.length % FOLDER_COLORS.length] };
    const name = h('input', { class: 'input', value: f.name, maxlength: 60, placeholder: 'e.g. Home, Office, Clients' });
    const parentSel = folderOptions(f.parent, existing ? f.id : null);
    const sw = h('div', { class: 'swatches' });
    const paint = () => sw.replaceChildren(...FOLDER_COLORS.map((c) => h('button', { class: c === f.color ? 'on' : '', style: { '--c': c }, title: c, onclick: () => { f.color = c; paint(); } })));
    paint();
    modal({
      title: existing ? 'Edit folder' : 'New folder',
      body: [field('Name', name), field('Inside folder', parentSel), field('Colour', sw)],
      actions: [{ label: 'Cancel' }, {
        label: existing ? 'Save' : 'Create', primary: true, onClick: async () => {
          f.name = name.value.trim();
          if (!f.name) throw new Error('Give the folder a name.');
          f.parent = parentSel.value || null;
          if (existing) Object.assign(existing, f);
          else book.folders.push(f);
          if (f.parent) ui.open.add(f.parent);
          await saveBook();
        },
      }],
    });
  }

  function deviceDialog(existing, inFolder, preset) {
    const d = existing ? { ...existing } : { id: `d-${uid()}`, name: '', address: '', os: 'windows', folder: inFolder || (folderById(ui.folder) ? ui.folder : null), mode: 'desktop', notes: '', ...(preset || {}) };
    const name = h('input', { class: 'input', value: d.name, maxlength: 80, placeholder: 'e.g. Mum’s laptop' });
    const addr = h('input', { class: 'input mono', value: d.address, maxlength: 200, placeholder: '123 456 789  or  192.168.1.20  or  adb:R58N…', spellcheck: 'false' });
    const osPick = h('div', { class: 'os-pick' });
    const modeSel = h('select', { class: 'input' });
    const paintOs = () => {
      osPick.replaceChildren(...['windows', 'linux', 'android', 'macos', 'unknown'].map((k) => {
        const o = PCIcons.OS[k];
        return h('button', { type: 'button', class: d.os === k ? 'on' : '', style: { '--oc': o.color }, onclick: () => { d.os = k; paintOs(); paintModes(); } }, h('span', { html: o.svg }), o.label);
      }));
    };
    const paintModes = () => {
      const isAdb = /(^|#)adb:/i.test(addr.value);
      const opts = isAdb ? ['android'] : ['desktop', 'terminal', 'both'];
      if (!opts.includes(d.mode)) d.mode = opts[0];
      modeSel.replaceChildren(...opts.map((m) => {
        const o = h('option', { value: m }, MODE_LABEL[m]);
        if (m === d.mode) o.selected = true;
        return o;
      }));
    };
    addr.addEventListener('input', () => {
      if (/(^|#)adb:/i.test(addr.value) && d.os !== 'android') {
        d.os = 'android';
        paintOs();
      }
      paintModes();
    });
    modeSel.addEventListener('change', () => (d.mode = modeSel.value));
    paintOs();
    paintModes();
    const folderSel = folderOptions(d.folder);
    const notes = h('textarea', { class: 'input', rows: 2, maxlength: 500 }, d.notes || '');
    modal({
      title: existing ? 'Edit device' : 'Add device',
      wide: true,
      body: [
        field('Name', name),
        field('Address', addr, 'Pocket ID (through your server), IP address or hostname on your network (add :port if not 47100), adb:SERIAL for an Android device on this computer, or ID#adb:SERIAL for one plugged into another computer.'),
        field('Icon', osPick),
        h('div', { class: 'row', style: { gap: '12px' } }, h('div', { class: 'grow' }, field('Connect to', modeSel)), h('div', { class: 'grow' }, field('Folder', folderSel))),
        field('Notes', notes),
      ],
      actions: [{ label: 'Cancel' }, {
        label: existing ? 'Save' : 'Add device', primary: true, onClick: async () => {
          const p = parseTarget(addr.value);
          if (!p) throw new Error('That address is not valid. Use a 9-digit ID, an IP address or hostname, or adb:serial.');
          d.address = p.kind === 'id' ? p.target : addr.value.trim();
          d.name = name.value.trim() || targetLabel(d.address);
          d.folder = folderSel.value || null;
          d.mode = modeSel.value;
          d.notes = notes.value.trim();
          if (existing) Object.assign(existing, d);
          else book.devices.push(d);
          await saveBook();
          toast(existing ? 'Saved' : `${d.name} added`);
        },
      }],
    });
  }

  async function loadAccountDevices() {
    if (!S?.signedIn) {
      accountDevices = [];
      return;
    }
    try {
      accountDevices = (await pc.invoke('account:devices')).devices || [];
    } catch {
      accountDevices = [];
    }
  }

  function renderAccountDevices(box, match) {
    const list = accountDevices.filter((d) => match({ name: d.name || d.hostname, address: d.id, os: d.os }));
    if (!list.length) {
      box.replaceChildren(h('div', { class: 'empty' }, h('b', {}, 'No devices on your account yet'), 'Sign in to Pocket-Connect on each of your computers with the same account and they appear here automatically.'));
      return;
    }
    const grid = h('div', { class: 'grid' });
    for (const a of list) {
      const o = PCIcons.os(a.os);
      const saved = book.devices.find((d) => parseTarget(d.address)?.target === a.id);
      const isMe = a.id === S.device.id;
      grid.append(h('div', { class: 'tile', ondblclick: () => !isMe && connect({ address: a.id, mode: 'desktop', name: a.name || a.hostname, os: a.os, entryId: saved?.id }) },
        h('div', { class: 'os', style: { '--oc': o.color }, html: o.svg }),
        h('span', { class: `dot status ${a.online ? 'ok' : ''}`, title: a.online ? 'Online' : 'Offline' }),
        h('div', {}, h('div', { class: 'name' }, a.name || a.hostname || 'Device', isMe ? h('span', { class: 'faint' }, ' (this computer)') : null), h('div', { class: 'addr' }, `${formatId(a.id)} · ${a.online ? 'online' : `seen ${ago(a.last_seen)}`}`)),
        h('div', { class: 'acts' },
          isMe ? h('span', { class: 'faint', style: { fontSize: '12px' } }, 'You are here') : [
            h('button', { class: 'btn small', onclick: () => connect({ address: a.id, mode: 'desktop', name: a.name || a.hostname, os: a.os, entryId: saved?.id }) }, ico('desktop'), 'Desktop'),
            h('button', { class: 'btn small', onclick: () => connect({ address: a.id, mode: 'terminal', name: a.name || a.hostname, os: a.os, entryId: saved?.id }) }, ico('terminal'), 'Console'),
          ],
          saved || isMe ? null : h('button', { class: 'btn small icon', title: 'Save to my devices', onclick: () => deviceDialog(null, null, { name: a.name || a.hostname, address: a.id, os: a.os }) }, ico('plus')))));
    }
    box.replaceChildren(h('p', { class: 'muted', style: { marginTop: 0 } }, 'Computers signed in to your account. You can connect to them without a password if they allow it (Settings › Passwords).'), grid);
  }

  // ------------------------------------------------------------ nearby (LAN)
  let nearby = null;
  async function scanNearby() {
    nearby = 'scanning';
    renderNearby();
    nearby = (await pc.invoke('lan:discover')).filter((n) => !n.self);
    renderNearby();
  }

  function renderNearby() {
    const root = $('#view-nearby');
    const body = [];
    if (nearby === null) scanNearby();
    else if (nearby === 'scanning') body.push(h('div', { class: 'empty' }, h('b', {}, 'Looking for computers on your network…'), 'Pocket-Connect computers with LAN connections switched on reply in a second or two.'));
    else if (!nearby.length) body.push(h('div', { class: 'empty' }, h('b', {}, 'No other Pocket-Connect computers found'), 'They need Pocket-Connect running with "Accept direct connections on my network" on, and the same network. Some Wi-Fi networks block devices from seeing each other; you can still type an IP address above.'));
    else {
      const card = h('div', { class: 'card panel' });
      for (const n of nearby) {
        const o = PCIcons.os(n.os);
        const addr = n.port && n.port !== 47100 ? `${n.address}:${n.port}` : n.address;
        const saved = book.devices.find((d) => d.address === addr || (n.id && d.address === n.id));
        card.append(h('div', { class: 'list-row' },
          h('div', { class: 'os-sm', style: { '--oc': o.color }, html: o.svg }),
          h('div', { class: 'grow' }, h('b', {}, n.name || addr), h('small', {}, `${addr}${n.id ? ` · ID ${formatId(n.id)}` : ''}`)),
          h('button', { class: 'btn small', onclick: () => connect({ address: addr, mode: 'desktop', name: n.name, os: n.os, entryId: saved?.id }) }, ico('desktop'), 'Desktop'),
          h('button', { class: 'btn small', onclick: () => connect({ address: addr, mode: 'terminal', name: n.name, os: n.os, entryId: saved?.id }) }, ico('terminal'), 'Console'),
          saved ? h('span', { class: 'pill' }, 'Saved') : h('button', { class: 'btn small', onclick: () => deviceDialog(null, null, { name: n.name, address: addr, os: n.os }) }, ico('plus'), 'Save')));
      }
      body.push(card);
    }
    root.replaceChildren(
      h('div', { class: 'row' }, h('div', { class: 'grow' }, h('h1', {}, 'Nearby'), h('p', { class: 'lead' }, 'Pocket-Connect computers on your local network. Direct connections are encrypted end to end and never go through a server.')),
        h('button', { class: 'btn', onclick: scanNearby }, ico('refresh'), 'Scan again')),
      body);
  }

  // ------------------------------------------------------------ android
  let adbList = null;
  let adbTimer = null;
  async function loadAdb() {
    try {
      adbList = await pc.invoke('android:list');
    } catch (e) {
      adbList = { adb: true, devices: [], error: e.message };
    }
    if (ui.nav === 'android') renderAndroid(true);
  }

  function renderAndroid(fromTimer) {
    const root = $('#view-android');
    clearTimeout(adbTimer);
    if (ui.nav === 'android') adbTimer = setTimeout(loadAdb, 4000);
    if (!fromTimer && adbList === null) loadAdb();
    const blocks = [h('h1', {}, 'Android'), h('p', { class: 'lead' }, 'Control Android phones and tablets from this computer: see and touch the screen, type, press buttons and open a shell. Phones connect over USB or Wi-Fi using ADB. A phone plugged into another Pocket-Connect computer can be reached through that computer.')];

    if (adbList && !adbList.adb) {
      blocks.push(h('div', { class: 'card panel' },
        h('h2', {}, ico('usb'), 'ADB is needed'),
        h('p', {}, 'Pocket-Connect uses Google’s free Android platform-tools (adb). Download it, unzip it anywhere, then point Pocket-Connect at adb.'),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', onclick: () => pc.invoke('open-external', 'https://developer.android.com/tools/releases/platform-tools') }, 'Get platform-tools'),
          h('button', { class: 'btn', onclick: async () => { const p = await pc.invoke('android:pick-adb'); if (p) { toast('ADB found'); loadAdb(); } } }, 'Find adb on this computer…'))));
      root.replaceChildren(...blocks);
      return;
    }

    const card = h('div', { class: 'card panel' }, h('h2', {}, ico('phone'), 'Devices on this computer'));
    if (!adbList) card.append(h('p', {}, 'Looking…'));
    else if (adbList.error) card.append(h('div', { class: 'notice bad' }, adbList.error));
    else if (!adbList.devices.length) card.append(h('p', {}, 'No Android devices yet. Plug one in with USB debugging on, or connect over Wi-Fi below.'));
    for (const d of adbList?.devices || []) {
      const saved = book.devices.find((x) => x.address === `adb:${d.serial}`);
      const ok = d.state === 'device';
      card.append(h('div', { class: 'list-row' },
        h('div', { class: 'os-sm', style: { '--oc': PCIcons.OS.android.color }, html: PCIcons.OS.android.svg }),
        h('div', { class: 'grow' }, h('b', {}, d.model || d.serial), h('small', {}, `${d.serial} · ${d.transport === 'wifi' ? 'Wi-Fi' : 'USB'}`),
          !ok ? h('div', { class: 'notice warn', style: { marginTop: '6px' } }, d.state === 'unauthorized' ? 'Unlock the phone and tap "Allow" on the USB debugging prompt.' : `State: ${d.state}`) : null),
        ok ? h('button', { class: 'btn small primary', onclick: () => connect({ address: `adb:${d.serial}`, name: d.model || d.serial, os: 'android', entryId: saved?.id }) }, ico('phone'), 'Open') : null,
        ok && S.capabilities.scrcpy ? h('button', { class: 'btn small', title: 'Smooth full-speed video with scrcpy', onclick: () => pc.invoke('android:scrcpy', d.serial).catch((e) => toast(e.message, 'bad')) }, 'scrcpy') : null,
        d.transport === 'wifi' ? h('button', { class: 'btn small ghost', onclick: () => pc.invoke('android:disconnect', d.serial).then(loadAdb).catch((e) => toast(e.message, 'bad')) }, 'Disconnect') : null,
        saved ? h('span', { class: 'pill' }, 'Saved') : h('button', { class: 'btn small', onclick: () => deviceDialog(null, null, { name: d.model || d.serial, address: `adb:${d.serial}`, os: 'android', mode: 'android' }) }, ico('plus'), 'Save')));
    }

    const pairAddr = h('input', { class: 'input mono', placeholder: '192.168.1.50:37123' });
    const pairCode = h('input', { class: 'input mono', placeholder: '123456', maxlength: 6 });
    const conAddr = h('input', { class: 'input mono', placeholder: '192.168.1.50:5555' });
    const wifi = h('div', { class: 'card panel' },
      h('h2', {}, ico('wifi'), 'Connect over Wi-Fi'),
      h('p', {}, 'Android 11 or newer: Settings › Developer options › Wireless debugging › "Pair device with pairing code". Enter the address and code it shows. After pairing, connect using the address on the Wireless debugging screen.'),
      h('div', { class: 'inline-form' }, field('Pairing address', pairAddr), field('Code', pairCode),
        h('button', { class: 'btn', onclick: async (e) => { e.target.disabled = true; try { await pc.invoke('android:pair', pairAddr.value.trim(), pairCode.value.trim()); toast('Paired. Now connect below.'); } catch (err) { toast(err.message, 'bad'); } e.target.disabled = false; } }, 'Pair')),
      h('div', { class: 'inline-form', style: { marginTop: '12px' } }, field('Device address', conAddr),
        h('button', { class: 'btn primary', onclick: async (e) => { e.target.disabled = true; try { await pc.invoke('android:connect', conAddr.value.trim()); toast('Connected'); loadAdb(); } catch (err) { toast(err.message, 'bad'); } e.target.disabled = false; } }, 'Connect')));

    const remote = h('div', { class: 'card panel' },
      h('h2', {}, ico('link'), 'Phones on other computers'),
      h('p', {}, 'Plug a phone into any computer running Pocket-Connect. Then add a device with the address ID#adb:SERIAL (for example 123456789#adb:R58N12ABC) or IP#adb:SERIAL on your network. That computer must allow Android access in Settings.'),
      h('button', { class: 'btn', onclick: () => deviceDialog(null, null, { os: 'android', mode: 'android', address: '#adb:' }) }, ico('plus'), 'Add a remote Android device'));

    root.replaceChildren(...blocks, h('div', { class: 'panels' }, card, wifi, remote));
  }

  // ------------------------------------------------------------ account
  async function renderAccount() {
    const root = $('#view-account');
    const serverCard = serverPanel();
    const parts = [h('h1', {}, 'Account & server'), h('p', { class: 'lead' }, 'Your own Pocket-Connect server lets your devices find each other by ID from anywhere, keeps your device list in sync, and lets your own computers connect without passwords. Without a server, Pocket-Connect still works on your local network.')];
    if (!S.settings.serverUrl) {
      root.replaceChildren(...parts, h('div', { class: 'panels' }, serverCard));
      return;
    }
    const acct = S.signedIn ? await signedInPanel() : signInPanel();
    root.replaceChildren(...parts, h('div', { class: 'panels' }, acct, serverCard));
  }

  function serverPanel() {
    const url = h('input', { class: 'input mono', value: S.settings.serverUrl || '', placeholder: 'https://connect.example.com' });
    const pin = h('input', { class: 'input mono', value: S.settings.serverCertSha256 || '', placeholder: 'Only for private certificates' });
    const out = h('div');
    const card = h('div', { class: 'card panel' },
      h('h2', {}, ico('cloud'), 'Server'),
      h('p', {}, S.settings.serverUrl ? `Status: ${S.server.state}${S.server.detail ? ` – ${S.server.detail}` : ''}` : 'Not set. See docs/SERVER-SETUP.md to run one on a Proxmox VM or any Linux box with Docker.'),
      field('Server address', url),
      field('Certificate fingerprint (SHA-256)', pin, 'Leave empty for normal (Let’s Encrypt) certificates. For a LAN-only server with its own certificate, press Check and confirm the fingerprint matches the one on the server.'),
      out,
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: async () => {
          out.replaceChildren(h('p', {}, 'Checking…'));
          const r = await pc.invoke('server:probe', url.value);
          const items = [];
          if (r.health?.ok) items.push(h('div', { class: 'notice' }, `Found ${r.health.name} server ${r.health.version}.`));
          else items.push(h('div', { class: 'notice bad' }, r.health?.error || 'No Pocket-Connect server answered at that address.'));
          if (r.cert) {
            items.push(h('dl', { class: 'kv', style: { marginTop: '10px' } }, h('dt', {}, 'Certificate'), h('dd', {}, r.cert.subject || '?'), h('dt', {}, 'Issued by'), h('dd', {}, r.cert.issuer || '?'), h('dt', {}, 'Trusted'), h('dd', {}, r.cert.trusted ? 'yes (public CA)' : 'no – private certificate'), h('dt', {}, 'SHA-256'), h('dd', {}, r.cert.fingerprint256)));
            if (!r.cert.trusted) items.push(h('button', { class: 'btn small', onclick: () => (pin.value = r.cert.fingerprint256) }, 'Pin this certificate'));
          }
          out.replaceChildren(...items);
        } }, 'Check'),
        h('button', { class: 'btn primary', onclick: async () => {
          const changed = url.value.trim() !== (S.settings.serverUrl || '');
          if (changed && S.settings.serverUrl && !confirm('Changing server gives this computer a new ID and signs you out. Continue?')) return;
          S = await pc.invoke('server:set', { url: url.value.trim(), pin: pin.value.trim() });
          renderSide();
          renderAccount();
          toast(url.value.trim() ? 'Server saved' : 'Server removed');
        } }, 'Save'),
        S.settings.serverUrl ? h('button', { class: 'btn ghost danger', onclick: async () => { if (!confirm('Stop using the server? This computer will only be reachable on the local network.')) return; S = await pc.invoke('server:set', { url: '', pin: '' }); renderSide(); renderAccount(); } }, 'Remove') : null));
    return card;
  }

  function signInPanel() {
    let mode = 'login';
    const card = h('div', { class: 'card panel' });
    const draw = async () => {
      let canRegister = false;
      try {
        canRegister = (await pc.invoke('server:info')).registration;
      } catch {}
      const email = h('input', { class: 'input', type: 'email', placeholder: 'you@example.com', autocomplete: 'username' });
      const name = h('input', { class: 'input', placeholder: 'Your name' });
      const pw = h('input', { class: 'input', type: 'password', autocomplete: mode === 'login' ? 'current-password' : 'new-password' });
      const totp = h('input', { class: 'input mono hidden', placeholder: '6-digit code', maxlength: 6, inputmode: 'numeric' });
      const totpField = field('Two-factor code', totp);
      totpField.classList.add('hidden');
      const go2 = h('button', { class: 'btn primary' }, mode === 'login' ? 'Sign in' : 'Create account');
      go2.onclick = async () => {
        go2.disabled = true;
        try {
          if (mode === 'login') {
            const r = await pc.invoke('account:login', { email: email.value, password: pw.value, totp: totp.value });
            if (r.needTotp) {
              totpField.classList.remove('hidden');
              totp.classList.remove('hidden');
              totp.focus();
              toast('Enter the code from your authenticator app');
              return;
            }
          } else {
            await pc.invoke('account:register', { email: email.value, name: name.value, password: pw.value });
          }
          await refresh();
          await loadBook();
          await loadAccountDevices();
          renderAccount();
          toast('Signed in');
        } catch (e) {
          toast(e.message, 'bad');
        } finally {
          go2.disabled = false;
        }
      };
      for (const i of [email, pw, totp]) i.addEventListener('keydown', (e) => e.key === 'Enter' && go2.click());
      card.replaceChildren(
        h('h2', {}, ico('user'), mode === 'login' ? 'Sign in' : 'Create account'),
        h('p', {}, mode === 'login' ? 'Sign in with your account on this server.' : 'The first account on a new server becomes its administrator.'),
        field('Email', email), mode === 'register' ? field('Name', name) : null, field('Password', pw, mode === 'register' ? 'At least 10 characters.' : null), totpField,
        h('div', { class: 'row' }, go2, canRegister || mode === 'register' ? h('button', { class: 'btn ghost', onclick: () => { mode = mode === 'login' ? 'register' : 'login'; draw(); } }, mode === 'login' ? 'Create an account' : 'I already have an account') : null));
    };
    draw();
    return card;
  }

  async function signedInPanel() {
    const a = S.settings.account || {};
    const card = h('div', { class: 'card panel' },
      h('h2', {}, ico('user'), a.name || 'Signed in'),
      h('p', {}, a.email || ''),
      h('dl', { class: 'kv' }, h('dt', {}, 'Two-factor'), h('dd', {}, a.totp ? 'On' : 'Off'), h('dt', {}, 'This computer'), h('dd', {}, S.device.id ? `${formatId(S.device.id)} (on your account)` : '—')),
      h('div', { class: 'row', style: { flexWrap: 'wrap' } },
        a.totp ? h('button', { class: 'btn', onclick: disable2fa }, 'Turn off two-factor') : h('button', { class: 'btn primary', onclick: setup2fa }, ico('shield'), 'Turn on two-factor'),
        h('button', { class: 'btn', onclick: changePassword }, 'Change password'),
        h('button', { class: 'btn', onclick: async () => { await pc.invoke('account:attach'); toast('This computer is on your account'); } }, 'Re-attach this computer'),
        h('button', { class: 'btn ghost', onclick: async () => { await pc.invoke('account:logout'); await refresh(); accountDevices = []; renderAccount(); } }, 'Sign out'),
        h('button', { class: 'btn ghost danger', onclick: async () => { if (!confirm('Sign out on every computer and phone using this account?')) return; await pc.invoke('account:logout-all'); await refresh(); renderAccount(); } }, 'Sign out everywhere')));

    const devCard = h('div', { class: 'card panel' }, h('h2', {}, ico('grid'), 'Devices on this account'));
    await loadAccountDevices();
    if (!accountDevices.length) devCard.append(h('p', {}, 'None yet.'));
    for (const d of accountDevices) {
      const o = PCIcons.os(d.os);
      devCard.append(h('div', { class: 'list-row' },
        h('div', { class: 'os-sm', style: { '--oc': o.color }, html: o.svg }),
        h('div', { class: 'grow' }, h('b', {}, d.name || d.hostname || 'Device'), h('small', {}, `${formatId(d.id)} · ${d.online ? 'online' : `seen ${ago(d.last_seen)}`}`)),
        h('button', { class: 'btn small ghost', onclick: () => {
          const n = h('input', { class: 'input', value: d.name || d.hostname || '', maxlength: 60 });
          modal({ title: 'Rename device', body: field('Name', n), actions: [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: async () => { await pc.invoke('account:rename-device', d.id, n.value.trim()); renderAccount(); } }] });
        } }, 'Rename'),
        h('button', { class: 'btn small ghost danger', onclick: async () => { if (!confirm(`Remove ${d.name || d.id} from your account? It can then only be reached with its password.`)) return; await pc.invoke('account:detach', d.id); renderAccount(); } }, 'Remove')));
    }

    const auditCard = h('div', { class: 'card panel' }, h('h2', {}, ico('activity'), 'Recent account activity'));
    try {
      const { events } = await pc.invoke('account:audit');
      const nice = { login: 'Signed in', login_failed: 'Failed sign-in', login_failed_totp: 'Wrong two-factor code', register: 'Account created', device_attached: 'Device added', device_detached: 'Device removed', connect_request: 'Connection request', password_changed: 'Password changed', totp_enabled: 'Two-factor on', totp_disabled: 'Two-factor off' };
      const log = h('div', { class: 'log' });
      for (const e of events.slice(0, 25)) {
        let det = '';
        try {
          const d = JSON.parse(e.detail || '{}');
          det = [d.ip, e.device_id && formatId(e.device_id)].filter(Boolean).join(' · ');
        } catch {}
        log.append(h('div', {}, h('time', {}, new Date(e.at).toLocaleString()), h('span', { class: e.event.includes('failed') ? '' : '' , style: e.event.includes('failed') ? { color: 'var(--bad)' } : null }, nice[e.event] || e.event), h('span', { class: 'faint mono' }, det)));
      }
      auditCard.append(events.length ? log : h('p', {}, 'Nothing yet.'));
    } catch {}
    return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } }, card, devCard, auditCard);
  }

  async function setup2fa() {
    const r = await pc.invoke('account:2fa-setup');
    const qr = qrcode(0, 'M');
    qr.addData(r.uri);
    qr.make();
    const code = h('input', { class: 'input mono', maxlength: 6, placeholder: '123456', inputmode: 'numeric' });
    modal({
      title: 'Turn on two-factor sign-in',
      body: [
        h('p', { class: 'muted', style: { marginTop: 0 } }, 'Scan this with an authenticator app (Aegis, 2FAS, Google Authenticator, Microsoft Authenticator…), then type the 6-digit code it shows.'),
        h('div', { style: { textAlign: 'center', marginBottom: '12px' } }, h('span', { class: 'qr' }, h('img', { src: qr.createDataURL(4, 0), alt: 'QR code' }))),
        h('p', { class: 'faint mono', style: { fontSize: '12px', textAlign: 'center', wordBreak: 'break-all' } }, r.secret),
        field('Code from the app', code),
      ],
      actions: [{ label: 'Cancel' }, {
        label: 'Turn on', primary: true, onClick: async () => {
          await pc.invoke('account:2fa-enable', code.value.trim());
          await pc.invoke('settings:set', {});
          const me = await pc.invoke('account:me');
          S.settings.account.totp = me.user.totp;
          toast('Two-factor is on');
          await refresh();
          renderAccount();
        },
      }],
    });
  }

  function disable2fa() {
    const pw = h('input', { class: 'input', type: 'password' });
    const code = h('input', { class: 'input mono', maxlength: 6 });
    modal({
      title: 'Turn off two-factor',
      body: [field('Account password', pw), field('Current code', code)],
      actions: [{ label: 'Cancel' }, { label: 'Turn off', danger: true, onClick: async () => { await pc.invoke('account:2fa-disable', pw.value, code.value.trim()); toast('Two-factor is off'); await refresh(); renderAccount(); } }],
    });
  }

  function changePassword() {
    const cur = h('input', { class: 'input', type: 'password', autocomplete: 'current-password' });
    const n1 = h('input', { class: 'input', type: 'password', autocomplete: 'new-password' });
    const n2 = h('input', { class: 'input', type: 'password', autocomplete: 'new-password' });
    modal({
      title: 'Change account password',
      body: [field('Current password', cur), field('New password', n1, 'At least 10 characters. Other devices are signed out.'), field('Type it again', n2)],
      actions: [{ label: 'Cancel' }, {
        label: 'Change', primary: true, onClick: async () => {
          if (n1.value !== n2.value) throw new Error('The new passwords do not match.');
          await pc.invoke('account:password', cur.value, n1.value);
          toast('Password changed');
        },
      }],
    });
  }

  // ------------------------------------------------------------ settings
  function renderSettings() {
    const root = $('#view-settings');
    const s = S.settings;
    const setHost = async (patch) => {
      S.settings = await pc.invoke('settings:set', { host: patch });
      await refresh();
    };
    const name = h('input', { class: 'input', value: s.deviceName || '', placeholder: S.device.hostname });
    name.addEventListener('change', async () => {
      await pc.invoke('settings:set', { deviceName: name.value.trim() });
      refresh();
    });
    const confirmSel = h('select', { class: 'input' },
      ...[['never', 'Never ask'], ['guests', 'Ask, unless it is my account or the permanent password'], ['always', 'Always ask, even for me']].map(([v, l]) => {
        const o = h('option', { value: v }, l);
        if (s.host.confirm === v) o.selected = true;
        return o;
      }));
    confirmSel.addEventListener('change', () => setHost({ confirm: confirmSel.value }));
    const port = h('input', { class: 'input mono', type: 'number', min: 1024, max: 65535, value: s.host.lanPort, style: { width: '120px' } });
    port.addEventListener('change', () => setHost({ lanPort: Math.max(1024, Math.min(65535, Number(port.value) || 47100)) }));
    const theme = h('div', { class: 'seg' }, ...['system', 'dark', 'light'].map((t) => h('button', { class: s.ui.theme === t ? 'on' : '', onclick: async () => { await pc.invoke('settings:set', { ui: { theme: t } }); await refresh(); renderSettings(); } }, t[0].toUpperCase() + t.slice(1))));

    const caps = S.capabilities;
    const warnings = [];
    if (!caps.input) warnings.push(h('div', { class: 'notice warn' }, `Mouse and keyboard control is unavailable on this computer (${caps.inputError || 'input library missing'}). Others can view the screen only.`));
    if (caps.wayland) warnings.push(h('div', { class: 'notice warn' }, 'This Linux desktop uses Wayland. Screen sharing asks for permission each time, and remote mouse/keyboard needs an X11 session. Choose "Ubuntu on Xorg" (or similar) at the login screen for full unattended control.'));
    if (!S.encryption.strong) warnings.push(h('div', { class: 'notice warn' }, 'No system keyring was found, so saved passwords and keys are only lightly protected on disk. Install and unlock a keyring (GNOME Keyring or KWallet) for proper protection.'));

    root.replaceChildren(
      h('h1', {}, 'Settings'), h('p', { class: 'lead' }, 'Changes are saved straight away.'),
      ...warnings.map((w) => h('div', { style: { marginBottom: '10px' } }, w)),
      h('div', { class: 'panels' },
        h('div', { class: 'card panel' },
          h('h2', {}, ico('shield'), 'Incoming connections'),
          h('p', {}, 'What other people and devices may do on this computer.'),
          check('Allow incoming connections', 'Turn off to make this computer unreachable.', s.host.enabled, (v) => setHost({ enabled: v })),
          check('Remote desktop', 'See the screen and use mouse and keyboard.', s.host.allowDesktop, (v) => setHost({ allowDesktop: v })),
          check(`Console (${S.os === 'windows' ? 'PowerShell / Command Prompt' : 'shell'})`, caps.terminal ? 'A command line on this computer as your user.' : 'Not available: terminal library failed to load.', s.host.allowTerminal, (v) => setHost({ allowTerminal: v })),
          check('Android devices plugged into this computer', caps.adb ? 'Let viewers control phones connected here over ADB.' : 'ADB not found (see Android page).', s.host.allowAndroid !== false, (v) => setHost({ allowAndroid: v })),
          check('View only', 'Viewers can watch but not control.', s.host.viewOnly, (v) => setHost({ viewOnly: v })),
          check('Share clipboard', 'Copy and paste text between the two computers.', s.host.clipboard, (v) => setHost({ clipboard: v })),
          field('Ask before someone connects', confirmSel)),
        h('div', { class: 'card panel' },
          h('h2', {}, ico('key'), 'Passwords'),
          check('My account connects without a password', 'Computers signed in to your account skip the password. Turn off to always require it.', s.host.ownerNoPassword, (v) => setHost({ ownerNoPassword: v })),
          check('New one-time password after each session', 'A one-time password stops working once used.', s.host.rotateOneTime, (v) => setHost({ rotateOneTime: v })),
          h('button', { class: 'btn', onclick: permanentDialog }, S.hasPermanent ? 'Change permanent password' : 'Set permanent password'),
          h('p', { style: { marginTop: '12px' } }, 'After 3 wrong passwords this computer refuses further attempts for a growing time (up to 5 minutes).')),
        h('div', { class: 'card panel' },
          h('h2', {}, ico('wifi'), 'Local network'),
          check('Accept direct connections on my network', 'Others on your LAN can connect by IP address, with no server involved.', s.host.lanListen, (v) => setHost({ lanListen: v })),
          check('Private addresses only', 'Refuse direct connections from public internet addresses (recommended).', s.host.lanPrivateOnly, (v) => setHost({ lanPrivateOnly: v })),
          field('Port', port, 'TCP for connections, plus UDP port 47101 for "Nearby". Allow both in your firewall.'),
          h('dl', { class: 'kv' }, h('dt', {}, 'This computer'), h('dd', {}, S.lan.map((a) => a.address).join(', ') || '—'))),
        h('div', { class: 'card panel' },
          h('h2', {}, ico('settings'), 'General'),
          field('Name others see', name),
          check('Start with my computer', 'Runs in the background so this computer is reachable after a restart.', s.autostart, async (v) => { await pc.invoke('settings:set', { autostart: v }); refresh(); }),
          field('Theme', theme),
          h('dl', { class: 'kv' }, h('dt', {}, 'Version'), h('dd', {}, S.version), h('dt', {}, 'ADB'), h('dd', {}, caps.adb ? 'found' : 'not found'), h('dt', {}, 'scrcpy'), h('dd', {}, caps.scrcpy ? 'found' : 'not installed')),
          h('button', { class: 'btn small', onclick: () => pc.invoke('android:pick-adb').then(refresh) }, 'Choose adb location…'))));
  }

  // ------------------------------------------------------------ activity
  function renderActivity() {
    const root = $('#view-activity');
    const log = h('div', { class: 'log' });
    for (const a of S.activity) log.append(h('div', {}, h('time', {}, new Date(a.at).toLocaleString()), h('span', {}, a.text)));
    root.replaceChildren(h('h1', {}, 'Activity'), h('p', { class: 'lead' }, 'Connections to this computer since Pocket-Connect started.'),
      h('div', { class: 'card panel' }, S.activity.length ? log : h('p', {}, 'Nothing yet.')));
  }

  // ------------------------------------------------------------ start
  async function start() {
    hydrateIcons();
    setupSide();
    await refresh();
    await loadBook();
    await loadAccountDevices();
    render();
    pc.on('state', (st) => {
      const wasSigned = S?.signedIn;
      S = st;
      renderSide();
      if (wasSigned !== S.signedIn) loadAccountDevices().then(() => ui.nav === 'devices' && renderDevices());
      if (ui.nav === 'settings' && !document.activeElement?.matches('input,select')) renderSettings();
    });
    pc.on('sessions', (list) => renderLive(list));
    pc.on('activity', (list) => {
      if (S) S.activity = list;
      if (ui.nav === 'activity') renderActivity();
    });
    pc.on('book-changed', async () => {
      await loadBook();
      if (ui.nav === 'devices') renderDevices();
    });
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => applyTheme(S.settings.ui.theme));
    // Keep account presence fresh
    setInterval(async () => {
      if (!S?.signedIn) return;
      await loadAccountDevices();
      if (ui.nav === 'devices') renderList();
    }, 30_000);
    if (S.signedIn) pc.invoke('book:pull').then(loadBook).then(() => ui.nav === 'devices' && renderDevices()).catch(() => {});
  }

  start();
})();
