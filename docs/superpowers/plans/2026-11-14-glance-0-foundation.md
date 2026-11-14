# Meta Glance Plan 0: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the npm workspace and the `@glance/shared` package, which holds the message contract that the server, the Android app, and the web apps all use.

**Architecture:** One npm workspace at the repository root. `packages/shared` exports zod schemas and their TypeScript types as source files, with no build step. JSON fixtures in the same package give the Kotlin app the same contract.

**Tech Stack:** Node 22 or later, npm workspaces, TypeScript 6, zod 4, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-11-13-meta-glance-design.md` (sections 6.2, 6.5, 8)

**Other plans:** Plans 1 to 4 in this directory build on this package. Do this plan first. The Android probe (Plan 2, tasks for step C1) does not need it and can start at the same time.

## Global Constraints

- Node 22 or later. npm workspaces. Do not add pnpm or yarn.
- Library versions on 2026-11-14: `typescript` `^6.0.3`, `zod` `^4.6.7`, `vitest` `^5.1.0`.
- Money is an integer number of cents in EUR. Only the server computes a total.
- Languages are `en` and `it`. English text is required. Italian text is optional.
- The kiosk code text is `GL1`, one space, and the kiosk code. The kiosk code has 4 to 8 characters from `A-Z` and `0-9`. The text has at most 20 characters.
- A frame message is: 4 bytes with the header length, a JSON header (`seq`, `ts`, `w`, `h`, `blurred`), then the JPEG bytes.
- Timing defaults come from spec section 6.2 and live in one constant, `TIMING`. No other file repeats a timing number.
- Each type has one name. The Kotlin app and the web apps use the names of this package.
- Text in code, comments, and commit messages follows `skills/anti-slop/SKILL.md`.
- Work on a branch, never on `main`. Commit messages have no Claude attribution lines.

## Review Focus

1. A frame message whose header length is larger than the message: `decodeFrame` throws `FrameFormatError` and reads no byte outside the message (Task 4).
2. A kiosk code text with lowercase letters or extra spaces, which a QR decoder can return: `parseKioskCode` still returns the code (Task 2).
3. A message with an unknown `type` or `t`, from a newer server or app: the parse helpers return `null` and do not throw (Task 4).
4. A profile patch with an unknown key or a speech rate out of range: the unknown key is dropped, and the bad value is rejected (Task 3).
5. A price that is negative or not an integer: `formatEur` throws `RangeError`, and the schemas reject it (Tasks 2 and 3).

---

### Task 1: Workspace and package skeleton

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `.nvmrc`
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`
- Create: `packages/shared/src/languages.ts`, `packages/shared/src/index.ts`
- Test: `packages/shared/src/languages.test.ts`
- Delete: `packages/shared/.gitkeep`

**Interfaces:**
- Consumes: nothing.
- Produces: `LANGS`, `Lang`, `Localized`, `LocalizedSchema`, `localize(text: Localized, lang: Lang): string`.

- [ ] **Step 1: Create the workspace files**

`package.json`:

```json
{
  "name": "glance",
  "private": true,
  "workspaces": ["packages/*", "apps/*", "apps/mobile/*"],
  "engines": { "node": ">=22" },
  "scripts": {
    "test": "npm run test --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present"
  }
}
```

`.nvmrc`: `22`

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noEmit": true
  }
}
```

`packages/shared/package.json`:

```json
{
  "name": "@glance/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts", "./fixtures/*": "./fixtures/*" },
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" },
  "dependencies": { "zod": "^4.6.7" },
  "devDependencies": { "typescript": "^6.0.3", "vitest": "^5.1.0" }
}
```

`packages/shared/tsconfig.json` extends `../../tsconfig.base.json` and includes `src` and `fixtures`.

- [ ] **Step 2: Write the failing test**

`packages/shared/src/languages.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the test and make sure it fails**

Run: `npm install` then `npm test --workspace @glance/shared`
Expected: FAIL, because `./languages` does not exist.

- [ ] **Step 4: Implement `languages.ts` and export it from `index.ts`**

```ts
export const LANGS = ['en', 'it'] as const;
export type Lang = (typeof LANGS)[number];
export type Localized = { en: string; it?: string };
// LocalizedSchema: en is a non-empty string, it is an optional non-empty string.
export function localize(text: Localized, lang: Lang): string;
```

