# APP PROMPT — Network Visualiser
### ThreatDesk OS | Tool: Antigravity | App ID: `network-visualiser`

---

## CONTEXT

You are adding the **Network Visualiser** app to ThreatDesk OS. This is a standalone app module that follows the exact same patterns as every other ThreatDesk OS app — it exports a single `mount(container: HTMLElement): void` function, uses only the ThreatDesk CSS token system (`var(--*)`), uses the Aberdeen Red theme, and has zero external dependencies except D3.js (loaded from CDN).

The app lives at `src/apps/NetworkVisualiser/index.ts` and `src/apps/NetworkVisualiser/styles.css`. Register it in `src/apps/registry.ts` with:

```typescript
{ id:'network-visualiser', title:'NETWORK VISUALISER', icon:'🕸️', defaultWidth:900, defaultHeight:680, minWidth:700, minHeight:500, mount }
```

---

## WHAT THIS APP DOES

The Network Visualiser takes a list of IP addresses or a CIDR range as input, fetches geolocation and ASN data for each IP, and renders two simultaneous views:

1. **Force-directed graph** — nodes are IPs, edges connect IPs that share the same ASN or subnet. Node size scales with how many connections it has. Built with D3 force simulation.
2. **World map** — a flat SVG world map with dots placed at each IP's lat/lng coordinates. Arcs drawn between IPs in the same group. Colour-coded by country.

Both views live in the same window — the user toggles between them with a tab bar at the top. The graph and map update live as IPs are resolved.

---

## TECH STACK FOR THIS APP

- **D3.js v7** — force simulation for the graph, geographic projection for the map
- Load from CDN in `index.ts` via dynamic import:
```typescript
// Load D3 from CDN — ThreatDesk OS has no bundled D3
const d3 = await import('https://cdn.jsdelivr.net/npm/d3@7/+esm');
```
- **ipapi.co** — geolocation + ASN per IP (free, 60 req/hr, no key)
- **CIDR parsing** — pure TypeScript, no library
- All rendering on `<svg>` elements, no `<canvas>`

---

## FULL IMPLEMENTATION

### Data Types

```typescript
// src/apps/NetworkVisualiser/types.ts

export interface IPNode {
  id:           string;   // the IP address
  ip:           string;
  lat:          number | null;
  lng:          number | null;
  country:      string;
  countryCode:  string;   // ISO 2-letter
  city:         string;
  asn:          string;   // e.g. "AS15169"
  org:          string;   // e.g. "Google LLC"
  isPrivate:    boolean;
  resolved:     boolean;  // false while geo lookup is in progress
  connections:  number;   // degree — how many edges touch this node
}

export interface IPEdge {
  source: string;   // IP string
  target: string;
  reason: 'same-asn' | 'same-subnet' | 'same-country';
}

export interface VisualisationState {
  nodes:      IPNode[];
  edges:      IPEdge[];
  loading:    Set<string>;   // IPs currently being resolved
  errors:     Map<string, string>; // IP → error message
  activeView: 'graph' | 'map';
  selectedIP: string | null;
}
```

### CIDR Parser

