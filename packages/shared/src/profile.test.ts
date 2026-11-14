import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE, ProfilePatchSchema, ProfileSchema } from './profile';

describe('profile', () => {
  it('fills each default', () => {
    expect(ProfileSchema.parse({})).toEqual(DEFAULT_PROFILE);
    expect(DEFAULT_PROFILE).toEqual({
      lang: 'en', detail: 'standard', speechRate: 1, speakPrices: true, headGestures: true,
      yesGesture: 'nod', headWindowMs: 8000, haptics: true, mainYes: 'head',
      allergens: [], vegan: false, vegetarian: false, budgetCents: null,
    });
  });
  it('drops an unknown key from a patch', () => {
    expect(ProfilePatchSchema.parse({ speechRate: 1.5, foo: 1 })).toEqual({ speechRate: 1.5 });
  });
  it('rejects values out of range', () => {
    expect(ProfilePatchSchema.safeParse({ speechRate: 3 }).success).toBe(false);
    expect(ProfilePatchSchema.safeParse({ headWindowMs: 9000 }).success).toBe(false);
    expect(ProfilePatchSchema.safeParse({ allergens: ['gluten', 'kiwi'] }).success).toBe(false);
    expect(ProfilePatchSchema.safeParse({ budgetCents: 0 }).success).toBe(false);
  });
  it('freezes the default profile, and each parse makes a new allergen list', () => {
    expect(Object.isFrozen(DEFAULT_PROFILE)).toBe(true);
    expect(Object.isFrozen(DEFAULT_PROFILE.allergens)).toBe(true);
    const profile = ProfileSchema.parse({});
    profile.allergens.push('milk');
    expect(ProfileSchema.parse({}).allergens).toEqual([]);
  });
  it('accepts "while in view" and a budget', () => {
    expect(ProfilePatchSchema.safeParse({ headWindowMs: null }).success).toBe(true);
    expect(ProfilePatchSchema.safeParse({ budgetCents: 2000 }).success).toBe(true);
  });
});
