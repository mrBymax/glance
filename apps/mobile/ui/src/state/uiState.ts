import {
  DEFAULT_PROFILE, EMPTY_CART,
  type Caption, type Cart, type CurrentPrompt, type NativeState, type NativeToPage, type Phase, type ProductRef,
  type Profile, type ProfilePatch, type Receipt, type ServerEvent, type SessionSnapshot,
} from '@glance/shared';

export type UiState = {
  /** null until the app sends the first native.state. */
  native: NativeState | null;
  profile: Profile;
  /** null until the first snapshot. */
  sessionId: string | null;
  phase: Phase | null;
  /** The product card or the pay prompt. */
  prompt: CurrentPrompt | null;
  lookAlikes: ProductRef[] | null;
  spotCheck: ProductRef | null;
  cart: Cart;
  /** Grows by 1 for each cart.updated with a change. It drives the announcement. */
  cartSeq: number;
  /** Oldest first, at most MAX_CAPTIONS. */
  captions: Caption[];
  receipt: Receipt | null;
  checkout: 'none' | 'offered' | 'suspended' | 'spotcheck' | 'failed' | 'paid';
  budget: { budgetCents: number; totalCents: number } | null;
  /** The last error event of the server or of the app. */
  error: { code: string; message: string } | null;
};

export type UiAction = NativeToPage
  /** The shopper leaves a session that is over. */
  | { t: 'local.reset' }
  /** The shopper changes a preference. */
  | { t: 'local.profile'; patch: ProfilePatch }
  /** The shopper tries a setup step or a start again. */
  | { t: 'local.attempt' };

export const MAX_CAPTIONS = 20;

export const initialUiState: UiState = {
  native: null,
  profile: DEFAULT_PROFILE,
  sessionId: null,
  phase: null,
  prompt: null,
  lookAlikes: null,
  spotCheck: null,
  cart: EMPTY_CART,
  cartSeq: 0,
  captions: [],
  receipt: null,
  checkout: 'none',
  budget: null,
  error: null,
};

function withoutPayPrompt(prompt: CurrentPrompt | null): CurrentPrompt | null {
  return prompt?.kind === 'pay' ? null : prompt;
}

function withCaption(captions: Caption[], caption: Caption): Caption[] {
  const known = captions.some((old) => old.id === caption.id);
  const next = known ? captions.map((old) => (old.id === caption.id ? caption : old)) : [...captions, caption];
  return next.slice(-MAX_CAPTIONS);
}

function checkoutOf(snapshot: SessionSnapshot): UiState['checkout'] {
  if (snapshot.prompt?.kind === 'pay') return 'offered';
  return snapshot.phase === 'paid' && snapshot.lastReceipt ? 'paid' : 'none';
}

function fromSnapshot(state: UiState, snapshot: SessionSnapshot): UiState {
  return {
    ...state,
    sessionId: snapshot.sessionId,
    phase: snapshot.phase,
    prompt: snapshot.prompt,
    cart: snapshot.cart,
    profile: snapshot.profile,
    receipt: snapshot.lastReceipt,
    captions: snapshot.captions.slice(-MAX_CAPTIONS),
    checkout: checkoutOf(snapshot),
    lookAlikes: null,
    spotCheck: null,
    budget: null,
    error: null,
  };
}

/**
 * The server sends budget.exceeded one time, when an add crosses the budget. So the page keeps the warning.
 * A new budget ends the warning when it is null or not under the total of the cart.
 */
function budgetAfter(state: UiState, budgetCents: number | null): UiState['budget'] {
  if (state.budget === null || budgetCents === null || budgetCents >= state.cart.totalCents) return null;
  return { ...state.budget, budgetCents };
}

function reduceEvent(state: UiState, event: ServerEvent): UiState {
  switch (event.type) {
    case 'session.state':
      return { ...state, phase: event.phase };
    case 'glance.pending': {
      const { type, kind, ...prompt } = event;
      return {
        ...state,
        prompt: { ...prompt, kind: 'product', mode: kind },
        lookAlikes: null,
        error: null,
        checkout: state.checkout === 'failed' ? 'none' : state.checkout,
      };
    }
    case 'glance.cleared':
      // An older prompt can be cleared after the next prompt arrived. The newer prompt stays.
      return state.prompt?.promptId === event.promptId ? { ...state, prompt: null } : state;
    case 'glance.hint':
    case 'glance.unknown':
      // The caption carries the line.
      return state;
    case 'glance.ambiguous':
      return { ...state, lookAlikes: event.candidates };
    case 'cart.updated': {
      const withinBudget = state.budget !== null && event.cart.totalCents <= state.budget.budgetCents;
      return {
        ...state,
        cart: event.cart,
        cartSeq: event.change === null ? state.cartSeq : state.cartSeq + 1,
        lookAlikes: null,
        budget: withinBudget ? null : state.budget,
      };
    }
    case 'budget.exceeded':
      return { ...state, budget: { budgetCents: event.budgetCents, totalCents: event.totalCents } };
    case 'checkout.offered': {
      const { type, ...prompt } = event;
      return { ...state, prompt: { ...prompt, kind: 'pay' }, checkout: 'offered', spotCheck: null, error: null };
    }
    case 'checkout.suspended':
      return { ...state, checkout: 'suspended', prompt: withoutPayPrompt(state.prompt) };
    case 'checkout.spotcheck':
      return { ...state, spotCheck: event.product, checkout: 'spotcheck' };
    case 'checkout.cancelled':
      return { ...state, checkout: 'none', prompt: withoutPayPrompt(state.prompt), spotCheck: null };
    case 'checkout.paid': {
      const { type, ...receipt } = event;
      return { ...state, receipt, checkout: 'paid', prompt: withoutPayPrompt(state.prompt), spotCheck: null, error: null };
    }
    case 'checkout.failed':
      return { ...state, checkout: 'failed', prompt: withoutPayPrompt(state.prompt) };
    case 'caption': {
      const { type, ...caption } = event;
      return { ...state, captions: withCaption(state.captions, caption) };
    }
    case 'error':
      return { ...state, error: { code: event.code, message: event.message } };
    default: {
      // The compiler rejects this line when the shared package gets an event type with no case above.
      const unknown: never = event;
      return unknown;
    }
  }
}

export function reduce(state: UiState, action: UiAction): UiState {
  switch (action.t) {
    case 'native.state': {
      // An error event of the app can arrive before or after its native.state.
      // So only a stream that starts is a sign of recovery. A change to stopped or paused keeps the error.
      const recovered = action.state.stream === 'streaming' && state.native?.stream !== 'streaming';
      return { ...state, native: action.state, error: recovered ? null : state.error };
    }
    case 'profile':
      return { ...state, profile: action.profile, budget: budgetAfter(state, action.profile.budgetCents) };
    case 'snapshot':
      return fromSnapshot(state, action.session);
    case 'event':
      return reduceEvent(state, action.event);
    case 'local.reset':
      return { ...initialUiState, native: state.native, profile: state.profile };
    case 'local.profile': {
      const profile = { ...state.profile, ...action.patch };
      // A patch with no budget does not change the warning.
      const budget = action.patch.budgetCents === undefined ? state.budget : budgetAfter(state, action.patch.budgetCents);
      return { ...state, profile, budget };
    }
    case 'local.attempt':
      return { ...state, error: null };
    default: {
      const unknown: never = action;
      return unknown;
    }
  }
}
