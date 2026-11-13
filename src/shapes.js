/* Pocket-Canvas — shapes for flowcharts and network diagrams
 * Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
 *
 * A "shape" card:  { type: 'shape', kind, label, sub?, w, h?, color }
 *  - flowchart shapes (process, decision…) stretch to the card's width and height (h), with the label inside;
 *  - network devices (router, switch…) are an icon with a name and a second line (e.g. an IP address) below;
 *  - "area" is a dashed box with a title, kept behind the other cards, for grouping (VLANs, swimlanes, rooms).
 * Shapes are joined with ordinary lines (see lines.js: elbow lines and line labels suit diagrams).
 */
'use strict';

// ---------- the shapes ----------
// Flowchart shapes are drawn in a 100×100 box that stretches with the card.
const FLOW_SHAPES = {
  process:     { name: 'Process', hint: 'A step or action', css: 'rect' },
  terminal:    { name: 'Start / end', hint: 'Where the flow starts or finishes', css: 'pill' },
  decision:    { name: 'Decision', hint: 'A yes/no question; two or more lines leave it', svg: '<polygon points="50,1 99,50 50,99 1,50"/>', pad: '24% 22%' },
  data:        { name: 'Input / output', hint: 'Data going in or out', svg: '<polygon points="16,1 99,1 84,99 1,99"/>', pad: '8px 18%' },
  document:    { name: 'Document', hint: 'A document or report', svg: '<path d="M1,1 H99 V84 C75,70 60,104 35,94 C20,88 10,84 1,90 Z"/>', pad: '8px 10px 18% 10px' },
  database:    { name: 'Database', hint: 'Stored data', svg: '<path d="M1,12 A49,11 0 0 1 99,12 V88 A49,11 0 0 1 1,88 Z"/><path d="M1,12 A49,11 0 0 0 99,12" fill="none"/>', pad: '24% 10px 10% 10px' },
  subprocess:  { name: 'Sub-process', hint: 'A step described elsewhere', svg: '<rect x="1" y="1" width="98" height="98"/><path d="M11,1 V99 M89,1 V99" fill="none"/>', pad: '8px 14%' },
  preparation: { name: 'Preparation', hint: 'Setting up for a step', svg: '<polygon points="16,1 84,1 99,50 84,99 16,99 1,50"/>', pad: '8px 17%' },
  manual:      { name: 'Manual step', hint: 'Something done by hand', svg: '<polygon points="1,1 99,1 85,99 15,99"/>', pad: '8px 17%' },
  delay:       { name: 'Delay / wait', hint: 'Waiting', svg: '<path d="M1,1 H60 A39,49 0 0 1 60,99 H1 Z"/>', pad: '8px 20% 8px 10px' },
  circle:      { name: 'Connector', hint: 'Joins flows, or links to another page', css: 'round' },
  area:        { name: 'Area / group', hint: 'A dashed box to group things (a VLAN, a room, a team)', css: 'area' }
};
const FLOW_ORDER = ['process', 'terminal', 'decision', 'data', 'document', 'database', 'subprocess', 'preparation', 'manual', 'delay', 'circle', 'area'];

