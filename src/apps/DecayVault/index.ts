// src/apps/DecayVault/index.ts
import {
  loadVault, saveVault, encryptPassword, decryptPassword, applyDecay,
  createVerifyToken, checkVerifyToken,
} from '../../crypto/vault';
import type { VaultState, VaultEntry } from '../../crypto/vault';
import { analysePassword } from '../../crypto/entropy';
import './styles.css';

export function mount(container: HTMLElement): void {
  let state = loadVault();
  let masterPassword = '';

  render();

  function render(): void {
    if (state.isLocked) {
      renderLockScreen();
    } else {
      renderUnlocked();
    }
  }

  function renderLockScreen(): void {
    const avgIntegrity = state.entries.length
      ? Math.round(state.entries.reduce((s, e) => s + e.integrityPct, 0) / state.entries.length)
      : 100;

    const isFirstTime = !state.verifyToken;

    container.innerHTML = `<div class="dv-lock-screen">
      <div class="dv-shield">🔒</div>
      <div class="dv-title">DECAY VAULT</div>
      ${state.failedAttempts > 0 ? `<div class="dv-warning-banner">⚠ VAULT DEGRADED — ${state.failedAttempts} failed attempt${state.failedAttempts > 1 ? 's' : ''}. Each wrong entry corrupts your data further.</div>` : ''}
      ${state.entries.length > 0 ? `
        <div class="dv-integrity-label">VAULT INTEGRITY: ${avgIntegrity}%</div>
        <div class="dv-integrity-bar-wrap"><div class="dv-integrity-bar" style="width:${avgIntegrity}%"></div></div>
      ` : '<div style="font-size:13px;color:var(--text-2)">No entries yet. Unlock to add passwords.</div>'}
      <div class="dv-pw-row">
        <input class="input" type="password" placeholder="${isFirstTime ? 'Set master password...' : 'Master password...'}" id="dv-pw" />
        <button class="btn btn-primary" id="dv-unlock">${isFirstTime ? 'CREATE' : 'UNLOCK'}</button>
      </div>
    </div>`;

    const pwInput = container.querySelector('#dv-pw') as HTMLInputElement;
    const unlockBtn = container.querySelector('#dv-unlock') as HTMLButtonElement;

    pwInput.addEventListener('keydown', e => { if (e.key === 'Enter') unlockBtn.click(); });

    unlockBtn.addEventListener('click', async () => {
      const pw = pwInput.value;
      if (!pw) return;

      unlockBtn.disabled = true;
      unlockBtn.textContent = 'CHECKING...';

      if (!state.verifyToken) {
        // First time — set master password and create verification token
        masterPassword = pw;
        const verify = await createVerifyToken(pw);
        state.verifyToken = verify.verifyToken;
        state.verifySalt = verify.verifySalt;
        state.verifyIv = verify.verifyIv;
        state.isLocked = false;
        saveVault(state);
        render();
        return;
      }

      // Verify using the separate verification token (NOT affected by decay)
      const correct = await checkVerifyToken(state, pw);
      if (correct) {
        masterPassword = pw;
        state.isLocked = false;
        saveVault(state);
        render();
      } else {
        // Wrong password — apply decay to entries (NOT to verify token)
        state = applyDecay(state);
        saveVault(state);
        pwInput.value = '';
        unlockBtn.disabled = false;
        unlockBtn.textContent = state.entries.length ? 'UNLOCK' : 'CREATE';
        render();
      }
    });
  }

  function renderUnlocked(): void {
    container.innerHTML = `<div class="dv-container">
      <div class="dv-header-row">
        <h3 style="font-family:'Rajdhani',sans-serif;font-size:16px;color:var(--text-1)">STORED PASSWORDS</h3>
        <div style="display:flex;gap:8px">
          <button class="btn" id="dv-add-btn">+ ADD ENTRY</button>
          <button class="btn" id="dv-lock-btn">🔒 LOCK</button>
        </div>
      </div>
      <div class="dv-entry-list" id="dv-entries"></div>
      <div id="dv-add-form-wrap" style="display:none"></div>
    </div>`;

    const entriesEl = container.querySelector('#dv-entries') as HTMLElement;
    const addBtn = container.querySelector('#dv-add-btn') as HTMLButtonElement;
    const lockBtn = container.querySelector('#dv-lock-btn') as HTMLButtonElement;
    const formWrap = container.querySelector('#dv-add-form-wrap') as HTMLElement;

    renderEntries();

    lockBtn.addEventListener('click', () => {
      state.isLocked = true;
      masterPassword = '';
      saveVault(state);
      render();
    });

    addBtn.addEventListener('click', () => {
      formWrap.style.display = formWrap.style.display === 'none' ? 'block' : 'none';
      if (formWrap.style.display === 'block') renderAddForm();
    });

    function renderEntries(): void {
      if (state.entries.length === 0) {
        entriesEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-3)">No entries yet. Click + ADD ENTRY to store a password.</div>';
        return;
      }

      entriesEl.innerHTML = state.entries.map(entry => {
        const badgeClass = entry.integrityPct >= 75 ? 'good' : entry.integrityPct >= 50 ? 'warn' : 'bad';
        return `<div class="dv-entry-card" data-id="${entry.id}">
          <div class="dv-entry-info">
            <div class="dv-entry-label">${entry.label}</div>
            <div class="dv-entry-user">${entry.username}</div>
            <div class="dv-entry-pw" id="pw-${entry.id}">••••••••</div>
          </div>
          <span class="dv-integrity-badge ${badgeClass}">${entry.integrityPct}%</span>
          <button class="btn" data-reveal="${entry.id}" style="padding:4px 10px;font-size:11px">REVEAL</button>
        </div>`;
      }).join('');

      entriesEl.querySelectorAll('[data-reveal]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = (btn as HTMLElement).dataset.reveal ?? '';
          const entry = state.entries.find(e => e.id === id);
          if (!entry) return;

          const pwEl = container.querySelector(`#pw-${id}`) as HTMLElement;
          if (!pwEl) return;

          (btn as HTMLButtonElement).disabled = true;
          (btn as HTMLButtonElement).textContent = '...';

          const plain = await decryptPassword(entry, masterPassword);
          if (plain !== null) {
            pwEl.textContent = plain;
            pwEl.classList.add('visible');
            (btn as HTMLButtonElement).textContent = 'HIDE';
            setTimeout(() => {
              pwEl.textContent = '••••••••';
              pwEl.classList.remove('visible');
              (btn as HTMLButtonElement).textContent = 'REVEAL';
              (btn as HTMLButtonElement).disabled = false;
            }, 10000);
          } else {
            pwEl.textContent = '[DECRYPTION FAILED — CORRUPT]';
            pwEl.classList.add('visible');
            pwEl.style.color = 'var(--danger)';
            (btn as HTMLButtonElement).textContent = 'REVEAL';
            (btn as HTMLButtonElement).disabled = false;
          }
        });
      });
    }

    function renderAddForm(): void {
      formWrap.innerHTML = `<div class="dv-add-form">
        <input class="input" type="text" placeholder="Label (e.g. Gmail, GitHub)..." id="dv-label" />
        <input class="input" type="text" placeholder="Username / email..." id="dv-username" />
        <input class="input" type="password" placeholder="Password to encrypt..." id="dv-password" />
        <div class="dv-strength-bar-wrap"><div class="dv-strength-bar" id="dv-strength-bar" style="width:0%"></div></div>
        <button class="btn btn-primary" id="dv-encrypt-btn">🔐 ENCRYPT & STORE</button>
      </div>`;

      const labelInput = formWrap.querySelector('#dv-label') as HTMLInputElement;
      const pwInput = formWrap.querySelector('#dv-password') as HTMLInputElement;
      const strengthBar = formWrap.querySelector('#dv-strength-bar') as HTMLElement;
      const encryptBtn = formWrap.querySelector('#dv-encrypt-btn') as HTMLButtonElement;

      const SCORE_COLORS = ['var(--danger)', 'var(--sev-high)', 'var(--warning)', 'var(--success)', '#00FF88'];

      pwInput.addEventListener('input', () => {
        if (!pwInput.value) { strengthBar.style.width = '0%'; return; }
        const result = analysePassword(pwInput.value);
        strengthBar.style.width = Math.min(100, (result.entropy / 100) * 100) + '%';
        strengthBar.style.background = SCORE_COLORS[result.score];
      });

      encryptBtn.addEventListener('click', async () => {
        const label = labelInput.value.trim();
        const username = (formWrap.querySelector('#dv-username') as HTMLInputElement).value.trim();
        const pw = pwInput.value;
        if (!label || !pw) return;

        encryptBtn.disabled = true;
        encryptBtn.textContent = 'ENCRYPTING...';

        const { ciphertext, iv, salt } = await encryptPassword(pw, masterPassword);

        const entry: VaultEntry = {
          id: crypto.randomUUID(),
          label,
          username,
          ciphertext,
          iv,
          salt,
          originalLen: ciphertext.length,
          integrityPct: 100,
          createdAt: Date.now(),
        };

        state.entries.push(entry);
        saveVault(state);
        formWrap.style.display = 'none';
        renderEntries();
      });
    }
  }
}
