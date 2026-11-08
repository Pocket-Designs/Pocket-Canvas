/* Pocket-Canvas — comments on cards
 * Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
 */
'use strict';

let commentsFor = null;      // { board, id }
let showResolved = false;

function cardLabel(c) {
  const names = { note: 'Note', heading: 'Heading', todo: 'To-do list', link: 'Link', image: 'Picture', file: 'File', board: 'Board', column: 'Column', swatch: 'Colour', table: 'Table', sketch: 'Sketch', media: c.kind === 'video' ? 'Video' : 'Audio' };
  const t = (cardText(c) || '').split('\n').find((l) => l.trim()) || '';
  return t ? t.slice(0, 60) : names[c.type] || 'Card';
}

function authorColor(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % (COLORS.length - 1)];
}

function openComments(id) {
  const c = B().cards[id];
  if (!c) return;
  blurEditing();
  commentsFor = { board: cur, id };
  selectOnly(id);
  $('#comments-panel').hidden = false;
  renderComments();
  requestAnimationFrame(() => $('#cmt-input') && $('#cmt-input').focus());
}

function closeComments() {
  commentsFor = null;
  $('#comments-panel').hidden = true;
}

// Called after every board redraw.
function refreshComments() {
  if (!commentsFor) return;
  if (commentsFor.board !== cur || !B().cards[commentsFor.id]) { closeComments(); return; }
  const input = $('#cmt-input');
  const draft = input ? input.value : '';
  const focused = input && document.activeElement === input;
  renderComments();
  const again = $('#cmt-input');
  if (again) { again.value = draft; if (focused) again.focus(); }
}

function renderComments() {
  const panel = $('#comments-panel');
  const c = commentsFor && store.boards[commentsFor.board] && store.boards[commentsFor.board].cards[commentsFor.id];
  if (!c) { closeComments(); return; }
  const all = c.comments || [];
  const resolved = all.filter((m) => m.resolved).length;
  const list = all.filter((m) => showResolved || !m.resolved);
  panel.innerHTML = `
    <div class="cmt-head">
      <div><div class="cmt-title">Comments</div><div class="cmt-sub" title="${esc(cardLabel(c))}">${esc(cardLabel(c))}</div></div>
      <button class="icon-btn" data-cmt="close" title="Close (Esc)">✕</button>
    </div>
    <div class="cmt-list">
      ${list.length ? list.map((m) => `
        <div class="cmt ${m.resolved ? 'resolved' : ''}" data-id="${esc(m.id)}">
          <div class="cmt-meta">
            <span class="cmt-avatar" style="background:${authorColor(m.author)}">${esc((m.author || '?')[0].toUpperCase())}</span>
            <span class="cmt-author">${esc(m.author || 'Someone')}</span>
            <span class="cmt-time" title="${esc(new Date(m.at).toLocaleString())}">${esc(timeAgo(m.at))}${m.edited ? ' · edited' : ''}</span>
          </div>
          <div class="cmt-text">${esc(m.text)}</div>
          <div class="cmt-actions">
            <button data-cmt="resolve">${m.resolved ? 'Reopen' : 'Resolve'}</button>
            <button data-cmt="edit">Edit</button>
            <button data-cmt="delete" class="danger">Delete</button>
          </div>
        </div>`).join('') : `<div class="cmt-empty">${all.length ? 'All comments are resolved.' : 'No comments yet. Add a thought, question or reminder about this card.'}</div>`}
    </div>
    ${resolved ? `<label class="cmt-toggle"><input type="checkbox" data-cmt="show-resolved" ${showResolved ? 'checked' : ''}> Show resolved (${resolved})</label>` : ''}
    <div class="cmt-compose">
      <textarea id="cmt-input" rows="3" placeholder="Write a comment…  (Ctrl+Enter to post)"></textarea>
      <div class="cmt-compose-row">
        <span class="cmt-as">as <button data-cmt="name" title="Change your name">${esc(settingsCache.userName || 'Me')}</button></span>
        <button class="primary-btn" data-cmt="post">Comment</button>
      </div>
    </div>`;
}

function currentCommentCard() {
  return commentsFor && store.boards[commentsFor.board] && store.boards[commentsFor.board].cards[commentsFor.id];
}

function postComment() {
  const input = $('#cmt-input');
  const text = input.value.trim();
  const c = currentCommentCard();
  if (!text || !c) return;
  checkpoint();
  c.comments = [...(c.comments || []), { id: uid(), author: settingsCache.userName || 'Me', text: text.slice(0, 5000), at: Date.now() }];
  input.value = '';
  rerenderCard(c.id);
  renderComments();
  scheduleSave();
  requestAnimationFrame(() => { const l = $('.cmt-list'); if (l) l.scrollTop = l.scrollHeight; $('#cmt-input').focus(); });
}

function initComments() {
  const panel = $('#comments-panel');
  panel.addEventListener('pointerdown', (e) => e.stopPropagation());
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); closeComments(); }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.id === 'cmt-input') { e.preventDefault(); postComment(); }
    e.stopPropagation();
  });
  panel.addEventListener('change', (e) => {
    if (e.target.dataset.cmt === 'show-resolved') { showResolved = e.target.checked; renderComments(); }
  });
  panel.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-cmt]');
    if (!btn) return;
    const act = btn.dataset.cmt;
    if (act === 'close') return closeComments();
    if (act === 'post') return postComment();
    if (act === 'name') return openSettings('general');
    const c = currentCommentCard();
    const row = btn.closest('.cmt');
    const m = c && row && (c.comments || []).find((x) => x.id === row.dataset.id);
    if (!m) return;
    if (act === 'resolve') { checkpoint(); m.resolved = !m.resolved; }
    if (act === 'delete') {
      checkpoint();
      c.comments = c.comments.filter((x) => x !== m);
      if (!c.comments.length) delete c.comments;
    }
    if (act === 'edit') {
      const v = await askText({ title: 'Edit comment', fields: [{ name: 'text', label: 'Comment', value: m.text, multiline: true }] });
      if (!v || !v.text || v.text === m.text) return;
      checkpoint(); m.text = v.text.slice(0, 5000); m.edited = Date.now();
    }
    rerenderCard(c.id);
    renderComments();
    scheduleSave();
  });
}
