const CONTROLS = [
  'a[href]', 'button', 'input', 'select', 'textarea',
  ...['button', 'link', 'radio', 'checkbox', 'switch', 'slider', 'tab'].map((role) => `[role="${role}"]`),
].join(', ');

const NOT_ON_SCREEN = 'dialog:not([open]), [aria-hidden="true"], [popover]';

// jsdom has no layout, so this check knows the Astryx classes that styles/touch.css and the Astryx props raise to 48 px.
function isCovered(control: Element): boolean {
  if (control.classList.contains('astryx-button')) return true;
  if (control.classList.contains('astryx-segmented-control-item') && control.getAttribute('data-size') === 'lg') return true;
  if (control.matches('input[type="checkbox"]') && control.closest('li.astryx-list-item[data-density="spacious"]')) return true;
  return control.matches('input') && control.closest('.astryx-number-input') !== null;
}

function roleOf(control: Element): string {
  const role = control.getAttribute('role');
  if (role) return role;
  return control.matches('input[type="checkbox"]') ? 'checkbox' : control.tagName.toLowerCase();
}

function nameOf(control: Element): string {
  const ariaLabel = control.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;
  const label = 'labels' in control ? (control as HTMLInputElement).labels?.[0] : undefined;
  return (label?.textContent ?? control.textContent ?? '').trim();
}

/** Returns one text for each control that no 48 px rule covers, in the form `<role> "<name>"`. */
export function uncoveredTouchTargets(root: HTMLElement): string[] {
  return [...root.querySelectorAll(CONTROLS)]
    .filter((control) => !control.closest(NOT_ON_SCREEN) && !isCovered(control))
    .map((control) => `${roleOf(control)} "${nameOf(control)}"`);
}
