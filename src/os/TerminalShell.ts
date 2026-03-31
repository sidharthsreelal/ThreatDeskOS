// src/os/TerminalShell.ts — Post-boot interactive shell with sub-shell TUI apps
import { Terminal } from './Terminal';
import { APPS } from '../apps/registry';
import { analysePassword } from '../crypto/entropy';
import { hashText, md5 } from '../crypto/hashing';
import { fetchCVEs, cvssScore } from '../api/nvd';
import { fetchAll } from '../api/ticker';
import { getAllDNS } from '../api/dns';
import { shodanLookup } from '../api/shodan';
import { checkPasswordPwned, checkAccount } from '../api/hibp';
import { getHibpKey, setHibpKey } from './Session';
import { loadVault, saveVault, encryptPassword, decryptPassword, createVerifyToken, checkVerifyToken, applyDecay } from '../crypto/vault';
import type { VaultState } from '../crypto/vault';
import { rot13, caesar, vigenere, atbash, toBase64, fromBase64, toMorse, fromMorse } from '../apps/CipherPlayground/ciphers';
import { parseInput } from '../apps/NetworkVisualiser/cidr';
import { resolveIP } from '../apps/NetworkVisualiser/geo';
import { buildEdges } from '../apps/NetworkVisualiser/edges';
import type { IPNode, IPEdge } from '../apps/NetworkVisualiser/types';

const HELP_TEXT = `
<span class="t-red t-bold">AVAILABLE COMMANDS</span>
<span class="t-dim">─────────────────────────────────────────────</span>
  <span class="t-green">gui</span>            Launch the graphical desktop
  <span class="t-green">apps</span>           List available applications
  <span class="t-green">help</span>           Show this help message
  <span class="t-green">clear</span>          Clear the terminal
  <span class="t-green">split</span>          Open a new terminal pane
  <span class="t-green">neofetch</span>       System information

<span class="t-yellow t-bold">APP COMMANDS</span>
<span class="t-dim">─────────────────────────────────────────────</span>
  <span class="t-green">pw</span>             Password strength analyser
  <span class="t-green">hash</span>           Hash text (SHA-256, SHA-1, MD5)
  <span class="t-green">breach</span>         Email breach scanner (HIBP)
  <span class="t-green">pwnpw</span>          Check if a password is pwned
  <span class="t-green">cve</span>            CVE database search
  <span class="t-green">ticker</span>         Live threat intelligence feed
  <span class="t-green">dns</span>            DNS lookup tool
  <span class="t-green">shodan</span>         Shodan InternetDB lookup
  <span class="t-green">cipher</span>         Cipher & encoding playground
  <span class="t-green">vault</span>          Decay Vault (AES-256-GCM)
  <span class="t-green">netvis</span>         Network Visualiser CLI
  <span class="t-green">hibpkey</span>        Set / view HIBP API key
`;

export function startShell(term: Terminal, username: string, onGui: () => void, onSplit?: () => void): void {
  term.setPrompt(`${username}@threatdesk:~$ `);
  term.setCommandHandler(async (cmd, t) => {
    const parts = cmd.split(/\s+/);
    const command = parts[0]?.toLowerCase();

    switch (command) {
      case '':
        break;

      case 'help':
        t.print(HELP_TEXT);
        break;

      case 'clear':
        t.clear();
        break;

      case 'gui':
        await t.type('Launching graphical interface...', { color: '#00D68F' });
        setTimeout(onGui, 400);
        break;

      case 'split':
        if (onSplit) onSplit();
        break;

      case 'apps':
        t.print('<span class="t-red t-bold">INSTALLED APPLICATIONS</span>');
        t.printDivider();
        APPS.forEach(app => {
          t.print(`  <span class="t-green">${app.id.padEnd(22)}</span><span class="t-dim">${app.title}</span>`);
        });
        break;

      case 'neofetch':
        await runNeofetch(t, username);
        break;

      case 'pw':
        await runPwShell(t);
        break;

      case 'hash':
        await runHashShell(t);
        break;

      case 'breach':
        await runBreachShell(t);
        break;

      case 'pwnpw':
        await runPwnpwShell(t);
        break;

      case 'cve':
        await runCveShell(t);
        break;

      case 'ticker':
        await runTickerShell(t);
        break;

      case 'dns':
        await runDnsShell(t);
        break;

      case 'shodan':
        await runShodanShell(t);
        break;

      case 'cipher':
        await runCipherShell(t);
        break;

      case 'vault':
        await runVaultShell(t);
        break;

      case 'netvis':
        await runNetvisShell(t);
        break;

      case 'hibpkey': {
        const key = parts.slice(1).join(' ');
        if (!key) {
          const current = getHibpKey();
          t.print(current ? `Current key: ${current.slice(0, 8)}...` : '<span class="t-yellow">No HIBP key set.</span>');
          t.printRaw('Usage: hibpkey <your-api-key>');
        } else {
          setHibpKey(key);
          t.print('<span class="t-green">✓ HIBP API key saved.</span>');
        }
        break;
      }

      default:
        t.print(`<span class="t-red">Unknown command:</span> ${command}`);
        t.printRaw('Type "help" for available commands.');
    }
  });
}

