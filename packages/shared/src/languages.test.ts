import { describe, expect, it } from 'vitest';
import { LANGS, LocalizedSchema, localize } from './languages';

describe('languages', () => {
  it('lists English and Italian', () => {
    expect(LANGS).toEqual(['en', 'it']);
  });
  it('returns the text in the requested language', () => {
    expect(localize({ en: 'Oat drink', it: 'Bevanda di avena' }, 'it')).toBe('Bevanda di avena');
  });
  it('falls back to English when Italian is missing', () => {
    expect(localize({ en: 'Oat drink' }, 'it')).toBe('Oat drink');
  });
  it('requires English text', () => {
    expect(LocalizedSchema.safeParse({ it: 'Bevanda' }).success).toBe(false);
    expect(LocalizedSchema.safeParse({ en: '' }).success).toBe(false);
  });
});
