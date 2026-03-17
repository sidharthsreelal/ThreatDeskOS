// src/apps/BreachScanner/index.ts
import { checkAccount, checkPasswordPwned } from '../../api/hibp';
import type { Breach } from '../../api/hibp';
import { getHibpKey, setHibpKey } from '../../os/Session';
import './styles.css';

export function mount(container: HTMLElement): void {
  container.innerHTML = `<div class="bs-container">
    <div class="tab-bar">
      <button class="tab-btn active" data-tab="email">EMAIL / USERNAME</button>
      <button class="tab-btn" data-tab="password">PASSWORD</button>
      <button class="tab-btn" data-tab="settings">⚙ API KEY</button>
    </div>
    <div id="bs-email-tab">
      <div class="bs-search-row">
        <input class="input" type="email" placeholder="Enter email or username..." id="bs-email-input" />
        <button class="btn btn-primary" id="bs-email-btn">SCAN</button>
      </div>
      <div id="bs-email-results"></div>
    </div>
    <div id="bs-password-tab" style="display:none">
      <div class="bs-search-row">
        <input class="input" type="password" placeholder="Enter password to check..." id="bs-pw-input" />
        <button class="btn btn-primary" id="bs-pw-btn">CHECK</button>
      </div>
      <div id="bs-pw-results"></div>
      <div class="bs-kanon-note">🔒 Only 5 SHA-1 prefix chars sent. Your password never leaves your device.</div>
    </div>
    <div id="bs-settings-tab" style="display:none">
      <div style="padding:16px 0">
        <div style="font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:600;color:var(--text-2);text-transform:uppercase;margin-bottom:8px">HIBP API KEY</div>
        <div class="bs-search-row">
          <input class="input" type="password" placeholder="Enter your HIBP API key..." id="bs-apikey-input" value="${getHibpKey()}" />
          <button class="btn btn-primary" id="bs-apikey-btn">SAVE</button>
        </div>
        <div style="font-size:12px;color:var(--text-3);margin-top:8px">Get a key at <a href="https://haveibeenpwned.com/API/Key" target="_blank" rel="noopener" style="color:var(--info)">haveibeenpwned.com/API/Key</a>. Your key is stored locally and never sent anywhere except HIBP.</div>
        <div id="bs-apikey-status" style="margin-top:8px"></div>
      </div>
    </div>
  </div>`;

  // Tabs
  const tabs = container.querySelectorAll('.tab-btn');
  const emailTab = container.querySelector('#bs-email-tab') as HTMLElement;
  const pwTab = container.querySelector('#bs-password-tab') as HTMLElement;
  const settingsTab = container.querySelector('#bs-settings-tab') as HTMLElement;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const which = (tab as HTMLElement).dataset.tab;
      emailTab.style.display = which === 'email' ? 'block' : 'none';
      pwTab.style.display = which === 'password' ? 'block' : 'none';
      settingsTab.style.display = which === 'settings' ? 'block' : 'none';
    });
  });

  // API Key tab
  const apikeyInput = container.querySelector('#bs-apikey-input') as HTMLInputElement;
  const apikeyBtn = container.querySelector('#bs-apikey-btn') as HTMLButtonElement;
  const apikeyStatus = container.querySelector('#bs-apikey-status') as HTMLElement;

  apikeyBtn.addEventListener('click', () => {
    const key = apikeyInput.value.trim();
    setHibpKey(key);
    apikeyStatus.innerHTML = '<span style="color:var(--success);font-size:12px">✓ API key saved successfully.</span>';
    setTimeout(() => { apikeyStatus.innerHTML = ''; }, 3000);
  });

  // Email tab
  const emailInput = container.querySelector('#bs-email-input') as HTMLInputElement;
  const emailBtn = container.querySelector('#bs-email-btn') as HTMLButtonElement;
  const emailResults = container.querySelector('#bs-email-results') as HTMLElement;

  emailBtn.addEventListener('click', async () => {
    if (!getHibpKey()) {
      emailResults.innerHTML = '<div class="bs-status error">⚠ No API key set. Go to ⚙ API KEY tab first.</div>';
      return;
    }
    const val = emailInput.value.trim();
    if (!val) return;
    emailResults.innerHTML = '<div class="bs-status"><div class="spinner" style="margin:0 auto"></div></div>';
    emailBtn.disabled = true;
    try {
      const breaches = await checkAccount(val);
      if (breaches.length === 0) {
        emailResults.innerHTML = '<div class="bs-status" style="color:var(--success)">✓ No breaches found for this account.</div>';
      } else {
        emailResults.innerHTML = breaches.map(b => renderBreach(b)).join('');
      }
    } catch (err) {
      emailResults.innerHTML = `<div class="bs-status error">⚠ ${err instanceof Error ? err.message : 'Unknown error'}</div>`;
    }
    emailBtn.disabled = false;
  });

  emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') emailBtn.click(); });

  // Password tab
  const pwInput = container.querySelector('#bs-pw-input') as HTMLInputElement;
  const pwBtn = container.querySelector('#bs-pw-btn') as HTMLButtonElement;
  const pwResults = container.querySelector('#bs-pw-results') as HTMLElement;

  pwBtn.addEventListener('click', async () => {
    const val = pwInput.value;
    if (!val) return;
    pwResults.innerHTML = '<div class="bs-status"><div class="spinner" style="margin:0 auto"></div></div>';
    pwBtn.disabled = true;
    try {
      const count = await checkPasswordPwned(val);
      const color = count > 0 ? 'var(--danger)' : 'var(--success)';
      pwResults.innerHTML = `
        <div class="bs-pwned-result">
          <div class="bs-pwned-count" style="color:${color}">${count.toLocaleString()}</div>
          <div class="bs-pwned-label">${count > 0
            ? '⚠ This password has been seen in data breaches. Never use it!'
            : '✓ This password has not been found in any known breaches.'
          }</div>
        </div>`;
    } catch (err) {
      pwResults.innerHTML = `<div class="bs-status error">⚠ ${err instanceof Error ? err.message : 'Unknown error'}</div>`;
    }
    pwBtn.disabled = false;
  });

  pwInput.addEventListener('keydown', e => { if (e.key === 'Enter') pwBtn.click(); });
}

function renderBreach(b: Breach): string {
  return `<div class="bs-breach-card">
    <div class="bs-breach-header">
      <span class="bs-breach-name">${b.Title}</span>
      <span class="bs-breach-date">${b.BreachDate}</span>
    </div>
    <div class="bs-breach-count"><strong>${b.PwnCount.toLocaleString()}</strong> accounts compromised</div>
    ${b.IsSensitive ? '<span class="bs-sensitive-badge">⚠ SENSITIVE</span>' : ''}
    <div class="bs-tags">${b.DataClasses.map(dc => `<span class="bs-tag">${dc}</span>`).join('')}</div>
  </div>`;
}