// ── Helper: run a sub-shell loop ──────────────────────────────────

async function subShell(
  t: Terminal,
  appName: string,
  helpText: string,
  prompt: string,
  handler: (cmd: string, parts: string[]) => Promise<boolean> // returns true to exit
): Promise<void> {
  const previousPrompt = (t as any).defaultPrompt;
  const previousHandler = (t as any).commandHandler;

  t.print(`<span class="t-green t-bold">▶ ${appName}</span> <span class="t-dim">— Type 'help' for commands. Press Esc or type 'exit' to quit.</span>`);
  t.print(helpText);

  return new Promise<void>(resolve => {
    const exitSubShell = () => {
      t.print(`<span class="t-dim">Exited ${appName}.</span>`);
      t.clearEscape();
      if (previousPrompt) t.setPrompt(previousPrompt);
      if (previousHandler) t.setCommandHandler(previousHandler);
      resolve();
    };

    const shellHandler = async (cmd: string) => {
      const parts = cmd.trim().split(/\s+/);
      const command = parts[0]?.toLowerCase();

      if (command === 'exit' || command === 'quit' || command === '') {
        if (command === 'exit' || command === 'quit') {
          exitSubShell();
        }
        return;
      }

      if (command === 'help') {
        t.print(helpText);
        return;
      }

      const shouldExit = await handler(cmd, parts);
      if (shouldExit) {
        exitSubShell();
      }
    };

    t.setPrompt(`${prompt}> `);
    t.setCommandHandler(shellHandler);

    t.onEscape(exitSubShell);
  });
}

// ── PASSWORD HEALTH ────────────────────────────────────────────────

async function runPwShell(t: Terminal): Promise<void> {
  const help = `
<span class="t-yellow">COMMANDS</span>
  <span class="t-green">analyse &lt;password&gt;</span>   Analyse password strength
  <span class="t-green">exit</span>                 Return to main shell`;

  await subShell(t, 'PASSWORD HEALTH', help, 'pw', async (cmd, parts) => {
    const sub = parts[0]?.toLowerCase();
    const arg = parts.slice(1).join(' ');

    if (sub === 'analyse' || sub === 'a') {
      if (!arg) { t.printRaw('Usage: analyse <password>', '#FFA500'); return false; }
      const r = analysePassword(arg);
      const scoreColors: Record<number, string> = { 0: '#E8001F', 1: '#FF6B35', 2: '#FFA500', 3: '#00D68F', 4: '#00FF88' };
      const scoreLabels: Record<number, string> = { 0: 'CRITICAL', 1: 'WEAK', 2: 'FAIR', 3: 'STRONG', 4: 'EXCELLENT' };
      t.print(`<span class="t-red t-bold">PASSWORD ANALYSIS</span>`);
      t.printDivider();
      t.print(`  Score:     <span style="color:${scoreColors[r.score]}">${scoreLabels[r.score]}</span>`);
      t.print(`  Entropy:   <span class="t-white">${r.entropy} bits</span>`);
      t.print(`  Charset:   <span class="t-white">${r.charsetSize} characters</span>`);
      t.print(`  Crack:     <span class="t-white">${r.crackTimeDisplay}</span>`);
      if (r.patterns.length) {
        t.print(`  <span class="t-yellow">Patterns:</span>`);
        r.patterns.forEach(p => t.print(`    <span class="t-red">⚠ ${p.type.toUpperCase()}</span>: ${p.description}`));
      }
      if (r.suggestions.length) {
        t.print(`  <span class="t-green">Suggestions:</span>`);
        r.suggestions.forEach(s => t.print(`    → ${s}`));
      }
    } else {
      t.printRaw(`Unknown command: ${sub}. Type 'help'.`, '#FFA500');
    }
    return false;
  });
}

