import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { DEFAULT_PROFILE, EU_ALLERGENS, type ProfilePatch, type Warning } from '@glance/shared';
import { indexCatalog, readCatalogFile } from '../catalog/catalog';
import { scannedProduct } from '../products/scanned';
import { LINE_DEFAULTS } from '../sessions/say';
import type { Line } from '../sessions/types';
import { LINES_EN } from './lines.en';
import { LINES_IT } from './lines.it';
import { renderLine } from './render';

const catalog = indexCatalog(readCatalogFile(fileURLToPath(new URL('../../catalog/catalog.dev.json', import.meta.url))));
const oat = catalog.get('oat-drink-1l')!;
const rye = catalog.get('rye-bread')!;
const crisps = catalog.get('potato-crisps')!;
const KIOSK = { id: 'kiosk-1', name: 'Checkout 3', store: 'Demo Market' };
const text = (line: Line, patch: ProfilePatch = {}) => renderLine(line, { ...DEFAULT_PROFILE, ...patch });
const glance = (hint: boolean): Line => ({ key: 'glance.new', product: oat, hint, warnings: [] });
const inCart = (qty: number): Line => ({ key: 'glance.inCart', product: oat, qty, warnings: [] });
const added: Line = { key: 'cart.added', product: oat, totalCents: 449, budgetCents: null };