`index.ts` re-exports each module of this package with `export * from`.

- [ ] **Step 5: Run the test and the typecheck**

Run: `npm test --workspace @glance/shared` and `npm run typecheck --workspace @glance/shared`
Expected: 4 tests pass, and the typecheck prints no error.

- [ ] **Step 6: Commit**

```bash
git rm packages/shared/.gitkeep
git add package.json package-lock.json tsconfig.base.json .nvmrc packages/shared
git commit -m "chore: add npm workspace and the shared package"
```

---

### Task 2: Money, timing, and kiosk code

**Files:**
- Create: `packages/shared/src/money.ts`, `packages/shared/src/timing.ts`, `packages/shared/src/kioskCode.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/money.test.ts`, `packages/shared/src/timing.test.ts`, `packages/shared/src/kioskCode.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `formatEur(cents: number): string`
  - `cartTotalCents(items: readonly { unitPriceCents: number; qty: number }[]): number`
  - `TIMING` (constant object, see Step 3)
  - `KIOSK_CODE_PREFIX`, `formatKioskCode(code: string): string`, `parseKioskCode(text: string): string | null`

- [ ] **Step 1: Write the failing tests**

`money.test.ts`:

```ts
it('formats cents as euros with two decimals', () => {
  expect(formatEur(189)).toBe('1.89');
  expect(formatEur(260)).toBe('2.60');
  expect(formatEur(5)).toBe('0.05');
  expect(formatEur(0)).toBe('0.00');
  expect(formatEur(123456)).toBe('1234.56');
});
it('rejects a price that is negative or not an integer', () => {
  expect(() => formatEur(-1)).toThrow(RangeError);
  expect(() => formatEur(1.5)).toThrow(RangeError);
});
it('adds the lines of a cart', () => {
  expect(cartTotalCents([])).toBe(0);
  expect(cartTotalCents([{ unitPriceCents: 260, qty: 1 }, { unitPriceCents: 189, qty: 1 }])).toBe(449);
  expect(cartTotalCents([{ unitPriceCents: 190, qty: 2 }])).toBe(380);
});
```

`timing.test.ts`:

```ts
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
```

`kioskCode.test.ts`:

```ts
it('formats a kiosk code as QR text', () => {
  expect(formatKioskCode('K3X7')).toBe('GL1 K3X7');
  expect(formatKioskCode('ABCD1234').length).toBeLessThanOrEqual(20);
});
it('rejects a code that is too short, too long, or has other characters', () => {
  expect(() => formatKioskCode('K3')).toThrow(RangeError);
  expect(() => formatKioskCode('TOOLONGCODE')).toThrow(RangeError);
  expect(() => formatKioskCode('k3x7')).toThrow(RangeError);
});
it('parses QR text back to the code', () => {
  expect(parseKioskCode('GL1 K3X7')).toBe('K3X7');
});
it('accepts lowercase letters and extra spaces from a decoder', () => {
  expect(parseKioskCode('  gl1   k3x7 \n')).toBe('K3X7');
});
it('returns null for text that is not a kiosk code', () => {
  expect(parseKioskCode('https://example.com/k/1')).toBeNull();
  expect(parseKioskCode('GL2 K3X7')).toBeNull();
  expect(parseKioskCode('GL1 TOOLONGCODE')).toBeNull();
  expect(parseKioskCode('')).toBeNull();
});
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/shared`
Expected: FAIL, because the three modules do not exist.

- [ ] **Step 3: Implement the three modules**

`timing.ts` exports `TIMING` with exactly the keys and values of the test, declared `as const`. Each key has a one-line comment that names the rule of spec section 6.2 it serves.

`money.ts`: `formatEur` throws `RangeError` unless the input is an integer of 0 or more.

`kioskCode.ts`: `KIOSK_CODE_PREFIX` is `'GL1'`. A code matches `/^[A-Z0-9]{4,8}$/`. `parseKioskCode` trims, turns each run of spaces into one space, and converts to upper case before it matches.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npm test --workspace @glance/shared`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): add money, timing, and kiosk code helpers"
```

---

### Task 3: Profile, catalog, and cart

**Files:**
- Create: `packages/shared/src/allergens.ts`, `packages/shared/src/profile.ts`, `packages/shared/src/catalog.ts`, `packages/shared/src/cart.ts`
- Create: `packages/shared/fixtures/catalog/oat-drink-1l.json`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/profile.test.ts`, `packages/shared/src/catalog.test.ts`, `packages/shared/src/cart.test.ts`

