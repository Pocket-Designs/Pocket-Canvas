/* Pocket-Canvas — board templates (built-in and your own)
 * Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
 */
'use strict';

// A small helper for describing a template's cards.
function templateBuilder() {
  const t = { cards: [], boards: {}, links: [] };
  const add = (type, x, y, fields = {}) => {
    const c = { id: uid(), type, x, y, w: fields.w || DEFAULT_W[type] || 240, color: null, ...cardDefaults(type), ...fields };
    t.cards.push(c);
    return c;
  };
  const col = (x, y, title, color, kids = [], w) => {
    const c = add('column', x, y, { title, color, ...(w ? { w } : {}) });
    for (const [type, f] of kids) {
      const k = add(type, 0, 0, f);
      k.col = c.id;
      c.items.push(k.id);
    }
    return c;
  };
  const line = (a, b, extra = {}) => t.links.push({ id: uid(), from: a.id, to: b.id, ...extra });
  const board = (x, y, title, color, fill, icon = 'board') => {
    const inner = templateBuilder();
    if (fill) fill(inner);
    const sb = { id: uid(), title, parentId: null, color, icon, cards: {}, order: [], links: inner.t.links, view: DEFAULT_VIEW() };
    for (const c of inner.t.cards) {
      sb.cards[c.id] = c; sb.order.push(c.id);
      if (c.type === 'board' && inner.t.boards[c.boardId]) inner.t.boards[c.boardId].parentId = sb.id;
    }
    Object.assign(t.boards, inner.t.boards);
    t.boards[sb.id] = sb;
    return add('board', x, y, { boardId: sb.id, color });
  };
  return { t, add, col, line, board };
}

const tplNote = (html, extra = {}) => ['note', { html, ...extra }];
const tplTodo = (title, items, extra = {}) => ['todo', { title, items: items.map((text) => ({ id: uid(), text, done: false })), ...extra }];