// ── HASH FORGE ─────────────────────────────────────────────────────

async function runHashShell(t: Terminal): Promise<void> {
  const help = `
<span class="t-yellow">COMMANDS</span>
  <span class="t-green">hash &lt;text&gt;</span>   Compute SHA-256, SHA-1 and MD5 hashes
  <span class="t-green">exit</span>          Return to main shell`;

  await subShell(t, 'HASH FORGE', help, 'hash', async (cmd, parts) => {
    const sub = parts[0]?.toLowerCase();
    const arg = parts.slice(1).join(' ');

    if (sub === 'hash' || sub === 'h') {
      if (!arg) { t.printRaw('Usage: hash <text>', '#FFA500'); return false; }
      t.print('<span class="t-red t-bold">HASH RESULTS</span>');
      t.printDivider();
      const [sha256, sha1] = await Promise.all([hashText(arg, 'SHA-256'), hashText(arg, 'SHA-1')]);
      t.print(`  <span class="t-yellow">SHA-256</span>  ${sha256}`);
      t.print(`  <span class="t-yellow">SHA-1  </span>  ${sha1}`);
      t.print(`  <span class="t-yellow">MD5    </span>  ${md5(arg)}`);
    } else {
      t.printRaw(`Unknown command: ${sub}. Type 'help'.`, '#FFA500');
    }
    return false;
  });
}

// ── BREACH SCANNER ─────────────────────────────────────────────────

async function runBreachShell(t: Terminal): Promise<void> {
  if (!getHibpKey()) {
    t.print('<span class="t-red">⚠ No HIBP API key set. Use: hibpkey &lt;your-key&gt;</span>');
    return;
  }

  const help = `
<span class="t-yellow">COMMANDS</span>
  <span class="t-green">scan &lt;email&gt;</span>   Check email against HIBP breach database
  <span class="t-green">exit</span>           Return to main shell`;

  await subShell(t, 'BREACH SCANNER', help, 'breach', async (cmd, parts) => {
    const sub = parts[0]?.toLowerCase();
    const arg = parts.slice(1).join(' ');

    if (sub === 'scan' || sub === 's') {
      if (!arg) { t.printRaw('Usage: scan <email>', '#FFA500'); return false; }
      t.printRaw(`Scanning ${arg}...`);
      try {
        const breaches = await checkAccount(arg);
        if (!breaches.length) {
          t.print('<span class="t-green">✓ No breaches found.</span>');
        } else {
          t.print(`<span class="t-red t-bold">⚠ FOUND ${breaches.length} BREACHES</span>`);
          t.printDivider();
          breaches.forEach(b => {
            t.print(`  <span class="t-white">${b.Title}</span> <span class="t-dim">(${b.BreachDate})</span>`);
            t.print(`    ${b.PwnCount.toLocaleString()} accounts | ${b.DataClasses.slice(0, 3).join(', ')}`);
          });
        }
      } catch (e) { t.printRaw(`Error: ${e instanceof Error ? e.message : 'Unknown'}`, '#E8001F'); }
    } else {
      t.printRaw(`Unknown command: ${sub}. Type 'help'.`, '#FFA500');
    }
    return false;
  });
}

// ── PWNPW ──────────────────────────────────────────────────────────

async function runPwnpwShell(t: Terminal): Promise<void> {
  const help = `
<span class="t-yellow">COMMANDS</span>
  <span class="t-green">check &lt;password&gt;</span>   Check if password appears in known breaches
  <span class="t-green">exit</span>              Return to main shell`;

  await subShell(t, 'PWNED PASSWORD CHECK', help, 'pwnpw', async (cmd, parts) => {
    const sub = parts[0]?.toLowerCase();
    const arg = parts.slice(1).join(' ');

    if (sub === 'check' || sub === 'c') {
      if (!arg) { t.printRaw('Usage: check <password>', '#FFA500'); return false; }
      t.printRaw('Checking password (k-anonymity)...');
      try {
        const count = await checkPasswordPwned(arg);
        if (count > 0)
          t.print(`<span class="t-red">⚠ Password found ${count.toLocaleString()} times in breaches!</span>`);
        else
          t.print('<span class="t-green">✓ Password not found in any known breaches.</span>');
      } catch (e) { t.printRaw(`Error: ${e instanceof Error ? e.message : 'Unknown'}`, '#E8001F'); }
    } else {
      t.printRaw(`Unknown command: ${sub}. Type 'help'.`, '#FFA500');
    }
    return false;
  });
}

