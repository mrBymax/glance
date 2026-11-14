import { screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { eventMessage } from '../debug/fixtures';
import { renderWithUi } from '../test/render';
import { EN } from '../text/strings';
import { CaptionList } from './CaptionList';

const caption = (id: string, text: string) => eventMessage('caption', { id, text, lang: 'en' });

it('names the captions as a section with a heading', () => {
  renderWithUi(<CaptionList />);
  expect(screen.getByRole('region', { name: 'Captions' })).toBeInTheDocument();
  expect(screen.getByText(EN.noCaptions)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Repeat the last line' })).toBeNull();
});
it('marks the newest line, and keeps the lines out of each live region', () => {
  renderWithUi(<CaptionList />, { messages: [caption('c-1', 'First line.'), caption('c-2', 'Second line.')] });
  const region = screen.getByRole('region', { name: 'Captions' });
  expect(within(region).getByText('Second line.').closest('.glance-caption--newest')).not.toBeNull();
  expect(within(region).getByText('First line.').closest('.glance-caption--newest')).toBeNull();
  expect(region.closest('[aria-live]')).toBeNull();
  expect(region.querySelector('[aria-live]:not(button [aria-live])')).toBeNull();
});
// jsdom has no layout. In a browser the window takes a tab stop when its lines overflow it.
it('keeps the lines in one named window', () => {
  renderWithUi(<CaptionList />, { messages: [caption('c-1', 'First line.')] });
  expect(within(screen.getByRole('group', { name: 'Captions' })).getByText('First line.')).toBeInTheDocument();
});
