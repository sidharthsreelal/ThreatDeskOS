# ThreatDesk OS
## Browser-Based Cybersecurity Analyst Workstation
### Complete Implementation Plan — v2 — Six Apps

---

## 1. Project Overview

ThreatDesk OS is a browser-based personal operating system themed as a SOC analyst workstation. Every app window is a real, working security tool. The OS runs entirely in the browser — no backend, no server, no database. All computation is client-side.

The philosophy: a real security engineer's desktop, running in the browser. Dark, precise, purposeful. Every pixel signals competence. Every app does something real.

| Field | Detail |
|---|---|
| Category | Hack Club webOS Jam + Cybersecurity Portfolio Piece |
| Stack | Vanilla TypeScript + Vite, HTML5, CSS3, Web Crypto API |
| Build Time | 4–6 weeks (full six-app version) |
| CV Angle | Security tooling, Web Crypto API, passive OSINT, live API integration, OS-level UI architecture |

### The Six Apps

| # | App | What It Does | APIs / Tech | Vibe |
|---|---|---|---|---|
| 1 | Password Health | Entropy scoring, crack-time, pattern detection | Web Crypto API, pure TS | Serious |
| 2 | Hash Forge | SHA-256 / SHA-1 / MD5 with file drag-drop | Web Crypto API | Serious |
| 3 | CVE Radar | Live NVD vulnerability feed, filterable | NVD REST API v2 | Serious |
| 4 | Cipher Playground | Classic cipher encrypt/decrypt + frequency analysis | Pure TS | Fun |
| 5 | Threat Ticker | Live security news feed styled as an ops-room ticker | CISA RSS, GitHub Advisory | Fun |
| 6 | OSINT Footprint | Full passive domain recon — WHOIS, DNS, SSL, Shodan | Multiple free APIs | Advanced |
| 7 | Decay Vault | Password manager that self-destructs under brute-force | Web Crypto API, localStorage | Unique |

---

## 2. Design System — Aberdeen Red Theme

### 2.1 Design Philosophy

ThreatDesk OS is built around the **Aberdeen Red** colour identity — the deep, authoritative crimson of Aberdeen FC. The aesthetic is dark-terminal-meets-ops-room. Near-black surfaces, deep blood-red accents, and a signature diagonal gradient that defines all window chrome. The OS should feel like a threat analyst's workstation at 2am — focused, competent, a little dangerous.

The red is not decorative. It is the identity. Used on chrome and highlights only — content areas stay near-black so the red always pops.

### 2.2 Colour Tokens

```css
/* src/styles/variables.css — single source of truth */
:root {
  /* ── Backgrounds ──────────────────────────────── */
  --bg-desktop:    #060608;
  --bg-window:     #0E0E14;
  --bg-surface:    #13131C;
  --bg-raised:     #1A1A28;
  --bg-input:      #0E0E14;
  --bg-taskbar:    rgba(6,6,8,0.94);

  /* ── Aberdeen Red ─────────────────────────────── */
  --red-deep:      #7A0000;
  --red-mid:       #C0001A;
  --red-bright:    #E8001F;
  --red-glow:      rgba(192,0,26,0.20);
  --red-subtle:    rgba(192,0,26,0.08);

  /* ── Aberdeen Gradients ───────────────────────── */
  --grad-aberdeen: linear-gradient(135deg, #7A0000 0%, #C0001A 45%, #E8001F 100%);
  --grad-window:   linear-gradient(135deg, #7A0000 0%, #C0001A 55%, #1A1A28 100%);
  --grad-subtle:   linear-gradient(135deg, rgba(122,0,0,0.55) 0%, rgba(192,0,26,0.25) 100%);
  --grad-bar:      linear-gradient(90deg, #7A0000, #E8001F);

  /* ── Text ─────────────────────────────────────── */
  --text-1:        #F0EAE8;
  --text-2:        #9A8F8D;
  --text-3:        #4A4248;
  --text-red:      #E8001F;
  --text-code:     #FF6B6B;

  /* ── Borders ──────────────────────────────────── */
  --border:        rgba(192,0,26,0.22);
  --border-bright: rgba(232,0,31,0.55);
  --border-dim:    rgba(240,234,232,0.06);

  /* ── Semantic ─────────────────────────────────── */
  --success:       #00D68F;
  --warning:       #FFA500;
  --danger:        #E8001F;
  --info:          #4DA6FF;

  /* ── CVE Severity ─────────────────────────────── */
  --sev-critical:  #E8001F;
  --sev-high:      #FF6B35;
  --sev-medium:    #FFA500;
  --sev-low:       #4DA6FF;
  --sev-none:      #9A8F8D;

  /* ── Geometry ─────────────────────────────────── */
  --r-sm:  4px;
  --r-md:  8px;
  --r-lg:  12px;
  --r-xl:  18px;
}
```

