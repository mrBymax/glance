import { describe, expect, it } from 'vitest';
import { copyProblems } from './copyRules';

describe('copyProblems', () => {
  it('accepts the honest lines', () => {
    expect(copyProblems([
      'With Glance, the store adds no camera and no sensor.',
      'Ceiling cameras need an installation in each store.',
      'The payment is a demo. No money moves.',
      'Blind and low-vision shoppers have not tested Glance yet.',
    ])).toEqual([]);
  });
  it('flags each forbidden claim', () => {
    for (const text of [
      'The store installs nothing.',
      'There is nothing to install in the store.',
      'The store lends you a pair of glasses.',
      'Glance takes a real payment at the kiosk.',
      'We tested it with blind shoppers.',
      'Blind shoppers have tested Glance.',
    ]) expect(copyProblems([text]), text).toHaveLength(1);
  });
  it('flags banned characters, marketing words, and long sentences', () => {
    expect(copyProblems(['Look — then nod.'])).toHaveLength(1);
    expect(copyProblems(['A “smart” cart.'])).toHaveLength(1);
    expect(copyProblems(['Pay now!'])).toHaveLength(1);
    expect(copyProblems(['Glance is a seamless checkout.'])).toHaveLength(1);
    expect(copyProblems([`${Array(26).fill('word').join(' ')}.`])).toHaveLength(1);
  });
});
