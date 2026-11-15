import { type IntentSource, type Product, TIMING, cartTotalCents, localize } from '@glance/shared';
import { openAskWindow } from './ask';
import { afterCartChange, cancelCheckout, isConfirmed, startPayment } from './checkout';
import { noteAnswer } from './code';
import { say } from './say';
import { type Turn, emit, speak } from './turn';
import type { IntentFault, RuleInput, SessionState } from './types';
import { inView } from './view';

const MAX_LINE_QTY = 99;

/**
 * R4: the phone decides if a nod or a shake is inside the head window, in the time of the motion samples of the glasses.
 * After a stall of the link the samples arrive late, so the answer can arrive after the head window on the clock of
 * the server. The phone takes a sample of the head window that arrives this long after the window, at most.
 * The value is `LATE_MS` of `HeadInput` in the Android app.
 *
 * The phone opens the head window of each prompt while its line still plays, so a head answer can arrive before
 * `prompt.done`: the shopper never waits for the end of a line to nod or to shake. The phone stops the line at the
 * answer and sends no `prompt.done` for it, so the answer also ends the line for the server (`onAnswer`).
 *
 * For a product prompt the ID of the prompt is the guard: the shopper heard the name and the price of that prompt.
 * The product can be out of view, because recognition names a held product in few frames and the shopper lowers it
 * while the line plays. A pay prompt keeps one more condition: the kiosk code is in view.
 */
export const HEAD_LATE_MS = 6000;
/** The longest time that a stall or a still adds to one head window on the phone: `MAX_EXTRA_MS` of `HeadInput`. */
export const HEAD_MAX_EXTRA_MS = 15_000;

/** True when a yes or a no from this source counts for the current prompt (R3 to R6). */
export function accepts(state: SessionState, intent: { source: IntentSource; promptId?: string }, now: number): boolean {
  return answerFault(state, intent, now) === null;
}

/** Why a yes or a no from this source does not count for the current prompt, or null when it counts (R3 to R6). */
export function answerFault(state: SessionState, intent: { source: IntentSource; promptId?: string }, now: number): IntentFault | null {
  const prompt = state.prompt;
  if (intent.promptId === undefined) return 'no-prompt-id';
  if (!prompt) return 'no-prompt';
  if (intent.promptId !== prompt.id) return 'other-prompt';

  switch (intent.source) {
    // R6: the phone and the HUD name the prompt on their card.
    case 'phone':
    case 'hud':
      return null;
    // R4. The phone is the judge of the head window. The server keeps the last time at which the phone can send the answer.
    case 'head': {
      if (!state.profile.headGestures) return 'head-off';
      if (prompt.kind === 'pay' && !kioskInView(state, prompt.kioskId, now)) return 'code-not-in-view';
      const windowMs = state.profile.headWindowMs;
      // A prompt that an older server stored has no start time. Its time starts now.
      const from = prompt.doneAt ?? (prompt as { startedAt?: number }).startedAt ?? now;
      return windowMs === null || now - from < windowMs + HEAD_MAX_EXTRA_MS + HEAD_LATE_MS ? null : 'late';
    }
    // R5.
    case 'voice':
    case 'touch':
    case 'key':
    case 'camera':
      return prompt.doneAt === null ? 'line-plays' : null;
  }
}

/** A nod that pays needs a report of the kiosk code in the view time. */
function kioskInView(state: SessionState, kioskId: string, now: number): boolean {
  return state.kioskSeen?.kioskId === kioskId && inView(state.kioskSeen.at, now);
}

export function onPromptDone(turn: Turn, input: Extract<RuleInput, { type: 'prompt.done' }>): void {
  const { s, now } = turn;
  if (!s.prompt || s.prompt.id !== input.promptId) return;
  finishPrompt(s, s.prompt, now);
}

/** The line of the prompt ended. A prompt that got its hint (R20) keeps that fact when its line ends again. */
function finishPrompt(s: SessionState, prompt: NonNullable<SessionState['prompt']>, now: number): void {
  prompt.doneAt = now;
  const hinted = s.lastDone?.promptId === prompt.id && s.lastDone.hinted;
  s.lastDone = { promptId: prompt.id, kind: prompt.kind, at: now, hinted };
}

/**
 * Returns null when the answer had its effect, or the reason why it had none.
 * An answer with no prompt to answer says nothing. Only the pay prompt keeps a hint (R20).
 */
export function onAnswer(turn: Turn, kind: 'yes' | 'no', source: IntentSource, promptId: string | undefined): IntentFault | null {
  const { s, now } = turn;
  if (isConfirmed(s)) return 'payment-confirmed';

  const fault = answerFault(s, { source, promptId }, now);
  // The phone stopped the line of the prompt at this head answer, and it sends no `prompt.done` for a stopped line.
  // So the line ends here for each later rule, also when the kiosk code is out of view and the answer does not count.
  // A late answer ends no line: the time of the prompt must not start again.
  if (source === 'head' && (fault === null || fault === 'code-not-in-view') && s.prompt && s.prompt.doneAt === null) {
    finishPrompt(s, s.prompt, now);
  }
  if (fault === null) {
    if (s.prompt?.kind === 'product') answerProductPrompt(turn, kind, s.prompt);
    else if (kind === 'yes') startPayment(turn);
    else cancelCheckout(turn);
    return null;
  }

  // R10: the prompt of the last add is over, and its ID still names that unit. A no takes the unit back.
  if (kind === 'no' && promptId !== undefined && s.lastAdd?.promptId === promptId) {
    return now - s.lastAdd.at < TIMING.undoWindowMs && changeQty(turn, s.lastAdd.productId, -1) ? null : fault;
  }

  // Spec section 16: a double tap means "listen" when no prompt waits.
  if (kind === 'yes' && source === 'touch' && s.prompt === null) {
    openAskWindow(turn);
    return null;
  }

  // R20, for the pay prompt only: the shopper answered with the kiosk code out of view.
  if (s.lastDone?.kind === 'pay' && !s.lastDone.hinted && now - s.lastDone.at < TIMING.hintAfterPromptMs) {
    s.lastDone.hinted = true;
    speak(turn, say({ key: 'hint.lookAtCode' }));
  }
  return fault;
}