### 2.3 Typography

```html
<!-- index.html <head> -->
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Rajdhani:wght@500;600;700&family=Share+Tech+Mono&display=swap" rel="stylesheet">
```

| Element | Font | Size | Weight | Notes |
|---|---|---|---|---|
| OS name / boot text | `Share Tech Mono` | 13–32px | 400 | Military terminal |
| Window titles | `Rajdhani` | 13px | 600 | Uppercase, letter-spacing 0.06em |
| App headings | `Rajdhani` | 18–24px | 700 | |
| Body / labels | `IBM Plex Sans` | 14px | 400/500 | |
| Hashes / IPs / CVE IDs | `Share Tech Mono` | 12–14px | 400 | |
| System clock | `Share Tech Mono` | 14px | 400 | |
| Buttons | `Rajdhani` | 13px | 600 | Uppercase, letter-spacing 0.08em |

### 2.4 Aberdeen Gradient Application Rules

Apply `--grad-window` / `--grad-aberdeen` to **only** these elements:

1. `.window-titlebar` background — every window
2. Boot sequence progress bar fill
3. `.traffic-light.close` glow (`box-shadow`)
4. Taskbar left-edge stripe (`border-left: 2px solid; border-image: var(--grad-aberdeen) 1`)
5. Focused app chip `border-bottom`
6. Welcome screen primary button background
7. Decay Vault lock icon when vault is sealed (pulsing glow)

**Never on:** body text, window content areas, regular buttons (use solid `--red-mid`), inputs.

---

## 3. Project Structure

```
threatdesk-os/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── main.ts
│   ├── os/
│   │   ├── WindowManager.ts
│   │   ├── TaskBar.ts
│   │   ├── Desktop.ts
│   │   ├── AppLauncher.ts
│   │   ├── BootSequence.ts
│   │   └── Welcome.ts
│   ├── apps/
│   │   ├── registry.ts
│   │   ├── PasswordHealth/
│   │   ├── HashForge/
│   │   ├── CveRadar/
│   │   ├── CipherPlayground/
│   │   ├── ThreatTicker/
│   │   ├── OsintFootprint/
│   │   └── DecayVault/
│   ├── crypto/
│   │   ├── hashing.ts
│   │   ├── entropy.ts
│   │   └── vault.ts               # Decay Vault encryption logic
│   ├── api/
│   │   ├── nvd.ts
│   │   ├── dns.ts                 # Cloudflare DoH
│   │   ├── whois.ts               # whois.freeaiapi.com
│   │   ├── shodan.ts              # Shodan InternetDB (free, no key)
│   │   └── ticker.ts              # CISA + GitHub advisory RSS
│   └── styles/
│       ├── global.css
│       ├── variables.css
│       ├── window.css
│       ├── taskbar.css
│       └── animations.css
└── public/
    └── icons/
```

---

## 4. Desktop Background

Static CSS scanline grid — renders instantly, no canvas overhead.

