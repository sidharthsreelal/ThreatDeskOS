// src/api/nvd.ts

export async function fetchCVEs(params: {
  keywordSearch?: string;
  cvssV3Severity?: string;
  resultsPerPage?: number;
  startIndex?: number;
}): Promise<{ vulnerabilities: { cve: Record<string, unknown> }[]; totalResults: number }> {
  const url = new URL('https://services.nvd.nist.gov/rest/json/cves/2.0');
  url.searchParams.set('resultsPerPage', String(params.resultsPerPage ?? 20));
  url.searchParams.set('startIndex', String(params.startIndex ?? 0));
  if (params.keywordSearch) url.searchParams.set('keywordSearch', params.keywordSearch);
  if (params.cvssV3Severity) url.searchParams.set('cvssV3Severity', params.cvssV3Severity);

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });
  if (res.status === 429) throw new Error('Rate limited — wait 30 seconds');
  if (!res.ok) throw new Error(`NVD error ${res.status}`);
  return res.json();
}

export function cvssScore(
  cve: Record<string, unknown>
): { score: number; severity: string } | null {
  const metrics = cve.metrics as Record<string, unknown> | undefined;
  if (!metrics) return null;
  const v31 = (metrics.cvssMetricV31 as Array<Record<string, unknown>>)?.[0]?.cvssData as
    | Record<string, unknown>
    | undefined;
  if (v31) return { score: v31.baseScore as number, severity: v31.baseSeverity as string };
  const v2 = (metrics.cvssMetricV2 as Array<Record<string, unknown>>)?.[0]?.cvssData as
    | Record<string, unknown>
    | undefined;
  if (v2) return { score: v2.baseScore as number, severity: v2.baseSeverity as string };
  return null;
}

export function severityColour(score: number): string {
  if (score >= 9) return 'var(--sev-critical)';
  if (score >= 7) return 'var(--sev-high)';
  if (score >= 4) return 'var(--sev-medium)';
  if (score > 0) return 'var(--sev-low)';
  return 'var(--sev-none)';
}
