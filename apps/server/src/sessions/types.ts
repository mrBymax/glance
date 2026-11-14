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
  | { key: 'ask.listening' } | { key: 'ask.noProduct' } | { key: 'ask.failed' } | { key: 'ask.answer'; text: string }
  | { key: 'barcode.notInStore' } | { key: 'barcode.unreadable' };

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

/** What the lookup of a barcode gave. `productId` is in the index of the rules: a catalog product or a scanned one. */
export type BarcodeOutcome =
  | { kind: 'product'; productId: string }
  /** The code is right, and the store does not sell it. `gtin` has 13 digits. */
  | { kind: 'notInStore'; gtin: string }
  /** No GTIN of 8, 12, or 13 digits with a right check digit. */
  | { kind: 'invalid' };

/** The barcode side of a session. Each time is a clock value, or null for "never". */
export type CodeState = {
  /**
   * The last barcode report, label frame, or frame in which the model saw a code. The voice of recognition is quiet after it.
   * A still that showed no product sets it to null.
   */
  at: number | null;
  /** The last frame in which the model saw a code. */
  visibleAt: number | null;
  /** The last code that was read: a product, or a code that the store does not sell. */
  acceptedAt: number | null;
  stillRequestAt: number | null;
  /** The still requests since the last code that was read. */
  stillsOpen: number;
  /**
   * The last code that the store does not sell, with the time of its last report.
   * said: the voice gave the line for this appearance of the code. A stored value of an older server has no `said`.
   */
  miss: { gtin: string; at: number; said?: boolean } | null;
  /** The last stream frame with a product that sight cannot name: the status `unknown` or `unsure`. */
  heldAt: number | null;
  /** The voice of recognition is quiet until this time: the server waits for the still that it asked for, or for its label call. */
  waitUntil: number | null;
  /** The time of the unknown result whose line waits for a still, or null when no line waits. */
  unknownHeldAt: number | null;
  /** The last yes or no that answered a product prompt. No still follows it for 8 seconds. */
  answeredAt: number | null;
};

/** What the guard of guard.ts knows about the voice of a session. Each time is a clock value, or null for "never". */
export type VoiceState = {
  /** The text and the time of each line of the last 20 seconds. */
  recent: { text: string; at: number }[];
  /** The last unsolicited line. */
  unsolicitedAt: number | null;
  /** The last input that showed a product or a code in view. */
  sightAt: number | null;
  /** The voice said for this appearance that a read failed. */
  attemptSaid: boolean;
};

/**
 * What the rules know about the flow of the frames. A stall of the link from the glasses stops the frames and the
 * motion samples together, so a time with no result says nothing about the view.
 */
export type FrameState = {
  /** The last recognition result, or null for "never". */
  at: number | null;
  /** The last time with no recognition result that was longer than `FRAME_STALL_MS` of view.ts, or null. */
  stall: { from: number; to: number } | null;
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
  /**
   * The look-alike line that waits for the result of a still: the candidate IDs and the time of their result.
   * null when no line waits. Only a session with a second look wait holds a line.
   */
  heldAmbiguous: { products: string[]; since: number } | null;
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
  /** A session that an older server stored has no value here, or one with fewer fields. Read it through `codeOf` of code.ts. */
  code: CodeState;
  /** The last report of slow recognition, or null. A session that an older server stored has no value here. */
  slowAt: number | null;
  /** A session that an older server stored has no value here. guard.ts fills it. */
  voice: VoiceState;
  /** A session that an older server stored has no value here. view.ts reads it. */
  frames: FrameState;
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
  | { type: 'answer'; text: string | null }
  /** A barcode after its lookup. The phone reports a code one time each second while it is in view. */
  | { type: 'barcode'; outcome: BarcodeOutcome }
  /**
   * A label frame arrived (`started`), its read gave no product of the store (`failed`),
   * or the model read nothing in it (`empty`): the still showed no product.
   */
  | { type: 'label'; read: 'started' | 'failed' | 'empty' };
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
  | { type: 'ask'; question: string; product: Product }
  /** The runtime asks the phone for one still of the product in the hand. The phone answers with `barcode.seen` or with a label frame. */
  | { type: 'still.request' }
  /** The guard of guard.ts dropped this line. The runtime writes it to the log, and the phone gets nothing. */
  | { type: 'speak.dropped'; line: Line; reason: DropReason };

/** Why the guard dropped a line: its text is that of a line of the last 20 seconds, it came less than 3 seconds after another unsolicited line, or its appearance already had a line about a failed read. */
export type DropReason = 'same text' | 'gap' | 'appearance';

/** secondLookWaitMs: how long the look-alike line waits for the result of a still. 0 means that it does not wait. */
export type RuleContext = { catalog: CatalogIndex; secondLookWaitMs: number };
