# ThreatDesk OS

A browser-based security analyst workstation. No backend, no server, no telemetry.

---

### Tools

| Tool | Description |
|---|---|
| Password Health | Entropy analysis and pattern detection |
| Hash Forge | SHA-256, SHA-1, and MD5 for text and binary files |
| CVE Radar | Live search against the NVD CVE database with CVSS scoring |
| Cipher Playground | ROT13, Caesar, Vigenere, Atbash, Base64, and Morse |
| Threat Ticker | Aggregated feed from CISA KEV and GitHub Security Advisories |
| OSINT Footprint | Domain recon: DNS records, SSL details, Shodan InternetDB, GeoIP |
| Decay Vault | AES-256-GCM password vault. Wrong passwords degrade stored ciphertexts over time |
| Network Visualiser | Resolve and map IP addresses and CIDR ranges with ASN grouping |

---

### Interface

- **TUI** - Terminal with pane multiplexing (`split` to split, `Ctrl+Tab` to cycle).
- **GUI** - Desktop with draggable, resizable, snap-to-edge windows.

---

### Security model

- Master credentials hashed with PBKDF2 (100,000 iterations, SHA-256).
- Vault entries encrypted with AES-256-GCM (310,000 PBKDF2 iterations per entry).
- Breach Scanner uses k-anonymity via HIBP. Only the first 5 chars of your hash leave the browser.
- Everything else is computed locally.

---

### Getting started

**Prerequisites:** Node.js 18+

```bash
git clone https://github.com/sidharthsreelal/OS.git
cd OS
npm install
npm run dev
```

The dev server starts at `http://localhost:5173`. On first load, run `init` in the terminal to create a username and master password.

Session data is stored in `localStorage` under `threatdesk:session` and `threatdesk:vault`. Clearing site data resets the installation.

---

### Project structure

```
src/
  api/          External API wrappers (NVD, CISA, Shodan, DNS)
  apps/         One directory per app, each exports a mount() function
  crypto/       Entropy analysis, hashing, and vault encryption
  os/           Shell, window manager, desktop, taskbar, terminal emulator
  styles/       Global CSS, component styles, animations
```

To add a tool: create a directory under `src/apps/`, export `mount(container: HTMLElement): void`, and register it in `src/apps/registry.ts`.

---

### Known issues

- OSINT Footprint uses Shodan InternetDB and a public DNS-over-HTTPS resolver. Both are rate-limited.
- Network Visualiser layout gets cramped with large node counts.

---

### License

MIT License

Copyright (c) 2026 Sidharth Sreelal

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.