```typescript
// src/os/Desktop.ts
export function initDesktop(container: HTMLElement): void {
  Object.assign(container.style, {
    position: 'absolute', inset: '0',
    backgroundColor: 'var(--bg-desktop)',
    backgroundImage: `
      linear-gradient(rgba(192,0,26,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(192,0,26,0.04) 1px, transparent 1px)`,
    backgroundSize: '32px 32px',
  });
  const vignette = Object.assign(document.createElement('div'), {
    style: `position:absolute;inset:0;pointer-events:none;
            background:radial-gradient(ellipse at center,transparent 40%,rgba(6,6,8,0.75) 100%);`,
  });
  container.appendChild(vignette);
}
```

---

## 5. Window System

### 5.1 Aberdeen Titlebar CSS

```css
/* src/styles/window.css */

.window {
  position: absolute;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  box-shadow:
    0 32px 80px rgba(0,0,0,0.82),
    0 0 0 1px rgba(192,0,26,0.12),
    inset 0 1px 0 rgba(240,234,232,0.03);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-width: 340px;
  min-height: 260px;
}

.window.focused {
  box-shadow:
    0 32px 96px rgba(0,0,0,0.9),
    0 0 0 1px rgba(232,0,31,0.4),
    0 0 28px rgba(192,0,26,0.14),
    inset 0 1px 0 rgba(240,234,232,0.05);
}

.window-titlebar {
  height: 42px;
  min-height: 42px;
  background: var(--grad-window);
  display: flex;
  align-items: center;
  padding: 0 14px;
  gap: 10px;
  cursor: grab;
  user-select: none;
  flex-shrink: 0;
  position: relative;
}

/* Subtle noise texture over the gradient */
.window-titlebar::after {
  content: '';
  position: absolute; inset: 0; pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E");
  border-radius: var(--r-lg) var(--r-lg) 0 0;
}

.window-titlebar:active { cursor: grabbing; }

.window-traffic-lights { display: flex; gap: 6px; z-index: 1; }

.traffic-light {
  width: 12px; height: 12px;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.1s, opacity 0.15s;
}
.traffic-light:hover { transform: scale(1.15); }
.traffic-light.close    { background: #E8001F; box-shadow: 0 0 7px rgba(232,0,31,0.65); }
.traffic-light.minimise { background: #FFA500; }
.traffic-light.maximise { background: #00D68F; }

.window-title {
  flex: 1; text-align: center; z-index: 1;
  font-family: 'Rajdhani', sans-serif;
  font-size: 13px; font-weight: 600;
  color: rgba(240,234,232,0.9);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.window-content {
  flex: 1;
  overflow-y: auto; overflow-x: hidden;
  padding: 20px;
  scrollbar-width: thin;
  scrollbar-color: var(--red-mid) transparent;
}
```

---

## 6. Boot Sequence

```
THREATDESK OS  v2.4.1                             ← --red-bright, Rajdhani 20px
──────────────────────────────────────────────    ← --text-3
BIOS/UEFI firmware check......................PASSED
Secure boot chain verification................PASSED
Loading threat intelligence modules...........OK
Mounting crypto subsystem (Web Crypto API)....OK
Connecting to HaveIBeenPwned API..............OK
Loading NVD CVE feed connector................OK
Initialising Hash Forge engine................OK
Loading Cipher Playground.....................OK
Loading Threat Ticker.....................OK
Loading OSINT Footprint engine................OK
Mounting Decay Vault..........................OK
──────────────────────────────────────────────
[blank]
All systems nominal. Welcome, analyst.            ← --success, Rajdhani
```

Character-by-character typing, 12–22ms random delay per character. Full-screen `#060608` overlay. Fade out over 600ms. Triggered by welcome screen button click.

---

## 7. App 1 — Password Health Checker

**Core rule:** Passwords never leave the browser. All computation is synchronous pure TypeScript.

### Entropy Engine

```typescript
// src/crypto/entropy.ts
export interface PasswordAnalysis {
  entropy:          number;    // effective bits after pattern penalties
  rawEntropy:       number;    // theoretical bits
  charsetSize:      number;
  crackTimeSeconds: number;    // at 10^10 guesses/sec (GPU)
  crackTimeDisplay: string;
  score:            0|1|2|3|4;
  patterns:         PatternMatch[];
  suggestions:      string[];
}

export interface PatternMatch {
  type:        'dictionary'|'repeat'|'sequence'|'keyboard'|'date'|'leet';
  token:       string;
  description: string;
  penalty:     number;  // bits
}
```

**Scoring:** 0 = <28 bits, 1 = 28–36, 2 = 36–60, 3 = 60–80, 4 = >80

**Pattern detection:** Top-500 dictionary, repeated chars (3+), sequential chars (abc/123), keyboard walks (qwerty/asdf/zxcv), year/date patterns, leet-speak (p@ssw0rd → password)

**UI:** Password input with show/hide toggle → entropy bar (gradient `--danger → --warning → --success`) → three metric cards (ENTROPY BITS / CHARSET / CRACK TIME) → pattern warning cards (red left-border) → suggestion cards (teal left-border)

---


---

## 9. App 3 — Hash Forge

SHA-256 and SHA-1 via Web Crypto API. MD5 via pure-TypeScript RFC-1321 implementation. Supports text input and file drag-and-drop. Hash all three simultaneously. Compare section for integrity verification.

---

## 10. App 4 — CVE Radar

Live NVD CVE feed. No API key required. Keyword search, severity filter (ALL/CRITICAL/HIGH/MEDIUM/LOW), pagination. Auto-refreshes every 5 minutes. Each CVE card shows CVSS score badge, published date, description, CWE, and NIST link.

---

## 11. App 5 — Cipher Playground *(Fun)*

An interactive encryption sandbox for classic ciphers. Educational and genuinely fun to play with — stays fully on the security theme.

### Ciphers Implemented

| Cipher | Input | Notes |
|---|---|---|
| ROT13 | Text | Symmetric — encode = decode |
| Caesar | Text + shift (1–25) | Brute-force all 25 shifts simultaneously |
| Vigenère | Text + keyword | Full poly-alphabetic cipher |
| Base64 | Text or hex | Encode and decode |
| Morse Code | Text | With audio playback |
| Atbash | Text | Hebrew reverse cipher — A↔Z, B↔Y |
| Frequency Analysis | Ciphertext | Bar chart of letter frequency + English comparison |

### Frequency Analysis

The frequency analysis tool is the most advanced feature. Paste any ciphertext and it renders:
1. A bar chart of all 26 letters, height-scaled to frequency
2. A comparison overlay of expected English letter frequencies (E=12.7%, T=9.1%, etc.)
3. A "best guess shift" for Caesar ciphers — finds the shift that aligns the most frequent cipher letter with E
4. Index of Coincidence calculation (distinguishes monoalphabetic from polyalphabetic)

```typescript
// src/apps/CipherPlayground/analysis.ts

export function letterFrequency(text: string): Record<string, number> {
  const letters = text.toUpperCase().replace(/[^A-Z]/g, '');
  const counts: Record<string, number> = {};
  for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') counts[ch] = 0;
  for (const ch of letters) counts[ch]++;
  const total = letters.length || 1;
  Object.keys(counts).forEach(k => counts[k] = counts[k] / total);
  return counts;
}

export const ENGLISH_FREQ: Record<string, number> = {
  A:0.082,B:0.015,C:0.028,D:0.043,E:0.127,F:0.022,G:0.020,H:0.061,
  I:0.070,J:0.002,K:0.008,L:0.040,M:0.024,N:0.067,O:0.075,P:0.019,
  Q:0.001,R:0.060,S:0.063,T:0.091,U:0.028,V:0.010,W:0.023,X:0.001,
  Y:0.020,Z:0.001,
};

export function indexOfCoincidence(text: string): number {
  const letters = text.toUpperCase().replace(/[^A-Z]/g, '');
  const n = letters.length;
  if (n < 2) return 0;
  const counts: Record<string, number> = {};
  for (const ch of letters) counts[ch] = (counts[ch] ?? 0) + 1;
  const sum = Object.values(counts).reduce((acc, c) => acc + c * (c - 1), 0);
  return sum / (n * (n - 1));
  // English text ≈ 0.065 | random text ≈ 0.038
}

export function guessCaesarShift(ciphertext: string): number {
  const freq = letterFrequency(ciphertext);
  let bestShift = 0, bestScore = -Infinity;
  for (let shift = 0; shift < 26; shift++) {
    let score = 0;
    for (let i = 0; i < 26; i++) {
      const cipherChar = String.fromCharCode(65 + i);
      const plainChar  = String.fromCharCode(65 + ((i - shift + 26) % 26));
      score += freq[cipherChar] * (ENGLISH_FREQ[plainChar] ?? 0);
    }
    if (score > bestScore) { bestScore = score; bestShift = shift; }
  }
  return bestShift;
}
```

### Morse Code with Audio

```typescript
const MORSE: Record<string, string> = {
  A:'.-', B:'-...', C:'-.-.', D:'-..', E:'.', F:'..-.', G:'--.', H:'....',
  I:'..', J:'.---', K:'-.-', L:'.-..', M:'--', N:'-.', O:'---', P:'.--.',
  Q:'--.-', R:'.-.', S:'...', T:'-', U:'..-', V:'...-', W:'.--', X:'-..-',
  Y:'-.--', Z:'--..', '0':'-----', '1':'.----', '2':'..---', '3':'...--',
  '4':'....-', '5':'.....', '6':'-....', '7':'--...', '8':'---..', '9':'----.',
};

export async function playMorse(text: string): Promise<void> {
  const ctx = new AudioContext();
  const dotMs = 80;
  let t = ctx.currentTime;

  for (const char of text.toUpperCase()) {
    if (char === ' ') { t += (dotMs * 7) / 1000; continue; }
    const code = MORSE[char];
    if (!code) continue;
    for (const sym of code) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 600;
      gain.gain.setValueAtTime(0.3, t);
      osc.start(t);
      const dur = sym === '.' ? dotMs : dotMs * 3;
      osc.stop(t + dur / 1000);
      gain.gain.setValueAtTime(0, t + dur / 1000);
      t += (dur + dotMs) / 1000;
    }
    t += (dotMs * 3) / 1000;
  }
}
```

### UI Layout

Two panels: left = input area (cipher selector + key input + text textarea + action buttons), right = output area (encoded/decoded text + frequency chart canvas).

The frequency chart is rendered on a `<canvas>` element. Bars drawn with `--red-mid` for cipher text, `--info` overlay for expected English frequency. Hovering a bar shows the letter + percentage in a tooltip.

---

## 12. App 6 — Threat Ticker *(Fun)*

A live security news feed styled as a dramatic horizontal scrolling ops-room ticker — the kind you'd see in a NOC (Network Operations Centre). Real data from public security feeds.

### Data Sources

| Source | URL | Format | What it shows |
|---|---|---|---|
| CISA Known Exploited Vulnerabilities | `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json` | JSON | CVEs actively being exploited in the wild |
| GitHub Security Advisories | `https://api.github.com/advisories?per_page=20` | JSON | Recent open source library vulnerabilities |

Both are CORS-accessible. No API key required.

### Ticker Behaviour

```typescript
// src/apps/ThreatTicker/index.ts

interface TickerItem {
  id:       string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  source:   string;     // "CISA KEV" | "GitHub Advisory"
  title:    string;
  time:     string;     // relative: "2h ago"
  link:     string;
}
```

The ticker is a horizontally scrolling strip, 80px tall, at the top of the app window. Items scroll right-to-left continuously via CSS animation (`@keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }`). Speed: roughly 60px/s. Pauses on hover.

Below the ticker: a live feed list of the same items as expandable cards. Click any ticker item to jump to its card.

Each ticker item format: `[SEVERITY BADGE] SOURCE — TITLE ///`

Severity badge colours use the `--sev-*` tokens. `///` separator between items.

### CISA KEV Parser

```typescript
async function fetchCisaKev(): Promise<TickerItem[]> {
  const res  = await fetch('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json');
  const data = await res.json();
  return data.vulnerabilities.slice(0, 30).map((v: any) => ({
    id:       v.cveID,
    severity: 'CRITICAL',
    source:   'CISA KEV',
    title:    `${v.cveID} — ${v.vendorProject} ${v.product}: ${v.vulnerabilityName}`,
    time:     v.dateAdded,
    link:     `https://nvd.nist.gov/vuln/detail/${v.cveID}`,
  }));
}
```

### GitHub Advisory Parser

```typescript
async function fetchGithubAdvisories(): Promise<TickerItem[]> {
  const res  = await fetch('https://api.github.com/advisories?per_page=20');
  const data = await res.json() as any[];
  return data.map(a => ({
    id:       a.ghsa_id,
    severity: (a.severity?.toUpperCase() ?? 'MEDIUM') as TickerItem['severity'],
    source:   'GitHub Advisory',
    title:    a.summary,
    time:     a.published_at,
    link:     a.html_url,
  }));
}
```

### Stats Bar

Below the card list, a small stats bar shows: total CRITICAL items today, total HIGH items, last updated time, a pulsing green "LIVE" dot.

---

## 13. App 7 — OSINT Footprint *(Advanced)*

Full passive domain reconnaissance — the kind of recon a real threat analyst or penetration tester runs before any engagement. All data is from public sources. No active scanning. No target ever knows you looked.

### What It Runs

| Check | API Used | Key Required | What It Returns |
|---|---|---|---|
| WHOIS | `https://api.whois.avelaio.de/whois/{domain}` (CORS-friendly) | No | Registrar, registrant, dates, nameservers |
| DNS Records | Cloudflare DoH `https://cloudflare-dns.com/dns-query` | No | A, AAAA, MX, NS, TXT, CNAME records |
| SSL Certificate | `https://crt.sh/?q={domain}&output=json` | No | Cert history, issuer, SANs, expiry |
| Shodan InternetDB | `https://internetdb.shodan.io/{ip}` | No | Open ports, CPEs, tags, hostnames |
| IP Geolocation | `https://ipapi.co/{ip}/json/` | No (60/hour) | Country, city, ASN, ISP |
| Tech Stack | Analyse TXT/SPF/DMARC records | No | Email provider, CDN hints |

