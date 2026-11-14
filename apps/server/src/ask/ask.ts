import { type Lang, type Product, formatEur, localize } from '@glance/shared';

/** How long the server waits for the question after "Listening." */
export const ASK_WINDOW_MS = 10000;
/** One answer has this time. After it the voice says that it could not answer. */
export const ASK_TIMEOUT_MS = 4000;

/** The path of the instruction file, from the working directory apps/server. */
export const ANSWERS_TEMPLATE_PATH = '../../agents/answers.md';

/** One text call of the model. A call that fails rejects. */
export type Generate = (systemInstruction: string, text: string) => Promise<string>;

const MAX_ANSWER_CHARS = 200;
const LANGUAGE_NAMES: Record<Lang, string> = { en: 'English', it: 'Italian' };

/** The data of one product that the model can answer from. It holds no ID and no other product. */
function productData(product: Product, lang: Lang): string {
  return JSON.stringify({
    name: localize(product.name, lang),
    brand: product.brand,
    packSize: product.packSize,
    price: formatEur(product.priceCents),
    allergens: product.allergens,
    vegan: product.vegan,
    vegetarian: product.vegetarian,
  });
}

/** Cuts at the last sentence end that fits. A text with no sentence end is cut at a word. */
function shorten(text: string): string {
  if (text.length <= MAX_ANSWER_CHARS) return text;
  const head = text.slice(0, MAX_ANSWER_CHARS + 1);
  let end = -1;
  for (const match of head.matchAll(/[.!?](?=\s)/g)) end = match.index;
  if (end >= 0) return head.slice(0, end + 1);
  const space = head.lastIndexOf(' ');
  return (space > 0 ? head.slice(0, space) : head.slice(0, MAX_ANSWER_CHARS)).trimEnd();
}

/**
 * Answers one spoken question about one product with one text call.
 * `template` is the system instruction of agents/answers.md.
 * Rejects when the call fails or when the model gives no text.
 */
export async function answerQuestion(
  generate: Generate, template: string, input: { question: string; product: Product; lang: Lang },
): Promise<string> {
  const text = [
    `Language: ${LANGUAGE_NAMES[input.lang]}`,
    `Question: ${input.question}`,
    `Product: ${productData(input.product, input.lang)}`,
  ].join('\n');
  const answer = (await generate(template, text)).trim().replace(/\s+/g, ' ');
  if (answer === '') throw new Error('The model gave no answer.');
  return shorten(answer);
}
