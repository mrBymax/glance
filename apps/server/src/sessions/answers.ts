import { type IntentSource, type Product, TIMING, cartTotalCents, localize } from '@glance/shared';
import { afterCartChange, cancelCheckout, isPaying, startPayment } from './checkout';
import { say } from './say';
import { type Turn, emit, speak } from './turn';
import type { RuleInput, SessionState } from './types';
import { inView } from './view';

const MAX_LINE_QTY = 99;

/** True when a yes or a no from this source counts for the current prompt (R3 to R6). */
export function accepts(state: SessionState, intent: { source: IntentSource; promptId?: string }, now: number): boolean {
  const prompt = state.prompt;
  if (!prompt || intent.promptId !== prompt.id) return false;

  switch (intent.source) {
    // R6: the phone and the HUD name the prompt on their card.
    case 'phone':
    case 'hud':
      return true;
    // R4.
    case 'head': {
      if (!state.profile.headGestures || prompt.doneAt === null || !targetInView(state, now)) return false;
      const windowMs = state.profile.headWindowMs;
      return windowMs === null || now - prompt.doneAt < windowMs;
    }
    // R5.
    case 'voice':
    case 'touch':
    case 'key':
    case 'camera':
      return prompt.doneAt !== null;
  }
}

function targetInView(state: SessionState, now: number): boolean {
  const prompt = state.prompt;
  if (!prompt) return false;
  if (prompt.kind === 'product') return inView(state.seen[prompt.productId], now);
  return state.kioskSeen?.kioskId === prompt.kioskId && inView(state.kioskSeen.at, now);
}

export function onPromptDone(turn: Turn, input: Extract<RuleInput, { type: 'prompt.done' }>): void {
  const { s, now } = turn;
  if (!s.prompt || s.prompt.id !== input.promptId) return;
  s.prompt.doneAt = now;
  s.lastDone = { promptId: s.prompt.id, kind: s.prompt.kind, at: now, hinted: false };
}

export function onAnswer(turn: Turn, kind: 'yes' | 'no', source: IntentSource, promptId: string | undefined): void {
  const { s, now } = turn;
  if (isPaying(s)) return;

  if (promptId !== undefined && accepts(s, { source, promptId }, now)) {
    if (s.prompt?.kind === 'product') answerProductPrompt(turn, kind, s.prompt);
    else if (kind === 'yes') startPayment(turn);
    else cancelCheckout(turn);
    return;
  }

  // R10: the prompt of the last add is over, and its ID still names that unit.
  if (promptId !== undefined && s.lastAdd?.promptId === promptId) {
    if (kind === 'no') {
      if (now - s.lastAdd.at < TIMING.undoWindowMs) changeQty(turn, s.lastAdd.productId, -1);
    } else if (!s.lastAdd.hinted) {
      s.lastAdd.hinted = true;
      speak(turn, say({ key: 'hint.holdAgainForAnother' }));
    }
    return;
  }

  // R20.
  if (s.lastDone && !s.lastDone.hinted && now - s.lastDone.at < TIMING.hintAfterPromptMs) {
    s.lastDone.hinted = true;
    speak(turn, say({ key: s.lastDone.kind === 'pay' ? 'hint.lookAtCode' : 'hint.holdAgain' }));
  }
}

function answerProductPrompt(turn: Turn, kind: 'yes' | 'no', prompt: Extract<SessionState['prompt'], { kind: 'product' }>): void {
  const { s, now } = turn;
  const { productId } = prompt;
  s.prompt = null;
  // R8 and R10: no new prompt while the product stays in view.
  if (!s.muted.includes(productId)) s.muted.push(productId);
  emit(turn, { type: 'glance.cleared', promptId: prompt.id });

  if (kind === 'yes') {
    // R7.
    if (changeQty(turn, productId, 1)) s.lastAdd = { productId, promptId: prompt.id, at: now, hinted: false };
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
  if (isPaying(s)) return;
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
  if (isPaying(s)) return;
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