**Interfaces:**
- Consumes: `Lang`, `Localized`, `LocalizedSchema`, `localize` (Task 1).
- Produces: each type below, with a zod schema named `<Type>Schema`.

```ts
// allergens.ts
export const EU_ALLERGENS = ['gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soy', 'milk',
  'nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs'] as const;
export type Allergen = (typeof EU_ALLERGENS)[number];

// profile.ts
export type Profile = {
  lang: Lang;                                  // default 'en'
  detail: 'brief' | 'standard' | 'detailed';   // default 'standard'
  speechRate: number;                          // 0.8 to 2.0, default 1
  speakPrices: boolean;                        // default true
  headGestures: boolean;                       // default true
  yesGesture: 'nod' | 'shake';                 // default 'nod'
  headWindowMs: 8000 | 15000 | null;           // null means "while in view"; default 8000
  haptics: boolean;                            // default true
  mainYes: 'head' | 'touch' | 'voice' | 'phone' | 'key';  // default 'head'
  allergens: Allergen[];                       // default []
  vegan: boolean;                              // default false
  vegetarian: boolean;                         // default false
  budgetCents: number | null;                  // positive integer or null; default null
};
export type ProfilePatch = Partial<Profile>;   // ProfilePatchSchema drops unknown keys
export const DEFAULT_PROFILE: Profile;

// catalog.ts
export type Product = {
  id: string;                    // lower case with hyphens, for example "oat-drink-1l"
  gtin?: string;
  name: Localized;               // "Oat drink"
  spokenName: Localized;         // "Oat drink"
  brand: string;                 // "Oatly"
  packSize: string;              // shown on screen: "1 L"
  spokenPack: Localized;         // "one litre"
  spokenPackDetailed: Localized; // "one litre carton"
  priceCents: number;            // integer, 0 or more
  allergens: Allergen[] | null;  // null means "no data"
  vegan: boolean | null;
  vegetarian: boolean | null;
  visual: string;                // the look of the package, for the recognition prompt
  lookAlikes: string[];          // product IDs; default []
};
export type ProductRef = { id: string; name: string; packSize: string; priceCents: number };
export function toProductRef(product: Product, lang: Lang): ProductRef;

// cart.ts
export type CartItem = { productId: string; name: string; packSize: string; qty: number; unitPriceCents: number };
export type Cart = { items: CartItem[]; totalCents: number };
export const EMPTY_CART: Cart;
```

- [ ] **Step 1: Write the fixture and the failing tests**

`fixtures/catalog/oat-drink-1l.json`:

```json
{
  "id": "oat-drink-1l",
  "name": { "en": "Oat drink", "it": "Bevanda di avena" },
  "spokenName": { "en": "Oat drink", "it": "Bevanda di avena" },
  "brand": "Oatly",
  "packSize": "1 L",
  "spokenPack": { "en": "one litre", "it": "un litro" },
  "spokenPackDetailed": { "en": "one litre carton", "it": "cartone da un litro" },
  "priceCents": 189,
  "allergens": ["gluten"],
  "vegan": true,
  "vegetarian": true,
  "visual": "Tall carton, light blue and white, the word OATLY in large black letters.",
  "lookAlikes": ["oat-drink-barista-1l"]
}
```

`profile.test.ts`:

```ts
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
it('accepts "while in view" and a budget', () => {
  expect(ProfilePatchSchema.safeParse({ headWindowMs: null }).success).toBe(true);
  expect(ProfilePatchSchema.safeParse({ budgetCents: 2000 }).success).toBe(true);
});
```

`catalog.test.ts`:

