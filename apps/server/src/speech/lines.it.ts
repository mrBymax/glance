import { type Allergen, type Product, type Profile, type Warning, localize } from '@glance/shared';
import type { Line } from '../sessions/types';
import { type LineTemplates, capitalize, hasAllergenWarning, nameAtStart, nameInside, sentences, startsWithBrand } from './lines.en';
import { numberToWords, spokenPrice } from './numbers';
import { answersWithNod, yesPhrases } from './phrases';

// The Italian text of each line. A native speaker of the team must read this file.
// No sentence agrees with the gender of a product name: "Aggiunto: bevanda di avena." names the product after a colon.
// The pronoun "lo" in "Spostalo" and "Sollevalo" stands for "il prodotto".

const AIM: Record<Extract<Line, { key: 'glance.partial' }>['aimHint'], string> = {
  left: "Spostalo un po' a sinistra.",
  right: "Spostalo un po' a destra.",
  up: "Spostalo un po' in alto.",
  down: "Spostalo un po' in basso.",
  closer: 'Avvicinalo.',
  farther: "Allontanalo un po'.",
  turn: 'Mostrami il davanti.',
};

/** The names of the 14 allergens in the Italian text of Annex II of Regulation (EU) No 1169/2011. */
const ALLERGENS: Record<Allergen, string> = {
  gluten: 'glutine',
  crustaceans: 'crostacei',
  eggs: 'uova',
  fish: 'pesce',
  peanuts: 'arachidi',
  soy: 'soia',
  milk: 'latte',
  nuts: 'frutta a guscio',
  celery: 'sedano',
  mustard: 'senape',
  sesame: 'sesamo',
  sulphites: 'solfiti',
  lupin: 'lupini',
  molluscs: 'molluschi',
};

const DIETS: Record<Extract<Warning, { kind: 'diet' }>['diet'], string> = { vegan: 'vegani', vegetarian: 'vegetariani' };

/** An Italian list has no comma before "e". */
function allergenList(allergens: readonly Allergen[]): string {
  const words = allergens.map((allergen) => ALLERGENS[allergen]);
  if (words.length <= 2) return words.join(' e ');
  return `${words.slice(0, -1).join(', ')} e ${words.at(-1)}`;
}

function itemCount(count: number, profile: Profile): string {
  return count === 1 ? 'un articolo' : `${numberToWords(count, profile.lang)} articoli`;
}

/** The count of a cart line, with a noun of its own, so that the number does not agree with the product name. */
function pieces(qty: number, profile: Profile): string {
  return qty === 1 ? 'un pezzo' : `${numberToWords(qty, profile.lang)} pezzi`;
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
        return `Attenzione: contiene ${allergenList(own.length > 0 ? own : warning.allergens)}.`;
      }
      case 'diet':
        return `Attenzione: non per ${DIETS[warning.diet]}.`;
      case 'allergenDataMissing':
        return 'Mancano i dati sugli allergeni di questo prodotto.';
    }
  }));
}

function total(totalCents: number, profile: Profile): string {
  return `Totale ${spokenPrice(totalCents, profile.lang, 'short')}.`;
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
    // As in English: no sentence for a product with no allergen data, and no second list after an allergen warning.
    const own = hasAllergenWarning(line.warnings) ? [] : product.allergens ?? [];
    const contains = own.length > 0 ? `Contiene ${allergenList(own)}.` : '';
    return sentences(`${fullName}, ${pack}, ${spokenPrice(product.priceCents, lang, 'full')}.`, contains, warning, hint);
  }
  const pack = localize(product.spokenPack, lang);
  return sentences(`${name}, ${pack}, ${spokenPrice(product.priceCents, lang, 'short')}.`, warning, hint);
}

