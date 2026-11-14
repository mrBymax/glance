import { expect, it } from 'vitest';
import { parseVoiceCommand } from './voice';

it('maps the command words', () => {
  expect(parseVoiceCommand('Add')).toEqual({ kind: 'yes', only: 'product' });
  expect(parseVoiceCommand(' yes. ')).toEqual({ kind: 'yes', only: null });
  expect(parseVoiceCommand('pay')).toEqual({ kind: 'yes', only: 'pay' });
  expect(parseVoiceCommand('skip it')).toEqual({ kind: 'no', only: 'product' });
  expect(parseVoiceCommand('cancel')).toEqual({ kind: 'no', only: 'pay' });
  expect(parseVoiceCommand('undo')).toEqual({ kind: 'undo', only: null });
});
it('maps each word of the table', () => {
  const kinds = (words: string[]) => words.map((word) => parseVoiceCommand(word));
  expect(kinds(['add it', 'no', 'skip', 'remove', 'remove it'])).toEqual([
    { kind: 'yes', only: 'product' }, { kind: 'no', only: null }, { kind: 'no', only: 'product' },
    { kind: 'no', only: 'product' }, { kind: 'no', only: 'product' },
  ]);
  for (const word of ['repeat', 'total', 'cart', 'help', 'stop'] as const) {
    expect(parseVoiceCommand(word)).toEqual({ kind: word, only: null });
  }
});
it('ignores case, punctuation, and extra spaces', () => {
  expect(parseVoiceCommand('Skip  it!')).toEqual({ kind: 'no', only: 'product' });
  expect(parseVoiceCommand('PAY.')).toEqual({ kind: 'yes', only: 'pay' });
});
it('takes a full match only', () => {
  expect(parseVoiceCommand('I do not want to pay')).toBeNull();
  expect(parseVoiceCommand('add milk to my list')).toBeNull();
  expect(parseVoiceCommand('')).toBeNull();
  expect(parseVoiceCommand('constructor')).toBeNull();
});
