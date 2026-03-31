// src/apps/OsintFootprint/index.ts
import { getAllDNS } from '../../api/dns';
import { shodanLookup } from '../../api/shodan';
import { sslLookup } from '../../api/ssl';
import { geoLookup } from '../../api/geo';
import { detectFlags } from './flags';
import type { RiskFlag } from './flags';
import './styles.css';

interface ScanStep { name: string; status: 'pending' | 'loading' | 'done' | 'error'; }

export function mount(container: HTMLElement): void {
  container.innerHTML = `<div class="os-container">
    <div class="os-input-row">
      <input class="input" type="text" placeholder="Enter domain (e.g. example.com)..." id="os-domain" />
      <button class="btn btn-primary" id="os-scan-btn">RUN RECON</button>
    </div>
    <div id="os-progress" style="display:none"></div>
    <div id="os-flags"></div>
    <div id="os-details" style="display:none">
      <div class="os-detail-tabs">
        <div class="tab-bar" id="os-tabs"></div>
        <div class="os-detail-content" id="os-detail-content"></div>
      </div>
    </div>
    <div class="os-export-row" id="os-export-row" style="display:none">
      <button class="btn" id="os-export-btn">📄 EXPORT REPORT</button>
    </div>
  </div>`;

  const domainInput = container.querySelector('#os-domain') as HTMLInputElement;
  const scanBtn = container.querySelector('#os-scan-btn') as HTMLButtonElement;
  const progressEl = container.querySelector('#os-progress') as HTMLElement;
  const flagsEl = container.querySelector('#os-flags') as HTMLElement;
  const detailsEl = container.querySelector('#os-details') as HTMLElement;
  const tabsEl = container.querySelector('#os-tabs') as HTMLElement;
  const contentEl = container.querySelector('#os-detail-content') as HTMLElement;
  const exportRow = container.querySelector('#os-export-row') as HTMLElement;
  const exportBtn = container.querySelector('#os-export-btn') as HTMLButtonElement;

  let report: Record<string, unknown> = {};

  domainInput.addEventListener('keydown', e => { if (e.key === 'Enter') scanBtn.click(); });

  scanBtn.addEventListener('click', async () => {
    const domain = domainInput.value.trim();
    if (!domain) return;
    report = { domain, scannedAt: Date.now() };

    scanBtn.disabled = true;
    scanBtn.textContent = 'SCANNING...';
    progressEl.style.display = 'block';
    flagsEl.innerHTML = '';
    detailsEl.style.display = 'none';
    exportRow.style.display = 'none';

    const steps: ScanStep[] = [
      { name: 'DNS Records', status: 'pending' },
      { name: 'SSL Certificates', status: 'pending' },
      { name: 'Shodan InternetDB', status: 'pending' },
      { name: 'IP Geolocation', status: 'pending' },
      { name: 'Tech Stack Analysis', status: 'pending' },
    ];
    renderProgress(steps);

    // 1. DNS
    steps[0].status = 'loading'; renderProgress(steps);
    try {
      const dns = await getAllDNS(domain);
      report.dns = dns;
      steps[0].status = 'done';
    } catch { steps[0].status = 'error'; }
    renderProgress(steps);

    // Get IP from DNS A record
    const dns = report.dns as Record<string, string[]> | undefined;
    const ip = dns?.A?.[0] ?? '';

    // 2. SSL
    steps[1].status = 'loading'; renderProgress(steps);
    try {
      const ssl = await sslLookup(domain);
      report.ssl = ssl.slice(0, 10);
      steps[1].status = 'done';
    } catch { steps[1].status = 'error'; }
    renderProgress(steps);

    // 3. Shodan
    steps[2].status = 'loading'; renderProgress(steps);
    if (ip) {
      try {
        const shodan = await shodanLookup(ip);
        report.shodan = shodan;
        steps[2].status = 'done';
      } catch { steps[2].status = 'error'; }
    } else {
      steps[2].status = 'error';
    }
    renderProgress(steps);

    // 4. Geo
    steps[3].status = 'loading'; renderProgress(steps);
    if (ip) {
      try {
        const geo = await geoLookup(ip);
        report.geo = geo;
        steps[3].status = 'done';
      } catch { steps[3].status = 'error'; }
    } else {
      steps[3].status = 'error';
    }
    renderProgress(steps);

    // 5. Tech Stack
    steps[4].status = 'loading'; renderProgress(steps);
    const techStack = detectTechStack(report);
    report.techStack = techStack;
    steps[4].status = 'done';
    renderProgress(steps);

    // Risk flags
    const flags = detectFlags(report);
    report.riskFlags = flags;
    if (flags.length) {
      flagsEl.innerHTML = '<div class="os-section-title">⚠ Risk Flags</div>' +
        flags.map(f => `<div class="os-flag ${f.severity}"><div class="os-flag-title" style="color:var(--sev-${f.severity})">${f.title}</div><div class="os-flag-desc">${f.description}</div></div>`).join('');
    } else {
      flagsEl.innerHTML = '<div class="os-section-title" style="color:var(--success)">✓ No risk flags detected</div>';
    }

    // Detail tabs
    detailsEl.style.display = 'block';
    const detailTabs = ['DNS', 'SSL', 'PORTS', 'GEO'];
    tabsEl.innerHTML = detailTabs.map((t, i) =>
      `<button class="tab-btn ${i === 0 ? 'active' : ''}" data-dtab="${t}">${t}</button>`
    ).join('');
    showDetail('DNS');
    tabsEl.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        tabsEl.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        showDetail((btn as HTMLElement).dataset.dtab ?? 'DNS');
      });
    });

    exportRow.style.display = 'flex';
    scanBtn.disabled = false;
    scanBtn.textContent = 'RUN RECON';
  });

  exportBtn.addEventListener('click', () => {
    const domain = (report.domain as string) ?? 'unknown';
    const md = generateMarkdownReport(report);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${domain}-osint-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  });

  function renderProgress(steps: ScanStep[]): void {
    progressEl.innerHTML = '<div class="os-progress-list">' + steps.map(s => {
      const icon = s.status === 'done' ? '✓' : s.status === 'error' ? '✗' : s.status === 'loading' ? '⟳' : '—';
      return `<div class="os-progress-item ${s.status}"><span class="os-progress-icon">${icon}</span>${s.name}</div>`;
    }).join('') + '</div>';
  }

  function showDetail(tab: string): void {
    switch (tab) {
      case 'DNS': {
        const dns = report.dns as Record<string, string[]> | undefined;
        if (!dns) { contentEl.textContent = 'No DNS data available.'; return; }
        contentEl.textContent = Object.entries(dns)
          .map(([type, records]) => `${type}:\n${(records as string[]).map(r => `  ${r}`).join('\n')}`)
          .join('\n\n');
        break;
      }
      case 'SSL': {
        const ssl = report.ssl as Array<Record<string, unknown>> | undefined;
        if (!ssl?.length) { contentEl.textContent = 'No SSL data available.'; return; }
        contentEl.textContent = ssl.slice(0, 5).map(c =>
          `Issuer: ${c.issuer_name ?? 'Unknown'}\nCommon Name: ${c.common_name ?? 'Unknown'}\nValid: ${c.not_before ?? '?'} → ${c.not_after ?? '?'}\nSANs: ${c.name_value ?? 'N/A'}`
        ).join('\n─────────────────────────\n');
        break;
      }
      case 'PORTS': {
        const shodan = report.shodan as { ports?: number[]; cpes?: string[]; tags?: string[]; hostnames?: string[]; vulns?: string[] } | null;
        if (!shodan) { contentEl.textContent = 'No Shodan data available.'; return; }
        contentEl.textContent = [
          `Open Ports: ${(shodan.ports ?? []).join(', ') || 'None'}`,
          `CPEs: ${(shodan.cpes ?? []).join(', ') || 'None'}`,
          `Tags: ${(shodan.tags ?? []).join(', ') || 'None'}`,
          `Hostnames: ${(shodan.hostnames ?? []).join(', ') || 'None'}`,
          `Vulns: ${(shodan.vulns ?? []).join(', ') || 'None'}`,
        ].join('\n');
        break;
      }
      case 'GEO': {
        const geo = report.geo as Record<string, unknown> | null;
        if (!geo) { contentEl.textContent = 'No geolocation data available.'; return; }
        contentEl.textContent = [
          `IP: ${geo.ip ?? 'Unknown'}`,
          `City: ${geo.city ?? 'Unknown'}`,
          `Region: ${geo.region ?? 'Unknown'}`,
          `Country: ${geo.country_name ?? 'Unknown'}`,
          `ASN: ${geo.asn ?? 'Unknown'}`,
          `ISP: ${geo.org ?? 'Unknown'}`,
          `Latitude: ${geo.latitude ?? '?'}, Longitude: ${geo.longitude ?? '?'}`,
        ].join('\n');
        break;
      }
    }
  }
}

