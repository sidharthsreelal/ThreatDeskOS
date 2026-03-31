// src/os/AppLauncher.ts
import { WindowManager } from './WindowManager';
import { APPS } from '../apps/registry';

let launcherEl: HTMLElement | null = null;
let overlayEl: HTMLElement | null = null;

export function initAppLauncher(): void {
  document.addEventListener('launcher:toggle', () => {
    if (launcherEl) {
      closeLauncher();
    } else {
      openLauncher();
    }
  });
}

function openLauncher(): void {
  // Overlay to close on click outside
  overlayEl = document.createElement('div');
  overlayEl.className = 'app-launcher-overlay';
  overlayEl.addEventListener('click', closeLauncher);
  document.body.appendChild(overlayEl);

  // Launcher grid
  launcherEl = document.createElement('div');
  launcherEl.className = 'app-launcher';
  launcherEl.style.animation = 'slide-up 0.2s ease';

  APPS.forEach(app => {
    const item = document.createElement('div');
    item.className = 'app-launcher-item';

    const iconEl = document.createElement('span');
    iconEl.className = 'app-launcher-item-icon';
    iconEl.innerHTML = app.icon;

    const titleEl = document.createElement('span');
    titleEl.className = 'app-launcher-item-title';
    titleEl.textContent = app.title;

    item.appendChild(iconEl);
    item.appendChild(titleEl);

    item.addEventListener('click', () => {
      launchApp(app.id);
      closeLauncher();
    });
    launcherEl!.appendChild(item);
  });

  document.body.appendChild(launcherEl);
}

function closeLauncher(): void {
  if (overlayEl) { overlayEl.remove(); overlayEl = null; }
  if (launcherEl) { launcherEl.remove(); launcherEl = null; }
}

export function launchApp(appId: string, position?: { left: number; top: number }): void {
  const app = APPS.find(a => a.id === appId);
  if (!app) return;

  const content = document.createElement('div');
  content.style.cssText = 'width:100%;height:100%;';

  const windowId = WindowManager.createWindow({
    title: app.title,
    appId: app.id,
    icon: app.icon,
    width: app.defaultWidth,
    height: app.defaultHeight,
    minWidth: app.minWidth,
    minHeight: app.minHeight,
    content,
    position,
  });

  try {
    app.mount(content);
  } catch (err) {
    content.innerHTML = `
      <div style="padding:20px;text-align:center;">
        <h3 style="color:var(--danger);font-family:'Rajdhani',sans-serif;margin-bottom:8px;">APP ERROR</h3>
        <p style="color:var(--text-2);font-size:13px;">${err instanceof Error ? err.message : 'Unknown error'}</p>
      </div>
    `;
  }

  if (import.meta.env.DEV) {
    console.log(`[AppLauncher] Launched ${app.title} → window ${windowId}`);
  }
}

/**
 * Launch multiple apps at once — cascades them diagonally so every titlebar is visible.
 */
export function launchApps(appIds: string[]): void {
  if (appIds.length === 0) return;
  if (appIds.length === 1) { launchApp(appIds[0]); return; }

  const STEP = 28;          // px offset per window (right + down)
  const START_LEFT = 60;
  const START_TOP = 40;
  const taskbarH = 48;
  const maxW = Math.min(760, window.innerWidth - START_LEFT - STEP * appIds.length);
  const maxH = Math.min(560, window.innerHeight - taskbarH - START_TOP - STEP * appIds.length);

  appIds.forEach((appId, i) => {
    const app = APPS.find(a => a.id === appId);
    if (!app) return;

    const content = document.createElement('div');
    content.style.cssText = 'width:100%;height:100%;';

    WindowManager.createWindow({
      title: app.title,
      appId: app.id,
      icon: app.icon,
      width: maxW,
      height: maxH,
      content,
      position: {
        left: START_LEFT + i * STEP,
        top:  START_TOP  + i * STEP,
      },
    });

    try { app.mount(content); } catch { /* ignore */ }
  });
}