// ── CVE RADAR ──────────────────────────────────────────────────────

async function runCveShell(t: Terminal): Promise<void> {
  const help = `
<span class="t-yellow">COMMANDS</span>
  <span class="t-green">search &lt;keyword&gt;</span>   Search NVD CVE database
  <span class="t-green">exit</span>              Return to main shell`;

  await subShell(t, 'CVE RADAR', help, 'cve', async (cmd, parts) => {
    const sub = parts[0]?.toLowerCase();
    const arg = parts.slice(1).join(' ');

    if (sub === 'search' || sub === 's') {
      if (!arg) { t.printRaw('Usage: search <keyword>', '#FFA500'); return false; }
      t.printRaw(`Searching NVD for "${arg}"...`);
      try {
        const data = await fetchCVEs({ keywordSearch: arg, resultsPerPage: 10 });
        t.print(`<span class="t-red t-bold">CVE RESULTS (${data.totalResults} total)</span>`);
        t.printDivider();
        data.vulnerabilities.forEach(v => {
          const cve = v.cve;
          const cs = cvssScore(cve);
          const desc = ((cve.descriptions as Array<Record<string, string>>)?.find(d => d.lang === 'en')?.value ?? '').slice(0, 120);
          t.print(`  <span class="t-white">${cve.id}</span> ${cs ? `<span style="color:${cs.score >= 7 ? '#E8001F' : '#FFA500'}">[${cs.score} ${cs.severity}]</span>` : ''}`);
          t.print(`    <span class="t-dim">${desc}...</span>`);
        });
      } catch (e) { t.printRaw(`Error: ${e instanceof Error ? e.message : 'Unknown'}`, '#E8001F'); }
    } else {
      t.printRaw(`Unknown command: ${sub}. Type 'help'.`, '#FFA500');
    }
    return false;
  });
}

// ── THREAT TICKER ──────────────────────────────────────────────────

async function runTickerShell(t: Terminal): Promise<void> {
  const help = `
<span class="t-yellow">COMMANDS</span>
  <span class="t-green">fetch</span>     Fetch latest threat intelligence feed
  <span class="t-green">exit</span>      Return to main shell`;

  await subShell(t, 'THREAT TICKER', help, 'ticker', async (cmd, parts) => {
    const sub = parts[0]?.toLowerCase();

    if (sub === 'fetch' || sub === 'f') {
      t.printRaw('Fetching threat feeds...');
      try {
        const items = await fetchAll();
        t.print(`<span class="t-red t-bold">THREAT FEED (${items.length} items)</span>`);
        t.printDivider();
        items.slice(0, 15).forEach(item => {
          const sevColor = item.severity === 'CRITICAL' ? '#E8001F' : item.severity === 'HIGH' ? '#FF6B35' : '#FFA500';
          t.print(`  <span style="color:${sevColor}">[${item.severity.padEnd(8)}]</span> <span class="t-dim">${item.source}</span>`);
          t.print(`    ${item.title}`);
        });
      } catch (e) { t.printRaw(`Error: ${e instanceof Error ? e.message : 'Unknown'}`, '#E8001F'); }
    } else {
      t.printRaw(`Unknown command: ${sub}. Type 'help'.`, '#FFA500');
    }
    return false;
  });
}

// ── DNS LOOKUP ─────────────────────────────────────────────────────

