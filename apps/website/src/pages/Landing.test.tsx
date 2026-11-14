import { screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { LINKS, landingCopy } from '../content/landing';
import type { Probe } from '../content/probe';
import { renderWithTheme as render } from '../test/render';
import { Landing } from './Landing';

const head: Probe = { motion: true, inputs: true, speech: 'glasses', access: 'developerMode' };
const numbers = (value: number | null) => ({
  context: value === null ? null : 'Measured on 14 November 2026 at the venue.',
  items: [{ id: 'false-yes', label: 'False yes in the walk test', value, unit: 'in 15 minutes', note: 'Two people walk.' }],
});

it('shows the headline as the only level 1 heading', () => {
  render(<Landing probe={head} />);
  expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Glance tells. Nod buys.']);
});
it('shows the team logo', () => {
  render(<Landing />);
  expect(screen.getByRole('img', { name: 'Glance' }).getAttribute('src')).toBe('/logo-light.svg');
});
it('has one level 2 heading for each part of spec section 12, in order', () => {
  render(<Landing />);
  expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
    'Why glasses', 'The demo', 'Three steps', 'Accessibility', 'What leaves the phone', 'Measured numbers', 'Try it', 'Team']);
});
it('shows "Not measured yet" for a number with no value', () => {
  render(<Landing numbers={numbers(null)} />);
  expect(screen.getByText('Not measured yet')).toBeTruthy();
  expect(screen.getByText('The team has not measured these numbers yet.')).toBeTruthy();
});
it('shows a measured value of 0 with its unit and the context sentence', () => {
  render(<Landing numbers={numbers(0)} />);
  expect(screen.getByText('0 in 15 minutes')).toBeTruthy();
  expect(screen.getByText('Measured on 14 November 2026 at the venue.')).toBeTruthy();
});
it('shows one plain line and no link while the APK is not online', () => {
  render(<Landing links={{ ...LINKS, apkUrl: null }} />);
  expect(screen.queryByRole('link', { name: /Download the Android app/ })).toBeNull();
  expect(screen.getByText('The APK is not online yet.')).toBeTruthy();
});
it('links to the APK when it is online', () => {
  render(<Landing links={{ ...LINKS, apkUrl: 'https://example.org/glance.apk' }} />);
  expect(screen.getByRole('link', { name: /Download the Android app/ }).getAttribute('href')).toBe('https://example.org/glance.apk');
});
it('shows one plain line while the video is not online, and the player when it is', () => {
  const { unmount } = render(<Landing links={{ ...LINKS, videoId: null }} />);
  expect(screen.getByText('The video is not online yet.')).toBeTruthy();
  unmount();
  render(<Landing links={{ ...LINKS, videoId: 'abc123XYZ_-' }} />);
  expect(screen.getByTitle('Meta Glance demo video').getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/abc123XYZ_-');
});
it('gives each sourced claim a link to its source', () => {
  render(<Landing probe={head} />);
  const copy = landingCopy(head);
  for (const claim of [...copy.story, ...copy.accessibility, ...copy.data, copy.trySetup, ...copy.tryNotes, copy.event]) {
    if (!claim.source?.url) continue;
    const links = screen.getAllByRole('link', { name: new RegExp(`Source: ${claim.source.name.replace(/[()]/g, '\\$&')}`) });
    expect(links.map((a) => a.getAttribute('href'))).toContain(claim.source.url);
  }
});
it('links to the privacy page and lists the team', () => {
  render(<Landing team={[{ name: 'Ada Example', role: 'Server' }]} />);
  expect(screen.getByRole('link', { name: /Read the privacy page/ }).getAttribute('href')).toBe('/privacy');
  expect(screen.getByText('Ada Example, Server')).toBeTruthy();
});
