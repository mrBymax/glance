import { screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { App } from './App';
import { AndroidBridge } from './bridge/androidBridge';
import { BridgeProvider } from './bridge/BridgeContext';
import { renderWithTheme, renderWithUi } from './test/render';

const renderInWebView = (address: string) => {
  history.replaceState(null, '', address);
  const bridge = new AndroidBridge({ GlanceNative: { postMessage: () => undefined } });
  return renderWithTheme(<BridgeProvider bridge={bridge}><App /></BridgeProvider>);
};

afterEach(() => history.replaceState(null, '', '/'));

it('shows the debug panel in a browser', () => {
  renderWithUi(<App />);
  expect(screen.getByRole('button', { name: 'Debug' })).toBeInTheDocument();
});
it('hides the debug panel inside the app', () => {
  renderInWebView('/');
  expect(screen.getByText('Starting Glance.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Debug' })).toBeNull();
});
it('shows the debug panel inside the app with the flag debug', () => {
  renderInWebView('/?debug=1');
  expect(screen.getByRole('button', { name: 'Debug' })).toBeInTheDocument();
});
