// src/apps/registry.ts
import { mount as passwordHealth } from './PasswordHealth/index';
import { mount as breachScanner } from './BreachScanner/index';
import { mount as hashForge } from './HashForge/index';
import { mount as cveRadar } from './CveRadar/index';
import { mount as cipherPlayground } from './CipherPlayground/index';
import { mount as threatTicker } from './ThreatTicker/index';
import { mount as osintFootprint } from './OsintFootprint/index';
import { mount as decayVault } from './DecayVault/index';
import { mount as networkVisualiser } from './NetworkVisualiser/index';
import {
  ICON_PASSWORD_HEALTH, ICON_BREACH_SCANNER, ICON_HASH_FORGE,
  ICON_CVE_RADAR, ICON_CIPHER_PLAYGROUND, ICON_THREAT_TICKER,
  ICON_OSINT_FOOTPRINT, ICON_DECAY_VAULT, ICON_NETWORK_VISUALISER
} from '../os/icons';

export interface AppDef {
  id: string;
  title: string;
  icon: string;     // SVG string
  defaultWidth: number;
  defaultHeight: number;
  minWidth?: number;
  minHeight?: number;
  mount: (container: HTMLElement) => void;
}

export const APPS: AppDef[] = [
  { id: 'password-health', title: 'PASSWORD HEALTH', icon: ICON_PASSWORD_HEALTH, defaultWidth: 760, defaultHeight: 560, mount: passwordHealth },
  { id: 'breach-scanner', title: 'BREACH SCANNER', icon: ICON_BREACH_SCANNER, defaultWidth: 760, defaultHeight: 560, mount: breachScanner },
  { id: 'hash-forge', title: 'HASH FORGE', icon: ICON_HASH_FORGE, defaultWidth: 760, defaultHeight: 560, mount: hashForge },
  { id: 'cve-radar', title: 'CVE RADAR', icon: ICON_CVE_RADAR, defaultWidth: 760, defaultHeight: 560, mount: cveRadar },
  { id: 'cipher-playground', title: 'CIPHER PLAYGROUND', icon: ICON_CIPHER_PLAYGROUND, defaultWidth: 760, defaultHeight: 560, mount: cipherPlayground },
  { id: 'threat-ticker', title: 'THREAT TICKER', icon: ICON_THREAT_TICKER, defaultWidth: 760, defaultHeight: 560, mount: threatTicker },
  { id: 'osint-footprint', title: 'OSINT FOOTPRINT', icon: ICON_OSINT_FOOTPRINT, defaultWidth: 760, defaultHeight: 560, mount: osintFootprint },
  { id: 'decay-vault', title: 'DECAY VAULT', icon: ICON_DECAY_VAULT, defaultWidth: 760, defaultHeight: 560, mount: decayVault },
  { id: 'network-visualiser', title: 'NETWORK VISUALISER', icon: ICON_NETWORK_VISUALISER, defaultWidth: 760, defaultHeight: 560, mount: networkVisualiser }
];
