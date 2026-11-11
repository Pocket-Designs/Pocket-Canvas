# Pocket-Canvas Server

Copyright © 2026 Pocket-Designs · pocket-designs@proton.me · MIT licence

Run your own server to:

- **keep your boards the same on all your devices** without a sync folder (computers, Android, iPhone and iPad), and
- **share boards with other people** and edit them together. Everyone sees each other's changes in about a second, plus who else is on the board and which card they're working on.
- **use Pocket-Canvas in any web browser**, with nothing installed: open the server's address, sign in, and your boards are there (see [section 7](#7-using-pocket-canvas-in-a-web-browser)).

Nothing goes through anyone else's computers. The server is one small Node.js program with one dependency, and everything is kept in a single folder.

## Contents

1. [How it works](#1-how-it-works)
2. [What you need](#2-what-you-need)
3. [Option A: Docker with automatic HTTPS (recommended)](#3-option-a-docker-with-automatic-https-recommended)
4. [Option B: Proxmox container without Docker](#4-option-b-a-proxmox-container-without-docker)
5. [Option C: home network only](#5-option-c-home-network-only)
6. [Signing in from Pocket-Canvas](#6-signing-in-from-pocket-canvas)
7. [Using Pocket-Canvas in a web browser](#7-using-pocket-canvas-in-a-web-browser)
8. [Sharing a board](#8-sharing-a-board)
9. [Looking after the server](#9-looking-after-the-server)
10. [Settings](#10-settings)
11. [Security notes](#11-security-notes)

---

## 1. How it works

- **Accounts.** Anyone who knows the server's **join code** can create an account (a name and a password). After that, they sign in with their own password. Each device gets its own sign-in key, which can be signed out.
- **Your boards.** Each of your devices sends its copy of your boards to the server, which passes it to your other devices. It also keeps the latest copy from each device, so a device that was off catches up when it connects. Devices combine copies card by card, the same way folder sync does: different changes are all kept, and for the same card the latest change wins.
- **Shared boards.** When you share a board, that board and the boards inside it are sent to the people you choose, and their changes come back. Your other boards are never sent to them.
- **Pictures and files** are uploaded once, under their random id.
- **The browser version** is the same app, served by the server itself. A web browser counts as one more of your devices: it starts from the copies your other devices left on the server, then stays in step live.
- **Password-protected boards** stay encrypted on the server (as in folder sync). They can't be shared.

## 2. What you need

- A machine that stays on: for example a Proxmox VM or container, a Raspberry Pi, a NAS that runs Docker, or a small cloud server.
- **To use it away from home, or share with people outside your home:**
  - a domain name, which can be a free one from a service such as DuckDNS
  - ports **80** and **443** forwarded from your router to the machine
- **For home use only:** nothing else. See [option C](#5-option-c-home-network-only).

---

## 3. Option A: Docker with automatic HTTPS (recommended)

The `docker-compose.yml` in this folder runs the server behind **Caddy**, which gets and renews an HTTPS certificate for you.

1. **Make a machine with Docker.** On Proxmox, a small Debian or Ubuntu VM is enough (1 CPU, 1 GB of memory, 10 GB of disk). Then install Docker:

   ```bash
   curl -fsSL https://get.docker.com | sh
   ```

2. **Copy the whole Pocket-Canvas folder** onto it (not just `server`, because the Docker build also makes the browser version from the app's screens), for example to `/opt/pocket-canvas`. The easiest way is:

   ```bash
   apt install -y git
   git clone https://github.com/Pocket-Designs/Pocket-Canvas.git /opt/pocket-canvas
   ```

   Or unzip the source code from a release there.
3. **Point your domain name at your home's internet address.** Forward ports 80 and 443 on your router to this machine.
4. **Edit two files** in the `server` folder:
   - `Caddyfile`: replace `boards.example.com` with your domain name.
   - `docker-compose.yml`: replace `change-me-to-something-secret` with your **join code**. Choose something hard to guess; anyone with it can make an account.
5. **Start it:**

   ```bash
   cd /opt/pocket-canvas/server
   docker compose up -d --build
   docker compose logs -f pocket-canvas      # Ctrl+C to stop watching
   ```

6. **Check it.** Open `https://your-domain/health` in a web browser. It should show `{"app":"Pocket-Canvas Server",…,"web":true}`. Then open `https://your-domain` itself: you should see the Pocket-Canvas sign-in screen.

Everything is kept in `./data` next to the compose file; that's the folder to back up.

## 4. Option B: a Proxmox container without Docker

1. In Proxmox, create a **Debian 12** container (LXC) with 1 CPU, 512 MB of memory and 8 GB of disk.
2. Inside it:

   ```bash
   apt update && apt install -y nodejs npm unzip
   ```

   Download **`Pocket-Canvas-Server-<version>.zip`** from the project's GitHub release (it includes the browser version) and copy it into the container, for example with WinSCP. Then:

   ```bash
   unzip Pocket-Canvas-Server-*.zip -d /opt
   mv /opt/Pocket-Canvas-Server /opt/pocket-canvas-server
   cd /opt/pocket-canvas-server
   npm install --omit=dev
   ```

   Debian 12's Node.js is version 18, which works. For a newer version, use NodeSource.
3. **Run it as a service.** Create `/etc/systemd/system/pocket-canvas.service`:

   ```ini
   [Unit]
   Description=Pocket-Canvas Server
   After=network.target

   [Service]
   WorkingDirectory=/opt/pocket-canvas-server
   Environment=JOIN_CODE=change-me-to-something-secret
   Environment=DATA_DIR=/var/lib/pocket-canvas
   Environment=PORT=8787
   ExecStart=/usr/bin/node pocket-canvas-server.js
   Restart=always
   DynamicUser=yes
   StateDirectory=pocket-canvas

   [Install]
   WantedBy=multi-user.target
   ```

4. Start it:

   ```bash
   systemctl daemon-reload
   systemctl enable --now pocket-canvas
   journalctl -u pocket-canvas -f
   ```

5. **For use from outside your home**, put HTTPS in front of it, for example with Caddy in the same container:

   ```bash
   apt install -y caddy
   echo 'boards.example.com {
     reverse_proxy 127.0.0.1:8787
   }' > /etc/caddy/Caddyfile
   systemctl reload caddy
   ```

   Then forward ports 80 and 443 to the container.

## 5. Option C: home network only

If everyone using it is on your home network, you can skip the domain name and HTTPS. Run the server (option A without Caddy, or option B) and use the address `http://<the machine's IP address>:8787` in Pocket-Canvas, or open it in a web browser for the browser version.

Over plain `http://`, your boards travel across your home network unencrypted. Only do this on a network you trust, and never forward port 8787 from your router.

The apps allow plain `http://` addresses for this:
- **Android and the desktop app** accept them.
- **iPhone and iPad** accept them only for local network addresses.

---

## 6. Signing in from Pocket-Canvas

On each device, open **Settings › Server** (on Android, iPhone and iPad: **⋮ › Settings › Server**).

1. Type the **server address**, for example `https://boards.example.com`.
2. **The first time**, type a name, a password (8 characters or more) and the **join code**, then click **Create account**.
3. **On your other devices**, type the same name and password and click **Sign in**. You don't need the join code again.
4. The top bar shows **● Live** while connected.

**Keep all my boards in step through this server** is on by default. You can use it instead of a sync folder or alongside one.

## 7. Using Pocket-Canvas in a web browser

Open the server's address (for example `https://boards.example.com`) in Chrome, Edge, Firefox or Safari, on a computer, phone or tablet.

1. **Sign in** with your name and password. To make a new account, click **New here? Create an account** and enter the join code.
2. Your boards appear, copied from your other devices. Changes go both ways live, and the top bar shows **● Live**.
3. Everything works as in the desktop app: cards, tables, sketches, pictures, sharing, comments, templates, page guides and exporting.
4. **Exports and backups** download to the computer. The **desktop keyboard shortcuts** work too (Ctrl+Z, Ctrl+D, Ctrl+1 and so on).
5. **⋮ › Sign out** when you finish on someone else's computer. That also removes the copy of your boards kept in that browser.

What's different from the apps:
- It needs to reach the server. If the connection drops, keep working; your changes are sent when it's back, but don't close the tab in the meantime.
- There are no sync folders, folder backups or browser-extension settings: the server does the syncing.
- Pictures and files you add are uploaded to the server straight away.

## 8. Sharing a board

1. Right-click a board (on its card, or in the sidebar) and choose **Share with people…**. On a touch screen, press and hold instead of right-clicking.
2. Tick the people to share with. They need an account on the same server first.
3. Click **Share**.

They see the board appear on their Home board straight away, with a blue sharing badge. From then on:

- **Changes appear for everyone within about a second.** The coloured initials in the top bar show who else is on the board, and the card they're on is outlined with their name (✎ while they type).
- **If two people change the same card at the same moment**, the later change wins. Different cards never clash.
- **The board's owner** can add or remove people, or **Stop sharing**. Anyone else can **Leave**. Either way, everyone keeps their own copy as it was.
- **Boards with a password can't be shared**, and shared boards can't be given a password.

## 9. Looking after the server

- **Back up** the data folder: `./data` for Docker, `/var/lib/pocket-canvas` for the service in option B. It holds everything: accounts, the latest copy from each device, and pictures and files.
- **Update** to a new version:
  - Docker: copy in the new `pocket-canvas-server.js`, then run `docker compose up -d --build`.
  - Option B: copy it in, then run `systemctl restart pocket-canvas`.
- **Stop new sign-ups** by removing `JOIN_CODE` and restarting. Existing accounts keep working.
- **Remove someone:**
  1. Stop the server.
  2. Delete their entry from `data/users.json`, and their keys from `data/tokens.json` (the entries whose `user` is their id).
  3. Start the server again.
- **Lost password:** there's no reset email. Delete the account as above and make a new one. The person's boards are still on their devices.

## 10. Settings

| Setting (environment variable) | Default | Meaning |
|---|---|---|
| `JOIN_CODE` | (none: no sign-ups) | Code needed to create an account |
| `PORT` | `8787` | Port to listen on |
| `HOST` | `0.0.0.0` | Address to listen on (`127.0.0.1` when Caddy is on the same machine) |
| `DATA_DIR` | `./data` | Where everything is kept |
| `MAX_ASSET_MB` | `500` | Largest picture, video or file accepted |
| `LINK_PREVIEWS` | `on` | `off` stops the server fetching web pages for link previews in the browser version |
| `WEB_DIR` | (built in) | A different folder holding the browser version (made by `node scripts/build-web.js <folder>`) |

## 11. Security notes

- **Passwords** are stored as scrypt hashes, and sign-in keys as SHA-256 hashes. Neither can be read back from the files.
- **Sign-in attempts** are limited to 10 a minute from each address.
- **Use HTTPS for anything outside your home**, or boards and passwords travel unencrypted.
- **On disk, the server's copies aren't encrypted** (except password-protected boards), so protect the machine and its backups.
- **Pictures and files** can be fetched by any signed-in person who knows their id. Ids are random 64-bit numbers that only appear inside boards shared with them.
- **The browser version** signs in with a cookie that only lets it *read* (show pictures and play videos). It can't be sent from other websites (`SameSite=Strict`) or read by scripts (`HttpOnly`), and over HTTPS it's only sent encrypted. Everything that changes something needs the sign-in key, as for the apps.
- **Uploaded files** are shown with a strict "sandbox" rule, so a file can never run scripts on your server's address.
- **Link previews** in the browser version are fetched by the server, but only from public internet addresses, never from the server itself or your home network. Set `LINK_PREVIEWS=off` to stop them altogether.
