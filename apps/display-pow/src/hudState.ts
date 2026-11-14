import { EMPTY_CART, cartTotalCents, formatEur } from '@glance/shared';
import type { Cart, ProductRef, ServerEvent, SessionSnapshot, Warning } from '@glance/shared';

export type PendingProduct = {
  promptId: string;
  mode: 'new' | 'inCart';
  product: ProductRef;
  warnings: Warning[];
  qtyInCart: number;
};

export type HudState = { cameraOn: boolean; pending: PendingProduct | null; cart: Cart; caption: string | null };

export const INITIAL_HUD_STATE: HudState = { cameraOn: false, pending: null, cart: EMPTY_CART, caption: null };

export function reduceHud(state: HudState, event: ServerEvent): HudState {
  switch (event.type) {
    case 'session.state':
      return { ...state, cameraOn: event.cameraOn, pending: event.cameraOn ? state.pending : null };
    case 'glance.pending':
      return {
        ...state,
        pending: {
          promptId: event.promptId,
          mode: event.kind,
          product: event.product,
          warnings: event.warnings,
          qtyInCart: event.qtyInCart,
        },
      };
    case 'glance.cleared':
      // A clear for an older prompt can arrive after a newer product. The newer product stays.
      return state.pending?.promptId === event.promptId ? { ...state, pending: null } : state;
    case 'glance.unknown':
    case 'glance.ambiguous':
    case 'checkout.offered':
    case 'checkout.paid':
      return { ...state, pending: null };
    case 'cart.updated':
      return { ...state, cart: event.cart };
    case 'caption':
      return { ...state, caption: event.text };
    case 'error':
      return { ...state, caption: event.message };
    default:
      return state;
  }
}

export function hudFromSnapshot(snapshot: SessionSnapshot): HudState {
  const prompt = snapshot.prompt;
  return {
    cameraOn: snapshot.cameraOn,
    pending: prompt?.kind === 'product'
      ? {
          promptId: prompt.promptId,
          mode: prompt.mode,
          product: prompt.product,
          warnings: prompt.warnings,
          qtyInCart: prompt.qtyInCart,
        }
      : null,
    cart: snapshot.cart,
    caption: snapshot.captions.at(-1)?.text ?? null,
  };
}

export type HudView = {
  cameraLabel: 'Camera on' | 'Camera off';
  title: string;
  price: string | null;
  warnings: string[];
  prompt: string;
  total: string;
  caption: string | null;
  canAnswer: boolean;
  yesTitle: 'Add';
  noTitle: 'Skip' | 'Remove';
};

function warningLine(warning: Warning): string {
  switch (warning.kind) {
    case 'allergen':
      return `Warning: contains ${warning.allergens.join(', ')}.`;
    case 'diet':
      return `Warning: not ${warning.diet}.`;
    case 'allergenDataMissing':
      return 'Allergen data is missing for this product.';
  }
}

function promptLine(state: HudState): string {
  if (!state.cameraOn) return 'Start the camera on your phone.';
  if (state.pending === null) return 'Hold a product up to hear its price.';
  if (state.pending.mode === 'inCart') return `${state.pending.qtyInCart} in your cart. Add another?`;
  return 'Add to cart?';
}

export function hudView(state: HudState): HudView {
  const { pending, cart } = state;
  const itemCount = cart.items.reduce((count, item) => count + item.qty, 0);
  return {
    cameraLabel: state.cameraOn ? 'Camera on' : 'Camera off',
    title: pending ? `${pending.product.name}, ${pending.product.packSize}` : 'No product in view',
    price: pending ? `${formatEur(pending.product.priceCents)} EUR` : null,
    warnings: pending ? pending.warnings.map(warningLine) : [],
    prompt: promptLine(state),
    total: `${formatEur(cart.totalCents)} EUR, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`,
    caption: state.caption,
    canAnswer: pending !== null,
    yesTitle: 'Add',
    noTitle: pending?.mode === 'inCart' ? 'Remove' : 'Skip',
  };
}

function withItems(items: Cart['items']): Cart {
  return { items, totalCents: cartTotalCents(items) };
}

function addOne(cart: Cart, product: ProductRef): Cart {
  if (cart.items.some((item) => item.productId === product.id)) {
    return withItems(cart.items.map((item) => (item.productId === product.id ? { ...item, qty: item.qty + 1 } : item)));
  }
  const line = { productId: product.id, name: product.name, packSize: product.packSize, qty: 1, unitPriceCents: product.priceCents };
  return withItems([...cart.items, line]);
}

/** Returns null when the cart has no line for the product. */
function removeOne(cart: Cart, productId: string): Cart | null {
  if (!cart.items.some((item) => item.productId === productId)) return null;
  return withItems(
    cart.items
      .map((item) => (item.productId === productId ? { ...item, qty: item.qty - 1 } : item))
      .filter((item) => item.qty > 0),
  );
}

/**
 * Plays the server for the recorded mode, which has no server. A live session never calls it.
 * The events have the order of the server: the clear, then the cart change, then the caption.
 */
export function mockAnswer(state: HudState, kind: 'yes' | 'no'): ServerEvent[] {
  const pending = state.pending;
  if (pending === null) return [];
  const { product, promptId } = pending;
  const cleared: ServerEvent = { type: 'glance.cleared', promptId };
  const caption = (text: string): ServerEvent =>
    ({ type: 'caption', id: `mock-${promptId}-${kind}`, text, lang: 'en', priority: 'normal', url: null });
  const changed = (change: 'add' | 'remove', cart: Cart, word: string): ServerEvent[] => [
    cleared,
    { type: 'cart.updated', cart, change: { kind: change, productId: product.id, name: product.name } },
    caption(`${word}: ${product.name}. Total ${formatEur(cart.totalCents)} EUR.`),
  ];

  if (kind === 'yes') return changed('add', addOne(state.cart, product), 'Added');
  const smaller = pending.mode === 'inCart' ? removeOne(state.cart, product.id) : null;
  if (smaller !== null) return changed('remove', smaller, 'Removed');
  return [cleared, caption('Skipped.')];
}
