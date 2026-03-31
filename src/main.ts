// src/main.ts
import './styles/global.css';
import './styles/window.css';
import './styles/taskbar.css';
import './styles/animations.css';
import './styles/terminal.css';
import { initDesktop } from './os/Desktop';
import { WindowManager } from './os/WindowManager';
import { initTaskBar } from './os/TaskBar';
import { initAppLauncher } from './os/AppLauncher';
import { Terminal, TerminalManager } from './os/Terminal';
import { bootInTerminal } from './os/BootSequence';
import { loadSession, createSession, verifyPassword, setHibpKey } from './os/Session';
import { startShell } from './os/TerminalShell';

const BANNER = `<span class="t-red">
 ████████╗██╗  ██╗██████╗ ███████╗ █████╗ ████████╗██████╗ ███████╗███████╗██╗  ██╗ ██████╗ ███████╗
 ╚══██╔══╝██║  ██║██╔══██╗██╔════╝██╔══██╗╚══██╔══╝██╔══██╗██╔════╝██╔════╝██║ ██╔╝██╔═══██╗██╔════╝
    ██║   ███████║██████╔╝█████╗  ███████║   ██║   ██║  ██║█████╗  ███████╗█████╔╝ ██║   ██║███████╗
    ██║   ██╔══██║██╔══██╗██╔══╝  ██╔══██║   ██║   ██║  ██║██╔══╝  ╚════██║██╔═██╗ ██║   ██║╚════██║
    ██║   ██║  ██║██║  ██║███████╗██║  ██║   ██║   ██████╔╝███████╗███████║██║  ██╗╚██████╔╝███████║
    ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝   ╚═════╝ ╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝</span>
<span class="t-dim">────────────────────────────────────────────────────────────────────────────────────────────────────────</span>
<span class="t-white t-bold">  THREATDESK OS v2.4.1</span>
<span class="t-dim">  Security Analyst Workstation</span>`;

function init(): void {
  const terminalLayer = document.getElementById('terminal-layer');
  const desktopLayer = document.getElementById('desktop-layer');
  const taskbarEl = document.getElementById('taskbar');

  if (!terminalLayer || !desktopLayer || !taskbarEl) {
    throw new Error('Missing required DOM elements');
  }

  terminalLayer.className = 'terminal-layer';

  const session = loadSession();

  if (!session) {
    runSetup(terminalLayer, desktopLayer, taskbarEl);
  } else {
    runLogin(terminalLayer, desktopLayer, taskbarEl, session.username);
  }
}

// ── First-time Setup ──────────────────────────────────────────────

async function runSetup(
  termLayer: HTMLElement,
  deskLayer: HTMLElement,
  taskbar: HTMLElement
): Promise<void> {
  const term = new Terminal(termLayer);
  term.print(BANNER);
  term.printBr();
  term.print(`<span class="t-dim">  Type '<span class="t-green">help</span>' to learn about the system</span>`);
  term.print(`<span class="t-dim">  Type '<span class="t-green">init</span>' to initialize ThreatDesk OS</span>`);
  term.printBr();

  term.setCommandHandler(async (cmd, t) => {
    switch (cmd.toLowerCase()) {
      case 'help':
        t.print(`
<span class="t-red t-bold">THREATDESK OS — FEATURES</span>
<span class="t-dim">─────────────────────────────────────────────</span>

<span class="t-yellow t-bold">8 SECURITY APPLICATIONS</span>
  <span class="t-green">PASSWORD HEALTH</span>     Real-time entropy analysis, pattern detection
  <span class="t-green">BREACH SCANNER</span>      Check emails/passwords against HIBP database
  <span class="t-green">HASH FORGE</span>          SHA-256, SHA-1, MD5 hashing for text and files
  <span class="t-green">CVE RADAR</span>           Search NVD CVE database with auto-refresh
  <span class="t-green">CIPHER PLAYGROUND</span>   ROT13, Caesar, Vigenère, Atbash, Base64, Morse
  <span class="t-green">THREAT TICKER</span>       Live feed from CISA KEV + GitHub Advisories
  <span class="t-green">OSINT FOOTPRINT</span>     Domain recon (DNS, SSL, Shodan, Geo)
  <span class="t-green">DECAY VAULT</span>         AES-256-GCM password vault with decay mechanic

<span class="t-yellow t-bold">DUAL INTERFACE</span>
  <span class="t-white">Terminal (TUI)</span>      Full access to all tools from the command line
  <span class="t-white">Desktop  (GUI)</span>      macOS-style windowed interface with drag/snap

<span class="t-yellow t-bold">SECURITY</span>
  → All computation is client-side — nothing leaves your browser
  → Passwords encrypted with AES-256-GCM + PBKDF2 (310k iterations)
  → Breach checking uses k-anonymity (only 5 SHA-1 prefix chars sent)
  → Master credentials use PBKDF2 hashing

<span class="t-dim">Type '<span class="t-green">init</span>' to begin system initialization.</span>`);
        break;

      case 'init':
        await doInit(t, termLayer, deskLayer, taskbar);
        break;

      case 'clear':
        t.clear();
        break;

      default:
        t.print(`<span class="t-dim">Unknown command. Type '<span class="t-green">help</span>' or '<span class="t-green">init</span>'.</span>`);
    }
  });

  term.focus();
}

