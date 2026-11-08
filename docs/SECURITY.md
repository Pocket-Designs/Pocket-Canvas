# Pocket-Connect security

This page explains how Pocket-Connect protects a remote session, what your server can and cannot see, and the known limits.

## Summary

| Area | How it is protected |
|---|---|
| Screen, mouse/keyboard, console, clipboard, Android | **End-to-end encrypted** with WebRTC (DTLS 1.2+/SRTP, ECDHE). Only the two apps hold the keys. |
| Passwords | **Never sent** over the network, not even encrypted. The viewer proves it knows the password with a challenge–response. |
| Man-in-the-middle | The password proof is **bound to both ends' DTLS certificate fingerprints**, so anyone relaying or rewriting the set-up messages (a compromised server, someone on the LAN) makes the proof fail. The host also proves the password back, so the viewer knows it reached the real machine. |
| Guessing | 3 wrong passwords lock the host out with a growing delay (up to 5 min). The server also rate-limits sign-in and connection attempts. |
| Passwords at rest (host) | Stored only as `scrypt(password, random salt)`, encrypted with the OS keystore (Windows DPAPI, or GNOME Keyring / KWallet on Linux via Electron `safeStorage`). |
| "Remember password" (viewer) | Stores the derived key, not the password, in the OS keystore. It is not synced to the server, and stops working when the host changes its password. |
| Accounts | scrypt-hashed passwords, optional **TOTP two-factor**, signed tokens that can be revoked everywhere, and an audit log of sign-ins and connection requests. |
| Transport to the server | HTTPS/WSS (Let's Encrypt, or your own certificate with fingerprint pinning in the app). |
| Relay | coturn with short-lived HMAC credentials. It carries only encrypted packets and refuses to relay into private networks. |
| The local computer | A permanent on-screen bar shows who is connected, with an **End** button. Optional "ask first" prompt, view-only mode, and per-feature switches (desktop / console / Android / clipboard). |
| App hardening | Electron with context isolation, sandboxed renderers, a strict Content-Security-Policy, no remote content, and IPC calls checked per window. |

## The connection step by step

1. The viewer asks to connect, either through the server (by ID) or straight to the host's LAN listener (by IP).
2. The host's app answers. The two apps exchange WebRTC offers/answers and set up an encrypted DTLS link, directly or through the TURN relay.
3. Over that encrypted link the host sends a random **nonce** and its password **salt**.
4. The viewer computes `key = scrypt(password, salt)` and sends
   `proof = HMAC-SHA256(key, "viewer" | nonce | viewer-nonce | viewer-DTLS-fingerprint | host-DTLS-fingerprint)`.
5. The host checks the proof against its one-time key and its permanent key, using its *own* view of both fingerprints. A relay that substituted certificates sees different fingerprints, so the proof doesn't match.
6. The host replies with its own `HMAC(key, "host" | …)`, which the viewer checks.
7. If configured, the person at the host clicks **Allow**.
8. Only then are screen capture, input, console and Android enabled, and only those the host allows and the viewer asked for.

## What your server can see

- Account emails, names and password hashes; device IDs, names, OS and hostnames; the saved device list (names, addresses, folders, notes, but **no passwords**).
- That a connection was requested between two devices, when, and from which IP address (shown in the audit log).
- The WebRTC set-up messages (network candidates and certificate fingerprints).

It **cannot** see the screen, input, console output, clipboard, Android screen, or any password.

### The one thing that trusts the server

**"My account connects without a password"** (on by default) relies on the server saying "this viewer is signed in to the same account as this device". Someone who fully controls your server could therefore connect to your own devices without the device password. If that matters to you, turn it off in *Settings › Passwords*. Every connection then needs the device password, and the server is trusted for nothing except finding devices.

## Recommendations

- Use a **permanent password** of 12+ characters (or 3–4 random words), unique to Pocket-Connect.
- Turn on **two-factor** on your account.
- Keep **"Ask before someone connects"** on for anything other than your own account.
- Keep **"Private addresses only"** on for LAN connections (the default).
- Don't expose port 47100 to the internet. For remote access use the server (with relay) or a VPN.
- On Linux, have a keyring (GNOME Keyring or KWallet) so saved secrets are encrypted at rest. The app warns if there isn't one.

## Known limits

- The Windows app runs as the signed-in user, not as a system service: no control of the sign-in screen or UAC prompts.
- Console sessions run as the user running Pocket-Connect, with that user's rights.
- Android control uses ADB, which is powerful by design. Only authorise computers you trust on your phone, and turn off USB debugging when you no longer need it.
- This is version 0.1 and has not had an independent security audit.

Report security problems privately to **pocket-designs@proton.me**.