### Data Model

```typescript
interface FootprintReport {
  domain:    string;
  scannedAt: number;
  whois?:    WhoisData;
  dns?:      DnsData;
  ssl?:      SslData;
  shodan?:   ShodanData;
  geo?:      GeoData;
  techStack: string[];   // inferred: "Cloudflare", "Google Workspace", "SendGrid", etc.
  riskFlags: RiskFlag[];
}

interface RiskFlag {
  severity:    'critical' | 'high' | 'medium' | 'low' | 'info';
  title:       string;
  description: string;
}
```

### Risk Flag Detection — Auto-Generated

The app automatically flags interesting findings:

```typescript
function detectRiskFlags(report: FootprintReport): RiskFlag[] {
  const flags: RiskFlag[] = [];

  // SSL checks
  if (report.ssl) {
    const daysToExpiry = (new Date(report.ssl.expiryDate).getTime() - Date.now()) / 86400000;
    if (daysToExpiry < 0)  flags.push({ severity: 'critical', title: 'SSL Certificate Expired', description: `Certificate expired ${Math.abs(Math.round(daysToExpiry))} days ago.` });
    if (daysToExpiry < 30) flags.push({ severity: 'high',     title: 'SSL Certificate Expiring', description: `Certificate expires in ${Math.round(daysToExpiry)} days.` });
  }

  // DNS checks
  if (report.dns) {
    const txt = report.dns.TXT?.join(' ') ?? '';
    if (!txt.includes('v=spf1'))   flags.push({ severity: 'medium', title: 'No SPF Record',   description: 'Missing SPF record allows email spoofing from this domain.' });
    if (!txt.includes('v=DMARC1')) flags.push({ severity: 'medium', title: 'No DMARC Policy', description: 'No DMARC policy detected. Domain may be vulnerable to phishing.' });
    if (!txt.includes('v=DKIM'))   flags.push({ severity: 'low',    title: 'No DKIM Record',  description: 'No DKIM TXT record found at common selectors.' });
  }

  // Shodan checks
  if (report.shodan) {
    const riskyPorts = [21,23,25,3389,5900,27017,6379].filter(p => report.shodan!.ports.includes(p));
    riskyPorts.forEach(p => flags.push({
      severity:    p === 23 ? 'critical' : 'high',
      title:       `Exposed Port ${p}`,
      description: `Port ${p} (${PORT_NAMES[p]}) is publicly accessible.`,
    }));
  }

  // WHOIS checks
  if (report.whois) {
    const expiry = new Date(report.whois.expiryDate).getTime();
    const daysToExpiry = (expiry - Date.now()) / 86400000;
    if (daysToExpiry < 30) flags.push({ severity: 'low', title: 'Domain Expiring Soon', description: `Domain expires in ${Math.round(daysToExpiry)} days.` });
    if (report.whois.privacyProtected === false) flags.push({ severity: 'info', title: 'WHOIS Privacy Disabled', description: 'Registrant contact information is publicly visible.' });
  }

  return flags.sort((a, b) => ['critical','high','medium','low','info'].indexOf(a.severity) - ['critical','high','medium','low','info'].indexOf(b.severity));
}
```

