import { type DeviceState, type IntentKind, TIMING, localize } from '@glance/shared';
import { openAskWindow } from './ask';
import { closeCheckout, isConfirmed, isPaying } from './checkout';
import { say } from './say';
import { type Turn, emit, emitSessionState, itemCount, speak } from './turn';
import type { RuleInput } from './types';

// DeviceState has no stream error, so these two limits stand for "battery too low" and "too warm"
// of spec section 6.6. Only the spoken line depends on them. The probe on the glasses can give better numbers.
/** Percent. */
export const CANNOT_STREAM_BATTERY = 5;
/** A level from 0 to 7. */
export const CANNOT_STREAM_THERMAL = 6;

/** R23. */
const CART_LINES_BY_VOICE = 5;

/** Percent. The voice reports the battery one time at each level. */
const BATTERY_LOW = 20;
const BATTERY_VERY_LOW = 10;

export function cannotStream(device: DeviceState): boolean {
  if (device.link !== 'connected') return false;
  const batteryLow = device.battery !== null && device.battery <= CANNOT_STREAM_BATTERY;
  const tooWarm = device.thermal !== null && device.thermal >= CANNOT_STREAM_THERMAL;
  return batteryLow || tooWarm;
}

export function onDeviceState(turn: Turn, input: Extract<RuleInput, { type: 'device.state' }>): void {
  const { s, now } = turn;
  const before = s.device;
  s.device = input.state;
  if (s.phase === 'paid' || s.phase === 'ended') return;
  const { stream, battery } = input.state;

  if (stream === 'streaming' && !s.cameraOn) {
    s.cameraOn = true;
    if (s.phase === 'resting') s.phase = 'shopping';
    s.lastTargetAt = now;
    emitSessionState(turn);
    speak(turn, say({ key: 'session.start' }));
  } else if (stream === 'stopped' && s.cameraOn) {
    s.cameraOn = false;
    // R24: with no camera the shopper cannot look at the code. A payment that runs still ends by itself.
    // A shopper who confirms with the fingerprint looks at the phone, so that checkout stays, and R19 limits its time.
    if (s.checkout && !isConfirmed(s)) {
      closeCheckout(s);
      emit(turn, { type: 'checkout.cancelled' });
    }
    emitSessionState(turn);
    speak(turn, say({ key: cannotStream(input.state) ? 'device.regularCheckout' : 'device.cameraOff' }));
  } else if (stream === 'paused' && before?.stream !== 'paused') {
    // The glasses resume the stream by themselves after a tap, so the camera counts as on.
    speak(turn, say({ key: 'device.paused' }));
  }

  if (battery === null) return;
  if (battery > BATTERY_LOW) {
    s.batteryWarned = null;
    return;
  }
  // With a stopped stream the shopper already heard why the camera is off.
  if (stream === 'stopped') return;
  if (battery <= BATTERY_VERY_LOW && s.batteryWarned !== BATTERY_VERY_LOW) {
    s.batteryWarned = BATTERY_VERY_LOW;
    speak(turn, say({ key: 'device.battery', percent: BATTERY_VERY_LOW }));
  } else if (s.batteryWarned === null) {
    s.batteryWarned = BATTERY_LOW;
    speak(turn, say({ key: 'device.battery', percent: BATTERY_LOW }));
  }
}

export function onRecognitionSlow(turn: Turn): void {
  emit(turn, { type: 'error', code: 'recognition.slow', message: 'Recognition is slow right now.' });
  speak(turn, say({ key: 'recognition.slow' }));
}

/** A session that has a device state had a phone before, so this socket is a phone that came back. */
export function onSocketOpen(turn: Turn): void {
  if (turn.s.device) speak(turn, say({ key: 'net.backOnline' }));
}

export function onProfileSet(turn: Turn, input: Extract<RuleInput, { type: 'profile.set' }>): void {
  const { s, ctx } = turn;
  const before = s.profile.lang;
  s.profile = { ...s.profile, ...input.patch };
  const { lang } = s.profile;
  if (lang === before || s.cart.items.length === 0) return;

  // A cart line holds its name as text, so a new language writes each name again. The total stays.
  const items = s.cart.items.map((item) => {
    const product = ctx.catalog.get(item.productId);
    return product ? { ...item, name: localize(product.name, lang) } : item;
  });
  s.cart = { ...s.cart, items };
  emit(turn, { type: 'cart.updated', cart: s.cart, change: null });
}

/** The intents that are no answer to a prompt. */
export function onGeneralIntent(turn: Turn, kind: Exclude<IntentKind, 'yes' | 'no' | 'undo'>): void {
  const { s } = turn;
  switch (kind) {
    case 'stop':
      onStop(turn);
      return;
    case 'repeat': {
      const last = s.lastSpeak;
      if (!last) return;
      // The line of a prompt that ended must not start a head window again.
      const promptId = last.promptId !== null && s.prompt?.id === last.promptId ? last.promptId : null;
      speak(turn, { ...last, promptId });
      return;
    }
    case 'total':
      if (s.cart.items.length === 0) speak(turn, say({ key: 'checkout.empty' }));
      else speak(turn, say({ key: 'info.total', itemCount: itemCount(s), totalCents: s.cart.totalCents }));
      return;
    case 'cart':
      onCartByVoice(turn);
      return;
    case 'help':
      speak(turn, say({ key: 'info.help' }));
      return;
    // The microphone button of the page. A current prompt stays current.
    case 'ask':
      openAskWindow(turn);
      return;
  }
}

function onStop(turn: Turn): void {
  const { s } = turn;
  if (isPaying(s)) return;
  if (s.prompt?.kind === 'product') emit(turn, { type: 'glance.cleared', promptId: s.prompt.id });
  if (s.checkout) {
    closeCheckout(s);
    emit(turn, { type: 'checkout.cancelled' });
  }
  s.prompt = null;
  s.phase = 'ended';
  s.cameraOn = false;
  emitSessionState(turn);
  speak(turn, say({ key: 'device.cameraOff' }));
  turn.out.push({ type: 'session.end' });
}

// R23.
function onCartByVoice(turn: Turn): void {
  const { s, ctx } = turn;
  if (s.cart.items.length === 0) {
    speak(turn, say({ key: 'checkout.empty' }));
    return;
  }
  const items = s.cart.items.slice(0, CART_LINES_BY_VOICE).flatMap((item) => {
    const product = ctx.catalog.get(item.productId);
    return product ? [{ product, qty: item.qty }] : [];
  });
  speak(turn, say({
    key: 'info.cart', items, more: s.cart.items.length > CART_LINES_BY_VOICE, totalCents: s.cart.totalCents,
  }));
}

// R22. The phone restarts the camera, and the device.state input then starts the shopping again.
export function restWhenIdle(turn: Turn): void {
  const { s, now } = turn;
  if (s.phase !== 'shopping' && s.phase !== 'checkout') return;
  if (!s.cameraOn || isPaying(s) || now - s.lastTargetAt < TIMING.restAfterIdleMs) return;

  if (s.prompt?.kind === 'product') emit(turn, { type: 'glance.cleared', promptId: s.prompt.id });
  if (s.checkout) {
    closeCheckout(s);
    emit(turn, { type: 'checkout.cancelled' });
  }
  s.prompt = null;
  s.phase = 'resting';
  s.cameraOn = false;
  emitSessionState(turn);
  speak(turn, say({ key: 'session.rest' }));
  turn.out.push({ type: 'session.rest' });
}
