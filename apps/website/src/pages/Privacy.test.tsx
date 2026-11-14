import { screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { renderWithTheme as render } from '../test/render';
import { Privacy } from './Privacy';

it('shows the title as the only level 1 heading, and one level 2 heading for each section', () => {
  render(<Privacy />);
  expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Privacy']);
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(11);
});
it('shows the steps that delete the data, and the link for a person with no app', () => {
  render(<Privacy facts={{ geminiNoTrainingConfirmed: false, contactEmail: null, deleteBy: '30 November 2026' }} />);
  expect(screen.getByText('Tap "Delete my data".')).toBeTruthy();
  expect(screen.getByRole('link', { name: /Open an issue on GitHub/ }).getAttribute('href')).toBe('https://github.com/mrBymax/glance/issues');
});