### UI Layout

Vertical panels:

**Panel 1 — Input:** Domain input + large "RUN RECON" button. Below: a real-time scan progress list showing each check as it completes (with green tick or red X):
```
[✓] WHOIS lookup
[✓] DNS records
[✓] SSL certificates
[⟳] Shodan InternetDB...
[—] IP Geolocation
[—] Tech stack analysis
```

**Panel 2 — Risk Flags:** Coloured cards auto-generated from findings. Critical = red, High = orange, Medium = amber, Low = blue, Info = grey.

**Panel 3 — Detailed Results:** Tabbed interface — WHOIS | DNS | SSL | PORTS | GEO. Each tab shows the raw data in a clean monospace format.

**Panel 4 — Export:** A "EXPORT REPORT" button that generates a markdown report and downloads it as `{domain}-osint-{timestamp}.md`.

### DNS via Cloudflare DoH

```typescript
// src/api/dns.ts
const DOH = 'https://cloudflare-dns.com/dns-query';

const QTYPES = ['A','AAAA','MX','NS','TXT','CNAME','SOA'] as const;
type QType = typeof QTYPES[number];

export async function queryDNS(domain: string, type: QType): Promise<string[]> {
  const res = await fetch(
    `${DOH}?name=${encodeURIComponent(domain)}&type=${type}`,
    { headers: { 'Accept': 'application/dns-json' } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.Answer ?? []).map((r: { data: string }) => r.data);
}

export async function getAllDNS(domain: string): Promise<Record<QType, string[]>> {
  const results = await Promise.allSettled(
    QTYPES.map(t => queryDNS(domain, t).then(records => [t, records] as [QType, string[]]))
  );
  return Object.fromEntries(
    results
      .filter((r): r is PromiseFulfilledResult<[QType, string[]]> => r.status === 'fulfilled')
      .map(r => r.value)
  ) as Record<QType, string[]>;
}
```

