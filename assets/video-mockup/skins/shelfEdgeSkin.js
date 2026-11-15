import { formatEur } from '../engine.js';

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export const shelfEdgeSkin = {
  id: 'shelf-edge',
  name: '3. Shelf Edge (Custom Store UI)',
  description: 'High-contrast store label and receipt layout from Reference Lock Direction A.',

  mount(container) {
    this.container = container;
    this.lastTranscriptSignature = '';
    this.lastCartSignature = '';

    container.innerHTML = `
      <div class="se-root">
        <header class="se-status-bar">
          <div class="se-brand-group">
            <span class="se-rec-dot" aria-hidden="true"></span>
            <span class="se-brand-title">META GLANCE</span>
            <span class="se-phase-pill" data-ref="phase-pill">SCANNING SHELF</span>
          </div>
          <div class="se-telemetry-strip" data-ref="status-meta"></div>
        </header>

        <section class="se-prompt-card" data-ref="prompt-card">
          <div class="se-prompt-idle" data-ref="idle-view">
            <div class="se-idle-kicker" data-ref="idle-kicker">LIVE STREAM VIEW</div>
            <div class="se-idle-headline" data-ref="idle-headline">Hold a product in view to hear its price.</div>
            <div class="se-idle-sub" data-ref="idle-sub">Frame crop 80% x 70% - Ignoring background shelf items</div>
          </div>

          <div class="se-prompt-active" data-ref="active-view" hidden>
            <div class="se-label-top">
              <div>
                <div class="se-product-brand" data-ref="product-brand"></div>
                <h2 class="se-product-name" data-ref="product-name"></h2>
                <div class="se-product-size" data-ref="product-size"></div>
              </div>
              <div class="se-price-col">
                <div class="se-price-tag">PRICE</div>
                <div class="se-price-value" data-ref="product-price"></div>
              </div>
            </div>

            <div class="se-allergen-rule" data-ref="allergen-row" hidden>
              <span class="se-allergen-badge">ALLERGEN</span>
              <span data-ref="allergen-text"></span>
            </div>

            <div class="se-consent-bar" data-ref="consent-bar">
              <div class="se-consent-head">
                <span class="se-consent-action" data-ref="consent-action">NOD TO ADD</span>
                <span class="se-consent-timer" data-ref="consent-timer">8.0s WINDOW</span>
              </div>
              <div class="se-window-track">
                <div class="se-window-fill" data-ref="window-fill"></div>
              </div>
              <div class="se-fallback-row">
                <button type="button" class="se-btn se-btn-primary" disabled>Add</button>
                <button type="button" class="se-btn" disabled>Skip</button>
                <span class="se-fallback-note">WCAG 2.5.4 Touch Fallback</span>
              </div>
            </div>

            <div class="se-confirm-stamp" data-ref="confirm-stamp" hidden>
              <span class="se-stamp-badge">ADDED TO CART - NOD CONFIRMED</span>
              <span class="se-stamp-meta" data-ref="undo-timer"></span>
            </div>
          </div>
        </section>

        <section class="se-captions-box">
          <div class="se-box-header">
            <span>VOICE CAPTIONS</span>
            <span class="se-speaking-badge" data-ref="speaking-badge">IDLE</span>
          </div>
          <div class="se-caption-live" data-ref="caption-live"></div>
          <div class="se-caption-history" data-ref="caption-history"></div>
        </section>

        <section class="se-ledger">
          <div class="se-ledger-head">
            <span>CART LEDGER</span>
            <span data-ref="cart-count"></span>
          </div>
          <div class="se-ledger-rows" data-ref="cart-rows"></div>
          <div class="se-ledger-total-row">
            <span class="se-total-label">TOTAL</span>
            <span class="se-total-value" data-ref="cart-total"></span>
          </div>
        </section>
      </div>
    `;

    this.refs = {};
    container.querySelectorAll('[data-ref]').forEach((el) => {
      this.refs[el.dataset.ref] = el;
    });
  },

  render(state) {
    const r = this.refs;
    if (!r) return;

    r['phase-pill'].textContent = state.phaseLabel.toUpperCase();
    r['status-meta'].textContent = `GLASSES ${state.device.batteryPct}% | BLUR ON | 0 FRAMES STORED`;

    const card = r['prompt-card'];
    card.dataset.phase = state.phase;

    if (!state.prompt) {
      r['idle-view'].hidden = false;
      r['active-view'].hidden = true;
      if (state.phase === 'detecting') {
        r['idle-kicker'].textContent = `FRAME #${state.vision.seq} LOCKED (${state.vision.cropPct})`;
        r['idle-headline'].textContent = 'Querying Gemini vision model...';
        r['idle-sub'].textContent = `Elapsed ${state.vision.latencyMs ?? 0} ms - 0 faces detected - No frame stored`;
      } else {
        r['idle-kicker'].textContent = `LIVE STREAM VIEW (FRAME #${state.vision.seq})`;
        r['idle-headline'].textContent = 'Hold a product in view to hear its price.';
        r['idle-sub'].textContent = `Crop ${state.vision.cropPct} - Skipping background shelf items`;
      }
    } else {
      r['idle-view'].hidden = true;
      r['active-view'].hidden = false;
      const { product, state: promptState, headWindowSecLeft, headWindowPct, undoSecLeft } = state.prompt;

      r['product-brand'].textContent = product.brand.toUpperCase();
      r['product-name'].textContent = product.name;
      r['product-size'].textContent = product.packSize;
      r['product-price'].textContent = formatEur(product.priceCents);

      if (product.warnings.length > 0) {
        r['allergen-row'].hidden = false;
        r['allergen-text'].textContent = product.warnings.join(' | ');
      } else {
        r['allergen-row'].hidden = true;
      }

      if (promptState === 'pending') {
        r['consent-bar'].hidden = false;
        r['confirm-stamp'].hidden = true;
        r['consent-action'].textContent = 'NOD TO ADD';
        r['consent-timer'].textContent = `${headWindowSecLeft.toFixed(1)}s WINDOW`;
        r['window-fill'].style.width = `${headWindowPct}%`;
      } else {
        r['consent-bar'].hidden = true;
        r['confirm-stamp'].hidden = false;
        r['undo-timer'].textContent = `Muted while in view - Shake to remove (${undoSecLeft.toFixed(1)}s)`;
      }
    }

    r['speaking-badge'].textContent = state.speech.isSpeaking ? 'SPEAKING' : 'QUIET';
    r['speaking-badge'].dataset.speaking = state.speech.isSpeaking ? 'true' : 'false';

    if (state.speech.isSpeaking) {
      const spokenHtml = `<span class="se-word-spoken">${escapeHtml(state.speech.revealedWords.join(' '))}</span>`;
      const pendingHtml =
        state.speech.hiddenWords.length > 0
          ? ` <span class="se-word-upcoming">${escapeHtml(state.speech.hiddenWords.join(' '))}</span>`
          : '';
      r['caption-live'].innerHTML = `${spokenHtml}${pendingHtml}`;
    } else {
      const latest = state.speech.transcriptHistory[state.speech.transcriptHistory.length - 1];
      r['caption-live'].innerHTML = `<span class="se-word-done">${escapeHtml(latest ? latest.text : '')}</span>`;
    }

    const histEntries = state.speech.transcriptHistory.slice(0, -1);
    const histSig = histEntries.map((item) => item.id).join('|');
    if (histSig !== this.lastTranscriptSignature) {
      this.lastTranscriptSignature = histSig;
      r['caption-history'].innerHTML = histEntries
        .slice(-1)
        .reverse()
        .map(
          (item) =>
            `<div class="se-hist-row"><span class="se-hist-time">${escapeHtml(item.timeLabel)}</span><span>${escapeHtml(item.text)}</span></div>`,
        )
        .join('');
    }

    const cartSig = `${state.cart.items.length}:${state.cart.totalCents}:${state.cart.justAddedId ?? ''}`;
    if (cartSig !== this.lastCartSignature) {
      this.lastCartSignature = cartSig;
      r['cart-count'].textContent = `${state.cart.itemCount} ITEMS`;
      r['cart-total'].textContent = state.cart.totalFormatted;
      r['cart-rows'].innerHTML = state.cart.items
        .map((item) => {
          const isNew = item.id === state.cart.justAddedId;
          return `
            <div class="se-ledger-item ${isNew ? 'is-new' : ''}">
              <span class="se-item-qty">${item.qty}x</span>
              <span class="se-item-name">${escapeHtml(item.name)} <small>${escapeHtml(item.packSize)}</small></span>
              ${isNew ? '<span class="se-item-badge">NEW</span>' : ''}
              <span class="se-item-price">${formatEur(item.lineTotalCents)}</span>
            </div>
          `;
        })
        .join('');
    }
  },

  unmount() {
    this.refs = null;
    this.container = null;
  },
};
