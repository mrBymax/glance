import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { expect, it } from 'vitest';
import { App } from './App';
import { renderWithTheme } from './test/render';

const renderAt = (address: string) =>
  renderWithTheme(<MemoryRouter initialEntries={[address]}><App /></MemoryRouter>);

it.each(['/', '/privacy', '/kiosk?replay=1', '/mirror?replay=1'])('renders one main heading at %s', (address) => {
  renderAt(address);
  expect(screen.getAllByRole('main')).toHaveLength(1);
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
});
it('names an address that has no page', () => {
  renderAt('/nope');
  expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
});