it('speaks the lines of spec section 6.1 at the standard level', () => {
  expect(text(glance(false))).toBe('Oat drink, one litre, one eighty-nine.');
  expect(text(glance(true))).toBe('Oat drink, one litre, one eighty-nine. Nod to add.');
  expect(text(added)).toBe('Added oat drink. Total four forty-nine.');
  expect(text({ key: 'cart.removed', product: oat, totalCents: 260 })).toBe('Removed oat drink. Total two sixty.');
  expect(text(inCart(1))).toBe('Oat drink. One is in your cart. Nod to add another. Shake to remove.');
  expect(text(inCart(2))).toBe('Oat drink. Two are in your cart. Nod to add another. Shake to remove.');
  expect(text({ key: 'glance.partial', aimHint: 'left' })).toBe('I can see part of it. Move it left a little.');
  expect(text({ key: 'checkout.offer', kiosk: KIOSK, itemCount: 3, totalCents: 639 }))
    .toBe('Checkout 3 at Demo Market. Three items, six euros thirty-nine. Nod to pay.');
  expect(text({ key: 'checkout.paid', totalCents: 639 }))
    .toBe('Paid. Six euros thirty-nine. Your receipt is on your phone. Camera off.');
  expect(text({ key: 'hint.lookAtCode' })).toBe('Look at the checkout code, then nod.');
  expect(text({ key: 'info.help' }))
    .toBe('Hold a product up to hear its price. Nod to add it. Look at a checkout code and nod to pay.');
  expect(text({ key: 'device.battery', percent: 20 })).toBe('Glasses battery at twenty percent.');
});
it('speaks each fixed line of the table', () => {
  const fixed = {
    'session.start': 'Camera on. Hold a product up to hear its price.',
    'session.rest': 'Camera off. Your cart is safe.',
    'glance.unknown': 'I do not know this product.',
    'glance.skipped': 'Skipped.',
    'undo.nothing': 'Nothing to undo.',
    'hint.holdAgain': 'Hold it up again.',
    'hint.holdAgainForAnother': 'Hold it up again to add another.',
    'checkout.empty': 'Your cart is empty.',
    'checkout.busy': 'This checkout is busy.',
    'checkout.cancelled': 'Checkout cancelled. Your cart is safe.',
    'checkout.failed': 'Payment failed. Nothing was charged. Look at the code to try again.',
    'device.cameraOff': 'Camera off.',
    'device.regularCheckout': 'Camera off. Please use a regular checkout.',
    'device.paused': 'Paused. Tap the side of your glasses to resume.',
    'net.backOnline': 'Back online.',
    'recognition.slow': 'Recognition is slow right now.',
    'barcode.notInStore': 'This product is not in this store.',
    'barcode.unreadable': 'I cannot read this code. Hold it closer.',
  };
  for (const [key, line] of Object.entries(fixed)) expect(text({ key } as Line)).toBe(line);
});
it('has one template for each line key', () => {
  expect(Object.keys(LINES_EN).sort()).toEqual(Object.keys(LINE_DEFAULTS).sort());
});
it('speaks each aim hint', () => {
  const second = (aimHint: Extract<Line, { key: 'glance.partial' }>['aimHint']) =>
    text({ key: 'glance.partial', aimHint }).replace('I can see part of it. ', '');
  expect(second('right')).toBe('Move it right a little.');
  expect(second('up')).toBe('Move it up a little.');
  expect(second('down')).toBe('Move it down a little.');
  expect(second('closer')).toBe('Bring it closer.');
  expect(second('farther')).toBe('Move it back a little.');
  expect(second('turn')).toBe('Turn the front to me.');
});
it('speaks the brief and the detailed level', () => {
  expect(text(glance(false), { detail: 'brief' })).toBe('Oat drink, one eighty-nine.');
  expect(text(added, { detail: 'brief' })).toBe('Added oat drink.');
  expect(text({ key: 'cart.removed', product: oat, totalCents: 260 }, { detail: 'brief' })).toBe('Removed oat drink.');
  expect(text(glance(false), { detail: 'detailed' }))
    .toBe('Oatly oat drink, one litre carton, one euro eighty-nine. Contains gluten.');
  expect(text(glance(true), { detail: 'detailed' }))
    .toBe('Oatly oat drink, one litre carton, one euro eighty-nine. Contains gluten. Nod to add.');
});
it('names no allergen at the detailed level when the product has no allergen data', () => {
  expect(text({ key: 'glance.new', product: crisps, hint: false, warnings: [] }, { detail: 'detailed' }))
    .toBe('Demo Snacks potato crisps, one hundred fifty gram bag, one euro ninety.');
});
it('leaves the brand out when the name starts with it', () => {
  const branded = { ...oat, spokenName: { en: 'Oatly oat drink' }, allergens: ['gluten' as const, 'soy' as const, 'nuts' as const] };
  expect(text({ key: 'glance.new', product: branded, hint: false, warnings: [] }, { detail: 'detailed' }))
    .toBe('Oatly oat drink, one litre carton, one euro eighty-nine. Contains gluten, soy, and nuts.');
  expect(text({ key: 'cart.added', product: branded, totalCents: 189, budgetCents: null }))
    .toBe('Added Oatly oat drink. Total one eighty-nine.');
});
it('never shortens the pay prompt', () => {
  expect(text({ key: 'checkout.offer', kiosk: KIOSK, itemCount: 1, totalCents: 260 }, { detail: 'brief' }))
    .toBe('Checkout 3 at Demo Market. One item, two euros sixty. Nod to pay.');
});
it('names the main yes input of the shopper', () => {
  expect(text(glance(true), { mainYes: 'touch' })).toBe('Oat drink, one litre, one eighty-nine. Double tap to add.');
  expect(text(glance(true), { mainYes: 'voice' })).toBe('Oat drink, one litre, one eighty-nine. Say add.');
  expect(text(glance(true), { mainYes: 'phone' })).toBe('Oat drink, one litre, one eighty-nine. Press Add on your phone.');
  expect(text(glance(true), { yesGesture: 'shake' })).toBe('Oat drink, one litre, one eighty-nine. Shake to add.');
  expect(text(glance(true), { headGestures: false })).toBe('Oat drink, one litre, one eighty-nine. Press Add on your phone.');
  expect(text(inCart(1), { yesGesture: 'shake' })).toBe('Oat drink. One is in your cart. Shake to add another. Nod to remove.');
  expect(text(inCart(1), { mainYes: 'touch' })).toBe('Oat drink. One is in your cart. Double tap to add another.');
  expect(text(inCart(1), { mainYes: 'key' }))
    .toBe('Oat drink. One is in your cart. Press volume up to add another. Press volume down to remove.');
  expect(text({ key: 'hint.lookAtCode' }, { mainYes: 'key' })).toBe('Look at the checkout code, then press volume up.');
  expect(text({ key: 'info.help' }, { mainYes: 'touch' }))
    .toBe('Hold a product up to hear its price. Double tap to add. Look at a checkout code. Double tap to pay.');
  expect(text({ key: 'checkout.offer', kiosk: KIOSK, itemCount: 1, totalCents: 260 }, { mainYes: 'voice' }))
    .toBe('Checkout 3 at Demo Market. One item, two euros sixty. Say pay.');
});
it('reads the cart and the total', () => {
  const items = [{ product: rye, qty: 1 }, { product: oat, qty: 2 }];
  expect(text({ key: 'info.cart', items, more: false, totalCents: 638 }))
    .toBe('Rye bread, one. Oat drink, two. Total six thirty-eight.');
  expect(text({ key: 'info.cart', items, more: true, totalCents: 638 }))
    .toBe('Rye bread, one. Oat drink, two. And more on your phone. Total six thirty-eight.');
  expect(text({ key: 'info.total', itemCount: 3, totalCents: 639 })).toBe('Three items. Total six thirty-nine.');
  expect(text({ key: 'info.total', itemCount: 1, totalCents: 189 })).toBe('One item. Total one eighty-nine.');
});
it('speaks Italian lines', () => {
  const italian = (line: Line) => renderLine(line, { ...DEFAULT_PROFILE, lang: 'it' });
  expect(italian({ key: 'session.start' })).toBe('Fotocamera accesa. Solleva un prodotto per sentire il prezzo.');
  expect(italian(glance(false))).toBe('Bevanda di avena, un litro, uno e ottantanove.');
  expect(italian(glance(true))).toBe('Bevanda di avena, un litro, uno e ottantanove. Annuisci per aggiungere.');
  expect(italian(added)).toBe('Aggiunto: bevanda di avena. Totale quattro e quarantanove.');
  expect(italian({ key: 'checkout.offer', kiosk: KIOSK, itemCount: 3, totalCents: 639 }))
    .toBe('Checkout 3, Demo Market. Tre articoli, sei euro e trentanove. Annuisci per pagare.');
});

