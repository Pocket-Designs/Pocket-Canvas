// Pocket-Canvas — export a board as a PNG picture or a PDF
// Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
//
// The board is drawn in an invisible off-screen window (so it can be bigger than the
// screen), sized to fit every card, then captured.
'use strict';
const { BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const waiting = new Map(); // webContents id -> resolve({ width, height } | { error })
const exportData = new Map(); // webContents id -> the boards to draw (from the open app, so unlocked boards work)

ipcMain.handle('export:data', (e) => exportData.get(e.sender.id) || null);

ipcMain.handle('export:ready', (e, info) => {
  const done = waiting.get(e.sender.id);
  if (done) done(info);
});

async function exportBoard({ appDir, boardId, format, quality, background, theme, filePath, data, paper, orientation, layout }) {
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    transparent: background === 'transparent' && format === 'png',
    backgroundColor: background === 'transparent' && format === 'png' ? '#00000000' : '#ffffff',
    webPreferences: {
      offscreen: true,
      preload: path.join(appDir, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  try {
    if (data) exportData.set(win.webContents.id, data);
    const ready = new Promise((resolve, reject) => {
      waiting.set(win.webContents.id, resolve);
      setTimeout(() => reject(new Error('The board took too long to draw.')), 45000);
    });
    await win.loadFile(path.join(appDir, 'src', 'index.html'), {
      query: { export: boardId, format, quality, background, theme, paper: paper || 'A4', orientation: orientation || 'auto', layout: layout || 'auto' }
    });
    const info = await ready;
    if (info.error) throw new Error(info.error);
    if (info.paged) {
      // Printed on A4 / Letter pages; the page laid itself out so no card crosses a page edge
      // (or, following the page guides, as one block per page with a page break after each).
      win.setContentSize(Math.ceil(info.width), 1200);
      await new Promise((r) => setTimeout(r, 600));
      const m = info.margin;
      const pdf = await win.webContents.printToPDF({
        pageSize: info.paper === 'Letter' ? 'Letter' : 'A4',
        landscape: !!info.landscape,
        printBackground: true,
        margins: { top: m, bottom: m, left: m, right: m }
      });
      fs.writeFileSync(filePath, pdf);
      return { ok: true, pages: info.pages, landscape: !!info.landscape, width: info.width, height: info.height };
    }
    win.setContentSize(info.width, info.height);
    await new Promise((r) => setTimeout(r, 600)); // let the resized page paint

    if (format === 'pdf') {
      const pdf = await win.webContents.printToPDF({
        pageSize: { width: info.width / 96, height: info.height / 96 },
        printBackground: true,
        margins: { marginType: 'none' },
        pageRanges: '1'
      });
      fs.writeFileSync(filePath, pdf);
    } else {
      const img = await win.webContents.capturePage();
      fs.writeFileSync(filePath, img.toPNG());
    }
    return { ok: true, width: info.width, height: info.height };
  } finally {
    waiting.delete(win.webContents.id);
    exportData.delete(win.webContents.id);
    win.destroy();
  }
}

module.exports = { exportBoard };