/** The Italian text of each line of the table "Spoken lines" of Plan 1. */
export const LINES_IT: LineTemplates = {
  'session.start': () => 'Fotocamera accesa. Solleva un prodotto per sentire il prezzo.',
  'session.rest': () => 'Fotocamera spenta. Il carrello è al sicuro.',
  'glance.new': glanceNew,
  'glance.inCart': (line, profile) => {
    const phrases = yesPhrases(profile);
    const count = `Nel carrello: ${pieces(line.qty, profile)}.`;
    const warning = warningText(line.warnings, line.product, profile);
    return sentences(`${nameAtStart(line.product, profile)}.`, count, warning, phrases.addAnother, phrases.remove);
  },
  'glance.unknown': () => 'Non conosco questo prodotto.',
  // An Italian name starts with the words that look-alike products share, so the line names both products.
  'glance.ambiguous': (line, profile) => {
    const [first, second] = line.products;
    if (!first || !second) return 'Non riesco a distinguere questo prodotto. Mostrami il davanti.';
    return `Non distinguo tra ${nameInside(first, profile)} e ${nameInside(second, profile)}. Mostrami il davanti.`;
  },
  'glance.partial': (line) => `Ne vedo solo una parte. ${AIM[line.aimHint]}`,
  'glance.skipped': () => 'Saltato.',
  'cart.added': (line, profile) => {
    const added = `Aggiunto: ${nameInside(line.product, profile)}.`;
    if (line.budgetCents === null) return sentences(added, profile.detail === 'brief' ? '' : total(line.totalCents, profile));
    // The brief level also names the total here, because the budget sentence compares with it.
    const budget = `Hai superato il budget di ${spokenPrice(line.budgetCents, profile.lang, 'full')}.`;
    return sentences(added, total(line.totalCents, profile), budget);
  },
  'cart.removed': (line, profile) => sentences(
    `Tolto: ${nameInside(line.product, profile)}.`,
    profile.detail === 'brief' ? '' : total(line.totalCents, profile),
  ),
  'undo.nothing': () => 'Niente da annullare.',
  'hint.holdAgain': () => 'Sollevalo di nuovo.',
  'hint.holdAgainForAnother': () => 'Sollevalo di nuovo per aggiungerne ancora.',
  'hint.lookAtCode': (_line, profile) => `Guarda il codice della cassa, ${yesPhrases(profile).thenYes}.`,
  'checkout.offer': (line, profile) => sentences(
    `${line.kiosk.name}, ${line.kiosk.store}.`,
    `${capitalize(itemCount(line.itemCount, profile))}, ${spokenPrice(line.totalCents, profile.lang, 'full')}.`,
    yesPhrases(profile).pay,
  ),
  'checkout.empty': () => 'Il carrello è vuoto.',
  'checkout.busy': () => 'Questa cassa è occupata.',
  'checkout.cancelled': () => 'Pagamento annullato. Il carrello è al sicuro.',
  'checkout.paid': (line, profile) =>
    `Pagato. ${capitalize(spokenPrice(line.totalCents, profile.lang, 'full'))}. La ricevuta è sul telefono. Fotocamera spenta.`,
  'checkout.failed': () => 'Pagamento non riuscito. Nessun addebito. Guarda il codice per riprovare.',
  'checkout.biometric': () => "Oltre cinquanta euro. Conferma con l'impronta sul telefono.",
  'info.total': (line, profile) => `${capitalize(itemCount(line.itemCount, profile))}. ${total(line.totalCents, profile)}`,
  'info.cart': (line, profile) => sentences(
    ...line.items.map((item) => `${nameAtStart(item.product, profile)}, ${numberToWords(item.qty, profile.lang)}.`),
    line.more ? 'E altro sul telefono.' : '',
    total(line.totalCents, profile),
  ),
  'info.help': (_line, profile) => {
    if (answersWithNod(profile)) {
      return 'Solleva un prodotto per sentire il prezzo. Annuisci per aggiungerlo. Guarda il codice di una cassa e annuisci per pagare.';
    }
    const phrases = yesPhrases(profile);
    return `Solleva un prodotto per sentire il prezzo. ${phrases.add} Guarda il codice di una cassa. ${phrases.pay}`;
  },
  'device.cameraOff': () => 'Fotocamera spenta.',
  'device.regularCheckout': () => 'Fotocamera spenta. Usa una cassa normale.',
  'device.paused': () => 'In pausa. Tocca il lato degli occhiali per riprendere.',
  'device.battery': (line, profile) => `Batteria degli occhiali al ${numberToWords(line.percent, profile.lang)} per cento.`,
  'net.backOnline': () => 'Di nuovo online.',
  'recognition.slow': () => 'Il riconoscimento è lento in questo momento.',
  'ask.listening': () => 'Ti ascolto.',
  'ask.noProduct': () => 'Solleva un prodotto, poi chiedi.',
  'ask.failed': () => 'Non ho una risposta.',
  'ask.answer': (line) => line.text,
};
