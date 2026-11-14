import { screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { NATIVE_PRESETS } from '../bridge/fakeNative';
import { renderWithUi } from '../test/render';
import { StatusRow } from './StatusRow';

const facts = () => within(screen.getByRole('list')).getAllByRole('listitem').map((item) => item.textContent);

it('states each status in words', () => {
  renderWithUi(<StatusRow />, { native: { ...NATIVE_PRESETS.ready, stream: 'streaming' } });
  expect(facts()).toEqual(['Glasses: Connected', 'Battery: 80%', 'Camera: On', 'Network: Online']);
});
it('states a problem in words, with no glyph for a screen reader', () => {
  renderWithUi(<StatusRow />, { native: { ...NATIVE_PRESETS.battery20, network: 'offline' } });
  expect(facts()).toEqual(['Glasses: Connected', 'Battery: 20%', 'Camera: Off', 'Network: Offline']);
  for (const glyph of screen.getByRole('list').querySelectorAll('svg')) expect(glyph.closest('[aria-hidden="true"]')).not.toBeNull();
});
