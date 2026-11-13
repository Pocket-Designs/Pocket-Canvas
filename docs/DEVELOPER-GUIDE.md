# Pocket-Canvas Developer Guide

How Pocket-Canvas is built, how to run and test it, how to change it, and how to ship a release.

Version 1.5.5 · © 2026 Pocket-Designs · pocket-designs@proton.me · MIT licence (logo excluded; see `ASSETS-LICENCE.md`)

### Version history

| Version | Main changes | Code to look at |
|---|---|---|
| **1.5** | Shapes for flowcharts and network diagrams, elbow lines and line labels (`src/shapes.js`, `src/lines.js`); Pocket-Canvas Server (accounts, own-device sync, shared boards with live editing and presence); paged PDF export (A4/Letter, portrait/landscape/best fit, page breaks); sketch shapes and pressure; YouTube/Vimeo/Dailymotion/Loom players; iPhone/iPad app; Safari extension build; Android folder picker (SAF) and in-page export | `server/`, `src/server-sync.js`, `src/export-ui.js` (`planPages`, `exportInPage`), `src/video-embed.js`, `ios/`, `mobile/api-mobile.js`, `SyncFolderPlugin.java`, [SERVER](../server/README.md), [IOS.md](IOS.md), [SAFARI.md](SAFARI.md) |
| **1.4** | Android app (Capacitor) with folder sync; text formatting; line styles and free-floating lines; − Row / − Column; 51 board-icon colours; board flush with the window; touch gestures | `mobile/api-mobile.js` (was api-android.js), `android/`, `src/mobile.js`, `src/lines.js`, `src/text-format.js`, [ANDROID.md](ANDROID.md) |
| **1.3** | Recycle bin (30 days, synced); delete buttons; password-protected boards (AES-256-GCM, PBKDF2); automatic backups to a chosen folder; spell checking with suggestions | `src/bin.js`, `src/lock.js`, `lib/backup.js`, spelling in `main.js` |
| **1.2** | Fixed top-left corner (boards grow right/down); templates load top-left; 42 board icons + own pictures; Colour cards with typed codes and automatic names | `ORIGIN_PAD`/`normaliseOrigin()` in `app.js`, `src/board-icons/`, `src/colour-names.js` |
| **1.1** | Folder sync; templates; comments; link previews; tables, sketches, audio/video; PDF/PNG export; browser extension | `src/merge.js`, `lib/sync.js`, `lib/clipper.js`, `lib/export.js`, `browser-extension/` |
| **1.0** | Boards, cards, columns, lines, nested boards, search, undo, Markdown/JSON export | `src/app.js` |

**Data compatibility:** every version reads files from earlier versions. All 1.1+ additions are optional fields, so `store.version` is still `1`.

---

## Contents

