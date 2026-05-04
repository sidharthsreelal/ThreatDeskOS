# ThreatDesk OS

A browser-based security analyst workstation that runs entirely on the client. No backend, no server, no telemetry.

---

### Why it exists

Most security tools either require installation, send data to a server, or exist as disconnected one-offs. ThreatDesk OS packages eight security utilities into a single environment with a shared identity layer and a consistent interface. The whole thing runs in a tab. Nothing leaves the browser unless you explicitly send it out.

---

### What it does

ThreatDesk OS boots into a terminal. From there you can flip to a full GUI desktop or use every tool directly from the command line.

**Eight built-in tools:**

- **Password Health** — Entropy analysis and pattern detection. Not just a length check.
- **Hash Forge** — SHA-256, SHA-1, and MD5 for text and binary files.
- **CVE Radar** — Live search against the NVD CVE database with CVSS scoring.
- **Cipher Playground** — ROT13, Caesar, Vigenère, Atbash, Base64, and Morse.
- **Threat Ticker** — Aggregated feed from CISA KEV and GitHub Security Advisories.
- **OSINT Footprint** — Domain recon: DNS records, SSL details, Shodan InternetDB, GeoIP.
- **Decay Vault** — AES-256-GCM password vault with a decay mechanic. Wrong passwords degrade stored ciphertexts over time.
- **Network Visualiser** — Resolve and map IP addresses and CIDR ranges with ASN grouping and edge inference.

**Interface:**

- **TUI** — Full terminal with pane multiplexing (split with `split`, cycle with Ctrl+Tab).
- **GUI** — macOS-style desktop with draggable, resizable, snap-to-edge windows.

**Security model:**

- Master credentials hashed with PBKDF2 (100,000 iterations, SHA-256).
- Vault entries encrypted with AES-256-GCM (310,000 PBKDF2 iterations per entry).
- Breach Scanner uses k-anonymity via HIBP — only the first 5 chars of your hash are sent.
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

The dev server starts at `http://localhost:5173`.

On first load, the terminal prompts you to run `init` to create a username and master password. If you have a Have I Been Pwned API key, have it ready — you can paste it in during the OSINT Footprint setup or store it in the vault.

---

### Configuration

No config file. Vite is configured in `vite.config.ts`. The default dev port is `5173`.

To change the port:

```ts
// vite.config.ts
server: {
  port: 3100,
}
```

Session data and vault contents are stored in `localStorage` under the keys `threatdesk:session` and `threatdesk:vault`. Clearing site data resets the installation.

---

### Project structure

```
src/
  api/          External API wrappers (NVD, CISA, Shodan, DNS)
  apps/         One directory per app — each exports a mount() function
  crypto/       Entropy analysis, hashing, and vault encryption
  os/           Shell, window manager, desktop, taskbar, terminal emulator
  styles/       Global CSS, component styles, animations
```

App registration is in `src/apps/registry.ts`. To add a new tool, create a directory under `src/apps/`, export a `mount(container: HTMLElement): void` function, and add an entry to the registry.

---

### Known issues

The OSINT Footprint tool relies on Shodan InternetDB (no key required) and a public DNS-over-HTTPS resolver. Both are rate-limited. Aggressive querying will get you throttled.

The Network Visualiser's force graph is functional but the layout algorithm is basic — large networks get cramped fast.

The `runBootSequence()` function in `BootSequence.ts` exists but is unused; the terminal-embedded boot (`bootInTerminal`) is what actually runs.

---

### Contributing

New tools go in `src/apps/`. Use the CSS variables defined in `src/styles/global.css` and `src/styles/variables.css` to stay consistent with the theme. Keep it local — no external servers unless they are public APIs that handle the privacy concern themselves (k-anonymity, etc.).

---