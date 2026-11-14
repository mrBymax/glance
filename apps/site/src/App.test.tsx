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

it('renders one main landmark with the product name and the claim as its only h1', () => {
  renderPage();
  expect(screen.getAllByRole('main')).toHaveLength(1);
  const titles = screen.getAllByRole('heading', { level: 1 });
  expect(titles).toHaveLength(1);
  expect(titles[0]).toHaveTextContent('Meta Glance');
  expect(titles[0]).toHaveTextContent('Look. Nod. Done.');
});

it('shows the section headings in the order of the page', () => {
  renderPage();
  const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
  expect(headings).toEqual([
    'A code you look at.',
    'One loop for every place.',
    'What you can build with it.',
    'The first demo: a store you shop with your eyes.',
    'The same loop, in the lens.',
    'Built to be built on.',
    'Why a look and a nod.',
    'The team',
    'Questions',
    'Look. Nod. Done.',
  ]);
});

it('presents the bus ticket among the use cases, and marks only the checkout as the demo', () => {
  renderPage();
  const useCases = screen.getByRole('region', { name: 'What you can build with it.' });
  expect(within(useCases).getByRole('heading', { name: 'Buy a bus ticket' })).toBeInTheDocument();
  expect(within(useCases).getAllByText('Demo')).toHaveLength(1);
  expect(within(useCases).getByText('Demo').closest('li')).toHaveTextContent('Pay at a checkout');
});

it('shows the display mock as a still with a text alternative, and loads no frame before the section is near', () => {
  renderPage();
  const display = screen.getByRole('region', { name: 'The same loop, in the lens.' });
  expect(display).toHaveTextContent('This is a mock of that display');
  const steps = within(display).getAllByRole('listitem').map((item) => item.textContent ?? '');
  expect(steps).toHaveLength(7);
  expect(steps[1]).toMatch(/^Rye bread, 500 g, 2\.60 EUR\. Add to cart\?/);
  expect(steps[2]).toMatch(/After a nod: Added: Rye bread/);
  expect(display.querySelector('img[src*="hud-still-"]')).not.toBeNull();
  expect(display.querySelector('iframe')).toBeNull();
  expect(within(display).getByRole('button', { name: 'Pause the mock' })).toBeInTheDocument();
});

it('states no test dates or failures', () => {
  const { container } = renderPage();
  expect(container.textContent).not.toMatch(/2026-11|14 November|arm length|has not tested|mock mode/);
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

it('shows the four team members in alphabetical order, with their photos and titles', () => {
  renderPage();
  const team = screen.getByRole('region', { name: 'The team' });
  const names = within(team).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent ?? '');
  expect(names).toEqual(['Alessandro De Biasi', 'Federico Bertossi', 'Marco Ceccon', 'Michele Lizzit']);
  for (const member of TEAM) {
    expect(team.querySelector(`img[src*="team-${member.id}-"]`)).not.toBeNull();
    expect(within(team).getByText(member.role)).toBeInTheDocument();
  }
});

it('opens and closes a question with its button', async () => {
  renderPage();
  const question = screen.getByRole('button', { name: 'Do I need to take out my phone?' });
  expect(question).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(question);
  expect(question).toHaveAttribute('aria-expanded', 'true');
  expect(document.getElementById(question.getAttribute('aria-controls')!)).toHaveTextContent('can stay locked in a pocket');
  fireEvent.click(question);
  expect(question).toHaveAttribute('aria-expanded', 'false');
});

it('gives the diagram of the parts a title and a text alternative', () => {
  renderPage();
  expect(screen.getAllByRole('img', { name: /How the Glance protocol works/ })).toHaveLength(2);
  expect(screen.getByText(/The place registers with the Glance server and gets the result/)).toBeInTheDocument();
});

it('says in the footer that Meta Glance is not a product of Meta, and credits Open Food Facts', () => {
  renderPage();
  const footer = screen.getByRole('contentinfo');
  expect(footer).toHaveTextContent('It is not a product of Meta');
  expect(within(footer).getByRole('link', { name: 'Open Food Facts' })).toHaveAttribute('href', 'https://world.openfoodfacts.org');
  expect(within(footer).getByRole('link', { name: 'Open Database License' })).toBeInTheDocument();
});

it('plays the animation once after the load, and never with reduced motion, with no control on the page', async () => {
  // A browser with WebGL, so only the motion setting decides.
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as RenderingContext);
  const load = async () => {
    await act(async () => {
      window.dispatchEvent(new Event('load'));
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
  };

  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} }));
  vi.mocked(startHeroAnimation).mockClear();
  const { unmount } = renderPage();
  await load();
  expect(startHeroAnimation).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: /animation/ })).toBeNull();
  unmount();

  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
  renderPage();
  await load();
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
