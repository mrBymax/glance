import { Theme } from '@astryxdesign/core/theme';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import axe from 'axe-core';
import { expect, it, vi } from 'vitest';
import { App } from './App';
import { defaultThemeSlug, themes } from './astryx-themes';
import { SECTIONS } from './content/site';
import { TEAM } from './content/team';
import { startHeroAnimation } from './hero/animation';

vi.mock('./hero/animation', () => ({ startHeroAnimation: vi.fn(() => new Promise(() => {})) }));

const renderPage = () =>
  render(
    <Theme theme={themes[defaultThemeSlug]}>
      <App />
    </Theme>,
  );

it('renders one main landmark with the product name as its only h1', () => {
  renderPage();
  expect(screen.getAllByRole('main')).toHaveLength(1);
  const titles = screen.getAllByRole('heading', { level: 1 });
  expect(titles).toHaveLength(1);
  expect(titles[0]).toHaveTextContent('Meta Glance');
});

it('shows the section headings in the order of the page', () => {
  renderPage();
  const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
  expect(headings).toEqual([
    'The glasses are the scanner.',
    'Four moves, from the shelf to the exit.',
    'Built for the shopper who cannot see the label.',
    'How the parts talk.',
    'A prototype, said plainly.',
    'The team',
    'Questions',
    'Glance tells. Nod buys.',
  ]);
});

it('lists each section in the sticky navigation, in the order of the page', () => {
  const { container } = renderPage();
  const nav = screen.getByRole('navigation', { name: 'Sections' });
  const links = within(nav).getAllByRole('link');
  expect(links.map((link) => link.getAttribute('href'))).toEqual(SECTIONS.map(({ id }) => `#${id}`));
  const sectionOrder = SECTIONS.map(({ id }) => container.querySelector(`#${id}`));
  for (let index = 1; index < sectionOrder.length; index += 1) {
    const previous = sectionOrder[index - 1]!;
    const next = sectionOrder[index]!;
    expect(previous.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  }
});

it('points each in-page link at an element of the page', () => {
  const { container } = renderPage();
  const anchors = [...container.querySelectorAll('a[href^="#"]')];
  expect(anchors.length).toBeGreaterThan(10);
  for (const anchor of anchors) {
    const id = anchor.getAttribute('href')!.slice(1);
    expect(document.getElementById(id), `#${id}`).not.toBeNull();
  }
});

it('shows the four team members with their photos', () => {
  renderPage();
  const team = screen.getByRole('region', { name: 'The team' });
  const names = within(team).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
  expect(names).toEqual(TEAM.map((member) => member.name));
  expect(names).toHaveLength(4);
  for (const member of TEAM) expect(team.querySelector(`img[src*="team-${member.id}-"]`)).not.toBeNull();
});

it('says in the footer that Meta Glance is not a product of Meta, and credits Open Food Facts', () => {
  renderPage();
  const footer = screen.getByRole('contentinfo');
  expect(footer).toHaveTextContent('It is not a product of Meta');
  expect(within(footer).getByRole('link', { name: 'Open Food Facts' })).toHaveAttribute('href', 'https://world.openfoodfacts.org');
  expect(within(footer).getByRole('link', { name: 'Open Database License' })).toBeInTheDocument();
});

it('does not start the animation for a shopper who asked for less motion, and plays it on request', async () => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} }));
  // A browser with WebGL, so only the motion setting stops the animation.
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as RenderingContext);
  vi.mocked(startHeroAnimation).mockClear();
  renderPage();
  await act(async () => {
    window.dispatchEvent(new Event('load'));
    await new Promise((resolve) => setTimeout(resolve, 400));
  });
  expect(startHeroAnimation).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Play the animation' }));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(startHeroAnimation).toHaveBeenCalledTimes(1);
  getContext.mockRestore();
});

it('has no axe violation of WCAG 2.2 A and AA that jsdom can check', async () => {
  const { container } = renderPage();
  // jsdom computes no color and no layout, so contrast and target size are checked in Chrome by scripts/check-page.mjs.
  const result = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    rules: { 'color-contrast': { enabled: false }, 'target-size': { enabled: false } },
  });
  expect(result.violations.map((violation) => `${violation.id}: ${violation.nodes[0]?.target.join(' ')}`)).toEqual([]);
});
