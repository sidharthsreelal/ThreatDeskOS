import { parseInput } from './cidr';
import { resolveIP } from './geo';
import { buildEdges } from './edges';
import { renderWorldMap } from './WorldMap';
import { renderDetailPanel } from './DetailPanel';
import type { IPNode, IPEdge, VisualisationState } from './types';
import './styles.css';

export async function mount(container: HTMLElement): Promise<void> {
  // Load D3 and topojson from CDN
  const [d3, topojson] = await Promise.all([
    import('https://cdn.jsdelivr.net/npm/d3@7/+esm') as any,
    import('https://cdn.jsdelivr.net/npm/topojson-client@3/+esm') as any,
  ]);

  const state: VisualisationState = {
    nodes:      [],
    edges:      [],
    loading:    new Set(),
    errors:     new Map(),
    activeView: 'map',
    selectedIP: null,
  };

  // ── Build HTML skeleton ──────────────────────────────────────────
  container.innerHTML = `
    <div class="nv-root">

      <div class="nv-toolbar">
        <div class="nv-input-row">
          <textarea
            id="nv-ip-input"
            class="nv-ip-textarea"
            placeholder="Enter IPs or CIDR ranges, one per line or comma-separated&#10;&#10;Examples:&#10;8.8.8.8&#10;1.1.1.1, 9.9.9.9&#10;192.168.1.0/24"
            rows="4"
          ></textarea>
          <button id="nv-scan-btn" class="nv-btn-primary">VISUALISE</button>
          <button id="nv-locate-btn" class="nv-btn-ghost">MY LOCATION</button>
          <button id="nv-clear-btn" class="nv-btn-ghost">CLEAR</button>
        </div>

        <div class="nv-legend">
          <span class="nv-legend-item"><span class="nv-dot" style="background:var(--sev-critical)"></span>Same ASN</span>
          <span class="nv-legend-item"><span class="nv-dot" style="background:var(--warning)"></span>Same /24</span>
          <span class="nv-legend-item"><span class="nv-dot" style="background:var(--info)"></span>Same Country</span>
          <span class="nv-legend-item"><span class="nv-dot" style="background:var(--warning);opacity:0.6"></span>Private IP / Current</span>
        </div>
      </div>

      <div class="nv-main">
        <div class="nv-canvas-wrap">
          <svg id="nv-map-svg"   class="nv-svg" style="display:none"></svg>
          <div id="nv-empty-state" class="nv-empty">
            <div class="nv-empty-icon">🕸️</div>
            <p>Enter IP addresses above and click VISUALISE</p>
            <p class="nv-empty-sub">Supports single IPs, comma-separated lists, and CIDR ranges (/16 to /32)</p>
          </div>
          <div id="nv-loading-overlay" class="nv-loading" style="display:none">
            <div class="nv-loading-bar"><div class="nv-loading-fill" id="nv-loading-fill"></div></div>
            <span id="nv-loading-text" class="nv-loading-text">Resolving 0 / 0 IPs...</span>
          </div>
        </div>

        <div id="nv-detail" class="nv-detail">
          <div class="nv-detail-placeholder">
            <span>Click a node to inspect</span>
          </div>
        </div>
      </div>

      <div class="nv-statusbar">
        <span id="nv-status-nodes">0 nodes</span>
        <span class="nv-sep">·</span>
        <span id="nv-status-edges">0 edges</span>
        <span class="nv-sep">·</span>
        <span id="nv-status-countries">0 countries</span>
        <span class="nv-sep">·</span>
        <span id="nv-status-asns">0 ASNs</span>
        <span class="nv-sep">·</span>
        <button id="nv-export-btn" class="nv-btn-link">EXPORT JSON</button>
      </div>

    </div>
  `;

  // ── Element refs ─────────────────────────────────────────────────
  const ipInput       = container.querySelector('#nv-ip-input')       as HTMLTextAreaElement;
  const scanBtn       = container.querySelector('#nv-scan-btn')        as HTMLButtonElement;
  const clearBtn      = container.querySelector('#nv-clear-btn')       as HTMLButtonElement;
  const locateBtn     = container.querySelector('#nv-locate-btn')      as HTMLButtonElement;
  const mapSvg        = container.querySelector('#nv-map-svg')         as SVGSVGElement;
  const emptyState    = container.querySelector('#nv-empty-state')     as HTMLDivElement;
  const loadingOverlay= container.querySelector('#nv-loading-overlay') as HTMLDivElement;
  const loadingFill   = container.querySelector('#nv-loading-fill')    as HTMLDivElement;
  const loadingText   = container.querySelector('#nv-loading-text')    as HTMLSpanElement;
  const detailPanel   = container.querySelector('#nv-detail')          as HTMLDivElement;
  const exportBtn     = container.querySelector('#nv-export-btn')      as HTMLButtonElement;
  const statusNodes   = container.querySelector('#nv-status-nodes')    as HTMLSpanElement;
  const statusEdges   = container.querySelector('#nv-status-edges')    as HTMLSpanElement;
  const statusCountries = container.querySelector('#nv-status-countries') as HTMLSpanElement;
  const statusAsns    = container.querySelector('#nv-status-asns')     as HTMLSpanElement;

  // ── Helpers ──────────────────────────────────────────────────────

  function updateStatus(): void {
    const countries = new Set(state.nodes.filter(n=>n.resolved).map(n=>n.countryCode)).size;
    const asns      = new Set(state.nodes.filter(n=>n.resolved&&n.asn!=='Unknown').map(n=>n.asn)).size;
    statusNodes.textContent    = `${state.nodes.length} node${state.nodes.length!==1?'s':''}`;
    statusEdges.textContent    = `${state.edges.length} edge${state.edges.length!==1?'s':''}`;
    statusCountries.textContent= `${countries} countr${countries!==1?'ies':'y'}`;
    statusAsns.textContent     = `${asns} ASN${asns!==1?'s':''}`;
  }

  function updateLoadingProgress(): void {
    const total    = state.nodes.length;
    const done     = state.nodes.filter(n => n.resolved).length;
    const pct      = total > 0 ? (done / total) * 100 : 0;
    loadingFill.style.width  = `${pct}%`;
    loadingText.textContent  = `Resolving ${done} / ${total} IPs...`;
    if (done === total && total > 0) {
      setTimeout(() => { loadingOverlay.style.display = 'none'; }, 400);
    }
  }

  function rerenderActiveView(): void {
    if (state.nodes.filter(n=>n.resolved).length === 0) return;
    renderWorldMap(mapSvg, state.nodes, state.edges, d3, topojson, handleNodeClick);
  }

  function handleNodeClick(ip: string): void {
    state.selectedIP = ip;
    const node = state.nodes.find(n => n.ip === ip);
    if (node) renderDetailPanel(detailPanel, node);
  }

  // ── Scan ─────────────────────────────────────────────────────────

  async function runScan(): Promise<void> {
    const raw = ipInput.value.trim();
    if (!raw) return;

    let ips: string[];
    try {
      ips = parseInput(raw);
    } catch (err: any) {
      alert(err.message);
      return;
    }

    if (ips.length === 0) { alert('No valid IP addresses found.'); return; }

    // Reset state
    state.nodes      = ips.map(ip => ({
      id: ip, ip, lat: null, lng: null, country: '', countryCode: 'XX',
      city: '', asn: '', org: '', isPrivate: false, resolved: false, connections: 0,
    }));
    state.edges      = [];
    state.loading    = new Set(ips);
    state.errors     = new Map();
    state.selectedIP = null;

    emptyState.style.display     = 'none';
    loadingOverlay.style.display = 'flex';
    loadingFill.style.width      = '0%';
    mapSvg.style.display         = 'block';

    scanBtn.disabled   = true;
    scanBtn.textContent = 'SCANNING...';

    updateStatus();
    updateLoadingProgress();

    // Resolve IPs sequentially (respect rate limit)
    for (const ip of ips) {
      const geo = await resolveIP(ip);
      const idx = state.nodes.findIndex(n => n.ip === ip);
      if (idx !== -1) {
        state.nodes[idx] = { ...state.nodes[idx], ...geo, resolved: true };
      }
      state.loading.delete(ip);
      state.edges = buildEdges(state.nodes);

      // Update connection degree counts
      state.nodes.forEach(n => n.connections = 0);
      state.edges.forEach(e => {
        const a = state.nodes.find(n=>n.ip===e.source);
        const b = state.nodes.find(n=>n.ip===e.target);
        if (a) a.connections++;
        if (b) b.connections++;
      });

      updateLoadingProgress();
      updateStatus();
      rerenderActiveView(); // Re-render progressively as each IP resolves
    }

    scanBtn.disabled    = false;
    scanBtn.textContent = 'VISUALISE';
  }

  // ── Event listeners ──────────────────────────────────────────────

  scanBtn.addEventListener('click', runScan);

  clearBtn.addEventListener('click', () => {
    ipInput.value = '';
    state.nodes   = [];
    state.edges   = [];
    d3.select(mapSvg).selectAll('*').remove();
    emptyState.style.display = 'flex';
    mapSvg.style.display = 'none';
    detailPanel.innerHTML = '<div class="nv-detail-placeholder"><span>Click a node to inspect</span></div>';
    updateStatus();
  });

  locateBtn.addEventListener('click', () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        const exists = state.nodes.find(n => n.id === 'My Location');
        if (!exists) {
          state.nodes.push({
            id: 'My Location',
            ip: 'My Location',
            lat: latitude,
            lng: longitude,
            country: 'Current Location',
            countryCode: 'LOC',
            city: 'Your Device',
            asn: 'Local',
            org: 'Internal',
            isPrivate: true,
            resolved: true,
            connections: 0
          });
          state.edges = buildEdges(state.nodes);
          emptyState.style.display = 'none';
          mapSvg.style.display = 'block';
          updateStatus();
          rerenderActiveView();
        }
      }, () => {
        alert("Unable to retrieve your location.");
      });
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  });

  exportBtn.addEventListener('click', () => {
    const data = {
      exportedAt: new Date().toISOString(),
      nodes: state.nodes,
      edges: state.edges,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `network-map-${Date.now()}.json`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // Re-render on resize
  const ro = new ResizeObserver(() => rerenderActiveView());
  ro.observe(container);
}
