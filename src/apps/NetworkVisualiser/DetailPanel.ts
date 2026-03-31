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
