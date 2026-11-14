import type { Profile } from '@glance/shared';

/** What the voice tells the shopper to do for a yes or a no. `remove` is empty for an input with no "no". */
export type YesPhrases = { add: string; addAnother: string; remove: string; pay: string; thenYes: string };

type PhraseRow = 'nod' | 'shake' | 'touch' | 'voice' | 'phone' | 'key';

// The table "Yes phrases" of Plan 1.
const PHRASES: Record<PhraseRow, YesPhrases> = {
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

export function yesPhrases(profile: Profile): YesPhrases {
  return PHRASES[phraseRow(profile)];
}