```ts
import oatDrink from '../fixtures/catalog/oat-drink-1l.json';

it('accepts the fixture product', () => {
  expect(ProductSchema.parse(oatDrink).priceCents).toBe(189);
});
it('defaults lookAlikes to an empty list', () => {
  const { lookAlikes, ...rest } = oatDrink;
  expect(ProductSchema.parse(rest).lookAlikes).toEqual([]);
});
it('accepts a product with no allergen data', () => {
  expect(ProductSchema.safeParse({ ...oatDrink, allergens: null }).success).toBe(true);
});
it('rejects a price that is not an integer or is negative', () => {
  expect(ProductSchema.safeParse({ ...oatDrink, priceCents: 1.5 }).success).toBe(false);
  expect(ProductSchema.safeParse({ ...oatDrink, priceCents: -1 }).success).toBe(false);
});
it('makes a product reference in the language of the session', () => {
  expect(toProductRef(ProductSchema.parse(oatDrink), 'it')).toEqual({
    id: 'oat-drink-1l', name: 'Bevanda di avena', packSize: '1 L', priceCents: 189,
  });
});
```

`cart.test.ts`:

```ts
it('has an empty cart constant', () => {
  expect(EMPTY_CART).toEqual({ items: [], totalCents: 0 });
});
it('rejects a quantity of zero', () => {
  const item = { productId: 'oat-drink-1l', name: 'Oat drink', packSize: '1 L', qty: 0, unitPriceCents: 189 };
  expect(CartItemSchema.safeParse(item).success).toBe(false);
});
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/shared`
Expected: FAIL, because the modules do not exist.

- [ ] **Step 3: Implement the four modules**

Each schema matches its type in the Interfaces block. `ProfilePatchSchema` is the partial form of `ProfileSchema` with no defaults.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npm test --workspace @glance/shared`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): add profile, catalog, and cart schemas"
```

---

### Task 4: Events, device messages, and the frame codec

**Files:**
- Create: `packages/shared/src/events.ts`, `packages/shared/src/snapshot.ts`, `packages/shared/src/device.ts`, `packages/shared/src/frame.ts`
- Create: one JSON file for each message variant in `packages/shared/fixtures/events/`, `packages/shared/fixtures/device-to-server/`, `packages/shared/fixtures/server-to-device/`. The file name is the `type` or `t` value, for example `glance.pending.json`.
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/events.test.ts`, `packages/shared/src/device.test.ts`, `packages/shared/src/frame.test.ts`

**Interfaces:**
- Consumes: `Lang`, `Allergen`, `Profile`, `ProfilePatch`, `ProductRef`, `Cart`, `CartItem` (Tasks 1 and 3).
- Produces: each type below with a schema named `<Type>Schema`, and the functions listed.

```ts
// events.ts
export type Phase = 'shopping' | 'checkout' | 'paid' | 'resting' | 'ended';
export type AimHint = 'none' | 'left' | 'right' | 'up' | 'down' | 'closer' | 'farther' | 'turn';
export type SoundName = 'found' | 'added' | 'removed' | 'warning' | 'paid';
export type Priority = 'high' | 'normal' | 'low';
export type KioskRef = { id: string; name: string; store: string };
export type Warning =
  | { kind: 'allergen'; allergens: Allergen[] }
  | { kind: 'diet'; diet: 'vegan' | 'vegetarian' }
  | { kind: 'allergenDataMissing' };
export type Caption = { id: string; text: string; lang: Lang; priority: Priority; url: string | null };
export type Receipt = { orderId: string; totalCents: number; paidAt: string; items: CartItem[]; kiosk: KioskRef };

export type ServerEvent =
  | { type: 'session.state'; phase: Phase; cameraOn: boolean }
  | { type: 'glance.pending'; promptId: string; kind: 'new' | 'inCart'; product: ProductRef; warnings: Warning[]; qtyInCart: number }
  | { type: 'glance.cleared'; promptId: string }
  | { type: 'glance.hint'; aimHint: AimHint }
  | { type: 'glance.unknown' }
  | { type: 'glance.ambiguous'; candidates: ProductRef[] }
  | { type: 'cart.updated'; cart: Cart; change: { kind: 'add' | 'remove'; productId: string; name: string } | null }
  | { type: 'budget.exceeded'; budgetCents: number; totalCents: number }
  | { type: 'checkout.offered'; promptId: string; kiosk: KioskRef; totalCents: number; itemCount: number; needsBiometric: boolean }
  | { type: 'checkout.suspended' }
  | { type: 'checkout.spotcheck'; product: ProductRef }
  | { type: 'checkout.cancelled' }
  | ({ type: 'checkout.paid' } & Receipt)
  | { type: 'checkout.failed'; reason: string }
  | ({ type: 'caption' } & Caption)
  | { type: 'error'; code: string; message: string };
