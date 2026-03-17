// src/api/hibp.ts

import { getHibpKey } from '../os/Session';

const BASE = 'https://haveibeenpwned.com/api/v3';

export interface Breach {
  Name: string;
  Title: string;
  Domain: string;
  BreachDate: string;
  PwnCount: number;
  Description: string;
  DataClasses: string[];
  IsVerified: boolean;
  IsSensitive: boolean;
}

export async function checkAccount(account: string): Promise<Breach[]> {
  const KEY = getHibpKey();
  if (!KEY) throw new Error('No HIBP API key set. Enter your key in the app settings.');
  const res = await fetch(
    `${BASE}/breachedaccount/${encodeURIComponent(account)}?truncateResponse=false`,
    { headers: { 'hibp-api-key': KEY, 'user-agent': 'ThreatDesk-OS/2.0' } }
  );
  if (res.status === 404) return [];
  if (res.status === 401) throw new Error('Invalid HIBP API key');
  if (res.status === 429) throw new Error('Rate limited — wait 1.5 seconds');
  if (!res.ok) throw new Error(`HIBP error ${res.status}`);
  return res.json();
}

// k-anonymity — plaintext password NEVER sent
export async function checkPasswordPwned(password: string): Promise<number> {
  const hashBuf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password));
  const hash = Array.from(new Uint8Array(hashBuf))
    .map(x => x.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
  if (!res.ok) throw new Error('Password check failed');
  const body = await res.text();
  const match = body.split('\r\n').find(l => l.startsWith(suffix));
  return match ? parseInt(match.split(':')[1], 10) : 0;
}
