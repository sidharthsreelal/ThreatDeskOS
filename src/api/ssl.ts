// src/api/ssl.ts — crt.sh (no key, CORS-OK)

export async function sslLookup(domain: string): Promise<Array<Record<string, unknown>>> {
  const res = await fetch(`https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`);
  if (!res.ok) return [];
  return res.json();
}
