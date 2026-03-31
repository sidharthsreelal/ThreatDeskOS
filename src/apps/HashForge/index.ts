// src/apps/HashForge/index.ts
import { hashText, hashFile, md5, md5File } from '../../crypto/hashing';
import './styles.css';

export function mount(container: HTMLElement): void {
  container.innerHTML = `<div class="hf-container">
    <div class="hf-algo-pills">
      <button class="pill active" data-algo="SHA-256">SHA-256</button>
      <button class="pill" data-algo="SHA-1">SHA-1</button>
      <button class="pill" data-algo="MD5">MD5</button>
      <button class="pill" data-algo="ALL" style="border-color:var(--red-mid);color:var(--text-red)">HASH ALL</button>
    </div>
    <textarea class="hf-textarea" id="hf-text" placeholder="Enter text to hash..."></textarea>
    <div class="hf-dropzone" id="hf-dropzone">
      <div class="hf-dropzone-label">📂 DROP FILE HERE OR CLICK TO SELECT</div>
      <div style="font-size:11px;color:var(--text-3);margin-top:4px">Supports any file type</div>
      <input type="file" id="hf-file" style="display:none" />
    </div>
    <div id="hf-file-name" style="font-size:12px;color:var(--text-2);font-family:'Share Tech Mono',monospace"></div>
    <div class="hf-output" id="hf-output" style="display:none"></div>
    <div style="margin-top:8px">
      <div class="ph-section-title" style="margin-bottom:6px">VERIFY HASH</div>
      <div class="hf-compare">
        <input class="input" type="text" placeholder="Paste expected hash..." id="hf-compare-input" style="font-family:'Share Tech Mono',monospace;font-size:12px" />
        <span class="hf-match" id="hf-match"></span>
      </div>
    </div>
  </div>`;

  let selectedAlgo = 'SHA-256';
  let currentHashes: Record<string, string> = {};
  let selectedFile: File | null = null;

  const pills = container.querySelectorAll('.pill');
  const textArea = container.querySelector('#hf-text') as HTMLTextAreaElement;
  const dropzone = container.querySelector('#hf-dropzone') as HTMLElement;
  const fileInput = container.querySelector('#hf-file') as HTMLInputElement;
  const fileNameEl = container.querySelector('#hf-file-name') as HTMLElement;
  const outputEl = container.querySelector('#hf-output') as HTMLElement;
  const compareInput = container.querySelector('#hf-compare-input') as HTMLInputElement;
  const matchEl = container.querySelector('#hf-match') as HTMLElement;

  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedAlgo = (pill as HTMLElement).dataset.algo ?? 'SHA-256';
      doHash();
    });
  });

  textArea.addEventListener('input', () => { selectedFile = null; fileNameEl.textContent = ''; doHash(); });

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault(); dropzone.classList.remove('dragover');
    if (e.dataTransfer?.files[0]) { selectedFile = e.dataTransfer.files[0]; fileNameEl.textContent = `📄 ${selectedFile.name} (${formatSize(selectedFile.size)})`; doHash(); }
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files?.[0]) { selectedFile = fileInput.files[0]; fileNameEl.textContent = `📄 ${selectedFile.name} (${formatSize(selectedFile.size)})`; doHash(); }
  });

  compareInput.addEventListener('input', () => {
    const expected = compareInput.value.trim().toLowerCase();
    if (!expected) { matchEl.textContent = ''; return; }
    const anyMatch = Object.values(currentHashes).some(h => h === expected);
    matchEl.textContent = anyMatch ? '✓ MATCH' : '✗ MISMATCH';
    matchEl.className = 'hf-match ' + (anyMatch ? 'yes' : 'no');
  });

  async function doHash(): Promise<void> {
    const text = textArea.value;
    if (!text && !selectedFile) { outputEl.style.display = 'none'; return; }

    outputEl.style.display = 'block';
    outputEl.innerHTML = '<div class="bs-status"><div class="spinner" style="margin:0 auto"></div></div>';
    currentHashes = {};

    try {
      if (selectedAlgo === 'ALL') {
        if (selectedFile) {
          const buf = new Uint8Array(await selectedFile.arrayBuffer());
          const [sha256, sha1] = await Promise.all([
            hashFile(selectedFile, 'SHA-256'),
            hashFile(selectedFile, 'SHA-1'),
          ]);
          currentHashes = { 'SHA-256': sha256, 'SHA-1': sha1, 'MD5': md5File(buf) };
        } else {
          const [sha256, sha1] = await Promise.all([
            hashText(text, 'SHA-256'),
            hashText(text, 'SHA-1'),
          ]);
          currentHashes = { 'SHA-256': sha256, 'SHA-1': sha1, 'MD5': md5(text) };
        }
      } else if (selectedAlgo === 'MD5') {
        if (selectedFile) {
          const buf = new Uint8Array(await selectedFile.arrayBuffer());
          currentHashes = { 'MD5': md5File(buf) };
        } else {
          currentHashes = { 'MD5': md5(text) };
        }
      } else {
        const algo = selectedAlgo as 'SHA-256' | 'SHA-1';
        const hash = selectedFile
          ? await hashFile(selectedFile, algo)
          : await hashText(text, algo);
        currentHashes = { [selectedAlgo]: hash };
      }

      outputEl.innerHTML = Object.entries(currentHashes)
        .map(([algo, hash]) => `
          <div class="hf-hash-row">
            <span class="hf-hash-algo">${algo}</span>
            <span class="hf-hash-value">${hash}</span>
            <button class="hf-copy-btn" data-hash="${hash}">COPY</button>
          </div>
        `).join('');

      outputEl.querySelectorAll('.hf-copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          navigator.clipboard.writeText((btn as HTMLElement).dataset.hash ?? '');
          btn.textContent = '✓';
          setTimeout(() => { btn.textContent = 'COPY'; }, 1500);
        });
      });

      // Re-run compare
      compareInput.dispatchEvent(new Event('input'));
    } catch (err) {
      outputEl.innerHTML = `<div class="bs-status error">⚠ ${err instanceof Error ? err.message : 'Hash error'}</div>`;
    }
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}
