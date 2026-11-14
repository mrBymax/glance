import { type Product, type Profile, type Warning, localize } from '@glance/shared';
import type { Line } from '../sessions/types';
import { numberToWords, spokenPrice } from './numbers';
import { answersWithNod, yesPhrases } from './phrases';

export type LineTemplates = { [K in Line['key']]: (line: Extract<Line, { key: K }>, profile: Profile) => string };

const AIM: Record<Extract<Line, { key: 'glance.partial' }>['aimHint'], string> = {
  left: 'Move it left a little.',
  right: 'Move it right a little.',
  up: 'Move it up a little.',
  down: 'Move it down a little.',
  closer: 'Bring it closer.',
  farther: 'Move it back a little.',
  turn: 'Turn the front to me.',
};

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Joins the sentences that are not empty. */
function sentences(...parts: string[]): string {
  return parts.filter((part) => part !== '').join(' ');
}

function startsWithBrand(name: string, product: Product): boolean {
  return name.toLowerCase().startsWith(product.brand.toLowerCase());
}

function nameAtStart(product: Product, profile: Profile): string {
  return localize(product.spokenName, profile.lang);
}

/** A brand keeps its capital letter. Each other name starts in lower case inside a sentence. */
function nameInside(product: Product, profile: Profile): string {
  const name = nameAtStart(product, profile);
  return startsWithBrand(name, product) ? name : name.charAt(0).toLowerCase() + name.slice(1);
}

function itemCount(count: number, profile: Profile): string {
  return `${numberToWords(count, profile.lang)} ${count === 1 ? 'item' : 'items'}`;
}

function wordList(words: readonly string[]): string {
  if (words.length <= 2) return words.join(' and ');
  return `${words.slice(0, -1).join(', ')}, and ${words.at(-1)}`;
}

