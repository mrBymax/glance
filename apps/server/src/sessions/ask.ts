import type { Product } from '@glance/shared';
import { ASK_WINDOW_MS } from '../ask/ask';
import { say } from './say';
import { type Turn, speak } from './turn';
import type { RuleInput } from './types';
import { inView } from './view';

/** Opens the question window. The next speech that is no command is the question. */
export function openAskWindow(turn: Turn): void {
  turn.s.askUntil = turn.now + ASK_WINDOW_MS;
  speak(turn, say({ key: 'ask.listening' }));
}

/** The window closes by itself. `expire` of step.ts runs this before each input. */
export function expireAskWindow(turn: Turn): void {
  // A session that an older server stored has no value here, and that counts as a closed window.
  if (typeof turn.s.askUntil !== 'number' || turn.s.askUntil <= turn.now) turn.s.askUntil = null;
}

/**
 * The product that a question is about: the product of the current prompt, else the product in view
 * that was seen last, else the product of the last add.
 */
function askTarget(turn: Turn): Product | undefined {
  const { s, now, ctx } = turn;
  if (s.prompt?.kind === 'product') return ctx.catalog.get(s.prompt.productId);

  let lastSeen: { productId: string; at: number } | null = null;
  for (const [productId, at] of Object.entries(s.seen)) {
    if (inView(at, now) && (lastSeen === null || at > lastSeen.at)) lastSeen = { productId, at };
  }
  if (lastSeen) return ctx.catalog.get(lastSeen.productId);
  return s.lastAdd ? ctx.catalog.get(s.lastAdd.productId) : undefined;
}

export function onQuestion(turn: Turn, input: Extract<RuleInput, { type: 'question' }>): void {
  const { s } = turn;
  if (s.askUntil === null) return;
  s.askUntil = null;
  const product = askTarget(turn);
  if (!product) {
    speak(turn, say({ key: 'ask.noProduct' }));
    return;
  }
  turn.out.push({ type: 'ask', question: input.text, product });
}

export function onAnswerText(turn: Turn, input: Extract<RuleInput, { type: 'answer' }>): void {
  speak(turn, say(input.text === null ? { key: 'ask.failed' } : { key: 'ask.answer', text: input.text }));
}