async function runDnsShell(t: Terminal): Promise<void> {
  const help = `
<span class="t-yellow">COMMANDS</span>
  <span class="t-green">lookup &lt;domain&gt;</span>   Perform full DNS lookup
  <span class="t-green">exit</span>             Return to main shell`;

  await subShell(t, 'DNS LOOKUP', help, 'dns', async (cmd, parts) => {
    const sub = parts[0]?.toLowerCase();
    const arg = parts.slice(1).join(' ');

    if (sub === 'lookup' || sub === 'l') {
      if (!arg) { t.printRaw('Usage: lookup <domain>', '#FFA500'); return false; }
      t.printRaw(`Querying DNS for ${arg}...`);
      try {
        const records = await getAllDNS(arg);
        t.print(`<span class="t-red t-bold">DNS RECORDS — ${arg}</span>`);
        t.printDivider();
        Object.entries(records).forEach(([type, vals]) => {
          if ((vals as string[]).length) {
            t.print(`  <span class="t-yellow">${type}</span>`);
            (vals as string[]).forEach(v => t.print(`    ${v}`));
          }
        });
      } catch (e) { t.printRaw(`Error: ${e instanceof Error ? e.message : 'Unknown'}`, '#E8001F'); }
    } else {
      t.printRaw(`Unknown command: ${sub}. Type 'help'.`, '#FFA500');
    }
    return false;
  });
}

// ── SHODAN ─────────────────────────────────────────────────────────

async function runShodanShell(t: Terminal): Promise<void> {
  const help = `
<span class="t-yellow">COMMANDS</span>
  <span class="t-green">lookup &lt;ip&gt;</span>   Shodan InternetDB lookup for an IP
  <span class="t-green">exit</span>          Return to main shell`;

  await subShell(t, 'SHODAN LOOKUP', help, 'shodan', async (cmd, parts) => {
    const sub = parts[0]?.toLowerCase();
    const arg = parts.slice(1).join(' ');

    if (sub === 'lookup' || sub === 'l') {
      if (!arg) { t.printRaw('Usage: lookup <ip>', '#FFA500'); return false; }
      t.printRaw(`Looking up ${arg}...`);
      try {
        const result = await shodanLookup(arg);
        if (!result) { t.printRaw('No results found.'); return false; }
        t.print(`<span class="t-red t-bold">SHODAN — ${arg}</span>`);
        t.printDivider();
        t.print(`  <span class="t-yellow">Ports:</span>    ${result.ports.join(', ') || 'None'}`);
        t.print(`  <span class="t-yellow">Vulns:</span>    ${result.vulns.join(', ') || 'None'}`);
        t.print(`  <span class="t-yellow">Tags:</span>     ${result.tags.join(', ') || 'None'}`);
        t.print(`  <span class="t-yellow">Hosts:</span>    ${result.hostnames.join(', ') || 'None'}`);
      } catch (e) { t.printRaw(`Error: ${e instanceof Error ? e.message : 'Unknown'}`, '#E8001F'); }
    } else {
      t.printRaw(`Unknown command: ${sub}. Type 'help'.`, '#FFA500');
    }
    return false;
  });
}

// ── CIPHER PLAYGROUND ──────────────────────────────────────────────

async function runCipherShell(t: Terminal): Promise<void> {
  const help = `
<span class="t-yellow">COMMANDS</span>
  <span class="t-green">rot13 &lt;text&gt;</span>           ROT-13 encode/decode
  <span class="t-green">caesar &lt;n&gt; &lt;text&gt;</span>      Caesar cipher with shift n
  <span class="t-green">vigenere &lt;key&gt; &lt;text&gt;</span>  Vigenère cipher
  <span class="t-green">atbash &lt;text&gt;</span>           Atbash cipher
  <span class="t-green">base64 &lt;text&gt;</span>           Base64 encode
  <span class="t-green">debase64 &lt;text&gt;</span>         Base64 decode
  <span class="t-green">morse &lt;text&gt;</span>            Text → Morse code
  <span class="t-green">demorse &lt;code&gt;</span>          Morse code → Text
  <span class="t-green">exit</span>                    Return to main shell`;

  await subShell(t, 'CIPHER PLAYGROUND', help, 'cipher', async (cmd, parts) => {
    const mode = parts[0]?.toLowerCase();
    let result = '';

    try {
      switch (mode) {
        case 'rot13':    result = rot13(parts.slice(1).join(' ')); break;
        case 'caesar': {
          const n = parseInt(parts[1]) || 13;
          result = caesar(parts.slice(2).join(' '), n); break;
        }
        case 'vigenere': result = vigenere(parts.slice(2).join(' '), parts[1] ?? 'KEY'); break;
        case 'atbash':   result = atbash(parts.slice(1).join(' ')); break;
        case 'base64':   result = toBase64(parts.slice(1).join(' ')); break;
        case 'debase64': result = fromBase64(parts.slice(1).join(' ')); break;
        case 'morse':    result = toMorse(parts.slice(1).join(' ')); break;
        case 'demorse':  result = fromMorse(parts.slice(1).join(' ')); break;
        default:
          t.printRaw(`Unknown cipher: ${mode}. Type 'help'.`, '#FFA500');
          return false;
      }
      t.print(`<span class="t-green">${mode.toUpperCase()}</span> → <span class="t-white">${result}</span>`);
    } catch (e) {
      t.printRaw(`Error: ${e instanceof Error ? e.message : 'Unknown'}`, '#E8001F');
    }
    return false;
  });
}

