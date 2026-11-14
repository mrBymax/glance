import { EMPTY_CART, type Profile, TIMING } from '@glance/shared';
import { onAnswer, onCartEdit, onPromptDone, onUndo } from './answers';
import { expireAskWindow, onAnswerText, onQuestion } from './ask';
import { onBarcode, onLabel } from './barcode';
import { expireCheckout, onBiometricResult, onKioskSeen, onPaymentResult } from './checkout';
import { newCodeState } from './code';
import { onDeviceState, onGeneralIntent, onProfileSet, onRecognitionSlow, onSocketOpen, restWhenIdle } from './general';
import { expireSecondLook, onRecognition } from './glance';
import { type Turn, emit } from './turn';
import type { Effect, RuleContext, RuleInput, SessionState, SpeakEffect } from './types';
import { inView } from './view';

export function createSessionState(profile: Profile, now: number): SessionState {
  return {
    phase: 'shopping',
    cameraOn: false,
    profile,
    cart: EMPTY_CART,
    prompt: null,
    promptSeq: 0,
    glanceCount: 0,
    seen: {},
    muted: [],
    excluded: [],
    lastAdd: null,
    adds: [],
    lastDone: null,
    unknownAt: null,
    aimHintAt: null,
    ambiguousKey: null,
    ambiguousAt: null,
    heldAmbiguous: null,
    kioskSeen: null,
    mutedKioskId: null,
    checkout: null,
    askUntil: null,
    lastTargetAt: now,
    lastSpeak: null,
    device: null,
    batteryWarned: null,
    lastReceipt: null,
    code: newCodeState(),
  };
}

/**
 * The rules R1 to R24 of spec section 6.2 as one pure function.
 * It reads no clock and does no I/O: each input carries `now`, and the runtime runs the effects.
 * The state that it gets stays as it is.
 */
export function step(state: SessionState, input: RuleInput, ctx: RuleContext): { state: SessionState; effects: Effect[] } {
  const turn: Turn = { s: structuredClone(state), now: input.now, ctx, out: [] };
  expire(turn);

  // A session that is paid or ended takes no input that can change its cart or start a prompt.
  const closed = turn.s.phase === 'paid' || turn.s.phase === 'ended';
  if (closed && input.type !== 'device.state' && input.type !== 'profile.set') {
    return { state: turn.s, effects: turn.out };
  }

  switch (input.type) {
    case 'recognition':
      onRecognition(turn, input);
      break;
    case 'prompt.done':
      onPromptDone(turn, input);
      break;
    case 'intent':
      onIntent(turn, input);
      break;
    case 'cart.edit':
      onCartEdit(turn, input);
      break;
    case 'kiosk.seen':
      onKioskSeen(turn, input);
      break;
    case 'payment.result':
      onPaymentResult(turn, input);
      break;
    case 'device.state':
      onDeviceState(turn, input);
      break;
    case 'profile.set':
      onProfileSet(turn, input);
      break;
    case 'recognition.slow':
      onRecognitionSlow(turn);
      break;
    case 'socket.open':
      onSocketOpen(turn);
      break;
    case 'biometric.result':
      onBiometricResult(turn, input);
      break;
    case 'question':
      onQuestion(turn, input);
      break;
    case 'answer':
      onAnswerText(turn, input);
      break;
    case 'barcode':
      onBarcode(turn, input);
      break;
    case 'label':
      onLabel(turn, input);
      break;
    case 'tick':
      break;
  }

  const lastSpeak = lastSpeakOf(turn.out);
  if (lastSpeak) turn.s.lastSpeak = lastSpeak;
  return { state: turn.s, effects: turn.out };
}

function onIntent(turn: Turn, input: Extract<RuleInput, { type: 'intent' }>): void {
  switch (input.kind) {
    case 'yes':
    case 'no':
      onAnswer(turn, input.kind, input.source, input.promptId);
      break;
    case 'undo':
      onUndo(turn);
      break;
    default:
      onGeneralIntent(turn, input.kind);
      break;
  }
}

function lastSpeakOf(effects: Effect[]): SpeakEffect | undefined {
  for (let index = effects.length - 1; index >= 0; index -= 1) {
    const effect = effects[index]!;
    if (effect.type === 'speak') return effect;
  }
  return undefined;
}

/** Applies each rule that depends on time alone. It runs before the handler of each input. */
function expire(turn: Turn): void {
  const { s, now } = turn;
  s.muted = s.muted.filter((productId) => inView(s.seen[productId], now));
  s.excluded = s.excluded.filter((entry) => entry.until > now);

  // R5.
  if (s.prompt?.kind === 'product') {
    const seenAt = s.seen[s.prompt.productId];
    if (seenAt === undefined || now - seenAt >= TIMING.viewMs + TIMING.promptTtlAfterLeftMs) {
      emit(turn, { type: 'glance.cleared', promptId: s.prompt.id });
      s.prompt = null;
    }
  }

  expireCheckout(turn);
  expireAskWindow(turn);
  expireSecondLook(turn);
  restWhenIdle(turn);
}