---

## 14. App 8 — Decay Vault *(Password Manager)*

The most unique app in ThreatDesk OS. A password manager with a self-destruct mechanism: every wrong master password attempt deletes one character from each stored password ciphertext. The real owner knows their password — they get in on the first try. An attacker brute-forcing it watches the vault slowly decay, character by character, until the encrypted data is unrecoverable.

### The Mechanic Explained

Passwords are encrypted with AES-256-GCM using a key derived from the master password (PBKDF2, 310,000 iterations, SHA-256). The ciphertext is stored in localStorage as a hex string.

When the wrong password is entered:
1. The failed attempt is logged (count + timestamp)
2. Each stored password's ciphertext has **1 hex character removed from a random position**
3. After 3 wrong attempts, 3 characters are removed per attempt
4. After 10 wrong attempts, 5 characters removed per attempt
5. If ciphertext reaches ≤ 8 hex characters, that entry is permanently and silently deleted
6. The UI shows a "VAULT INTEGRITY DEGRADING" warning with a bar showing how much of the ciphertext remains

The correct owner who knows their password gets in on attempt 1 and sees zero decay.

### The Decay Logic

```typescript
// src/crypto/vault.ts

export interface VaultEntry {
  id:            string;
  label:         string;       // "Gmail", "GitHub", etc.
  username:      string;       // stored plaintext (not sensitive)
  ciphertext:    string;       // AES-GCM encrypted password as hex
  iv:            string;       // 12-byte IV as hex
  salt:          string;       // PBKDF2 salt as hex
  integrityPct:  number;       // 100 = pristine, 0 = deleted
  originalLen:   number;       // original ciphertext hex length
  createdAt:     number;
}

export interface VaultState {
  entries:       VaultEntry[];
  failedAttempts: number;
  lastFailedAt:  number | null;
  isLocked:      boolean;
}

// ── Encryption ─────────────────────────────────────────────────────

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 310_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptPassword(plaintext: string, masterPassword: string): Promise<{ ciphertext: string; iv: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const key  = await deriveKey(masterPassword, salt);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );

  return {
    ciphertext: bufToHex(encrypted),
    iv:         bufToHex(iv),
    salt:       bufToHex(salt),
  };
}

export async function decryptPassword(entry: VaultEntry, masterPassword: string): Promise<string | null> {
  try {
    const salt = hexToBuf(entry.salt);
    const iv   = hexToBuf(entry.iv);
    const key  = await deriveKey(masterPassword, new Uint8Array(salt));
    const ct   = hexToBuf(entry.ciphertext);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      new Uint8Array(ct)
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;  // Wrong password or corrupted ciphertext
  }
}

// ── Decay ──────────────────────────────────────────────────────────

export function applyDecay(state: VaultState): VaultState {
  const attempts    = state.failedAttempts;
  const charsToLose = attempts < 3 ? 1 : attempts < 10 ? 3 : 5;

  const updatedEntries = state.entries
    .map(entry => {
      if (entry.ciphertext.length <= 8) return null; // Mark for deletion

      // Remove `charsToLose` characters from random positions
      let ct = entry.ciphertext;
      for (let i = 0; i < charsToLose; i++) {
        // Always remove in pairs to keep hex valid
        const pos = Math.floor(Math.random() * (ct.length / 2)) * 2;
        ct = ct.slice(0, pos) + ct.slice(pos + 2);
      }

      const integrityPct = Math.round((ct.length / entry.originalLen) * 100);
      return { ...entry, ciphertext: ct, integrityPct };
    })
    .filter((e): e is VaultEntry => e !== null);

  return { ...state, entries: updatedEntries, failedAttempts: attempts + 1 };
}

// ── Helpers ─────────────────────────────────────────────────────────

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuf(hex: string): ArrayBuffer {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return arr.buffer;
}
```

