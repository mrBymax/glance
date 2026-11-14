import type { HapticPattern, NativeState, ServerEvent } from '@glance/shared';
import type { UiAction, UiState } from './uiState';

/**
 * True for the add that brings the total over the budget of the profile. The server sends `budget.exceeded` right
 * after the `cart.updated` of that add, and one add must give one pattern.
 */
function crossesBudget(before: UiState, totalCents: number): boolean {
  const budgetCents = before.profile.budgetCents;
  return budgetCents !== null && before.cart.totalCents <= budgetCents && totalCents > budgetCents;
}

function eventPattern(before: UiState, event: ServerEvent): HapticPattern | null {
  switch (event.type) {
    case 'glance.pending':
      return event.warnings.length > 0 ? 'warning' : 'prompt';
    case 'checkout.offered':
      return 'prompt';
    case 'cart.updated':
      if (event.change === null) return null;
      if (event.change.kind === 'remove') return 'removed';
      return crossesBudget(before, event.cart.totalCents) ? null : 'added';
    case 'budget.exceeded':
      return 'warning';
    case 'checkout.paid':
      return 'paid';
    case 'checkout.failed':
    case 'error':
      return 'error';
    default:
      return null;
  }
}

// The app sends a native state for each change of a field, for example the battery level.
// So only a change of the stream gives a pattern, and the first state of the page gives none.
function streamPattern(before: NativeState | null, after: NativeState): HapticPattern | null {
  if (!before || before.stream === after.stream) return null;
  if (after.stream === 'paused') return 'cameraPaused';
  if (after.stream === 'stopped' && (before.stream === 'streaming' || before.stream === 'paused')) return 'cameraOff';
  return null;
}

/** Returns the pattern that the phone plays for a message, or null. The app vibrates only for a `haptic` message. */
export function hapticFor(before: UiState, action: UiAction, after: UiState): HapticPattern | null {
  if (!after.profile.haptics) return null;
  if (action.t === 'event') return eventPattern(before, action.event);
  if (action.t === 'native.state') return streamPattern(before.native, action.state);
  return null;
}
