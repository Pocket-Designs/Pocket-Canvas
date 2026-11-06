# Pocket-Canvas Web Clipper (browser extension)

Save web pages, pictures, videos, sounds, screenshots and selected text from your browser straight onto your Pocket-Canvas boards.

One extension, one code base, for **Chrome, Microsoft Edge, Brave, Opera, Vivaldi and Firefox**. Use it from an add-on store, or load it straight into the browser without one.

© 2026 Pocket-Designs · pocket-designs@proton.me · MIT licence (logo excluded; see `ASSETS-LICENCE.md`)

---

## What it does

- **Toolbar button:** save the current page (with its preview), the text you've selected, or a screenshot of what you can see. Pick which board it goes to and add a note, which is saved as a comment on the card.
- **Right-click menu:** *Save page*, *Save link*, *Save picture*, *Save video / audio*, *Save selected text*.
- Everything you save lands in a **From the web** column on the chosen board.

The Pocket-Canvas app must be open on the same computer. The extension talks only to the app at `http://127.0.0.1` (your own computer). It sends nothing to Pocket-Designs or anyone else.

---

## Installing without a store

### Chrome, Edge, Brave, Opera, Vivaldi
1. Unzip `pocket-canvas-web-clipper-<version>.zip` into a folder you'll keep (or use the `browser-extension` folder from the source code).
2. Open the extensions page:
   - Chrome / Brave / Vivaldi: `chrome://extensions`
   - Edge: `edge://extensions`
   - Opera: `opera://extensions`
3. Turn on **Developer mode** (a switch at the top right, or at the bottom left in Edge).
4. Click **Load unpacked** and choose the unzipped folder.
5. Pin it: click the puzzle-piece icon in the toolbar, then the pin next to *Pocket-Canvas Web Clipper*.

The browser may show a "developer mode extensions" reminder when it starts. That's normal for extensions not installed from a store.

### Firefox
- **Quick try (until Firefox closes):** open `about:debugging` › **This Firefox** › **Load Temporary Add-on…** and choose `manifest.json` inside the folder.
- **Permanent, without the public store:** Firefox only installs signed extensions permanently. Sign it for free as an *unlisted* (self-distributed) add-on:
  1. Make a free account at https://addons.mozilla.org/developers/
  2. **Submit a New Add-on** › **On your own** › upload the zip.
  3. Download the signed `.xpi` file and drag it into Firefox.
- **Firefox Developer Edition, Nightly or ESR** can install unsigned add-ons: set `xpinstall.signatures.required` to `false` in `about:config`, rename the zip to `.xpi`, then in `about:addons` click the gear › **Install Add-on From File…**

### Safari (macOS)
Safari extensions must be wrapped in a Mac app using Xcode: `xcrun safari-web-extension-converter browser-extension/`. This hasn't been tested yet.

---

## First use: connecting
1. Open Pocket-Canvas.
2. Click the extension's toolbar button, then **Connect**.
3. Pocket-Canvas asks *"Let the Pocket-Canvas extension in Chrome save to your boards?"*. Click **Allow**.

Done. You can see or disconnect connected browsers in Pocket-Canvas under **Settings › Browser extension**.

If Pocket-Canvas uses a different port (Settings › Browser extension › Port), set the same number in the extension's **Options**.

Firefox may ask to allow access to "127.0.0.1" when you click Connect. Click **Allow**; that's the app on your own computer.

---

## Publishing to the stores

Build the store package from the project folder:

```bash
npm run extension
```

This makes `dist/pocket-canvas-web-clipper-<version>.zip`, with `manifest.json` at the top as every store requires. The extension's version is kept in step with the app's version.

**The same zip works for every store:**

| Store | Where to submit | Notes |
|---|---|---|
| Chrome Web Store (also used by Brave and Vivaldi) | https://chrome.google.com/webstore/devconsole | One-off US$5 developer registration |
| Microsoft Edge Add-ons | https://partner.microsoft.com/dashboard/microsoftedge | Free |
| Opera add-ons | https://addons.opera.com/developer/ | Free |
| Firefox Add-ons (AMO) | https://addons.mozilla.org/developers/ | Free. Choose "On this site" to list it publicly, or "On your own" for a signed file only you share. |

**Things the stores will ask for:**
- **Privacy:** the extension collects no data and sends nothing off your computer. (The Firefox manifest already declares no data collection.)
- **Why each permission is needed:**
  - `contextMenus`: the right-click *Save to Pocket-Canvas* items
  - `storage`: remembers the port, the connection and your last board
  - `activeTab`: reads the current page's title and address, and takes a screenshot, only when you click the button
  - `scripting`: reads the text you've selected, only when you open the popup
  - `http://127.0.0.1/*`: talks to the Pocket-Canvas app on your own computer
- **Screenshots and icon:** use `icons/icon-128.png`, plus screenshots of the popup.

Mozilla's checker can be run before submitting: `npx web-ext lint --source-dir browser-extension`. It reports one expected warning: Firefox ignores the `service_worker` line, which is there for Chrome.

---

## Files

```
manifest.json   Works in Chrome-family browsers (service_worker) and Firefox (scripts) at once
lib.js          Talking to the app: status, pairing, board list, saving
background.js   Right-click menu items
popup.html/js   The toolbar popup
options.html/js Port and connection settings
popup.css       Styles (light and dark)
icons/          Pocket-Canvas logo in 16–128 px
```
