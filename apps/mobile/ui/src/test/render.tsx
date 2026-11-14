import { Theme } from '@astryxdesign/core/theme';
import type { NativeState, NativeToPage } from '@glance/shared';
import { act, render, type RenderResult } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { defaultThemeSlug, themes } from '../astryx-themes';
import { BridgeProvider } from '../bridge/BridgeContext';
import { BrowserBridge } from '../bridge/browserBridge';
import { NATIVE_READY } from '../bridge/fakeNative';

export function renderWithTheme(ui: ReactElement): RenderResult {
  return render(<Theme theme={themes[defaultThemeSlug]}>{ui}</Theme>);
}

/**
 * Renders `ui` with a BrowserBridge that has no server. The start state is `options.native`, default NATIVE_READY.
 * `deliver` gives each message its own render, as the page gets them from a host.
 */
export function renderWithUi(ui: ReactElement, options: { native?: NativeState; messages?: NativeToPage[] } = {}):
  RenderResult & { bridge: BrowserBridge; user: UserEvent; deliver(...messages: NativeToPage[]): void } {
  const bridge = new BrowserBridge({ apiBase: null, nativeState: options.native ?? NATIVE_READY });
  const user = userEvent.setup();
  const result = render(
    <Theme theme={themes[defaultThemeSlug]}>
      <BridgeProvider bridge={bridge}>{ui}</BridgeProvider>
    </Theme>,
  );
  const deliver = (...messages: NativeToPage[]) => {
    for (const message of messages) act(() => bridge.inject(message));
  };
  deliver(...(options.messages ?? []));
  return { ...result, bridge, user, deliver };
}