const it_ = (line: Line, patch: ProfilePatch = {}) => text(line, { ...patch, lang: 'it' });

it('has one Italian template for each line key', () => {
  expect(Object.keys(LINES_IT).sort()).toEqual(Object.keys(LINE_DEFAULTS).sort());
});
it('gives an Italian text that differs from the English text for each line with no parameter', () => {
  const fixed: Line[] = [
    { key: 'session.start' }, { key: 'session.rest' }, { key: 'glance.unknown' }, { key: 'glance.skipped' }, { key: 'undo.nothing' },
    { key: 'hint.holdAgain' }, { key: 'hint.holdAgainForAnother' }, { key: 'hint.lookAtCode' }, { key: 'checkout.empty' },
    { key: 'checkout.busy' }, { key: 'checkout.cancelled' }, { key: 'checkout.failed' }, { key: 'checkout.biometric' },
    { key: 'info.help' }, { key: 'device.cameraOff' }, { key: 'device.regularCheckout' }, { key: 'device.paused' },
    { key: 'net.backOnline' }, { key: 'recognition.slow' }, { key: 'ask.listening' }, { key: 'ask.noProduct' }, { key: 'ask.failed' },
    { key: 'spotcheck.thanks' }, { key: 'barcode.notInStore' }, { key: 'barcode.unreadable' },
  ];
  for (const line of fixed) {
    expect(it_(line)).not.toBe(text(line));
    expect(it_(line)).toMatch(/^\p{Lu}.*\.$/u);
  }
});
it('speaks the Italian lines of a shop', () => {
  expect(it_(inCart(1))).toBe('Bevanda di avena. Nel carrello: un pezzo. Annuisci per aggiungerne ancora. Scuoti la testa per togliere.');
  expect(it_(inCart(2))).toBe('Bevanda di avena. Nel carrello: due pezzi. Annuisci per aggiungerne ancora. Scuoti la testa per togliere.');
  expect(it_({ key: 'cart.removed', product: oat, totalCents: 260 })).toBe('Tolto: bevanda di avena. Totale due e sessanta.');
  expect(it_({ key: 'glance.partial', aimHint: 'left' })).toBe("Ne vedo solo una parte. Spostalo un po' a sinistra.");
  expect(it_({ key: 'glance.partial', aimHint: 'turn' })).toBe('Ne vedo solo una parte. Mostrami il davanti.');
  expect(it_({ key: 'checkout.offer', kiosk: KIOSK, itemCount: 1, totalCents: 260 }))
    .toBe('Checkout 3, Demo Market. Un articolo, due euro e sessanta. Annuisci per pagare.');
  expect(it_({ key: 'checkout.paid', totalCents: 639 }))
    .toBe('Pagato. Sei euro e trentanove. La ricevuta è sul telefono. Fotocamera spenta.');
  expect(it_({ key: 'checkout.biometric' })).toBe("Oltre cinquanta euro. Conferma con l'impronta sul telefono.");
  expect(it_({ key: 'hint.lookAtCode' })).toBe('Guarda il codice della cassa, poi annuisci.');
  expect(it_({ key: 'info.help' }))
    .toBe('Solleva un prodotto per sentire il prezzo. Annuisci per aggiungerlo. Guarda il codice di una cassa e annuisci per pagare.');
  expect(it_({ key: 'info.total', itemCount: 3, totalCents: 639 })).toBe('Tre articoli. Totale sei e trentanove.');
  expect(it_({ key: 'info.total', itemCount: 1, totalCents: 189 })).toBe('Un articolo. Totale uno e ottantanove.');
  expect(it_({ key: 'info.cart', items: [{ product: oat, qty: 2 }], more: true, totalCents: 378 }))
    .toBe('Bevanda di avena, due. E altro sul telefono. Totale tre e settantotto.');
  expect(it_({ key: 'device.battery', percent: 20 })).toBe('Batteria degli occhiali al venti per cento.');
  expect(it_({ key: 'ask.answer', text: 'Contiene glutine.' })).toBe('Contiene glutine.');
});
it('speaks the brief and the detailed level in Italian', () => {
  expect(it_(glance(false), { detail: 'brief' })).toBe('Bevanda di avena, uno e ottantanove.');
  expect(it_(added, { detail: 'brief' })).toBe('Aggiunto: bevanda di avena.');
  expect(it_(glance(true), { detail: 'detailed' }))
    .toBe('Oatly bevanda di avena, cartone da un litro, un euro e ottantanove. Contiene glutine. Annuisci per aggiungere.');
});
it('names the main yes input of the shopper in Italian', () => {
  expect(it_(glance(true), { mainYes: 'touch' })).toBe('Bevanda di avena, un litro, uno e ottantanove. Tocca due volte per aggiungere.');
  expect(it_(glance(true), { mainYes: 'voice' })).toBe("Bevanda di avena, un litro, uno e ottantanove. Di' add per aggiungere.");
  expect(it_(glance(true), { mainYes: 'phone' })).toBe('Bevanda di avena, un litro, uno e ottantanove. Premi Aggiungi sul telefono.');
  expect(it_(glance(true), { mainYes: 'key' })).toBe('Bevanda di avena, un litro, uno e ottantanove. Premi volume su per aggiungere.');
  expect(it_(glance(true), { yesGesture: 'shake' })).toBe('Bevanda di avena, un litro, uno e ottantanove. Scuoti la testa per aggiungere.');
  expect(it_(inCart(1), { mainYes: 'touch' })).toBe('Bevanda di avena. Nel carrello: un pezzo. Tocca due volte per aggiungerne ancora.');
  expect(it_({ key: 'info.help' }, { mainYes: 'touch' }))
    .toBe('Solleva un prodotto per sentire il prezzo. Tocca due volte per aggiungere. Guarda il codice di una cassa. Tocca due volte per pagare.');
});
it('speaks the warnings, the budget line, and the look-alike line in Italian', () => {
  expect(it_(warned([{ kind: 'allergen', allergens: ['gluten', 'milk', 'nuts'] }], true)))
    .toBe('Bevanda di avena, un litro, uno e ottantanove. Attenzione: contiene glutine, latte e frutta a guscio. Annuisci per aggiungere.');
  expect(it_(warned([{ kind: 'diet', diet: 'vegan' }, { kind: 'diet', diet: 'vegetarian' }])))
    .toBe('Bevanda di avena, un litro, uno e ottantanove. Attenzione: non per vegani. Attenzione: non per vegetariani.');
  expect(it_(warned([{ kind: 'allergenDataMissing' }])))
    .toBe('Bevanda di avena, un litro, uno e ottantanove. Mancano i dati sugli allergeni di questo prodotto.');
  expect(it_({ key: 'cart.added', product: oat, totalCents: 2110, budgetCents: 2000 }))
    .toBe('Aggiunto: bevanda di avena. Totale ventuno e dieci. Hai superato il budget di venti euro.');
  expect(it_({ key: 'glance.ambiguous', products: [oat, rye] }))
    .toBe('Non distinguo tra bevanda di avena e rye bread. Mostrami il davanti.');
  expect(it_({ key: 'glance.ambiguous', products: [oat] })).toBe('Non riesco a distinguere questo prodotto. Mostrami il davanti.');
});
it('has an Italian name for each allergen', () => {
  const all = { ...oat, allergens: [...EU_ALLERGENS] };
  const line = it_({ key: 'glance.new', product: all, hint: false, warnings: [] }, { detail: 'detailed' });
  expect(line).toContain('Contiene glutine, crostacei, uova, pesce, arachidi, soia, latte, frutta a guscio, sedano, senape, sesamo, solfiti, lupini e molluschi.');
});