function detectTechStack(report: Record<string, unknown>): string[] {
  const stack: string[] = [];
  const dns = report.dns as Record<string, string[]> | undefined;
  const txt = (dns?.TXT ?? []).join(' ');
  const mx = (dns?.MX ?? []).join(' ').toLowerCase();
  const ns = (dns?.NS ?? []).join(' ').toLowerCase();

  if (txt.includes('google-site-verification') || mx.includes('google')) stack.push('Google Workspace');
  if (mx.includes('outlook') || mx.includes('microsoft')) stack.push('Microsoft 365');
  if (txt.includes('sendgrid')) stack.push('SendGrid');
  if (txt.includes('mailgun')) stack.push('Mailgun');
  if (ns.includes('cloudflare')) stack.push('Cloudflare');
  if (ns.includes('awsdns')) stack.push('AWS Route 53');
  if (txt.includes('v=spf1')) stack.push('SPF Configured');
  if (txt.includes('v=DMARC1')) stack.push('DMARC Configured');

  return stack;
}

function generateMarkdownReport(report: Record<string, unknown>): string {
  const domain = report.domain as string;
  const flags = (report.riskFlags as RiskFlag[]) ?? [];
  const dns = report.dns as Record<string, string[]> | undefined;
  const techStack = (report.techStack as string[]) ?? [];
  const shodan = report.shodan as { ports?: number[]; vulns?: string[] } | null;
  const geo = report.geo as Record<string, unknown> | null;

  let md = `# OSINT Report: ${domain}\n\nGenerated: ${new Date().toISOString()}\n\n`;

  if (flags.length) {
    md += `## Risk Flags\n\n`;
    flags.forEach(f => { md += `- **[${f.severity.toUpperCase()}]** ${f.title}: ${f.description}\n`; });
    md += '\n';
  }

  if (techStack.length) {
    md += `## Tech Stack\n\n${techStack.join(', ')}\n\n`;
  }

  if (dns) {
    md += `## DNS Records\n\n`;
    Object.entries(dns).forEach(([type, records]) => {
      md += `### ${type}\n${(records as string[]).map(r => `- ${r}`).join('\n')}\n\n`;
    });
  }

  if (shodan) {
    md += `## Shodan\n\n- Ports: ${(shodan.ports ?? []).join(', ')}\n- Vulns: ${(shodan.vulns ?? []).join(', ') || 'None'}\n\n`;
  }

  if (geo) {
    md += `## Geolocation\n\n- IP: ${geo.ip}\n- Location: ${geo.city}, ${geo.country_name}\n- ASN: ${geo.asn}\n- ISP: ${geo.org}\n\n`;
  }

  return md;
}
