# Releasing and code signing Pocket-Canvas

Copyright © 2026 Pocket-Designs · pocket-designs@proton.me

This guide walks through two jobs step by step:

- **Part 1:** releasing with GitHub Actions. You can do this today, at no cost.
- **Part 2:** code signing, so Windows and macOS stop warning people when they install. This costs money and takes a few days of identity checks.

Do Part 1 first. Signing is added later and does not change how you release.

> Prices and screen names were correct in October 2026. Apple, Microsoft and the certificate companies change them often, so check before you pay.

## Contents

- [Part 1 — Releasing with GitHub Actions](#part-1--releasing-with-github-actions)
  - [1.1 One-time set-up: put the project on GitHub](#11-one-time-set-up-put-the-project-on-github)
  - [1.2 Make a test build](#12-make-a-test-build)
  - [1.3 Try the test build](#13-try-the-test-build)
  - [1.4 Publish a release](#14-publish-a-release)
  - [1.5 When something goes wrong](#15-when-something-goes-wrong)
- [Part 2 — Code signing](#part-2--code-signing)
  - [2.1 What signing gets you, and what it costs](#21-what-signing-gets-you-and-what-it-costs)
  - [2.2 How the workflow switches signing on](#22-how-the-workflow-switches-signing-on)
  - [2.3 macOS: sign and notarise](#23-macos-sign-and-notarise)
  - [2.4 Windows: choose a route](#24-windows-choose-a-route)
  - [2.5 Windows route A: Azure Artifact Signing](#25-windows-route-a-azure-artifact-signing)
  - [2.6 Windows route B: a certificate from a certificate company](#26-windows-route-b-a-certificate-from-a-certificate-company)
  - [2.7 Looking after secrets and renewals](#27-looking-after-secrets-and-renewals)
- [Part 3 — Publishing the browser extension](#part-3--publishing-the-browser-extension)

---

# Part 1 — Releasing with GitHub Actions

The workflow lives in `.github/workflows/build.yml` and runs in two stages:

1. **test**, on Ubuntu. It runs the sync merge tests, the server tests, the smoke test, the feature tests (including a real Pocket-Canvas Server), the extension test in Chromium and the phone/tablet screens test. Then it packages the browser extension zip.
2. **build**, **android**, **ios** and **safari**, at the same time. This stage runs only if every test passed.
   - **build** runs on Windows, Ubuntu and macOS and makes the `.exe`, `.AppImage`, `.deb` and `.dmg`.
   - **If the Mac jobs say "not acquired by Runner"**, GitHub had no free Mac machines. Use **Re-run failed jobs** later, or start a new run with **Mac machines** set to **macos-15-intel**. GitHub's Intel Macs are often less busy, and they still make both Mac versions and the iPhone/iPad app.
   - **android** makes the Android `.apk` (see [ANDROID.md](ANDROID.md)).
   - **ios** makes the iPhone and iPad app on a Mac (see [IOS.md](IOS.md)).
   - **safari** makes the Safari web clipper app on a Mac (see [SAFARI.md](SAFARI.md)).

The workflow starts in one of two ways. You can press **Run workflow** to make a test build, or you can push a tag such as `v1.5.0` to make a public release.

## 1.1 One-time set-up: put the project on GitHub

You only need to do this once.

1. **Create the repository.**
   1. Sign in at <https://github.com> as the `Pocket-Designs` account.
   2. Click **+** (top right), then **New repository**.
   3. For **Repository name**, type `Pocket-Canvas`.
   4. Choose **Public** or **Private**. Actions work for both. Private repositories get a monthly allowance of free build minutes, and macOS minutes count ten times.
   5. Leave **Add a README**, **.gitignore** and **licence** unticked, because the project already has them.
   6. Click **Create repository**.

2. **Push the code.** Unzip `Pocket-Canvas-1.5.0-source.zip`, open a terminal in the `pocket-canvas` folder and run:

   ```bash
   git init
   git add .
   git commit -m "Pocket-Canvas 1.5.0"
   git branch -M main
   git remote add origin https://github.com/Pocket-Designs/Pocket-Canvas.git
   git push -u origin main
   ```

   If Git asks for a password, use a **personal access token**, not your GitHub password. To make one, go to GitHub → your picture → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**. Give it access to this repository, with **Contents: Read and write** and **Workflows: Read and write**. Another option is GitHub Desktop, which signs you in for you.

3. **Let the workflow create releases.**
   1. In the repository, open **Settings** → **Actions** → **General**.
   2. Under **Actions permissions**, choose **Allow all actions and reusable workflows**.
   3. Under **Workflow permissions**, choose **Read and write permissions**, then click **Save**.

   The workflow already asks for `contents: write`. Some organisation-owned accounts block that unless you change this setting.

4. **Check that the workflow is listed.** Open the **Actions** tab. You should see **Build installers** on the left. If GitHub shows "Workflows aren't being run on this repository", click **I understand my workflows, go ahead and enable them**.

## 1.2 Make a test build

Use a test build whenever you want installers to try out without publishing anything.

1. Open the repository's **Actions** tab.
2. Click **Build installers** in the left-hand list.
3. Click **Run workflow** (on the right), leave **Branch: main** selected, and click the green **Run workflow** button.
4. Refresh the page after a few seconds and click the new run.
5. Watch the jobs:
   - **test** takes about 5 minutes.
   - The three **build** jobs and the **android**, **ios** and **safari** jobs start only once **test** is green, and take 5 to 15 minutes each. The Mac jobs are usually the slowest, and in a private repository Mac minutes count ten times.
6. When the run finishes, scroll to the bottom of the run page and find **Artifacts**:

   | Artifact | Contains |
   |---|---|
   | `pocket-canvas-windows-latest` | `Pocket-Canvas Setup 1.5.0.exe` |
   | `pocket-canvas-macos-26` (or `-macos-15-intel`) | `Pocket-Canvas-1.5.0-mac-arm64.dmg` for Macs with Apple chips (M1 and later), and `Pocket-Canvas-1.5.0-mac-x64.dmg` for older Intel Macs |
   | `pocket-canvas-ubuntu-24.04` | `Pocket-Canvas-1.5.0.AppImage`, `pocket-canvas_1.5.0_amd64.deb` |
   | `pocket-canvas-browser-extension` | `pocket-canvas-web-clipper-1.5.0.zip` |
   | `pocket-canvas-android` | `Pocket-Canvas-1.5.0-android.apk` (see [ANDROID.md](ANDROID.md)) |
   | `pocket-canvas-ios` | `Pocket-Canvas-1.5.0-ios-unsigned.ipa` and `…-ios-simulator.zip` (see [IOS.md](IOS.md)) |
   | `pocket-canvas-safari-extension` | `Pocket-Canvas-Web-Clipper-1.5.0-safari.zip` and the converter's report (see [SAFARI.md](SAFARI.md)) |

7. Click an artifact to download it. GitHub always wraps artifacts in a zip, so unzip it to get the installer. Artifacts are deleted after 90 days.

A test build does **not** create a GitHub Release, and nobody else can see it unless they have access to the repository.

## 1.3 Try the test build

- **Windows:** run the `.exe`. Until it is signed, SmartScreen says "Windows protected your PC". Click **More info**, then **Run anyway**.
- **macOS:** open the `.dmg` and drag Pocket-Canvas to Applications.
  - Until it is signed and notarised, macOS says the app "can't be opened".
  - On macOS 15 or later, open **System Settings** → **Privacy & Security**, scroll down to the Pocket-Canvas message and click **Open Anyway**.
- **Linux:** run `chmod +x Pocket-Canvas-1.5.0.AppImage && ./Pocket-Canvas-1.5.0.AppImage`, or install the `.deb` with `sudo apt install ./pocket-canvas_1.5.0_amd64.deb`.

Check the things this release changed, then check the basics: open a board, add a card, restart the app and make sure the card is still there.

## 1.4 Publish a release

1. **Choose the version number.** Use `MAJOR.MINOR.PATCH`:
   - `1.3.1` for fixes only
   - `1.5.0` for new features
   - `2.0.0` if old data won't open without converting
2. **Bump the version** in `package.json`:

   ```json
   "version": "1.5.0",
   ```

   You don't need to edit `browser-extension/manifest.json`, because the build copies the version across. Both stores reject an upload whose version isn't higher than the last one.
3. **Update the notes:**
   - add a section to `FEATURES.md`
   - update **What's new** in `docs/USER-GUIDE.md`
   - add a row to the version-history table in `docs/DEVELOPER-GUIDE.md`
4. **Run the tests locally:**

   ```bash
   npm install
   npm test
   ```

5. **Commit and push:**

   ```bash
   git add .
   git commit -m "Release 1.5.0"
   git push
   ```

6. **Tag the release and push the tag.** The tag must start with `v` and match `package.json`:

   ```bash
   git tag v1.5.0
   git push origin v1.5.0
   ```

7. **Watch it build.** Open **Actions** to see the run for `v1.5.0`.
8. **Check the release.** When the run is green, open the repository's **Releases** page (right-hand side of the main page, or `/releases`).
   - Release **v1.5.0** should list every installer and the extension zip.
   - Each build job adds its own files as it finishes, so the list fills in over a few minutes.
9. **Write the release notes.** Click the pencil (**Edit**) on the release. Paste the release's lines from `FEATURES.md`, plus a short "Installing" note pointing Windows and Mac users to the warnings in section 1.3 if the build is unsigned. Click **Update release**.

People can now download from `https://github.com/Pocket-Designs/Pocket-Canvas/releases/latest`.

## 1.5 When something goes wrong

**A job failed.** Click the red job, then the red step, and read the last 30 or so lines of the log.

| What you see | What to do |
|---|---|
| A **test** step fails | Run the same test locally (`npm test`, or `npm run test:features`), fix it, commit, then re-tag (below). |
| `npm ci` errors about the lock file | Run `npm install` locally, commit `package-lock.json`, push. |
| `Resource not accessible by integration` or `403` when attaching to the release | Do step 3 of section 1.1 (read and write permissions). |
| A build fails, but the same code worked before | GitHub runners sometimes have hiccups. Open the run and click **Re-run jobs** → **Re-run failed jobs**. |
| macOS: `notarization failed`, or a hang at "notarizing" | See the macOS checks in section 2.3, step 9. |
| Windows: an error mentioning `azureSignOptions` or `Invoke-TrustedSigning` | See section 2.5, step 11. |

**Re-tagging the same version.** Do this when a tagged build failed and you fixed the code.

1. On GitHub, open **Releases**, open the broken release, and click **Delete** (the bin icon). If the release was never created, skip this step.
2. Delete the tag on your computer and on GitHub:

   ```bash
   git tag -d v1.5.0
   git push --delete origin v1.5.0
   ```

3. Commit the fix, push, and tag again:

   ```bash
   git push
   git tag v1.5.0
   git push origin v1.5.0
   ```

If people may already have downloaded the broken version, release `1.4.1` instead of re-tagging.

---

# Part 2 — Code signing

## 2.1 What signing gets you, and what it costs

| | Unsigned (now) | Signed |
|---|---|---|
| **macOS** | Blocked; users must click **Open Anyway** in Privacy & Security | Opens normally once it is also **notarised** (Apple scans it) |
| **Windows** | Red-flagged "Windows protected your PC" screen | Shows your verified name. SmartScreen can still warn for the first weeks of a new certificate, until enough people have installed it. Signing every release with the same identity builds that reputation. |
| **Linux** | No warnings | Not needed |

| Route | Who can use it | Rough cost |
|---|---|---|
| **macOS:** Apple Developer Program | Anyone, as an individual or an organisation | US$99 a year (about £79) |
| **Windows A:** Azure Artifact Signing | **Organisations** in the UK, EU, USA or Canada. In the UK this means a registered company. **Individuals only in the USA and Canada.** | US$9.99 a month |
| **Windows B:** a certificate from a certificate company (SSL.com, Certum, Sectigo, DigiCert, GlobalSign and others) | Anyone, including UK individuals | About £100–£300 a year |
| **Windows C:** SignPath Foundation | Qualifying open-source projects | Free |

**If you're signing as an individual in the UK,** use the Apple Developer Program for macOS and route B for Windows. Azure Artifact Signing becomes an option if Pocket-Designs is registered as a company.

**EV certificates are no longer worth the extra cost.** They used to skip SmartScreen, but Microsoft removed that in 2024, and an ordinary OV certificate now behaves the same.

## 2.2 How the workflow switches signing on

The workflow switches signing on by itself. Add the right **secrets** in GitHub and the next build is signed. With no secrets, it builds unsigned installers, as it does now.

You add secrets under repository **Settings** → **Secrets and variables** → **Actions**:

- **Secrets** tab, **New repository secret**: passwords and keys. GitHub hides these, even from you, once they are saved.
- **Variables** tab, **New repository variable**: settings that aren't secret.

| Name | Type | Used for |
|---|---|---|
| `MAC_CERTIFICATE` | Secret | Your Developer ID certificate (`.p12`) as base64 text |
| `MAC_CERTIFICATE_PASSWORD` | Secret | The password you set when exporting the `.p12` |
| `APPLE_ID` | Secret | Your Apple Account email address |
| `APPLE_APP_SPECIFIC_PASSWORD` | Secret | An app-specific password for notarisation |
| `APPLE_TEAM_ID` | Secret | Your 10-character Apple Team ID |
| `AZURE_TENANT_ID` | Secret | Windows route A |
| `AZURE_CLIENT_ID` | Secret | Windows route A |
| `AZURE_CLIENT_SECRET` | Secret | Windows route A |
| `AZURE_ENDPOINT` | Variable | Windows route A, for example `https://uks.codesigning.azure.net` |
| `AZURE_SIGNING_ACCOUNT` | Variable | Windows route A |
| `AZURE_CERT_PROFILE` | Variable | Windows route A |
| `AZURE_PUBLISHER_NAME` | Variable | Windows route A |
| `WIN_CERTIFICATE`, `WIN_CERTIFICATE_PASSWORD` | Secret | Windows `.pfx` file. Only for test certificates or older certificates (see 2.6). |

When the workflow runs, each build log says what happened:

- "No signing secrets for macOS – building unsigned" means it built unsigned.
- "Signed but NOT notarised" means the certificate is there but the Apple ID secrets are missing.

## 2.3 macOS: sign and notarise

You need a Mac for steps 2 and 3. A friend's Mac is fine; you only need it once every five years.

1. **Join the Apple Developer Program.**
   1. Go to <https://developer.apple.com/programs/enroll/> and sign in with your Apple Account. It must have two-factor authentication turned on.
   2. Choose **Individual / Sole Trader**. Apps will then show your personal name.
   3. If you'd rather apps show "Pocket-Designs", choose **Organisation**. This needs a registered company and a free D-U-N-S number, and takes longer.
   4. Pay the yearly fee. Approval usually takes from a few hours to two days.

2. **Create a "Developer ID Application" certificate.**
   1. On the Mac, install **Xcode** from the App Store and open it.
   2. Open **Xcode** → **Settings…** → **Accounts**, and add your Apple Account with **+**.
   3. Select your team and click **Manage Certificates…**.
   4. Click **+** (bottom left) → **Developer ID Application**.
   5. A certificate called "Developer ID Application: *Your Name* (TEAMID)" is created and saved in your keychain.

   Only the account holder can create this kind of certificate. "Apple Development" and "Apple Distribution" are the wrong kinds; the workflow needs **Developer ID Application**.

3. **Export it as a `.p12` file.**
   1. Open **Keychain Access**. On recent macOS it's under **Applications** → **Utilities**, or search Spotlight.
   2. Choose the **login** keychain and the **My Certificates** tab.
   3. Find **Developer ID Application: …**. It should have a ▸ arrow with a private key inside; without the key it won't work.
   4. Right-click the certificate → **Export…** → format **Personal Information Exchange (.p12)** → save as `DeveloperID.p12`.
   5. Set a strong password and note it down. This becomes `MAC_CERTIFICATE_PASSWORD`.
   6. Keep a copy of the `.p12` and its password somewhere safe, such as a password manager. If you lose it, you have to make a new certificate.

4. **Turn the file into text.** In Terminal, in the folder with the file:

   ```bash
   base64 -i DeveloperID.p12 | pbcopy
   ```

   The text is now on your clipboard, ready for the `MAC_CERTIFICATE` secret.

5. **Make an app-specific password for notarisation.**
   1. Go to <https://account.apple.com> and sign in.
   2. Open **Sign-In and Security** → **App-Specific Passwords** → **+**, and name it `Pocket-Canvas notarisation`.
   3. Copy the password (format `abcd-efgh-ijkl-mnop`). Apple shows it only once.

6. **Find your Team ID.** Go to <https://developer.apple.com/account>, then **Membership details**. Copy the **Team ID**, which is 10 letters and numbers, for example `AB12CD34EF`. It also appears in brackets in the certificate name.

7. **Add the five GitHub secrets.** In the repository, open **Settings** → **Secrets and variables** → **Actions** → **New repository secret**, and add each one:

   | Name | Value |
   |---|---|
   | `MAC_CERTIFICATE` | The base64 text from step 4. Paste it all as one long block. |
   | `MAC_CERTIFICATE_PASSWORD` | The `.p12` password from step 3 |
   | `APPLE_ID` | Your Apple Account email |
   | `APPLE_APP_SPECIFIC_PASSWORD` | The password from step 5 |
   | `APPLE_TEAM_ID` | The Team ID from step 6 |

8. **Run a test build** (section 1.2). In the **macos-26** job, open the **Build installer** step. You should see lines such as `signing file=dist/mac-arm64/Pocket-Canvas.app` and `notarization successful`. Notarisation adds anywhere from 2 to 15 minutes.

9. **Check the result on a Mac.** Install the new `.dmg`. It should open with only the normal "downloaded from the internet" question. Run these in Terminal to confirm:

   ```bash
   codesign --verify --deep --strict --verbose=2 /Applications/Pocket-Canvas.app
   spctl --assess --type execute --verbose /Applications/Pocket-Canvas.app
   #   → accepted   source=Notarized Developer ID
   xcrun stapler validate /Applications/Pocket-Canvas.app
   #   → The validate action worked!
   ```

   If notarisation fails, check these in order:
   - **Wrong password, or HTTP 401:** the `APPLE_APP_SPECIFIC_PASSWORD` is wrong or was revoked. Make a new one.
   - **Team ID mismatch:** `APPLE_TEAM_ID` must match the team in the certificate name.
   - **"You must first sign the relevant contracts":** sign in at developer.apple.com and accept the new agreement. Apple updates it every so often.
   - **"The binary is not signed with a valid Developer ID certificate":** you exported the wrong kind of certificate. Repeat step 2.
   - **No `signing` line in the log:** `MAC_CERTIFICATE` is empty, or wasn't pasted in full.

   `package.json` already sets `"hardenedRuntime": true`, which notarisation needs. electron-builder adds Electron's standard entitlements, so there's nothing else to configure.

**Signing on your own Mac (optional).** Once step 2 is done, the certificate is in your keychain and `npm run dist` signs automatically. To notarise as well, set the Apple variables first:

```bash
export APPLE_ID="you@example.com" APPLE_APP_SPECIFIC_PASSWORD="abcd-efgh-ijkl-mnop" APPLE_TEAM_ID="AB12CD34EF"
npm run dist
```

## 2.4 Windows: choose a route

Since June 2023, every public Windows signing certificate has had to stay on secure hardware: a USB token, or a cloud service the certificate company runs. You can no longer buy a downloadable `.pfx` file and upload it to GitHub. That leaves three practical routes:

- **A — Azure Artifact Signing** (section 2.5). This is the cheapest and easiest, and the workflow already supports it. It needs a UK registered **company**, because Microsoft doesn't accept UK individuals.
- **B — a certificate company with cloud signing** (section 2.6). This works for a UK individual, but each company has its own signing tool, so the workflow needs a small addition for whichever one you choose.
- **C — SignPath Foundation.** This is free for open-source projects, and they do the signing in their own pipeline. Apply at <https://signpath.org>. Pocket-Canvas's code is MIT-licensed, but the app icon is "all rights reserved", so mention that when you apply and ask whether it's acceptable. SignPath has its own GitHub Action, and the build workflow would hand the unsigned `.exe` to it.

**The Microsoft Store** is another option. It signs Store apps for you, so Store users never see SmartScreen, but it is a separate packaging and submission process. It's not covered here.

## 2.5 Windows route A: Azure Artifact Signing

Azure Artifact Signing used to be called **Trusted Signing**, and some Azure screens still use the old name. Wherever this guide says "Artifact Signing", look for "Trusted Signing" if you can't find it.

1. **Create an Azure account.** Sign up at <https://azure.microsoft.com> with a pay-as-you-go subscription. A card is needed.
2. **Switch on the signing service.**
   1. In the Azure portal, search for **Subscriptions** and pick yours.
   2. Open **Settings** → **Resource providers**.
   3. Search for `Microsoft.CodeSigning`, select it, and click **Register**.
3. **Create the signing account.**
   1. Search the portal for **Artifact Signing accounts** and click **+ Create**.
   2. **Resource group:** create a new one called `pocket-canvas-signing`.
   3. **Account name:** for example `pocketdesigns`. This becomes `AZURE_SIGNING_ACCOUNT`.
   4. **Region:** UK South.
   5. **Pricing tier:** Basic.
   6. Click **Review + create** → **Create**.
   7. When it's ready, open the account and copy the **Account URI** from **Overview**, for example `https://uks.codesigning.azure.net/`. This becomes `AZURE_ENDPOINT`.
4. **Give yourself permission to verify identity.**
   1. In the signing account, open **Access control (IAM)** → **Add** → **Add role assignment**.
   2. Choose **Artifact Signing Identity Verifier** (or **Trusted Signing Identity Verifier**).
   3. Assign it to your own user and save.
5. **Verify the company.**
   1. In the signing account, open **Identity validations** → **+ New identity** → **Public**.
   2. Fill in the company's legal name and address **exactly** as they appear at Companies House.
   3. Upload any documents Microsoft asks for. Checks usually take a few working days, and Microsoft may email you for more proof.
   4. Wait until the status is **Completed**.
6. **Create a certificate profile.**
   1. Open **Certificate profiles** → **+ Create** → **Public Trust**.
   2. Name it, for example `pocket-canvas`. This becomes `AZURE_CERT_PROFILE`.
   3. Choose the completed identity validation and click **Create**.
   4. The profile shows the **Subject Name** (CN), which is your company's legal name. Copy it exactly; this becomes `AZURE_PUBLISHER_NAME`.
7. **Create a "robot" login for GitHub.**
   1. Search the portal for **Microsoft Entra ID** → **App registrations** → **+ New registration**.
   2. Name it `pocket-canvas-github`, leave the other settings as they are, and click **Register**.
   3. On its **Overview**, copy the **Application (client) ID** (this becomes `AZURE_CLIENT_ID`) and the **Directory (tenant) ID** (this becomes `AZURE_TENANT_ID`).
   4. Open **Certificates & secrets** → **+ New client secret**, and choose an expiry (for example 24 months).
   5. Copy the **Value** column straight away. This becomes `AZURE_CLIENT_SECRET`; Azure never shows it again.
8. **Let the robot sign.**
   1. Go back to the signing account → **Access control (IAM)** → **Add role assignment**.
   2. Choose **Artifact Signing Certificate Profile Signer** (or **Trusted Signing Certificate Profile Signer**).
   3. Under **Members**, pick `pocket-canvas-github` and save.
9. **Add the GitHub settings.** Open **Settings** → **Secrets and variables** → **Actions**.
   - On the **Secrets** tab, add `AZURE_TENANT_ID`, `AZURE_CLIENT_ID` and `AZURE_CLIENT_SECRET`.
   - On the **Variables** tab, add:

   | Variable | Example |
   |---|---|
   | `AZURE_ENDPOINT` | `https://uks.codesigning.azure.net/` |
   | `AZURE_SIGNING_ACCOUNT` | `pocketdesigns` |
   | `AZURE_CERT_PROFILE` | `pocket-canvas` |
   | `AZURE_PUBLISHER_NAME` | `Project Tech Me Ltd`, exactly as the certificate's Subject Name |

10. **Run a test build** (section 1.2). In the **windows-latest** job's **Build installer** step, look for lines about signing with Azure. Then check the downloaded installer:
    - Right-click `Pocket-Canvas Setup 1.5.0.exe` → **Properties** → **Digital Signatures**. Your company name should be listed.
    - Or, in PowerShell:

      ```powershell
      Get-AuthenticodeSignature ".\Pocket-Canvas Setup 1.5.0.exe" | Format-List
      #   Status : Valid
      ```

11. **If signing fails:**
    - **`AADSTS7000215` or "invalid client secret":** you copied the secret's *ID* instead of its *Value*, or it has expired. Make a new secret.
    - **403 or "Forbidden":** step 8's role is missing, or was given to the wrong account.
    - **"Publisher name mismatch", or an install that shows a different name:** `AZURE_PUBLISHER_NAME` must match the certificate's Subject Name exactly, including "Ltd".
    - **An endpoint error:** the region in `AZURE_ENDPOINT` must be the account's own region.

**About the certificates.** Artifact Signing issues short-lived certificates (about 3 days) and timestamps every signature, so signed installers stay valid after the certificate expires. You don't need to renew anything except the client secret (step 7) and the yearly identity check if Microsoft asks for one.

## 2.6 Windows route B: a certificate from a certificate company

Use this route if you're signing as an individual, or if your company doesn't qualify for Azure.

1. **Pick a company that offers cloud signing,** so that GitHub can sign without a USB stick plugged in. Common choices:
   - **SSL.com** (eSigner, with an official GitHub Action)
   - **Certum** (popular with open-source developers, and cheaper)
   - **DigiCert** (KeyLocker)
   - **Sectigo**
   - **GlobalSign**

   Buy an **OV (organisation validation) code signing** certificate with the cloud signing option. As an individual you'll be validated in your own name, and some companies call this "Individual Validation". Don't pay extra for EV (see 2.1).
2. **Pass their identity check.** You'll usually need photo ID, proof of address, and sometimes a short video call. Expect between 1 and 10 working days.
3. **Set up their cloud signing.** Each company gives you a username, a password and a one-time-code secret (TOTP), or an API key, plus its own signing tool. Note all of them.
4. **Tell me which company you chose.** Their tools differ, so the workflow needs a short custom signing step for that company: electron-builder's `win.signtoolOptions.sign` hook, or the company's own GitHub Action. I'll write it for you. The secrets will follow the same pattern as in 2.2, under names like `ESIGNER_USERNAME` and `ESIGNER_TOTP_SECRET`.
5. **Test it as in section 2.5, step 10.**

**The `.pfx` option in the workflow** (`WIN_CERTIFICATE` and `WIN_CERTIFICATE_PASSWORD`) is for a self-signed test certificate or an older exportable certificate. Public certificate companies no longer issue exportable ones. To turn a `.pfx` into text on Windows:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("cert.pfx")) | Set-Clipboard
```

## 2.7 Looking after secrets and renewals

**Keeping secrets safe:**
- Never commit a certificate, `.p12`, `.pfx` or password to the repository. GitHub secrets are the only place they should live, apart from your password manager.
- GitHub doesn't pass secrets to workflows triggered by pull requests from forks, so strangers can't use your certificate to sign their code.
- If a secret leaks:
  - Revoke the Apple app-specific password at account.apple.com.
  - Delete the Azure client secret.
  - Ask the certificate company to revoke the certificate.
  - Then replace the GitHub secret.

**Calendar reminders worth setting:**

| What | How often |
|---|---|
| Apple Developer Program fee | Every year. If it lapses, notarisation stops, but apps you already shipped keep working. |
| Developer ID certificate | Every 5 years |
| Azure client secret | Whenever the expiry you chose comes up |
| Route B certificate | Every 1 to 3 years, depending on what you bought |

---

# Part 3 — Publishing the browser extension

Every release attaches `pocket-canvas-web-clipper-<version>.zip`. You upload the same zip to every store:

1. Download the zip from the GitHub Release. Don't unzip it.
2. Upload it at each store's developer dashboard:
   - **Chrome Web Store:** one-off US$5 registration
   - **Microsoft Edge Add-ons:** free
   - **Opera add-ons:** free
   - **Firefox Add-ons (AMO):** free
3. First submission only: fill in the listing. Copy the permission justifications and privacy answers from `browser-extension/README.md`.
4. Later releases: open the existing item, choose **Upload new package**, and submit. The version must be higher than the last one, which it will be if you bumped `package.json`.
5. Review takes from a few hours to a few days. Firefox may ask for the source code: upload `Pocket-Canvas-<version>-source.zip`.

The browser extension doesn't need code signing. Each store signs it for you.