// Network devices: line icons in a 48×48 box.
const NET_DEVICES = {
  internet: { name: 'Internet', color: '#3a7be0', svg: '<path d="M13 35h23a8 8 0 0 0 1.5-15.9A11 11 0 0 0 16.4 16 9.5 9.5 0 0 0 13 35z"/>' },
  modem:    { name: 'Modem / ONT', color: '#5f6b7a', svg: '<rect x="7" y="22" width="34" height="14" rx="3"/><path d="M15 22l-4-10M33 22l4-10"/><path d="M14 29h.01M19 29h.01M24 29h.01" stroke-width="3" stroke-linecap="round"/>' },
  router:   { name: 'Router', color: '#2a9d8f', svg: '<circle cx="24" cy="24" r="16"/><path d="M15 21h8l-3-3M23 21l-3 3M33 27h-8l3-3M25 27l3 3M21 15v8l3-3M21 23l-3-3M27 33v-8l-3 3M27 25l3 3" stroke-width="1.8"/>' },
  firewall: { name: 'Firewall', color: '#d0453b', svg: '<rect x="7" y="10" width="34" height="28" rx="1.5"/><path d="M7 19.3h34M7 28.6h34M18 10v9.3M30 10v9.3M12 19.3v9.3M24 19.3v9.3M36 19.3v9.3M18 28.6V38M30 28.6V38"/>' },
  switch:   { name: 'Switch', color: '#5a5bd1', svg: '<rect x="5" y="15" width="38" height="18" rx="3"/><path d="M12 21h12l-3-3M12 27h12M36 27H24l3 3M36 21H24" stroke-width="1.8"/><path d="M33 21l-3-3M15 27l3 3" stroke-width="1.8"/>' },
  wifi:     { name: 'Wireless access point', color: '#2f9bb5', svg: '<rect x="14" y="31" width="20" height="8" rx="3"/><path d="M24 31v-6"/><path d="M17 20a10 10 0 0 1 14 0M12.5 15.5a16.5 16.5 0 0 1 23 0M21 24a4.3 4.3 0 0 1 6 0"/>' },
  server:   { name: 'Server', color: '#5f6b7a', svg: '<rect x="10" y="6" width="28" height="11" rx="2"/><rect x="10" y="18.5" width="28" height="11" rx="2"/><rect x="10" y="31" width="28" height="11" rx="2"/><path d="M15 11.5h.01M15 24h.01M15 36.5h.01" stroke-width="3" stroke-linecap="round"/><path d="M22 11.5h11M22 24h11M22 36.5h11"/>' },
  vm:       { name: 'Virtual machine', color: '#8a55cf', svg: '<rect x="6" y="8" width="36" height="32" rx="3" stroke-dasharray="4 3"/><rect x="13" y="15" width="22" height="18" rx="2"/><path d="M18 21h12M18 27h8"/>' },
  storage:  { name: 'Storage / NAS', color: '#c99a1e', svg: '<ellipse cx="24" cy="12" rx="14" ry="5"/><path d="M10 12v24c0 2.8 6.3 5 14 5s14-2.2 14-5V12"/><path d="M10 24c0 2.8 6.3 5 14 5s14-2.2 14-5"/>' },
  desktop:  { name: 'Computer', color: '#3a7be0', svg: '<rect x="6" y="9" width="36" height="23" rx="2"/><path d="M19 39h10M24 32v7"/>' },
  laptop:   { name: 'Laptop', color: '#3a7be0', svg: '<rect x="10" y="12" width="28" height="19" rx="2"/><path d="M5 36h38l-3-5H8z"/>' },
  phone:    { name: 'Phone', color: '#4f9d4f', svg: '<rect x="15" y="6" width="18" height="36" rx="3.5"/><path d="M22 37h4"/>' },
  tablet:   { name: 'Tablet', color: '#4f9d4f', svg: '<rect x="9" y="8" width="30" height="32" rx="3.5"/><path d="M22 35h4"/>' },
  printer:  { name: 'Printer', color: '#5f6b7a', svg: '<path d="M14 18V8h20v10"/><rect x="7" y="18" width="34" height="14" rx="2"/><rect x="14" y="27" width="20" height="13"/><path d="M35 23h.01" stroke-width="3" stroke-linecap="round"/>' },
  camera:   { name: 'Camera (CCTV)', color: '#8a6d55', svg: '<path d="M8 14l24 7-3 9-24-7z"/><path d="M32 21l6-2v8l-7 1"/><path d="M13 25l-3 9H5M10 34v6"/>' },
  sensor:   { name: 'Sensor / IoT', color: '#db4f74', svg: '<circle cx="24" cy="28" r="6"/><path d="M16.5 20.5a10.5 10.5 0 0 1 15 0M11.5 15.5a17.5 17.5 0 0 1 25 0"/><path d="M24 34v6"/>' },
  phonevoip:{ name: 'Desk phone', color: '#4f9d4f', svg: '<rect x="8" y="20" width="32" height="18" rx="3"/><path d="M10 20c0-7 4-11 14-11s14 4 14 11"/><path d="M17 27h.01M24 27h.01M31 27h.01M17 32h.01M24 32h.01M31 32h.01" stroke-width="3" stroke-linecap="round"/>' },
  user:     { name: 'Person', color: '#e0673a', svg: '<circle cx="24" cy="16" r="7"/><path d="M10 41c0-8 6-13 14-13s14 5 14 13"/>' },
  building: { name: 'Site / building', color: '#8a7f70', svg: '<path d="M8 41V11l16-5v35M24 16l16 5v20M5 41h38"/><path d="M13 16h4M13 23h4M13 30h4M29 25h5M29 32h5"/>' }
};
const NET_ORDER = ['internet', 'modem', 'router', 'firewall', 'switch', 'wifi', 'server', 'vm', 'storage', 'desktop', 'laptop', 'phone', 'tablet', 'phonevoip', 'printer', 'camera', 'sensor', 'user', 'building'];

const isNetKind = (k) => !!NET_DEVICES[k];
const shapeKind = (c) => (FLOW_SHAPES[c.kind] || NET_DEVICES[c.kind] ? c.kind : 'process');
const shapeName = (k) => (FLOW_SHAPES[k] || NET_DEVICES[k] || FLOW_SHAPES.process).name;

