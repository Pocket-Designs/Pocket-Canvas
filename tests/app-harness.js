// Pocket-Canvas — starts the app for the extension test.
// Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
// Uses a throw-away data folder, a given port, and answers "Allow" to the pairing question.
const { app, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const dir = process.env.PC_TEST_DIR;
app.setPath('userData', dir);
fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({
  deviceId: 'harness000000001', deviceHost: os.hostname(), deviceName: 'Test', userName: 'Tester',
  linkPreviews: false, sync: { folder: null },
  clipper: { enabled: true, port: +process.env.PC_TEST_PORT, tokens: [] }
}));
const { waitForApp } = require('./wait-ready');
dialog.showMessageBox = async () => ({ response: 1 }); // "Allow"
require(path.join(__dirname, '..', 'main.js'));
app.whenReady().then(() => waitForApp()).then(() => console.log('PC-READY'),
  (err) => { console.log('PC-FAILED ' + err.message); app.exit(1); });
