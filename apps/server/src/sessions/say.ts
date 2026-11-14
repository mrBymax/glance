import type { Priority, SoundName } from '@glance/shared';
import type { Line, SpeakEffect } from './types';

type LineDefault = { priority: Priority; sound: SoundName | null; interrupt: boolean };
const line = (priority: Priority, interrupt: boolean, sound: SoundName | null = null): LineDefault => ({ priority, sound, interrupt });

/** The table "Spoken lines" of Plan 1. */
export const LINE_DEFAULTS: Record<Line['key'], LineDefault> = {
  'session.start': line('normal', false),
  'session.rest': line('high', true),
  'glance.new': line('normal', true),
  'glance.inCart': line('normal', true),
  'glance.unknown': line('normal', false),
  'glance.ambiguous': line('normal', false),
  'glance.partial': line('normal', false),
  'glance.skipped': line('normal', true),
  'cart.added': line('normal', true, 'added'),
  'cart.removed': line('normal', true, 'removed'),
  'undo.nothing': line('normal', false),
  'hint.holdAgain': line('normal', false),
  'hint.holdAgainForAnother': line('normal', false),
  'hint.lookAtCode': line('high', false),
  'checkout.offer': line('high', true, 'found'),
  'checkout.empty': line('normal', false),
  'checkout.busy': line('high', false),
  'checkout.cancelled': line('high', true),
  'checkout.paid': line('high', true, 'paid'),
  'checkout.failed': line('high', true),
  'info.total': line('low', false),
  'info.cart': line('low', false),
  'info.help': line('low', false),
  'device.cameraOff': line('high', true),
  'device.regularCheckout': line('high', true),
  'device.paused': line('high', true),
  'device.battery': line('low', false),
  'net.backOnline': line('high', false),
  'recognition.slow': line('high', false),
};

/** Makes the speak effect of a line with the defaults of its key. */
export function say(spoken: Line, over: Partial<Pick<SpeakEffect, 'sound' | 'interrupt' | 'promptId'>> = {}): SpeakEffect {
  return { type: 'speak', line: spoken, ...LINE_DEFAULTS[spoken.key], promptId: null, ...over };
}