// Size and colour a new shape starts with.
function shapeDefaults(kind) {
  if (isNetKind(kind)) return { kind, label: '', sub: '', w: 130, color: NET_DEVICES[kind].color };
  const size = { decision: [160, 120], circle: [70, 70], terminal: [160, 60], area: [420, 280], database: [130, 110] }[kind] || [170, 80];
  return { kind, label: kind === 'area' ? 'Area' : '', w: size[0], h: size[1], color: kind === 'area' ? '#8a7f70' : null };
}

// ---------- drawing a shape card ----------
function shapeIconSvg(kind, size = 48) {
  const d = NET_DEVICES[kind];
  if (d) return `<svg viewBox="0 0 48 48" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${d.svg}</svg>`;
  const f = FLOW_SHAPES[kind] || FLOW_SHAPES.process;
  const css = { rect: '<rect x="2" y="12" width="44" height="24" rx="2"/>', pill: '<rect x="2" y="14" width="44" height="20" rx="10"/>', round: '<circle cx="24" cy="24" r="14"/>', area: '<rect x="3" y="8" width="42" height="32" rx="5" stroke-dasharray="4 3"/>' }[f.css];
  if (css) return `<svg viewBox="0 0 48 48" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.2">${css}</svg>`;
  return `<svg viewBox="-2 -2 104 104" width="${size}" height="${size}" preserveAspectRatio="none" fill="none" stroke="currentColor" stroke-width="2.2" style="transform:scale(.9,.62)"><g vector-effect="non-scaling-stroke">${f.svg.replace(/<(polygon|path|rect)/g, '<$1 vector-effect="non-scaling-stroke"')}</g></svg>`;
}

function buildShapeHtml(c, el) {
  const kind = shapeKind(c);
  el.classList.add(isNetKind(kind) ? 'net' : 'flow', 'k-' + kind);
  if (isNetKind(kind)) {
    return `<div class="net-ico">${shapeIconSvg(kind, 48)}</div>
      <div class="net-label">${editable('label', c.label || '', shapeName(kind))}</div>
      <div class="net-sub">${editable('sub', c.sub || '', 'IP address or note')}</div>
      ${shapePlus()}`;
  }
  const f = FLOW_SHAPES[kind];
  el.style.height = (c.h || shapeDefaults(kind).h) + 'px';
  const body = f.svg
    ? `<svg class="sh-svg" viewBox="0 0 100 100" preserveAspectRatio="none">${f.svg.replace(/<(polygon|path|rect)/g, '<$1 vector-effect="non-scaling-stroke"')}</svg>`
    : `<div class="sh-box ${f.css}"></div>`;
  return `${body}<div class="sh-label${kind === 'area' ? ' area-title' : ''}" ${f.pad ? `style="padding:${f.pad}"` : ''}>${editable('label', c.label || '', kind === 'area' ? 'Area' : '')}</div>${kind === 'area' ? '' : shapePlus()}`;
}
// the four "+" buttons around a selected shape: add a connected shape that way
const shapePlus = () => ['top', 'right', 'bottom', 'left'].map((d) =>
  `<button class="sh-plus ${d}" data-act="shape-next" data-dir="${d}" title="Add a joined shape here (Shift+click: the usual next shape)" tabindex="-1">+</button>`).join('');

// ---------- adding shapes ----------
function addShape(kind, pos) {
  const c = addCard('shape', pos, shapeDefaults(kind));
  if (kind === 'area') { sendToBack([c.id]); renderBoard(); scheduleSave(); }
  startEditOf(c.id, '.editable');
  return c;
}

// "+" on a shape: a new shape of the same kind (after a decision, a process) beside it, joined by a line.
// The usual next shape: a step after a decision or start/end, otherwise the same again.
function nextShapeKind(c) {
  const k = shapeKind(c);
  return k === 'decision' || k === 'terminal' || k === 'area' ? 'process' : k;
}

// Clicking + asks which shape comes next (same tab as this shape); `kind` skips the question.
function addNextShape(c, dir, kind) {
  if (!kind) { openShapePicker(null, { next: { c, dir } }); return; }
  const el = cardEl(c.id); if (!el) return;
  checkpoint();
  const b = B();
  const d = shapeDefaults(kind);
  if (isNetKind(kind) && kind === shapeKind(c) && c.color) d.color = c.color;
  const cable = isNetKind(kind) || isNetKind(shapeKind(c));
  const r = { x: c.x, y: c.y, w: el.offsetWidth, h: el.offsetHeight };
  const nh = isNetKind(kind) ? r.h : d.h, nw = d.w;
  const gap = 70;
  const at = {
    right: { x: r.x + r.w + gap, y: r.y + r.h / 2 - nh / 2 }, left: { x: r.x - gap - nw, y: r.y + r.h / 2 - nh / 2 },
    bottom: { x: r.x + r.w / 2 - nw / 2, y: r.y + r.h + gap }, top: { x: r.x + r.w / 2 - nw / 2, y: r.y - gap - nh }
  }[dir];
  const n = makeCard(b, 'shape', at.x, at.y, d);
  const ld = lineDefaults();
  b.links.push({ id: uid(), from: c.id, to: n.id, arrow: cable ? 'none' : ld.arrow, dash: ld.dash, width: ld.width, shape: cable ? 'straight' : 'elbow' });
  renderBoard();
  selectOnly(n.id);
  scheduleSave();
  startEditOf(n.id, '.editable');
}

