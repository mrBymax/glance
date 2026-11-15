import { screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { eventFixture, eventMessage } from '../debug/fixtures';
import { SessionScreen } from '../screens/SessionScreen';
import { renderWithTheme, renderWithUi } from '../test/render';
import { LookAlikeNotice } from './LookAlikeNotice';

const candidates = eventFixture('glance.ambiguous').candidates;

it('says that it cannot tell the products apart, and names them with no price', () => {
  renderWithTheme(<LookAlikeNotice candidates={candidates} />);
  expect(screen.getByText('I cannot tell which product this is.')).toBeInTheDocument();
  expect(screen.getByText('Turn the front to me.')).toBeInTheDocument();
  expect(screen.getByText('It can be one of these products:')).toBeInTheDocument();
  for (const item of candidates) expect(screen.getAllByText(`${item.name}, ${item.packSize}`).length).toBeGreaterThan(0);
  expect(screen.queryByText(/EUR/)).toBeNull();
  expect(screen.queryByText(/\d\.\d\d/)).toBeNull();
});
it('shows on the session screen until the next prompt', () => {
  const { deliver } = renderWithUi(<SessionScreen />, { messages: [eventMessage('glance.ambiguous')] });
  expect(screen.getByText('I cannot tell which product this is.')).toBeInTheDocument();
  expect(screen.queryByText('Hold a product up to hear its price.')).toBeNull();
  deliver(eventMessage('glance.pending'));
  expect(screen.queryByText('I cannot tell which product this is.')).toBeNull();
});
it('shows the product prompt, and not the notice, when both are set', () => {
  renderWithUi(<SessionScreen />, { messages: [eventMessage('glance.pending'), eventMessage('glance.ambiguous')] });
  expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  expect(screen.queryByText('I cannot tell which product this is.')).toBeNull();
});
