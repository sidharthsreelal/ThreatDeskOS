// src/os/Welcome.ts
import { runBootSequence } from './BootSequence';

const SHIELD_SVG = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" style="width:48px;height:48px;filter:drop-shadow(0 0 18px rgba(192,0,26,0.45));"><path d="M32 4L8 16v16c0 14.36 10.24 27.8 24 30.8C45.76 59.8 56 46.36 56 32V16L32 4z" fill="#C0001A"/><path d="M32 10l-18 9v12c0 11.08 7.88 21.42 18 23.7V10z" fill="#7A0000"/></svg>`;

const MODULES = [
  { icon: '🔑', name: 'PASSWORD HEALTH' },
  { icon: '🔍', name: 'BREACH SCANNER' },
  { icon: '⚡', name: 'HASH FORGE' },
  { icon: '🛡️', name: 'CVE RADAR' },
  { icon: '🔐', name: 'CIPHER PLAYGROUND' },
  { icon: '📡', name: 'THREAT TICKER' },
  { icon: '🕵️', name: 'OSINT FOOTPRINT' },
  { icon: '🔒', name: 'DECAY VAULT' },
];

export function showWelcome(desktop: HTMLElement, onReady: () => void): void {
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:800;animation:fade-in 0.6s ease;';

  const card = document.createElement('div');
  card.style.cssText = `
    background:rgba(14,14,20,0.93);
    backdrop-filter:blur(28px);
    -webkit-backdrop-filter:blur(28px);
    border:1px solid rgba(192,0,26,0.3);
    border-radius:var(--r-xl);
    padding:56px 48px;
    width:440px;
    box-shadow:0 0 80px rgba(192,0,26,0.1),0 32px 96px rgba(0,0,0,0.85);
    text-align:center;
  `;

  // Shield
  const shieldDiv = document.createElement('div');
  shieldDiv.innerHTML = SHIELD_SVG;
  shieldDiv.style.marginBottom = '20px';

  // Title
  const title = document.createElement('h1');
  title.textContent = 'THREATDESK OS';
  title.style.cssText =
    "font-family:'Rajdhani',sans-serif;font-size:32px;font-weight:700;color:var(--text-red);letter-spacing:0.06em;margin-bottom:6px;";

  // Analyst name
  const analyst = document.createElement('p');
  analyst.textContent = 'Security Analyst Workstation';
  analyst.style.cssText =
    "font-family:'IBM Plex Sans',sans-serif;font-size:16px;color:var(--text-2);margin-bottom:28px;";

  // Module list
  const modules = document.createElement('div');
  modules.style.cssText =
    'display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;text-align:left;margin-bottom:28px;';
  MODULES.forEach(m => {
    const item = document.createElement('div');
    item.style.cssText =
      "font-family:'Share Tech Mono',monospace;font-size:12px;color:var(--text-2);padding:3px 0;display:flex;align-items:center;gap:8px;";
    item.innerHTML = `<span>${m.icon}</span><span style="color:var(--text-3)">${m.name}</span>`;
    modules.appendChild(item);
  });

  // Blinking cursor
  const cursorLine = document.createElement('div');
  cursorLine.style.cssText = 'margin-bottom:28px;text-align:left;';
  const cursor = document.createElement('span');
  cursor.className = 'blink-cursor';
  cursorLine.appendChild(cursor);

  // CTA Button
  const btn = document.createElement('button');
  btn.textContent = 'INITIALISE SYSTEM →';
  btn.style.cssText = `
    background:var(--grad-aberdeen);
    border:none;
    border-radius:var(--r-md);
    padding:14px 32px;
    color:#fff;
    font-family:'Rajdhani',sans-serif;
    font-size:14px;
    font-weight:700;
    text-transform:uppercase;
    letter-spacing:0.08em;
    cursor:pointer;
    width:100%;
    transition:transform 0.1s,box-shadow 0.2s;
  `;
  btn.addEventListener('mouseenter', () => {
    btn.style.boxShadow = '0 0 24px rgba(192,0,26,0.35)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.boxShadow = 'none';
  });
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'BOOTING...';
    await runBootSequence();
    wrapper.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' })
      .onfinish = () => {
        wrapper.remove();
        onReady();
      };
  });

  card.appendChild(shieldDiv);
  card.appendChild(title);
  card.appendChild(analyst);
  card.appendChild(modules);
  card.appendChild(cursorLine);
  card.appendChild(btn);
  wrapper.appendChild(card);
  desktop.appendChild(wrapper);
}
