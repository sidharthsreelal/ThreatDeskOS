// src/os/TaskBar.ts
import { WindowManager } from './WindowManager';

const SHIELD_SVG = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M16 2L4 8v8c0 7.18 5.12 13.9 12 15.4C22.88 29.9 28 23.18 28 16V8L16 2z" fill="#C0001A"/></svg>`;

interface ChipState {
  id: string;
  appId: string;
  title: string;
  icon: string;
  isMinimised: boolean;
  isFocused: boolean;
}

export function initTaskBar(container: HTMLElement): void {
  container.className = 'taskbar';

  // Brand
  const brand = document.createElement('div');
  brand.className = 'taskbar-brand';
  brand.innerHTML = `${SHIELD_SVG}<span class="taskbar-brand-name">ThreatDesk OS</span>`;

  // Launcher button
  const launcher = document.createElement('div');
  launcher.className = 'taskbar-launcher';
  launcher.innerHTML = `<svg viewBox="0 0 16 16"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>`;
  launcher.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('launcher:toggle'));
  });

  // App chips
  const appsContainer = document.createElement('div');
  appsContainer.className = 'taskbar-apps';

  // Right section
  const right = document.createElement('div');
  right.className = 'taskbar-right';

  const networkDot = document.createElement('div');
  networkDot.className = 'network-dot';
  if (!navigator.onLine) networkDot.classList.add('offline');
  window.addEventListener('online', () => networkDot.classList.remove('offline'));
  window.addEventListener('offline', () => networkDot.classList.add('offline'));

  const clock = document.createElement('div');
  clock.className = 'taskbar-clock';
  function updateClock(): void {
    const now = new Date();
    clock.textContent = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  updateClock();
  setInterval(updateClock, 1000);

  right.appendChild(networkDot);
  right.appendChild(clock);

  container.appendChild(brand);
  container.appendChild(launcher);
  container.appendChild(appsContainer);
  container.appendChild(right);

  // Chip tracking
  const chips = new Map<string, ChipState>();

  function renderChips(): void {
    appsContainer.innerHTML = '';
    chips.forEach((chip) => {
      const el = document.createElement('div');
      el.className = 'taskbar-chip';
      if (chip.isFocused) el.classList.add('focused');
      if (chip.isMinimised) el.classList.add('minimised');
      const iconHtml = chip.icon.startsWith('<svg')
        ? `<span class="taskbar-chip-icon" style="width:16px;height:16px;display:inline-flex;align-items:center">${chip.icon}</span>`
        : `<span class="taskbar-chip-icon">${chip.icon}</span>`;
      el.innerHTML = `${iconHtml}${chip.title}`;
      el.addEventListener('click', () => {
        if (chip.isMinimised) {
          WindowManager.restoreWindow(chip.id);
        } else if (chip.isFocused) {
          WindowManager.minimiseWindow(chip.id);
        } else {
          WindowManager.focusWindow(chip.id);
        }
      });
      appsContainer.appendChild(el);
    });
  }

  document.addEventListener('window:opened', ((e: CustomEvent) => {
    const { id, appId, title, icon } = e.detail;
    chips.set(id, { id, appId, title, icon: icon ?? '', isMinimised: false, isFocused: true });
    chips.forEach(c => { if (c.id !== id) c.isFocused = false; });
    renderChips();
  }) as EventListener);

  document.addEventListener('window:closed', ((e: CustomEvent) => {
    chips.delete(e.detail.id);
    renderChips();
  }) as EventListener);

  document.addEventListener('window:minimised', ((e: CustomEvent) => {
    const chip = chips.get(e.detail.id);
    if (chip) { chip.isMinimised = true; chip.isFocused = false; }
    renderChips();
  }) as EventListener);

  document.addEventListener('window:restored', ((e: CustomEvent) => {
    const chip = chips.get(e.detail.id);
    if (chip) { chip.isMinimised = false; chip.isFocused = true; }
    chips.forEach(c => { if (c.id !== e.detail.id) c.isFocused = false; });
    renderChips();
  }) as EventListener);

  document.addEventListener('window:focused', ((e: CustomEvent) => {
    chips.forEach(c => { c.isFocused = c.id === e.detail.id; });
    renderChips();
  }) as EventListener);
}
