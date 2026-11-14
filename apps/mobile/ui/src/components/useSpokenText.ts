import { useAnnounce } from '@astryxdesign/core/hooks';
import type { Caption } from '@glance/shared';
import { useEffect, useRef, type RefObject } from 'react';
import type { UiState } from '../state/uiState';
import { cartStatusLine } from '../text/format';
import type { Strings } from '../text/strings';

/** The text of each caption of the last snapshot, by caption ID. */
export type SnapshotCaptions = ReadonlyMap<string, string>;

export function snapshotCaptionsOf(captions: readonly Caption[]): SnapshotCaptions {
  return new Map(captions.map((caption) => [caption.id, caption.text]));
}

/**
 * Writes each new caption and each cart change into the polite live region.
 * The captions of a snapshot are old lines, so they give no announcement. `snapshotCaptions` names them.
 * The state does not say which message brought a caption, so the listener of the bridge fills that ref.
 */
export function useSpokenText(state: UiState, strings: Strings, snapshotCaptions?: RefObject<SnapshotCaptions>): void {
  const announce = useAnnounce();
  const previous = useRef(state);

  useEffect(() => {
    const before = previous.current;
    previous.current = state;
    if (before === state) return;
    const known = new Map(before.captions.map((caption) => [caption.id, caption.text]));
    for (const caption of state.captions) {
      const isOld = known.get(caption.id) === caption.text || snapshotCaptions?.current.get(caption.id) === caption.text;
      if (!isOld) announce(caption.text);
    }
    if (state.cartSeq > before.cartSeq) announce(cartStatusLine(state.cart, strings));
  }, [state, strings, announce, snapshotCaptions]);
}
