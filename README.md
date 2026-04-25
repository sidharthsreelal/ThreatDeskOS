# ThreatDesk OS v2.4.1

**ThreatDesk OS** is a browser-based security analyst workstation. It wraps a bunch of useful security tools into a single, immersive environment that feels like an actual OS running in your tab.

Everything runs locally. Nothing leaves your browser unless you explicitly send it out.

---

### Features

- **Dual Interface**: Flip between a full **Terminal (TUI)** with pane multiplexing and a **Desktop (GUI)** with proper window management.
- **Encrypted by Default**: Master credentials are protected with PBKDF2 (310k iterations) and AES-256-GCM. Your keys stay in local storage.
- **Client-Side Only**: No backend, no tracking, no telemetry.
- **Eight Built-In Tools**: All functional, all included out of the box.

---

### Tools

1. **Breach Scanner** - Checks your credentials against HIBP using k-anonymity. Only the first 5 chars of your hash ever leave the browser.
2. **OSINT Footprint** - Domain recon: DNS records, SSL info, Shodan integration, GeoIP.
3. **Password Health** - Entropy analysis and pattern detection, not just a basic length check.
4. **Hash Forge** - SHA-256, SHA-1, and MD5 hashing for text and binary files.
5. **CVE Radar** - Live NVD CVE feed with auto-refresh.
6. **Cipher Playground** - Encode/decode ROT13, Caesar, Vigenere, Base64, and Morse.
7. **Threat Ticker** - Aggregated feeds from CISA KEV and GitHub Security Advisories.
8. **Decay Vault** - AES-256 encrypted password vault with a "decay" mechanic to keep secrets from going stale.

---

### Getting Started

Vite + TypeScript project. No backend setup needed.

```bash
git clone https://github.com/yourusername/ThreatDeskOS.git
cd ThreatDeskOS
npm install
npm run dev
```

Once the app loads, follow the on-screen instructions. Type `init` to set your username and master password. If you have an HIBP API key, have it ready during setup.

---

### Tech Stack

- **Language**: TypeScript
- **Build**: [Vite](https://vitejs.dev/)
- **Styling**: Vanilla CSS with CSS variables (glassmorphism)
- **Fonts**: IBM Plex Sans, Rajdhani, Share Tech Mono
- **Crypto**: Web Crypto API (SubtleCrypto)

---

### Contributing

New tools go in `src/apps`. Open a PR if you have something worth adding.

- Keep it local. No external servers unless it's k-anonymity or a public API.
- Use the CSS variables in `src/styles/global.css` to stay consistent with the theme.