import { formatEur } from '../engine.js';

const PHASES = ['scanning', 'detecting', 'pending', 'confirmed', 'added_idle'];

export const screenshotBeatSkin = {
  id: 'screenshot-beat',
  name: '2. App Screenshots (Per Beat)',
  description: 'Displays static PNG screenshots per clip phase inside the phone frame.',
  customUrls: {},
  probedUrls: {},

  probeDefaultScreenshots() {
    PHASES.forEach((phase) => {
      if (this.probedUrls[phase] !== undefined) return;
      const url = `./screenshots/${phase}.png`;
      const img = new Image();
      img.onload = () => {
        this.probedUrls[phase] = url;
        if (this.lastState && this.lastState.phase === phase) {
          this.render(this.lastState);
        }
      };
      img.onerror = () => {
        this.probedUrls[phase] = null;
      };
      img.src = url;
    });
  },

  assignFiles(files) {
    const list = Array.from(files || []).filter((file) => file.type.startsWith('image/'));
    if (!list.length) return;

    list.forEach((file) => {
      const lower = file.name.toLowerCase();
      const matched = PHASES.find((phase) => lower.includes(phase));
      const targetPhase = matched || (list.length === 1 ? this.currentPhase || 'scanning' : null);
      if (!targetPhase) return;

      if (this.customUrls[targetPhase]) {
        URL.revokeObjectURL(this.customUrls[targetPhase]);
      }
      this.customUrls[targetPhase] = URL.createObjectURL(file);
    });

    if (this.lastState) {
      this.render(this.lastState);
    }
  },

  mount(container) {
    this.container = container;
    this.currentPhase = 'scanning';
    this.lastState = null;

    container.innerHTML = `
      <div class="sb-root">
        <img class="sb-screenshot" data-ref="screenshot" alt="App screenshot" hidden>
        <div class="sb-overlay-bar" data-ref="overlay-bar" hidden>
          <span class="sb-overlay-phase" data-ref="overlay-phase">SCANNING</span>
          <button type="button" class="sb-replace-btn" data-ref="btn-replace">Swap PNG</button>
        </div>

        <div class="sb-placeholder" data-ref="placeholder">
          <div class="sb-placeholder-head">
            <span>SCREENSHOT SLOT</span>
            <span class="sb-phase-pill" data-ref="phase-pill">SCANNING</span>
          </div>
          <div class="sb-file-hint" data-ref="file-hint">./screenshots/scanning.png</div>
          <div class="sb-state-summary" data-ref="state-summary">Scanning shelf | Cart: 6.40 EUR</div>
          <button type="button" class="sb-upload-btn" data-ref="btn-upload">Load Screenshot for Beat</button>
          <p class="sb-sub-hint">Drop PNG here, or drop multiple files named scanning.png, pending.png, confirmed.png</p>
        </div>

        <input type="file" accept="image/*" multiple hidden data-ref="file-input">
      </div>
    `;

    this.refs = {};
    container.querySelectorAll('[data-ref]').forEach((el) => {
      this.refs[el.dataset.ref] = el;
    });

    const r = this.refs;
    const rootEl = container.querySelector('.sb-root');
    const openPicker = () => r['file-input'].click();

    r['btn-upload'].addEventListener('click', openPicker);
    r['btn-replace'].addEventListener('click', openPicker);
    r['file-input'].addEventListener('change', (event) => {
      this.assignFiles(event.target.files);
      event.target.value = '';
    });

    rootEl.addEventListener('dragover', (event) => {
      event.preventDefault();
      rootEl.classList.add('is-drag-over');
    });
    rootEl.addEventListener('dragleave', () => {
      rootEl.classList.remove('is-drag-over');
    });
    rootEl.addEventListener('drop', (event) => {
      event.preventDefault();
      rootEl.classList.remove('is-drag-over');
      this.assignFiles(event.dataTransfer ? event.dataTransfer.files : []);
    });

    this.probeDefaultScreenshots();
  },

  render(state) {
    const r = this.refs;
    if (!r) return;

    this.currentPhase = state.phase;
    this.lastState = state;

    const activeUrl = this.customUrls[state.phase] || this.probedUrls[state.phase] || null;

    if (activeUrl) {
      if (r['screenshot'].getAttribute('src') !== activeUrl) {
        r['screenshot'].src = activeUrl;
      }
      r['screenshot'].hidden = false;
      r['overlay-bar'].hidden = false;
      r['overlay-phase'].textContent = state.phase.toUpperCase();
      r['placeholder'].hidden = true;
      return;
    }

    r['screenshot'].hidden = true;
    r['overlay-bar'].hidden = true;
    r['placeholder'].hidden = false;
    r['phase-pill'].textContent = state.phase.toUpperCase();
    r['file-hint'].textContent = `./screenshots/${state.phase}.png`;

    if (state.prompt) {
      const p = state.prompt.product;
      r['state-summary'].textContent = `${p.name} (${formatEur(p.priceCents)}) | Cart: ${state.cart.totalFormatted}`;
    } else {
      r['state-summary'].textContent = `${state.phaseLabel} | Cart: ${state.cart.totalFormatted}`;
    }
  },

  unmount() {
    this.refs = null;
    this.lastState = null;
    this.container = null;
  },
};