export function parseServerEvent(input: unknown): ServerEvent | null;

// snapshot.ts
export type CurrentPrompt =
  | { promptId: string; kind: 'product'; mode: 'new' | 'inCart'; product: ProductRef; warnings: Warning[]; qtyInCart: number }
  | { promptId: string; kind: 'pay'; kiosk: KioskRef; totalCents: number; itemCount: number; needsBiometric: boolean };
export type SessionSnapshot = {
  sessionId: string; phase: Phase; cameraOn: boolean; prompt: CurrentPrompt | null;
  cart: Cart; profile: Profile; kiosk: KioskRef | null; lastReceipt: Receipt | null;
  captions: Caption[];   // the last 20, oldest first
};

// device.ts
export type IntentKind = 'yes' | 'no' | 'undo' | 'repeat' | 'total' | 'cart' | 'help' | 'stop' | 'ask';
export type IntentSource = 'head' | 'voice' | 'touch' | 'phone' | 'key' | 'camera' | 'hud';
export type DeviceState = {
  link: 'connected' | 'disconnected';
  battery: number | null;      // 0 to 100
  worn: boolean | null;
  hingeOpen: boolean | null;
  thermal: number | null;      // 0 to 7
  stream: 'stopped' | 'starting' | 'streaming' | 'paused';
};
export type DeviceToServer =
  | { t: 'intent'; kind: IntentKind; source: IntentSource; promptId?: string }
  | { t: 'prompt.done'; promptId: string }
  | { t: 'kiosk.seen'; text: string }
  | { t: 'speech.final'; text: string; confidence: number; locale: string }
  | { t: 'device.state'; state: DeviceState }
  | { t: 'cart.edit'; productId: string; qty: number }   // qty 0 removes the line
  | { t: 'profile.set'; patch: ProfilePatch }
  | { t: 'biometric.result'; ok: boolean };
export type ServerToDevice =
  | { t: 'speak'; id: string; priority: Priority; text: string; lang: Lang; url: string | null;
      sound: SoundName | null; interrupt: boolean; promptId: string | null }
  | { t: 'event'; event: ServerEvent }
  | { t: 'snapshot'; session: SessionSnapshot }
  | { t: 'session.rest' }
  | { t: 'session.end' }
  | { t: 'biometric.request' };
export function parseDeviceToServer(input: unknown): DeviceToServer | null;
export function parseServerToDevice(input: unknown): ServerToDevice | null;

// frame.ts
export type FrameHeader = { seq: number; ts: number; w: number; h: number; blurred: boolean; kind?: 'frame' | 'still' };
export class FrameFormatError extends Error {}
export const MAX_FRAME_HEADER_BYTES = 1024;
export function encodeFrame(header: FrameHeader, jpeg: Uint8Array): Uint8Array;
export function decodeFrame(message: Uint8Array): { header: FrameHeader; jpeg: Uint8Array };
```

Notes on meaning:

- `speak.url` is `null` when no clip exists. The phone then reads the text with its own voice, and sends `prompt.done` when that voice ends. A web page shows the caption only.
- The intent `ask` opens the question window of extra 5. The page sends it for the microphone button. It needs no prompt ID.
- A frame with `blurred: false` did not go through face detection. The server uses it, unless `REQUIRE_BLUR` is set (Plan 1 Task 14).
- `speech.final.confidence` is 0 to 1. The phone sends 0.5 when the glasses give no value.
- A `speak` with a `promptId` is a prompt. The phone sends `prompt.done` with that ID when the clip ends.
- `glance.ambiguous` is for extra 3 of the spec. Section 8.3 of the spec does not list it.
- Frame layout: bytes 0 to 3 hold the header length N as an unsigned 32-bit big-endian integer. Bytes 4 to 4+N hold the header as UTF-8 JSON. The rest is the JPEG, which starts with `0xFF 0xD8`.

- [ ] **Step 1: Write the fixtures**

Write one valid example for each variant. Use the oat drink (`oat-drink-1l`, 189 cents, `1 L`), a cart with rye bread (260) and the oat drink (total 449), kiosk `{ "id": "kiosk-1", "name": "Checkout 3", "store": "Demo Market" }`, and prompt ID `p-0001`.

- [ ] **Step 2: Write the failing tests**

`events.test.ts`:

```ts
const dir = new URL('../fixtures/events/', import.meta.url);