1. [Overview](#1-overview)
2. [Getting set up](#2-getting-set-up)
3. [Project layout](#3-project-layout)
4. [Architecture](#4-architecture)
5. [The data model](#5-the-data-model)
6. [Main process and IPC reference](#6-main-process-and-ipc-reference)
7. [The renderer](#7-the-renderer)
8. [How the key behaviours work](#8-how-the-key-behaviours-work)
9. [Sync](#9-sync) (folders, and the Pocket-Canvas Server)
10. [Recycle bin](#10-recycle-bin)
11. [Password-protected boards](#11-password-protected-boards)
12. [Backups](#12-backups)
13. [Spelling](#13-spelling)
14. [The browser extension and its local API](#14-the-browser-extension-and-its-local-api) (and Safari: [SAFARI.md](SAFARI.md))
15. [Link previews and export](#15-link-previews-and-export)
16. [Common changes, step by step](#16-common-changes-step-by-step)
17. [Styling and themes](#17-styling-and-themes)
18. [Testing](#18-testing)
19. [Building and releasing](#19-building-and-releasing)
20. [Changing the data format safely](#20-changing-the-data-format-safely)
21. [Conventions](#21-conventions)
22. [Known limitations and ideas](#22-known-limitations-and-ideas)

---

## 1. Overview

Pocket-Canvas is an [Electron](https://www.electronjs.org) desktop app: a Milanote-style infinite canvas of cards, columns, lines and nested boards, with templates, comments, folder-based sync, PDF/PNG export and a companion browser extension.

Design choices that shape the code:

- **No framework, no bundler.** The interface is plain HTML, CSS and classic `<script>` files that share globals. There's no build step for development: edit, then restart.
- **No runtime dependencies.** `package.json` only has `devDependencies` (Electron and electron-builder). Nothing from npm ships inside the app or the extension.
- **One JSON document holds everything.** All boards and templates live in one in-memory object, saved to disk as one file. This keeps undo, copy/paste, backup and sync simple.
- **Locked-down renderer.** The interface has no Node.js access. It talks to the main process only through the explicit API in `preload.js`.
- **Local-first.** No accounts or servers. Sync goes through a folder the user's own sync service manages; the browser extension talks only to `127.0.0.1`.

| | |
|---|---|
| Electron | 33.x (Chromium + Node 20) |
| Packager | electron-builder 25.x |
| Languages | JavaScript (ES2022), HTML, CSS |
| Platforms | Windows (NSIS .exe), Linux (AppImage, .deb), macOS (.dmg) |
| Extension | Manifest V3, one package for Chromium browsers and Firefox 121+ |

---

## 2. Getting set up

**You need:** [Node.js](https://nodejs.org) 18 or newer (20 LTS recommended) and Git.

```bash
git clone https://github.com/Pocket-Designs/Pocket-Canvas.git
cd Pocket-Canvas
npm install
npm start
```

| Command | What it does |
|---|---|
| `npm start` | Run the app from source |
| `npm test` | Smoke test: core board features ([section 18](#18-testing)) |
| `npm run test:features` | End-to-end tests of the 1.1 features, including sync, extension API and export |
| `npm run test:merge` | Sync merge-engine unit tests (plain Node, very fast) |
| `npm run test:extension` | The extension in a real Chromium browser against the real app (needs Playwright) |
| `npm run extension` | Build the store-ready extension zip in `dist/` |
| `npm run dist` | Build installers for the current operating system |
| `npm run dist:win` / `dist:linux` / `dist:mac` | Build for one platform |

**Debugging:** **View → Toggle Developer Tools** opens Chrome DevTools for the interface. `console.log` in `main.js` and `lib/` prints to the terminal you ran `npm start` from. All renderer functions are global, so you can call them from the DevTools console (`B()`, `store`, `openTemplates()`…).

**Use a separate data folder while developing**, so you don't touch your real boards:

```bash
npx electron . --user-data-dir="$HOME/pocket-canvas-dev"            # Linux / macOS
npx electron . --user-data-dir="%USERPROFILE%\pocket-canvas-dev"     # Windows
```

To try sync on one machine, run two copies with different `--user-data-dir` folders and choose the same sync folder in both. Each data folder gets its own device id.

---

## 3. Project layout

```
pocket-canvas/
├── main.js                 Main process: window, menus, file system, dialogs, IPC wiring
├── preload.js              The only bridge between the interface and the main process (window.api)
├── lib/                    Main-process modules
│   ├── settings.js         Per-computer settings (settings.json): name, device id, previews, sync, extension
│   ├── sync.js             Folder sync: writes this computer's file, reads others, copies assets
│   ├── clipper.js          Local HTTP API for the browser extension (127.0.0.1 only, paired tokens)
│   ├── link-preview.js     Fetches page title/description/picture/icon; downloads media
│   ├── backup.js           Automatic backups: snapshots + shared assets in a chosen folder
│   └── export.js           Off-screen rendering of a board to PNG or PDF
├── src/                    The interface (classic scripts, loaded in this order)
│   ├── index.html          Skeleton: sidebar, top bar, toolbar, canvas, panels
│   ├── styles.css          All styling; light and dark themes via CSS variables
│   ├── merge.js            Sync merge engine (shared with Node tests: UMD module)
│   ├── colour-names.js     Colour names for Colour cards: exact name if within ΔE2000 2.5 of a CSS/well-known colour, else describeColour()
│   ├── board-icons/        Board icon pictures (*.svg) and icons.js, the list of them
│   ├── app.js              Core: state, rendering, cards, drag/drop, editing, menus, search, history
│   ├── lines.js            Lines and arrows: drawing, free/attached ends, handles, style bar, line menu
│   ├── text-format.js      Formatting bar: font, size, bold/italic/underline/strike, colour
│   ├── modal.js            Dialog helpers: openModal, askText, timeAgo
│   ├── cards-extra.js      Tables, sketches, audio/video players, picture placeholders, link previews
│   ├── comments.js         Comment panel and badges
│   ├── bin.js              Recycle bin: move to bin, restore, purge after 30 days, bin window
│   ├── lock.js             Password-protected boards: encryption, sealing for save/sync, unlock/relock
│   ├── templates.js        Built-in templates, save-your-own, gallery
│   ├── settings-ui.js      Settings window, sync status label
│   ├── sync-client.js      Applying changes from other computers; adding web clips
│   ├── export-ui.js        Export dialog, and "export mode" drawing in the off-screen window
│   ├── shapes.js           Shape cards: flowchart shapes and network devices, the picker, + next step, Change shape
│   ├── table-style.js      Tables: moving rows/columns (grips, Alt+arrows), cell/row/column colours and text styles
│   ├── appearance.js       Settings › Appearance: accent and interface colours (CSS variables on <html>)
│   ├── scrollbars.js       Scroll bars along the bottom and right of the board
│   ├── page-guides.js      Page guides on the board (A4/Letter outlines, crossing cards) and printing exactly those pages
│   ├── server-sync.js      Pocket-Canvas Server: sign-in, live connection, own-device sync, shared boards, presence
│   ├── video-embed.js      Video players in link cards (YouTube, Vimeo, Dailymotion, Loom)
│   ├── mobile.js           Touch gestures (pan, pinch, press-and-hold); Android ⋮ menu and Back button
│   ├── start.js            init(): runs last
│   └── icon.png            Logo used at runtime
├── browser-extension/      The web clipper (Manifest V3); see its README
├── web/
│   └── api-web.js          The browser version's window.api: sign-in screen, IndexedDB copy, server for files and previews, keyboard shortcuts
├── mobile/
│   └── api-mobile.js       The phone/tablet apps' window.api (instead of preload.js): files, folder sync, export, sharing
├── android/                Android Studio project (Capacitor), kept in Git; see docs/ANDROID.md
├── ios/                    Xcode project for iPhone and iPad (Capacitor, Swift Package Manager); see docs/IOS.md
├── server/                 Pocket-Canvas Server: pocket-canvas-server.js, package.json, Dockerfile, docker-compose.yml + Caddyfile, README
├── capacitor.config.json   App id, name and web folder (build/mobile-www) for Android and iOS
├── scripts/
│   ├── build-extension.js  Zips the extension for the stores (no dependencies)
│   ├── build-mobile-web.js   Copies src/ + mobile/api-mobile.js to build/mobile-www
│   ├── build-web.js        Copies src/ + web/api-web.js to build/web (or a given folder): the browser version
│   └── build-server.js     dist/Pocket-Canvas-Server-<version>.zip: the server with the browser version built in
├── tests/
│   ├── smoke.js            Core features, driving the real app
│   ├── features.js         1.1 features, driving the real app (sync, export, clipper API…)
│   ├── merge.test.js       Sync merge engine, plain Node
│   ├── extension.test.js   Extension in Chromium (Playwright) + app
│   ├── mobile-web.test.js  Phone/tablet app screens in a phone-sized Chromium with a pretend phone (Android and iPhone)
│   ├── server.test.js      Pocket-Canvas Server: accounts, devices, shared boards, presence, assets, restart
│   ├── web.test.js         The browser version against a real server, in Chromium (two browsers plus a pretend desktop)
│   ├── wait-ready.js       Waits for the app to finish starting (used by the tests)
│   └── app-harness.js      Starts the app for extension.test.js
├── build/                  Installer icons and original logo artwork
├── docs/                   USER-GUIDE.md, this file, ANDROID.md, IOS.md, SAFARI.md and RELEASING.md
├── .github/workflows/build.yml   CI: all tests, then installers, Android APK, iOS app, Safari extension app and extension zip
├── package.json            Scripts, metadata and electron-builder config ("build" key)
├── FEATURES.md, README.md, LICENSE, ASSETS-LICENCE.md
```

Only `main.js`, `preload.js`, `lib/`, `src/` and `package.json` are packaged into the app (`build.files`). `LICENSE` and `ASSETS-LICENCE.md` are copied next to the executable (`build.extraFiles`).

---

## 4. Architecture

```
 Browser extension ──HTTP 127.0.0.1──┐          Sync folder (Dropbox/OneDrive/…)
                                     │           devices/<id>.json   assets/
┌──────────────── Main process (main.js + lib/, Node) ───────────────────────────────┐
│  BrowserWindow · menu · files · dialogs                                             │
│  Settings ── FolderSync (poll 4 s) ── ClipServer (http) ── linkPreview ── export    │
│  ipcMain.handle('data:save' | 'sync:choose' | 'link:preview' | …)                   │
│  webContents.send('menu' | 'sync:incoming' | 'sync:status' | 'clip:add' | …)        │
└───────────────▲────────────────────────────────────────────────┬────────────────────┘
                │ ipcRenderer.invoke(...)                         │ events
┌───────────────┴──────────── preload.js (isolated) ─────────────▼────────────────────┐
│  contextBridge.exposeInMainWorld('api', { load, save, linkPreview, syncChoose, … }) │
└───────────────▲─────────────────────────────────────────────────────────────────────┘
                │ window.api.*
┌───────────────┴──────────── Renderer (src/, sandboxed) ─────────────────────────────┐
│  store (all boards + templates) → render() → DOM                                     │
│  user input → mutate store → checkpoint() / scheduleSave() → PCSync.stamp → api.save │
│  sync:incoming → PCSync.merge(store, remote) → render                                 │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### Security model

These settings are deliberate. Don't loosen them without a strong reason.

| Setting | Where | Why |
|---|---|---|
| `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` | `main.js`, `lib/export.js` | The interface can't use Node or `require` |
| Narrow `window.api` | `preload.js` | Each capability is a named function; there's no generic "run this" channel |
| Content-Security-Policy | `src/index.html` | Scripts only from the app itself, **no inline scripts or `on…=` handlers**; images/media from `file:`/`data:`/`blob:` |
| `setWindowOpenHandler` + `will-navigate` guard | `main.js` | Links never load inside the app; `http(s)` links go to the system browser |
| `link:open` / previews only accept `http(s)://` | `main.js`, `lib/link-preview.js` | Stops `file:` or custom-protocol tricks |
| Asset ids pass through `path.basename` | `main.js` | Stops `../` path traversal out of the assets folder |
| `sanitize()` on note HTML; `esc()` on all other text; `safeColor()` on sketch/template colours | renderer | Content from sync files and the extension is untrusted |
| Clip server: `127.0.0.1` only; web-page `Origin`s refused; pairing needs a user click; 256-bit bearer token compared with `timingSafeEqual` | `lib/clipper.js` | Other machines and websites can't write to boards |
| `settings.public()` never exposes tokens | `lib/settings.js` | The renderer never sees extension secrets |

### Files on disk

All under Electron's `userData` folder, which is named after `productName` (**Pocket-Canvas**):

| File | Purpose |
|---|---|
| `pocket-canvas-data.json` | The whole store (section 5) |
| `pocket-canvas-data.json.bak` | Previous save; used if the main file fails to parse |
| `pocket-canvas-data.json.corrupt-<time>` | A damaged file is kept here for inspection |
| `assets/<16 hex chars><.ext>` | Images, files, audio and video. Immutable once written. |
| `settings.json` | Per-computer settings (never synced): device id/host/name, user name, link previews, sync folder, clipper port and tokens |

Saving is **atomic**: write to `.tmp`, then rename over the real file. Before each save, the current file is copied to `.bak`.

On start-up, `importOldData()` copies data from the earlier **PocketCanvas** folder if the new data file doesn't exist yet.

---

## 5. The data model

Everything shared is one plain object, `store`:

```jsonc
{
  "version": 1,
  "root": "k3j9a2b…",                     // id of the top-level "Home" board
  "boards": {
    "k3j9a2b…": {
      "id": "k3j9a2b…",
      "title": "Home",
      "parentId": null,                   // null only for the root board
      "color": "#8a7f70",
      "icon": "star",                     // id from src/board-icons/icons.js (default "board")
      "iconAsset": "a1b2…png",            // optional: the user's own picture, overrides icon
      "lock": { "v": 1, "salt", "iter", "iv", "ct", "hint" },  // only on password-protected boards (base64)
      "pages": { "show": true, "paper": "A4" | "Letter", "landscape": false, "scale": 1 | 0.75 | 0.5 },  // page guides (optional; syncs)
      "cards":  { "<cardId>": { … } },    // every card on this board, including ones inside columns
      "order":  ["<cardId>", …],          // stacking order (last = on top)
      "links":  [ { "id": "…", "from": "<cardId>" | null, "to": "<cardId>" | null,   // null = a free end…
                    "fromPt": { "x", "y" }, "toPt": { "x", "y" },                // …at this board position
                    "arrow": "end" | "start" | "both" | "none", "dash": "solid" | "dashed" | "dotted",
                    "width": 2 | 3 | 5, "shape": "curve" | "straight" | "elbow", "label": "Yes", "color": null, "_mt": 0 } ],
      "view":   { "x": 40, "y": 40, "z": 1 },   // pan/zoom for this board; per computer, not synced
      "_mt": 1760512345678                // last change to title/colour/parent/order (sync)
    }
  },
  "templates": { "<id>": { "id", "name", "description", "color", "icon", "created", "payload": { "cards", "boards", "links" }, "_mt" } },
  "bin": { "<id>": { "id", "kind": "cards" | "board", "label", "types", "count", "from", "fromTitle", "deletedAt",
                     "payload", "crossLinks", "colPos",              // what's needed to restore
                     "sealed": { "iv", "ct" }, "lockedBoard", "_mt" } }, // instead, if it came from a locked board
  "deleted":   { "<id of board/card/line/template>": 1760512345678 },   // sync tombstones (kept 60 days)
  "ui": { "theme": "dark" | "light" | null, "appearance": { "accent": "#rrggbb", "tint": "sky" | "#rrggbb" } (optional), "collapsed": { "<boardId>": true }, "sidebar": true, "last": "<boardId>" }
}
```

`ui` and each board's `view` are per computer; everything else syncs.

**Locked boards on disk:** a board with `lock` always has empty `cards`, `order` and `links` in every saved copy, and the boards inside it are absent from `boards`. Its real contents are the encrypted `lock.ct`. See [Password-protected boards](#11-password-protected-boards).

### Cards

Every card has:

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Unique id (from `uid()`, crypto-random) |
| `type` | string | One of the types below |
| `x`, `y` | number | Top-left position in board coordinates (ignored inside a column) |
| `w` | number | Width in px (height is automatic) |
| `color` | string \| null | Colour label |
| `col` | string? | Set when the card is inside a column: the column's card id |
| `comments` | array? | `[{ id, author, text, at, resolved?, edited? }]` |
| `textStyle` | object? | Whole-card text style for every type except notes: `{ font, size, bold, italic, underline, strike, color }` (see `cleanTextStyle()`) |
| `_mt` | number? | Time of last change (set automatically at save; see [Sync](#9-sync)) |

Type-specific fields:

| `type` | Fields |
|---|---|
| `note` | `html`: sanitised rich text. Besides the allowed tags, `<span style>` keeps only `color`, `font-family`, `font-size` (6–120 px), `font-weight`, `font-style` and `text-decoration` (`cleanStyle()` in `text-format.js`) |
| `heading` | `text` |
| `todo` | `title`, `items: [{ id, text, done }]` |
| `link` | `url`, `title`; from the preview: `desc`, `site`, `image` (asset), `icon` (asset); `player: false` shows a video link as a plain link (see `videoEmbed()` in `video-embed.js`) |
| `image` | `asset` (empty = placeholder), `caption`, `source?` (page it was clipped from) |
| `file` | `asset`, `name` (original file name), `size` (bytes) |
| `media` | `asset`, `name`, `size`, `kind: 'audio' \| 'video'`, `caption`, `source?` |
| `table` | `rows: string[][]`, `header: boolean` (first row styled as headings); optional `styles: { rows: [style\|null], cols: [style\|null], cells: [[style\|null]] }` lined up with the rows and columns, where `style = { bg, color, bold, italic, underline, strike }` (booleans; `false` turns a setting off on purpose). Pasting: `clipboardTable(clipboardData)` reads `text/html` with `htmlTable()` (an inert `DOMParser` document; `.class {…}` rules from `<style>` blocks for Excel, inline styles, `<b>/<i>/<u>`, `bgcolor`, colspan and rowspan) or tab-separated text with `parseTsv()` (Excel quoting). The board's paste handler checks this before pasted files, because Excel also copies a picture of the cells; `pasteIntoTable()` fills from the cell being edited. Optional `pics: [[assetId\|null]]` holds a photo per cell, lined up the same way (see `tablePics()`, `setCellPic()`, `fillCellPic()`; `assetIds()` in `server-sync.js` includes them). A cell shows column, then row, then cell on top. Change rows and columns only through `tblInsertRow/DeleteRow/MoveRow` and the `…Col` versions in `table-style.js`, so the styles stay lined up. |
| `shape` | `kind` (flowchart: `process`, `terminal`, `decision`, `data`, `document`, `database`, `subprocess`, `preparation`, `manual`, `delay`, `circle`, `area`; network: the keys of `NET_DEVICES`), `label`, `sub` (network devices: IP address or note), `h` (flowchart shapes only; network devices size to their content), `color`. Defined in `shapes.js`: `FLOW_SHAPES` (CSS boxes or SVG drawn in a 100×100 box with `vector-effect: non-scaling-stroke`, so lines stay thin when stretched) and `NET_DEVICES` (48×48 line icons). Unknown kinds draw as `process`. An `area` is sent to the back when added. Lines meet a network device at its icon, not the wider card. |
| `sketch` | `vw`, `vh` (drawing coordinate size, e.g. 640×440), `strokes`: pen lines `{ c: colour, s: width, p: [x0,y0,x1,y1,…], pr?: [pressure per point, 0–1] }` (with `pr`, drawn as a filled outline whose width follows the pressure), or shapes `{ t: 'line' \| 'arrow' \| 'rect' \| 'ellipse', c, s, x1, y1, x2, y2, f?: 1 (light fill) }` |
| `board` | `boardId`: the child board in `store.boards` (its title lives on the board) |
| `column` | `title`, `items: [cardId, …]` in display order, `inbox?: true` (the "From the web" column) |
| `swatch` | `hex` (`#rrggbb`), `title`, `nameAuto` (true while the name follows the colour; false once the user types a name) |

Default fields for each type come from `cardDefaults(type)` in `app.js`.

### Rules the code relies on

- A card belongs to exactly one board. Lines only join cards on the **same** board. Each line end is either a card on that board or a free point (`fromPt`/`toPt`); `lineValid()` (and the same check in `PCSync.merge()`) drops lines with a missing end. Older lines have `arrow: true/false/undefined`; `lineArrow()` reads them as `'end'`/`'none'`. `shape: 'elbow'` routes with right angles from the middle of a side (`lineEnds()` picks left/right or top/bottom by which way the cards are further apart). An optional `label` is drawn as `text.link-label` at `lineMid()`; double-click a line or label to edit it (`editLineLabel()`).
- Cards inside a column are still stored in `board.cards` and `board.order`. They have `col` set, the column lists them in `items`, and they are **not** drawn at the top level.
- A board card's `boardId` points to a board whose `parentId` is the board holding the card. Every board except Home has exactly one board card. `childBoards()` walks cards to build the sidebar tree.
- Columns can't go inside columns, and a board can't be moved inside itself or its descendants.
- **Top-left corner:** every top-level card has `x ≥ 0` and `y ≥ 0`. Boards grow right and down only. `makeCard()`, dragging, nudging, `insertPayload()`, `moveToBoard()` and `detachFromColumn()` all clamp to this, and `normaliseOrigin(board)` moves older boards' cards into range (in `migrate()` and after every sync merge).

`PCSync.merge()` re-establishes all of these after merging, so synced data is always valid.

---

## 6. Main process and IPC reference

The renderer calls `window.api.<name>()`. Each call maps to an `ipcMain.handle` channel.

| `window.api` | Channel | Returns | Notes |
|---|---|---|---|
| `load()` | `data:load` | store or `null` | Falls back to `.bak` if the main file won't parse |
| `save(json)` | `data:save` | `true` | Atomic write with `.bak` rotation; also writes the sync file if sync is on |
| `ready()` | `app:ready` | `true` | Renderer finished starting: flushes queued web clips and re-polls sync |
| `assetBase()` | `assets:base` | `file://…/assets/` URL | Prefix for `<img>`/`<video>` `src` |
| `saveBytes(name, bytes)` | `assets:saveBytes` | asset id | Pasted/dropped files (`Uint8Array`) |
| `pickFiles(kind)` | `assets:pick` | `[{ id, name, size }]` | File dialog: `'image'`, `'image-one'`, `'media'` or any; copies into assets |
| `openAsset(id)` / `saveAssetAs(id, name)` | `assets:open` / `assets:saveAs` | — / boolean | Default app / save dialog |
| `openLink(url)` | `link:open` | — | `http(s)` only, in the system browser |
| `linkPreview(url)` | `link:preview` | `{ title, description, siteName, image, icon }` or `null` | `null` when previews are off; assets downloaded |
| `saveText` / `openText` | `file:saveText` / `file:openText` | | Markdown export, backup |
| `confirm(message, detail)` | `dialog:confirm` | boolean | Native OK/Cancel |
| `showFile(path)` | `file:show` | — | Reveal in Explorer/Finder |
| `exportVisual(opts)` | `export:visual` | `{ filePath, width, height }`, `{ canceled }` or `{ error }` | Save dialog, then off-screen render |
| `exportReady(info)` | `export:ready` | — | Used only by the off-screen export page |
| `getSettings()` / `setSettings(patch)` | `settings:get` / `settings:set` | public settings + `clipperStatus` + `version` | `set` whitelists keys |
| `forgetBrowser(id)` | `clipper:forget` | settings | Revoke an extension token |
| `syncStatus()` / `syncChoose()` / `syncDisable()` / `syncNow()` / `syncOpen()` | `sync:*` | status | See [Sync](#9-sync) |

**Events from the main process** (subscribe with `api.on…(fn)`):

| Subscribe | Channel | Payload |
|---|---|---|
| `onMenu` | `menu` | command string (`'undo'`, `'export-visual'`, `'settings-sync'`…) |
| `onSyncIncoming` | `sync:incoming` | `{ deviceId, deviceName, savedAt, state }` |
| `onSyncStatus` | `sync:status` | `{ enabled, folder, ok, error, lastWrite, lastRead, devices[] }` |
| `onAssetsArrived` | `assets:arrived` | number of files copied in from the sync folder |
| `onClip` | `clip:add` | `{ id, boardId, card, note, source, sourceTitle }`; reply with `api.clipDone({ id, boardTitle })` |
| `onBackupStatus` / `onBackupDone` | `backup:status` / `backup:done` | backup status / result of **File › Back Up Now** |

Also added in 1.3: `backupStatus/backupNow/backupSet/backupChoose/backupOpen/backupRead` (`backup:*`), `spellGet/spellSet/spellRemoveWord` (`spell:*`) and `exportData` (`export:data`, used only by the export window).

Menu commands are sent from `buildMenu()` in `main.js` and handled by the `api.onMenu` switch in `app.js`.

---

## 7. The renderer

Scripts are classic (not modules) and load in the order listed in [section 3](#3-project-layout); top-level `function`s and `const`s are shared between them. `start.js` runs `init()` last.

`app.js` is split into sections with banner comments:

| Section | Contents |
|---|---|
| **Basics** | `$`/`$$`, `uid()`, `esc()`, `COLORS`, `DEFAULT_W`, `ICONS`, `TOOLS`, `fileKind()` |
| **State** | `store`, `cur`, `selected`, undo stacks, `syncIndex`, `settingsCache`, `EXPORT_MODE`; `cardDefaults()`, `newBoard()`, `makeCard()`, `defaultStore()` |
| **Persistence & history** | `scheduleSave()` (400 ms), `flushSave()` (stamps for sync), `checkpoint()`, `pushUndo()`, `undo()`, `redo()` |
| **Sanitising rich text** | `sanitize()`, `htmlToText()` |
| **View (pan/zoom)** | `applyView()`, `toWorld()`, `zoomAt()`, `fitContent()`, `centreOn()` |
| **Rendering** | `render()`, `renderBoard()`, `buildCard()` (all card types, comment badges), `rerenderCard()`, `drawLinks()`, `renderTree()`, `renderCrumbs()`, `go()` |
| **Card operations** | `addCard()`, `addTool()`, `cardForAsset()`, `addAssetCards()`, `serialize(ids, board)`, `insertPayload(payload, dx, dy, board)`, delete/move/column helpers |
| **Editing text** | contenteditable handling, `setField()` (incl. table cells), to-do and table keys, Markdown shortcuts |
| **Pointer interaction** | `pointerdown` dispatcher (sketch drawing first), pan, marquee, resize, drag with drop targets, Line tool, wheel |
| **Drag & drop / Clipboard** | toolbar and desktop drops, `importFiles()`, `fillImage()`, `addLinkCard()`, copy/cut/paste |
| **Context menu** | menus for empty board, cards (incl. table cells), lines |
| **Sidebar, search, export/import, misc** | tree, breadcrumbs, `runSearch()` (incl. comments), Markdown, backup, toast, theme, shortcuts, `api.onMenu` |

The feature files:

| File | Main functions |
|---|---|
| `lines.js` | `drawLinks()`, `lineEnds()`/`linePathD()`, `toggleConnect()`/`connectDown()`/`connectFinish()` (the Line tool), `startLineDrag()`, `startEndDrag()`, `setLineProp()`, `lineMenuItems()`, `updateLineBar()`, `lineValid()`, `lineDefaults()` (kept in `store.ui.line`) |
| `text-format.js` | `#format-bar` shown on `focusin` of an editable; `applyFormat(kind, value)`: `execCommand` on the selection in notes (sizes via a `<font size=7>` swap), or `card.textStyle` for other cards; `applyCardTextStyle()` (CSS variables, called by `buildCard()`); `cleanStyle()`/`cleanTextStyle()` |
| `mobile.js` | Touch: one-finger pan on empty board, two-finger pinch zoom, press-and-hold → `contextmenu`. Android only: ⋮ menu, Back button, sidebar closed on phones, save on `pause` |
| `cards-extra.js` | `cardAction()` (card buttons, incl. `del-row`/`del-col` using `lastTableCell`), `buildTableHtml()`, `tableKey()`, `tableMenuItems()`, `buildSketchHtml()`, `startSketch()`/`stopSketch()`/`startStroke()`, `buildMediaHtml()`, `mountMedia()`, `cleanupMedia()`, `fetchPreview()` |
| `comments.js` | `openComments()`, `closeComments()`, `refreshComments()` (after each render), `postComment()` |
| `templates.js` | `BUILTIN_TEMPLATES`, `templateBuilder()`, `useTemplate()`, `saveBoardAsTemplate()`, `openTemplates(mode, pos)` |
| `settings-ui.js` | `openSettings(tab)`, `renderSettings()`, `updateSyncLabel()` |
| `sync-client.js` | `applyRemote()`, `initSyncClient()`, `addClip()` |
| `export-ui.js` | `openExport()`, `runExportMode()` |
| `modal.js` | `openModal()`, `askText()`, `timeAgo()` |

---

## 8. How the key behaviours work

### Rendering
`renderBoard()` rebuilds every top-level card with `buildCard()` (columns build their children inside them). Small changes use `rerenderCard(id)`. Lines are an SVG layer redrawn by `drawLinks()`, which measures cards from the DOM, so call it after anything that changes card size. Pan and zoom are a single CSS transform on `#world`.

**Audio/video players survive re-renders:** `mediaEls` keeps one `<audio>`/`<video>` element per card id; `mountMedia()` moves the existing element into the rebuilt card, and `cleanupMedia()` stops players whose cards are no longer in the DOM (other board, deleted).

### Coordinates and the top-left corner
Card `x`/`y` are **board coordinates**: `board = (screen − view.x) / view.z`. Board `(0, 0)` is the fixed top-left corner. `applyView()` caps `view.x` and `view.y` at `ORIGIN_PAD` (0 since 1.4), so the corner sits flush with the window edge and you can't scroll past it. Cards keep at least `CARD_MARGIN` (40) from the corner when older boards are moved into range. `fitContent()` always shows from `(0, 0)` to the furthest card, at up to 100% zoom. New boards start at `DEFAULT_VIEW()`; export mode skips the cap. Use `toWorld(clientX, clientY)`. During drags, divide mouse movement by `view.z`. Sketch points are in the sketch's own `vw × vh` space, so they scale with the card.

### Undo / redo
History stores **whole-store JSON snapshots** (up to 80).
- Call `checkpoint()` **before** changing the store for a discrete action.
- For gestures (drag, resize, a sketch stroke), snapshot at the start and `pushUndo(snap)` at the end only if something changed.
- Text editing: snapshot on `focusin`, push on `focusout` if the text changed.
- Changes arriving from another computer clear both stacks.

### Saving
Any change calls `scheduleSave()`. After 400 ms, `flushSave()` stamps changes for sync (`PCSync.stamp`) and sends the whole store to `data:save`.

### Selecting vs editing
The first click selects a card; a second click on an already-selected card makes the clicked `.editable` editable. Notes use `contenteditable="true"`; everything else (including table cells) uses `plaintext-only`. `setField()` writes edits straight back to the store on every `input` event.

### Sketch drawing
`startSketch(id)` sets `sketchEditing`, shows `#sketch-bar` and adds `.drawing` to the card. In the viewport `pointerdown` handler, events inside that card's `.sketch-wrap` go to `startStroke()`, which records points in sketch coordinates (coalesced events for smoothness, minimum 1.5-unit spacing) and renders strokes as SVG quadratic curves. The eraser removes whole strokes whose segments pass within the eraser radius.

### Copy, paste, duplicate, templates
`serialize(ids, board)` gathers cards plus column children, nested boards (recursively) and the lines whose card ends are all among them (their free ends come too). `insertPayload(payload, dx, dy, board)` gives **every** id a fresh one, offsets positions and re-parents child boards. Duplicate, paste and templates all use this pair. A saved template is just a stored payload.

---

## 9. Sync

### Design
- The user chooses a folder managed by a file-sync service. Pocket-Canvas creates `Pocket-Canvas Sync/` with `devices/` and `assets/`.
- **Each computer writes only `devices/<its deviceId>.json`**, containing `{ format, app, deviceId, deviceName, savedAt, state }` where `state = { root, boards, templates, deleted }`. Because no two computers write the same file, sync services never produce conflicted copies.
- Each computer **polls** `devices/` every 4 s (`lib/sync.js`), reading any file whose mtime/size changed, and sends it to the renderer, which **merges** it into the live store and saves. That save writes the merged result back to this computer's own file, so all computers converge.
- **Assets** are immutable and named by random id, so they're simply copied both ways (every save pushes missing ones; every 15 s pulls missing ones).
- `deviceId` lives in `settings.json` with the computer's hostname; if the data folder is copied to another computer, a new id is generated, so two computers never share a file.

### Change tracking (`src/merge.js`)
- `PCSync.stamp(store, index, now)` runs on every save. It fingerprints every board (title/colour/parent/order), card (including which board it's on), line and template, compares with the previous fingerprints (`syncIndex`), sets `_mt = now` on anything changed, and records `store.deleted[id] = now` for anything gone. Nothing else in the code needs to remember to set timestamps.
- `PCSync.merge(local, remote)` takes, for each item, the version with the larger `_mt` (ties broken by content, so every computer picks the same), drops items whose tombstone is newer than their `_mt`, rebuilds the boards, then **tidies**:
  - two different Home boards: keep the smaller id, move the other's cards into it (offset to the right)
  - cards whose board was deleted elsewhere: rescued onto Home
  - column ↔ card membership made consistent; duplicates removed
  - board cards pointing at missing boards removed; boards with no card get one (deterministic id `bc-<boardId>`); `parentId` follows the card; loops broken
  - `order` de-duplicated and completed; lines to missing cards removed
- Board `view`s and `ui` are never taken from the remote copy.
- Tombstones older than 60 days are pruned.

### The Pocket-Canvas Server (`server/`, `src/server-sync.js`)
How to run it is in [server/README.md](../server/README.md). Design:
- **One Node.js file, one dependency (`ws`).** HTTP for accounts and assets, a WebSocket at `/ws?token=…` for everything live. State is JSON files in `DATA_DIR`:
  - `users.json`: scrypt-hashed passwords
  - `tokens.json`: SHA-256 of each device's sign-in key
  - `spaces.json`: shared boards
  - `docs/<hash(scope)>/<hash(device)>.json`: the latest copy from each device
  - `assets/<id>`: pictures and files
- **The server never merges.** Like the sync folder, it stores the latest copy from each device per *scope* and relays it. Devices merge with `PCSync.merge`, through the same `applyRemote()` as folder sync, so the two behave identically and can be used together.
- **Scopes:**
  - `me` is all of one person's boards (`PCSync.syncState`), relayed to their other devices.
  - A **space** (`sp-<boardId>`) is one shared board and the boards inside it. `extractSpace(sealed, root)` sends just that subtree with the root's `parentId` set to null, so nothing else leaves the device.
  - On arrival, `composeSpace(local, root, remote)` builds a whole-store copy: your boards, with that subtree replaced by the incoming one, and the root under its local parent (or Home, for a newcomer). That copy is then merged normally. Per-card latest-change-wins applies, and the merge's tidy pass gives a newcomer a board card for it.
- **Messages:**
  - `hello` → `welcome` (account, spaces), followed by catch-up `doc`s and `presence`.
  - `doc` (scope, state) → stored, relayed, and answered with `saved`.
  - `share` (root, title, names, state) creates or updates a space; members get `space` and the latest `doc`s.
  - `unshare` (owner) and `leave` → `unshared`.
  - `presence` (space, board, card, editing) → `presence` lists for the space.
- **Sending:** `flushSave()` calls `serverOnSaved(sealed)` after every save (~0.4 s after a change). Copies identical to the last one sent are skipped. Assets referenced by the copy are uploaded if `/api/assets/missing` says so. Incoming copies trigger `serverFetchAssets()`, which uses the `readAsset` / `writeAsset` / `hasAssets` API on both desktop and mobile.
- **Presence:** `serverPresence()` (from `refreshSelection()` and focus changes, throttled) sends which board and card you're on; `updatePeers()` draws the initials in `#peers` and outlines cards with `.card.peer`.
- **Rules:** a board counts as shared while at least one other person is in it (`isSharedRoot`). Home and boards with passwords can't be shared, and shared boards can't get a password (`lockMenuItems`).
- **Content Security Policy:** `connect-src` allows `https:`, `http:`, `wss:` and `ws:` so the app can reach the server you type in. On Android, `allowMixedContent` and `usesCleartextTraffic` let a home-network `http://` server work. On iOS, `NSAllowsLocalNetworking` does the same.

### Edge cases worth knowing
- Shared boards: moving a card *out of* a shared board (into one of your private boards) removes it for the others. Typing in the same card at the same moment: the later save wins, so the other person's text in that card is replaced.
- Clocks: "latest change wins" uses each computer's clock. A badly wrong clock can make its edits win or lose unexpectedly.
- While the user is typing, drawing or dragging, incoming changes wait (`busy()` in `sync-client.js`) and are applied straight after.
- Importing a backup on a synced computer replaces everything: items not in the backup are tombstoned and deleted on other computers too.

---

## 10. Recycle bin

`src/bin.js`. `moveCardsToBin(board, ids)` is the only way cards leave a board through the UI (`deleteSelection()`, `deleteBoard()`, Cut). It:
1. `serialize()`s the cards (with column children and every board inside), plus `crossLinks` (lines to cards that stay) and `colPos` (where a column was, for cards taken out of one),
2. calls `removeCards()`,
3. stores an entry in `store.bin` and shows a toast with **Undo**.

`restoreFromBin(id)` puts things back **with their original ids** into the original board (or Home if that's gone or sealed), re-attaches column membership and cross lines, and removes the entry. If any id is already in use (e.g. restored on another computer meanwhile) it falls back to `insertPayload()` with fresh ids. `purgeBin()` runs at start-up and hourly and drops entries older than `BIN_DAYS` (30). Bin entries are sync items (kind `r` in `merge.js`).

## 11. Password-protected boards

`src/lock.js`.

- **Crypto:** WebCrypto in the renderer. PBKDF2-SHA256 (310,000 iterations, 16-byte random salt) → AES-256-GCM key; fresh 12-byte IV on every encryption. Wrong passwords fail GCM authentication.
- **What's encrypted:** `contentsOf(board)` = its `cards`, `order`, `links` and every board inside it. A locked board inside is included only in its own encrypted form.
- **In memory:** an unlocked board's contents are ordinary cards in `store`, so every feature works unchanged. `unlocked` maps board id → `{ key, plain, iv, ct }`. The key never leaves memory.
- **Saving:** `flushSave()` → `prepareSealed()` → `updateSeals()` (re-encrypts, innermost first, only if the contents changed) → `sealStore()` (a deep copy with every locked board stripped to its `lock` blob) → `PCSync.stamp()` on that copy → `copyBackMt()` → `api.save()`. **Never write `store` itself anywhere**; always a sealed copy. That applies to saving, sync, backups (they use the last saved file), the JSON backup export, and anything new you add.
- **Sync:** `applyRemote()` merges the remote state with the *sealed* local copy, so a locked board merges as one blob (last change wins for the whole board). `reopenUnlocked()` then decrypts the new blob for boards that are open, or locks them if the password changed elsewhere.
- **Unlocking:** `go()` calls `lockGate()`; if the board (or an ancestor) is sealed, `askPasswordFor()` prompts, decrypts and `unsealInto()`s the contents, giving fresh ids if any clash (e.g. a duplicated locked board). `relockLeftBoards()` runs on every navigation and re-seals boards you've left.
- **Undo** history is cleared on unlock and relock so it can never mix sealed and unsealed states.
- **Recycle bin:** entries deleted from inside a locked board store `sealed` (encrypted payload, key of the nearest unlocked locked ancestor) and a generic label; `changePassword()` re-encrypts them.
- **Export** sends the in-memory boards (`opts.data`) to the off-screen window, so an open locked board exports with its contents.
- **Not encrypted:** board title/colour/icon/hint, and asset files (pictures, media). Document this if you change it.

## 12. Backups

`lib/backup.js` (main process). The backup folder (default `Documents/Pocket-Canvas Backups`, set in `settings.backup`) contains `snapshots/<yyyy-mm-dd_hh-mm-ss>.json`, each the last saved file (`lastJson`, so locked boards stay sealed) wrapped with metadata, and a shared `assets/` folder that only ever gains files. A check every 10 minutes and after each save runs a backup when due (`every`: hour/day/week/manual). `prune()` keeps the newest `keep`. Names never overwrite (`_2`, `_3`… suffixes). `read(name)` first makes a "before restore" backup, copies back missing assets, and returns the data; the renderer then replaces `store` like **Import Backup**.

## 13. Spelling

Main process: `applySpelling()` sets `session.setSpellCheckerEnabled()` and (not on macOS) `setSpellCheckerLanguages()` from `settings.spell` (default `['en-GB']`). `spellMenu(params)` handles `webContents` `context-menu` for editable targets: suggestions (`replaceMisspelling`), **Add to dictionary**, Cut/Copy/Paste/Select all. In the renderer, the board's `contextmenu` handler returns early (without `preventDefault`) when the target is being edited, so this menu appears instead of the card menu. Settings › Spelling uses `spell:get/set/removeWord`.

## 14. The browser extension and its local API

### The extension (`browser-extension/`)
- **One manifest for all browsers.** `background.service_worker` is used by Chromium browsers and `background.scripts` by Firefox (each ignores the other; Mozilla's linter shows one expected warning). `browser_specific_settings.gecko` gives the Firefox id and declares no data collection.
- `lib.js` wraps `fetch` to `http://127.0.0.1:<port>`, using `globalThis.browser ?? globalThis.chrome`.
- `background.js`: right-click menu items; `saveFromMenu(info, tab)` builds the request and shows a ✓/! badge.
- `popup.js`: connection state, board picker, note, *Save page / selected text / screenshot*. Selection is read with `scripting.executeScript`; screenshots with `tabs.captureVisibleTab`.
- Permissions: `contextMenus`, `storage`, `activeTab`, `scripting`, host `http://127.0.0.1/*`. Keep this list minimal; store reviewers check it.

### The local API (`lib/clipper.js`)
Listens on `127.0.0.1:<port>` (default **47652**, changeable in Settings).

| Request | Auth | Body → Response |
|---|---|---|
| `GET /status` | none | → `{ app: 'Pocket-Canvas', version, paired }` |
| `POST /pair` | none | `{ browser }` → shows an Allow/Don't allow dialog in the app → `{ token }` (64 hex chars) or 403 |
| `GET /boards` | Bearer token | → `{ boards: [{ id, title, depth }] }` in sidebar order |
| `POST /clip` | Bearer token | `{ kind, boardId?, note?, pageUrl?, pageTitle?, … }` → `{ ok, board }` |

`kind` is one of:
- `page` / `link`: `url`, `title` (link card; the app fetches the preview)
- `text`: `text` (note with a link back to `pageUrl`)
- `image`: `srcUrl` and/or `dataUrl` (downloaded, max 30 MB)
- `screenshot`: `dataUrl`
- `media`: `srcUrl` (downloaded, max 500 MB; falls back to a link card)

Rules: any request whose `Origin` header is present but isn't an extension scheme (`chrome-extension:`, `moz-extension:`, `safari-web-extension:`…) gets **403**, so websites can't use it even before CORS. Bodies are limited to 60 MB. One pairing dialog at a time. Clips are delivered to the renderer (`clip:add`) and placed at the top of the board's **From the web** column (`inbox: true`), created on the right of the board if missing. If the window isn't ready, clips queue until `app:ready`.

---

## 15. Link previews and export

### Link previews (`lib/link-preview.js`)
`linkPreview(url)` fetches the page with Electron's `net.fetch` (10 s timeout, browser-like user agent, reads at most 1.5 MB), parses Open Graph / Twitter / `<title>` / meta description / icon links with small regexes, and downloads the preview picture (≤ 8 MB) and icon (≤ 300 KB) into assets. Direct image URLs use the image itself. The renderer's `fetchPreview(id)` only overwrites a title the user hasn't changed (empty or equal to the host name). Previews are skipped when **Settings › Link previews** is off.

### Export (`lib/export.js`, `src/export-ui.js`)
1. The renderer saves, then calls `exportVisual(opts)`; the main process shows a save dialog.
2. `exportBoard()` opens an **invisible off-screen** `BrowserWindow` (`webPreferences.offscreen: true`, so it can be larger than any screen) loading `index.html?export=<boardId>&format=…&quality=…&background=…&theme=…`.
3. In that page, `EXPORT_MODE` is set: `runExportMode()` adds the `export-mode` CSS class (hides app chrome, buttons and empty placeholders), loads the store, renders the board, waits for images, video frames and fonts, measures every card and line, sets the zoom (PNG high = 2×; capped at 16,000 px for PNG and 19,000 px for PDF) and reports the size with `exportReady()`.
4. The main process resizes the window and either `capturePage()` → PNG or `printToPDF()` with a custom page size → one-page PDF.

**PDF for printing (`format: 'pages'`):**
- `layoutPages()` uses `planPages(items, box, printable)`:
  - Scale = page width ÷ board width (never above 1).
  - Cards are walked top to bottom. When one would cross its page's bottom edge, it and everything after it move down to the next page's top, like inserting a page break. Free line points move with the break above them.
  - Portrait and landscape are both planned for *Best fit*: fewer pages wins, then the larger scale.
- The page lays itself out as one strip exactly `pages × printable height` tall (`html.export-paged`).
- `printToPDF({ pageSize: 'A4' | 'Letter', landscape, margins })` cuts it into pages. Because no card crosses a multiple of the printable height, none is cut.

**In the page (Android, iPhone, iPad): `exportInPage(opts)`**
- The phone apps have no off-screen window, so the board is drawn in the page itself:
  1. The current store is snapshotted, and the board is laid out with the same `layoutPages()` (for pages).
  2. `#world` is cloned into an SVG `<foreignObject>`, with `styles.css` (in CDATA) and the current CSS variables inlined, and pictures turned into `data:` URLs.
  3. The SVG is drawn into canvases.
- Results:
  - **PNG:** `canvas.toBlob`.
  - **PDF:** `makePdf()`, a small PDF writer that puts one JPEG per page.
- The store and view are restored afterwards.

**Scroll bars (`src/scrollbars.js`):** `#hscroll` and `#vscroll` are added to `#viewport`. The range runs from (0, 0) to the furthest card or line plus `CARD_MARGIN` (the margin *Fit to content* uses, so the bars hide after fitting), or to the screen's far edge if that's further. `measureExtent()` runs once per frame via `updateScrollbars()` (from `renderBoard()`, `drawLinks()`, typing and pointer-up); `placeScrollbars()` runs on every `applyView()` and window resize. Their `pointerdown` stops propagation, so no selection box or pan starts underneath.

**Page guides (`src/page-guides.js`):**
- Settings are on the board (`b.pages`, part of `boardMeta` in `merge.js`, so they sync). `pageSetup(b)` fills in defaults.
- `guidePageSize(setup)` is the printable area (paper minus `PAGE_MARGIN` on each side) in CSS px, divided by `scale` for board units.
- `planGuidePages(setup, boardShapes())` tiles pages from (0, 0), row by row, over every card and line. It numbers the pages that have something on them and lists cards whose rectangle crosses a page edge.
- `drawPageGuides()` draws `#page-guides` (first child of `#world`, under everything), sets `.crosses-page` on crossing cards and fills `#pages-chip`. It runs through `updatePageGuides()` (once per frame) from `renderBoard()`, `drawLinks()`, typing in cards and pointer-up.
- **Export with `layout: 'guides'`:**
  - **Desktop:** `layoutGuidedPages()` builds `#print-pages`, with one `.print-page` per numbered page (exactly printable width × height, `contain: strict` so nothing overflows and Chromium doesn't shrink the print). Each holds a clone of `#world` translated to that page. `printToPDF` then gives one sheet per block.
  - **Phones:** `guidedPdfInPage()` sets the view to each page in turn and draws it with `worldToImage()`.
- The guides, the chip and the orange outlines are never drawn in exports.

Saving and syncing are disabled in export mode (`scheduleSave`/`flushSave` return early).

---

## 16. Common changes, step by step

### Add a new card type
Example: a **Quote** card with `text` and `author`.

1. **`src/app.js` – Basics:** `DEFAULT_W.quote = 280`; add an SVG to `ICONS.quote` (24×24, `stroke="currentColor"`); add `['quote', 'Quote']` to `TOOLS`.
2. **`cardDefaults()`:** `case 'quote': return { text: '', author: '' };`
3. **`buildCard()`:** produce the HTML, using `editable('text', c.text, 'Quote…')` per field. `setField()` already stores any plain field by name.
4. **`cardText()`** (search, copy, comments panel title) and **`boardToMd()`** (Markdown export).
5. **`src/styles.css`:** `.card.quote { … }`; add anything that shouldn't appear in exports to the `.export-mode …` rule.
6. **`templates.js`:** add a height estimate in `estHeight()` for gallery previews.
7. **Sync needs nothing:** new fields are tracked automatically.
8. Add checks to `tests/features.js`; update `FEATURES.md` and `docs/USER-GUIDE.md`.

Interactive bits: give buttons `data-act="…"` and handle them in `cardAction()` (`cards-extra.js`). Cards that shouldn't be resizable go in the `['board', 'swatch']` list at the end of `buildCard()`.

### Board icons: replacing or adding pictures
The icons offered in **Change icon…** are listed in `src/board-icons/icons.js`:

```js
const BOARD_ICONS = [
  { id: 'board', name: 'Board', file: 'board.svg' },
  { id: 'home',  name: 'Home',  file: 'home.svg' },
  …
].map((i) => ({ tint: true, ...i }));
```

- Boards store the icon's **id** (`board.icon`), so you can change what an icon looks like without touching anyone's data.
- **Replace a picture:** put your image (PNG, SVG, JPG or WebP; square; 128 × 128 px or bigger) in `src/board-icons/`, then change that entry's `file`, e.g. `{ id: 'home', name: 'Home', file: 'home.png' }`. Every board using `home` updates.
- **Full-colour pictures:** the built-in icons are white line drawings on the board's colour. For a picture that should fill the tile instead, add `tint: false` to its entry.
- **Add an icon:** add a line with a new `id`. **Don't delete or rename ids** that boards may use; an unknown id falls back to the first entry.
- Keep `board` as the first entry: it's the default for new boards.
- Update `ASSETS-LICENCE.md` with who made the pictures and their licence.

Separately, users can give one board its own picture (**Use my own picture…**), which is stored as an asset in `board.iconAsset` and syncs like any picture.

### Add a built-in template
Add an entry to `BUILTIN_TEMPLATES` in `templates.js` with `id` (`builtin-…`), `name`, `color`, `icon`, `description` and `build()`. Use the `templateBuilder()` helpers: `add(type, x, y, fields)`, `col(x, y, title, color, kids, w)`, `line(a, b, opts)` (opts: `shape`, `arrow`, `dash`, `width`, `label`), `board(x, y, title, color, fill, icon)`. Positions are relative: `useTemplate()` moves the whole template so its top-left card sits at (40, 40), or at the left edge below existing cards when inserting into a non-empty board. Give palette swatches `nameAuto: false` if they have names of their own. `tests/features.js` expects eight built-ins; update it.

### Add a menu command
1. `main.js` `buildMenu()`: `{ label: 'My Command', accelerator: 'CmdOrCtrl+K', click: cmd('my-command') }`
2. `app.js` `api.onMenu` switch: `case 'my-command': doSomething(); break;`

### Add something that needs Node or the file system
1. `main.js` (or a new `lib/` module): `ipcMain.handle('area:action', async (_e, args) => { … })`. **Validate every argument**; treat the renderer as untrusted.
2. `preload.js`: `action: (args) => ipcRenderer.invoke('area:action', args)`
3. Renderer: `await api.action(args)`
4. If it loads new kinds of content into the page, check the Content-Security-Policy in `index.html`.

### Add a setting
1. Default in `defaults()` in `lib/settings.js`; expose it in `public()`.
2. Whitelist it in the `settings:set` handler in `main.js`.
3. Add the control to the right pane in `settings-ui.js` (inputs with `data-set="<key>"` save automatically).

### Add a clip type to the extension
1. `lib/clipper.js` `prepare()`: turn the request into `{ card: { type, …fields } }`.
2. `sync-client.js` `addClip()`: map it to card fields.
3. Extension: add a menu item in `background.js` and/or a button in `popup.html/js`.
4. Test in `tests/features.js` (API) and `tests/extension.test.js` (browser).

---

## 17. Styling and themes

- All colours are CSS variables on `:root` (light) and `:root[data-theme="dark"]` in `styles.css`. Use the variables (`--card`, `--text`, `--muted`, `--accent`, `--line`…) and both themes work automatically.
- The card colour label is exposed as `--c` on the card; swatches use `--sw`.
- Sketches always draw on a light "paper" background so pen colours read the same in both themes.
- The version 1.1 additions are grouped at the end of `styles.css`, including the `.export-mode` rules.
- The extension has its own small stylesheet (`popup.css`) that follows the browser's light/dark preference.

---

### Your own interface colours (`src/appearance.js`)
Settings › Appearance saves `store.ui.appearance` (per device, never synced). `applyTheme()` calls `applyAppearance()`, which works out shades for the current mode and sets them as inline CSS variables on `<html>`, overriding `:root` / `:root[data-theme="dark"]`.
- `tintVars(tint, dark)` makes `--bg`, `--panel`, `--panel-2`, `--line`, `--dot`, `--col-bg`, `--text`, `--muted`, `--link` (plus `--card` and `--input` in dark mode) from a hue and a strength.
- `accentVars()` sets `--accent`, `--accent-soft` and `--on-accent` (dark text on pale accents).

New styles should use these variables, not fixed colours, so they follow the user's choice. Text on an accent background should use `color: var(--on-accent, #fff)`.

## 18. Testing

| Command | What it covers | Checks |
|---|---|---|
| `npm run test:merge` | Sync merge engine: concurrent adds, same-card edits, deletes vs later edits, moves between boards, deleted boards, two Home boards, columns, lines (incl. free lines and styles), templates, views, idempotence | 20 |
| `npm test` | Core board features with real mouse/keyboard input | 23 |
| `npm run test:features` | Sync with a simulated second computer (incoming, outgoing, assets, status), tables, sketch drawing/eraser/undo, audio playback and Stop, comments, link previews against a local test website, templates (built-in and saved), picture placeholders, PNG and PDF export, the clipper API (security, text, screenshot, media, board choice), the top-left corner (scroll limits, card limits, older boards, fit, templates at top-left), board icons (all files load, picker, sidebar, sync) Colour cards (typed and picked codes, automatic names, your own names kept, dragging), deleting and the Recycle bin (button, restore with lines, boards, 30-day purge, sync), password-protected boards (encryption on disk and in sync, wrong/right password, nested boards, re-lock on leaving, encrypted bin items, change password), backups (automatic, now, assets, encryption kept, pruning, restore, safety backup) and spelling (defaults, on/off, languages, right-click menu); 1.4: board flush with the window, table − Row/− Column (highlight, cell chosen, last, minimum, undo), 51 icon colours and typed codes, lines (free ends, arrows both/none, dotted/dashed/thick/straight, remembered style, drag line, drag end onto a card, attached end follows, drag-to-draw, copy, menu, detach), text formatting (bar, bold/underline/strike/size/colour/font on the selection only, whole note, sanitising, whole-card styles on a heading, Ctrl+B, clear), colour names (exact names, descriptions, renaming older cards); 1.5: paged PDF (planner never cuts a card, page breaks, scaling, A4 portrait/landscape page sizes, best fit), sketch shapes (rectangle, Shift-level arrow, filled ellipse), pen pressure, erasing shapes, video links (recognising YouTube/Vimeo/Dailymotion/Loom, start times, play, stop, plain link, CSP), appearance (tab, accent, selected name, interface colour, dark shades, any accent, readable text on pale accents, any interface colour, kept locally not synced, reset), tables 1.5 (grips, dragging a column and a row, drop marker, card stays put, undo, Alt+↓/Alt+←, menu items, cell fill, row bold/italic/underline, column text colour, last-applied wins, styles follow moves/inserts/deletes, clear, export, sync, photos by drop and paste, photos follow moves and inserts, photo menu, server and Markdown, remove and undo, pasting tables from Excel/Google Sheets/tab text with styles, headings, merged cells, picture ignored, plain text and single cells stay notes, pasting into a cell grows the table, undo), scroll bars (hidden when it fits, bottom and right bars appear, dragging to the far edge, no selection underneath, track clicks both ways, zoom, hidden again), page guides (menu, A4 sizes from the top-left corner, numbering, chip, kept on the board, crossing outline on and off, blank pages, landscape, Letter, 50%, sync, export dialog default, printed page count and size, off again), shapes (picker tabs, network device name and IP, decision diamond, resizing both ways, + asks which shape comes next (same tab, suggested shape, Shift+click), joined with an elbow line or a plain cable, line end handles above every card, moving a line end to another shape, clicking lines across areas, line labels by double-click, line menu, Change shape, areas at the back, search and Markdown, Flowchart and Network diagram templates, PNG export), and the app against a real Pocket-Canvas Server (create account, Live, own devices both ways, share by name, only the shared board sent, badges, someone else's edits, presence outline, your edits reach them, their pictures arrive, no passwords on shared boards, leaving, sign out) | 322 |
| `npm run test:extension` | The extension loaded into Chromium: manifest accepted, pairing, board list, popup, right-click saves, a web page blocked from the API, disconnect | 13 |
| `npm run test:mobile` | The phone/tablet apps' screens (`build/mobile-www`) in a phone-sized touch Chromium with a pretend phone: start-up, saving to app storage, assets, ⋮ menu, settings, the Android folder picker (cancel, choose), writing to and reading from the sync folder (cards and pictures), link previews, sharing, export as PNG and as A4 PDF pages, page guides from ⋮ and printing them, one-finger pan, pinch zoom, press-and-hold menu, Back button, phone layout; and as an iPhone: start-up, sync settings pointing to the server | 40 |
| `npm run test:web` | The browser version against a real server: served at `/`, `/health` kept, no path escapes, sign-in screen, wrong password, your boards from other devices (no welcome board added), pictures from the server, Live, ⋮ menu, Settings tabs, changes both ways, keyboard shortcuts (zoom, duplicate, undo), uploading a picture, asset type/sandbox/sign-in/ranges, cookie read-only and HttpOnly/Strict, reload, a second browser live, new account with join code, privacy, previews refuse home-network addresses, sign out clears the copy | 34 |
| `npm run test:server` | Pocket-Canvas Server on its own: join code, password rules, unique names, sign-in, hashed storage, own-device relay and catch-up, privacy between accounts, sharing (invite, first copy, edits both ways, outsiders refused), presence (typing, leaving), assets (missing list, upload, download, bad ids), restart keeps everything, leaving, bad keys | 30 |

Each test runs the **real app** with a throw-away data folder and exits non-zero on failure.

- **Linux without a screen** (servers, CI): prefix with `xvfb-run -a`.
- **Running as root / in Docker:** Chromium's sandbox won't start, so use `xvfb-run -a npx electron --no-sandbox tests/features.js` (likewise for `smoke.js`).
- **Extension test** needs Playwright: `npm install --no-save playwright && npx playwright install chromium`. Without it, the test prints *SKIP*.
- `SHOT_DIR=/some/folder` makes `features.js` and `extension.test.js` save screenshots and the exported PNG/PDF there for a visual check.
- Before publishing the extension, also run Mozilla's checker: `npx web-ext lint --source-dir browser-extension` (one expected warning about `service_worker`).

### Manual checklist before a release
- [ ] Fresh start (new `--user-data-dir`): welcome board appears and fits the screen
- [ ] Drop an image, a PDF, an MP3 and an MP4 from outside the app; play and stop both media cards
- [ ] Paste a screenshot from the clipboard; paste a URL and watch the preview arrive
- [ ] New board from each built-in template; save a board as a template and insert it elsewhere
- [ ] Draw a sketch with a pen/touchpad; erase; undo
- [ ] Add, resolve, edit and delete comments
- [ ] Export a big board as PDF and as PNG (high quality, transparent)
- [ ] Sync two computers (or two `--user-data-dir`s) through a real Dropbox/OneDrive/Syncthing folder: edit on both, delete on one, add pictures
- [ ] Install the extension in Chrome and Firefox; connect; save page/selection/screenshot/picture
- [ ] Lock a board, quit, restart, check it asks for the password; check the data file contains no readable text from it
- [ ] Set backups to a USB stick; unplug it; check the warning; plug in; Back up now; restore an older backup
- [ ] Right-click a misspelt word: suggestions and Add to dictionary work (Windows, macOS, Linux)
- [ ] Install the built installer on a clean machine; check the icon, shortcuts and About box
- [ ] Install the APK on a real phone; sync with a computer through Syncthing ([ANDROID.md](ANDROID.md) step 3); pinch, pan, press and hold, Back; add a photo from the phone

---

## 19. Building and releasing

### Version number
Bump `"version"` in `package.json` (for example `1.4.0`). It flows into installer names, the About box and (via `npm run extension`) the extension's `manifest.json`.

### Building locally
`npm run dist` builds for the operating system you're on; `npm run extension` builds the extension zip. Output goes to `dist/`.

| Platform | Targets | Notes |
|---|---|---|
| Windows | NSIS `.exe` (x64) | Assisted installer: choose folder, desktop + Start menu shortcuts. Build on Windows (or CI). |
| Linux | `.AppImage`, `.deb` | `.deb` needs `homepage` and `maintainer`, both already set |
| macOS | `.dmg` | Must be built on a Mac |
| Extension | `pocket-canvas-web-clipper-<version>.zip` | Same zip for Chrome Web Store, Edge Add-ons, Opera and Firefox AMO |

**Step-by-step guides for releasing and code signing are in [RELEASING.md](RELEASING.md).**

Code signing switches on by itself. When the signing secrets are present, the workflow signs (and on macOS, notarises) the installers; without them, it builds unsigned installers. Unsigned installers make Windows SmartScreen and macOS Gatekeeper warn on first run, which the user guide explains. `package.json` already sets `mac.hardenedRuntime`, which notarisation requires. See [RELEASING.md, part 2](RELEASING.md#part-2--code-signing) for the secrets and the Windows options for UK developers.

### Releasing with GitHub Actions
`.github/workflows/build.yml` has two stages:
1. **test** (Ubuntu): merge tests, smoke test, feature tests and the extension test in Chromium, then it builds the extension zip.
2. **build** (Windows, Ubuntu and macOS; only if the tests pass): builds the installers, signing them when the secrets exist.

- **Test build:** GitHub → **Actions** → **Build installers** → **Run workflow**, then download from the run page.
- **Release:** bump `package.json`, commit, then `git tag v1.4.0 && git push origin v1.4.0`. The installers and the extension zip are attached to a GitHub Release for that tag. See [RELEASING.md, part 1](RELEASING.md#part-1--releasing-with-github-actions) for every step, and for what to do when a step fails.

### The Android app
`npm run android:sync` rebuilds `build/mobile-www` from `src/` and copies it into `android/`; `npm run android:open` opens Android Studio. CI builds the APK in the **android** job. Everything about it, including signing with your own key, is in [ANDROID.md](ANDROID.md). Anything you add to `window.api` in `preload.js` needs a matching entry in `mobile/api-mobile.js` (or a sensible "desktop only" answer), and `npm run test:mobile` should still pass.

### The iPhone and iPad app
`npm run ios:sync`, then `npm run ios:open` (on a Mac with Xcode). CI builds a Simulator app and an unsigned `.ipa` in the **ios** job; see [IOS.md](IOS.md).

### The Safari extension
The **safari** job runs Apple's `safari-web-extension-converter` on `browser-extension/`, saves its report, and builds the Mac app that carries the extension; see [SAFARI.md](SAFARI.md).

### The browser version (`web/api-web.js`)
The same `src/` screens, with `window.api` built on the Pocket-Canvas Server instead of Electron or Capacitor. `scripts/build-web.js` copies them to `build/web`, where a server run from the repository finds them. The Docker image and `scripts/build-server.js` build them into the server's `public/` folder.
- **Signing in.** A sign-in screen (part of `api-web.js`) runs before `api.assetBase()` resolves, so the app only starts once signed in. The login sends `web: true`, and the server then also sets an `HttpOnly`, `SameSite=Strict` cookie. That cookie is accepted only for GET, so `<img>`/`<video>` can load `/api/assets/<id>`. The Bearer key is kept in `localStorage` and used for everything else, including the WebSocket.
- **Your boards.** `load()` merges this browser's IndexedDB copy with the copies from `GET /api/docs` (newest first). A browser that hasn't been used before therefore starts from your real boards, not the welcome board. `save()` writes IndexedDB, and `serverOnSaved()` sends the copy live as for any device (personal sync is always on).
- **Files.** `saveBytes`/`pickFiles` PUT to `/api/assets/<id>`, and `assetBase` is `<origin>/api/assets/`. `hasAssets` returns nothing, because everything is already on the server.
- **Link previews** use `GET /api/preview`. The server runs `lib/link-preview.js` with `safeFetch`, which resolves every hop and refuses loopback, private, link-local and CGNAT addresses.
- **Other differences.** Exports use `exportInPage()` and download. The menu bar's accelerators are mapped to `api.menu()` commands, except undo/redo/select-all while typing, which the browser handles itself. The ⋮ menu from `mobile.js` is shown (`api.web`). Settings shows General, Appearance and Account.
- **Server side.** Static files are served from `WEB_DIR` with path checks. `/health` stays JSON for the apps. Assets are sent with their real type, a `sandbox` CSP, `nosniff` and HTTP ranges.

### Portable versions
`package.json` builds a Windows `portable` .exe and Mac `zip`s besides the installers, and the AppImage is portable already. At start-up, `main.js` (`portableMode()`) moves `userData` to a **Pocket-Canvas Data** folder next to the app:
- always for the portable .exe (`PORTABLE_EXECUTABLE_DIR`)
- for the AppImage (`APPIMAGE`) and a packaged Mac app only when that folder already exists

**About** then shows where the boards are kept.

### The server
`npm run server` runs it from the repository (after `cd server && npm install`). Its version is in `server/package.json` and `VERSION` in the script; keep them in step with the app.

### Publishing the extension
See `browser-extension/README.md` for each store's submission page, the permission justifications and the privacy answers.

### Icons
(These are the *app's* icons. For the icons boards can use, see [Board icons](#board-icons-replacing-or-adding-pictures).) Replace `build/artwork/` with the new artwork, then regenerate `build/icon.png` (1024 px), `build/icon.ico` (16–256 px), `src/icon.png` (512 px) and `browser-extension/icons/icon-{16,32,48,96,128}.png`. Update `ASSETS-LICENCE.md`.

---

## 20. Changing the data format safely

People's boards live in `pocket-canvas-data.json` and in sync folders for years, read by different app versions on different computers at the same time. Format changes must never lose data.

- **Adding an optional field** (for example `card.locked`) needs no migration. Treat a missing value as the default. Older versions ignore unknown fields and the merge engine carries them along.
- **Renaming, restructuring or removing fields:**
  1. Increase `store.version` in `defaultStore()`.
  2. In `migrate()`, add `if ((data.version || 1) < 2) { …convert…; data.version = 2; }`. Keep older steps so any old file upgrades in sequence.
  3. Think about **sync**: an older version on another computer will keep writing the old shape. Either keep reading both shapes, or bump the sync file `format` in `lib/sync.js` and have older-format files ignored with a "please update Pocket-Canvas on your other computers" status message.
  4. Test by loading a file saved by the previous release, and by syncing with it.
- Never throw away fields you don't recognise.
- If the **product name** changes again, the data folder name changes with it. Extend `importOldData()` in `main.js`.

---

## 21. Conventions

- **Style:** 2-space indent, single quotes, semicolons, `const`/`let` (never `var`), arrow functions for callbacks.
- **Escaping:** any user text inserted with `innerHTML` goes through `esc()`; note HTML through `sanitize()`; colours from data through `safeColor()`. Never insert raw strings, because synced files and web clips are untrusted.
- **No inline handlers:** the CSP blocks `onclick="…"`/`onerror="…"`. Attach listeners in JavaScript.
- **State first, then DOM:** change `store`, then re-render, then `scheduleSave()`. Don't keep state only in the DOM.
- **Undo:** every user-visible change must be undoable (`checkpoint()` before it, or snapshot + `pushUndo()` around a gesture).
- **Copyright header** at the top of each source file:
  `Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>`
- **Commits:** short imperative subject ("Add quote card", "Fix column drop index").
- **Docs:** update `FEATURES.md` and `docs/USER-GUIDE.md` in the same change as the feature.

---

## 22. Known limitations and ideas

| Area | Today | Idea |
|---|---|---|
| Performance | Whole-board re-render; whole-store undo snapshots; whole-store sync copies | Fine for hundreds of cards per board. For thousands: render only visible cards, diff-based history, per-board copies. |
| Live editing | Latest change per card wins; incoming changes wait while you type | Character-level merging inside notes (CRDT) |
| Sharing | Everyone in a shared board can edit; accounts managed in the server's files | Viewer-only sharing; an admin page for accounts; invites by link |
| Locked boards | Contents encrypted; title, icon and asset files are not; can't be shared | Encrypt asset files too; end-to-end encrypted sharing |
| Assets | Deleted cards' files stay in `assets/` (so undo and sync work) | "Clean up unused files" command |
| Backup | JSON backup excludes images and files | Export a single `.zip` with data and assets |
| Export | One board at a time; pages scale to the page width | Include sub-boards; choose a scale and split wide boards across pages too |
| Sketch | Pen with pressure, shapes, stroke eraser | Text in sketches, lasso select, moving shapes after drawing |
| Videos | YouTube, Vimeo, Dailymotion, Loom | More sites; a privacy setting to turn players off |
| iPhone/iPad | Syncs through the server only; unsigned builds | Folder sync through the Files app (security-scoped bookmarks); App Store |
| Extension | Chromium browsers, Firefox, Safari (Mac, unsigned) | Signed Safari release; Safari on iPhone and iPad |
| Accessibility | Mouse-first; keyboard covers the basics | Focus navigation between cards, ARIA labels, screen-reader testing |

---|---|---|
| Performance | Whole-board re-render; whole-store undo snapshots; whole-store sync file | Fine for hundreds of cards per board. For thousands: render only visible cards, diff-based history, per-board sync files. |
| Sync | Folder-based, polling every 4 s, latest-change-wins per card (per whole board for locked boards) | Optional self-hosted sync server with live updates; merge text edits within a note rather than whole-card |
| Locked boards | Contents encrypted; title, icon and asset files are not | Encrypt asset files too; optional auto-lock after inactivity |
| Collaboration | One person, many computers | Shared boards with other people (needs accounts or a server) |
| Assets | Deleted cards' files stay in `assets/` (so undo and sync work) | "Clean up unused files" command |
| Backup | JSON backup excludes images and files | Export a single `.zip` with data and assets |
| Export | One-page PNG/PDF of one board | Paged PDF (A4/Letter), include sub-boards |
| Sketch | Pen, colours, sizes, stroke eraser | Pressure, shapes, text, lasso select |
| Media | Local files; direct media links downloaded | Embedded YouTube/Vimeo players (would need CSP and privacy review) |
| Extension | Chromium browsers and Firefox | Safari (wrap with `xcrun safari-web-extension-converter`) |
| Accessibility | Mouse-first; keyboard covers the basics | Focus navigation between cards, ARIA labels, screen-reader testing |
| Android | Sync folder by typed path with "All files access" (fine for sideloading, not allowed on Google Play for this kind of app); no PNG/PDF export or folder backups | Android folder picker (Storage Access Framework) via a small plugin; export via an off-screen WebView; iOS with the same Capacitor set-up |

---

Questions or contributions: **pocket-designs@proton.me**