const BUILTIN_TEMPLATES = [
  {
    id: 'builtin-moodboard', icon: 'palette', name: 'Mood board', color: '#c4579f',
    description: 'Collect pictures, colours and words that capture a feeling or style.',
    build() {
      const { t, add, col } = templateBuilder();
      add('heading', 40, 30, { text: 'Mood board', w: 420 });
      add('note', 40, 100, { w: 300, html: '<p><b>The feeling</b></p><p>Describe the mood in a few words: calm, bold, cosy, playful…</p>', color: '#c4579f' });
      for (let i = 0; i < 6; i++) add('image', 380 + (i % 3) * 250, 100 + Math.floor(i / 3) * 230, { w: 230 });
      const sw = ['#2f3e46', '#84a98c', '#f2cc8f', '#e07a5f', '#f4f1de'];
      sw.forEach((hex, i) => add('swatch', 380 + i * 150, 580, { hex, title: ['Deep', 'Soft', 'Warm', 'Accent', 'Light'][i], nameAuto: false }));
      add('heading', 380, 530, { text: 'Palette', w: 300 });
      col(40, 280, 'Keywords', '#e8a33d', [tplNote('<p>texture</p>'), tplNote('<p>light</p>'), tplNote('<p>materials</p>')], 300);
      col(1150, 100, 'Inspiration links', '#3a7be0', [['link', {}], ['link', {}]], 280);
      return t;
    }
  },
  {
    id: 'builtin-storyboard', icon: 'film', name: 'Storyboard', color: '#3a7be0',
    description: 'Plan a video, comic or presentation scene by scene.',
    build() {
      const { t, add, col, line } = templateBuilder();
      add('heading', 40, 30, { text: 'Storyboard', w: 420 });
      add('note', 40, 95, { w: 860, html: '<p><b>Story in one sentence:</b> …</p>', color: '#3a7be0' });
      const scenes = [];
      for (let i = 0; i < 6; i++) {
        scenes.push(col(40 + (i % 3) * 320, 190 + Math.floor(i / 3) * 470, `Scene ${i + 1}`, null, [
          ['sketch', { vw: 640, vh: 400 }],
          tplNote('<p><b>Action:</b> …</p><p><b>Dialogue / sound:</b> …</p><p><b>Shot:</b> wide / close-up / pan</p>')
        ], 290));
      }
      for (let i = 0; i < 5; i++) line(scenes[i], scenes[i + 1]);
      return t;
    }
  },
  {
    id: 'builtin-projectplan', icon: 'rocket', name: 'Project plan', color: '#5bb276',
    description: 'Goals, a to do / doing / done board, timeline table and meeting notes.',
    build() {
      const { t, add, col, board } = templateBuilder();
      add('heading', 40, 30, { text: 'Project plan', w: 420 });
      add('note', 40, 100, { w: 300, color: '#5bb276', html: '<p><b>Goal</b></p><p>What does success look like?</p><p><br></p><p><b>Deadline:</b> …</p><p><b>Team:</b> …</p>' });
      add('todo', 40, 330, { w: 300, title: 'Milestones', items: ['Plan agreed', 'First version', 'Feedback', 'Launch'].map((text) => ({ id: uid(), text, done: false })) });
      col(380, 100, 'To do', '#e8a33d', [tplNote('<p>First task</p>'), tplNote('<p>Second task</p>')]);
      col(690, 100, 'Doing', '#3a7be0', [tplNote('<p>In progress…</p>')]);
      col(1000, 100, 'Done', '#5bb276', []);
      add('heading', 380, 470, { text: 'Timeline', w: 300 });
      add('table', 380, 530, { w: 620, header: true, rows: [['Task', 'Who', 'Due', 'Status'], ['', '', '', ''], ['', '', '', ''], ['', '', '', '']] });
      board(1040, 530, 'Meeting notes', '#6a5fd6', ({ add: a }) => {
        a('heading', 40, 30, { text: 'Meeting notes', w: 400 });
        a('note', 40, 100, { w: 320, html: '<p><b>Date:</b></p><p><b>Attending:</b></p><p><br></p><p><b>Notes</b></p><ul><li></li></ul>' });
        a('todo', 400, 100, { title: 'Actions', items: [{ id: uid(), text: '', done: false }] });
      }, 'chat');
      board(1200, 530, 'Files & resources', '#8a7f70', null, 'folder');
      return t;
    }
  },
  {
    id: 'builtin-mindmap', icon: 'idea', name: 'Mind map', color: '#e0673a',
    description: 'One central idea with branches you can grow in any direction.',
    build() {
      const { t, add, line } = templateBuilder();
      const centre = add('note', 520, 300, { w: 220, color: '#e0673a', html: '<h2>Main idea</h2>' });
      const pos = [[160, 80], [560, 40], [960, 80], [1000, 380], [560, 560], [140, 420]];
      pos.forEach(([x, y], i) => {
        const n = add('note', x, y, { w: 200, color: COLORS[(i + 1) % 9], html: `<p><b>Branch ${i + 1}</b></p><p>…</p>` });
        line(centre, n, { arrow: false });
      });
      return t;
    }
  },
  {
    id: 'builtin-week', icon: 'calendar', name: 'Weekly planner', color: '#38a3a5',
    description: 'A column for each day, with a focus for the week.',
    build() {
      const { t, add, col } = templateBuilder();
      add('heading', 40, 30, { text: 'This week', w: 420 });
      add('note', 40, 95, { w: 600, color: '#38a3a5', html: '<p><b>Focus this week:</b> …</p>' });
      ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].forEach((d, i) => {
        col(40 + i * 260, 190, d, i > 4 ? '#c4579f' : '#38a3a5', [tplTodo('', ['', ''])], 240);
      });
      return t;
    }
  },
  {
    id: 'builtin-brainstorm', icon: 'chat', name: 'Brainstorm', color: '#e8a33d',
    description: 'Scatter ideas freely, then pick the best ones.',
    build() {
      const { t, add, col } = templateBuilder();
      add('heading', 40, 30, { text: 'Brainstorm: …', w: 500 });
      add('note', 40, 100, { w: 300, html: '<p><b>The question</b></p><p>What are we trying to solve?</p>' });
      const tints = ['#e8a33d', '#5bb276', '#3a7be0', '#c4579f', '#e0673a', '#d9bf2b'];
      for (let i = 0; i < 8; i++) {
        add('note', 380 + (i % 4) * 230, 100 + Math.floor(i / 4) * 170, { w: 200, color: tints[i % tints.length], html: '<p>Idea…</p>' });
      }
      col(1330, 100, 'Best ideas', '#5bb276', [], 260);
      add('sketch', 40, 300, { w: 300, vw: 600, vh: 420 });
      return t;
    }
  }
];

// ---------- Applying templates ----------
function payloadBounds(p) {
  const top = p.cards.filter((c) => !c.col);
  if (!top.length) return { x: 0, y: 0 };
  return { x: Math.min(...top.map((c) => c.x)), y: Math.min(...top.map((c) => c.y)) };
}

function templatePayload(tpl) {
  return tpl.build ? tpl.build() : JSON.parse(JSON.stringify(tpl.payload));
}

// Templates always start at the board's top-left corner. On a board that already has
// cards, the template goes at the left edge, below everything that's there.
const TEMPLATE_MARGIN = 40;

