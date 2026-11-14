import { expect, it } from 'vitest';
import { copyProblems } from './copyRules';
import { landingCopy, landingText } from './landing';
import type { Probe } from './probe';

const head: Probe = { motion: true, inputs: true, speech: 'glasses', access: 'developerMode' };
const touch: Probe = { ...head, motion: false };
const key: Probe = { ...head, motion: false, inputs: false, speech: 'none' };

it('passes the copy rules for each probe result', () => {
  for (const probe of [head, touch, key, { ...head, access: 'releaseChannel' as const }]) {
    expect(copyProblems(landingText(landingCopy(probe)))).toEqual([]);
  }
});
it('fixes the headline for each main yes', () => {
  expect(landingCopy(head).headline).toBe('Glance tells. Nod buys.');
  expect(landingCopy(touch).headline).toBe('Glance tells. Tap buys.');
  expect(landingCopy(key).headline).toBe('Glance tells. Press buys.');
});
it('has the three steps look, yes, pay', () => {
  expect(landingCopy(head).steps.map((s) => s.title)).toEqual(['Look', 'Nod', 'Pay']);
  expect(landingCopy(touch).steps.map((s) => s.title)).toEqual(['Look', 'Tap', 'Pay']);
});
it('does not name a nod when head gestures do not start', () => {
  for (const probe of [touch, key]) {
    expect(landingText(landingCopy(probe)).join(' ')).not.toMatch(/\bnod\b|\bshake\b/i);
  }
});
it('lists the yes inputs that the probe allows', () => {
  expect(landingCopy(head).accessibility.map((c) => c.text)).toContain(
    'You can add a product or pay in four ways. Use a nod, a spoken word, a double tap on the glasses, or a button on the phone.');
  expect(landingCopy(key).accessibility.map((c) => c.text)).toContain(
    'You can add a product or pay in two ways. Use the volume keys of the phone or a button on the phone.');
});
it('states the honest lines', () => {
  const text = landingText(landingCopy(head)).join(' ');
  for (const line of [
    'With Glance, the store adds no camera and no sensor.',
    'The payment is a demo. No money moves.',
    'Blind and low-vision shoppers have not tested Glance yet.',
    'The camera runs for the whole session, not only for each glance.',
    'It is not a product of Meta.',
  ]) expect(text).toContain(line);
});
it('cites a research file for each sourced claim', () => {
  const copy = landingCopy(head);
  const claims = [...copy.story, ...copy.accessibility, ...copy.data, copy.trySetup, ...copy.tryNotes, copy.event];
  const sourced = claims.filter((c) => c.source);
  expect(sourced.length).toBeGreaterThanOrEqual(11);
  for (const claim of sourced) expect(claim.source?.research, claim.text).toMatch(/^docs\/research\/2026-11-13-/);
});
it('adds the release channel step only when the build needs it', () => {
  expect(landingCopy(head).trySteps).toHaveLength(5);
  expect(landingCopy({ ...head, access: 'releaseChannel' }).trySteps).toHaveLength(6);
});
