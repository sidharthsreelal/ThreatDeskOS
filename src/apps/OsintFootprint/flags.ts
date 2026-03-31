// src/apps/OsintFootprint/flags.ts

export interface RiskFlag {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
}

const RISKY_PORTS: Record<number, string> = {
  21: 'FTP', 23: 'Telnet', 25: 'SMTP', 445: 'SMB',
  3389: 'RDP', 5900: 'VNC', 27017: 'MongoDB', 6379: 'Redis',
};

export function detectFlags(report: Record<string, unknown>): RiskFlag[] {
  const flags: RiskFlag[] = [];

  // SSL
  const ssl = report.ssl as Array<Record<string, string>> | undefined;
  if (ssl?.length) {
    const cert = ssl[0];
    const exp = new Date(cert.not_after).getTime();
    const days = (exp - Date.now()) / 86400000;
    if (days < 0)
      flags.push({ severity: 'critical', title: 'SSL Certificate Expired', description: `Expired ${Math.abs(Math.round(days))} days ago.` });
    else if (days < 30)
      flags.push({ severity: 'high', title: 'SSL Certificate Expiring', description: `Expires in ${Math.round(days)} days.` });
  }

  // DNS
  const dns = report.dns as Record<string, string[]> | undefined;
  const txt = (dns?.TXT ?? []).join(' ');
  if (!txt.includes('v=spf1'))
    flags.push({ severity: 'medium', title: 'No SPF Record', description: 'Allows email spoofing from this domain.' });
  if (!txt.includes('v=DMARC1'))
    flags.push({ severity: 'medium', title: 'No DMARC Policy', description: 'Domain vulnerable to phishing. No DMARC enforcement.' });

  // Shodan
  const shodan = report.shodan as { ports?: number[]; vulns?: string[] } | undefined;
  if (shodan?.ports) {
    Object.entries(RISKY_PORTS).forEach(([port, name]) => {
      if (shodan.ports!.includes(Number(port)))
        flags.push({
          severity: Number(port) === 23 ? 'critical' : 'high',
          title: `Exposed ${name} (Port ${port})`,
          description: `${name} port ${port} is publicly reachable.`,
        });
    });
    if (shodan.vulns?.length)
      flags.push({
        severity: 'critical',
        title: `${shodan.vulns.length} CVE(s) Detected`,
        description: `Shodan reports: ${shodan.vulns.slice(0, 3).join(', ')}`,
      });
  }

  return flags.sort(
    (a, b) =>
      ['critical', 'high', 'medium', 'low', 'info'].indexOf(a.severity) -
      ['critical', 'high', 'medium', 'low', 'info'].indexOf(b.severity)
  );
}