```typescript
// src/apps/NetworkVisualiser/cidr.ts

export function parseCIDR(cidr: string): string[] {
  const [base, prefix] = cidr.trim().split('/');
  if (!prefix) return [base.trim()];

  const prefixLen = parseInt(prefix, 10);
  if (isNaN(prefixLen) || prefixLen < 16 || prefixLen > 32) {
    throw new Error(`CIDR prefix must be between /16 and /32 (got /${prefix}). Larger ranges would generate too many IPs.`);
  }

  const parts   = base.split('.').map(Number);
  const baseInt = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
  const mask    = ~((1 << (32 - prefixLen)) - 1);
  const network = baseInt & mask;
  const count   = Math.pow(2, 32 - prefixLen);

  // Hard cap — never generate more than 256 IPs
  const limit = Math.min(count, 256);
  const ips: string[] = [];

  for (let i = 1; i < limit - 1; i++) {
    const n = network + i;
    ips.push(`${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`);
  }

  return ips;
}

export function parseInput(raw: string): string[] {
  const lines = raw.split(/[\n,\s]+/).map(s => s.trim()).filter(Boolean);
  const ips: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const expanded = line.includes('/') ? parseCIDR(line) : [line];
    for (const ip of expanded) {
      if (isValidIP(ip) && !seen.has(ip)) {
        ips.push(ip);
        seen.add(ip);
      }
    }
  }

  return ips.slice(0, 100); // Global cap — 100 IPs max
}

export function isValidIP(ip: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) &&
    ip.split('.').every(o => parseInt(o) <= 255);
}

export function isPrivateIP(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  return a === 10
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || a === 127;
}

export function getSubnet24(ip: string): string {
  return ip.split('.').slice(0, 3).join('.');
}
```

### Geo Lookup

```typescript
// src/apps/NetworkVisualiser/geo.ts

import type { IPNode } from './types';

const GEO_BASE = 'https://ipapi.co';
const RATE_MS  = 1100; // ipapi.co allows ~60/hr → ~1 per second to be safe

let lastCallTime = 0;

async function rateLimit(): Promise<void> {
  const now  = Date.now();
  const wait = RATE_MS - (now - lastCallTime);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastCallTime = Date.now();
}

export async function resolveIP(ip: string): Promise<Partial<IPNode>> {
  if (isPrivateIP(ip)) {
    return {
      ip, lat: null, lng: null,
      country: 'Private Network', countryCode: 'XX',
      city: 'LAN', asn: 'RFC1918', org: 'Private',
      isPrivate: true, resolved: true,
    };
  }

  await rateLimit();

  try {
    const res  = await fetch(`${GEO_BASE}/${encodeURIComponent(ip)}/json/`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.error) throw new Error(data.reason ?? 'Unknown error');

    return {
      ip,
      lat:         typeof data.latitude  === 'number' ? data.latitude  : null,
      lng:         typeof data.longitude === 'number' ? data.longitude : null,
      country:     data.country_name  ?? 'Unknown',
      countryCode: data.country_code  ?? 'XX',
      city:        data.city          ?? 'Unknown',
      asn:         data.asn           ?? 'Unknown',
      org:         data.org           ?? 'Unknown',
      isPrivate:   false,
      resolved:    true,
    };
  } catch (err) {
    return {
      ip, lat: null, lng: null,
      country: 'Unknown', countryCode: 'XX',
      city: 'Unknown', asn: 'Unknown', org: 'Unknown',
      isPrivate: false, resolved: true,
    };
  }
}

function isPrivateIP(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || (a===172&&b>=16&&b<=31) || (a===192&&b===168) || a===127;
}
```

### Edge Builder

```typescript
// src/apps/NetworkVisualiser/edges.ts

import type { IPNode, IPEdge } from './types';
import { getSubnet24 } from './cidr';

export function buildEdges(nodes: IPNode[]): IPEdge[] {
  const edges: IPEdge[] = [];
  const resolved = nodes.filter(n => n.resolved);

  for (let i = 0; i < resolved.length; i++) {
    for (let j = i + 1; j < resolved.length; j++) {
      const a = resolved[i], b = resolved[j];

      // Same ASN — strongest relationship
      if (a.asn && b.asn && a.asn === b.asn && a.asn !== 'Unknown') {
        edges.push({ source: a.ip, target: b.ip, reason: 'same-asn' });
        continue;
      }

      // Same /24 subnet
      if (!a.isPrivate && !b.isPrivate &&
          getSubnet24(a.ip) === getSubnet24(b.ip)) {
        edges.push({ source: a.ip, target: b.ip, reason: 'same-subnet' });
        continue;
      }

      // Same country — loosest relationship, only add if no other edges for these nodes yet
      if (a.countryCode === b.countryCode && a.countryCode !== 'XX') {
        const alreadyConnected = edges.some(
          e => (e.source === a.ip || e.target === a.ip) &&
               (e.source === b.ip || e.target === b.ip)
        );
        if (!alreadyConnected) {
          edges.push({ source: a.ip, target: b.ip, reason: 'same-country' });
        }
      }
    }
  }

  return edges;
}
```

### Colour System

```typescript
// src/apps/NetworkVisualiser/colours.ts

// Country → hue mapping — consistent colour per country across both views
const COUNTRY_HUES = new Map<string, number>();
let hueCounter = 0;
const HUE_STEP = 37; // Golden angle approximation — maximises colour distance

export function getCountryColour(countryCode: string): string {
  if (countryCode === 'XX') return '#4A4248'; // Private/unknown — muted
  if (!COUNTRY_HUES.has(countryCode)) {
    COUNTRY_HUES.set(countryCode, (hueCounter * HUE_STEP) % 360);
    hueCounter++;
  }
  const hue = COUNTRY_HUES.get(countryCode)!;
  return `hsl(${hue}, 65%, 55%)`;
}

export const EDGE_COLOURS: Record<string, string> = {
  'same-asn':     'rgba(232, 0, 31, 0.7)',   // Aberdeen red — strongest
  'same-subnet':  'rgba(255, 165, 0, 0.5)',   // Orange — medium
  'same-country': 'rgba(77, 166, 255, 0.25)', // Blue — weakest
};

export const EDGE_WIDTHS: Record<string, number> = {
  'same-asn':     2.5,
  'same-subnet':  1.5,
  'same-country': 0.75,
};
```

### Force Graph Renderer

```typescript
// src/apps/NetworkVisualiser/ForceGraph.ts

import type { IPNode, IPEdge } from './types';
import { getCountryColour, EDGE_COLOURS, EDGE_WIDTHS } from './colours';

export function renderForceGraph(
  svg: SVGSVGElement,
  nodes: IPNode[],
  edges: IPEdge[],
  d3: any,
  onNodeClick: (ip: string) => void
): () => void {   // Returns a cleanup function

  const W = svg.clientWidth, H = svg.clientHeight;
  const sel = d3.select(svg);
  sel.selectAll('*').remove();

  // Defs — arrowhead marker in Aberdeen red
  const defs = sel.append('defs');
  defs.append('marker')
    .attr('id', 'arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 20).attr('refY', 0)
    .attr('markerWidth', 6).attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', 'rgba(192,0,26,0.6)');

  // Groups — edges below nodes
  const edgeGroup = sel.append('g').attr('class', 'edges');
  const nodeGroup = sel.append('g').attr('class', 'nodes');

  // D3 simulation nodes need x/y mutated in place
  const simNodes = nodes.map(n => ({ ...n, x: W/2 + (Math.random()-0.5)*200, y: H/2 + (Math.random()-0.5)*200 }));
  const simEdges = edges.map(e => ({ ...e }));

  const nodeById = new Map(simNodes.map(n => [n.ip, n]));

  const simulation = d3.forceSimulation(simNodes)
    .force('link', d3.forceLink(simEdges)
      .id((d: any) => d.ip)
      .distance((e: any) => e.reason === 'same-asn' ? 80 : e.reason === 'same-subnet' ? 120 : 180)
      .strength((e: any) => e.reason === 'same-asn' ? 0.8 : e.reason === 'same-subnet' ? 0.5 : 0.2))
    .force('charge', d3.forceManyBody().strength(-160))
    .force('center', d3.forceCenter(W/2, H/2))
    .force('collision', d3.forceCollide().radius(28));

  // Edges
  const edgeSel = edgeGroup.selectAll('line')
    .data(simEdges).enter().append('line')
    .attr('stroke',       (e: any) => EDGE_COLOURS[e.reason])
    .attr('stroke-width', (e: any) => EDGE_WIDTHS[e.reason]);

  // Node groups
  const nodeSel = nodeGroup.selectAll('g')
    .data(simNodes).enter().append('g')
    .attr('class', 'node')
    .style('cursor', 'pointer')
    .call(d3.drag()
      .on('start', (event: any, d: any) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag',  (event: any, d: any) => { d.fx = event.x; d.fy = event.y; })
      .on('end',   (event: any, d: any) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }))
    .on('click', (_: any, d: any) => onNodeClick(d.ip));

  // Node circle — radius scales with connection degree
  nodeSel.append('circle')
    .attr('r',    (d: any) => 8 + Math.min(d.connections * 2, 14))
    .attr('fill', (d: any) => d.resolved ? getCountryColour(d.countryCode) : '#4A4248')
    .attr('stroke',       (d: any) => d.isPrivate ? '#FFA500' : 'rgba(240,234,232,0.15)')
    .attr('stroke-width', 1.5);

  // Unresolved spinner ring
  nodeSel.filter((d: any) => !d.resolved)
    .append('circle')
    .attr('r', 14)
    .attr('fill', 'none')
    .attr('stroke', 'var(--red-mid)')
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '4 4')
    .attr('class', 'spinner-ring');

  // IP label
  nodeSel.append('text')
    .text((d: any) => d.ip)
    .attr('dy', (d: any) => -(10 + Math.min(d.connections * 2, 14)))
    .attr('text-anchor', 'middle')
    .attr('font-family', "'Share Tech Mono', monospace")
    .attr('font-size', '10px')
    .attr('fill', 'var(--text-2)')
    .attr('pointer-events', 'none');

  // Tick
  simulation.on('tick', () => {
    edgeSel
      .attr('x1', (e: any) => e.source.x)
      .attr('y1', (e: any) => e.source.y)
      .attr('x2', (e: any) => e.target.x)
      .attr('y2', (e: any) => e.target.y);
    nodeSel.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
  });

  // Zoom + pan
  sel.call(d3.zoom()
    .scaleExtent([0.3, 4])
    .on('zoom', (event: any) => {
      edgeGroup.attr('transform', event.transform);
      nodeGroup.attr('transform', event.transform);
    }));

  return () => simulation.stop();
}
```

### World Map Renderer

```typescript
// src/apps/NetworkVisualiser/WorldMap.ts

import type { IPNode, IPEdge } from './types';
import { getCountryColour, EDGE_COLOURS } from './colours';

// Natural Earth simplified GeoJSON — fetch from CDN
const WORLD_GEOJSON = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

export async function renderWorldMap(
  svg: SVGSVGElement,
  nodes: IPNode[],
  edges: IPEdge[],
  d3: any,
  topojson: any,
  onNodeClick: (ip: string) => void
): Promise<void> {

  const W = svg.clientWidth, H = svg.clientHeight;
  const sel = d3.select(svg);
  sel.selectAll('*').remove();

  // Load world topology
  const world    = await fetch(WORLD_GEOJSON).then(r => r.json());
  const countries = topojson.feature(world, world.objects.countries);

  // Equirectangular projection — simple, recognisable
  const projection = d3.geoEquirectangular()
    .scale(W / (2 * Math.PI))
    .translate([W / 2, H / 2]);

  const path = d3.geoPath().projection(projection);

  // Draw land — very dark fill, dim red border
  sel.append('g').attr('class', 'land')
    .selectAll('path')
    .data(countries.features)
    .enter().append('path')
    .attr('d', path)
    .attr('fill',   '#0E0E14')
    .attr('stroke', 'rgba(192,0,26,0.15)')
    .attr('stroke-width', 0.5);

  // Graticule (grid lines)
  sel.append('path')
    .datum(d3.geoGraticule()())
    .attr('d', path)
    .attr('fill',   'none')
    .attr('stroke', 'rgba(192,0,26,0.06)')
    .attr('stroke-width', 0.5);

  const resolved = nodes.filter(n => n.resolved && n.lat !== null && n.lng !== null);

  // Draw arcs between same-ASN nodes
  const asnEdges = edges.filter(e => e.reason === 'same-asn');
  const nodeById = new Map(resolved.map(n => [n.ip, n]));

  sel.append('g').attr('class', 'arcs')
    .selectAll('path')
    .data(asnEdges)
    .enter().append('path')
    .attr('d', (e: any) => {
      const a = nodeById.get(e.source), b = nodeById.get(e.target);
      if (!a || !b || a.lat === null || b.lat === null) return null;
      const [x1, y1] = projection([a.lng!, a.lat!]) ?? [0, 0];
      const [x2, y2] = projection([b.lng!, b.lat!]) ?? [0, 0];
      const mx = (x1 + x2) / 2, my = Math.min(y1, y2) - 40;
      return `M${x1},${y1} Q${mx},${my} ${x2},${y2}`;
    })
    .attr('fill',   'none')
    .attr('stroke', EDGE_COLOURS['same-asn'])
    .attr('stroke-width', 1.5);

  // IP dots
  const dotGroup = sel.append('g').attr('class', 'dots');

  resolved.forEach(n => {
    const [x, y] = projection([n.lng!, n.lat!]) ?? [0, 0];
    const g = dotGroup.append('g')
      .attr('transform', `translate(${x},${y})`)
      .style('cursor', 'pointer')
      .on('click', () => onNodeClick(n.ip));

    // Outer glow ring
    g.append('circle')
      .attr('r', 8)
      .attr('fill', getCountryColour(n.countryCode))
      .attr('opacity', 0.2);

    // Inner dot
    g.append('circle')
      .attr('r', 4)
      .attr('fill', getCountryColour(n.countryCode))
      .attr('stroke', 'rgba(240,234,232,0.3)')
      .attr('stroke-width', 1);

    // Tooltip on hover
    g.on('mouseover', function(this: SVGGElement) {
      d3.select(this).select('circle:last-of-type').attr('r', 6);
    }).on('mouseout', function(this: SVGGElement) {
      d3.select(this).select('circle:last-of-type').attr('r', 4);
    });
  });

  // Zoom + pan
  sel.call(d3.zoom()
    .scaleExtent([0.5, 8])
    .on('zoom', (event: any) => {
      sel.selectAll('g').attr('transform', event.transform);
    }));
}
```

### IP Detail Panel

```typescript
// src/apps/NetworkVisualiser/DetailPanel.ts

import type { IPNode } from './types';
import { getCountryColour } from './colours';

export function renderDetailPanel(container: HTMLElement, node: IPNode): void {
  container.innerHTML = `
    <div class="detail-panel">
      <div class="detail-header">
        <div class="detail-dot" style="background:${getCountryColour(node.countryCode)}"></div>
        <span class="detail-ip">${node.ip}</span>
        ${node.isPrivate ? '<span class="detail-badge private">PRIVATE</span>' : ''}
      </div>

      <div class="detail-grid">
        <div class="detail-row">
          <span class="detail-label">COUNTRY</span>
          <span class="detail-value">${node.country} (${node.countryCode})</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">CITY</span>
          <span class="detail-value">${node.city || '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">ASN</span>
          <span class="detail-value mono">${node.asn || '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">ORG</span>
          <span class="detail-value">${node.org || '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">COORDINATES</span>
          <span class="detail-value mono">
            ${node.lat !== null ? `${node.lat.toFixed(4)}, ${node.lng!.toFixed(4)}` : 'Unavailable'}
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">CONNECTIONS</span>
          <span class="detail-value">${node.connections}</span>
        </div>
      </div>

      <a class="detail-link" href="https://www.shodan.io/host/${node.ip}" target="_blank" rel="noopener">
        View on Shodan →
      </a>
    </div>
  `;
}
```

### Main Mount Function

```typescript
// src/apps/NetworkVisualiser/index.ts

import { parseInput } from './cidr';
import { resolveIP } from './geo';
import { buildEdges } from './edges';
import { renderForceGraph } from './ForceGraph';
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
    activeView: 'graph',
    selectedIP: null,
  };

  let graphCleanup: (() => void) | null = null;

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
          <button id="nv-clear-btn" class="nv-btn-ghost">CLEAR</button>
        </div>

        <div class="nv-tabs">
          <button class="nv-tab active" data-view="graph">FORCE GRAPH</button>
          <button class="nv-tab"        data-view="map">WORLD MAP</button>
        </div>

        <div class="nv-legend">
          <span class="nv-legend-item"><span class="nv-dot" style="background:var(--sev-critical)"></span>Same ASN</span>
          <span class="nv-legend-item"><span class="nv-dot" style="background:var(--warning)"></span>Same /24</span>
          <span class="nv-legend-item"><span class="nv-dot" style="background:var(--info)"></span>Same Country</span>
          <span class="nv-legend-item"><span class="nv-dot" style="background:var(--warning);opacity:0.6"></span>Private IP</span>
        </div>
      </div>

      <div class="nv-main">
        <div class="nv-canvas-wrap">
          <svg id="nv-graph-svg" class="nv-svg"></svg>
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
  const tabs          = container.querySelectorAll('.nv-tab')          as NodeListOf<HTMLButtonElement>;
  const graphSvg      = container.querySelector('#nv-graph-svg')       as SVGSVGElement;
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

    if (state.activeView === 'graph') {
      graphCleanup?.();
      graphCleanup = renderForceGraph(graphSvg, state.nodes, state.edges, d3, handleNodeClick);
    } else {
      renderWorldMap(mapSvg, state.nodes, state.edges, d3, topojson, handleNodeClick);
    }
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
    graphCleanup?.();
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
    graphSvg.style.display       = state.activeView === 'graph' ? 'block' : 'none';
    mapSvg.style.display         = state.activeView === 'map'   ? 'block' : 'none';

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
    graphCleanup?.();
    d3.select(graphSvg).selectAll('*').remove();
    d3.select(mapSvg).selectAll('*').remove();
    emptyState.style.display = 'flex';
    detailPanel.innerHTML = '<div class="nv-detail-placeholder"><span>Click a node to inspect</span></div>';
    updateStatus();
  });

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeView = tab.dataset.view as 'graph' | 'map';
      graphSvg.style.display = state.activeView === 'graph' ? 'block' : 'none';
      mapSvg.style.display   = state.activeView === 'map'   ? 'block' : 'none';
      rerenderActiveView();
    });
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
```

---

## STYLES — `src/apps/NetworkVisualiser/styles.css`

```css
/* Layout */
.nv-root {
  display: flex; flex-direction: column; height: 100%;
  font-family: 'IBM Plex Sans', sans-serif; color: var(--text-1);
}

.nv-toolbar {
  flex-shrink: 0; padding: 16px 20px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-window); display: flex; flex-direction: column; gap: 10px;
}

.nv-input-row { display: flex; gap: 8px; align-items: flex-end; }

.nv-ip-textarea {
  flex: 1; background: var(--bg-input);
  border: 1px solid var(--border); border-radius: var(--r-md);
  color: var(--text-1); font-family: 'Share Tech Mono', monospace; font-size: 12px;
  padding: 10px 12px; resize: none;
  transition: border-color 0.15s;
}
.nv-ip-textarea:focus { outline: none; border-color: var(--border-bright); }
.nv-ip-textarea::placeholder { color: var(--text-3); }

.nv-btn-primary {
  background: var(--red-mid); border: none; border-radius: var(--r-md);
  color: white; font-family: 'Rajdhani', sans-serif; font-weight: 600;
  font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase;
  padding: 10px 20px; cursor: pointer; white-space: nowrap; transition: background 0.15s;
}
.nv-btn-primary:hover    { background: var(--red-bright); }
.nv-btn-primary:disabled { background: var(--text-3); cursor: not-allowed; }

.nv-btn-ghost {
  background: transparent; border: 1px solid var(--border); border-radius: var(--r-md);
  color: var(--text-2); font-family: 'Rajdhani', sans-serif; font-weight: 600;
  font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase;
  padding: 10px 16px; cursor: pointer; transition: border-color 0.15s, color 0.15s;
}
.nv-btn-ghost:hover { border-color: var(--border-bright); color: var(--text-1); }

.nv-tabs { display: flex; gap: 4px; }

.nv-tab {
  background: transparent; border: 1px solid var(--border); border-radius: var(--r-sm);
  color: var(--text-2); font-family: 'Rajdhani', sans-serif; font-weight: 600;
  font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase;
  padding: 6px 16px; cursor: pointer; transition: all 0.15s;
}
.nv-tab:hover  { border-color: var(--border-bright); color: var(--text-1); }
.nv-tab.active {
  background: var(--red-subtle); border-color: var(--red-mid);
  color: var(--text-1);
}

.nv-legend { display: flex; gap: 16px; align-items: center; }
.nv-legend-item {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: var(--text-2); font-family: 'IBM Plex Sans', sans-serif;
}
.nv-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}

/* Canvas area */
.nv-main {
  flex: 1; display: flex; overflow: hidden; min-height: 0;
}

.nv-canvas-wrap {
  flex: 1; position: relative; overflow: hidden; background: var(--bg-surface);
}

.nv-svg { position: absolute; inset: 0; width: 100%; height: 100%; }

.nv-empty {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 10px;
  color: var(--text-3); font-family: 'IBM Plex Sans', sans-serif;
}
.nv-empty-icon { font-size: 48px; opacity: 0.3; }
.nv-empty p    { font-size: 14px; margin: 0; text-align: center; }
.nv-empty-sub  { font-size: 12px !important; opacity: 0.6; }

/* Loading overlay */
.nv-loading {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 12px;
  background: rgba(6,6,8,0.6); backdrop-filter: blur(4px);
}
.nv-loading-bar {
  width: 240px; height: 3px; background: var(--bg-raised); border-radius: 99px; overflow: hidden;
}
.nv-loading-fill {
  height: 100%; background: var(--grad-bar); border-radius: 99px;
  transition: width 0.3s ease; width: 0%;
}
.nv-loading-text {
  font-family: 'Share Tech Mono', monospace; font-size: 12px; color: var(--text-2);
}

/* Detail panel */
.nv-detail {
  width: 240px; flex-shrink: 0; border-left: 1px solid var(--border);
  background: var(--bg-window); overflow-y: auto; padding: 16px;
}
.nv-detail-placeholder {
  height: 100%; display: flex; align-items: center; justify-content: center;
  color: var(--text-3); font-size: 12px; text-align: center;
}
.detail-panel { display: flex; flex-direction: column; gap: 14px; }
.detail-header { display: flex; align-items: center; gap: 8px; }
.detail-dot    { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.detail-ip     { font-family: 'Share Tech Mono', monospace; font-size: 14px; color: var(--text-1); }
.detail-badge  {
  font-size: 10px; font-family: 'Rajdhani', sans-serif; font-weight: 600;
  letter-spacing: 0.08em; padding: 2px 6px; border-radius: var(--r-sm); text-transform: uppercase;
}
.detail-badge.private { background: rgba(255,165,0,0.15); color: var(--warning); border: 1px solid rgba(255,165,0,0.3); }
.detail-grid { display: flex; flex-direction: column; gap: 8px; }
.detail-row  { display: flex; flex-direction: column; gap: 2px; }
.detail-label { font-size: 10px; color: var(--text-3); font-family: 'Rajdhani', sans-serif; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }
.detail-value { font-size: 13px; color: var(--text-1); word-break: break-all; }
.detail-value.mono { font-family: 'Share Tech Mono', monospace; font-size: 12px; color: var(--text-code); }
.detail-link  {
  font-size: 12px; font-family: 'Rajdhani', sans-serif; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--text-red); text-decoration: none; transition: opacity 0.15s;
}
.detail-link:hover { opacity: 0.75; }

/* Status bar */
.nv-statusbar {
  flex-shrink: 0; height: 28px; display: flex; align-items: center; gap: 8px;
  padding: 0 20px; border-top: 1px solid var(--border); background: var(--bg-window);
  font-family: 'Share Tech Mono', monospace; font-size: 11px; color: var(--text-3);
}
.nv-sep { color: var(--border-bright); }
.nv-btn-link {
  background: none; border: none; cursor: pointer; margin-left: auto;
  font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 11px;
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-2);
  transition: color 0.15s;
}
.nv-btn-link:hover { color: var(--text-red); }

/* D3 spinner ring animation */
@keyframes spin-ring {
  to { stroke-dashoffset: -8; }
}
.spinner-ring {
  animation: spin-ring 0.6s linear infinite;
}

/* Smooth node label fade-in */
.node text { opacity: 0; transition: opacity 0.3s; }
.node:hover text { opacity: 1; }
```

---

## CODING RULES FOR THIS APP

1. D3 and topojson are loaded dynamically via CDN ESM imports — never bundled. The dynamic `import()` must be `await`-ed before any rendering begins.
2. The force simulation must call `.stop()` on cleanup. Always return the cleanup function from `renderForceGraph` and call it before re-rendering.
3. The `ResizeObserver` must be set up so the graph re-renders when the window is resized. Call `rerenderActiveView()` in the observer callback.
4. IP resolution is rate-limited to 1 IP per 1100ms to respect ipapi.co's free tier. Never parallelise geo lookups.
5. The global IP cap is 100. CIDR ranges are capped at 256 and only allowed from /16 to /32. Enforce both limits silently (slice the array) but show the limit in the UI if it was hit.
6. Private IPs (10.x.x.x, 172.16-31.x.x, 192.168.x.x, 127.x.x.x) are handled locally — no geo lookup, shown in amber as "Private Network".
7. The graph re-renders progressively — every time an IP resolves, call `rerenderActiveView()`. The user sees the graph grow in real-time.
8. Country colours are assigned once per country code via the golden-angle hue-stepping algorithm in `colours.ts` — always consistent across graph and map views.
9. SVG zoom + pan must be applied to both the graph and map views using `d3.zoom()`. Scale extents: graph 0.3–4, map 0.5–8.
10. The EXPORT JSON button downloads the full node + edge state as a timestamped JSON file using a Blob URL — no server, no libraries.
