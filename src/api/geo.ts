// src/api/geo.ts — ipapi.co (no key, 60/hr)

export async function geoLookup(ip: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`https://ipapi.co/${ip}/json/`);
  if (!res.ok) return null;
  return res.json();
}
