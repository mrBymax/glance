import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Logo } from './Logo';

it('names the logo and gives it a box before the file loads', () => {
  render(<Logo size="header" alt="Meta Glance" />);
  const logo = screen.getByRole('img', { name: 'Meta Glance' });
  expect(logo).toHaveAttribute('height', '30');
  expect(logo).toHaveAttribute('width', '169');
});
it('shows the dark word mark in the dark scheme and the ink word mark in the light scheme', () => {
  render(<Logo size="hero" alt="Meta Glance" />);
  const logo = screen.getByRole('img', { name: 'Meta Glance' });
  const dark = logo.parentElement?.querySelector('source');
  expect(dark).toHaveAttribute('media', '(prefers-color-scheme: dark)');
  expect(dark?.getAttribute('srcset')).toMatch(/logo-dark\.svg$/);
  expect(logo.getAttribute('src')).toMatch(/logo-light\.svg$/);
});
it('is decorative with an empty text alternative', () => {
  const { container } = render(<Logo size="header" alt="" />);
  expect(screen.queryByRole('img')).toBeNull();
  expect(container.querySelector('img')).toHaveAttribute('alt', '');
});
it('plays its entrance once for each load of the page', () => {
  const first = render(<Logo size="hero" alt="Meta Glance" hasEntrance />);
  expect(first.container.querySelector('picture')).toHaveClass('glance-logo--enter');
  first.unmount();
  const second = render(<Logo size="hero" alt="Meta Glance" hasEntrance />);
  expect(second.container.querySelector('picture')).not.toHaveClass('glance-logo--enter');
});
