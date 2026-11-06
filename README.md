# Pocket-Canvas

A desktop app for organising ideas visually, in the style of Milanote: put notes, pictures, links, to-do lists, tables, sketches, audio, video and files on an infinite board, group them in columns, connect them with lines, and nest boards inside boards. Start from templates, sync across your computers, and save from your browser with the companion extension.

Runs on Windows, Linux, macOS, Android, iPhone and iPad. Local-first: no account, no Pocket-Canvas cloud. Your boards stay on your own devices, or on a server you run yourself.

**Author:** Pocket-Designs · pocket-designs@proton.me

© 2026 Pocket-Designs · MIT licence (see `LICENSE`; the logo and third-party licences are covered in `ASSETS-LICENCE.md`)

---

## Features

The full list is in [FEATURES.md](FEATURES.md). Highlights:

**Cards:** note (rich text) · to-do list · link with automatic preview (picture, title, description) · picture · audio & video with Play / Stop · file · table · freehand sketch · board (nested, as deep as you like) · column · heading · colour swatch

**New in 1.5**
- **Share boards and edit them together, live**, through your own **Pocket-Canvas Server** (see [server/README.md](server/README.md)), which also syncs your devices
- **PDF for printing** on A4/Letter pages (portrait, landscape or best fit; cards never cut in half), with **page guides** on the board that you can turn on and off
- **Pressure-sensitive pens** and **shapes** in sketches; **YouTube, Vimeo, Dailymotion and Loom** players in link cards
- **iPhone and iPad app** ([docs/IOS.md](docs/IOS.md)) and the web clipper for **Safari** ([docs/SAFARI.md](docs/SAFARI.md))
- Android: Android's own folder picker for sync, and picture/PDF export

**New in 1.4**
- **Android app** that syncs with your computers (see [docs/ANDROID.md](docs/ANDROID.md))
- **Text formatting**: font, size, bold, italic, underline, strikethrough, colour
- **Line styles** (no arrows, both ends, dashed, dotted, thick, straight) and **free-floating lines**
- **− Row / − Column** on tables, **51 board-icon colours**, and no gap at the board's edge

**New in 1.3**
- **Recycle bin**: deleted cards and boards can be restored for 30 days; delete buttons on cards, in the top bar and in the sidebar
- **Password-protected boards**, encrypted with AES-256
- **Automatic backups** to a folder you choose, with one-click restore
- **Spell checking** with right-click suggestions and your own dictionary (English UK by default)

**New in 1.2**
- Boards have a fixed **top-left corner** and grow right and down; templates load at the top-left
- **42 board icons**, with a picker for icon and colour; easy to swap for your own pictures (`src/board-icons/`)
- **Colour cards** take any colour code or picked colour and **name it automatically**

**New in 1.1**
- **Sync between computers** through Dropbox, OneDrive, Google Drive, iCloud, Nextcloud, Syncthing or any synced folder, merging card by card so nothing is overwritten
- **Templates:** mood board, storyboard, project plan, mind map, weekly planner and brainstorm, plus save any board as **your own template**
- **Comments** on any card: resolve, edit, delete, searchable
- **Link previews** with page picture and description (can be turned off)
- **Tables**, **audio and video cards**, **freehand sketch cards**
- **Export a board as PDF or PNG**: the whole board, full size, one page
- **Browser extension** for Chrome, Edge, Brave, Opera, Vivaldi, Firefox and Safari (Mac): save pages, selections, screenshots, pictures, video and audio. One package for every store, or load it without a store. See [`browser-extension/README.md`](browser-extension/README.md).

**Board:** infinite canvas with pan/zoom · drag cards onto boards, the sidebar or breadcrumbs to file them · lines and arrows · colour labels · multi-select · copy/paste between boards · undo/redo · search across everything (including comments) · dark and light themes · Markdown export and JSON backup · autosave with a safety copy

## Guides

- **[User Guide](docs/USER-GUIDE.md)**: installing and using Pocket-Canvas, for everyone
- **[Developer Guide](docs/DEVELOPER-GUIDE.md)**: how the code works, testing, building and releasing
- **[Android app](docs/ANDROID.md)**: installing it, syncing with Syncthing, and how it's built
- **[iPhone and iPad app](docs/IOS.md)** and **[Safari extension](docs/SAFARI.md)**
- **[Pocket-Canvas Server](server/README.md)**: running your own server for syncing and shared boards (Docker, Proxmox)
- **[Releasing and code signing](docs/RELEASING.md)**: step-by-step guides to publishing a release and signing the installers

