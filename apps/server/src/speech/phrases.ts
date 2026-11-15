import type { Lang, Profile } from '@glance/shared';

/** What the voice tells the shopper to do for a yes or a no. `remove` is empty for an input with no "no". */
export type YesPhrases = { add: string; addAnother: string; remove: string; pay: string; thenYes: string };

type PhraseRow = 'nod' | 'shake' | 'touch' | 'voice' | 'phone' | 'key';

// The table "Yes phrases" of Plan 1.
const PHRASES_EN: Record<PhraseRow, YesPhrases> = {
  nod: {
    add: 'Nod to add.', addAnother: 'Nod to add another.', remove: 'Shake to remove.', pay: 'Nod to pay.', thenYes: 'then nod',
  },
  shake: {
    add: 'Shake to add.', addAnother: 'Shake to add another.', remove: 'Nod to remove.', pay: 'Shake to pay.',
    thenYes: 'then shake',
  },
  touch: {
    add: 'Double tap to add.', addAnother: 'Double tap to add another.', remove: '', pay: 'Double tap to pay.',
    thenYes: 'then double tap',
  },
  voice: {
    add: 'Say add.', addAnother: 'Say add to add another.', remove: 'Say remove to remove.', pay: 'Say pay.',
    thenYes: 'then say pay',
  },
  phone: {
    add: 'Press Add on your phone.', addAnother: 'Press Add on your phone to add another.', remove: '',
    pay: 'Press Pay on your phone.', thenYes: 'then press Pay on your phone',
  },
  key: {
    add: 'Press volume up to add.', addAnother: 'Press volume up to add another.', remove: 'Press volume down to remove.',
    pay: 'Press volume up to pay.', thenYes: 'then press volume up',
  },
};

// The same six rows in Italian. No phrase agrees with the gender of a product name.
// The voice row keeps the English command words, because the glasses take voice commands in English only.
// The phone row names the buttons "Aggiungi" and "Paga" of the Italian phone UI.
const PHRASES_IT: Record<PhraseRow, YesPhrases> = {
  nod: {
    add: 'Annuisci per aggiungere.', addAnother: 'Annuisci per aggiungerne ancora.', remove: 'Scuoti la testa per togliere.',
    pay: 'Annuisci per pagare.', thenYes: 'poi annuisci',
  },
  shake: {
    add: 'Scuoti la testa per aggiungere.', addAnother: 'Scuoti la testa per aggiungerne ancora.', remove: 'Annuisci per togliere.',
    pay: 'Scuoti la testa per pagare.', thenYes: 'poi scuoti la testa',
  },
  touch: {
    add: 'Tocca due volte per aggiungere.', addAnother: 'Tocca due volte per aggiungerne ancora.', remove: '',
    pay: 'Tocca due volte per pagare.', thenYes: 'poi tocca due volte',
  },
  voice: {
    add: "Di' add per aggiungere.", addAnother: "Di' add per aggiungerne ancora.", remove: "Di' remove per togliere.",
    pay: "Di' pay per pagare.", thenYes: "poi di' pay",
  },
  phone: {
    add: 'Premi Aggiungi sul telefono.', addAnother: 'Premi Aggiungi sul telefono per aggiungerne ancora.', remove: '',
    pay: 'Premi Paga sul telefono.', thenYes: 'poi premi Paga sul telefono',
  },
  key: {
    add: 'Premi volume su per aggiungere.', addAnother: 'Premi volume su per aggiungerne ancora.',
    remove: 'Premi volume giù per togliere.', pay: 'Premi volume su per pagare.', thenYes: 'poi premi volume su',
  },
};

const PHRASES: Record<Lang, Record<PhraseRow, YesPhrases>> = { en: PHRASES_EN, it: PHRASES_IT };

/** True when the shopper answers with a nod. The help line has its own wording for this input. */
export function answersWithNod(profile: Profile): boolean {
  return phraseRow(profile) === 'nod';
}

function phraseRow(profile: Profile): PhraseRow {
  if (profile.mainYes !== 'head') return profile.mainYes;
  // A shopper who turned the head gestures off answers on the phone.
  if (!profile.headGestures) return 'phone';
  return profile.yesGesture;
}

/** The phrases in the language of the profile. */
export function yesPhrases(profile: Profile): YesPhrases {
  return PHRASES[profile.lang][phraseRow(profile)];
}
