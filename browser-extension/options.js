/* Pocket-Canvas Web Clipper — options
 * Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
 */
'use strict';
const $ = (id) => document.getElementById(id);

async function refresh() {
  const c = await PC.cfg();
  $('port').value = c.port;
  $('conn').textContent = 'Checking…';
  $('connect').hidden = $('disconnect').hidden = true;
  try {
    const st = await PC.status();
    if (st.paired) {
      $('conn').textContent = `✓ Connected to Pocket-Canvas ${st.version}.`;
      $('disconnect').hidden = false;
    } else {
      $('conn').textContent = 'Pocket-Canvas is open, but this browser isn’t connected yet.';
      $('connect').hidden = false;
    }
  } catch (err) {
    $('conn').textContent = err.message;
  }
}

$('test').onclick = refresh;
$('connect').onclick = async () => {
  $('conn').textContent = 'Switch to Pocket-Canvas and click Allow…';
  try { await PC.pair(); } catch (err) { $('conn').textContent = err.message; return; }
  refresh();
};
$('disconnect').onclick = async () => { await PC.forget(); refresh(); };
$('save-port').onclick = async () => {
  const port = parseInt($('port').value, 10);
  if (!(port >= 1024 && port <= 65535)) { $('port-msg').textContent = 'Use a number from 1024 to 65535.'; return; }
  await PC.set({ port });
  $('port-msg').textContent = 'Saved.';
  refresh();
};

refresh();