### Storage

The entire vault state is stored in localStorage under `threatdesk:vault`. The master password is **never** stored — not hashed, not encrypted. Authentication is verified by attempting decryption (AES-GCM authentication tag fails if the password is wrong).

```typescript
const VAULT_KEY = 'threatdesk:vault';

export function loadVault(): VaultState {
  const raw = localStorage.getItem(VAULT_KEY);
  if (!raw) return { entries: [], failedAttempts: 0, lastFailedAt: null, isLocked: true };
  try { return JSON.parse(raw); }
  catch { return { entries: [], failedAttempts: 0, lastFailedAt: null, isLocked: true }; }
}

export function saveVault(state: VaultState): void {
  localStorage.setItem(VAULT_KEY, JSON.stringify(state));
}
```

### UI Layout

**Locked state:** Full-window lock screen with the ThreatDesk shield icon (pulsing Aberdeen gradient glow), a password input, and an "UNLOCK VAULT" button. If `failedAttempts > 0`, show a warning: "VAULT DEGRADED — {n} failed attempts. Each wrong entry corrupts your data further."

**Integrity bar:** A red bar below the input showing cumulative vault integrity: `100% - (averageDecay across all entries)`. Animates when decaying.

**Unlocked state:** Entry list. Each entry shows: label, username, a "REVEAL" button (decrypts and shows password for 10 seconds then re-hides), integrity percentage badge. A "ADD ENTRY" button opens a form. A "LOCK VAULT" button re-locks.

