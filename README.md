# ThreatDesk OS v2.4.1

**ThreatDesk OS** is a browser-based, high-fidelity security analyst workstation. It’s designed to give you a suite of specialized security tools in a unified, immersive environment that feels like a real operating system—right in your tab.

Whether you're doing quick OSINT, checking a suspicious hash, or analyzing password entropy, ThreatDesk OS provides a "zero-trust" environment where all computations happen locally. Nothing leaves your browser unless you explicitly tell it to.

---

### Key Features

*   **Dual-Interface Design**: Switch between a high-performance **Terminal (TUI)** with pane multiplexing and a macOS-style **Desktop (GUI)** with window management.
*   **Security First**: Built-in master credentials system using **PBKDF2** (310k iterations) and **AES-256-GCM** encryption.
*   **Client-Side Only**: Your keys, secrets, and data stay in your local storage. No backend tracking.
*   **Plug-and-Play Tools**: Eight (and counting) fully functional security applications.

### The Toolbelt

1.  **Breach Scanner**: Real-time HIBP database checks via k-anonymity (only the first 5 chars of your hash are ever sent).
2.  **OSINT Footprint**: Domain reconnaissance including DNS, SSL, Shodan integration, and GeoIP.
3.  **Password Health**: Advanced entropy analysis and pattern detection (not just length checks).
4.  **Hash Forge**: Fast hashing for SHA-256, SHA-1, and MD5 (supports both text and file binary data).
5.  **CVE Radar**: A live window into the NVD CVE database with auto-refreshing feeds.
6.  **Cipher Playground**: Quick decode/encode for ROT13, Caesar, Vigenère, Base64, and even Morse code.
7.  **Threat Ticker**: Aggregated live feeds from CISA KEV and GitHub Security Advisories.
8.  **Decay Vault**: An AES-256-encrypted password vault with a unique "decay" mechanic to ensure your secrets don't stay stale.

---

### Getting Started

This is a **Vite + TypeScript** project. No complex backend setup is required.

1.  **Clone it**:
    ```bash
    git clone https://github.com/yourusername/ThreatDeskOS.git
    cd ThreatDeskOS
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Spin it up**:
    ```bash
    npm run dev
    ```

4.  **Initialize**:
    Once the app loads, follow the on-screen terminal instructions. Type `init` to set your username and master password. 
    *(Pro-tip: If you have an HIBP API key, keep it handy during setup!)*

---

### Tech Stack

*   **Core**: TypeScript, HTML5, Vanilla CSS (CSS Variables for that sweet glassmorphism).
*   **Build Tool**: [Vite](https://vitejs.dev/) (fast HMR makes dev a breeze).
*   **Typography**: IBM Plex Sans, Rajdhani, and Share Tech Mono for that authentic terminal vibe.
*   **Encryption**: Web Crypto API (SubtleCrypto).

---

### Contributing

We’re always looking for new apps to add to the `src/apps` registry! If you have a tool you'd like to see, feel free to open a PR. 

*   **Keep it local**: Tools should not rely on external servers unless they use k-anonymity or public APIs.
*   **Follow the theme**: Use the defined CSS variables in `src/styles/global.css` to keep the UI consistent.

### License

This project is open-source. Feel free to use, modify, and distribute it as you see fit. 
---