function contentBottom() {
  let bottom = -Infinity;
  for (const el of $$(':scope > .card', cardsEl)) {
    const c = B().cards[el.dataset.id];
    if (c) bottom = Math.max(bottom, c.y + el.offsetHeight);
  }
  return bottom;
}

function useTemplate(tpl, mode, pos) {
  const payload = templatePayload(tpl);
  const bb = payloadBounds(payload);
  checkpoint();
  if (mode === 'new-board') {
    const p = pos || viewCentre();
    const host = B();
    const card = makeCard(host, 'board', p.x - 65, p.y - 60, { title: tpl.name, color: tpl.color || '#8a7f70', icon: tpl.icon || 'board' });
    const child = store.boards[card.boardId];
    insertPayload(payload, TEMPLATE_MARGIN - bb.x, TEMPLATE_MARGIN - bb.y, child);
    child.view = DEFAULT_VIEW();
    scheduleSave();
    go(child.id);
    requestAnimationFrame(() => requestAnimationFrame(fitContent));
  } else {
    const bottom = contentBottom();
    const top = isFinite(bottom) ? Math.round(bottom + 80) : TEMPLATE_MARGIN;
    const added = insertPayload(payload, TEMPLATE_MARGIN - bb.x, top - bb.y);
    // Scroll so the template's top-left corner is in view.
    const v = B().view;
    v.x = ORIGIN_PAD;
    v.y = ORIGIN_PAD - (top - TEMPLATE_MARGIN) * v.z;
    renderBoard(); renderTree();
    selected.clear(); added.forEach((id) => selected.add(id)); refreshSelection();
    scheduleSave();
  }
  toast(`“${tpl.name}” added`);
}

// ---------- Saving your own ----------
function stripComments(payload) {
  const strip = (c) => { delete c.comments; delete c._mt; };
  payload.cards.forEach(strip);
  Object.values(payload.boards).forEach((b) => { delete b._mt; Object.values(b.cards).forEach(strip); b.links.forEach((l) => delete l._mt); });
  payload.links.forEach((l) => delete l._mt);
  return payload;
}

async function saveBoardAsTemplate(boardId) {
  const board = store.boards[boardId];
  if (!board) return;
  const ids = board.order.filter((id) => board.cards[id] && !board.cards[id].col);
  if (!ids.length) { toast('This board is empty, so there’s nothing to save as a template'); return; }
  const v = await askText({
    title: 'Save as a template',
    ok: 'Save template',
    fields: [
      { name: 'name', label: 'Template name', value: board.title === 'Home' ? '' : board.title, placeholder: 'e.g. Client project' },
      { name: 'description', label: 'Description (optional)', placeholder: 'What is it for?', multiline: true, required: false }
    ]
  });
  if (!v) return;
  const payload = stripComments(serialize(ids, board));
  checkpoint();
  const id = uid();
  store.templates[id] = { id, name: v.name.slice(0, 80), description: (v.description || '').slice(0, 300), color: board.color || '#8a7f70', icon: board.icon || 'board', created: Date.now(), payload };
  scheduleSave();
  toast(`Saved “${v.name}” to your templates`);
}

// ---------- Gallery ----------
const PREVIEW_FILL = { note: '#ffffff', heading: 'transparent', todo: '#ffffff', link: '#ffffff', image: '#d9d3c9', file: '#efebe4', board: '#8a7f70', column: '#e2ddd4', swatch: '#e0673a', table: '#ffffff', sketch: '#fffdf8', media: '#3a3834' };

function estHeight(c, cards) {
  switch (c.type) {
    case 'heading': return 34;
    case 'note': return 110;
    case 'todo': return 40 + (c.items || []).length * 26;
    case 'link': return 80;
    case 'image': return c.w * 0.7;
    case 'file': return 64;
    case 'board': return 120;
    case 'swatch': return 130;
    case 'table': return 34 * (c.rows || []).length + 30;
    case 'sketch': return c.w * (c.vh / c.vw);
    case 'media': return c.kind === 'video' ? c.w * 0.62 : 120;
    case 'column': return 50 + (c.items || []).reduce((h, id) => { const k = cards.find((x) => x.id === id); return h + (k ? estHeight({ ...k, w: c.w - 16 }, cards) + 8 : 0); }, 0);
    default: return 100;
  }
}

