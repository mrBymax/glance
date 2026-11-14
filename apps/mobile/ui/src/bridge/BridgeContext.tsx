import type { GlanceBridge, PageToNative } from '@glance/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { useSpokenText } from '../components/useSpokenText';
import { initialUiState, reduce, type UiAction, type UiState } from '../state/uiState';
import { stringsFor, type Strings } from '../text/strings';

export type Ui = {
  state: UiState;
  strings: Strings;
  bridge: GlanceBridge;
  send(message: PageToNative): void;
  dispatch(action: UiAction): void;
};

const UiContext = createContext<Ui | null>(null);

// The shopper tries a setup step or a start again, so the error of the last attempt goes away.
const ATTEMPTS: ReadonlySet<PageToNative['t']> = new Set(['setup.register', 'setup.requestCamera', 'session.start']);

export function BridgeProvider(props: { bridge: GlanceBridge; children: ReactNode }) {
  const { bridge, children } = props;
  const [state, dispatch] = useReducer(reduce, initialUiState);
  const strings = stringsFor(state.profile.lang);
  useSpokenText(state, strings);

  useEffect(() => {
    // The host answers ui.ready at once, so the page must listen first.
    const unsubscribe = bridge.subscribe(dispatch);
    bridge.send({ t: 'ui.ready' });
    return unsubscribe;
  }, [bridge]);

  const send = useCallback((message: PageToNative) => {
    if (ATTEMPTS.has(message.t)) dispatch({ t: 'local.attempt' });
    bridge.send(message);
  }, [bridge]);

  const ui = useMemo(() => ({ state, strings, bridge, send, dispatch }), [state, strings, bridge, send]);
  return <UiContext.Provider value={ui}>{children}</UiContext.Provider>;
}

export function useUi(): Ui {
  const ui = useContext(UiContext);
  if (!ui) throw new Error('useUi needs a BridgeProvider above it');
  return ui;
}