const warned = (warnings: Warning[], hint = false): Line => ({ key: 'glance.new', product: oat, hint, warnings });
const gluten: Warning = { kind: 'allergen', allergens: ['gluten'] };

it('speaks the warnings', () => {
  expect(text(warned([gluten]))).toBe('Oat drink, one litre, one eighty-nine. Warning: contains gluten.');
  expect(text(warned([gluten], true))).toBe('Oat drink, one litre, one eighty-nine. Warning: contains gluten. Nod to add.');
  expect(text(warned([gluten]), { detail: 'brief' })).toBe('Oat drink, one eighty-nine. Warning: contains gluten.');
  expect(text(warned([{ kind: 'allergen', allergens: ['gluten', 'milk'] }])))
    .toBe('Oat drink, one litre, one eighty-nine. Warning: contains gluten and milk.');
  expect(text(warned([{ kind: 'allergen', allergens: ['gluten', 'milk', 'nuts'] }])))
    .toBe('Oat drink, one litre, one eighty-nine. Warning: contains gluten, milk and nuts.');
  expect(text(warned([{ kind: 'diet', diet: 'vegan' }]))).toBe('Oat drink, one litre, one eighty-nine. Warning: not vegan.');
  expect(text(warned([{ kind: 'diet', diet: 'vegetarian' }]))).toBe('Oat drink, one litre, one eighty-nine. Warning: not vegetarian.');
  expect(text({ key: 'glance.new', product: crisps, hint: false, warnings: [{ kind: 'allergenDataMissing' }] }))
    .toBe('Potato crisps, one hundred fifty grams, one ninety. Allergen data is missing for this product.');
});
it('speaks each warning of a line, in the order of the list', () => {
  expect(text(warned([gluten, { kind: 'diet', diet: 'vegan' }], true)))
    .toBe('Oat drink, one litre, one eighty-nine. Warning: contains gluten. Warning: not vegan. Nod to add.');
});
it('lists each allergen of the product in a warning at the detailed level, in place of the Contains sentence', () => {
  const mix = { ...oat, allergens: ['gluten' as const, 'soy' as const] };
  expect(text({ key: 'glance.new', product: mix, hint: true, warnings: [gluten] }, { detail: 'detailed' }))
    .toBe('Oatly oat drink, one litre carton, one euro eighty-nine. Warning: contains gluten and soy. Nod to add.');
  expect(text({ key: 'glance.new', product: mix, hint: false, warnings: [{ kind: 'diet', diet: 'vegan' }] }, { detail: 'detailed' }))
    .toBe('Oatly oat drink, one litre carton, one euro eighty-nine. Contains gluten and soy. Warning: not vegan.');
});
it('speaks the warning of a product in the cart before the yes phrase', () => {
  expect(text({ key: 'glance.inCart', product: oat, qty: 1, warnings: [gluten] }))
    .toBe('Oat drink. One is in your cart. Warning: contains gluten. Nod to add another. Shake to remove.');
});
it('speaks the budget line of the spec', () => {
  const over: Line = { key: 'cart.added', product: oat, totalCents: 2110, budgetCents: 2000 };
  const line = 'Added oat drink. Total twenty-one ten. That is over your budget of twenty euros.';
  expect(text(over)).toBe(line);
  expect(text(over, { detail: 'brief' })).toBe(line);
  expect(text({ ...over, budgetCents: 2050 })).toBe('Added oat drink. Total twenty-one ten. That is over your budget of twenty euros fifty.');
});
it('speaks the look-alike lines', () => {
  const barista = catalog.get('oat-drink-barista-1l')!;
  expect(text({ key: 'glance.ambiguous', products: [oat, barista] }))
    .toBe('I cannot tell which oat drink this is. Turn the front to me.');
  expect(text({ key: 'glance.ambiguous', products: [barista, oat] }))
    .toBe('I cannot tell which oat drink this is. Turn the front to me.');
  expect(text({ key: 'glance.ambiguous', products: [oat, rye] }))
    .toBe('I cannot tell if this is oat drink or rye bread. Turn the front to me.');
  expect(text({ key: 'glance.ambiguous', products: [oat, rye, crisps] }))
    .toBe('I cannot tell if this is oat drink or rye bread. Turn the front to me.');
});
it('finds the common name of look-alike products with no case, and keeps a brand at its start', () => {
  const named = (spoken: string) => ({ ...oat, spokenName: { en: spoken } });
  expect(text({ key: 'glance.ambiguous', products: [named('Oat drink'), named('Barista OAT drink'), named('Organic Oat Drink')] }))
    .toBe('I cannot tell which oat drink this is. Turn the front to me.');
  expect(text({ key: 'glance.ambiguous', products: [named('Oatly oat drink'), named('Oatly oat drink')] }))
    .toBe('I cannot tell which Oatly oat drink this is. Turn the front to me.');
  expect(text({ key: 'glance.ambiguous', products: [named('Soy drink'), named('Oat drink')] }))
    .toBe('I cannot tell which drink this is. Turn the front to me.');
});

