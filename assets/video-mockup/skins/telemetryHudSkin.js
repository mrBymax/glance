import { formatEur } from '../engine.js';

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function buildImuPolyline(samples, width, height) {
  if (!samples.length) return '';
  const maxAbs = 35;
  const stepX = width / Math.max(1, samples.length - 1);
  return samples
    .map((val, idx) => {
      const x = (idx * stepX).toFixed(1);
      const clamped = Math.max(-maxAbs, Math.min(maxAbs, val));
      const y = ((0.5 - clamped / (2 * maxAbs)) * height).toFixed(1);
      return `${x},${y}`;
    })
    .join(' ');
}

export const telemetryHudSkin = {
  id: 'telemetry-hud',
  name: '4. Dark Telemetry HUD',
  description: 'Engineering view showing vision crop, @glance/shared event payload, ElevenLabs bars, IMU trace, and Atlas cart.',

  mount(container) {
    this.container = container;
    this.lastEventType = '';
    this.lastCartSig = '';

    container.innerHTML = `
      <div class="th-root">
        <header class="th-header">
          <div class="th-title-group">
            <span class="th-led" aria-hidden="true"></span>
            <span class="th-title">TELEMETRY HUD</span>
            <span class="th-phase-badge" data-ref="phase-badge">SCANNING</span>
          </div>
          <div class="th-meta" data-ref="device-meta"></div>
        </header>

        <div class="th-grid">
          <section class="th-panel th-panel-vision">
            <div class="th-panel-head">
              <span>1. EDGE VISION</span>
              <span class="th-tag-green">BLUR ON | 0 STORED</span>
            </div>
            <div class="th-vision-body">
              <div class="th-crop-box" data-ref="crop-box">
                <div class="th-crop-inner">
                  <span class="th-crop-label" data-ref="crop-label">CROP 80% x 70%</span>
                  <span class="th-crop-sub" data-ref="crop-sub">Seq #1</span>
                </div>
              </div>
              <pre class="th-json-box" data-ref="json-box"></pre>
            </div>
          </section>

          <section class="th-panel th-panel-audio">
            <div class="th-panel-head">
              <span>2. ELEVENLABS VOICE STREAM</span>
              <span class="th-audio-state" data-ref="audio-state">STANDBY</span>
            </div>
            <div class="th-audio-bars" data-ref="audio-bars">
              <span></span><span></span><span></span><span></span><span></span><span></span>
              <span></span><span></span><span></span><span></span><span></span><span></span>
            </div>
            <div class="th-caption-box" data-ref="caption-box"></div>
          </section>

          <section class="th-panel th-panel-imu">
            <div class="th-panel-head">
              <span>3. DAT MOTION IMU (PITCH)</span>
              <span class="th-imu-val" data-ref="imu-val">0.0 deg/s</span>
            </div>
            <svg viewBox="0 0 260 76" class="th-imu-svg" preserveAspectRatio="none">
              <line x1="0" y1="38" x2="260" y2="38" class="th-midline" />
              <line x1="0" y1="18.4" x2="260" y2="18.4" class="th-thresh" />
              <line x1="0" y1="57.6" x2="260" y2="57.6" class="th-thresh" />
              <polyline points="" class="th-imu-line" data-ref="imu-line" />
            </svg>
            <div class="th-gate-row">
              <span data-ref="gate-label">HEAD WINDOW: LOCKED</span>
              <span data-ref="gate-time">0.0s</span>
            </div>
          </section>

          <section class="th-panel th-panel-cart">
            <div class="th-panel-head">
              <span>4. MONGODB ATLAS SESSION CART</span>
              <span class="th-cart-total" data-ref="cart-total"></span>
            </div>
            <div class="th-cart-list" data-ref="cart-list"></div>
          </section>
        </div>
      </div>
    `;

    this.refs = {};
    container.querySelectorAll('[data-ref]').forEach((el) => {
      this.refs[el.dataset.ref] = el;
    });
    this.barEls = Array.from(this.refs['audio-bars'].children);
  },

  render(state) {
    const r = this.refs;
    if (!r) return;

    r['phase-badge'].textContent = state.phaseLabel.toUpperCase();
    r['phase-badge'].dataset.phase = state.phase;
    r['device-meta'].textContent = `${state.device.model} | ${state.device.streamSpec} | t=${state.t.toFixed(2)}s`;

    r['crop-box'].dataset.status = state.vision.status;
    if (state.vision.status === 'identified') {
      r['crop-label'].textContent = `${state.prompt.product.name} (${Math.round(state.vision.confidence * 100)}%)`;
      r['crop-sub'].textContent = `Gemini ${state.vision.latencyMs}ms | Seq #${state.vision.seq}`;
    } else if (state.vision.status === 'sampling') {
      r['crop-label'].textContent = 'LOCKING SHARPEST FRAME';
      r['crop-sub'].textContent = `Seq #${state.vision.seq} -> Gemini Flash Lite`;
    } else {
      r['crop-label'].textContent = `CROP ${state.vision.cropPct}`;
      r['crop-sub'].textContent = `Seq #${state.vision.seq} | Status: none`;
    }

    if (state.lastEvent.type !== this.lastEventType) {
      this.lastEventType = state.lastEvent.type;
      r['json-box'].textContent = JSON.stringify(state.lastEvent.payload, null, 2);
    }

    r['audio-state'].textContent = state.speech.isSpeaking ? 'PLAYING CLIP' : 'STANDBY';
    r['audio-state'].dataset.speaking = state.speech.isSpeaking ? 'true' : 'false';

    this.barEls.forEach((bar, index) => {
      if (state.speech.isSpeaking) {
        const wave = Math.abs(Math.sin(state.t * 14 + index * 0.9)) * 75 + 20;
        bar.style.height = `${wave.toFixed(0)}%`;
        bar.dataset.active = 'true';
      } else {
        bar.style.height = '18%';
        bar.dataset.active = 'false';
      }
    });

    if (state.speech.isSpeaking) {
      const spoken = `<span class="th-cap-on">${escapeHtml(state.speech.revealedWords.join(' '))}</span>`;
      const pending =
        state.speech.hiddenWords.length > 0
          ? ` <span class="th-cap-off">${escapeHtml(state.speech.hiddenWords.join(' '))}</span>`
          : '';
      r['caption-box'].innerHTML = `${spoken}${pending}`;
    } else {
      const latest = state.speech.transcriptHistory[state.speech.transcriptHistory.length - 1];
      r['caption-box'].innerHTML = `<span class="th-cap-done">${escapeHtml(latest ? latest.text : '')}</span>`;
    }

    r['imu-val'].textContent = `${state.imu.pitchDegPerSec >= 0 ? '+' : ''}${state.imu.pitchDegPerSec.toFixed(1)} deg/s`;
    r['imu-line'].setAttribute('points', buildImuPolyline(state.imu.samples, 260, 76));
    r['imu-line'].dataset.triggered = state.imu.nodTriggered ? 'true' : 'false';

    if (state.imu.nodTriggered) {
      r['gate-label'].textContent = 'NOD DETECTED -> intent(head:yes)';
      r['gate-time'].textContent = 'CONFIRMED';
    } else if (state.prompt && state.prompt.state === 'pending') {
      r['gate-label'].textContent = 'HEAD WINDOW: ARMED (+/-18 deg/s)';
      r['gate-time'].textContent = `${state.prompt.headWindowSecLeft.toFixed(1)}s`;
    } else {
      r['gate-label'].textContent = 'HEAD WINDOW: LOCKED';
      r['gate-time'].textContent = 'IDLE';
    }

    const cartSig = `${state.cart.items.length}:${state.cart.totalCents}:${state.cart.justAddedId ?? ''}`;
    if (cartSig !== this.lastCartSig) {
      this.lastCartSig = cartSig;
      r['cart-total'].textContent = state.cart.totalFormatted;
      r['cart-list'].innerHTML = state.cart.items
        .map((item) => {
          const isNew = item.id === state.cart.justAddedId;
          return `
            <div class="th-cart-item ${isNew ? 'is-new' : ''}">
              <div>
                <div class="th-cart-name">${item.qty}x ${escapeHtml(item.name)}</div>
                <div class="th-cart-size">${escapeHtml(item.packSize)}</div>
              </div>
              <div class="th-cart-price">${formatEur(item.lineTotalCents)}</div>
            </div>
          `;
        })
        .join('');
    }
  },

  unmount() {
    this.refs = null;
    this.barEls = [];
    this.container = null;
  },
};
