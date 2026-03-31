// src/apps/PasswordHealth/index.ts
import { analysePassword } from '../../crypto/entropy';
import './styles.css';

const SCORE_COLORS = ['var(--danger)', 'var(--sev-high)', 'var(--warning)', 'var(--success)', '#00FF88'];
const SCORE_LABELS = ['CRITICAL', 'WEAK', 'FAIR', 'STRONG', 'EXCELLENT'];

export function mount(container: HTMLElement): void {
  container.innerHTML = `<div class="ph-container">
    <div class="ph-input-wrap">
      <input type="password" placeholder="Enter password to analyse..." id="ph-input" autocomplete="off" />
      <button class="ph-toggle" id="ph-toggle" title="Toggle visibility">👁</button>
    </div>
    <div class="ph-bar-wrap"><div class="ph-bar-fill" id="ph-bar" style="width:0%"></div></div>
    <div class="ph-score-label" id="ph-score-label" style="color:var(--text-3)">—</div>
    <div class="ph-metrics">
      <div class="ph-metric"><div class="ph-metric-value" id="ph-entropy">—</div><div class="ph-metric-label">Entropy Bits</div></div>
      <div class="ph-metric"><div class="ph-metric-value" id="ph-charset">—</div><div class="ph-metric-label">Charset Size</div></div>
      <div class="ph-metric"><div class="ph-metric-value" id="ph-crack">—</div><div class="ph-metric-label">Crack Time</div></div>
    </div>
    <div id="ph-patterns"></div>
    <div id="ph-suggestions"></div>
  </div>`;

  const input = container.querySelector('#ph-input') as HTMLInputElement;
  const toggle = container.querySelector('#ph-toggle') as HTMLButtonElement;
  const bar = container.querySelector('#ph-bar') as HTMLElement;
  const scoreLabel = container.querySelector('#ph-score-label') as HTMLElement;
  const entropyEl = container.querySelector('#ph-entropy') as HTMLElement;
  const charsetEl = container.querySelector('#ph-charset') as HTMLElement;
  const crackEl = container.querySelector('#ph-crack') as HTMLElement;
  const patternsEl = container.querySelector('#ph-patterns') as HTMLElement;
  const suggestionsEl = container.querySelector('#ph-suggestions') as HTMLElement;

  toggle.addEventListener('click', () => {
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    toggle.textContent = isPassword ? '🔒' : '👁';
  });

  input.addEventListener('input', () => {
    const pw = input.value;
    if (!pw) {
      bar.style.width = '0%';
      bar.style.background = 'var(--text-3)';
      scoreLabel.textContent = '—';
      scoreLabel.style.color = 'var(--text-3)';
      entropyEl.textContent = '—';
      charsetEl.textContent = '—';
      crackEl.textContent = '—';
      patternsEl.innerHTML = '';
      suggestionsEl.innerHTML = '';
      return;
    }

    const result = analysePassword(pw);
    const pct = Math.min(100, (result.entropy / 100) * 100);
    const color = SCORE_COLORS[result.score];

    requestAnimationFrame(() => {
      bar.style.width = pct + '%';
      bar.style.background = color;
      scoreLabel.textContent = SCORE_LABELS[result.score];
      scoreLabel.style.color = color;
      entropyEl.textContent = String(result.entropy);
      charsetEl.textContent = String(result.charsetSize);
      crackEl.textContent = result.crackTimeDisplay;

      // Patterns
      if (result.patterns.length) {
        patternsEl.innerHTML =
          '<div class="ph-section-title">⚠ Patterns Detected</div>' +
          result.patterns
            .map(
              p =>
                `<div class="ph-pattern"><div class="ph-pattern-type">${p.type}</div><div class="ph-pattern-desc">${p.description}</div></div>`
            )
            .join('');
      } else {
        patternsEl.innerHTML = '';
      }

      // Suggestions
      if (result.suggestions.length) {
        suggestionsEl.innerHTML =
          '<div class="ph-section-title">💡 Suggestions</div>' +
          result.suggestions
            .map(s => `<div class="ph-suggestion">${s}</div>`)
            .join('');
      } else {
        suggestionsEl.innerHTML = '';
      }
    });
  });
}
