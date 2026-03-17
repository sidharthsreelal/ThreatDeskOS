// src/apps/CveRadar/index.ts
import { fetchCVEs, cvssScore, severityColour } from '../../api/nvd';
import './styles.css';

export function mount(container: HTMLElement): void {
  container.innerHTML = `<div class="cr-container">
    <div class="cr-search-row">
      <input class="input" type="text" placeholder="Search CVEs (e.g. apache, log4j, windows)..." id="cr-search" />
      <button class="btn btn-primary" id="cr-search-btn">SEARCH</button>
    </div>
    <div class="cr-filters" id="cr-filters">
      <button class="pill active" data-sev="">ALL</button>
      <button class="pill" data-sev="CRITICAL">CRITICAL</button>
      <button class="pill" data-sev="HIGH">HIGH</button>
      <button class="pill" data-sev="MEDIUM">MEDIUM</button>
      <button class="pill" data-sev="LOW">LOW</button>
    </div>
    <div class="cr-refresh-bar">
      <span id="cr-timer">Auto-refresh in 5:00</span>
      <button class="btn" id="cr-refresh-btn" style="padding:4px 10px;font-size:11px">↻ REFRESH</button>
    </div>
    <div id="cr-results"></div>
    <div class="cr-pagination" id="cr-pagination" style="display:none">
      <button class="btn" id="cr-prev" style="padding:4px 12px">← PREV</button>
      <span class="cr-pagination-info" id="cr-page-info"></span>
      <button class="btn" id="cr-next" style="padding:4px 12px">NEXT →</button>
    </div>
  </div>`;

  let keyword = '';
  let severity = '';
  let startIndex = 0;
  const perPage = 20;
  let totalResults = 0;
  let refreshTimer: ReturnType<typeof setInterval> | null = null;
  let countdown = 300;

  const searchInput = container.querySelector('#cr-search') as HTMLInputElement;
  const searchBtn = container.querySelector('#cr-search-btn') as HTMLButtonElement;
  const filters = container.querySelectorAll('#cr-filters .pill');
  const resultsEl = container.querySelector('#cr-results') as HTMLElement;
  const pagination = container.querySelector('#cr-pagination') as HTMLElement;
  const prevBtn = container.querySelector('#cr-prev') as HTMLButtonElement;
  const nextBtn = container.querySelector('#cr-next') as HTMLButtonElement;
  const pageInfo = container.querySelector('#cr-page-info') as HTMLElement;
  const timerEl = container.querySelector('#cr-timer') as HTMLElement;
  const refreshBtn = container.querySelector('#cr-refresh-btn') as HTMLButtonElement;

  searchBtn.addEventListener('click', () => {
    keyword = searchInput.value.trim();
    startIndex = 0;
    doFetch();
  });
  searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') searchBtn.click(); });

  filters.forEach(f => {
    f.addEventListener('click', () => {
      filters.forEach(p => p.classList.remove('active'));
      f.classList.add('active');
      severity = (f as HTMLElement).dataset.sev ?? '';
      startIndex = 0;
      doFetch();
    });
  });

  prevBtn.addEventListener('click', () => { startIndex = Math.max(0, startIndex - perPage); doFetch(); });
  nextBtn.addEventListener('click', () => { startIndex += perPage; doFetch(); });
  refreshBtn.addEventListener('click', () => { startIndex = 0; doFetch(); });

  function startTimer(): void {
    if (refreshTimer) clearInterval(refreshTimer);
    countdown = 300;
    refreshTimer = setInterval(() => {
      countdown--;
      const m = Math.floor(countdown / 60);
      const s = countdown % 60;
      timerEl.textContent = `Auto-refresh in ${m}:${String(s).padStart(2, '0')}`;
      if (countdown <= 0) { startIndex = 0; doFetch(); }
    }, 1000);
  }

  async function doFetch(): Promise<void> {
    resultsEl.innerHTML = '<div class="cr-status"><div class="spinner" style="margin:0 auto"></div></div>';
    pagination.style.display = 'none';

    try {
      const data = await fetchCVEs({
        keywordSearch: keyword || undefined,
        cvssV3Severity: severity || undefined,
        resultsPerPage: perPage,
        startIndex,
      });
      totalResults = data.totalResults;

      if (data.vulnerabilities.length === 0) {
        resultsEl.innerHTML = '<div class="cr-status">No CVEs found.</div>';
      } else {
        resultsEl.innerHTML = data.vulnerabilities.map(v => renderCve(v.cve)).join('');
      }

      // Pagination
      if (totalResults > perPage) {
        pagination.style.display = 'flex';
        const currentPage = Math.floor(startIndex / perPage) + 1;
        const totalPages = Math.ceil(totalResults / perPage);
        pageInfo.textContent = `${currentPage} / ${totalPages} (${totalResults.toLocaleString()} results)`;
        prevBtn.disabled = startIndex === 0;
        nextBtn.disabled = startIndex + perPage >= totalResults;
      }

      startTimer();
    } catch (err) {
      resultsEl.innerHTML = `<div class="cr-status" style="color:var(--danger)">⚠ ${err instanceof Error ? err.message : 'Fetch error'}</div>`;
      startTimer();
    }
  }

  // Initial load
  doFetch();
}

function renderCve(cve: Record<string, unknown>): string {
  const id = cve.id as string;
  const desc = ((cve.descriptions as Array<Record<string, string>>)?.find(d => d.lang === 'en')?.value ?? 'No description.').slice(0, 250);
  const published = (cve.published as string ?? '').slice(0, 10);
  const cs = cvssScore(cve);
  const cwes = (cve.weaknesses as Array<Record<string, unknown>> ?? [])
    .flatMap((w: Record<string, unknown>) =>
      ((w.description as Array<Record<string, string>>) ?? []).map(d => d.value)
    )
    .filter((v: string) => v !== 'NVD-CWE-noinfo');

  return `<div class="cr-cve-card">
    <div class="cr-cve-header">
      <span class="cr-cve-id"><a href="https://nvd.nist.gov/vuln/detail/${id}" target="_blank" rel="noopener">${id}</a></span>
      ${cs ? `<span class="cr-cvss-badge" style="background:${severityColour(cs.score)}">${cs.score} ${cs.severity}</span>` : ''}
      <span class="cr-cve-date">${published}</span>
    </div>
    <div class="cr-cve-desc">${desc}${desc.length >= 250 ? '…' : ''}</div>
    ${cwes.length ? `<div class="cr-cve-cwe">${cwes.map((c: string) => `<span class="bs-tag">${c}</span>`).join(' ')}</div>` : ''}
  </div>`;
}