function answerProductPrompt(turn: Turn, kind: 'yes' | 'no', prompt: Extract<SessionState['prompt'], { kind: 'product' }>): void {
  const { s, now } = turn;
  const { productId } = prompt;
  // An answer on the phone or the HUD before the end of the line finishes the prompt, so a later "remove" by voice names it (R10).
  if (prompt.doneAt === null) s.lastDone = { promptId: prompt.id, kind: 'product', at: now, hinted: false };
  s.prompt = null;
  noteAnswer(s, now);
  // R8 and R10: no new prompt while the product stays in view.
  if (!s.muted.includes(productId)) s.muted.push(productId);
  emit(turn, { type: 'glance.cleared', promptId: prompt.id });

  if (kind === 'yes') {
    // R7.
    if (changeQty(turn, productId, 1)) s.lastAdd = { productId, promptId: prompt.id, at: now };
  } else if (prompt.mode === 'new') {
    // R8 and R9.
    s.excluded = s.excluded.filter((entry) => entry.productId !== productId);
    s.excluded.push({ productId, until: now + TIMING.excludeAfterNoMs });
    speak(turn, say({ key: 'glance.skipped' }));
  } else {
    // R11.
    changeQty(turn, productId, -1);
  }
}

// R12.
export function onUndo(turn: Turn): void {
  const { s } = turn;
  if (isConfirmed(s)) return;
  for (let index = s.adds.length - 1; index >= 0; index -= 1) {
    const productId = s.adds[index]!;
    if (s.cart.items.some((item) => item.productId === productId)) {
      changeQty(turn, productId, -1);
      return;
    }
  }
  speak(turn, say({ key: 'undo.nothing' }));
}

export function onCartEdit(turn: Turn, input: Extract<RuleInput, { type: 'cart.edit' }>): void {
  const { s } = turn;
  if (isConfirmed(s)) return;
  const item = s.cart.items.find((entry) => entry.productId === input.productId);
  if (!item) return;
  if (!Number.isInteger(input.qty) || input.qty < 0 || input.qty > MAX_LINE_QTY) return;
  if (input.qty === item.qty) return;
  changeQty(turn, input.productId, input.qty - item.qty);
}

/**
 * Adds units to a cart line or removes units from it, and names the product.
 * The price comes from the catalog. A line at quantity 0 leaves the cart.
 * Returns false when the change is not possible.
 */
function changeQty(turn: Turn, productId: string, delta: number): boolean {
  const { s, ctx } = turn;
  const product = ctx.catalog.get(productId);
  const current = s.cart.items.find((item) => item.productId === productId);
  if (delta === 0 || (delta > 0 && !product) || (delta < 0 && !current)) return false;

  const name = current?.name ?? localize(product!.name, s.profile.lang);
  const qty = (current?.qty ?? 0) + delta;
  const totalBefore = s.cart.totalCents;
  let items = s.cart.items;
  if (!current) {
    items = [...items, cartLine(product!, name, qty)];
  } else if (qty <= 0) {
    items = items.filter((item) => item !== current);
  } else {
    items = items.map((item) => (item === current ? { ...item, qty } : item));
  }
  s.cart = { items, totalCents: cartTotalCents(items) };

  if (delta > 0) {
    for (let count = 0; count < delta; count += 1) s.adds.push(productId);
  } else {
    for (let count = 0; count < -delta; count += 1) {
      const index = s.adds.lastIndexOf(productId);
      if (index >= 0) s.adds.splice(index, 1);
    }
    // The unit of R10 can be the one that left the cart, so a later no must not remove another unit.
    if (s.lastAdd?.productId === productId) s.lastAdd = null;
  }

  emit(turn, { type: 'cart.updated', cart: s.cart, change: { kind: delta > 0 ? 'add' : 'remove', productId, name } });
  const totalCents = s.cart.totalCents;
  if (delta > 0) {
    // Only the add that crosses the budget warns. A later add over the budget gets the usual line.
    const budgetCents = s.profile.budgetCents;
    if (budgetCents !== null && totalBefore <= budgetCents && totalCents > budgetCents) {
      // The page drops its budget warning on cart.updated, so budget.exceeded follows it.
      emit(turn, { type: 'budget.exceeded', budgetCents, totalCents });
      speak(turn, say({ key: 'cart.added', product: product!, totalCents, budgetCents }, { sound: 'warning' }));
    } else {
      speak(turn, say({ key: 'cart.added', product: product!, totalCents, budgetCents: null }));
    }
  } else if (product) {
    speak(turn, say({ key: 'cart.removed', product, totalCents }));
  }
  afterCartChange(turn);
  return true;
}

function cartLine(product: Product, name: string, qty: number) {
  return { productId: product.id, name, packSize: product.packSize, qty, unitPriceCents: product.priceCents };
}
