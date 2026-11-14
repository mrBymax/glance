/**
 * Timing defaults in milliseconds. The rule numbers are those of spec section 6.2.
 * No other file repeats one of these numbers.
 */
export const TIMING = {
  // Terms of section 6.2: a target is in view when it was reported within this time.
  viewMs: 3000,
  // R4: the head window of the phone. A nod or a shake counts when the glasses took it in this time after the prompt finished.
  headWindowMs: 8000,
  // R5: a product prompt stays current for this time after its target left the view.
  promptTtlAfterLeftMs: 15000,
  // R10: a no removes the unit that was just added, for this time after the add.
  undoWindowMs: 8000,
  // R9: recognition excludes a skipped product for this time after the no.
  excludeAfterNoMs: 10000,
  // R20: a yes or no with the kiosk code out of view gets a hint, if a pay prompt finished within this time.
  hintAfterPromptMs: 15000,
  // R14: the phone reports a kiosk code after this time in view.
  kioskDwellMs: 1500,
  // R19: the kiosk returns to idle after this time with its code out of view.
  kioskIdleMs: 30000,
  // R22: the camera stops after this time with no product and no kiosk in view.
  restAfterIdleMs: 180000,
  // Section 9.5: the phone uploads the sharpest frame of each interval of this length.
  uploadEveryMs: 300,
  // Section 11.1: the server drops a recognition call that takes more than this time.
  recognitionTimeoutMs: 4000,
  // Section 11.1: the voice gives at most one aim hint in this time.
  aimHintEveryMs: 5000,
  // Section 9.7: the phone ignores speech input for this time after a clip, because the microphone hears the prompt.
  speechMuteAfterClipMs: 500,
} as const;