// Change a shape to another kind, keeping its words, colour and connections.
function changeShape(ids, kind) {
  checkpoint();
  const b = B();
  for (const id of ids) {
    const c = b.cards[id]; if (!c || c.type !== 'shape') continue;
    const wasNet = isNetKind(shapeKind(c));
    const d = shapeDefaults(kind);
    c.kind = kind;
    if (isNetKind(kind) !== wasNet) { c.w = d.w; if (d.h) c.h = d.h; else delete c.h; c.color = d.color; }
    else if (isNetKind(kind) && (!c.color || Object.values(NET_DEVICES).some((x) => x.color === c.color))) c.color = d.color;
    if (!isNetKind(kind) && !c.h) c.h = d.h;
  }
  renderBoard(); scheduleSave();
}

// ---------- the shape picker ----------
let shapePickTab = 'flow';
function openShapePicker(pos, opts = {}) {
  const body = document.createElement('div');
  body.className = 'shape-picker';
  const from = opts.next ? opts.next.c : opts.change ? B().cards[opts.change[0]] : null;
  if (from) shapePickTab = isNetKind(shapeKind(from)) ? 'net' : 'flow';
  const suggest = opts.next ? nextShapeKind(opts.next.c) : null;
  const render = () => {
    const list = shapePickTab === 'flow' ? FLOW_ORDER.map((k) => [k, FLOW_SHAPES[k].name, FLOW_SHAPES[k].hint]) : NET_ORDER.map((k) => [k, NET_DEVICES[k].name, '']);
    body.innerHTML = `<div class="sp-tabs" role="tablist">
        <button class="sp-tab ${shapePickTab === 'flow' ? 'on' : ''}" data-tab="flow">Flowchart</button>
        <button class="sp-tab ${shapePickTab === 'net' ? 'on' : ''}" data-tab="net">Network</button></div>
      <div class="sp-grid">${list.map(([k, name, hint]) =>
        `<button class="sp-item ${shapePickTab}${k === suggest ? ' suggest' : ''}" data-kind="${k}" title="${esc(hint || name)}" ${isNetKind(k) ? `style="color:${NET_DEVICES[k].color}"` : ''}>${shapeIconSvg(k, 40)}<span>${esc(name)}</span></button>`).join('')}</div>
      <p class="muted small sp-tip">${shapePickTab === 'flow'
        ? 'Tip: select a shape and click a <b>+</b> beside it to add the next step, already joined. Right-click a line for elbow lines and labels.'
        : 'Tip: type the device’s name, and an IP address or note underneath. Use <b>Area / group</b> (Flowchart tab) for VLANs and rooms.'}</p>`;
    body.querySelectorAll('.sp-tab').forEach((t) => t.onclick = () => { shapePickTab = t.dataset.tab; render(); });
    body.querySelectorAll('.sp-item').forEach((it) => it.onclick = () => {
      modal.close();
      if (opts.change) changeShape(opts.change, it.dataset.kind);
      else if (opts.next) addNextShape(opts.next.c, opts.next.dir, it.dataset.kind);
      else addShape(it.dataset.kind, pos);
    });
  };
  render();
  const actions = [{ label: 'Cancel' }];
  if (suggest) actions.push({ label: `Add ${shapeName(suggest)}`, primary: true, run: (close) => { close(null); addNextShape(opts.next.c, opts.next.dir, suggest); } });
  const title = opts.change ? 'Change shape' : opts.next ? 'Add the next shape' : 'Add a shape';
  const modal = openModal({ title, body, actions, wide: true });
  if (suggest) { const b = modal.el.querySelector('.primary-btn'); if (b) b.focus(); }
}

// ---------- right-click menu items for shapes ----------
function shapeMenuItems(c, ids) {
  const items = [{ label: 'Change shape…', run: () => openShapePicker(null, { change: ids }) }];
  if (shapeKind(c) !== 'area') {
    items.push({ label: 'Add the next shape…', run: () => addNextShape(c, isNetKind(shapeKind(c)) ? 'right' : 'bottom') });
  }
  return items;
}
