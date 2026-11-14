import { useAnnounce } from '@astryxdesign/core/hooks';
import { useEffect, useRef } from 'react';
import type { UiState } from '../state/uiState';
import { cartStatusLine } from '../text/format';
import type { Strings } from '../text/strings';

/**
 * Writes each new caption and each cart change into the polite live region.
 * A snapshot that brings a session gives no announcement: its captions are old lines.
 * The state must change one message at a time, so that a caption event does not hide behind a snapshot.
 */
export function useSpokenText(state: UiState, strings: Strings): void {
  const announce = useAnnounce();
  const previous = useRef(state);

  useEffect(() => {
    const before = previous.current;
    previous.current = state;
    if (before === state) return;
    if (before.sessionId === state.sessionId) {
      const known = new Map(before.captions.map((caption) => [caption.id, caption.text]));
      for (const caption of state.captions) {
        if (known.get(caption.id) !== caption.text) announce(caption.text);
      }
    }
    if (state.cartSeq > before.cartSeq) announce(cartStatusLine(state.cart, strings));
  }, [state, strings, announce]);
}
