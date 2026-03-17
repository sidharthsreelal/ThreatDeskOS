// src/crypto/entropy.ts

export interface PasswordAnalysis {
  entropy: number;
  rawEntropy: number;
  charsetSize: number;
  crackTimeSeconds: number;
  crackTimeDisplay: string;
  score: 0 | 1 | 2 | 3 | 4;
  patterns: PatternMatch[];
  suggestions: string[];
}

export interface PatternMatch {
  type: 'dictionary' | 'repeat' | 'sequence' | 'keyboard' | 'date' | 'leet';
  token: string;
  description: string;
  penalty: number;
}

export function analysePassword(password: string): PasswordAnalysis {
  const cs = charsetSize(password);
  const raw = password.length * Math.log2(Math.max(cs, 2));
  const patterns = detectPatterns(password);
  const penalty = patterns.reduce((s, p) => s + p.penalty, 0);
  const entropy = Math.max(0, raw - penalty);
  const crackSec = Math.pow(2, entropy) / 2 / 1e10;
  return {
    entropy: Math.round(entropy * 10) / 10,
    rawEntropy: Math.round(raw * 10) / 10,
    charsetSize: cs,
    crackTimeSeconds: crackSec,
    crackTimeDisplay: crackTime(crackSec),
    score: score(entropy),
    patterns,
    suggestions: suggest(password, patterns, entropy),
  };
}

function charsetSize(pw: string): number {
  let s = 0;
  if (/[a-z]/.test(pw)) s += 26;
  if (/[A-Z]/.test(pw)) s += 26;
  if (/[0-9]/.test(pw)) s += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) s += 32;
  return s || 1;
}

function score(e: number): 0 | 1 | 2 | 3 | 4 {
  if (e < 28) return 0;
  if (e < 36) return 1;
  if (e < 60) return 2;
  if (e < 80) return 3;
  return 4;
}

function crackTime(s: number): string {
  if (s < 1) return 'instantly';
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)} minutes`;
  if (s < 86400) return `${Math.round(s / 3600)} hours`;
  if (s < 2.592e6) return `${Math.round(s / 86400)} days`;
  if (s < 3.154e7) return `${Math.round(s / 2.592e6)} months`;
  if (s < 3.154e9) return `${Math.round(s / 3.154e7)} years`;
  if (s < 3.154e11) return `${Math.round(s / 3.154e9)} centuries`;
  return 'longer than the universe';
}

const TOP500 = new Set([
  'password', '123456', '123456789', 'qwerty', 'abc123', 'password1',
  'iloveyou', 'admin', 'letmein', 'monkey', 'dragon', 'master',
  'sunshine', 'princess', 'welcome', 'shadow', 'superman', 'michael',
  'football', 'baseball', 'soccer', 'charlie', 'thomas', 'hockey',
  'ranger', 'daniel', 'starwars', 'klaster', 'george', 'computer',
  'michelle', 'jessica', 'pepper', 'zxcvbn', 'ginger', 'joshua',
  'trustno1', 'batman', 'jennifer', 'hunter', 'buster', 'andrew',
  'harley', 'thunder', 'jordan', 'tigger', 'robert', 'matrix',
  'access', 'love', 'hello', 'ashley', 'nicole', 'maggie',
  'yankees', 'cheese', 'amanda', 'summer', 'dallas', 'austin',
  'taylor', 'secret', 'albert', 'merlin', 'muffin', 'murphy',
  'silver', 'sparky', 'diamond', 'golden', 'cookie', 'banana',
  'killer', 'flower', 'orange', 'chicken', 'purple', 'samantha',
  'london', 'freedom', 'phoenix', 'corvette', 'buttercup', 'midnight',
]);

const KB_WALKS = [
  'qwerty', 'qwertyuiop', 'asdf', 'asdfgh', 'asdfghjkl', 'zxcv',
  'zxcvbn', 'qazwsx', '1qaz2wsx', 'qweasd',
];

function detectPatterns(pw: string): PatternMatch[] {
  const p: PatternMatch[] = [];
  const lo = pw.toLowerCase();

  for (const word of TOP500) {
    if (lo.includes(word)) {
      p.push({ type: 'dictionary', token: word, description: `Contains common password "${word}"`, penalty: 20 });
      break;
    }
  }

  const rep = lo.match(/(.)(\1){2,}/g);
  if (rep) {
    p.push({ type: 'repeat', token: rep[0], description: `Repeated character "${rep[0]}"`, penalty: 10 });
  }

  if (/abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789/i.test(pw)) {
    p.push({ type: 'sequence', token: '', description: 'Contains sequential characters', penalty: 8 });
  }

  for (const w of KB_WALKS) {
    if (lo.includes(w)) {
      p.push({ type: 'keyboard', token: w, description: `Keyboard walk "${w}"`, penalty: 15 });
      break;
    }
  }

  if (/\b(19|20)\d{2}\b/.test(pw) || /\d{2}[\/\-\.]\d{2}/.test(pw)) {
    p.push({ type: 'date', token: '', description: 'Contains a date or year', penalty: 12 });
  }

  const unleet = lo
    .replace(/[@4]/g, 'a')
    .replace(/3/g, 'e')
    .replace(/[1!]/g, 'i')
    .replace(/0/g, 'o')
    .replace(/[$5]/g, 's')
    .replace(/7/g, 't');
  for (const w of TOP500) {
    if (unleet.includes(w) && !lo.includes(w)) {
      p.push({ type: 'leet', token: w, description: `Leet-speak of "${w}"`, penalty: 15 });
      break;
    }
  }

  return p;
}

function suggest(pw: string, p: PatternMatch[], e: number): string[] {
  const s: string[] = [];
  if (pw.length < 12) s.push('Use at least 12 characters');
  if (!/[A-Z]/.test(pw)) s.push('Add uppercase letters');
  if (!/[0-9]/.test(pw)) s.push('Add numbers');
  if (!/[^a-zA-Z0-9]/.test(pw)) s.push('Add symbols like !@#$%');
  if (p.some(x => x.type === 'dictionary')) s.push('Avoid common words and passwords');
  if (p.some(x => x.type === 'keyboard')) s.push('Avoid keyboard patterns');
  if (e < 60) s.push('Consider a passphrase of 4+ random words');
  return s;
}
