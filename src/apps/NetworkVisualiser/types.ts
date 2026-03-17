export interface IPNode {
  id:           string;   // the IP address
  ip:           string;
  lat:          number | null;
  lng:          number | null;
  country:      string;
  countryCode:  string;   // ISO 2-letter
  city:         string;
  asn:          string;   // e.g. "AS15169"
  org:          string;   // e.g. "Google LLC"
  isPrivate:    boolean;
  resolved:     boolean;  // false while geo lookup is in progress
  connections:  number;   // degree — how many edges touch this node
}

export interface IPEdge {
  source: string;   // IP string
  target: string;
  reason: 'same-asn' | 'same-subnet' | 'same-country';
}

export interface VisualisationState {
  nodes:      IPNode[];
  edges:      IPEdge[];
  loading:    Set<string>;   // IPs currently being resolved
  errors:     Map<string, string>; // IP → error message
  activeView: 'graph' | 'map';
  selectedIP: string | null;
}
