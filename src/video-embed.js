/* Pocket-Canvas — playing online videos (YouTube, Vimeo, Dailymotion, Loom) inside a link card
 * Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
 *
 * A link card whose address is a video shows the video's picture with a Play button.
 * Nothing is loaded from the video site until you press Play (YouTube uses its
 * privacy-enhanced youtube-nocookie.com player). Stop puts the picture back.
 * Right-click › "Show as link card" switches back to a normal link card (card.player = false).
 */
'use strict';

const VIDEO_SITES = {
  youtube: { name: 'YouTube', colour: '#d0312d' },
  vimeo: { name: 'Vimeo', colour: '#1ab7ea' },
  dailymotion: { name: 'Dailymotion', colour: '#0a0a0a' },
  loom: { name: 'Loom', colour: '#625df5' }
};

// "1h2m3s", "90", "1:30" → seconds
function startSeconds(t) {
  if (!t) return 0;
  if (/^\d+$/.test(t)) return +t;
  const hms = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
  if (hms && (hms[1] || hms[2] || hms[3])) return (+hms[1] || 0) * 3600 + (+hms[2] || 0) * 60 + (+hms[3] || 0);
  const colon = t.split(':').map(Number);
  if (colon.every((n) => Number.isFinite(n))) return colon.reduce((a, n) => a * 60 + n, 0);
  return 0;
}

// What video (if any) a web address points to: { site, id, start, src, name, colour }.
function videoEmbed(url) {
  let u;
  try { u = new URL(String(url || '')); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.replace(/^(www|m|music)\./, '');
  const path = u.pathname;
  let site = null, id = null, extra = '';
  const start = startSeconds(u.searchParams.get('t') || u.searchParams.get('start') || (u.hash.match(/t=([\w:]+)/) || [])[1]);
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = u.searchParams.get('v') || (path.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/) || [])[1];
    site = 'youtube';
  } else if (host === 'youtu.be') {
    id = (path.match(/^\/([\w-]{11})/) || [])[1]; site = 'youtube';
  } else if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = path.match(/^\/(?:video\/)?(\d{5,})(?:\/([0-9a-f]{6,}))?/);
    if (m) { id = m[1]; site = 'vimeo'; const h = m[2] || u.searchParams.get('h'); if (h && /^[0-9a-f]+$/.test(h)) extra = '&h=' + h; }
  } else if (host === 'dailymotion.com') {
    id = (path.match(/^\/(?:embed\/)?video\/([a-z0-9]+)/i) || [])[1]; site = 'dailymotion';
  } else if (host === 'dai.ly') {
    id = (path.match(/^\/([a-z0-9]+)/i) || [])[1]; site = 'dailymotion';
  } else if (host === 'loom.com') {
    id = (path.match(/^\/(?:share|embed)\/([0-9a-f]{20,})/) || [])[1]; site = 'loom';
  }
  if (!site || !id || !/^[\w-]+$/.test(id)) return null;
  if (site === 'youtube' && !/^[\w-]{11}$/.test(id)) return null;
  const src = {
    youtube: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1&modestbranding=1${start ? '&start=' + start : ''}`,
    vimeo: `https://player.vimeo.com/video/${id}?autoplay=1&dnt=1${extra}${start ? '#t=' + start + 's' : ''}`,
    dailymotion: `https://www.dailymotion.com/embed/video/${id}?autoplay=1${start ? '&start=' + start : ''}`,
    loom: `https://www.loom.com/embed/${id}?autoplay=1${start ? '&t=' + start : ''}`
  }[site];
  return { site, id, start, src, ...VIDEO_SITES[site] };
}

const showsPlayer = (c) => c.type === 'link' && c.player !== false && !!videoEmbed(c.url);
const playingVideos = new Set(); // card ids whose player is open

// The top part of a video link card.
function buildVideoHtml(c) {
  const v = videoEmbed(c.url);
  const playing = playingVideos.has(c.id) && !EXPORT_MODE;
  const poster = c.image ? `<img src="${assetBase + encodeURIComponent(c.image)}" alt="" draggable="false">` : '';
  return `<div class="vid ${playing ? 'playing' : ''}" style="--site:${v.colour}">
      ${playing
        ? `<iframe src="${esc(v.src)}" title="${esc(c.title || v.name + ' video')}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"></iframe>`
        : `${poster || `<div class="vid-blank">${esc(v.name)}</div>`}<button class="vid-play" data-act="video-play" title="Play here" aria-label="Play">${PLAY_SVG}</button>`}
    </div>
    <div class="vid-bar">
      ${playing ? `<button class="m-btn" data-act="video-stop" title="Stop">${STOP_SVG}</button>` : `<button class="m-btn" data-act="video-play" title="Play">${PLAY_SVG}</button>`}
      <span class="vid-site">${esc(v.name)}${v.start ? ` · from ${fmtTime(v.start)}` : ''}</span>
      <button class="link-btn" data-act="video-open" title="Open on ${esc(v.name)} in your web browser">Open on ${esc(v.name)}</button>
    </div>`;
}

function videoAction(act, c) {
  if (act === 'video-play') {
    // one video at a time, like audio and video cards
    for (const id of [...playingVideos]) { playingVideos.delete(id); if (cardEl(id)) rerenderCard(id); }
    try { for (const { el } of mediaEls.values()) el.pause(); } catch {}
    playingVideos.add(c.id);
    rerenderCard(c.id);
    requestAnimationFrame(drawLinks);
  } else if (act === 'video-stop') {
    playingVideos.delete(c.id);
    rerenderCard(c.id);
  } else if (act === 'video-open') {
    api.openLink(c.url);
  }
}

// Stop players whose cards have gone (another board, deleted).
function cleanupVideos() {
  for (const id of [...playingVideos]) if (!cardEl(id)) playingVideos.delete(id);
}
