// src/os/Terminal.ts — True inline-terminal emulator with pane support

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export class Terminal {
  container: HTMLElement;
  outputEl: HTMLElement;

  // Inline input line (lives at bottom of outputEl)
  public inputLineEl: HTMLElement;
  private promptEl: HTMLSpanElement;
  private inputEl: HTMLInputElement;

  private commandHistory: string[] = [];
  private historyIndex = -1;
  private commandHandler: ((cmd: string, term: Terminal) => Promise<void>) | null = null;
  private inputResolve: ((value: string) => void) | null = null;
  private escapeHandler: (() => void) | null = null;
  private isPasswordMode = false;
  private _isBusy = false;
  private defaultPrompt = '$ ';

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.classList.add('terminal');

    // The output area is the ONLY scrolling region
    this.outputEl = document.createElement('div');
    this.outputEl.className = 'terminal-output';
    this.container.appendChild(this.outputEl);

    // The input line lives INSIDE the output area at the very bottom
    this.inputLineEl = document.createElement('div');
    this.inputLineEl.className = 'terminal-inline-input-line';

    this.promptEl = document.createElement('span');
    this.promptEl.className = 'terminal-prompt';
    this.promptEl.textContent = '$ ';

    this.inputEl = document.createElement('input');
    this.inputEl.className = 'terminal-input';
    this.inputEl.type = 'text';
    this.inputEl.spellcheck = false;
    this.inputEl.autocomplete = 'off';

    this.inputLineEl.appendChild(this.promptEl);
    this.inputLineEl.appendChild(this.inputEl);
    this.outputEl.appendChild(this.inputLineEl);

    // Click anywhere → focus input
    this.container.addEventListener('click', () => this.inputEl.focus());
    this.inputEl.addEventListener('keydown', (e) => this.handleKey(e));
  }

  // ── Output methods ──────────────────────────────────────────────

  print(html: string): void {
    const div = document.createElement('div');
    div.className = 'terminal-line';
    div.innerHTML = html;
    // Insert BEFORE the input line
    this.outputEl.insertBefore(div, this.inputLineEl);
    this.scrollToBottom();
  }

  printRaw(text: string, color?: string): void {
    const div = document.createElement('div');
    div.className = 'terminal-line';
    div.textContent = text;
    if (color) div.style.color = color;
    this.outputEl.insertBefore(div, this.inputLineEl);
    this.scrollToBottom();
  }

  async type(text: string, opts?: { color?: string; speed?: number }): Promise<void> {
    const div = document.createElement('div');
    div.className = 'terminal-line';
    if (opts?.color) div.style.color = opts.color;
    this.outputEl.insertBefore(div, this.inputLineEl);
    const speed = opts?.speed ?? 15;

    for (const char of text) {
      div.textContent += char;
      this.scrollToBottom();
      await sleep(speed + Math.random() * speed);
    }
  }

  printDivider(char = '─', len = 50): void {
    this.print(`<span class="t-dim">${char.repeat(len)}</span>`);
  }

  printBr(): void {
    this.print('');
  }

  /** Imports existing terminal lines from another element */
  importLines(lines: HTMLElement[]): void {
    lines.forEach(line => {
      const clone = line.cloneNode(true) as HTMLElement;
      this.outputEl.insertBefore(clone, this.inputLineEl);
    });
    this.scrollToBottom();
  }

  /** Clears the terminal — only the bare prompt line remains */
  clear(): void {
    // Remove everything except the inline input line
    Array.from(this.outputEl.children).forEach(child => {
      if (child !== this.inputLineEl) child.remove();
    });
    this.inputEl.value = '';
    this.inputEl.focus();
  }

  // ── Input methods ───────────────────────────────────────────────

  setPrompt(prompt: string): void {
    this.defaultPrompt = prompt;
    this.promptEl.innerHTML = `<span class="t-green">${this.escapeHtml(prompt)}</span>`;
  }

  focus(): void {
    this.inputEl.focus();
  }

  showInput(): void {
    this.inputLineEl.style.display = 'flex';
    this.scrollToBottom();
    this.inputEl.focus();
  }

  hideInput(): void {
    this.inputLineEl.style.display = 'none';
  }

  setCommandHandler(handler: (cmd: string, term: Terminal) => Promise<void>): void {
    this.commandHandler = handler;
    this.inputResolve = null;
    this.escapeHandler = null;
    this.isPasswordMode = false;
    this.inputEl.type = 'text';
    this.isBusy = false; // Exiting a busy lock so the new shell is immediately editable
    this._setInputPrompt(this.defaultPrompt);
    this.showInput();
  }

  /** Register a handler called when user presses Escape (for sub-shells) */
  onEscape(handler: () => void): void {
    this.escapeHandler = handler;
  }

  clearEscape(): void {
    this.escapeHandler = null;
  }

  readLine(prompt?: string): Promise<string> {
    const p = prompt ?? this.defaultPrompt;
    this._setInputPrompt(p);
    this.isPasswordMode = false;
    this.inputEl.type = 'text';
    this.inputEl.value = '';
    this.isBusy = false;
    this.showInput();
    return new Promise<string>(resolve => {
      this.inputResolve = resolve;
    });
  }

  readPassword(prompt?: string): Promise<string> {
    const p = prompt ?? this.defaultPrompt;
    this._setInputPrompt(p);
    this.isPasswordMode = true;
    this.inputEl.type = 'password';
    this.inputEl.value = '';
    this.isBusy = false;
    this.showInput();
    return new Promise<string>(resolve => {
      this.inputResolve = resolve;
    });
  }

  private _setInputPrompt(prompt: string): void {
    this.promptEl.innerHTML = `<span class="t-green">${this.escapeHtml(prompt)}</span>`;
  }

  get isBusy(): boolean { return this._isBusy; }
  set isBusy(val: boolean) {
    this._isBusy = val;
    this.inputEl.disabled = val;
  }

  // ── Key handling ────────────────────────────────────────────────

  private handleKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (this.escapeHandler) {
        const h = this.escapeHandler;
        this.escapeHandler = null;
        h();
      }
      return;
    }

    if (this._isBusy) { e.preventDefault(); return; }

    if (e.key === 'Enter') {
      const value = this.inputEl.value;

      // Echo the entered line into the output (above the input line)
      if (!this.isPasswordMode) {
        this.print(`<span class="t-green">${this.escapeHtml(this.defaultPrompt)}</span>${this.escapeHtml(value)}`);
      } else {
        this.print(`<span class="t-green">${this.escapeHtml(this.defaultPrompt)}</span>${'•'.repeat(value.length)}`);
      }
      this.inputEl.value = '';

      if (value.trim() && !this.isPasswordMode) {
        this.commandHistory.push(value);
        this.historyIndex = this.commandHistory.length;
      }

      if (this.inputResolve) {
        const resolve = this.inputResolve;
        this.inputResolve = null;
        this.isBusy = true;
        resolve(value);
      } else if (this.commandHandler) {
        const handler = this.commandHandler;
        this.isBusy = true;
        handler(value.trim(), this).finally(() => {
          this.isBusy = false;
          this.inputEl.disabled = false;
          this.inputEl.focus();
          this._setInputPrompt(this.defaultPrompt);
        });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.inputEl.value = this.commandHistory[this.historyIndex];
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (this.historyIndex < this.commandHistory.length - 1) {
        this.historyIndex++;
        this.inputEl.value = this.commandHistory[this.historyIndex];
      } else {
        this.historyIndex = this.commandHistory.length;
        this.inputEl.value = '';
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      this.clear();
    }
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      this.outputEl.scrollTop = this.outputEl.scrollHeight;
    }, 0);
  }
}

