// src/crypto/vault.ts

export interface VaultEntry {
  id: string;
  label: string;
  username: string;
  ciphertext: string;
  iv: string;
  salt: string;
  originalLen: number;
  integrityPct: number;
  createdAt: number;
}

export interface VaultState {
  entries: VaultEntry[];
  failedAttempts: number;
  lastFailedAt: number | null;
  isLocked: boolean;
  // Separate verification token — NOT affected by decay
  verifyToken: string;
  verifySalt: string;
  verifyIv: string;
}

const VAULT_KEY = 'threatdesk:vault';
const VERIFY_MAGIC = 'THREATDESK_VAULT_OK';

export function loadVault(): VaultState {
  try {
    return JSON.parse(localStorage.getItem(VAULT_KEY) ?? 'null') ?? emptyVault();
  } catch {
    return emptyVault();
  }
}

export function saveVault(s: VaultState): void {
  localStorage.setItem(VAULT_KEY, JSON.stringify(s));
}

function emptyVault(): VaultState {
  return {
    entries: [], failedAttempts: 0, lastFailedAt: null, isLocked: true,
    verifyToken: '', verifySalt: '', verifyIv: '',
  };
}

// ── Key derivation ─────────────────────────────────────────────────

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const km = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: 310_000, hash: 'SHA-256' },
    km,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ── Verification token ─────────────────────────────────────────────
// This token is stored separately and is NEVER affected by decay.
// It encrypts the magic string "THREATDESK_VAULT_OK" with the master password.
// When unlocking, we decrypt this token to verify the password is correct.

export async function createVerifyToken(
  master: string
): Promise<{ verifyToken: string; verifySalt: string; verifyIv: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(master, salt);
  const enc = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    new TextEncoder().encode(VERIFY_MAGIC)
  );
  return {
    verifyToken: bufToHex(enc),
    verifySalt: bufToHex(salt),
    verifyIv: bufToHex(iv),
  };
}

export async function checkVerifyToken(
  state: VaultState,
  master: string
): Promise<boolean> {
  if (!state.verifyToken) return false;
  try {
    const s = hexToBuf(state.verifySalt);
    const key = await deriveKey(master, s);
    const ivBuf = hexToBuf(state.verifyIv);
    const dec = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBuf.buffer as ArrayBuffer },
      key,
      hexToBuf(state.verifyToken).buffer as ArrayBuffer
    );
    return new TextDecoder().decode(dec) === VERIFY_MAGIC;
  } catch {
    return false;
  }
}

// ── Encryption ─────────────────────────────────────────────────────

export async function encryptPassword(
  plain: string,
  master: string
): Promise<{ ciphertext: string; iv: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(master, salt);
  const enc = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    new TextEncoder().encode(plain)
  );
  return {
    ciphertext: bufToHex(enc),
    iv: bufToHex(iv),
    salt: bufToHex(salt),
  };
}

// ── Decryption ─────────────────────────────────────────────────────

export async function decryptPassword(
  entry: VaultEntry,
  master: string
): Promise<string | null> {
  try {
    const s = hexToBuf(entry.salt);
    const key = await deriveKey(master, s);
    const ivBuf = hexToBuf(entry.iv);
    const dec = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBuf.buffer as ArrayBuffer },
      key,
      hexToBuf(entry.ciphertext).buffer as ArrayBuffer
    );
    return new TextDecoder().decode(dec);
  } catch {
    return null; // Wrong password or corrupted ciphertext
  }
}

// ── Decay ──────────────────────────────────────────────────────────

export function applyDecay(state: VaultState): VaultState {
  const n = state.failedAttempts;
  const lose = n < 3 ? 1 : n < 10 ? 3 : 5;

  const entries = state.entries
    .map(entry => {
      if (entry.ciphertext.length <= 8) return null; // too degraded → delete
      let ct = entry.ciphertext;
      for (let i = 0; i < lose; i++) {
        if (ct.length <= 2) break;
        const pos = Math.floor(Math.random() * (ct.length / 2)) * 2;
        ct = ct.slice(0, pos) + ct.slice(pos + 2);
      }
      return {
        ...entry,
        ciphertext: ct,
        integrityPct: Math.round((ct.length / entry.originalLen) * 100),
      };
    })
    .filter((e): e is VaultEntry => e !== null);

  return {
    ...state,
    entries,
    failedAttempts: state.failedAttempts + 1,
    lastFailedAt: Date.now(),
    // verifyToken, verifySalt, verifyIv are PRESERVED — never decayed
  };
}

// ── Helpers ────────────────────────────────────────────────────────

function bufToHex(b: ArrayBuffer | Uint8Array): string {
  const bytes = b instanceof Uint8Array ? b : new Uint8Array(b);
  return Array.from(bytes)
    .map(x => x.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuf(h: string): Uint8Array {
  const arr = new Uint8Array(h.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}
