import type { PageToNative } from '@glance/shared';

/** Asks the app to listen for a question. The server opens the question window for it. */
export const ASK_MESSAGE: PageToNative = { t: 'intent', kind: 'ask' };
