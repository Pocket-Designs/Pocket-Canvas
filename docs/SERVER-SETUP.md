# Running your own Pocket-Connect server

The server gives every computer a **Pocket ID**, lets devices find each other over the internet, stores **accounts** and the synced **device list**, and runs a **TURN relay** for networks where a direct connection is impossible.

It never sees anyone's screen, keystrokes, console or passwords: those travel end-to-end encrypted between the two apps (see [SECURITY.md](SECURITY.md)).

You do **not** need a server to use Pocket-Connect on one local network.

---

## What you need

- A small Linux VM or LXC container: 1 vCPU, 512 MB–1 GB RAM and 5 GB disk is plenty. Debian 12 or Ubuntu 24.04 with **Docker** and the **Docker Compose plugin**.
- Either:
  - **(A) Internet access:** a domain name (e.g. `connect.example.com`) pointing at your public IP, with ports forwarded from your router, **or**
  - **(B) LAN / VPN only:** a name your local DNS resolves (e.g. `connect.home.lan`) or just the VM's IP.

### Proxmox notes

- Create the VM on your **DMZ / services VLAN**, separate from your home devices, if you have one. Pocket-Connect only needs the ports below to be reachable.
- An unprivileged LXC works too, but enable *nesting* and *keyctl* for Docker. A VM is simpler.
- Give it a static IP (DHCP reservation or a static address in the VM).

---

## 1. Install Docker (on the VM)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out and back in
```

## 2. Get the files

```bash
git clone https://github.com/Pocket-Designs/Pocket-Connect.git
cd Pocket-Connect/deploy
cp .env.example .env
nano .env
```

Fill in `.env`:

| Setting | Value |
|---|---|
| `PC_DOMAIN` | The name the apps will use, e.g. `connect.example.com` |
| `PC_PUBLIC_IP` | Your public IPv4 (for option A), or the VM's IP (for option B) |
| `PC_TURN_SECRET` | A long random string: `openssl rand -base64 48` |
| `PC_REGISTRATION` | `first-only` (recommended): only the first account can be created, and it becomes admin. `open` lets anyone who can reach the server sign up. `closed` allows no sign-ups. |
| `PC_TLS` | Leave empty for option A. For option B see step 3B. |

## 3A. Internet access (public domain)

1. Create a DNS **A record** `connect.example.com` → your public IP.
2. On your router, **forward** to the VM:
   - **TCP 80** and **TCP 443** (HTTPS, and the Let's Encrypt certificate check)
   - **UDP + TCP 3478** (TURN relay)
   - **UDP 49160–49200** (relay traffic)
3. Leave `PC_TLS=` empty. Caddy gets a free Let's Encrypt certificate automatically.

## 3B. LAN or VPN only (no public DNS)

```bash
./make-cert.sh connect.home.lan 192.168.20.10     # name, and optionally the VM's IP
```

It prints a **SHA-256 fingerprint**. Keep it handy. Then in `.env`:

```
PC_TLS=/certs/cert.pem /certs/key.pem
```

In each Pocket-Connect app: *Account › Server address* → **Check** → confirm the fingerprint matches → **Pin this certificate** → **Save**.

> Using a VPN such as WireGuard or Tailscale into your home network gives you "reach it from anywhere" without opening any ports. Option B works over the VPN as-is.

## 4. Start it

```bash
docker compose up -d
docker compose logs -f server      # Ctrl+C to stop watching
```

Check from any browser: `https://connect.example.com/api/health` should show `{"ok":true,"name":"Pocket-Connect",…}`.

## 5. First account

In the Pocket-Connect app: **Account** → enter the server → **Save** → **Create an account**. With `PC_REGISTRATION=first-only` that account is the administrator and no one else can register. Turn on **two-factor** straight away.

Sign in with the same account on each of your computers.

---

## Maintenance

| Task | Command (in `deploy/`) |
|---|---|
| Update | `git pull && docker compose build && docker compose up -d` |
| Back up | `docker run --rm -v deploy_pc-data:/d -v $PWD:/b alpine tar czf /b/pc-backup.tgz -C /d .` (contains accounts, device list and the token key, so keep it safe) |
| Logs | `docker compose logs --tail=200 server` |
| Restart | `docker compose restart` |

Everything the server keeps is in the `pc-data` volume: `pocket-connect.db` (SQLite) and `token.key`. Deleting `token.key` signs everyone out.

### Firewall on the VM

If you use `ufw` on the VM:

```bash
sudo ufw allow 80,443/tcp
sudo ufw allow 3478
sudo ufw allow 49160:49200/udp
```

### Hardening checklist

- [ ] `PC_REGISTRATION=first-only` (or `closed` once everyone has an account)
- [ ] Two-factor turned on for every account
- [ ] VM on a separate VLAN from your home devices
- [ ] Automatic security updates on the VM (`unattended-upgrades`)
- [ ] Backups of the `pc-data` volume
- [ ] The TURN relay is already set to refuse relaying into private address ranges (10.x, 172.16–31.x, 192.168.x, 100.64.x, 127.x), so it cannot be used to reach into your LAN.

---

## Server settings reference

Environment variables for the `server` container (normally set by `docker-compose.yml`):

| Variable | Default | Meaning |
|---|---|---|
| `PC_PORT` | `8443` | Port the server listens on (behind Caddy) |
| `PC_DATA_DIR` | `/data` | Where the database and key are kept |
| `PC_REGISTRATION` | `first-only` | `open`, `first-only` or `closed` |
| `PC_TOKEN_TTL_HOURS` | `336` | How long a sign-in lasts (14 days) |
| `PC_STUN_URLS` / `PC_TURN_URLS` | from `PC_DOMAIN` | ICE servers handed to the apps |
| `PC_TURN_SECRET` | — | Shared secret with coturn (time-limited relay credentials) |
| `PC_TRUST_PROXY` | `1` | Use `X-Forwarded-For` from Caddy for rate limiting and logs |
| `PC_TOKEN_SECRET` | generated | Optional fixed signing key instead of `token.key` |
