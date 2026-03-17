// src/apps/ThreatTicker/index.ts
import { fetchAll } from '../../api/ticker';
import type { TickerItem } from '../../api/ticker';
import './styles.css';

const SEV_COLORS: Record<string, string> = {
  CRITICAL: 'var(--sev-critical)', HIGH: 'var(--sev-high)',
  MEDIUM: 'var(--sev-medium)', LOW: 'var(--sev-low)', INFO: 'var(--sev-none)',
};

export function mount(container: HTMLElement): void {
  container.innerHTML = `<div class="tt-container">
    <div class="tt-ticker-strip"><div class="tt-ticker-track" id="tt-track"></div></div>
    <div class="tt-card-list" id="tt-cards">
      <div class="tt-status"><div class="spinner" style="margin:0 auto"></div><div style="margin-top:8px">Loading threat feeds...</div></div>
    </div>
    <div class="tt-stats-bar">
      <div class="tt-stats-left">
        <span id="tt-crit-count">CRITICAL: —</span>
        <span id="tt-high-count">HIGH: —</span>
        <span id="tt-updated">Updated: —</span>
      </div>
      <div class="tt-stats-right">
        <div class="live-dot"></div>
        <span>LIVE</span>
      </div>
    </div>
  </div>`;

  const track = container.querySelector('#tt-track') as HTMLElement;
  const cardsEl = container.querySelector('#tt-cards') as HTMLElement;
  const critCount = container.querySelector('#tt-crit-count') as HTMLElement;
  const highCount = container.querySelector('#tt-high-count') as HTMLElement;
  const updatedEl = container.querySelector('#tt-updated') as HTMLElement;

  async function loadData(): Promise<void> {
    try {
      const items = await fetchAll();
      renderTicker(items);
      renderCards(items);
      const crit = items.filter(i => i.severity === 'CRITICAL').length;
      const high = items.filter(i => i.severity === 'HIGH').length;
      critCount.innerHTML = `<span style="color:var(--sev-critical)">CRITICAL: ${crit}</span>`;
      highCount.innerHTML = `<span style="color:var(--sev-high)">HIGH: ${high}</span>`;
      updatedEl.textContent = `Updated: ${new Date().toLocaleTimeString('en-GB')}`;
    } catch {
      cardsEl.innerHTML = '<div class="tt-status" style="color:var(--danger)">⚠ Failed to load threat feeds. Retrying...</div>';
      setTimeout(loadData, 5000);
    }
  }

  function renderTicker(items: TickerItem[]): void {
    // Duplicate for seamless loop
    const html = items.map(item =>
      `<span class="tt-ticker-item"><span class="severity-badge ${item.severity.toLowerCase()}">${item.severity}</span>${item.source} — ${item.title}</span><span class="tt-ticker-sep">///</span>`
    ).join('');
    track.innerHTML = html + html;
  }

  function renderCards(items: TickerItem[]): void {
    cardsEl.innerHTML = items.map(item => `
      <div class="tt-card" data-link="${item.link}">
        <div class="tt-card-header">
          <span class="severity-badge ${item.severity.toLowerCase()}">${item.severity}</span>
          <span class="tt-card-title">${item.title}</span>
          <span class="tt-card-source">${item.source}</span>
          <span class="tt-card-time">${formatTime(item.time)}</span>
        </div>
        <div class="tt-card-body">
          <a href="${item.link}" target="_blank" rel="noopener" style="color:var(--info);font-size:12px">View full details →</a>
        </div>
      </div>
    `).join('');

    cardsEl.querySelectorAll('.tt-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).tagName === 'A') return;
        card.classList.toggle('expanded');
      });
    });
  }

  loadData();
  // Auto-refresh every 5 minutes
  setInterval(loadData, 300_000);
}

function formatTime(time: string): string {
  if (!time) return '';
  const d = new Date(time);
  const diff = Date.now() - d.getTime();
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
  if (diff < 2592000000) return `${Math.round(diff / 86400000)}d ago`;
  return d.toLocaleDateString('en-GB');
}