it('parses each event fixture, and the file name is the type', () => {
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  expect(files.length).toBe(16);
  for (const file of files) {
    const event = parseServerEvent(JSON.parse(readFileSync(new URL(file, dir), 'utf8')));
    expect(event?.type).toBe(file.replace(/\.json$/, ''));
  }
});
it('returns null for an unknown type and for input that is not an object', () => {
  expect(parseServerEvent({ type: 'glance.exploded' })).toBeNull();
  expect(parseServerEvent('x')).toBeNull();
  expect(parseServerEvent(null)).toBeNull();
});
it('requires a prompt ID on a pending glance', () => {
  const { promptId, ...rest } = JSON.parse(readFileSync(new URL('glance.pending.json', dir), 'utf8'));
  expect(parseServerEvent(rest)).toBeNull();
});
```

`device.test.ts`:

```ts
it('parses each fixture in device-to-server (8 files) and server-to-device (6 files)', () => { /* same loop as events.test.ts, on `t` */ });
it('accepts a yes without a prompt ID', () => {
  expect(parseDeviceToServer({ t: 'intent', kind: 'yes', source: 'phone' })).not.toBeNull();
});
it('rejects an unknown intent kind and an unknown message', () => {
  expect(parseDeviceToServer({ t: 'intent', kind: 'maybe', source: 'head' })).toBeNull();
  expect(parseDeviceToServer({ t: 'launch.rocket' })).toBeNull();
});
it('accepts a line with no clip', () => {
  const speak = { t: 'speak', id: 's-1', priority: 'normal', text: 'Skipped.', lang: 'en', url: null,
    sound: null, interrupt: false, promptId: null };
  expect(parseServerToDevice(speak)).toEqual(speak);
});
```

`frame.test.ts`:

```ts
const jpeg = new Uint8Array([0xff, 0xd8, 0x01, 0x02, 0xff, 0xd9]);
const header = { seq: 7, ts: 1794600000000, w: 576, h: 768, blurred: true };

it('round-trips a frame', () => {
  expect(decodeFrame(encodeFrame(header, jpeg))).toEqual({ header, jpeg });
});
it('writes the header length as 4 big-endian bytes', () => {
  const message = encodeFrame(header, jpeg);
  const n = new DataView(message.buffer, message.byteOffset).getUint32(0, false);
  expect(JSON.parse(new TextDecoder().decode(message.subarray(4, 4 + n)))).toEqual(header);
});
it('rejects a message shorter than 4 bytes', () => {
  expect(() => decodeFrame(new Uint8Array([0, 0]))).toThrow(FrameFormatError);
});
it('rejects a header length larger than the message or larger than the limit', () => {
  const tooLong = new Uint8Array([0, 0, 0, 200, 0x7b, 0x7d]);
  expect(() => decodeFrame(tooLong)).toThrow(FrameFormatError);
  const overLimit = new Uint8Array(4 + 2000);
  new DataView(overLimit.buffer).setUint32(0, 2000, false);
  expect(() => decodeFrame(overLimit)).toThrow(FrameFormatError);
});
it('rejects a header that is not valid JSON and a body that is not a JPEG', () => {
  const badJson = new Uint8Array([0, 0, 0, 2, 0x7b, 0x7b, 0xff, 0xd8]);
  expect(() => decodeFrame(badJson)).toThrow(FrameFormatError);
  const notJpeg = encodeFrame(header, new Uint8Array([0x89, 0x50]));
  expect(() => decodeFrame(notJpeg)).toThrow(FrameFormatError);
});
```

- [ ] **Step 3: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/shared`
Expected: FAIL, because the modules do not exist.

- [ ] **Step 4: Implement the four modules**

`ServerEventSchema` is a discriminated union on `type`. `DeviceToServerSchema` and `ServerToDeviceSchema` are discriminated unions on `t`. Each parse helper uses `safeParse` and returns `null` on failure.

`encodeFrame` does not check the JPEG bytes. `decodeFrame` checks each length before it reads, validates the header against `FrameHeaderSchema`, and checks the two JPEG start bytes. It returns the JPEG as a view on the message, with no copy.