function previewSvg(payload) {
  const top = payload.cards.filter((c) => !c.col);
  if (!top.length) return '<svg viewBox="0 0 100 60"></svg>';
  const rects = top.map((c) => ({ c, x: c.x, y: c.y, w: c.type === 'board' ? 130 : c.type === 'swatch' ? 140 : c.w, h: estHeight(c, payload.cards) }));
  const x1 = Math.min(...rects.map((r) => r.x)), y1 = Math.min(...rects.map((r) => r.y));
  const x2 = Math.max(...rects.map((r) => r.x + r.w)), y2 = Math.max(...rects.map((r) => r.y + r.h));
  const pad = 30;
  const shapes = rects.map(({ c, x, y, w, h }) => {
    const fill = c.type === 'swatch' ? safeColor(c.hex) : c.type === 'board' ? safeColor(c.color || '#8a7f70') : PREVIEW_FILL[c.type] || '#fff';
    if (c.type === 'heading') return `<rect x="${x}" y="${y + 8}" width="${Math.min(w, 300)}" height="20" rx="4" fill="#57534e"/>`;
    const accent = c.color && c.type !== 'board' ? `<rect x="${x}" y="${y}" width="${c.type === 'column' ? w : 6}" height="${c.type === 'column' ? 6 : h}" fill="${safeColor(c.color)}"/>` : '';
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}" stroke="#00000018"/>${accent}`;
  }).join('');
  return `<svg viewBox="${x1 - pad} ${y1 - pad} ${x2 - x1 + pad * 2} ${y2 - y1 + pad * 2}" preserveAspectRatio="xMidYMid meet">${shapes}</svg>`;
}

function openTemplates(mode = 'new-board', pos = null) {
  const mine = Object.values(store.templates || {}).sort((a, b) => b.created - a.created);
  const tile = (tpl, own) => `
    <div class="tpl" data-id="${esc(tpl.id)}" data-own="${own ? 1 : ''}" tabindex="0">
      <div class="tpl-prev">${previewSvg(templatePayload(tpl))}</div>
      <div class="tpl-name"><span class="tpl-dot" style="background:${safeColor(tpl.color || '#8a7f70')}">${boardIconImg({ icon: tpl.icon })}</span>${esc(tpl.name)}</div>
      <div class="tpl-desc">${esc(tpl.description || '')}</div>
      ${own ? '<div class="tpl-own"><button data-tpl="rename">Rename</button><button data-tpl="delete" class="danger">Delete</button></div>' : ''}
    </div>`;
  const body = document.createElement('div');
  body.className = 'tpl-gallery';
  body.innerHTML = `
    ${mode === 'new-board' ? `<div class="tpl-grid"><div class="tpl blank" data-id="blank" tabindex="0"><div class="tpl-prev blank-prev">+</div><div class="tpl-name">Blank board</div><div class="tpl-desc">Start from nothing.</div></div></div>` : ''}
    <h3>Ready-made</h3>
    <div class="tpl-grid">${BUILTIN_TEMPLATES.map((t) => tile(t, false)).join('')}</div>
    <h3>My templates</h3>
    ${mine.length ? `<div class="tpl-grid">${mine.map((t) => tile(t, true)).join('')}</div>`
      : '<p class="muted">You haven’t saved any yet. Open a board you like, then choose <b>File › Save Board as Template…</b>, or right-click a board card › <b>Save as a template…</b></p>'}`;
  const m = openModal({ title: mode === 'new-board' ? 'New board from a template' : 'Insert a template on this board', body, wide: true });
  body.addEventListener('click', async (e) => {
    const t = e.target.closest('.tpl');
    if (!t) return;
    const id = t.dataset.id;
    const own = store.templates[id];
    const act = e.target.closest('[data-tpl]');
    if (act && own) {
      e.stopPropagation();
      if (act.dataset.tpl === 'delete') {
        if (!(await api.confirm(`Delete the template “${own.name}”?`, 'Boards you made from it are not affected.'))) return;
        checkpoint(); delete store.templates[id]; scheduleSave();
        m.close(); openTemplates(mode, pos);
      } else {
        const v = await askText({ title: 'Rename template', fields: [{ name: 'name', label: 'Name', value: own.name }, { name: 'description', label: 'Description', value: own.description || '', multiline: true, required: false }] });
        if (!v) return;
        checkpoint(); own.name = v.name.slice(0, 80); own.description = (v.description || '').slice(0, 300); scheduleSave();
        m.close(); openTemplates(mode, pos);
      }
      return;
    }
    m.close();
    if (id === 'blank') { addTool('board', pos || viewCentre()); return; }
    const tpl = own || BUILTIN_TEMPLATES.find((x) => x.id === id);
    if (tpl) useTemplate(tpl, mode, pos);
  });
  body.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList.contains('tpl')) e.target.click(); });
}
