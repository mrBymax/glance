import { expect, it } from 'vitest';
import { copyProblems } from './copyRules';
import { LINKS } from './landing';
import { privacyCopy, privacyText } from './privacy';
import type { PrivacyFacts } from './privacy';
import type { Probe } from './probe';

const probe: Probe = { motion: true, inputs: true, speech: 'glasses', access: 'developerMode' };
const facts: PrivacyFacts = { geminiNoTrainingConfirmed: false, contactEmail: null, deleteBy: '30 November 2026' };
const text = (p: Probe = probe, f: PrivacyFacts = facts) => privacyText(privacyCopy(p, f, LINKS)).join(' ');
const deletion = (f: PrivacyFacts = facts) => privacyCopy(probe, f, LINKS).sections.find((s) => s.heading === 'Delete your data');

it('passes the copy rules for each speech result', () => {
  for (const speech of ['glasses', 'phone', 'none'] as const) {
    expect(copyProblems(privacyText(privacyCopy({ ...probe, speech }, facts, LINKS)))).toEqual([]);
  }
});
it('has the topics of spec section 13 in order', () => {
  expect(privacyCopy(probe, facts, LINKS).sections.map((s) => s.heading)).toEqual([
    'What you agree to', 'Camera frames', 'Audio', 'What the server stores', 'Who gets data', 'People near you',
    'Camera time', 'Payment', 'Known gap', 'Delete your data', 'This website']);
});
it('says how to delete data in the app, and by which date the team deletes all data', () => {
  expect(deletion()?.list).toEqual([
    'Open Glance on your phone.', 'Tap "Settings".', 'Tap "Delete my data".', 'Tap "Delete" to confirm.']);
  expect(text()).toContain('by 30 November 2026');
});
it('names a way to ask for deletion without the app', () => {
  expect(deletion()?.link).toEqual({ label: 'Open an issue on GitHub', href: 'https://github.com/mrBymax/glance/issues' });
  expect(deletion({ ...facts, contactEmail: 'team@example.org' })?.link).toEqual({ label: 'Write to team@example.org', href: 'mailto:team@example.org' });
});
it('claims no training by Google only after the team confirms it', () => {
  expect(text()).not.toMatch(/train/);
  expect(text(probe, { ...facts, geminiNoTrainingConfirmed: true })).toContain('Google states that it does not use paid tier data to train its models.');
});
it('describes audio for each speech result', () => {
  expect(text()).toContain('No raw audio leaves the glasses.');
  expect(text({ ...probe, speech: 'phone' })).toContain('speech service of Android');
  expect(text({ ...probe, speech: 'none' })).toContain('Glance does not use a microphone.');
});
