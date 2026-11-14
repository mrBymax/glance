import type { Lang } from '@glance/shared';

/** Each string of the phone UI, in English. */
export const EN = {
  appTitle: 'Glance',
  idleHint: 'Hold a product up to hear its price.',
  add: 'Add',
  skip: 'Skip',
  addAnother: 'Add another',
  removeOne: 'Remove one',
  inCart: (qty: number) => `In your cart: ${qty}`,
  captions: 'Captions',
  noCaptions: 'Each line that the voice speaks shows here.',
  cart: 'Cart',
  cartEmpty: 'Your cart is empty.',
  cartLine: (packSize: string, qty: number, unit: string) => `${packSize}, ${qty} x ${unit}`,
  total: 'Total',
  items: (count: number) => (count === 1 ? '1 item' : `${count} items`),
  cartStatus: (count: number, total: string) => (count === 0 ? 'Cart: empty.' : `Cart: ${count === 1 ? '1 item' : `${count} items`}, ${total}.`),

  setupTitle: 'Set up Glance',
  setupSteps: 'Setup',
  loading: 'Starting Glance.',
  stepLink: 'Link glasses',
  stepCamera: 'Allow camera',
  stepReady: 'Ready',
  linkOpens: 'This opens the Meta AI app.',
  linkConfirm: 'Confirm there that Glance may connect to your glasses.',
  linkReturn: 'Meta AI then returns you to Glance.',
  linking: 'Waiting for Meta AI.',
  metaAiMissing: 'The Meta AI app is not on this phone. Install it, then return here.',
  getMetaAi: 'Get Meta AI',
  noInternet: 'No internet. Connect the phone, then try again.',
  tryAgain: 'Try again',
  cameraWhy: 'Glance uses the camera of your glasses to name the product that you hold. The phone blurs faces. No frame is stored.',
  cameraOpens: 'This opens the Meta AI app again.',
  cameraChoose: 'Choose Allow always or Allow once.',
  cameraDenied: 'The camera permission was denied. Glance cannot name a product without it.',
  readyText: 'Hold a product up to hear its price. Nod to add it. Look at a checkout code and nod to pay.',
  start: 'Start shopping',
};

export type Strings = typeof EN;

/** Returns the English strings for each language. No other language exists yet. */
export function stringsFor(_lang: Lang): Strings {
  return EN;
}
