# Pocket-Canvas for iPhone and iPad

Copyright © 2026 Pocket-Designs · pocket-designs@proton.me

The iPhone and iPad app shares its screens and features with the desktop and Android apps: boards, cards, templates, comments, the Recycle bin, password-protected boards, text formatting, lines, sketches (with Apple Pencil pressure), videos, exporting as a picture or PDF, and shared boards.

To keep it in step with your other devices, use a **Pocket-Canvas Server** ([server/README.md](../server/README.md)). Sync folders only work on computers and Android.

You need **iOS / iPadOS 15 or newer**.

## Contents

1. [What GitHub builds](#1-what-github-builds)
2. [Trying it in the iPhone Simulator (on a Mac)](#2-trying-it-in-the-iphone-simulator-on-a-mac)
3. [Installing on your own iPhone or iPad](#3-installing-on-your-own-iphone-or-ipad)
4. [Sharing it with other people](#4-sharing-it-with-other-people)
5. [Using the app](#5-using-the-app)
6. [For developers](#6-for-developers)

---

## 1. What GitHub builds

The **ios** job in the workflow builds on a Mac at GitHub. On the run page, the **pocket-canvas-ios** download contains:

- `Pocket-Canvas-1.5.0-ios-simulator.zip`: for the iPhone Simulator on a Mac
- `Pocket-Canvas-1.5.0-ios-unsigned.ipa`: for real iPhones and iPads once it's signed (section 3)

Apple only lets an app onto a real device if it's **signed**, and signing needs an Apple account, so GitHub can't do that part for you yet.

## 2. Trying it in the iPhone Simulator (on a Mac)

1. Install **Xcode** from the Mac App Store and open it once. It installs the Simulator.
2. Unzip `Pocket-Canvas-…-ios-simulator.zip` to get `App.app`.
3. Open **Xcode › Open Developer Tool › Simulator**, then pick a device under **File › Open Simulator**.
4. Drag `App.app` onto the Simulator window. Pocket-Canvas appears on its home screen.

## 3. Installing on your own iPhone or iPad

Choose **one** of these.

### Option 1: Sideloadly or AltStore (free Apple Account, no Mac needed)

These tools sign the unsigned `.ipa` with your own Apple Account and install it.

1. Install **Sideloadly** (Windows or Mac, <https://sideloadly.io>) or **AltStore** (<https://altstore.io>).
2. Connect the iPhone or iPad by cable, and trust the computer when asked.
3. Drag `Pocket-Canvas-…-ios-unsigned.ipa` into Sideloadly, type your Apple Account email, and click **Start**.
4. On the iPhone or iPad, approve the app under **Settings › General › VPN & Device Management**, by tapping your Apple Account and then **Trust**.
5. **iOS 16 and later:** turn on **Settings › Privacy & Security › Developer Mode**, then restart the device.

With a free Apple Account, the app works for **7 days**. Then sign it again the same way (AltStore can do this automatically). Your boards are kept.

### Option 2: Xcode (Mac)

1. On the Mac, get the project: run `npm install`, then `npm run ios:sync`, then `npm run ios:open`.
2. In Xcode, click the **App** project, then the **App** target, then **Signing & Capabilities**.
   - Tick **Automatically manage signing**.
   - Choose your **Team**: your Apple Account, under *Personal Team*.
   - If Xcode says the bundle identifier is taken, change it to something like `com.yourname.pocketcanvas`.
3. Connect the device, pick it at the top of the window, and click **Run** (▶).

As with option 1, a free account works for 7 days; a paid one for a year.

## 4. Sharing it with other people

You need the **Apple Developer Program** (US$99 a year, the same membership used to sign the Mac app in [RELEASING.md](RELEASING.md)).

- **TestFlight:** up to 10,000 testers by email or public link. This is the easiest way.
  1. In Xcode, choose **Product › Archive**, then **Distribute App › App Store Connect**.
  2. Add testers in App Store Connect.
- **App Store:** the same archive, submitted for review.

## 5. Using the app

Everything works by touch, as on Android: drag to move around, pinch to zoom, tap to select and tap again to edit, press and hold for the menu, and use **⋮** for templates, export, the Recycle bin and settings.

- **Exports and backups** open the iOS share sheet, so you can save to Files, AirDrop them, or send them in a message.
- **Apple Pencil:** in a sketch, pressing harder draws thicker lines.
- **Sync:** use **⋮ › Settings › Server**.

## 6. For developers

- The app is the same Capacitor project as Android:
  - **Settings:** `capacitor.config.json`
  - **Web part:** `build/mobile-www`, built by `scripts/build-mobile-web.js` from `src/` plus `mobile/api-mobile.js`
  - **Xcode project:** `ios/App`, kept in Git and using Swift Package Manager
- `api-mobile.js` checks `Capacitor.getPlatform()`. On iOS it has no folder sync (Android's `SyncFolder` plugin isn't there), so the Sync tab points to the server.
- `ios/App/App/Info.plist` has:
  - the camera, photo and microphone messages, for adding pictures and videos
  - `NSAllowsLocalNetworking`, so a home-network server works over `http://`
- The app's **version** comes from `package.json`; the workflow writes it into the Xcode project.
- `npm run test:mobile` also checks the iPhone layout and settings in a pretend iPhone.
