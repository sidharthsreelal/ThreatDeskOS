// src/api/ticker.ts — CISA KEV + GitHub Advisories

export interface TickerItem {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  source: string;
  title: string;
  time: string;
  link: string;
}

export async function fetchCisaKev(): Promise<TickerItem[]> {
  const res = await fetch(
    'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json'
  );
  if (!res.ok) throw new Error(`CISA fetch failed: ${res.status}`);
  const data = await res.json();
  return (data.vulnerabilities as Array<Record<string, string>>).slice(0, 40).map(v => ({
    id: v.cveID,
    severity: 'CRITICAL' as const,
    source: 'CISA KEV',
    title: `${v.cveID} — ${v.vendorProject} ${v.product}: ${v.vulnerabilityName}`,
    time: v.dateAdded,
    link: `https://nvd.nist.gov/vuln/detail/${v.cveID}`,
  }));
}

export async function fetchGithubAdvisories(): Promise<TickerItem[]> {
  const res = await fetch('https://api.github.com/advisories?per_page=20');
  if (!res.ok) throw new Error(`GitHub advisories failed: ${res.status}`);
  const data = (await res.json()) as Array<Record<string, unknown>>;
  return data.map(a => ({
    id: a.ghsa_id as string,
    severity: (
      ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(
        ((a.severity as string) ?? '').toUpperCase()
      )
        ? ((a.severity as string).toUpperCase() as TickerItem['severity'])
        : 'MEDIUM'
    ),
    source: 'GitHub Advisory',
    title: a.summary as string,
    time: a.published_at as string,
    link: a.html_url as string,
  }));
}

export async function fetchAll(): Promise<TickerItem[]> {
  const [cisa, gh] = await Promise.allSettled([fetchCisaKev(), fetchGithubAdvisories()]);
  const items: TickerItem[] = [];
  if (cisa.status === 'fulfilled') items.push(...cisa.value);
  if (gh.status === 'fulfilled') items.push(...gh.value);
  return items.sort(() => Math.random() - 0.5);
}
