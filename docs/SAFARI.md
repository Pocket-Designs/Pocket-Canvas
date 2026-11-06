# The web clipper in Safari (Mac)

Copyright © 2026 Pocket-Designs · pocket-designs@proton.me

Safari runs the same browser extension as Chrome, Edge and Firefox. Apple's converter wraps it in a small Mac app, **Pocket-Canvas Web Clipper**, which carries the extension. GitHub makes that app in the **safari** job of the workflow.

## What "tested" covers

- **The extension itself** is tested in Chromium on every build: connecting, the popup, saving pages, pictures, text and screenshots (`tests/extension.test.js`).
- **For Safari:**
  - Apple's converter checks every manifest key and permission. Its report, `safari-converter-report.txt`, is in the download. The build warns if anything is unsupported.
  - The Mac app is then built with Xcode.
- **Using it in Safari is a manual check**, because GitHub's machines can't drive Safari extensions. Use the checklist at the end.

## If the safari job fails

The **pocket-canvas-safari-extension** download is saved even when the build fails. It contains:
- `safari-converter-report.txt`: what Apple's converter said about the extension
- `safari-build-log.txt`: the full Xcode build log

The error lines also appear in the run's **Annotations**. The other jobs (Windows, Mac, Linux, Android, iPhone/iPad) aren't affected, and their files still attach to a release.

## Installing it on your Mac (for testing)

1. On the workflow run page, download **pocket-canvas-safari-extension** and unzip it.
2. Unzip `Pocket-Canvas-Web-Clipper-…-safari.zip` and move **Pocket-Canvas Web Clipper.app** to **Applications**.
3. **Open it once.** Because it isn't signed, macOS blocks it the first time:
   - **macOS 15 and later:** open **System Settings › Privacy & Security**, scroll down, click **Open Anyway** and confirm.
   - **Older macOS:** right-click the app, choose **Open**, then click **Open**.
4. In Safari, open **Settings › Advanced** and tick **Show features for web developers**.
5. In the menu bar, choose **Develop › Allow Unsigned Extensions** and type your Mac password. Safari turns this off each time it quits, so repeat it after restarting Safari.
6. Open **Safari › Settings › Extensions** and tick **Pocket-Canvas Web Clipper**.
7. Click the extension's toolbar button and choose **Always Allow on Every Website**, or at least allow `127.0.0.1`, so it can reach the Pocket-Canvas app.
8. With Pocket-Canvas open, click **Connect** in the popup and click **Allow** in Pocket-Canvas, just as in Chrome.

## Giving it to other people

Unsigned extensions only work with **Allow Unsigned Extensions** turned on. To give the extension to others, you need the **Apple Developer Program** (US$99 a year):

- **Mac App Store** (easiest for users):
  1. Open the project made by the converter in Xcode.
  2. Choose your team under **Signing & Capabilities**.
  3. Choose **Product › Archive**, then **Distribute App › App Store Connect**, and submit it for review.
- **Directly** (download from your site): sign the app with your **Developer ID Application** certificate and notarise it (the steps match the macOS part of [RELEASING.md](RELEASING.md)), then share the `.app` in a zip or `.dmg`.

## Manual check in Safari

- [ ] The toolbar button opens the popup and says it's connected
- [ ] **Save page** adds a link card with a preview
- [ ] Select text, right-click › **Save selected text to Pocket-Canvas**: a note appears, with a link back to the page
- [ ] Right-click a picture › **Save picture to Pocket-Canvas**
- [ ] **Screenshot** saves the visible page
- [ ] Disconnect in Pocket-Canvas › Settings › Browser extension: the popup asks to connect again
