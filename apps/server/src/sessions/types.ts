import type {
  AimHint, Cart, DeviceState, IntentKind, IntentSource, KioskRef, Phase, Priority, Product, Profile, ProfilePatch,
  Receipt, ServerEvent, SoundName, Warning,
} from '@glance/shared';
import type { CatalogIndex } from '../catalog/catalog';
import type { RecognitionResult } from '../recognition/result';

/** A spoken line before it has a text. The rules select the line, and the speech module writes the text. */
export type Line =
  | { key: 'session.start' } | { key: 'session.rest' }
  | { key: 'glance.new'; product: Product; hint: boolean; warnings: Warning[] }
  | { key: 'glance.inCart'; product: Product; qty: number; warnings: Warning[] }
  | { key: 'glance.unknown' } | { key: 'glance.skipped' }
  | { key: 'glance.ambiguous'; products: Product[] }
  | { key: 'glance.partial'; aimHint: Exclude<AimHint, 'none'> }
  | { key: 'cart.added'; product: Product; totalCents: number; budgetCents: number | null }
  | { key: 'cart.removed'; product: Product; totalCents: number }
  | { key: 'undo.nothing' }
  | { key: 'hint.holdAgain' } | { key: 'hint.holdAgainForAnother' } | { key: 'hint.lookAtCode' }
  | { key: 'checkout.offer'; kiosk: KioskRef; itemCount: number; totalCents: number }
  | { key: 'checkout.empty' } | { key: 'checkout.busy' } | { key: 'checkout.cancelled' } | { key: 'checkout.failed' }
  | { key: 'checkout.paid'; totalCents: number }
  | { key: 'checkout.biometric' }
  | { key: 'spotcheck.ask'; product: Product } | { key: 'spotcheck.thanks' }
  | { key: 'info.total'; itemCount: number; totalCents: number }
  | { key: 'info.cart'; items: { product: Product; qty: number }[]; more: boolean; totalCents: number }
  | { key: 'info.help' }
  | { key: 'device.cameraOff' } | { key: 'device.regularCheckout' } | { key: 'device.paused' }
  | { key: 'device.battery'; percent: 20 | 10 }
  | { key: 'net.backOnline' } | { key: 'recognition.slow' }
  | { key: 'ask.listening' } | { key: 'ask.noProduct' } | { key: 'ask.failed' } | { key: 'ask.answer'; text: string };

/** doneAt is the time when the phone reported the end of the clip, or null while the clip plays. */
export type PromptState =
  | { id: string; kind: 'product'; mode: 'new' | 'inCart'; productId: string; doneAt: number | null }
  | { id: string; kind: 'pay'; kioskId: string; doneAt: number | null };

/**
 * spotcheck: the kiosk asked for a spot check, and the voice waits for one product of the cart. No pay prompt exists yet.
 * biometric: the shopper said yes to a total above the limit, and the phone checks the fingerprint.
 * suspended with suspendedBy null: the next report of the code gives the pay prompt.
 */
export type CheckoutState = {
  kiosk: KioskRef; step: 'spotcheck' | 'offered' | 'suspended' | 'biometric' | 'paying'; suspendedBy: string | null;
  /** The product that the shopper must show in the step spotcheck. null in each other step. */
  spotProductId: string | null;
};

/** The rule numbers in the comments are those of spec section 6.2. Each time is a clock value in milliseconds. */
export type SessionState = {
  phase: Phase;
  cameraOn: boolean;
  profile: Profile;
  cart: Cart;
  /** The current prompt. */
  prompt: PromptState | null;
  /** The number of prompts made, for the IDs. */
  promptSeq: number;
  /** The number of 'new' prompts, for the yes hint. */
  glanceCount: number;
  /** Product ID to the time of its last identified result. */
  seen: Record<string, number>;
  /** No prompt for these products until each has left the view (R8, R10). */
  muted: string[];
  /** R9. */
  excluded: { productId: string; until: number }[];
  /** R10. */
  lastAdd: { productId: string; promptId: string; at: number; hinted: boolean } | null;
  /** Product IDs in the order of the adds (R12). */
  adds: string[];
  /** R20. */
  lastDone: { promptId: string; kind: 'product' | 'pay'; at: number; hinted: boolean } | null;
  /** R13. */
  unknownAt: number | null;
  aimHintAt: number | null;
  /** The sorted candidate IDs of the last ambiguous result, with one space between two IDs. */
  ambiguousKey: string | null;
  ambiguousAt: number | null;
  /** said: the voice gave the "busy" or "empty" line for this appearance of the code. */
  kioskSeen: { kioskId: string; at: number; said: boolean } | null;
  /** R18. */
  mutedKioskId: string | null;
  checkout: CheckoutState | null;
  /** The end of the question window, or null while the server waits for no question. */
  askUntil: number | null;
  /** The last product or kiosk in view (R22). */
  lastTargetAt: number;
  /** For the repeat intent. */
  lastSpeak: SpeakEffect | null;
  device: DeviceState | null;
  /** The battery level of the last spoken warning. A level above 20 percent sets it to null. */
  batteryWarned: 20 | 10 | null;
  lastReceipt: Receipt | null;
};

export type RuleInputBody =
  | { type: 'recognition'; result: RecognitionResult; still: boolean }
  | { type: 'intent'; kind: IntentKind; source: IntentSource; promptId?: string }
  | { type: 'prompt.done'; promptId: string }
  | { type: 'kiosk.seen'; kiosk: KioskRef; busy: boolean; spotCheck: boolean }
  | { type: 'tick' }
  | { type: 'device.state'; state: DeviceState }
  | { type: 'cart.edit'; productId: string; qty: number }
  | { type: 'profile.set'; patch: ProfilePatch }
  | { type: 'payment.result'; ok: boolean; orderId: string; paidAt: string }
  /** 3 recognition calls in a row failed. */
  | { type: 'recognition.slow' }
  /** The device socket of the session opened. */
  | { type: 'socket.open' }
  /** The result of the fingerprint check on the phone. */
  | { type: 'biometric.result'; ok: boolean }
  /** Speech of the shopper that is no command. */
  | { type: 'question'; text: string }
  /** The answer to the last `ask` effect, or null when no answer came. */
  | { type: 'answer'; text: string | null };
export type RuleInput = RuleInputBody & { now: number };

export type SpeakEffect = {
  type: 'speak'; line: Line; priority: Priority; sound: SoundName | null; interrupt: boolean; promptId: string | null;
};
export type Effect =
  /** The rules never make a caption event. */
  | { type: 'event'; event: ServerEvent }
  | SpeakEffect
  | { type: 'session.rest' }
  | { type: 'session.end' }
  | { type: 'payment.start'; kiosk: KioskRef; totalCents: number }
  /** The runtime asks the phone for a fingerprint check. The phone answers with `biometric.result`. */
  | { type: 'biometric.request' }
  /** The runtime asks the model and answers with an `answer` input. */
  | { type: 'ask'; question: string; product: Product };

export type RuleContext = { catalog: CatalogIndex };