/** The list of a warning has no comma before "and", as the warning on the phone has none. */
function warningList(words: readonly string[]): string {
  if (words.length <= 2) return words.join(' and ');
  return `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}

function hasAllergenWarning(warnings: readonly Warning[]): boolean {
  return warnings.some((warning) => warning.kind === 'allergen');
}

/**
 * One sentence for each warning. No sentence says that a product is safe.
 * At the detailed level an allergen warning names each allergen of the product, not only those of the profile.
 */
function warningText(warnings: readonly Warning[], product: Product, profile: Profile): string {
  return sentences(...warnings.map((warning) => {
    switch (warning.kind) {
      case 'allergen': {
        const own = profile.detail === 'detailed' ? product.allergens ?? [] : [];
        return `Warning: contains ${warningList(own.length > 0 ? own : warning.allergens)}.`;
      }
      case 'diet':
        return `Warning: not ${warning.diet}.`;
      case 'allergenDataMissing':
        return 'Allergen data is missing for this product.';
    }
  }));
}

function total(totalCents: number, profile: Profile): string {
  return `Total ${spokenPrice(totalCents, profile.lang, 'short')}.`;
}

function glanceNew(line: Extract<Line, { key: 'glance.new' }>, profile: Profile): string {
  const { product } = line;
  const { lang } = profile;
  const name = nameAtStart(product, profile);
  const hint = line.hint ? yesPhrases(profile).add : '';
  const warning = warningText(line.warnings, product, profile);

  if (profile.detail === 'brief') {
    return sentences(`${name}, ${spokenPrice(product.priceCents, lang, 'short')}.`, warning, hint);
  }
  if (profile.detail === 'detailed') {
    const fullName = startsWithBrand(name, product) ? name : `${product.brand} ${nameInside(product, profile)}`;
    const pack = localize(product.spokenPackDetailed, lang);
    // A product with no allergen data gets no sentence. The voice never says that a product is safe.
    // An allergen warning names each allergen of the product, so the Contains sentence would say it two times.
    const own = hasAllergenWarning(line.warnings) ? [] : product.allergens ?? [];
    const contains = own.length > 0 ? `Contains ${wordList(own)}.` : '';
    return sentences(`${fullName}, ${pack}, ${spokenPrice(product.priceCents, lang, 'full')}.`, contains, warning, hint);
  }
  const pack = localize(product.spokenPack, lang);
  return sentences(`${name}, ${pack}, ${spokenPrice(product.priceCents, lang, 'short')}.`, warning, hint);
}

/** The table "Spoken lines" of Plan 1, with its text rules. */
export const LINES_EN: LineTemplates = {
  'session.start': () => 'Camera on. Hold a product up to hear its price.',
  'session.rest': () => 'Camera off. Your cart is safe.',
  'glance.new': glanceNew,
  'glance.inCart': (line, profile) => {
    const phrases = yesPhrases(profile);
    const count = `${capitalize(numberToWords(line.qty, profile.lang))} ${line.qty === 1 ? 'is' : 'are'} in your cart.`;
    const warning = warningText(line.warnings, line.product, profile);
    return sentences(`${nameAtStart(line.product, profile)}.`, count, warning, phrases.addAnother, phrases.remove);
  },
  'glance.unknown': () => 'I do not know this product.',
  'glance.partial': (line) => `I can see part of it. ${AIM[line.aimHint]}`,
  'glance.skipped': () => 'Skipped.',
  'cart.added': (line, profile) => sentences(
    `Added ${nameInside(line.product, profile)}.`,
    profile.detail === 'brief' ? '' : total(line.totalCents, profile),
  ),
  'cart.removed': (line, profile) => sentences(
    `Removed ${nameInside(line.product, profile)}.`,
    profile.detail === 'brief' ? '' : total(line.totalCents, profile),
  ),
  'undo.nothing': () => 'Nothing to undo.',
  'hint.holdAgain': () => 'Hold it up again.',
  'hint.holdAgainForAnother': () => 'Hold it up again to add another.',
  'hint.lookAtCode': (_line, profile) => `Look at the checkout code, ${yesPhrases(profile).thenYes}.`,
  'checkout.offer': (line, profile) => sentences(
    `${line.kiosk.name} at ${line.kiosk.store}.`,
    `${capitalize(itemCount(line.itemCount, profile))}, ${spokenPrice(line.totalCents, profile.lang, 'full')}.`,
    yesPhrases(profile).pay,
  ),
  'checkout.empty': () => 'Your cart is empty.',
  'checkout.busy': () => 'This checkout is busy.',
  'checkout.cancelled': () => 'Checkout cancelled. Your cart is safe.',
  'checkout.paid': (line, profile) =>
    `Paid. ${capitalize(spokenPrice(line.totalCents, profile.lang, 'full'))}. Your receipt is on your phone. Camera off.`,
  'checkout.failed': () => 'Payment failed. Nothing was charged. Look at the code to try again.',
  'info.total': (line, profile) => `${capitalize(itemCount(line.itemCount, profile))}. ${total(line.totalCents, profile)}`,
  'info.cart': (line, profile) => sentences(
    ...line.items.map((item) => `${nameAtStart(item.product, profile)}, ${numberToWords(item.qty, profile.lang)}.`),
    line.more ? 'And more on your phone.' : '',
    total(line.totalCents, profile),
  ),
  'info.help': (_line, profile) => {
    if (answersWithNod(profile)) {
      return 'Hold a product up to hear its price. Nod to add it. Look at a checkout code and nod to pay.';
    }
    const phrases = yesPhrases(profile);
    return `Hold a product up to hear its price. ${phrases.add} Look at a checkout code. ${phrases.pay}`;
  },
  'device.cameraOff': () => 'Camera off.',
  'device.regularCheckout': () => 'Camera off. Please use a regular checkout.',
  'device.paused': () => 'Paused. Tap the side of your glasses to resume.',
  'device.battery': (line, profile) => `Glasses battery at ${numberToWords(line.percent, profile.lang)} percent.`,
  'net.backOnline': () => 'Back online.',
  'recognition.slow': () => 'Recognition is slow right now.',
};
