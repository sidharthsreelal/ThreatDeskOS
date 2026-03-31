// src/api/shodan.ts — InternetDB (no key, free, CORS-OK)

export interface ShodanResult {
  ports: number[];
  cpes: string[];
  tags: string[];
  hostnames: string[];
  vulns: string[];
}

export async function shodanLookup(ip: string): Promise<ShodanResult | null> {
  const res = await fetch(`https://internetdb.shodan.io/${ip}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Shodan error ${res.status}`);
  return res.json();
}
