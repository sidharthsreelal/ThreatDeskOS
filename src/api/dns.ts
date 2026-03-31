// src/api/dns.ts — Cloudflare DoH (no key, CORS-OK)

const QTYPES = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA'] as const;

export async function getAllDNS(
  domain: string
): Promise<Record<string, string[]>> {
  const results = await Promise.allSettled(
    (QTYPES as readonly string[]).map(async t => {
      const res = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${t}`,
        { headers: { Accept: 'application/dns-json' } }
      );
      const data = await res.json();
      return [t, (data.Answer ?? []).map((r: { data: string }) => r.data)] as [string, string[]];
    })
  );
  return Object.fromEntries(
    results
      .filter(
        (r): r is PromiseFulfilledResult<[string, string[]]> => r.status === 'fulfilled'
      )
      .map(r => r.value)
  );
}