// ── DECAY VAULT ────────────────────────────────────────────────────

async function runVaultShell(t: Terminal): Promise<void> {
  let state = loadVault();

  if (!state.verifyToken) {
    t.print('<span class="t-red t-bold">DECAY VAULT — SETUP</span>');
    t.printDivider();
    t.printRaw('No vault exists. Create one now.');
    const pw = await t.readPassword('Set vault password: ');
    const pw2 = await t.readPassword('Confirm password: ');
    if (pw !== pw2) { t.printRaw('Passwords do not match.', '#E8001F'); return; }
    const verify = await createVerifyToken(pw);
    state.verifyToken = verify.verifyToken;
    state.verifySalt = verify.verifySalt;
    state.verifyIv = verify.verifyIv;
    state.isLocked = false;
    saveVault(state);
    t.print('<span class="t-green">✓ Vault created.</span>');
  }

  if (state.isLocked) {
    const pw = await t.readPassword('Vault password: ');
    const ok = await checkVerifyToken(state, pw);
    if (!ok) {
      state = applyDecay(state);
      saveVault(state);
      t.print('<span class="t-red">⚠ Wrong password. Vault integrity degraded.</span>');
      return;
    }
    state.isLocked = false;
  }

  t.print('<span class="t-green t-bold">VAULT UNLOCKED</span>');

  const showEntries = () => {
    if (!state.entries.length) {
      t.printRaw('No entries. Use "add" to store a password.');
    } else {
      t.printDivider();
      state.entries.forEach((e, i) => {
        const badge = e.integrityPct >= 75 ? 'green' : e.integrityPct >= 50 ? 'yellow' : 'red';
        t.print(`  <span class="t-white">${i + 1}.</span> <span class="t-${badge}">[${e.integrityPct}%]</span> ${e.label} <span class="t-dim">(${e.username})</span>`);
      });
    }
  };

  showEntries();

  const masterPw = await t.readPassword('Re-enter password for operations: ');

  const vaultHelp = `
<span class="t-yellow">COMMANDS</span>
  <span class="t-green">add</span>         Add a new password entry
  <span class="t-green">reveal &lt;n&gt;</span>  Reveal password for entry n
  <span class="t-green">list</span>        List all entries
  <span class="t-green">lock</span>        Lock the vault
  <span class="t-green">exit</span>        Lock and return to main shell`;

  await subShell(t, 'DECAY VAULT', vaultHelp, 'vault', async (cmd, parts) => {
    switch (parts[0]) {
      case 'add': {
        const label = await t.readLine('Label: ');
        const user = await t.readLine('Username: ');
        const pw = await t.readPassword('Password: ');
        const { ciphertext, iv, salt } = await encryptPassword(pw, masterPw);
        state.entries.push({
          id: crypto.randomUUID(), label, username: user,
          ciphertext, iv, salt,
          originalLen: ciphertext.length, integrityPct: 100,
          createdAt: Date.now(),
        });
        saveVault(state);
        t.print('<span class="t-green">✓ Entry added.</span>');
        break;
      }
      case 'reveal': {
        const idx = parseInt(parts[1]) - 1;
        const entry = state.entries[idx];
        if (!entry) { t.printRaw('Invalid entry number.', '#FFA500'); break; }
        const plain = await decryptPassword(entry, masterPw);
        if (plain) {
          t.print(`<span class="t-green">${plain}</span> <span class="t-dim">(auto-hides in 10s)</span>`);
        } else {
          t.print('<span class="t-red">[DECRYPTION FAILED — CORRUPT]</span>');
        }
        break;
      }
      case 'list':
        showEntries();
        break;
      case 'lock':
        state.isLocked = true;
        saveVault(state);
        t.print('<span class="t-dim">Vault locked.</span>');
        return true; // exit sub-shell
      default:
        t.printRaw('Unknown command. Type "help".', '#FFA500');
    }
    return false;
  });

  // Always lock on exit
  state.isLocked = true;
  saveVault(state);
}