- [ ] **Step 5: Run the tests and make sure they pass**

Run: `npm test --workspace @glance/shared`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): add events, device messages, and the frame codec"
```

---

### Task 5: Bridge, REST shapes, and the fixture check

**Files:**
- Create: `packages/shared/src/bridge.ts`, `packages/shared/src/rest.ts`
- Create: fixtures in `packages/shared/fixtures/bridge-page-to-native/`, `packages/shared/fixtures/bridge-native-to-page/`, `packages/shared/fixtures/rest/`
- Create: `packages/shared/README.md`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/fixtures.test.ts`, `packages/shared/src/index.test.ts`

**Interfaces:**
- Consumes: the types of Tasks 1 to 4.
- Produces: each type below with a schema named `<Type>Schema`.

```ts
// bridge.ts
export type HapticPattern = 'prompt' | 'added' | 'removed' | 'warning' | 'paid' | 'error' | 'cameraPaused' | 'cameraOff';
export type NativeState = {
  metaAiInstalled: boolean;
  registration: 'unavailable' | 'available' | 'registering' | 'registered';
  cameraPermission: 'unknown' | 'granted' | 'denied';
  device: { name: string | null; link: 'connected' | 'disconnected'; battery: number | null;
            worn: boolean | null; hingeOpen: boolean | null; thermal: number | null; updateRequired: boolean } | null;
  session: 'idle' | 'starting' | 'started' | 'paused' | 'stopped';
  stream: 'stopped' | 'starting' | 'streaming' | 'paused';
  network: 'online' | 'offline';
  capabilities: { motion: boolean; inputs: boolean; speech: boolean };
  mock: boolean;
};
export type PageToNative =
  | { t: 'ui.ready' }
  | { t: 'setup.register' } | { t: 'setup.requestCamera' } | { t: 'setup.openUpdate' }
  | { t: 'session.start' } | { t: 'session.end' }
  | { t: 'intent'; kind: IntentKind; promptId?: string }
  | { t: 'cart.edit'; productId: string; qty: number }
  | { t: 'profile.set'; patch: ProfilePatch }
  | { t: 'pocket.set'; on: boolean }
  | { t: 'haptic'; pattern: HapticPattern }
  | { t: 'data.delete' };
export type NativeToPage =
  | { t: 'native.state'; state: NativeState }
  | { t: 'profile'; profile: Profile }
  | { t: 'event'; event: ServerEvent }
  | { t: 'snapshot'; session: SessionSnapshot };
export interface GlanceBridge {
  send(message: PageToNative): void;
  subscribe(listener: (message: NativeToPage) => void): () => void;
}
export function parsePageToNative(input: unknown): PageToNative | null;
export function parseNativeToPage(input: unknown): NativeToPage | null;

// rest.ts
export type CreateSessionRequest = { profile?: ProfilePatch };
export type CreateSessionResponse = { sessionId: string; token: string; wsUrl: string };
export type WebIntentRequest = { kind: IntentKind; source: 'phone' | 'hud'; promptId?: string };
export type CartEditRequest = { productId: string; qty: number };
export type CreateKioskRequest = { name: string; store: string; spotCheck?: boolean; failPayment?: boolean };
export type CreateKioskResponse = { kioskId: string; token: string; code: string };
export type LatestSessionResponse = { sessionId: string; token: string };   // GET /api/demo/latest
export type KioskEvent = {
  type: 'kiosk.state';
  state: 'idle' | 'connected' | 'spotcheck' | 'paid' | 'failed';
  kiosk: KioskRef; code: string; cart: Cart | null; totalCents: number | null; receipt: Receipt | null;
};
```

Wire format of the bridge in the WebView:

- Page to Kotlin: `window.GlanceNative.postMessage(json)`, where `json` is a `PageToNative` as a JSON string.
- Kotlin to page: `window.__glanceReceive(json)`, where `json` is a `NativeToPage` as a JSON string.
- The page sends `ui.ready` after it sets `window.__glanceReceive`. Kotlin answers with `native.state` and `profile`.

Meaning of two `NativeState` fields:

- `network` is `online` while the device socket to the server is open.
- `thermal` is 0 to 7, in the order of the DAT thermal levels. Level 6 and above means that the glasses cannot stream.

