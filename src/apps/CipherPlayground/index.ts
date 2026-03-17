// src/apps/CipherPlayground/index.ts
import { rot13, caesar, caesarBruteForce, vigenere, atbash, toBase64, fromBase64, toMorse, fromMorse, playMorse } from './ciphers';
import { letterFreq, ENGLISH, indexOfCoincidence, guessCaesarShift } from './analysis';
import './styles.css';

type CipherType = 'rot13' | 'caesar' | 'vigenere' | 'atbash' | 'base64' | 'morse' | 'freq';

export function mount(container: HTMLElement): void {
  container.innerHTML = `<div class="cp-container">
    <div class="cp-left">
      <div class="cp-cipher-tabs">
        <button class="pill active" data-cipher="rot13">ROT13</button>
        <button class="pill" data-cipher="caesar">CAESAR</button>
        <button class="pill" data-cipher="vigenere">VIGENÈRE</button>
        <button class="pill" data-cipher="atbash">ATBASH</button>
        <button class="pill" data-cipher="base64">BASE64</button>
        <button class="pill" data-cipher="morse">MORSE</button>
        <button class="pill" data-cipher="freq">FREQ ANALYSIS</button>
      </div>
      <div class="cp-key-row" id="cp-key-row" style="display:none">
        <label id="cp-key-label">SHIFT</label>
        <input class="input" id="cp-key-input" style="max-width:180px" />
      </div>
      <textarea class="cp-textarea" id="cp-input" placeholder="Enter text..."></textarea>
      <div class="cp-actions">
        <button class="btn btn-primary" id="cp-encode">ENCODE</button>
        <button class="btn" id="cp-decode">DECODE</button>
        <button class="cp-morse-play" id="cp-morse-play" style="display:none" title="Play Morse audio">🔊</button>
      </div>
    </div>
    <div class="cp-right">
      <div class="cp-output" id="cp-output">Output will appear here...</div>
      <canvas class="cp-freq-canvas" id="cp-canvas" style="display:none"></canvas>
      <div class="cp-ioc-info" id="cp-ioc" style="display:none"></div>
    </div>
  </div>`;

  let currentCipher: CipherType = 'rot13';

  const tabs = container.querySelectorAll('.cp-cipher-tabs .pill');
  const keyRow = container.querySelector('#cp-key-row') as HTMLElement;
  const keyLabel = container.querySelector('#cp-key-label') as HTMLElement;
  const keyInput = container.querySelector('#cp-key-input') as HTMLInputElement;
  const inputEl = container.querySelector('#cp-input') as HTMLTextAreaElement;
  const outputEl = container.querySelector('#cp-output') as HTMLElement;
  const encodeBtn = container.querySelector('#cp-encode') as HTMLButtonElement;
  const decodeBtn = container.querySelector('#cp-decode') as HTMLButtonElement;
  const morseBtn = container.querySelector('#cp-morse-play') as HTMLElement;
  const canvas = container.querySelector('#cp-canvas') as HTMLCanvasElement;
  const iocEl = container.querySelector('#cp-ioc') as HTMLElement;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentCipher = (tab as HTMLElement).dataset.cipher as CipherType;
      updateUI();
    });
  });

  function updateUI(): void {
    // Key input visibility
    const needsKey = currentCipher === 'caesar' || currentCipher === 'vigenere';
    keyRow.style.display = needsKey ? 'flex' : 'none';
    keyLabel.textContent = currentCipher === 'caesar' ? 'SHIFT (1-25)' : 'KEYWORD';
    keyInput.placeholder = currentCipher === 'caesar' ? '13' : 'Enter keyword...';
    keyInput.value = currentCipher === 'caesar' ? '13' : '';

    // Morse play button
    morseBtn.style.display = currentCipher === 'morse' ? 'inline-flex' : 'none';

    // Freq analysis canvas
    canvas.style.display = currentCipher === 'freq' ? 'block' : 'none';
    iocEl.style.display = currentCipher === 'freq' ? 'block' : 'none';

    // Button labels
    if (currentCipher === 'freq') {
      encodeBtn.textContent = 'ANALYSE';
      decodeBtn.style.display = 'none';
    } else {
      encodeBtn.textContent = 'ENCODE';
      decodeBtn.style.display = 'inline-flex';
    }

    outputEl.textContent = 'Output will appear here...';
  }

  encodeBtn.addEventListener('click', () => processText(false));
  decodeBtn.addEventListener('click', () => processText(true));

  morseBtn.addEventListener('click', () => {
    const text = inputEl.value;
    if (text) playMorse(text);
  });

  function processText(decode: boolean): void {
    const text = inputEl.value;
    if (!text) return;

    switch (currentCipher) {
      case 'rot13':
        outputEl.textContent = rot13(text);
        break;
      case 'caesar': {
        const shift = parseInt(keyInput.value) || 13;
        if (decode) {
          // Brute force all 25 shifts
          const results = caesarBruteForce(text);
          const best = guessCaesarShift(text);
          outputEl.innerHTML = '';
          const list = document.createElement('div');
          list.className = 'cp-brute-list';
          results.forEach(r => {
            const item = document.createElement('div');
            item.className = 'cp-brute-item' + (r.shift === best ? ' best' : '');
            item.innerHTML = `<span class="cp-brute-shift">⬡ ${r.shift}</span><span class="cp-brute-text">${r.result}</span>`;
            list.appendChild(item);
          });
          outputEl.appendChild(list);
        } else {
          outputEl.textContent = caesar(text, shift);
        }
        break;
      }
      case 'vigenere': {
        const key = keyInput.value || 'KEY';
        outputEl.textContent = vigenere(text, key, decode);
        break;
      }
      case 'atbash':
        outputEl.textContent = atbash(text);
        break;
      case 'base64':
        outputEl.textContent = decode ? fromBase64(text) : toBase64(text);
        break;
      case 'morse':
        outputEl.textContent = decode ? fromMorse(text) : toMorse(text);
        break;
      case 'freq':
        doFreqAnalysis(text);
        break;
    }
  }

  function doFreqAnalysis(text: string): void {
    const freq = letterFreq(text);
    const ioc = indexOfCoincidence(text);
    const bestShift = guessCaesarShift(text);

    // Draw canvas
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const barW = (rect.width - 40) / 26;
    const maxH = rect.height - 40;
    const maxFreq = Math.max(...Object.values(freq), ...Object.values(ENGLISH), 0.15);

    letters.forEach((letter, i) => {
      const x = 20 + i * barW;
      const h = (freq[letter] / maxFreq) * maxH;
      const engH = ((ENGLISH[letter] ?? 0) / maxFreq) * maxH;

      // English reference bar (behind)
      ctx.fillStyle = 'rgba(77,166,255,0.2)';
      ctx.fillRect(x + 2, rect.height - 20 - engH, barW - 4, engH);

      // Actual frequency bar (front)
      ctx.fillStyle = '#C0001A';
      ctx.fillRect(x + 2, rect.height - 20 - h, barW - 4, h);

      // Letter label
      ctx.fillStyle = '#9A8F8D';
      ctx.font = '10px "Share Tech Mono"';
      ctx.textAlign = 'center';
      ctx.fillText(letter, x + barW / 2, rect.height - 6);
    });

    // IOC info
    const cipherType = ioc > 0.055 ? 'Monoalphabetic' : 'Polyalphabetic or random';
    iocEl.innerHTML = `IoC: ${ioc.toFixed(4)} (English≈0.065 | Random≈0.038) → <strong>${cipherType}</strong> | Best Caesar shift: <strong style="color:var(--text-red)">${bestShift}</strong>`;

    outputEl.textContent = `Frequency Analysis Complete.\n\nIndex of Coincidence: ${ioc.toFixed(4)}\nBest Caesar shift guess: ${bestShift}\nDecoded with shift ${bestShift}:\n\n${caesar(text, bestShift)}`;
  }
}
