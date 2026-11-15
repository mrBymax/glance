import type { GlanceBridge, PageToNative, ProfilePatch } from '@glance/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { snapshotCaptionsOf, useSpokenText, type SnapshotCaptions } from '../components/useSpokenText';
import { initialUiState, reduce, type UiAction, type UiState } from '../state/uiState';
import { EN, stringsFor, type Strings } from '../text/strings';

export type Ui = {
  state: UiState;
  strings: Strings;
  bridge: GlanceBridge;
  send(message: PageToNative): void;
  dispatch(action: UiAction): void;
  /** Shows the new value at once, then sends the patch to the host. */
  setProfile(patch: ProfilePatch): void;
};

const UiContext = createContext<Ui | null>(null);

// The shopper tries a setup step or a start again, so the error of the last attempt goes away.
const ATTEMPTS: ReadonlySet<PageToNative['t']> = new Set(['setup.register', 'setup.requestCamera', 'setup.requestNotifications', 'session.start']);

export function BridgeProvider(props: { bridge: GlanceBridge; children: ReactNode }) {
  const { bridge, children } = props;
  const [state, setState] = useState(initialUiState);
  // The newest state. Two messages can arrive before the next render, and the second one needs the state after the first.
  const newest = useRef(initialUiState);
  const dispatch = useCallback((action: UiAction) => {
    newest.current = reduce(newest.current, action);
    setState(newest.current);
  }, []);
  const strings = stringsFor(state.profile.lang);
  const snapshotCaptions = useRef<SnapshotCaptions>(new Map());
  useSpokenText(state, strings, snapshotCaptions);

  // A screen reader selects its voice from the language of the document.
  useEffect(() => {
    document.documentElement.lang = state.profile.lang;
  }, [state.profile.lang]);

  useEffect(() => {
    // The host answers ui.ready at once, so the page must listen first.
    const unsubscribe = bridge.subscribe((message) => {
      if (message.t === 'snapshot') snapshotCaptions.current = snapshotCaptionsOf(message.session.captions);
      dispatch(message);
    });
    bridge.send({ t: 'ui.ready' });
    return unsubscribe;
  }, [bridge, dispatch]);

  const send = useCallback((message: PageToNative) => {
    if (ATTEMPTS.has(message.t)) dispatch({ t: 'local.attempt' });
    bridge.send(message);
  }, [bridge, dispatch]);

  const setProfile = useCallback((patch: ProfilePatch) => {
    dispatch({ t: 'local.profile', patch });
    bridge.send({ t: 'profile.set', patch });
  }, [bridge, dispatch]);

  const ui = useMemo(() => ({ state, strings, bridge, send, dispatch, setProfile }), [state, strings, bridge, send, dispatch, setProfile]);
  return <UiContext.Provider value={ui}>{children}</UiContext.Provider>;
}

/** Returns the strings of the page. With no BridgeProvider above, it returns the English strings. */
export function useStrings(): Strings {
  return useContext(UiContext)?.strings ?? EN;
}

export function useUi(): Ui {
  const ui = useContext(UiContext);
  if (!ui) throw new Error('useUi needs a BridgeProvider above it');
  return ui;
}
