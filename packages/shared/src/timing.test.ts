import { describe, expect, it } from 'vitest';
import { TIMING } from './timing';

describe('timing', () => {
  it('holds the defaults of the design', () => {
    expect(TIMING).toEqual({
      viewMs: 3000,
      headWindowMs: 8000,
      promptTtlAfterLeftMs: 15000,
      undoWindowMs: 8000,
      excludeAfterNoMs: 10000,
      hintAfterPromptMs: 15000,
      kioskDwellMs: 1500,
      kioskIdleMs: 30000,
      restAfterIdleMs: 180000,
      uploadEveryMs: 500,
      recognitionTimeoutMs: 4000,
      aimHintEveryMs: 5000,
      speechMuteAfterClipMs: 500,
    });
  });
});
