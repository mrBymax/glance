import type { IntentKind } from '@glance/shared';

/**
 * A spoken command as an intent.
 * `only` names the kind of prompt that the command can answer: "add" never pays, and "pay" never adds.
 * null means that the command fits each prompt, or needs none.
 */
export type VoiceCommand = { kind: IntentKind; only: 'product' | 'pay' | null };

// The table "Voice commands" of Plan 1.
const COMMANDS: Record<string, VoiceCommand> = {
  'add': { kind: 'yes', only: 'product' },
  'add it': { kind: 'yes', only: 'product' },
  'yes': { kind: 'yes', only: null },
  'pay': { kind: 'yes', only: 'pay' },
  'no': { kind: 'no', only: null },
  'skip': { kind: 'no', only: 'product' },
  'skip it': { kind: 'no', only: 'product' },
  'remove': { kind: 'no', only: 'product' },
  'remove it': { kind: 'no', only: 'product' },
  'cancel': { kind: 'no', only: 'pay' },
  'undo': { kind: 'undo', only: null },
  'repeat': { kind: 'repeat', only: null },
  'total': { kind: 'total', only: null },
  'cart': { kind: 'cart', only: null },
  'help': { kind: 'help', only: null },
  'stop': { kind: 'stop', only: null },
};

/**
 * Returns the command, or null for each other text.
 * Only a full match counts, so a sentence that holds a command word by chance does nothing.
 * The compare ignores case, punctuation, and outer spaces.
 */
export function parseVoiceCommand(text: string): VoiceCommand | null {
  const words = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim().replace(/\s+/g, ' ');
  return Object.hasOwn(COMMANDS, words) ? COMMANDS[words]! : null;
}
