# Pocket-Canvas for Android

Copyright © 2026 Pocket-Designs · pocket-designs@proton.me

The Android app uses the same boards, cards and screens as the desktop app. It syncs with your computers the same way, through a shared folder, or through your own Pocket-Canvas Server, which also lets you share boards with other people. This guide covers:

1. [Getting the app](#1-getting-the-app)
2. [Installing it on a phone or tablet](#2-installing-it-on-a-phone-or-tablet)
3. [Syncing with your computer, step by step](#3-syncing-with-your-computer-step-by-step)
4. [Using the app](#4-using-the-app)
5. [Troubleshooting](#5-troubleshooting)
6. [For developers: how the app is built](#6-for-developers-how-the-app-is-built)

You need **Android 7 or newer**.

---

## 1. Getting the app

GitHub builds the app (an `.apk` file) along with the desktop installers.

**For a test build:**

1. On GitHub, open the repository's **Actions** tab.
2. Choose **Build installers**, then **Run workflow**.
3. When the run has finished, scroll down to **Artifacts**.
4. Download **pocket-canvas-android**. It's a zip file containing `Pocket-Canvas-1.5.0-android.apk`.

**From a release:** when you publish a release by pushing a version tag (see [RELEASING.md](RELEASING.md)), the `.apk` is attached to the GitHub Release alongside the installers.

## 2. Installing it on a phone or tablet

1. **Get the `.apk` onto the phone.** Any of these work:
   - download it on the phone from the GitHub page
   - email it to yourself
   - copy it over with a USB cable
   - put it in your sync folder

   If you downloaded the zip, unzip it first; the Files app can do this.
2. Tap the `.apk` in **Files** (or in **Downloads**).
3. Android says the app you opened it from isn't allowed to install apps. Tap **Settings**, turn on **Allow from this source**, then go back.
4. Tap **Install**.
5. **Google Play Protect** may say it doesn't recognise the developer. Tap **More details**, then **Install anyway**.

   You'll see this message because the app isn't from Google Play, not because anything is wrong with it.
6. Open **Pocket-Canvas**. It starts with a welcome board, just like the desktop app.

**Updating:** install a newer `.apk` the same way. It replaces the old app and keeps your boards.

Uninstalling the app deletes the boards stored on the phone. Copies on your other devices are kept if sync is on.

### Updating from a test build made before November 2026
The app's internal ID changed from `com.projecttechme.pocketcanvas` to `com.pocketdesigns.pocketcanvas`, so Android installs version 1.5 **alongside** an older test build instead of replacing it. To keep your boards:
1. In the old app, choose **⋮ › Save a backup of all boards…** (or let sync copy your boards to your computer).
2. Install the new app, then choose **⋮ › Restore from a backup…**, or turn sync on again.
3. Uninstall the old Pocket-Canvas (the one that's still there).

## 3. Syncing with your computer, step by step

The desktop app syncs through a folder that a sync service keeps the same on every computer. The phone works the same way, but it needs a sync app that keeps a **real folder on the phone**.

**Syncthing** is free, private (your files never go through anyone else's server) and does exactly this. The steps below use it.

> **Dropbox, OneDrive and Google Drive won't work on their own.** Their Android apps don't keep a normal folder on the phone. To use one of them, add an app that copies a cloud folder to a phone folder and back, such as *FolderSync*. Then follow steps 6 and 7 with that folder.

### Step 1: Install Syncthing on your computer

Download it from <https://syncthing.net>. On Windows, *SyncTrayzor* is an easy way to run it. Start it; it opens in your web browser.

### Step 2: Install Syncthing on the phone

Install **Syncthing-Fork** from F-Droid (<https://f-droid.org>) or from its GitHub page. The original Syncthing Android app is no longer updated, and Syncthing-Fork carries on from it. Open it and allow what it asks for, including access to files.

### Step 3: Connect the two

1. On the phone, open Syncthing and find **This device's ID** (in the menu, **Show device ID**), which also shows a QR code.
2. On the computer, in Syncthing, click **+ Add Remote Device**.
3. Type or paste the phone's ID, give it a name (for example *My phone*) and click **Save**.
4. The phone shows a message asking to add the computer. Accept it.

### Step 4: Make the sync folder on your computer

1. Make a folder called `Pocket-Canvas Sync`, for example in **Documents**.
2. In Syncthing on the computer, click **+ Add Folder**.
   - **Folder Label:** `Pocket-Canvas Sync`
   - **Folder Path:** the folder you just made
3. Open the **Sharing** tab, tick your phone, and click **Save**.

### Step 5: Accept the folder on the phone

1. The phone shows *Computer wants to share folder "Pocket-Canvas Sync"*. Accept it.
2. When it asks where to keep the folder, choose the main storage and call it **`Pocket-Canvas Sync`**. That makes it `/storage/emulated/0/Pocket-Canvas Sync`.
3. Write the location down; you'll type it in step 7.
4. Wait until both sides say **Up to Date**.

### Step 6: Turn on sync in Pocket-Canvas on your computer

1. Open **Settings › Sync** and click **Choose sync folder…**.
2. Pick the `Pocket-Canvas Sync` folder from step 4.
3. The page should say **✓ Sync is on**.

### Step 7: Turn on sync in Pocket-Canvas on the phone

1. Tap **⋮** (top right), then **Sync settings**, then **Choose sync folder…**.
2. Android's folder picker opens. Go to the `Pocket-Canvas Sync` folder from step 5 and tap **Use this folder**, then **Allow**.
3. The sync page should say **✓ Sync is on**.

Android gives Pocket-Canvas access to **that folder only**; the app can't see your other files. If you pick a folder with a different name, Pocket-Canvas makes a `Pocket-Canvas Sync` folder inside it, so choose the same place on your computer.

### Step 8: Try it

Add a note on the computer. A few seconds after Syncthing has copied the change, it appears on the phone, and changes on the phone come back the same way. In **Settings › Sync**, each device lists the others and when they last changed something.

Changes are combined card by card, as between computers, so nothing is overwritten. Pictures, files, audio and video sync too.

## 4. Using the app

Everything works by touch:

| To… | Do this |
|---|---|
| Move around the board | Drag one finger on an empty part of it |
| Zoom | Pinch with two fingers |
| Select a card | Tap it |
| Edit a card | Tap it again |
| Move a card | Drag it |
| Open the right-click menu | Press and hold a card, a line or an empty spot |
| Add a card | Tap a tool on the left; it's added in the middle of the screen |
| Draw a line | Tap **Line**, then tap where it starts and where it ends |
| Open the board list | Tap **☰** (top left) |
| Templates, Recycle bin, backups, settings | Tap **⋮** (top right) |
| Close a window, or step out of a board | Press **Back**; at the top board, Back leaves the app |

**Where things differ from the desktop app:**

- **Export as picture or PDF** (including A4 or Letter pages), **Share board as Markdown** and **Save a backup** open Android's share sheet, so you can save the file to Files or send it in a message.
- **Open** on a file card shares it to the app you choose.
- These are only in the desktop app:
  - automatic backups to another folder
  - the browser extension
  - spelling settings (Android's keyboard checks spelling)

**Without a sync folder:** you can use a **Pocket-Canvas Server** instead (**⋮ › Settings › Server**). It also lets you share boards with other people. See [server/README.md](../server/README.md).

Your boards are saved inside the app's own storage. With sync on, there's also a copy in the sync folder.

## 5. Troubleshooting

**"App not installed".** This usually means the phone already has a Pocket-Canvas signed with a different key. For example, you installed one you built yourself, then a GitHub one. Uninstall the old app first. If it held boards that aren't synced, save a backup from **⋮** first.

**Sync says "The sync folder can't be reached".**
- Check that Syncthing is running on both devices.
- If you moved, renamed or deleted the folder, open **⋮ › Sync settings › Change folder…** and pick it again.
- If you updated from a 1.4 test build, choose the folder once more. The app now uses Android's folder picker instead of "All files access".

**Changes take a while to appear.**
- Syncthing on Android may pause on mobile data or when the battery is low; check its settings.
- Pocket-Canvas checks the folder every 5 seconds while it's open.

**Link previews don't appear.** Check **⋮ › Settings › Link previews** is on, and that the phone is online.

---

## 6. For developers: how the app is built

The Android app is a [Capacitor](https://capacitorjs.com) app. It reuses the desktop app's screens (everything in `src/`) unchanged.

| File | What it does |
|---|---|
| `mobile/api-mobile.js` | Provides the same `window.api` that `preload.js` gives the desktop app, using Capacitor's plugins. That covers files (Filesystem), links (Browser), sharing (Share), the Back button (App) and link previews (CapacitorHttp). It also contains folder sync for phones, with the same folder layout and merge as `lib/sync.js`, and export (drawn inside the page by `exportInPage()` in `src/export-ui.js`). Used for iPhone and iPad too (see [IOS.md](IOS.md)). |
| `src/mobile.js` | Touch gestures (on any touch screen), plus the ⋮ menu and the Back button in the phone and tablet apps |
| `scripts/build-mobile-web.js` | Copies `src/` to `build/mobile-www/` and adds `api-mobile.js` |
| `capacitor.config.json` | App ID `com.pocketdesigns.pocketcanvas`, name, and where the web files are |
| `android/` | The Android Studio project, generated by `npx cap add android` and kept in Git |
| `android/app/src/main/java/…/SyncFolderPlugin.java` | The sync folder: opens Android's folder picker (Storage Access Framework), keeps access to that folder after restarts, and lists, reads, writes and copies files in it |
| `android/app/build.gradle` | Takes the version from `package.json`; signs with the test key, or with your own key when one is supplied |
| `android/app/pocket-canvas-test.keystore` | A **test-only** signing key, so each test build installs over the last. Its password is in `build.gradle`, so it's not secret. Don't use it for Google Play. |
| `tests/mobile-web.test.js` | Runs `build/mobile-www` in a phone-sized, touch-screen Chromium with a pretend phone, and tests saving, the folder picker and sync, export, sharing, touch gestures, Back and the layout (and a pretend iPhone) |

### Commands

```bash
npm run test:mobile     # the screens test (needs Playwright, as for the extension test)
npm run android:sync    # rebuild build/mobile-www and copy it into android/
npm run android:open    # open the project in Android Studio
npm run android:apk     # build the APK (needs the Android SDK and Java 21)
```

**To build on your own computer:**
1. Install **Android Studio** (which brings the Android SDK) and Java 21.
2. Run `npm run android:sync`, then `npm run android:open`.
3. In Android Studio, click **Run** with a phone connected. The phone needs **USB debugging** turned on in Developer options.

GitHub Actions does all of this in the **android** job of `.github/workflows/build.yml`.

### Your own signing key (for releases)

The test key is fine for trying the app out. For releases you share with other people, or for Google Play, make your own key once and keep it safe. If you lose it, you can't update the installed app any more.

1. Make the key:

   ```bash
   keytool -genkeypair -v -keystore pocket-canvas-release.keystore -alias pocket-canvas \
     -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Turn it into text:

   ```bash
   base64 -w0 pocket-canvas-release.keystore     # macOS: base64 -i pocket-canvas-release.keystore
   ```

3. Add these GitHub secrets (**Settings › Secrets and variables › Actions**):

   | Secret | Value |
   |---|---|
   | `ANDROID_KEYSTORE_BASE64` | The text from step 2 |
   | `ANDROID_KEYSTORE_PASSWORD` | The keystore password |
   | `ANDROID_KEY_ALIAS` | `pocket-canvas` |
   | `ANDROID_KEY_PASSWORD` | The key password (often the same as the keystore password) |

The next build is signed with your key. Phones that have a test build installed must uninstall it once before installing a build signed with your key.

**Google Play:** the app uses Android's folder picker and needs no special permissions, so nothing stands in the way of publishing it there. Sign it with your own key, then build an App Bundle with `./gradlew bundleRelease`.
