# Pocket-Canvas — Asset Licences

This file lists every asset that ships with Pocket-Canvas, who made it, and the licence it is used under.

Last reviewed: 15 October 2026 (version 1.3.0)

---

## 1. Pocket-Canvas logo and app icon

A hand-drawn illustration of a corkboard with pinned notes, a photo, a colour palette and a mind map, tucked into a denim pocket labelled "Pocket-Canvas".

| File | Use |
|---|---|
| `build/artwork/pocket-canvas-logo-original.png` | Original artwork as supplied (1024 × 1024 PNG) |
| `build/icon.png` | App icon used by the Linux and macOS installers (artwork centred, 1024 × 1024) |
| `build/icon.ico` | Windows app and installer icon (16–256 px) |
| `src/icon.png` | Window and taskbar icon, sidebar logo and About box (512 × 512) |
| `browser-extension/icons/icon-16.png` … `icon-128.png` | Browser-extension toolbar and store icons (16, 32, 48, 96, 128 px), resized from the same artwork |
| `android/app/src/main/res/mipmap-*/ic_launcher*.png`, `drawable*/splash.png` | Android app icons (normal, round and adaptive foreground) and splash screens, made from the same artwork |
| `ios/App/App/Assets.xcassets/AppIcon.appiconset/*`, `Splash.imageset/*` | iPhone and iPad app icon and splash screen, made from the same artwork |

**Artwork by Pocket-Designs.** Copyright © 2026 Pocket-Designs <pocket-designs@proton.me>. All rights reserved.

The logo and app icon identify Pocket-Canvas, so they are **not** covered by the MIT licence. You may show them unchanged when talking about, linking to or redistributing Pocket-Canvas or its browser extension. Any other use, or a modified version, needs permission from Pocket-Designs.

## 2. Other original assets (made for Pocket-Canvas)

These were created specifically for this project and are owned by the project.

| Asset | Location | Description |
|---|---|---|
| Tool and card icons | `src/app.js` (`ICONS`) | Note, Link, To-do, Line, Board, Column, Table, Sketch, Heading, Image, Media, File, Colour, comment and settings icons. Hand-written SVG paths made for this project, not copied from any icon set. |
| Board icons (42) | `src/board-icons/*.svg` | Home, Star, Idea, Calendar, Travel, Music and the rest. Simple white line drawings made for this project, not copied from any icon set. MIT, like the code. If you replace any with your own pictures, list them here with their author and licence. |
| Recycle bin and padlock icons | `src/bin.js`, `src/lock.js` | Hand-written SVG made for this project. |
| Media player icons | `src/cards-extra.js` | Play, pause, stop, volume, mute and music-note icons. Hand-written SVG. |
| Built-in templates | `src/templates.js` | Mood board, Storyboard, Project plan, Mind map, Weekly planner and Brainstorm layouts and their sample text. The example palette colours are just colour values. |
| Browser extension interface | `browser-extension/` | Popup, options page and styles. |
| Arrowhead marker | `src/index.html` | SVG arrowhead used on the lines between cards. |
| Interface design | `src/styles.css`, `src/index.html` | Layout, colours, light and dark themes. |
| Welcome board content | `src/app.js` (`defaultStore`) | Sample text shown on first launch. |
| Template gallery previews | `src/templates.js` | Drawn automatically from each template's layout. |

**Copyright © 2026 Pocket-Designs** <pocket-designs@proton.me>

These assets are released under the same **MIT licence** as the rest of Pocket-Canvas (see `LICENSE`). You may reuse, modify and redistribute them as long as the copyright notice and licence are kept.

### Colour names

`src/colour-names.js` uses the standard web colour names (such as *Dodger Blue* and *Sea Green*) defined in the W3C CSS Color specification, written with British spelling (*Grey*), plus a short list of everyday colour names (such as *Rust*, *Burgundy* and *Terracotta*) with their commonly used codes. Descriptions such as *Dark Golden Brown* are worked out by the app's own code. Colour names and values are facts, not a creative work.

