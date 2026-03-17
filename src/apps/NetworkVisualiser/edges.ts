import type { IPNode, IPEdge } from './types';
import { getSubnet24 } from './cidr';

export function buildEdges(nodes: IPNode[]): IPEdge[] {
  const edges: IPEdge[] = [];
  const resolved = nodes.filter(n => n.resolved);

  for (let i = 0; i < resolved.length; i++) {
    for (let j = i + 1; j < resolved.length; j++) {
      const a = resolved[i], b = resolved[j];

      // Same ASN — strongest relationship
      if (a.asn && b.asn && a.asn === b.asn && a.asn !== 'Unknown') {
        edges.push({ source: a.ip, target: b.ip, reason: 'same-asn' });
        continue;
      }

      // Same /24 subnet
      if (!a.isPrivate && !b.isPrivate &&
          getSubnet24(a.ip) === getSubnet24(b.ip)) {
        edges.push({ source: a.ip, target: b.ip, reason: 'same-subnet' });
        continue;
      }

      // Same country — loosest relationship, only add if no other edges for these nodes yet
      if (a.countryCode === b.countryCode && a.countryCode !== 'XX') {
        const alreadyConnected = edges.some(
          e => (e.source === a.ip || e.target === a.ip) &&
               (e.source === b.ip || e.target === b.ip)
        );
        if (!alreadyConnected) {
          edges.push({ source: a.ip, target: b.ip, reason: 'same-country' });
        }
      }
    }
  }

  return edges;
}
