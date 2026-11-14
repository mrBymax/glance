import { screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { ASK_MESSAGE } from '../bridge/askMessage';
import { SNAPSHOT } from '../debug/fixtures';
import { renderWithUi } from '../test/render';
import { SessionScreen } from './SessionScreen';

it('asks the app to listen when the shopper presses the microphone button', async () => {
  const { bridge, user } = renderWithUi(<SessionScreen />, { messages: [{ t: 'snapshot', session: { ...SNAPSHOT, phase: 'shopping' } }] });
  await user.click(screen.getByRole('button', { name: 'Ask a question' }));
  expect(bridge.sent).toContainEqual(ASK_MESSAGE);
});
it('shows the button during checkout', () => {
  renderWithUi(<SessionScreen />, { messages: [{ t: 'snapshot', session: { ...SNAPSHOT, phase: 'checkout' } }] });
  expect(screen.getByRole('button', { name: 'Ask a question' })).toBeInTheDocument();
});
it('hides the button when the shop is over', () => {
  renderWithUi(<SessionScreen />, { messages: [{ t: 'snapshot', session: { ...SNAPSHOT, phase: 'ended' } }] });
  expect(screen.queryByRole('button', { name: 'Ask a question' })).toBeNull();
});
it('hides the button before the first session', () => {
  renderWithUi(<SessionScreen />);
  expect(screen.queryByRole('button', { name: 'Ask a question' })).toBeNull();
});