## 3. Fonts

No font files are bundled. Pocket-Canvas uses whatever system font is already installed on the user's computer (Segoe UI on Windows, the system UI font on macOS, Roboto/Ubuntu/other sans-serif on Linux). Those fonts are licensed to the user by their operating system vendor and are not redistributed by Pocket-Canvas.

## 4. Emoji and symbol characters

Characters such as ☰ ↶ ↷ ⤢ and 📎 are ordinary Unicode text, drawn by the user's own system fonts. No emoji images or icon fonts are included.

## 5. Third-party software included in the installers

### Electron
- Website: https://www.electronjs.org
- Licence: **MIT**
- Copyright (c) Electron contributors
- Copyright (c) 2013-2020 GitHub Inc.

The full Electron licence (`LICENSE`) and the licences for Chromium and its components (`LICENSES.chromium.html`) are copied automatically into every Pocket-Canvas installer and installed app folder.

### Chromium (bundled inside Electron)
- Website: https://www.chromium.org
- Licence: BSD 3-Clause, together with the various open-source licences of its components (all listed in `LICENSES.chromium.html`).

### Node.js (bundled inside Electron)
- Website: https://nodejs.org
- Licence: MIT and the licences of its components (included in `LICENSES.chromium.html`).

### Pocket-Canvas Server
| Component | Licence |
|---|---|
| ws (WebSocket library) | MIT |
| Node.js (to run it) | MIT |
| Caddy (optional, in docker-compose.yml) | Apache-2.0 |

### In the phone and tablet apps (Android, iPhone, iPad)
| Component | Licence |
|---|---|
| Capacitor (`@capacitor/android`, `@capacitor/core`) — Ionic | MIT |
| Capacitor plugins: App, Browser, Filesystem, Share — Ionic | MIT |
| Ionic file system library (used by the Filesystem plugin) | MIT |
| AndroidX libraries (AppCompat, Core, CoordinatorLayout, SplashScreen, WebKit) — Google | Apache-2.0 |
| Kotlin standard library and coroutines — JetBrains | Apache-2.0 |
| AndroidX DocumentFile — Google | Apache-2.0 |
| Capacitor iOS (`@capacitor/ios`) and its Swift package — Ionic | MIT |

The full licence texts come with each package (for example `node_modules/@capacitor/android/LICENSE`). Before publishing the Android app widely (for example on Google Play), add an "Open-source licences" page to the app that shows these texts, as the Apache-2.0 licence asks for.

## 6. Build-only tools (not shipped)

These are used to build the installers but are **not** included in the app the user installs:

| Tool | Licence |
|---|---|
| electron-builder | MIT |
| NSIS (Windows installer engine, used by electron-builder) | zlib/libpng |
| AppImage runtime (used by electron-builder) | MIT |
| Playwright (only for the automated browser-extension and Android-screens tests) | Apache-2.0 |
| Capacitor CLI (prepares the Android and iOS projects) | MIT |
| Xcode and Apple's Safari web extension converter (build the iOS app and the Safari extension app) | Apple's Xcode licence |
| Gradle and the Android Gradle Plugin (build the APK) | Apache-2.0 |
| web-ext (Mozilla's extension checker, optional) | MPL-2.0 |

The browser extension contains **no third-party code**: only the files in `browser-extension/`, all written for this project.

The AppImage runtime is embedded in the Linux `.AppImage` file itself. Its MIT licence permits this.

## 7. User content

Pictures, files, audio, video, links, sketches, comments and text that users add to their boards belong to those users. They are stored on the user's own computer, in the Pocket-Canvas data folder, and, if the user turns on sync, in the sync folder they choose. Pocket-Canvas claims no rights over them.

Content saved from websites (with the browser extension, by pasting, or as link-preview pictures) still belongs to its original owners. It is saved for the user's personal reference; users are responsible for how they reuse it.
