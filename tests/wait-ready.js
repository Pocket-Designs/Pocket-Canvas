// Pocket-Canvas test helper
// Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
//
// Waits until the app window has finished starting, instead of guessing with a
// fixed delay. Shared cloud machines (GitHub Actions) can take much longer to
// start Electron than a desktop computer, so a fixed 2 seconds is not enough.

const { app, BrowserWindow } = require('electron');

// Cloud test machines have no graphics card; skip the GPU so Chromium doesn't
// waste time trying (and failing) to start one.
if (process.env.CI) app.disableHardwareAcceleration();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForApp(timeoutMs = 90000) {
  const start = Date.now();
  let lastError = 'no window yet';
  while (Date.now() - start < timeoutMs) {
    const win = BrowserWindow.getAllWindows()[0];
    if (win && !win.webContents.isLoading()) {
      try {
        const ok = await Promise.race([
          win.webContents.executeJavaScript(
            "typeof B === 'function' && typeof store !== 'undefined' && !!store && document.querySelectorAll('#rail .tool').length > 0"),
          sleep(5000).then(() => false)
        ]);
        if (ok) { await sleep(500); return win; }
        lastError = 'page loaded but the app has not finished starting';
      } catch (err) { lastError = err.message; }
    }
    await sleep(250);
  }
  throw new Error(`the app did not start within ${timeoutMs / 1000}s (${lastError})`);
}

module.exports = { waitForApp, sleep };