async function doInit(
  term: Terminal,
  termLayer: HTMLElement,
  deskLayer: HTMLElement,
  taskbar: HTMLElement
): Promise<void> {
  term.hideInput();

  term.printBr();
  term.print('<span class="t-red t-bold">═══ SYSTEM INITIALIZATION ═══</span>');
  term.printBr();

  // Username
  const username = await term.readLine('  Enter username: ');
  if (!username.trim()) { term.printRaw('  Aborted.', '#E8001F'); return; }

  // Password
  const password = await term.readPassword('  Enter master password: ');
  if (!password) { term.printRaw('  Aborted.', '#E8001F'); return; }

  const password2 = await term.readPassword('  Confirm master password: ');
  if (password !== password2) {
    term.printRaw('  Passwords do not match. Aborted.', '#E8001F');
    return;
  }

  // HIBP key (optional)
  term.printBr();
  term.print('<span class="t-dim">  Optional: Set your HIBP API key for breach scanning.</span>');
  term.print('<span class="t-dim">  Get one at https://haveibeenpwned.com/API/Key</span>');
  const hibpKey = await term.readLine('  HIBP API key (or press Enter to skip): ');

  // "Yes, do as I say" confirmation
  term.printBr();
  term.print('<span class="t-yellow">  ⚠ WARNING: This will initialize ThreatDesk OS and set your master credentials.</span>');
  term.print('<span class="t-yellow">    All data in this browser session will be managed by these credentials.</span>');
  term.printBr();
  term.print('  <span class="t-white t-bold">To confirm, type exactly:</span> <span class="t-red">"Yes, do as I say!"</span>');
  const confirm = await term.readLine('  > ');

  if (confirm !== 'Yes, do as I say!') {
    term.printRaw('  Confirmation failed. Initialization aborted.', '#E8001F');
    return;
  }

  term.printBr();
  await term.type('  Creating session...', { color: '#00D68F' });
  const session = await createSession(username, password);
  if (hibpKey.trim()) {
    setHibpKey(hibpKey.trim());
  }
  await term.type('  Credentials secured with PBKDF2 (100k iterations).', { color: '#00D68F' });
  await term.type('  Session created.', { color: '#00D68F' });
  term.printBr();

  // Boot sequence
  term.hideInput();
  await bootInTerminal(term.outputEl, session.username);

  // Start shell without clearing
  startPostBoot(termLayer, deskLayer, taskbar, session.username, term);
}

// ── Returning User Login ──────────────────────────────────────────

async function runLogin(
  termLayer: HTMLElement,
  deskLayer: HTMLElement,
  taskbar: HTMLElement,
  username: string
): Promise<void> {
  const term = new Terminal(termLayer);
  term.print(BANNER);
  term.printBr();
  term.print(`<span class="t-dim">  Welcome back, <span class="t-white">${username}</span>.</span>`);
  term.printBr();

  let attempts = 0;

  const tryLogin = async (): Promise<void> => {
    const password = await term.readPassword(`  ${username}@threatdesk password: `);

    await term.type('  Verifying...', { color: '#FFA500', speed: 20 });
    const ok = await verifyPassword(password);

    if (ok) {
      term.print('<span class="t-green">  ✓ Authenticated.</span>');
      term.printBr();
      term.hideInput();
      await bootInTerminal(term.outputEl, username);
      startPostBoot(termLayer, deskLayer, taskbar, username, term);
    } else {
      attempts++;
      term.print(`<span class="t-red">  ✗ Authentication failed. (${attempts}/5)</span>`);
      if (attempts >= 5) {
        term.print('<span class="t-red">  Too many attempts. Reload to try again.</span>');
      } else {
        await tryLogin();
      }
    }
  };

  await tryLogin();
}

// ── Post-Boot Shell ───────────────────────────────────────────────

function startPostBoot(
  termLayer: HTMLElement,
  deskLayer: HTMLElement,
  taskbar: HTMLElement,
  username: string,
  existingTerm?: Terminal
): void {
  // Capture lines to preserve if any
  const preservedLines = existingTerm 
    ? Array.from(existingTerm.outputEl.querySelectorAll('.terminal-line')) as HTMLElement[]
    : [];

  // Clear terminal layer and create pane manager
  termLayer.innerHTML = '';
  const mgr = new TerminalManager(termLayer);
  const mainPane = mgr.createPane();

  if (preservedLines.length > 0) {
    mainPane.importLines(preservedLines);
  } else {
    // Fresh start: show banner and welcome
    mainPane.print(BANNER);
    mainPane.printBr();
    mainPane.print(`<span class="t-green">  System ready. Logged in as <span class="t-white t-bold">${username}</span>.</span>`);
    mainPane.print(`<span class="t-dim">  Type '<span class="t-green">help</span>' for commands, '<span class="t-green">gui</span>' for desktop, '<span class="t-green">split</span>' for new pane.</span>`);
    mainPane.printBr();
  }

  const launchGui = () => {
    termLayer.style.display = 'none';
    deskLayer.style.display = 'block';
    taskbar.style.display = 'flex';

    // Initialize desktop if not already done
    if (!deskLayer.hasChildNodes()) {
      initDesktop(deskLayer);
      WindowManager.init(deskLayer);
      initTaskBar(taskbar);
      initAppLauncher();
    }
  };

  const onSplit = () => {
    const newPane = mgr.createPane();
    startShell(newPane, username, launchGui, onSplit);
  };

  startShell(mainPane, username, launchGui, onSplit);

  // Tab to cycle panes
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && e.ctrlKey && termLayer.style.display !== 'none') {
      e.preventDefault();
      mgr.cycleFocus();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