// ── Pane Manager ─────────────────────────────────────────────────

export class TerminalManager {
  private container: HTMLElement;
  private panes: Terminal[] = [];
  private columns: HTMLElement[] = [];
  private focusedIndex = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.classList.add('terminal-panes');
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'row';
  }

  createPane(): Terminal {
    if (this.columns.length === 0) {
      const col = this.createColumn();
      return this.addPaneToColumn(col);
    }

    const isVerticalSplit = this.panes.length % 2 === 1;
    if (isVerticalSplit) {
      const col = this.createColumn();
      return this.addPaneToColumn(col);
    } else {
      const activeTerm = this.panes[this.focusedIndex];
      let targetCol = activeTerm?.container.parentElement;
      if (!targetCol || !this.columns.includes(targetCol)) {
        targetCol = this.columns[this.columns.length - 1];
      }
      return this.addPaneToColumn(targetCol);
    }
  }

  private createColumn(): HTMLElement {
    const col = document.createElement('div');
    col.className = 'terminal-pane-col';
    col.style.cssText = 'flex:1;display:flex;flex-direction:column;min-width:0;min-height:0;gap:2px;';
    this.container.appendChild(col);
    this.columns.push(col);
    return col;
  }

  private addPaneToColumn(col: HTMLElement): Terminal {
    const paneEl = document.createElement('div');
    paneEl.style.cssText = 'flex:1;display:flex;flex-direction:column;min-height:0;min-width:0;';
    col.appendChild(paneEl);

    const term = new Terminal(paneEl);
    this.panes.push(term);

    paneEl.addEventListener('click', () => {
      this.focusPane(this.panes.indexOf(term));
    });

    this.focusPane(this.panes.length - 1);
    return term;
  }

  focusPane(index: number): void {
    this.panes.forEach((p, i) => {
      p.container.classList.toggle('focused', i === index);
    });
    this.focusedIndex = index;
    this.panes[index]?.focus();
  }

  getFocusedPane(): Terminal {
    return this.panes[this.focusedIndex] ?? this.panes[0];
  }

  closeFocusedPane(): void {
    if (this.panes.length <= 1) return;
    const pane = this.panes[this.focusedIndex];
    const col = pane.container.parentElement;

    pane.container.remove();
    this.panes.splice(this.focusedIndex, 1);

    if (col && col.children.length === 0) {
      col.remove();
      this.columns = this.columns.filter(c => c !== col);
    }

    this.focusedIndex = Math.min(this.focusedIndex, this.panes.length - 1);
    this.focusPane(this.focusedIndex);
  }

  cycleFocus(): void {
    this.focusPane((this.focusedIndex + 1) % this.panes.length);
  }

  getAllPanes(): Terminal[] {
    return [...this.panes];
  }
}
