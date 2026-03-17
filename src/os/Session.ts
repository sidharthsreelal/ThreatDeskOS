// src/os/Session.ts — User session management

export interface UserSession {
  username: string;
  passwordHash: string;
  salt: string;
  hibpKey: string;
  createdAt: number;
}

const SESSION_KEY = 'threatdesk:session';

export function loadSession(): UserSession | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
  } catch {
    return null;
  }
}

export function saveSession(s: UserSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function getHibpKey(): string {
  return loadSession()?.hibpKey ?? '';
}

export function setHibpKey(key: string): void {
  const s = loadSession();
  if (s) {
    s.hibpKey = key;
    saveSession(s);
  }
}

// ── Password hashing (PBKDF2) ─────────────────────────────────────

export async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  const km = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    km,
    256
  );
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function createSession(username: string, password: string): Promise<UserSession> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await hashPassword(password, salt);
  const session: UserSession = {
    username,
    passwordHash: hash,
    salt: Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join(''),
    hibpKey: '',
    createdAt: Date.now(),
  };
  saveSession(session);
  return session;
}

export async function verifyPassword(password: string): Promise<boolean> {
  const session = loadSession();
  if (!session) return false;
  const salt = new Uint8Array(session.salt.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const hash = await hashPassword(password, salt);
  return hash === session.passwordHash;
}
