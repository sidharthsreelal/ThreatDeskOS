// src/os/Desktop.ts — Animated particle network background
import { APPS } from '../apps/registry';
import { launchApp, launchApps } from './AppLauncher';

export function initDesktop(el: HTMLElement): void {
  el.style.cssText = 'position:absolute;inset:0;overflow:hidden;background:#060608;';

  // Canvas for particle animation
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
  el.appendChild(canvas);

  // Vignette overlay
  const vignette = document.createElement('div');
  vignette.style.cssText =
    'position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 50%,rgba(6,6,8,0.85) 100%);pointer-events:none;z-index:1;';
  el.appendChild(vignette);

  // Subtle grid overlay
  const grid = document.createElement('div');
  grid.style.cssText =
    'position:absolute;inset:0;' +
    'background-size:40px 40px;' +
    'background-image:linear-gradient(to right,rgba(192,0,26,0.08) 1px,transparent 1px),' +
    'linear-gradient(to bottom,rgba(192,0,26,0.08) 1px,transparent 1px);' +
    'pointer-events:none;z-index:2;';
  el.appendChild(grid);

  // ── Particle System ─────────────────────────────────────────────

  interface Particle {
    x: number; y: number;
    vx: number; vy: number;
    radius: number;
    opacity: number;
  }

  const PARTICLE_COUNT = 100;
  const CONNECTION_DIST = 200;
  const particles: Particle[] = [];
  let w = 0, h = 0;
  let mouseX = -1000, mouseY = -1000;

  function resize(): void {
    const dpr = window.devicePixelRatio || 1;
    w = el.clientWidth;
    h = el.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }

  function initParticles(): void {
    particles.length = 0;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 2 + 1,
        opacity: Math.random() * 0.4 + 0.4,
      });
    }
  }

  function draw(): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    // Update & draw particles
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;

      // Mouse repulsion
      const mdx = p.x - mouseX;
      const mdy = p.y - mouseY;
      const md = Math.sqrt(mdx * mdx + mdy * mdy);
      if (md < 120) {
        const force = (120 - md) / 120 * 0.02;
        p.vx += mdx / md * force;
        p.vy += mdy / md * force;
      }

      // Damping
      p.vx *= 0.998;
      p.vy *= 0.998;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(192, 0, 26, ${p.opacity})`;
      ctx.fill();
    }

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECTION_DIST) {
          const alpha = (1 - dist / CONNECTION_DIST) * 0.3;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(192, 0, 26, ${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    // Mouse connection lines
    if (mouseX > 0 && mouseY > 0) {
      for (const p of particles) {
        const dx = p.x - mouseX;
        const dy = p.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 220) {
          const alpha = (1 - dist / 220) * 0.4;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouseX, mouseY);
          ctx.strokeStyle = `rgba(232, 0, 31, ${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => { resize(); });
  el.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
  el.addEventListener('mouseleave', () => {
    mouseX = -1000;
    mouseY = -1000;
  });

  resize();
  initParticles();
  draw();

  // ── Desktop Icon Logic ──────────────────────────────────────────
  
  const iconStates = APPS.map((app, i) => ({
    app,
    x: 40 + (Math.floor(i / 6) * 110),
    y: 40 + ((i % 6) * 110),
    selected: false,
    el: null as HTMLElement | null
  }));

  let isDragging = false;
  let isSelecting = false;
  let dragTarget: typeof iconStates[0] | null = null;
  let startX = 0, startY = 0;
  let marqueeStart = { x: 0, y: 0 };

  const marquee = document.createElement('div');
  marquee.className = 'selection-marquee';
  el.appendChild(marquee);

  function updateIconPositions() {
    iconStates.forEach(s => {
      if (s.el) {
        s.el.style.position = 'absolute';
        s.el.style.left = `${s.x}px`;
        s.el.style.top = `${s.y}px`;
        s.el.classList.toggle('selected', s.selected);
      }
    });
  }

  function launchSelected() {
    const ids = iconStates.filter(s => s.selected).map(s => s.app.id);
    launchApps(ids);
  }

  // Create Icons
  iconStates.forEach(state => {
    const icon = document.createElement('div');
    icon.className = 'desktop-icon';
    icon.innerHTML = `
      <div class="desktop-icon-svg">${state.app.icon}</div>
      <div class="desktop-icon-label">${state.app.title}</div>
    `;
    state.el = icon;
    el.appendChild(icon);

    icon.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      if (!e.shiftKey && !state.selected) {
        iconStates.forEach(s => s.selected = false);
      }
      state.selected = true;
      isDragging = true;
      dragTarget = state;
      startX = e.clientX - state.x;
      startY = e.clientY - state.y;
      updateIconPositions();
    });

    icon.addEventListener('dblclick', () => {
      launchApp(state.app.id);
    });
  });

  // Global Events
  window.addEventListener('mousedown', (e) => {
    if (e.target === el || e.target === canvas || e.target === grid || e.target === vignette) {
      isSelecting = true;
      marqueeStart = { x: e.clientX, y: e.clientY };
      iconStates.forEach(s => s.selected = false);
      updateIconPositions();
      marquee.style.display = 'block';
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (isDragging && dragTarget) {
      const dx = (e.clientX - startX) - dragTarget.x;
      const dy = (e.clientY - startY) - dragTarget.y;
      
      // Move all selected icons
      iconStates.filter(s => s.selected).forEach(s => {
        s.x += dx;
        s.y += dy;
      });
      
      // Keep main target under cursor accurately
      dragTarget.x = e.clientX - startX;
      dragTarget.y = e.clientY - startY;
      
      updateIconPositions();
    }

    if (isSelecting) {
      const x1 = Math.min(marqueeStart.x, e.clientX);
      const y1 = Math.min(marqueeStart.y, e.clientY);
      const x2 = Math.max(marqueeStart.x, e.clientX);
      const y2 = Math.max(marqueeStart.y, e.clientY);

      marquee.style.left = `${x1}px`;
      marquee.style.top = `${y1}px`;
      marquee.style.width = `${x2 - x1}px`;
      marquee.style.height = `${y2 - y1}px`;

      // Check selection
      iconStates.forEach(s => {
        if (!s.el) return;
        const rect = { x1, y1, x2, y2 };
        const iconRect = {
          x1: s.x, y1: s.y,
          x2: s.x + 90, y2: s.y + 100 // Approximation of icon size
        };
        s.selected = !(iconRect.x1 > rect.x2 || iconRect.x2 < rect.x1 || iconRect.y1 > rect.y2 || iconRect.y2 < rect.y1);
      });
      updateIconPositions();
    }
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    isSelecting = false;
    dragTarget = null;
    marquee.style.display = 'none';
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      launchSelected();
    }
    // Delete to unselect / clear? Or Escape?
    if (e.key === 'Escape') {
      iconStates.forEach(s => s.selected = false);
      updateIconPositions();
    }
  });

  updateIconPositions();
}
