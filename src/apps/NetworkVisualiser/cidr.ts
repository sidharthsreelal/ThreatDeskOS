export function parseCIDR(cidr: string): string[] {
  const [base, prefix] = cidr.trim().split('/');
  if (!prefix) return [base.trim()];

  const prefixLen = parseInt(prefix, 10);
  if (isNaN(prefixLen) || prefixLen < 16 || prefixLen > 32) {
    throw new Error(`CIDR prefix must be between /16 and /32 (got /${prefix}). Larger ranges would generate too many IPs.`);
  }

  const parts   = base.split('.').map(Number);
  const baseInt = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
  const mask    = ~((1 << (32 - prefixLen)) - 1);
  const network = baseInt & mask;
  const count   = Math.pow(2, 32 - prefixLen);

  // Hard cap — never generate more than 256 IPs
  const limit = Math.min(count, 256);
  const ips: string[] = [];

  for (let i = 1; i < limit - 1; i++) {
    const n = network + i;
    ips.push(`${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`);
  }

  return ips;
}

export function parseInput(raw: string): string[] {
  const lines = raw.split(/[\n,\s]+/).map(s => s.trim()).filter(Boolean);
  const ips: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const expanded = line.includes('/') ? parseCIDR(line) : [line];
    for (const ip of expanded) {
      if (isValidIP(ip) && !seen.has(ip)) {
        ips.push(ip);
        seen.add(ip);
      }
    }
  }

  return ips.slice(0, 100); // Global cap — 100 IPs max
}

export function isValidIP(ip: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) &&
    ip.split('.').every(o => parseInt(o) <= 255);
}

export function isPrivateIP(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  return a === 10
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || a === 127;
}

export function getSubnet24(ip: string): string {
  return ip.split('.').slice(0, 3).join('.');
}
