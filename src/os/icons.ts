// src/os/icons.ts — SVG icons for apps (24x24 viewBox, Aberdeen Red theme)

// Password Health — Key icon
export const ICON_PASSWORD_HEALTH = `<svg viewBox="0 0 24 24" fill="none" stroke="#E8001F" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="5"/><path d="M13 10l8-8"/><path d="M18 3l3 3"/><path d="M15 6l3 3"/><circle cx="8" cy="15" r="1.5" fill="#E8001F" stroke="none"/></svg>`;

// Breach Scanner — Shield with search
export const ICON_BREACH_SCANNER = `<svg viewBox="0 0 24 24" fill="none" stroke="#E8001F" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L4 6v5c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6L12 2z" fill="rgba(192,0,26,0.15)"/><circle cx="11" cy="11" r="3"/><path d="M14 14l3 3"/><path d="M9 11h4M11 9v4" stroke-width="1"/></svg>`;

// Hash Forge — Chain link / hash
export const ICON_HASH_FORGE = `<svg viewBox="0 0 24 24" fill="none" stroke="#E8001F" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07L12 4.93"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07L12 19.07"/><path d="M9 9l6 6" stroke-width="1" stroke-dasharray="2 2"/></svg>`;

// CVE Radar — Radar sweep
export const ICON_CVE_RADAR = `<svg viewBox="0 0 24 24" fill="none" stroke="#E8001F" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="#E8001F"/><path d="M12 3v4M12 17v4" stroke-width="1"/><path d="M12 12l5-5" stroke-width="2"/><path d="M12 12l5-5" stroke-width="2" opacity="0.3"/></svg>`;

// Cipher Playground — Lock with code
export const ICON_CIPHER_PLAYGROUND = `<svg viewBox="0 0 24 24" fill="none" stroke="#E8001F" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" fill="rgba(192,0,26,0.12)"/><path d="M7 11V7a5 5 0 0110 0v4"/><path d="M9 16h2M13 16h2" stroke-width="2"/></svg>`;

// Threat Ticker — Pulse line
export const ICON_THREAT_TICKER = `<svg viewBox="0 0 24 24" fill="none" stroke="#E8001F" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h4l3-8 4 16 3-8h6"/><circle cx="20" cy="12" r="2" fill="#E8001F" stroke="none" opacity="0.6"/></svg>`;

// OSINT Footprint — Fingerprint
export const ICON_OSINT_FOOTPRINT = `<svg viewBox="0 0 24 24" fill="none" stroke="#E8001F" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a8 8 0 00-8 8c0 4 2 6 2 10"/><path d="M20 10a8 8 0 00-8-8"/><path d="M20 10c0 2.5-1 4.5-1.5 7"/><path d="M8 10a4 4 0 018 0"/><path d="M16 10c0 2-1 4-1 6"/><path d="M12 10v6"/></svg>`;

// Decay Vault — Vault door
export const ICON_DECAY_VAULT = `<svg viewBox="0 0 24 24" fill="none" stroke="#E8001F" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="3" fill="rgba(192,0,26,0.12)"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1.5" fill="#E8001F" stroke="none"/><path d="M16 12h4"/><path d="M12 8V4M12 20v-4" stroke-width="1"/></svg>`;

// Network Visualiser — Global web
export const ICON_NETWORK_VISUALISER = `<svg viewBox="0 0 24 24" fill="none" stroke="#E8001F" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" stroke-opacity="0.3"/><circle cx="12" cy="12" r="3" fill="rgba(192,0,26,0.15)"/><path d="M12 3v18"/><path d="M3 12h18"/><path d="M12 3c3.3 0 6 4 6 9s-2.7 9-6 9-6-4-6-9 2.7-9 6-9z"/><circle cx="12" cy="12" r="1.5" fill="#E8001F" stroke="none"/><circle cx="18" cy="12" r="1" fill="#E8001F" stroke="none" opacity="0.6"/><circle cx="6" cy="12" r="1" fill="#E8001F" stroke="none" opacity="0.6"/></svg>`;

// Terminal icon
export const ICON_TERMINAL = `<svg viewBox="0 0 24 24" fill="none" stroke="#E8001F" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="18" rx="2" fill="rgba(192,0,26,0.1)"/><path d="M6 9l4 3-4 3"/><path d="M12 15h6"/></svg>`;

// Map app IDs to their icons
export const APP_ICONS: Record<string, string> = {
  'password-health': ICON_PASSWORD_HEALTH,
  'breach-scanner': ICON_BREACH_SCANNER,
  'hash-forge': ICON_HASH_FORGE,
  'cve-radar': ICON_CVE_RADAR,
  'cipher-playground': ICON_CIPHER_PLAYGROUND,
  'threat-ticker': ICON_THREAT_TICKER,
  'osint-footprint': ICON_OSINT_FOOTPRINT,
  'decay-vault': ICON_DECAY_VAULT,
  'network-visualiser': ICON_NETWORK_VISUALISER,
};
