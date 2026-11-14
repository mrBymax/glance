import { EMPTY_CART, type Caption, type Cart, type Phase, type ServerEvent, type SessionSnapshot } from '@glance/shared';

export const MIRROR_CAPTIONS = 5;

/** `captions` holds the last MIRROR_CAPTIONS lines, oldest first. `phase` is null until the server names it. */
export type MirrorState = { captions: Caption[]; cart: Cart; phase: Phase | null };

export const initialMirrorState: MirrorState = { captions: [], cart: EMPTY_CART, phase: null };

export function fromSnapshot(snapshot: SessionSnapshot): MirrorState {
  return { captions: snapshot.captions.slice(-MIRROR_CAPTIONS), cart: snapshot.cart, phase: snapshot.phase };
}

function withCaption(captions: Caption[], caption: Caption): Caption[] {
  const isKnown = captions.some((old) => old.id === caption.id);
  const next = isKnown ? captions.map((old) => (old.id === caption.id ? caption : old)) : [...captions, caption];
  return next.slice(-MIRROR_CAPTIONS);
}

/** Returns the same state object for an event that the mirror does not show. */
export function mirrorReduce(state: MirrorState, event: ServerEvent): MirrorState {
  switch (event.type) {
    case 'caption': {
      const { type, ...caption } = event;
      return { ...state, captions: withCaption(state.captions, caption) };
    }
    case 'cart.updated':
      return { ...state, cart: event.cart };
    case 'session.state':
      return { ...state, phase: event.phase };
    default:
      return state;
  }
}

export type MirrorTarget = { sessionId: string; token: string } | { latestKey: string };

export const LATEST_POLL_MS = 2000;

/** Reads the flags `s` and `t`, or the flag `latest`. A session with its token wins over `latest`. */
export function mirrorFlags(search: string): MirrorTarget | null {
  const flags = new URLSearchParams(search);
  const sessionId = flags.get('s');
  const token = flags.get('t');
  if (sessionId && token) return { sessionId, token };
  const latestKey = flags.get('latest');
  return latestKey ? { latestKey } : null;
}
