import { formatEur } from '../engine.js';

// Swap this skeleton with the final design system by replacing the slot markup
// and CSS custom properties below. Keep mount/render/unmount unchanged.
export const customSlotSkin = {
  id: 'custom-slot',
  name: '5. Custom Design Skeleton',
  description: 'Minimal 5-slot template ready to drop in final components without changing engine timing.',

  mount(container) {
    this.container = container;
    container.innerHTML = `
      <div class="cs-root">
        <div class="cs-slot" data-slot="status">
          <div class="cs-slot-tag">data-slot="status"</div>
          <div class="cs-slot-value" data-bind="status"></div>
        </div>

        <div class="cs-slot" data-slot="prompt">
          <div class="cs-slot-tag">data-slot="prompt"</div>
          <div class="cs-slot-value" data-bind="prompt"></div>
        </div>

        <div class="cs-slot" data-slot="captions">
          <div class="cs-slot-tag">data-slot="captions"</div>
          <div class="cs-slot-value" data-bind="captions"></div>
        </div>

        <div class="cs-slot" data-slot="imu">
          <div class="cs-slot-tag">data-slot="imu"</div>
          <div class="cs-slot-value" data-bind="imu"></div>
        </div>

        <div class="cs-slot" data-slot="cart">
          <div class="cs-slot-tag">data-slot="cart"</div>
          <div class="cs-slot-value" data-bind="cart"></div>
        </div>
      </div>
    `;

    this.binds = {};
    container.querySelectorAll('[data-bind]').forEach((el) => {
      this.binds[el.dataset.bind] = el;
    });
  },

  render(state) {
    const b = this.binds;
    if (!b) return;

    b.status.textContent = `${state.phaseLabel} | ${state.device.model} | ${state.device.batteryPct}%`;

    if (!state.prompt) {
      b.prompt.textContent = `Vision: ${state.vision.status} (frame #${state.vision.seq})`;
    } else {
      const p = state.prompt.product;
      b.prompt.textContent = `${p.name} (${p.packSize}) - ${formatEur(p.priceCents)} [${state.prompt.state}]`;
    }

    if (state.speech.isSpeaking) {
      b.captions.textContent = state.speech.revealedWords.join(' ');
    } else {
      const latest = state.speech.transcriptHistory[state.speech.transcriptHistory.length - 1];
      b.captions.textContent = latest ? latest.text : 'Idle';
    }

    b.imu.textContent = `Pitch: ${state.imu.pitchDegPerSec.toFixed(1)} deg/s | Nod triggered: ${state.imu.nodTriggered}`;
    b.cart.textContent = `${state.cart.itemCount} items | Total: ${state.cart.totalFormatted}`;
  },

  unmount() {
    this.binds = null;
    this.container = null;
  },
};
