// Country → hue mapping — consistent colour per country across both views
const COUNTRY_HUES = new Map<string, number>();
let hueCounter = 0;
const HUE_STEP = 37; // Golden angle approximation — maximises colour distance

export function getCountryColour(countryCode: string): string {
  if (countryCode === 'LOC') return '#00D68F'; // Matches var(--success)
  if (countryCode === 'XX')  return '#4A4248'; // Private/unknown — muted
  if (!COUNTRY_HUES.has(countryCode)) {
    COUNTRY_HUES.set(countryCode, (hueCounter * HUE_STEP) % 360);
    hueCounter++;
  }
  const hue = COUNTRY_HUES.get(countryCode)!;
  return `hsl(${hue}, 65%, 55%)`;
}

export const EDGE_COLOURS: Record<string, string> = {
  'same-asn':     'rgba(232, 0, 31, 0.7)',   // Aberdeen red — strongest
  'same-subnet':  'rgba(255, 165, 0, 0.5)',   // Orange — medium
  'same-country': 'rgba(77, 166, 255, 0.25)', // Blue — weakest
};

export const EDGE_WIDTHS: Record<string, number> = {
  'same-asn':     2.5,
  'same-subnet':  1.5,
  'same-country': 0.75,
};
