import { DEFAULT_PROFILE, type Lang, type Product } from '@glance/shared';
import { promptLines } from './seed';

/** The pause between two calls of the warm-up. The speech service gets one call at a time. */
export const CLIP_WARM_UP_EVERY_MS = 250;

/**
 * Makes the clips of the product prompts before a shopper needs them, in the background. A prompt whose clip
 * exists goes out with no wait, and a clip that the speech service must make costs 300 to 600 ms.
 * The lines are those of the default profile: the prompt with and with no yes phrase, and the prompt for a product
 * in the cart. A prompt with a warning, in another language, or at another detail level gets its clip with its
 * first use, as before. `add` takes products at each time: a line that has its clip costs no call and no pause.
 * `idle` resolves when no line waits. It never rejects.
 */
export function createClipWarmUp(deps: {
  /** Makes the clip of a text, or resolves null when it failed. It never rejects. */
  clipUrl: (text: string, lang: Lang) => Promise<string | null>;
  /** True when the clip of a text exists, with no call. */
  hasClip: (text: string, lang: Lang) => boolean;
  lang?: Lang;
  log: (line: string) => void;
}): { add(products: readonly Product[]): void; stop(): void; idle(): Promise<void> } {
  const lang = deps.lang ?? DEFAULT_PROFILE.lang;
  const waiting: string[] = [];
  let running: Promise<void> | null = null;
  let stopped = false;
  let wake: (() => void) | null = null;
  let timer: NodeJS.Timeout | undefined;
  const pause = (): Promise<void> => new Promise((resolve) => {
    wake = resolve;
    timer = setTimeout(resolve, CLIP_WARM_UP_EVERY_MS);
  });

  const run = async (): Promise<void> => {
    let made = 0;
    let failed = 0;
    for (let text = waiting.shift(); text !== undefined && !stopped; text = waiting.shift()) {
      // Another session can have made the clip while the line waited.
      if (deps.hasClip(text, lang)) continue;
      if (made + failed > 0) await pause();
      if (stopped) return;
      if (await deps.clipUrl(text, lang) === null) failed += 1;
      else made += 1;
    }
    if (!stopped) deps.log(`speech: warm-up ended. made=${made} failed=${failed}`);
  };

  return {
    add(products) {
      if (stopped) return;
      const missing = promptLines(products, lang).filter((text) => !deps.hasClip(text, lang) && !waiting.includes(text));
      if (missing.length === 0) return;
      waiting.push(...missing);
      if (running) return;
      deps.log(`speech: warm-up started. ${missing.length} prompt lines of ${products.length} store items have no clip, one call each ${CLIP_WARM_UP_EVERY_MS} ms`);
      running = run().finally(() => {
        running = null;
      });
    },
    stop() {
      stopped = true;
      waiting.length = 0;
      clearTimeout(timer);
      wake?.();
    },
    idle: async () => {
      await running;
    },
  };
}