## Running it from the source

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm start
```

Tests (see the [Developer Guide](docs/DEVELOPER-GUIDE.md#18-testing)):

```bash
npm run test:merge      # sync merge engine (plain Node)
npm test                # core features, real app
npm run test:features   # 1.1 features: sync, export, templates, comments, extension API…
npm run test:extension  # extension in Chromium (needs Playwright)
npm run test:mobile     # phone/tablet app screens in a phone-sized Chromium (needs Playwright)
npm run test:server     # Pocket-Canvas Server (needs: cd server && npm install)
```

## Building an installer

```bash
npm run dist:win     # Windows installer (.exe)  — run on Windows
npm run dist:linux   # Linux AppImage and .deb
npm run dist:mac     # macOS .dmg                — run on a Mac
```

The installers appear in the `dist` folder.

```bash
npm run extension    # browser extension zip for the add-on stores
npm run android:apk  # Android APK (needs Android Studio / SDK; GitHub Actions does it for you)
```

**Easiest way to get a Windows .exe without setting anything up:** push this project to GitHub. The included workflow (`.github/workflows/build.yml`) builds Windows, Linux and macOS installers automatically. Go to the repo's **Actions** tab → **Build installers** → **Run workflow**, then download the installers from the finished run. Pushing a tag such as `v1.0.0` also attaches them to a GitHub Release.

## Where your data lives

| System  | Folder |
|---------|--------|
| Windows | `%APPDATA%\Pocket-Canvas` |
| Linux   | `~/.config/Pocket-Canvas` |
| macOS   | `~/Library/Application Support/Pocket-Canvas` |

`pocket-canvas-data.json` holds your boards; the `assets` folder holds images and files you added. *File → Open Data Folder* takes you there. To back everything up, copy that whole folder.

## Keyboard & mouse

| Action | How |
|---|---|
| Select several cards | Drag on an empty part of the board |
| Move around | Scroll, Space + drag, or middle-mouse drag |
| Zoom | Ctrl + scroll, Ctrl + = / Ctrl + − , Ctrl + 0 to reset |
| Fit board to screen | Ctrl + 1 |
| New note | Double-click empty board, or press **N** |
| Quick add | **T** to-do · **H** heading · **B** board · **C** column · **K** link · **G** table · **S** sketch · **L** line |
| Edit a card | Click to select, click again (or press Enter) |
| Open a board card | Double-click, or select it and press Enter |
| Up to the parent board | Alt + ← |
| Duplicate / Delete | Ctrl + D / Delete |
| Undo / Redo | Ctrl + Z / Ctrl + Shift + Z |
| Search | Ctrl + F |
| Comments on selected card | Ctrl + Shift + M |
| New board from a template | Ctrl + Shift + N |
| Export board as PDF / picture | Ctrl + Shift + E |
| Settings (sync, extension, your name) | Ctrl + , |
| Toggle sidebar / theme | Ctrl + \ / Ctrl + Shift + L |

## Project layout

```
main.js        Electron main process: window, menus, saving, file handling
preload.js     Safe bridge the interface uses to talk to main.js
src/index.html Interface layout
src/styles.css Look and feel (light + dark themes)
src/           The interface: app.js (core) plus feature files (templates, comments, sync, export…)
lib/           Main-process modules: settings, sync, extension API, link previews, export
browser-extension/  The web clipper extension (Chrome, Edge, Brave, Opera, Vivaldi, Firefox)
scripts/       build-extension.js: zips the extension for the stores
tests/         Automated tests (merge, smoke, features, extension)
docs/          User guide and developer guide
src/icon.png   App logo: window, taskbar, sidebar and About box
build/         Installer icons (icon.png, icon.ico) and the original logo artwork
ASSETS-LICENCE.md Licences for the logo, artwork and bundled third-party software
```

> **Upgrading from PocketCanvas?** The first time Pocket-Canvas starts, it copies your boards, images and files from the old `PocketCanvas` data folder automatically. The old folder is left untouched, so you can delete it once you're happy.