The phone reports its own failures to the page as `error` events with a code that starts with `native.`.

REST calls, from spec section 8.1, with three additions: the cart edit, the snapshot, and `demo/latest`.

| Call | Body | Answer |
|---|---|---|
| `POST /api/sessions` | `CreateSessionRequest` | 201, `CreateSessionResponse` |
| `GET /api/sessions/:id` | | 200, `SessionSnapshot` |
| `PATCH /api/sessions/:id/profile` | `ProfilePatch` | 200, the new `Profile` |
| `POST /api/sessions/:id/intents` | `WebIntentRequest` | 204 |
| `POST /api/sessions/:id/cart` | `CartEditRequest` | 204 |
| `GET /api/sessions/:id/events` | | an event stream of `ServerEvent` |
| `DELETE /api/sessions/:id` | | 204 |
| `POST /api/kiosks` | `CreateKioskRequest` | 201, `CreateKioskResponse` |
| `GET /api/kiosks/:id/events` | | an event stream of `KioskEvent` |
| `GET /api/demo/latest?key=<DEMO_KEY>` | | 200, `LatestSessionResponse` |

- Each call with `:id` needs `?token=`. A wrong or missing token gets 401, and an unknown ID gets 404.
- A body that fails its schema gets 400 with `{ "error": "bad_request" }`.
- An event stream sends `data: <json>` and an empty line for each message, with no event name.
- The outcome of an intent or a cart edit arrives as events. The answer 204 says only that the server took the input.
- `demo/latest` gives the newest live session. The mirror page and the HUD use it to follow the session of the phone with no typed ID. It answers 404 when `DEMO_KEY` is not set, when the key is wrong, or when no session is live.

- [ ] **Step 1: Write the fixtures**

One valid example for each `PageToNative` variant (12 files), each `NativeToPage` variant (4 files), and each REST type (8 files, named after the type, for example `CreateSessionResponse.json`).

- [ ] **Step 2: Write the failing tests**

`fixtures.test.ts`:

```ts
const SCHEMA_BY_FOLDER = {
  catalog: ProductSchema,
  events: ServerEventSchema,
  'device-to-server': DeviceToServerSchema,
  'server-to-device': ServerToDeviceSchema,
  'bridge-page-to-native': PageToNativeSchema,
  'bridge-native-to-page': NativeToPageSchema,
} as const;

it('has a schema for each fixture folder except rest', () => {
  const folders = readdirSync(root).filter((f) => f !== 'rest');
  expect(folders.sort()).toEqual(Object.keys(SCHEMA_BY_FOLDER).sort());
});
it('validates each fixture against the schema of its folder', () => { /* loop, expect success for each file */ });
it('validates each rest fixture against the schema with the name of the file', () => { /* 8 files */ });
```

`index.test.ts`:

```ts
import * as shared from './index';

it('exports the names that the other plans use', () => {
  for (const name of ['TIMING', 'LANGS', 'EU_ALLERGENS', 'DEFAULT_PROFILE', 'EMPTY_CART', 'formatEur',
    'cartTotalCents', 'formatKioskCode', 'parseKioskCode', 'localize', 'toProductRef', 'encodeFrame',
    'decodeFrame', 'FrameFormatError', 'parseServerEvent', 'parseDeviceToServer', 'parseServerToDevice',
    'parsePageToNative', 'parseNativeToPage', 'ProfileSchema', 'ProfilePatchSchema', 'ProductSchema',
    'CartSchema', 'ServerEventSchema', 'SessionSnapshotSchema', 'KioskEventSchema']) {
    expect(shared).toHaveProperty(name);
  }
});
```

- [ ] **Step 3: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/shared`
Expected: FAIL, because `bridge.ts` and `rest.ts` do not exist.

- [ ] **Step 4: Implement the two modules and write the README**

`packages/shared/README.md` has four short parts: what the package is, how a TypeScript app imports it (`"@glance/shared": "*"` in `dependencies`), the rule that the Kotlin classes use the same field names, and the rule that each new message variant gets a fixture.

- [ ] **Step 5: Run all checks**

Run: `npm test --workspace @glance/shared` and `npm run typecheck --workspace @glance/shared`
Expected: all tests pass, and the typecheck prints no error.

- [ ] **Step 6: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): add bridge and REST shapes with a fixture check"
```
