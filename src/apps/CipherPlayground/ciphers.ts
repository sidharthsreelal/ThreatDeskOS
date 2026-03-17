// src/apps/CipherPlayground/ciphers.ts

export function rot13(text: string): string {
  return text.replace(/[a-zA-Z]/g, c => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

export function caesar(text: string, shift: number): string {
  return text.replace(/[a-zA-Z]/g, c => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + shift + 26) % 26) + base);
  });
}

export function caesarBruteForce(text: string): Array<{ shift: number; result: string }> {
  return Array.from({ length: 25 }, (_, i) => ({ shift: i + 1, result: caesar(text, i + 1) }));
}

export function vigenere(text: string, key: string, decrypt = false): string {
  const k = key.toUpperCase().replace(/[^A-Z]/g, '');
  if (!k) return text;
  let ki = 0;
  return text.replace(/[a-zA-Z]/g, c => {
    const base = c <= 'Z' ? 65 : 97;
    const shift = k[ki++ % k.length].charCodeAt(0) - 65;
    const s = decrypt ? (26 - shift) : shift;
    return String.fromCharCode(((c.charCodeAt(0) - base + s) % 26) + base);
  });
}

export function atbash(text: string): string {
  return text.replace(/[a-zA-Z]/g, c => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(base + 25 - (c.charCodeAt(0) - base));
  });
}

export function toBase64(text: string): string {
  return btoa(unescape(encodeURIComponent(text)));
}

export function fromBase64(b64: string): string {
  try { return decodeURIComponent(escape(atob(b64))); }
  catch { return '[invalid base64]'; }
}

const MORSE_MAP: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
  I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
  Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..', '0': '-----', '1': '.----', '2': '..---', '3': '...--',
  '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
};
const MORSE_REV: Record<string, string> = Object.fromEntries(
  Object.entries(MORSE_MAP).map(([k, v]) => [v, k])
);

export function toMorse(text: string): string {
  return text.toUpperCase().split('').map(c => c === ' ' ? '/' : (MORSE_MAP[c] ?? '?')).join(' ');
}

export function fromMorse(morse: string): string {
  return morse.split(' / ').map(word =>
    word.split(' ').map(sym => MORSE_REV[sym] ?? '?').join('')
  ).join(' ');
}

export async function playMorse(text: string): Promise<void> {
  const ctx = new AudioContext();
  const dot = 80;
  let t = ctx.currentTime;
  for (const ch of text.toUpperCase()) {
    if (ch === ' ') { t += dot * 7 / 1000; continue; }
    const code = MORSE_MAP[ch]; if (!code) continue;
    for (const sym of code) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 600;
      gain.gain.setValueAtTime(0.3, t);
      osc.start(t);
      const dur = sym === '.' ? dot : dot * 3;
      osc.stop(t + dur / 1000);
      gain.gain.setValueAtTime(0, t + dur / 1000);
      t += (dur + dot) / 1000;
    }
    t += dot * 3 / 1000;
  }
}
