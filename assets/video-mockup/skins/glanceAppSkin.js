import { formatEur } from '../engine.js';

const VISIBLE_CAPTIONS = 4;

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function itemCount(cart) {
  return cart.items.reduce((sum, item) => sum + item.qty, 0);
}

function itemsLabel(count) {
  return count === 1 ? '1 item' : `${count} items`;
}

export const glanceAppSkin = {
  id: 'glance-app',
  name: '1. Glance App UI (PR #7)',
  description: 'Authentic @glance/phone-ui SessionScreen from PR #7 with Astryx Neutral theme tokens.',

  mount(container) {
    this.container = container;
    this.screenMode = 'session';
    this.themeMode = 'light';
    this.lastState = null;
    this.lastCaptionSig = '';
    this.lastCartSig = '';

    container.innerHTML = `
      <div class="ga-root" data-astryx-theme="light" data-screen="session" data-ref="root">
        <div class="ga-preview-bar" data-ref="preview-bar">
          <div class="ga-preview-group" role="group" aria-label="PR 7 screen">
            <button type="button" class="ga-preview-btn is-active" data-ga-screen="session">Session</button>
            <button type="button" class="ga-preview-btn" data-ga-screen="pocket">Pocket</button>
            <button type="button" class="ga-preview-btn" data-ga-screen="checkout">Pay</button>
            <button type="button" class="ga-preview-btn" data-ga-screen="setup">Setup</button>
          </div>
          <div class="ga-preview-group" role="group" aria-label="Theme mode">
            <button type="button" class="ga-preview-btn is-active" data-ga-theme="light">Light</button>
            <button type="button" class="ga-preview-btn" data-ga-theme="dark">Dark</button>
          </div>
        </div>

        <main class="ga-session astryx-vstack" data-ref="session-main">
          <h1 class="astryx-heading" data-level="1">Glance</h1>

          <div class="astryx-hstack ga-status-row" data-ref="status-row">
            <span class="astryx-text" data-type="supporting" data-ref="status-glasses">Glasses: Connected</span>
            <span class="astryx-text" data-type="supporting" data-ref="status-battery">Battery: 84%</span>
            <span class="astryx-text" data-type="supporting" data-ref="status-camera">Camera: On</span>
            <span class="astryx-text" data-type="supporting" data-ref="status-network">Network: Online</span>
          </div>

          <div data-ref="prompt-area">
            <span class="astryx-text" data-type="body" data-ref="idle-hint">Hold a product up to hear its price.</span>

            <div class="astryx-card" data-ref="prompt-card" hidden>
              <div class="astryx-vstack ga-card-stack">
                <h2 class="astryx-heading" data-level="2" data-ref="prompt-name"></h2>
                <span class="astryx-text" data-type="body" data-ref="prompt-pack"></span>
                <span class="astryx-text" data-type="display-1" data-ref="prompt-price"></span>
                <span class="astryx-text" data-type="body" data-ref="prompt-in-cart" hidden></span>

                <div class="astryx-banner" data-status="warning" role="status" data-ref="prompt-warning" hidden>
                  <svg class="ga-banner-icon" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                  <div class="astryx-banner-title" data-ref="prompt-warning-text"></div>
                </div>

                <button type="button" class="astryx-button" data-variant="primary" data-size="lg" data-width="full" data-ref="prompt-add-btn">Add</button>
                <button type="button" class="astryx-button" data-variant="secondary" data-size="lg" data-width="full" data-ref="prompt-skip-btn">Skip</button>
              </div>
            </div>
          </div>

          <section class="astryx-vstack ga-section-stack" data-ref="captions-section">
            <h2 class="astryx-heading" data-level="2">Captions</h2>
            <span class="astryx-text" data-type="body" data-ref="captions-empty" hidden>Each line that the voice speaks shows here.</span>
            <ul class="astryx-list ga-captions-list" data-ref="captions-list"></ul>
            <div>
              <button type="button" class="astryx-button" data-variant="secondary" data-size="sm" aria-label="Repeat the last line" data-ref="captions-repeat">Repeat</button>
            </div>
          </section>

          <section class="astryx-vstack ga-section-stack" data-ref="cart-section">
            <h2 class="astryx-heading" data-level="2">Cart</h2>
            <span class="astryx-text" data-type="body" data-ref="cart-empty" hidden>Your cart is empty.</span>
            <ul class="astryx-list" data-dividers="true" data-ref="cart-list"></ul>
            <div class="astryx-hstack ga-cart-total-row" data-ref="cart-total-row">
              <span class="astryx-text" data-weight="semibold">Total</span>
              <span class="astryx-text" data-weight="semibold" data-ref="cart-total-value"></span>
            </div>
          </section>

          <div class="astryx-hstack ga-action-row" data-ref="action-row">
            <button type="button" class="astryx-button ga-icon-btn" data-variant="secondary" data-size="sm" aria-label="Ask a question" data-ref="btn-ask">
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="2" width="6" height="12" rx="3"></rect>
                <path d="M5 10a7 7 0 0 0 14 0"></path>
                <line x1="12" y1="17" x2="12" y2="22"></line>
                <line x1="8" y1="22" x2="16" y2="22"></line>
              </svg>
              <span>Ask</span>
            </button>
            <button type="button" class="astryx-button" data-variant="secondary" data-size="sm" data-ref="btn-undo">Undo</button>
            <button type="button" class="astryx-button" data-variant="secondary" data-size="sm" data-ref="btn-pocket">Pocket mode</button>
            <button type="button" class="astryx-button" data-variant="secondary" data-size="sm" data-ref="btn-settings">Settings</button>
            <button type="button" class="astryx-button" data-variant="secondary" data-size="sm" data-ref="btn-end">End</button>
          </div>
        </main>

        <main class="pocket-surface" data-ref="pocket-screen" hidden>
          <h1 class="astryx-heading" data-level="1">Pocket mode</h1>
          <span class="astryx-text" data-type="display-1" data-ref="pocket-total">6.40 EUR</span>
          <span class="astryx-text" data-type="body" data-ref="pocket-items">3 items</span>
          <button type="button" class="astryx-button" data-variant="secondary" data-size="lg" data-ref="btn-unlock">Unlock</button>
        </main>

        <div class="ga-sheet-backdrop" data-ref="checkout-sheet" hidden>
          <div class="ga-bottom-sheet" role="dialog" aria-label="Checkout">
            <div class="ga-sheet-handle" aria-hidden="true"></div>
            <div class="astryx-vstack ga-card-stack">
              <h2 class="astryx-heading" data-level="2">Checkout 3 at Demo Market</h2>
              <span class="astryx-text" data-type="body" data-ref="checkout-items">3 items</span>
              <span class="astryx-text" data-type="display-1" data-ref="checkout-total">6.40 EUR</span>
              <button type="button" class="astryx-button" data-variant="primary" data-size="lg" data-width="full" data-ref="btn-pay">Pay</button>
              <button type="button" class="astryx-button" data-variant="secondary" data-size="lg" data-width="full" data-ref="btn-checkout-cancel">Cancel</button>
            </div>
          </div>
        </div>

        <main class="ga-setup astryx-vstack" data-ref="setup-screen" hidden>
          <h1 class="astryx-heading" data-level="1">Set up Glance</h1>
          <ol class="astryx-stepper">
            <li class="astryx-step is-done">
              <span class="astryx-step-dot" aria-hidden="true">1</span>
              <span class="astryx-step-label">Link glasses</span>
            </li>
            <li class="astryx-step is-done">
              <span class="astryx-step-dot" aria-hidden="true">2</span>
              <span class="astryx-step-label">Allow camera</span>
            </li>
            <li class="astryx-step is-active">
              <span class="astryx-step-dot" aria-hidden="true">3</span>
              <span class="astryx-step-label">Ready</span>
            </li>
          </ol>
          <section class="astryx-vstack ga-section-stack">
            <h2 class="astryx-heading" data-level="2">Ready</h2>
            <p class="astryx-text" data-type="body">Hold a product up to hear its price. Nod to add it. Look at a checkout code and nod to pay.</p>
            <button type="button" class="astryx-button" data-variant="primary" data-size="lg" data-width="full" data-ref="btn-setup-start">Start shopping</button>
          </section>
        </main>
      </div>
    `;

    this.refs = {};
    container.querySelectorAll('[data-ref]').forEach((el) => {
      this.refs[el.dataset.ref] = el;
    });

    const r = this.refs;
    const setScreen = (mode) => {
      this.screenMode = mode;
      this.applyViewModes();
    };
    const setTheme = (theme) => {
      this.themeMode = theme;
      this.applyViewModes();
    };

    container.querySelectorAll('[data-ga-screen]').forEach((btn) => {
      btn.addEventListener('click', () => setScreen(btn.dataset.gaScreen));
    });
    container.querySelectorAll('[data-ga-theme]').forEach((btn) => {
      btn.addEventListener('click', () => setTheme(btn.dataset.gaTheme));
    });

    r['btn-pocket'].addEventListener('click', () => setScreen('pocket'));
    r['btn-unlock'].addEventListener('click', () => setScreen('session'));
    r['btn-end'].addEventListener('click', () => setScreen('checkout'));
    r['btn-checkout-cancel'].addEventListener('click', () => setScreen('session'));
    r['btn-pay'].addEventListener('click', () => setScreen('session'));
    r['btn-settings'].addEventListener('click', () => setScreen('setup'));
    r['btn-setup-start'].addEventListener('click', () => setScreen('session'));

    this.applyViewModes();
  },

  applyViewModes() {
    const r = this.refs;
    if (!r || !this.container) return;

    r['root'].dataset.astryxTheme = this.themeMode;
    r['root'].dataset.screen = this.screenMode;

    r['session-main'].hidden = this.screenMode === 'pocket' || this.screenMode === 'setup';
    r['pocket-screen'].hidden = this.screenMode !== 'pocket';
    r['checkout-sheet'].hidden = this.screenMode !== 'checkout';
    r['setup-screen'].hidden = this.screenMode !== 'setup';

    this.container.querySelectorAll('[data-ga-screen]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.gaScreen === this.screenMode);
    });
    this.container.querySelectorAll('[data-ga-theme]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.gaTheme === this.themeMode);
    });
  },

  render(state) {
    const r = this.refs;
    if (!r) return;

    this.lastState = state;
    const battery = state.device?.batteryPct ?? 84;
    r['status-glasses'].textContent = 'Glasses: Connected';
    r['status-battery'].textContent = `Battery: ${battery}%`;
    r['status-camera'].textContent = 'Camera: On';
    r['status-network'].textContent = 'Network: Online';

    if (!state.prompt) {
      r['idle-hint'].hidden = false;
      r['prompt-card'].hidden = true;
    } else {
      r['idle-hint'].hidden = true;
      r['prompt-card'].hidden = false;

      const { product, state: promptState } = state.prompt;
      const existingItem = state.cart.items.find((item) => item.id === product.id);
      const existingQty = existingItem ? existingItem.qty : 0;
      const inCart = existingQty > 0;
      const isAnswered = promptState === 'accepted';
      const isConfirming = state.phase === 'confirmed';

      r['prompt-name'].textContent = product.name;
      r['prompt-pack'].textContent = product.packSize;
      r['prompt-price'].textContent = formatEur(product.priceCents);

      if (inCart) {
        r['prompt-in-cart'].hidden = false;
        r['prompt-in-cart'].textContent = `In your cart: ${existingQty}`;
      } else {
        r['prompt-in-cart'].hidden = true;
      }

      if (product.warnings && product.warnings.length > 0) {
        r['prompt-warning'].hidden = false;
        r['prompt-warning-text'].textContent = product.warnings[0];
      } else {
        r['prompt-warning'].hidden = true;
      }

      r['prompt-add-btn'].textContent = inCart ? 'Add another' : 'Add';
      r['prompt-add-btn'].disabled = isAnswered;
      r['prompt-add-btn'].classList.toggle('is-confirm-pulse', isConfirming);
      r['prompt-skip-btn'].textContent = inCart ? 'Remove one' : 'Skip';
      r['prompt-skip-btn'].disabled = isAnswered;
    }

    const captions = (state.speech?.transcriptHistory ?? []).slice(-VISIBLE_CAPTIONS);
    const captionSig = captions
      .map((entry) => `${entry.id}:${entry.isLive ? '1' : '0'}`)
      .join('|');

    if (captions.length === 0) {
      r['captions-empty'].hidden = false;
      r['captions-list'].hidden = true;
      r['captions-repeat'].hidden = true;
      this.lastCaptionSig = '';
    } else {
      r['captions-empty'].hidden = true;
      r['captions-list'].hidden = false;
      r['captions-repeat'].hidden = false;

      if (captionSig !== this.lastCaptionSig) {
        this.lastCaptionSig = captionSig;
        r['captions-list'].innerHTML = captions
          .map((entry) => {
            const cls = entry.isLive ? 'astryx-list-item is-speaking' : 'astryx-list-item';
            return `
              <li class="${cls}">
                <div class="astryx-list-item-content">
                  <div class="astryx-list-item-label">
                    <span class="astryx-text" data-type="body"><span lang="en">${escapeHtml(entry.text)}</span></span>
                  </div>
                </div>
              </li>
            `;
          })
          .join('');
      }
    }

    const count = itemCount(state.cart);
    const cartSig = `${state.cart.items.length}:${state.cart.totalCents}:${state.cart.justAddedId ?? ''}`;
    if (cartSig !== this.lastCartSig) {
      this.lastCartSig = cartSig;

      if (state.cart.items.length === 0) {
        r['cart-empty'].hidden = false;
        r['cart-list'].hidden = true;
        r['cart-total-row'].hidden = true;
        r['btn-undo'].hidden = true;
      } else {
        r['cart-empty'].hidden = true;
        r['cart-list'].hidden = false;
        r['cart-total-row'].hidden = false;
        r['btn-undo'].hidden = false;
        r['cart-total-value'].textContent = state.cart.totalFormatted;

        r['cart-list'].innerHTML = state.cart.items
          .map((item) => {
            const isNew = item.id === state.cart.justAddedId;
            const desc = `${item.packSize}, ${item.qty} x ${formatEur(item.unitPriceCents)}`;
            return `
              <li class="astryx-list-item ${isNew ? 'is-new-item' : ''}">
                <div class="astryx-list-item-content">
                  <div class="astryx-list-item-label">
                    <span class="astryx-text" data-type="body">${escapeHtml(item.name)}</span>
                  </div>
                  <div class="astryx-list-item-desc">
                    <span class="astryx-text" data-type="supporting">${escapeHtml(desc)}</span>
                  </div>
                </div>
                <button type="button" class="astryx-button" data-variant="secondary" data-size="sm" aria-label="Remove ${escapeHtml(item.name)}">Remove</button>
              </li>
            `;
          })
          .join('');
      }

      r['pocket-total'].textContent = state.cart.totalFormatted;
      r['pocket-items'].textContent = itemsLabel(count);
      r['checkout-total'].textContent = state.cart.totalFormatted;
      r['checkout-items'].textContent = itemsLabel(count);
    }
  },

  unmount() {
    this.refs = null;
    this.container = null;
    this.lastState = null;
    this.lastCaptionSig = '';
    this.lastCartSig = '';
  },
};