**Add entry form:** Label, username, password input (with strength indicator using the entropy engine), confirm password, "ENCRYPT AND STORE" button.

**Decay animation:** When a wrong password triggers decay, each entry card briefly flashes red and a character-strike animation plays on the integrity badge (old number counts down to new number).

---

## 15. Taskbar

Fixed 48px bar. Aberdeen gradient left-edge stripe. App launcher, running app chips, network dot, clock.

```css
.taskbar {
  position: fixed; bottom: 0; left: 0; right: 0; height: 48px;
  background: var(--bg-taskbar);
  backdrop-filter: blur(20px);
  border-top: 1px solid var(--border);
  border-left: 2px solid transparent;
  border-image: var(--grad-aberdeen) 1;
  display: flex; align-items: center;
  padding: 0 16px; gap: 8px; z-index: 500;
}
```

---

## 16. Welcome Screen

Centred card (`background: rgba(14,14,20,0.93)`, `backdrop-filter: blur(28px)`, `border: 1px solid rgba(192,0,26,0.3)`, `border-radius: var(--r-xl)`, `width: 440px`, `padding: 56px 48px`).

Contents: Aberdeen red shield SVG → `THREATDESK OS` in Rajdhani 32px/700 → your name → module list (all 8 apps) → blinking cursor → `INITIALISE SYSTEM →` button (gradient background, Rajdhani uppercase).

---

## 17. Deployment

```bash
npm create vite@latest threatdesk-os -- --template vanilla-ts
cd threatdesk-os && npm install
echo 'VITE_HIBP_KEY=your_key' > .env.local
vercel
```

Set `VITE_HIBP_KEY` in Vercel → Project Settings → Environment Variables.

### API Keys Required

| API | Key | Source | Cost |
|---|---|---|---|
| HaveIBeenPwned | `VITE_HIBP_KEY` | haveibeenpwned.com/API/Key | $3.50/month |
| NVD CVE | None | nvd.nist.gov | Free |
| CISA KEV | None | cisa.gov | Free |
| GitHub Advisories | None | api.github.com | Free (60 req/hr unauth) |
| Cloudflare DoH | None | cloudflare-dns.com | Free |
| crt.sh SSL | None | crt.sh | Free |
| Shodan InternetDB | None | internetdb.shodan.io | Free |
| ipapi.co | None | ipapi.co | Free (60/hr) |

---

## 18. CV Talking Points

- Built a complete window management system from scratch in vanilla TypeScript — no framework — demonstrating deep understanding of DOM architecture, event system design, and UI state management.
- Implemented the HaveIBeenPwned k-anonymity model: only the first 5 characters of a SHA-1 hash are sent over the network. Shows real cryptographic thinking applied to UX.
- Built the Decay Vault using AES-256-GCM with PBKDF2 key derivation (310,000 iterations), demonstrating practical use of the Web Crypto API and understanding of authenticated encryption.
- The decay mechanic is original — authentication-by-decryption-failure means the master password is never stored, yet wrong attempts are detectable and punishable without any server.
- OSINT Footprint runs a multi-source passive recon sweep in the browser, demonstrating domain expertise in reconnaissance methodology and real API integration across six different security data sources.
- The Cipher Playground implements frequency analysis with Index of Coincidence calculation — showing understanding of classical cryptanalysis beyond just "here's a Caesar cipher encoder."
- Every app is a self-contained TypeScript module with zero shared state — demonstrating software architecture thinking, not just feature shipping.
