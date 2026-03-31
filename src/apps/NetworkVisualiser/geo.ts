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