// ── NETWORK VISUALISER ─────────────────────────────────────────────

async function runNetvisShell(t: Terminal): Promise<void> {
  const help = `
<span class="t-yellow">COMMANDS</span>
  <span class="t-green">scan &lt;ips...&gt;</span>  Scan and resolve IPs/CIDRs
  <span class="t-green">locate</span>         Add current device location
  <span class="t-green">nodes</span>          List resolved nodes
  <span class="t-green">edges</span>          List connections between nodes
  <span class="t-green">clear</span>          Clear current state
  <span class="t-green">exit</span>           Return to main shell`;

  let nodes: IPNode[] = [];
  let edges: IPEdge[] = [];

  function printNodeDetails(n: IPNode) {
    t.printRaw('─────────────────────────────────────────────', '#4A4248');
    t.print(`  <span class="t-red">IP:</span>         <span class="t-white">${n.ip}</span>`);
    t.print(`  <span class="t-red">LOCATION:</span>   <span class="t-white">${n.city || '?'}, ${n.country} (${n.countryCode})</span>`);
    t.print(`  <span class="t-red">ASN/ORG:</span>    <span class="t-white">${n.asn} / ${n.org}</span>`);
    if (n.lat !== null) {
      t.print(`  <span class="t-red">GEO:</span>        <span class="t-white">${n.lat.toFixed(4)}, ${n.lng?.toFixed(4)}</span>`);
    }
    t.printRaw('─────────────────────────────────────────────', '#4A4248');
  }

  await subShell(t, 'NETWORK VISUALISER', help, 'netvis', async (cmd, parts) => {
    const sub = parts[0]?.toLowerCase();
    const arg = parts.slice(1).join(' ');

    if (sub === 'scan' || sub === 's') {
      if (!arg) { t.printRaw('Usage: scan <ip_or_cidr>', '#FFA500'); return false; }
      let ips: string[];
      try {
        ips = parseInput(arg);
      } catch (err: any) {
        t.printRaw(`Error: ${err.message}`, '#E8001F');
        return false;
      }
      if (ips.length === 0) { t.printRaw('No valid IPs found.', '#FFA500'); return false; }
      t.print(`<span class="t-dim">Parsed ${ips.length} IPs. Resolving...</span>`);

      for (const ip of ips) {
        if (!nodes.find(n => n.ip === ip)) {
          const geo = await resolveIP(ip);
          const newNode: IPNode = {
            id: ip, ip, lat: geo.lat ?? null, lng: geo.lng ?? null,
            country: geo.country ?? '', countryCode: geo.countryCode ?? 'XX',
            city: geo.city ?? '', asn: geo.asn ?? '', org: geo.org ?? '',
            isPrivate: geo.isPrivate ?? false, resolved: true, connections: 0
          };
          nodes.push(newNode);
          printNodeDetails(newNode);
        }
      }
      edges = buildEdges(nodes);
      nodes.forEach(n => n.connections = 0);
      edges.forEach(e => {
        const a = nodes.find(n=>n.ip===e.source);
        const b = nodes.find(n=>n.ip===e.target);
        if (a) a.connections++;
        if (b) b.connections++;
      });
      t.print(`<span class="t-green">✓ Scan complete. Total nodes: ${nodes.length}, Edges: ${edges.length}</span>`);

    } else if (sub === 'locate') {
      if (navigator.geolocation) {
         t.print('<span class="t-dim">Requesting geolocation...</span>');
         try {
           const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
             navigator.geolocation.getCurrentPosition(resolve, reject);
           });
           const exists = nodes.find(n => n.id === 'My Location');
           if (!exists) {
             const locNode: IPNode = {
               id: 'My Location', ip: 'My Location',
               lat: pos.coords.latitude, lng: pos.coords.longitude,
               country: 'Current Location', countryCode: 'LOC',
               city: 'Your Device', asn: 'Local', org: 'Internal',
               isPrivate: true, resolved: true, connections: 0
             };
             nodes.push(locNode);
             edges = buildEdges(nodes);
             t.print('<span class="t-green">✓ Location added.</span>');
             printNodeDetails(locNode);
           } else {
             t.print('<span class="t-yellow">Location already added.</span>');
           }
         } catch (err) {
           t.printRaw('Error: Unable to retrieve location.', '#E8001F');
         }
      } else {
         t.printRaw('Geolocation not supported by browser.', '#E8001F');
      }

    } else if (sub === 'nodes') {
      if (nodes.length === 0) { t.print('<span class="t-dim">No nodes yet. Run scan first.</span>'); return false; }
      t.print('<span class="t-red t-bold">RESOLVED NODES</span>');
      t.printDivider();
      nodes.forEach(n => {
        const ipStr = n.ip.padEnd(16);
        let locText = n.isPrivate ? 'PRIVATE' : `${n.countryCode} / ${n.city || '?'}`;
        if (n.id === 'My Location') locText = 'CURRENT DEVICE';
        const loc = `<span class="t-blue">${locText.substring(0, 20).padEnd(20)}</span>`;
        const asn = `<span class="t-yellow">${n.asn.padEnd(12)}</span>`;
        const conn = `<span class="t-dim">${n.connections} edges</span>`;
        t.print(`  <span class="t-white">${ipStr}</span> ${loc} ${asn} ${conn}`);
      });

    } else if (sub === 'edges') {
      if (edges.length === 0) { t.print('<span class="t-dim">No edges between current nodes.</span>'); return false; }
      t.print('<span class="t-red t-bold">NETWORK EDGES</span>');
      t.printDivider();
      edges.forEach(e => {
        const color = e.reason === 'same-asn' ? 't-red' : e.reason === 'same-subnet' ? 't-yellow' : 't-blue';
        t.print(`  <span class="t-white">${e.source.padEnd(16)}</span> <span class="t-dim">---(</span><span class="${color}">${e.reason}</span><span class="t-dim">)---></span> <span class="t-white">${e.target}</span>`);
      });

    } else if (sub === 'clear') {
      nodes = [];
      edges = [];
      t.print('<span class="t-green">✓ State cleared.</span>');

    } else {
      t.printRaw(`Unknown command: ${sub}. Type 'help'.`, '#FFA500');
    }
    return false;
  });
}