it('asks for the product of a spot check, and says thanks', () => {
  expect(text({ key: 'spotcheck.ask', product: oat })).toBe('Quick check. Show me the oat drink.');
  expect(text({ key: 'spotcheck.thanks' })).toBe('Thank you.');
  expect(it_({ key: 'spotcheck.ask', product: oat })).toBe('Controllo rapido. Mostrami questo prodotto: bevanda di avena.');
  expect(it_({ key: 'spotcheck.thanks' })).toBe('Grazie.');
});
it('keeps the name of a scanned product as the database writes it', () => {
  const scanned = scannedProduct({ gtin: '5449000000996', priceCents: 99, name: 'Coca-Cola', brand: 'The Coca-Cola Company', packSize: '330 ml' }, null);
  expect(text({ key: 'cart.added', product: scanned, totalCents: 99, budgetCents: null })).toBe('Added Coca-Cola. Total ninety-nine cents.');
  expect(it_({ key: 'cart.removed', product: scanned, totalCents: 0 })).toBe('Tolto: Coca-Cola. Totale zero euro.');
  expect(text({ key: 'glance.new', product: scanned, hint: false, warnings: [] }, { detail: 'detailed' }))
    .toBe('The Coca-Cola Company Coca-Cola, three hundred thirty millilitres, ninety-nine cents.');
});
it('speaks the two barcode lines in Italian', () => {
  expect(it_({ key: 'barcode.notInStore' })).toBe('Questo prodotto non è in questo negozio.');
  expect(it_({ key: 'barcode.unreadable' })).toBe('Non riesco a leggere questo codice. Avvicinalo.');
});
