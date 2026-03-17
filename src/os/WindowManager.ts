// src/os/WindowManager.ts

interface WindowConfig {
  title: string;
  appId: string;
  icon?: string;
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  content: HTMLElement;
  position?: { left: number; top: number }; // explicit placement override
}

interface WindowInstance {
  id: string;
  appId: string;
  element: HTMLElement;
  config: WindowConfig;
  isMinimised: boolean;
  isMaximised: boolean;
  zIndex: number;
  storedBounds: { left: number; top: number; width: number; height: number } | null;
}

class WindowManagerSingleton {
  private windows = new Map<string, WindowInstance>();
  private zCounter = 100;
  private desktopEl: HTMLElement | null = null;
  private cascadeOffset = 0;

  init(desktop: HTMLElement): void {
    this.desktopEl = desktop;
    this.cascadeOffset = 0;
  }

  createWindow(config: WindowConfig): string {
    if (!this.desktopEl) throw new Error('WindowManager not initialised');

    const id = crypto.randomUUID();
    const w = config.width ?? 600;
    const h = config.height ?? 450;
    const minW = config.minWidth ?? 340;
    const minH = config.minHeight ?? 260;

    // Placement: use explicit position if given, otherwise cascade
    let left: number, top: number;
    if (config.position) {
      left = config.position.left;
      top  = config.position.top;
    } else {
      this.cascadeOffset = (this.cascadeOffset + 1) % 8;
      const offset = this.cascadeOffset * 32;
      left = Math.max(0, Math.min(60 + offset, window.innerWidth - w - 20));
      top  = Math.max(0, Math.min(40 + offset, window.innerHeight - 48 - h - 20));
    }

    const el = document.createElement('div');
    el.className = 'window';
    el.id = id;
    el.style.cssText = `left:${left}px;top:${top}px;width:${w}px;height:${h}px;`;
    el.dataset.minWidth = String(minW);
    el.dataset.minHeight = String(minH);

    // Titlebar
    const titlebar = document.createElement('div');
    titlebar.className = 'window-titlebar';

    const trafficLights = document.createElement('div');
    trafficLights.className = 'window-traffic-lights';
    (['close', 'minimise', 'maximise'] as const).forEach(action => {
      const btn = document.createElement('div');
      btn.className = `traffic-light ${action}`;
      btn.dataset.action = action;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (action === 'close') this.closeWindow(id);
        else if (action === 'minimise') this.minimiseWindow(id);
        else this.maximiseWindow(id);
      });
      trafficLights.appendChild(btn);
    });

    const title = document.createElement('span');
    title.className = 'window-title';
    title.textContent = config.title;

    const icon = document.createElement('span');
    icon.className = 'window-icon';
    icon.innerHTML = config.icon ?? '';
    if (config.icon?.startsWith('<svg')) {
      icon.style.cssText = 'width:18px;height:18px;display:flex;align-items:center;';
      const svg = icon.querySelector('svg');
      if (svg) { svg.style.width = '18px'; svg.style.height = '18px'; }
    }

    titlebar.appendChild(trafficLights);
    titlebar.appendChild(title);
    titlebar.appendChild(icon);

    // Content
    const content = document.createElement('div');
    content.className = 'window-content';
    content.appendChild(config.content);

    el.appendChild(titlebar);
    el.appendChild(content);

    // Resize handles
    const directions = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
    directions.forEach(dir => {
      const handle = document.createElement('div');
      handle.className = `resize-handle ${dir}`;
      handle.dataset.dir = dir;
      el.appendChild(handle);
    });

    this.desktopEl.appendChild(el);

    const instance: WindowInstance = {
      id, appId: config.appId, element: el, config,
      isMinimised: false, isMaximised: false,
      zIndex: ++this.zCounter,
      storedBounds: null,
    };
    el.style.zIndex = String(instance.zIndex);
    this.windows.set(id, instance);

    // Open animation
    el.animate(
      [
        { transform: 'scale(0.94)', opacity: 0 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: 180, easing: 'ease-out', fill: 'forwards' }
    );

    // Focus on click
    el.addEventListener('mousedown', () => this.focusWindow(id));

    // Drag
    this.initDrag(id, titlebar);

    // Resize
    this.initResize(id, el);

    this.focusWindow(id);

    document.dispatchEvent(new CustomEvent('window:opened', {
      detail: { id, appId: config.appId, title: config.title, icon: config.icon },
    }));

    return id;
  }

  focusWindow(id: string): void {
    const win = this.windows.get(id);
    if (!win) return;
    this.windows.forEach(w => w.element.classList.remove('focused'));
    win.zIndex = ++this.zCounter;
    win.element.style.zIndex = String(win.zIndex);
    win.element.classList.add('focused');
    document.dispatchEvent(new CustomEvent('window:focused', {
      detail: { id, appId: win.appId },
    }));
  }

  minimiseWindow(id: string): void {
    const win = this.windows.get(id);
    if (!win || win.isMinimised) return;
    const anim = win.element.animate(
      [
        { transform: 'scale(1)', opacity: 1 },
        { transform: 'scale(0.9)', opacity: 0 },
      ],
      { duration: 150, easing: 'ease-in', fill: 'forwards' }
    );
    anim.onfinish = () => {
      win.element.style.display = 'none';
      win.isMinimised = true;
      document.dispatchEvent(new CustomEvent('window:minimised', {
        detail: { id, appId: win.appId },
      }));
    };
  }

  restoreWindow(id: string): void {
    const win = this.windows.get(id);
    if (!win || !win.isMinimised) return;
    win.element.style.display = 'flex';
    win.isMinimised = false;
    win.element.animate(
      [
        { transform: 'scale(0.9)', opacity: 0 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: 180, easing: 'ease-out', fill: 'forwards' }
    );
    this.focusWindow(id);
    document.dispatchEvent(new CustomEvent('window:restored', {
      detail: { id, appId: win.appId },
    }));
  }

  closeWindow(id: string): void {
    const win = this.windows.get(id);
    if (!win) return;
    const anim = win.element.animate(
      [
        { transform: 'scale(1)', opacity: 1 },
        { transform: 'scale(0.95)', opacity: 0 },
      ],
      { duration: 140, easing: 'ease-in', fill: 'forwards' }
    );
    anim.onfinish = () => {
      win.element.remove();
      this.windows.delete(id);
      document.dispatchEvent(new CustomEvent('window:closed', {
        detail: { id, appId: win.appId },
      }));
    };
  }

  maximiseWindow(id: string): void {
    const win = this.windows.get(id);
    if (!win) return;
    if (win.isMaximised) {
      if (win.storedBounds) {
        win.element.style.left = win.storedBounds.left + 'px';
        win.element.style.top = win.storedBounds.top + 'px';
        win.element.style.width = win.storedBounds.width + 'px';
        win.element.style.height = win.storedBounds.height + 'px';
      }
      win.element.classList.remove('maximised');
      win.isMaximised = false;
    } else {
      win.storedBounds = {
        left: win.element.offsetLeft,
        top: win.element.offsetTop,
        width: win.element.offsetWidth,
        height: win.element.offsetHeight,
      };
      win.element.style.left = '0px';
      win.element.style.top = '0px';
      win.element.style.width = '100vw';
      win.element.style.height = 'calc(100vh - 48px)';
      win.element.classList.add('maximised');
      win.isMaximised = true;
    }
  }

  // ── Snap Zones (Windows-style) ──────────────────────────────────

  private snapWindow(id: string, zone: 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'): void {
    const win = this.windows.get(id);
    if (!win) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight - 48;

    const bounds: Record<string, { l: number; t: number; w: number; h: number }> = {
      'left':         { l: 0,      t: 0,      w: vw / 2, h: vh },
      'right':        { l: vw / 2, t: 0,      w: vw / 2, h: vh },
      'top-left':     { l: 0,      t: 0,      w: vw / 2, h: vh / 2 },
      'top-right':    { l: vw / 2, t: 0,      w: vw / 2, h: vh / 2 },
      'bottom-left':  { l: 0,      t: vh / 2, w: vw / 2, h: vh / 2 },
      'bottom-right': { l: vw / 2, t: vh / 2, w: vw / 2, h: vh / 2 },
    };

    const b = bounds[zone];
    if (!b) return;

    if (!win.storedBounds) {
      win.storedBounds = {
        left: win.element.offsetLeft,
        top: win.element.offsetTop,
        width: win.element.offsetWidth,
        height: win.element.offsetHeight,
      };
    }

    win.element.style.left = b.l + 'px';
    win.element.style.top = b.t + 'px';
    win.element.style.width = b.w + 'px';
    win.element.style.height = b.h + 'px';
  }

  getWindowById(id: string): WindowInstance | undefined {
    return this.windows.get(id);
  }

  getWindowsByAppId(appId: string): WindowInstance[] {
    return [...this.windows.values()].filter(w => w.appId === appId);
  }

  getAllWindows(): WindowInstance[] {
    return [...this.windows.values()];
  }

  private initDrag(id: string, titlebar: HTMLElement): void {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let elStartX = 0;
    let elStartY = 0;

    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).classList.contains('traffic-light')) return;
      const win = this.windows.get(id);
      if (!win || win.isMaximised) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      elStartX = win.element.offsetLeft;
      elStartY = win.element.offsetTop;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const win = this.windows.get(id);
      if (!win) return;
      requestAnimationFrame(() => {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const newTop = Math.max(0, elStartY + dy);
        win.element.style.left = (elStartX + dx) + 'px';
        win.element.style.top = newTop + 'px';
      });
    };

    const onMouseUp = (e: MouseEvent) => {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      // Check snap zones
      const SNAP = 12;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      if (e.clientX <= SNAP && e.clientY <= SNAP) {
        this.snapWindow(id, 'top-left');
      } else if (e.clientX >= vw - SNAP && e.clientY <= SNAP) {
        this.snapWindow(id, 'top-right');
      } else if (e.clientX <= SNAP && e.clientY >= vh - SNAP - 48) {
        this.snapWindow(id, 'bottom-left');
      } else if (e.clientX >= vw - SNAP && e.clientY >= vh - SNAP - 48) {
        this.snapWindow(id, 'bottom-right');
      } else if (e.clientX <= SNAP) {
        this.snapWindow(id, 'left');
      } else if (e.clientX >= vw - SNAP) {
        this.snapWindow(id, 'right');
      }
    };

    titlebar.addEventListener('mousedown', onMouseDown);
  }

  private initResize(id: string, el: HTMLElement): void {
    const handles = el.querySelectorAll('.resize-handle');
    handles.forEach(handle => {
      const dir = (handle as HTMLElement).dataset.dir ?? '';
      let isResizing = false;
      let startX = 0, startY = 0;
      let startW = 0, startH = 0;
      let startL = 0, startT = 0;

      const onMouseDown = (e: MouseEvent) => {
        const win = this.windows.get(id);
        if (!win || win.isMaximised) return;
        e.stopPropagation();
        e.preventDefault();
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startW = el.offsetWidth;
        startH = el.offsetHeight;
        startL = el.offsetLeft;
        startT = el.offsetTop;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!isResizing) return;
        const minW = parseInt(el.dataset.minWidth ?? '340');
        const minH = parseInt(el.dataset.minHeight ?? '260');
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        requestAnimationFrame(() => {
          if (dir.includes('e')) {
            el.style.width = Math.max(minW, startW + dx) + 'px';
          }
          if (dir.includes('w')) {
            const nw = Math.max(minW, startW - dx);
            el.style.width = nw + 'px';
            el.style.left = (startL + startW - nw) + 'px';
          }
          if (dir.includes('s')) {
            el.style.height = Math.max(minH, startH + dy) + 'px';
          }
          if (dir.includes('n')) {
            const nh = Math.max(minH, startH - dy);
            el.style.height = nh + 'px';
            el.style.top = Math.max(0, startT + startH - nh) + 'px';
          }
        });
      };

      const onMouseUp = () => {
        isResizing = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      (handle as HTMLElement).addEventListener('mousedown', onMouseDown as EventListener);
    });
  }
}

export const WindowManager = new WindowManagerSingleton();
