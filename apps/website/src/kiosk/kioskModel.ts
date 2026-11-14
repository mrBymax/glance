import {
  KioskEventSchema, type Cart, type CartItem, type CreateKioskRequest, type CreateKioskResponse, type KioskEvent,
} from '@glance/shared';

/** The cart lines that fit on a screen of 1080 px height next to the total. */
export const KIOSK_MAX_ROWS = 7;

const DEFAULT_NAME = 'Checkout 3';
const DEFAULT_STORE = 'Demo Market';
const MAX_NAME_LENGTH = 40;

function nameOf(value: string | null, fallback: string): string {
  const text = (value ?? '').trim();
  return (text === '' ? fallback : text).slice(0, MAX_NAME_LENGTH).trimEnd();
}

function isOn(value: string | null): boolean {
  return value !== null && value !== '0' && value !== 'false';
}

/** Reads the query flags `name`, `store`, `spot`, and `fail` of the kiosk address. */
export function kioskFlags(search: string): Required<CreateKioskRequest> {
  const flags = new URLSearchParams(search);
  return {
    name: nameOf(flags.get('name'), DEFAULT_NAME),
    store: nameOf(flags.get('store'), DEFAULT_STORE),
    spotCheck: isOn(flags.get('spot')),
    failPayment: isOn(flags.get('fail')),
  };
}

/** Returns the event, or null for input that is no kiosk event of this version. The schema also checks the code. */
export function parseKioskEvent(input: unknown): KioskEvent | null {
  const result = KioskEventSchema.safeParse(input);
  return result.success ? result.data : null;
}

/** The view of a new kiosk, before the first message of its stream. */
export function idleEvent(request: CreateKioskRequest, response: CreateKioskResponse): KioskEvent {
  return {
    type: 'kiosk.state',
    state: 'idle',
    kiosk: { id: response.kioskId, name: request.name, store: request.store },
    code: response.code,
    cart: null,
    totalCents: null,
    receipt: null,
  };
}

/** Returns the first lines of a cart, and the number of lines that do not fit. */
export function kioskRows(cart: Pick<Cart, 'items'> | null): { rows: CartItem[]; hiddenCount: number } {
  const items = cart?.items ?? [];
  return { rows: items.slice(0, KIOSK_MAX_ROWS), hiddenCount: Math.max(0, items.length - KIOSK_MAX_ROWS) };
}
