// src/apps/CipherPlayground/analysis.ts

export const ENGLISH: Record<string, number> = {
  E: 0.127, T: 0.091, A: 0.082, O: 0.075, I: 0.070, N: 0.067, S: 0.063, H: 0.061,
  R: 0.060, D: 0.043, L: 0.040, C: 0.028, U: 0.028, M: 0.024, W: 0.023, F: 0.022,
  G: 0.020, Y: 0.020, P: 0.019, B: 0.015, V: 0.010, K: 0.008, J: 0.002, X: 0.001,
  Q: 0.001, Z: 0.001,
};

export function letterFreq(text: string): Record<string, number> {
  const letters = text.toUpperCase().replace(/[^A-Z]/g, '');
  const counts: Record<string, number> = {};
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(c => (counts[c] = 0));
  letters.split('').forEach(c => counts[c]++);
  const total = letters.length || 1;
  Object.keys(counts).forEach(k => (counts[k] /= total));
  return counts;
}

export function indexOfCoincidence(text: string): number {
  const letters = text.toUpperCase().replace(/[^A-Z]/g, '');
  const n = letters.length;
  if (n < 2) return 0;
  const counts: Record<string, number> = {};
  letters.split('').forEach(c => (counts[c] = (counts[c] ?? 0) + 1));
  const sum = Object.values(counts).reduce((a, c) => a + c * (c - 1), 0);
  return sum / (n * (n - 1));
}

export function guessCaesarShift(text: string): number {
  const freq = letterFreq(text);
  let best = 0, bestScore = -Infinity;
  for (let s = 0; s < 26; s++) {
    let score = 0;
    for (let i = 0; i < 26; i++) {
      const c = String.fromCharCode(65 + i);
      const p = String.fromCharCode(65 + ((i - s + 26) % 26));
      score += freq[c] * (ENGLISH[p] ?? 0);
    }
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return best;
}
