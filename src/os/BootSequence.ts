// src/os/BootSequence.ts
import { APPS } from '../apps/registry';
import { getHibpKey } from './Session';

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function getBootLines(analyst: string): Array<{ text: string; colour?: string }> {
  const hibpKey = getHibpKey();
  const hibpStatus = hibpKey ? 'OK' : 'N/A';

  const baseLines: Array<{ text: string; colour?: string }> = [
    { text: 'THREATDESK OS  v2.4.1', colour: '#E8001F' },
    { text: '─'.repeat(50), colour: '#4A4248' },
    { text: 'BIOS/UEFI firmware check............................PASSED' },
    { text: 'Secure boot chain verification......................PASSED' },
    { text: 'Mounting crypto subsystem (Web Crypto API)..........OK' },
    { text: `Connecting to HaveIBeenPwned API....................${hibpStatus}` },
  ];

  // Map registry apps to boot lines
  const appLines = APPS.map(app => ({
    text: `Loading ${app.title.padEnd(25, '.')}OK`
  }));

  const endLines: Array<{ text: string; colour?: string }> = [
    { text: '─'.repeat(50), colour: '#4A4248' },
    { text: '' },
    { text: `All systems nominal. Welcome, ${analyst}.`, colour: '#00D68F' },
  ];

  return [...baseLines, ...appLines, ...endLines];
}

export async function runBootSequence(username?: string): Promise<void> {
  const analyst = username ?? 'analyst';
  const LINES = getBootLines(analyst);

  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:9999;background:#060608;display:flex;align-items:center;justify-content:center;';
  const pre = document.createElement('pre');
  pre.style.cssText =
    "font-family:'Share Tech Mono',monospace;font-size:13px;color:#9A8F8D;line-height:1.9;padding:40px;max-width:680px;width:100%;";
  overlay.appendChild(pre);
  document.body.appendChild(overlay);

  for (const line of LINES) {
    await sleep(25);
    const div = document.createElement('div');
    if (line.colour) div.style.color = line.colour;
    pre.appendChild(div);
    for (const char of line.text) {
      div.textContent += char;
      await sleep(1 + Math.random() * 2);
    }
  }

  await sleep(400);
  const anim = overlay.animate(
    [{ opacity: 1 }, { opacity: 0 }],
    { duration: 600, fill: 'forwards' }
  );
  await anim.finished;
  overlay.remove();
}

// Standalone boot sequence purely in a terminal element (no overlay)
export async function bootInTerminal(
  outputEl: HTMLElement,
  username?: string
): Promise<void> {
  const analyst = username ?? 'analyst';
  const LINES = [{ text: '', colour: undefined }, ...getBootLines(analyst), { text: '', colour: undefined }];

  for (const line of LINES) {
    await sleep(25);
    const div = document.createElement('div');
    div.className = 'terminal-line';
    if (line.colour) div.style.color = line.colour;
    outputEl.appendChild(div);
    for (const char of line.text) {
      div.textContent += char;
      await sleep(1 + Math.random() * 2);
    }
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  await sleep(300);
}