// ── NEOFETCH ───────────────────────────────────────────────────────

async function runNeofetch(t: Terminal, username: string): Promise<void> {
  const ascii = [
    '<span class="t-red">    ╔═══════════╗</span>',
    '<span class="t-red">   ╔╝           ╚╗</span>',
    '<span class="t-red">  ╔╝  ████████   ╚╗</span>',
    '<span class="t-red">  ║   ████████    ║</span>',
    '<span class="t-red">  ║    ██████     ║</span>',
    '<span class="t-red">  ╚╗    ████    ╔╝</span>',
    '<span class="t-red">   ╚╗    ██    ╔╝</span>',
    '<span class="t-red">    ╚═══════════╝</span>',
  ];

  const info = [
    `<span class="t-red t-bold">${username}</span>@<span class="t-red t-bold">threatdesk</span>`,
    '<span class="t-dim">──────────────────────</span>',
    `<span class="t-yellow">OS:</span>       ThreatDesk OS v2.4.1`,
    `<span class="t-yellow">Host:</span>     ${navigator.userAgent.split(' ').slice(-2).join(' ')}`,
    `<span class="t-yellow">Kernel:</span>   Web Crypto API`,
    `<span class="t-yellow">Shell:</span>    threatdesk-sh 1.0`,
    `<span class="t-yellow">CPU:</span>      ${navigator.hardwareConcurrency ?? '?'} cores`,
    `<span class="t-yellow">Memory:</span>   ${(navigator as unknown as Record<string, unknown>).deviceMemory ?? '?'} GB`,
    `<span class="t-yellow">Display:</span>  ${window.innerWidth}x${window.innerHeight}`,
    `<span class="t-yellow">Apps:</span>     ${APPS.length} installed`,
  ];

  for (let i = 0; i < Math.max(ascii.length, info.length); i++) {
    const left = ascii[i] ?? '                          ';
    const right = info[i] ?? '';
    t.print(`${left}    ${right}`);
  }
}
