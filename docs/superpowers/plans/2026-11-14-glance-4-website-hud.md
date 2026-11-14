# Meta Glance Plan 4: Catalog, Website, Run Sheet, and Display HUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the content and the public pages of the proof of concept: the product catalog, the landing page, the privacy page, the run sheet for the demo and the shoot, and the Display HUD mockup.

**Architecture:** Content lives in data files that a person can fill late: `catalog.json`, `numbers.json`, and typed copy modules. The two website pages render those modules with Astryx components, and a copy guard test rejects a forbidden claim. The HUD is a separate web app on the Display toolkit: a pure reducer turns `ServerEvent` values into one screen, and a recorded file or a live session feeds it.

**Tech Stack:** Node 22 or later, npm workspaces, TypeScript 6, React 19, Vite 8, Vitest 5, Testing Library, Astryx (`@astryxdesign/core`), `@wearables-ui-toolkit/mrbd`, `@glance/shared`.

**Spec:** `docs/superpowers/specs/2026-11-13-meta-glance-design.md` (sections 1, 5, 6.1, 11.3, 12, 13, 15, 16, 18, 19)

**Seat:** 4. One person executes this plan with coding agents. The same person shops, shoots, and cuts the video.

**Other plans:** Plan 0 (`@glance/shared`), Plan 1 (server), Plan 2 (Android app), Plan 3 (phone UI, kiosk page, mirror page, and the scaffold of `apps/website`). The author read Plans 1, 2, and 3 while they were in work, and Plan 1 had its Tasks 1 to 22 then. Check each statement about them against the plan file before you start the task.

## Work order and dependencies

Time budgets are estimates of the author.

| Task | Step | Budget | Needs from another plan | How to work before it exists |
|---|---|---|---|---|
| 1 Catalog content | C3 | 60 min after the shopping trip | Plan 0 Task 3 (`ProductSchema`). Plan 1 Task 20: the script `catalog:check`. | Fill the file. Run the first command of Step 5 and its checks by eye. Run `catalog:check` when Plan 1 delivers it. Do not delay the shopping trip. |
| 2 Landing content | C3 | 40 min | Plan 3 Task 1: the scaffold of `apps/website`, in its own pull request. | Write the files. Run `npx vitest run apps/website/src/content` at the repository root with the Vitest of Plan 0. Do not merge before the scaffold is on `main`. |
| 3 Landing page | C3 | 50 min | Plan 3 Task 1: the placeholder `Landing.tsx` and `renderWithTheme`. | Do Task 5 first. |
| 4 Privacy page | C3 | 40 min | Plan 3 Task 1: the placeholder `Privacy.tsx`. Plan 3 Task 9: "Delete my data" in the Settings sheet. Plan 1 Task 10: `DELETE /api/sessions/:id`. | Write `privacy.ts` and its test as in Task 2. |
| 5 Run sheet | C3 | 30 min | Nothing. | |
| 6 HUD project, state, and feeds | Extra 4 | 60 min | Plan 0 Tasks 1 to 5. | Do not start before `@glance/shared` is on `main`. |
| 7 HUD screen and clip | Extra 4 | 75 min | Plan 1 Task 12: the fake server, for Step 8 only. | The recorded mode needs no server. |
| 8 Late content and publish check | C3 | 30 min, after the shoot | Plan 1 Task 21: the accuracy lines. Plan 1 Task 22: the domain and the deployment. Plan 2 Task 4: the probe values, `kiosk-distance`, `battery`. Plan 2 Task 8: `false-yes`, `false-no`. Plan 2 Task 20: `glance-demo.apk`. | Each value stays `null`. The page then says that the value is not there yet. |

Checked by the author on 2026-11-14:

- The npm registry has the versions in Global Constraints.
- The file `package.json` that the toolkit script `init-app.mjs` writes fails `npm install` (see Task 6). The dependency set of Task 6 installs with one copy of React.
- Astryx CLI 0.7.15 has the commands and the component names of Task 3.
- The author read the source pages behind the keys `sGroup`, `amazon`, `gs1`, `accessBoard`, `eaaScope`, `eaaOld`, and `metaUse` of Task 2.
- Plan 1 Tasks 2, 4, 10, 20, and 22 agree with this plan on the form of the catalog file, on the answers that the HUD buttons name, on the event stream, on the catalog check, and on the host name of the HUD.
- Plan 3 Tasks 1 and 9 agree with this plan on the website scaffold, on the test helper, and on the labels of the delete steps.
- Plan 2 Tasks 4, 8, and 20 agree with this plan on the four probe values, on the IDs of the numbers, and on the name of the APK file.

Closed after the cross-check: the mirror page follows the session of the real phone with `?latest=<DEMO_KEY>` (Plan 1 Task 17, Plan 3 Task 13). A live HUD link still needs the flags `s` and `t`, so the HUD uses its recorded mode for the clip.

Not checked: a typecheck, a validator run, or a build of HUD source. `Link` and `AspectRatio` of Astryx in jsdom. The simulator steps of Task 7 come from the Meta docs, and the author did not run the simulator.

## Global Constraints

- Node 22 or later. npm workspaces. Do not add pnpm or yarn.
- Library versions on 2026-11-14: `react` and `react-dom` `^19.3.1`, `vite` `^8.3.8`, `typescript` `^6.0.3`, `vitest` `^5.1.0`, `@testing-library/react` `^16.3.3`, `@astryxdesign/core` `^0.7.15`, `@wearables-ui-toolkit/mrbd` `^130.33.0`.
- Deadline: Sunday 2026-11-15 at 08:00 Finnish time. Feature freeze: Saturday 18:00. After the freeze, only fixes and content fills.
- Cut rule of spec section 5: if a glance does not speak on the real glasses by Saturday 14:00, cut Tasks 6 and 7. Tasks 6 and 7 must merge before the freeze. Start Task 6 only when Tasks 1 to 5 are merged or wait for another seat.
- This plan owns these files only: `apps/server/catalog/catalog.json`, `apps/website/src/pages/Landing.tsx`, `apps/website/src/pages/Privacy.tsx`, their test files, each file in `apps/website/src/content/`, `docs/demo/run-sheet.md`, and `apps/display-pow/`. Do not change another file of `apps/website`, `apps/server`, or `packages/shared`.
- Shared types come from `@glance/shared` (Plan 0). Do not define a shared type again.
- Money is an integer number of cents. Show it with `formatEur` and the text `EUR`. Only the server computes a total. One exception: the recorded mode of the HUD has no server (`mockAnswer`, Task 6).
- The website must not claim that the store installs nothing, that the store lends glasses, that the payment is real, or that a blind shopper tested Glance.
- A number on the website is a measured number or the text "Not measured yet". Do not publish an estimate.
- Astryx: use the scoped packages `@astryxdesign/core` and `@astryxdesign/cli`. The unscoped `astryx` package is unrelated. Use the stock Neutral theme. Do not use `xstyle` or `stylex.create`, because the website has no StyleX compiler. Do not use a component name from memory: look it up with the CLI first.
- Display toolkit: follow `skills/mrbd-ui-toolkit`. Use public package exports only. Do not open `node_modules`, toolkit source, or the source of a toolkit script. Keep the generated `vite.config.ts` unchanged. CSS uses toolkit tokens only.
- Text in copy, code, comments, and commit messages follows `skills/anti-slop/SKILL.md`: no emoji, no em dash, no unicode arrow, no marketing adjective, short sentences in active voice.
- Work on a branch, never on `main`. Each task names its branch. Create it from `main` with `git switch -c <branch>` before the first step. Commit messages use `type(scope): description` and have no Claude attribution lines.

## Review Focus

1. A measured value of 0, which is the target for a false yes: the page shows "0 in 15 minutes", not "Not measured yet" (Tasks 2 and 3).
2. A late edit that adds a forbidden claim, a banned character, or a number with no test conditions: a test fails before the publish (Tasks 2 and 4).
3. A `glance.cleared` for an older prompt that arrives after the snapshot or after a newer `glance.pending`: the HUD keeps the newer product (Task 6).
4. A server-sent message that is not JSON, or an event type from a newer server: the HUD ignores it and keeps its state (Task 6).
5. The APK or the video is not online at the publish: the page shows one plain line and no dead link (Task 3).

---

### Task 1 (C3): Catalog content

**Branch:** `feat/catalog-content`

**Files:**
- Create: `apps/server/catalog/catalog.json`

**Interfaces:**
- Consumes: `Product`, `ProductSchema`, `EU_ALLERGENS` (Plan 0, Task 3). `npm run catalog:check --workspace apps/server` (Plan 1, Task 20).
- Produces: `apps/server/catalog/catalog.json`, one JSON array of `Product` objects. `readCatalogFile` of Plan 1 Task 2 reads this form. Fixed IDs, which the dev catalog and the fake script of Plan 1 also use: `oat-drink-1l`, `oat-drink-barista-1l`, `rye-bread`, `potato-crisps`. The number of entries, which Task 2 copies into `CATALOG_SIZE`.

- [ ] **Step 1: Take this shopping list to the store**

| Slot | `id` | Buy | Role in the demo |
|---|---|---|---|
| 1 | `oat-drink-1l` | Oat drink, 1 L carton | Voice script, look-alike pair |
| 2 | `oat-drink-barista-1l` | The barista edition of the same brand, 1 L carton | Look-alike pair with another price |
| 3 | `rye-bread` | Sliced rye bread in a bag | Main take, step 3 |
| 4 | by rule | Milk chocolate bar | Allergen guard |
| 5 | by rule | Peanut butter jar | Allergen guard |
| 6 | by rule | Orange juice, 1 L carton | A product with no allergen |
| 7 | by rule | Ground coffee pack | A product with no allergen |
| 8 | by rule | Dry pasta | Allergen guard |
| 9 | `potato-crisps` | Potato crisps bag | Put-back on the low shelf |
| 10 | by rule | Biscuits pack | Several allergens |
| 11 | by rule | Tomato ketchup bottle | A bottle shape |
| 12 | by rule | Dish soap bottle | No food label, so `allergens` is `null` |

"By rule" means the `id` rule of Step 3. Selection rules of the author:

- Pick a front with large words and plain color areas. Do not pick a transparent bag.
- Do not pick two products with the same shape and the same main color, except slots 1 and 2.
- If the store has no barista edition, take two cartons of one brand that differ in one word and in price. Then rename the two IDs, and tell seat 2, because the fixtures of Plan 0 and the fake script of Plan 1 use the old IDs.
- If the store lacks another item, take a product of the same kind.

- [ ] **Step 2: In the store, record the facts**

Take one photo of each front at arm's length. Keep the receipt. Seat 2 can ask for the photos as reference images (spec section 16).

- [ ] **Step 3: Write one entry for each product**

The file is one JSON array. Copy this template for each product. A complete example is `packages/shared/fixtures/catalog/oat-drink-1l.json`.

```json
[
  {
    "id": "oat-drink-1l",
    "gtin": "FILL_DIGITS_UNDER_THE_BARCODE",
    "name": { "en": "Oat drink" },
    "spokenName": { "en": "Oat drink" },
    "brand": "FILL_BRAND",
    "packSize": "1 L",
    "spokenPack": { "en": "one litre" },
    "spokenPackDetailed": { "en": "one litre carton" },
    "priceCents": 0,
    "allergens": null,
    "vegan": null,
    "vegetarian": null,
    "visual": "FILL_VISUAL",
    "lookAlikes": ["oat-drink-barista-1l"]
  }
]
```

| Field | Rule | Example |
|---|---|---|
| `id` | Lower case letters, digits, and hyphens: the name, then the pack size. Slots 1, 2, 3, and 9 keep the IDs of the shopping list. | `orange-juice-1l` |
| `gtin` | A person copies the digits under the barcode, with no space: 8, 12, 13, or 14 digits. Remove the key if the pack has no barcode. | 13 digits |
| `name.en` | A person writes the generic name: no brand, sentence case, at most three words. The screen shows it. The server writes the first letter in lower case inside a sentence. | `Oat drink` |
| `spokenName.en` | The same name as the voice says it: no digit, no symbol, no abbreviation. | `Oat drink` |
| `brand` | The brand as the pack prints it. The voice says it at the detailed level. | `Oatly` |
| `packSize` | A person writes the net amount from the pack: number, space, unit. Use `x` for a multipack. | `1 L`, `500 g`, `6 x 330 ml` |
| `spokenPack.en` | The pack size in words. | `one litre` |
| `spokenPackDetailed.en` | The pack size in words, then the package type. | `one litre carton` |
| `priceCents` | A person writes the unit price from the receipt, in cents. It is never 0. | `189` for 1,89 EUR |
| `allergens` | Step 4. A list of values from `EU_ALLERGENS`. `[]` means that the label names no allergen. `null` means that no label exists. | `["gluten"]` |
| `vegan`, `vegetarian` | `true` only if the pack has a mark or a claim. `false` if the ingredient list has an animal product. `null` if you are not sure. | `true` |
| `visual` | A person writes one or two sentences with the pack at arm's length: package type, main colors, the largest words, and the detail that separates it from its look-alike. No small print. The recognition prompt of Plan 1 prints it on one line: write 20 characters or more, with no line break and no vertical bar. | See the fixture. |
| `lookAlikes` | IDs of products with a similar pack. If A lists B, then B lists A. | `["oat-drink-1l"]` |
| `it` keys | Do not add them. Add them only if the team starts extra 7. | |

- [ ] **Step 4: Fill the allergens, and let a second person check them**

1. Optional help: open `https://world.openfoodfacts.org/api/v2/product/<gtin>.json?fields=product_name,allergens_tags,traces_tags,ingredients_analysis_tags`. The tag `en:soybeans` is the value `soy`. Open Food Facts is a hint, not a source.
2. Read the ingredient list on the pack. An EU label prints each allergen in bold or in capitals.
3. Write the value for each allergen that the label names. Also write the value if the label says "may contain".
4. A second person reads each label and compares it with the file. Ask a Finnish speaker if a word is not in this table.

| Value | English label words | Finnish label words |
|---|---|---|
| `gluten` | wheat, rye, barley, oats, spelt | vehnä, ruis, ohra, kaura, speltti |
| `crustaceans` | crab, prawn, shrimp, lobster | äyriäiset, katkarapu, rapu |
| `eggs` | egg | kananmuna, muna |
| `fish` | fish | kala |
| `peanuts` | peanut | maapähkinä |
| `soy` | soy, soya | soija |
| `milk` | milk, butter, cream, whey, lactose | maito, voi, kerma, hera, laktoosi |
| `nuts` | almond, hazelnut, walnut, cashew, pistachio | pähkinä, manteli, hasselpähkinä, saksanpähkinä |
| `celery` | celery | selleri |
| `mustard` | mustard | sinappi |
| `sesame` | sesame | seesami |
| `sulphites` | sulphites, sulphur dioxide | sulfiitti, rikkidioksidi |
| `lupin` | lupin | lupiini |
| `molluscs` | mussel, squid, snail | nilviäiset, simpukka |

- [ ] **Step 5: Run the checks**

Run at the repository root:

```bash
node -e "const c=JSON.parse(require('fs').readFileSync('apps/server/catalog/catalog.json','utf8'));const bad=c.filter(p=>p.priceCents===0||JSON.stringify(p).includes('FILL_')).map(p=>p.id);console.log(c.length+' products, not filled: '+(bad.join(', ')||'none'))"
npm run catalog:check --workspace apps/server -- catalog/catalog.json
```

Expected: the first command prints `12 products, not filled: none` (or your real count). The second command prints `warning: <id of the dish soap>: no allergen data`, then `catalog: 12 products, 0 errors, 1 warnings`, and exits with code 0. Without the path, the script checks the dev catalog of Plan 1. The script comes with Plan 1 Task 20. If it does not exist yet, run it later and before seat 2 seeds the database.

`catalog:check` reports an error for a price of 0, a bad or double ID, a look-alike link that does not go both ways, a look-alike pair with the same price and the same allergens, and a GTIN with a wrong check digit.

Then check by eye:

- Each price equals the receipt.
- Each food product has an allergen list. `null` stays only on a product with no ingredient label.
- Before `catalog:check` exists: each ID is unique, each ID in a `lookAlikes` list exists, and each link goes both ways.

- [ ] **Step 6: Commit, and tell seat 2**

```bash
git add apps/server/catalog/catalog.json
git commit -m "feat(catalog): add the demo products"
```

Tell seat 2 after each merged change of this file. The seed makes speech clips from it, and the recognition test needs the same products.

---

### Task 2 (C3): Landing content and the copy guard

**Branch:** `feat/website-pages`, shared by Tasks 2, 3, and 4.

**Files:**
- Create: `apps/website/src/content/probe.ts`, `apps/website/src/content/copyRules.ts`, `apps/website/src/content/numbers.json`, `apps/website/src/content/numbers.ts`, `apps/website/src/content/landing.ts`
- Test: `apps/website/src/content/copyRules.test.ts`, `apps/website/src/content/numbers.test.ts`, `apps/website/src/content/landing.test.ts`

**Interfaces:**
- Consumes: nothing from another task.
- Produces:

```ts
// probe.ts: the results of spec section 16 that change website copy
export type Probe = {
  motion: boolean;                             // nod and shake start on the glasses
  inputs: boolean;                             // the double tap reaches the app
  speech: 'glasses' | 'phone' | 'none';
  access: 'developerMode' | 'releaseChannel';  // 'releaseChannel' if the build needs a Developer Center project
};
export const PROBE: Probe;                     // { motion: true, inputs: true, speech: 'glasses', access: 'developerMode' }
export type MainYes = 'head' | 'touch' | 'key';        // three of the values of Profile['mainYes'] in Plan 0
export function mainYes(probe: Probe): MainYes;        // 'head' if motion, else 'touch' if inputs, else 'key'

// copyRules.ts
export function copyProblems(texts: readonly string[]): string[];   // one line for each rule that a text breaks

// numbers.ts
export type Measured = { id: string; label: string; value: number | null; unit: string; note: string };
export type Numbers = { context: string | null; items: Measured[] };
export function parseNumbers(input: unknown): Numbers;   // throws an Error that names the item ID or the key
export function formatMeasured(item: Measured): string;
export const NUMBERS: Numbers;                           // parseNumbers of numbers.json

// landing.ts
export type Source = { research: string; name: string; url: string | null };
export type Claim = { text: string; source?: Source };
export type Step = { title: string; text: string };
export type TeamMember = { name: string; role: string };
export type Links = { videoId: string | null; apkUrl: string | null; repoUrl: string };
export type LandingCopy = {
  brand: string; headline: string; lead: string;
  headings: { story: string; video: string; steps: string; accessibility: string; data: string; numbers: string; tryIt: string; team: string };
  story: Claim[]; videoCaption: string; videoMissing: string; steps: Step[]; rules: string[];
  accessibility: Claim[]; data: Claim[]; privacyLink: string; numbersMissing: string; tradeoff: string;
  trySetup: Claim; trySteps: string[]; tryNotes: Claim[]; apkLabel: string; apkMissing: string;
  event: Claim; builtWith: string; disclaimer: string; repoLabel: string;
};
export const LINKS: Links;        // { videoId: null, apkUrl: null, repoUrl: 'https://github.com/mrBymax/glance' }
export const TEAM: TeamMember[];  // [] until Task 8
export const CATALOG_SIZE: number;                          // 12 until Task 1 gives the real count
export function landingCopy(probe: Probe): LandingCopy;
export function landingText(copy: LandingCopy): string[];   // each string of the copy, for the copy guard
```

- [ ] **Step 1: Write the failing tests**

`copyRules.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { copyProblems } from './copyRules';

describe('copyProblems', () => {
  it('accepts the honest lines', () => {
    expect(copyProblems([
      'With Glance, the store adds no camera and no sensor.',
      'Ceiling cameras need an installation in each store.',
      'The payment is a demo. No money moves.',
      'Blind and low-vision shoppers have not tested Glance yet.',
    ])).toEqual([]);
  });
  it('flags each forbidden claim', () => {
    for (const text of [
      'The store installs nothing.',
      'There is nothing to install in the store.',
      'The store lends you a pair of glasses.',
      'Glance takes a real payment at the kiosk.',
      'We tested it with blind shoppers.',
      'Blind shoppers have tested Glance.',
    ]) expect(copyProblems([text]), text).toHaveLength(1);
  });
  it('flags banned characters, marketing words, and long sentences', () => {
    expect(copyProblems(['Look \u2014 then nod.'])).toHaveLength(1);
    expect(copyProblems(['A \u201Csmart\u201D cart.'])).toHaveLength(1);
    expect(copyProblems(['Pay now!'])).toHaveLength(1);
    expect(copyProblems(['Glance is a seamless checkout.'])).toHaveLength(1);
    expect(copyProblems([`${Array(26).fill('word').join(' ')}.`])).toHaveLength(1);
  });
});
```

`numbers.test.ts`:

```ts
import { expect, it } from 'vitest';
import { copyProblems } from './copyRules';
import { formatMeasured, parseNumbers } from './numbers';
import numbersJson from './numbers.json';

const item = { id: 'false-yes', label: 'False yes in the walk test', value: null, unit: 'in 15 minutes', note: '' };

it('accepts the committed file, and its text passes the copy rules', () => {
  const numbers = parseNumbers(numbersJson);
  expect(numbers.items.length).toBeGreaterThan(0);
  expect(copyProblems(numbers.items.flatMap((i) => [i.label, i.note]))).toEqual([]);
});
it('rejects a value that is not null or a finite number, and names the item', () => {
  expect(() => parseNumbers({ context: null, items: [{ ...item, value: '0' }] })).toThrow(/false-yes/);
  expect(() => parseNumbers({ context: null, items: [{ ...item, value: Number.NaN }] })).toThrow(/false-yes/);
});
it('rejects two items with one ID', () => {
  expect(() => parseNumbers({ context: null, items: [item, item] })).toThrow(/false-yes/);
});
it('rejects a measured value with no context sentence', () => {
  expect(() => parseNumbers({ context: null, items: [{ ...item, value: 0 }] })).toThrow(/context/);
});
it('shows a missing value as "Not measured yet"', () => {
  expect(formatMeasured(item)).toBe('Not measured yet');
});
it('shows a value of 0 with its unit', () => {
  expect(formatMeasured({ ...item, value: 0 })).toBe('0 in 15 minutes');
  expect(formatMeasured({ ...item, value: 2.4, unit: 's' })).toBe('2.4 s');
});
```

`landing.test.ts`:

```ts
import { expect, it } from 'vitest';
import { copyProblems } from './copyRules';
import { landingCopy, landingText } from './landing';
import type { Probe } from './probe';

const head: Probe = { motion: true, inputs: true, speech: 'glasses', access: 'developerMode' };
const touch: Probe = { ...head, motion: false };
const key: Probe = { ...head, motion: false, inputs: false, speech: 'none' };

it('passes the copy rules for each probe result', () => {
  for (const probe of [head, touch, key, { ...head, access: 'releaseChannel' as const }]) {
    expect(copyProblems(landingText(landingCopy(probe)))).toEqual([]);
  }
});
it('fixes the headline for each main yes', () => {
  expect(landingCopy(head).headline).toBe('Glance tells. Nod buys.');
  expect(landingCopy(touch).headline).toBe('Glance tells. Tap buys.');
  expect(landingCopy(key).headline).toBe('Glance tells. Press buys.');
});
it('has the three steps look, yes, pay', () => {
  expect(landingCopy(head).steps.map((s) => s.title)).toEqual(['Look', 'Nod', 'Pay']);
  expect(landingCopy(touch).steps.map((s) => s.title)).toEqual(['Look', 'Tap', 'Pay']);
});
it('does not name a nod when head gestures do not start', () => {
  for (const probe of [touch, key]) {
    expect(landingText(landingCopy(probe)).join(' ')).not.toMatch(/\bnod\b|\bshake\b/i);
  }
});
it('lists the yes inputs that the probe allows', () => {
  expect(landingCopy(head).accessibility.map((c) => c.text)).toContain(
    'You can add a product or pay in four ways. Use a nod, a spoken word, a double tap on the glasses, or a button on the phone.');
  expect(landingCopy(key).accessibility.map((c) => c.text)).toContain(
    'You can add a product or pay in two ways. Use the volume keys of the phone or a button on the phone.');
});
it('states the honest lines', () => {
  const text = landingText(landingCopy(head)).join(' ');
  for (const line of [
    'With Glance, the store adds no camera and no sensor.',
    'The payment is a demo. No money moves.',
    'Blind and low-vision shoppers have not tested Glance yet.',
    'The camera runs for the whole session, not only for each glance.',
    'It is not a product of Meta.',
  ]) expect(text).toContain(line);
});
it('cites a research file for each sourced claim', () => {
  const copy = landingCopy(head);
  const claims = [...copy.story, ...copy.accessibility, ...copy.data, copy.trySetup, ...copy.tryNotes, copy.event];
  const sourced = claims.filter((c) => c.source);
  expect(sourced.length).toBeGreaterThanOrEqual(11);
  for (const claim of sourced) expect(claim.source?.research, claim.text).toMatch(/^docs\/research\/2026-11-13-/);
});
it('adds the release channel step only when the build needs it', () => {
  expect(landingCopy(head).trySteps).toHaveLength(5);
  expect(landingCopy({ ...head, access: 'releaseChannel' }).trySteps).toHaveLength(6);
});
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace apps/website -- src/content`
Expected: FAIL, because the modules do not exist. Before the scaffold of Plan 3 exists, use the command of the dependency table in each run step of this task.

- [ ] **Step 3: Implement `probe.ts` and `copyRules.ts`**

`copyProblems` applies these four rules to each text. It returns at most one line for each rule and text, in the form `<rule>: <text>`. It splits sentences at white space after `.` or `?`.

```ts
const BANNED_CHARACTERS = /[\u2010-\u2015\u2018-\u201F\u2026\u2190-\u21FF\u2212\u00D7\u2022\u25A0-\u25FF\u2600-\u27BF\u{1F000}-\u{1FAFF};!]/u;
const FORBIDDEN_CLAIMS: { rule: string; pattern: RegExp }[] = [
  { rule: 'claims that the store installs nothing', pattern: /install(s|ed)? nothing|nothing to install|no installation/i },
  { rule: 'claims that the store lends glasses', pattern: /\blend(s|ing)?\b|\blent\b|\bborrow/i },
  { rule: 'claims a real payment', pattern: /real payments?|real money|charges? your card/i },
  { rule: 'claims a test with blind shoppers', pattern: /tested (it |glance )?(with|by) (a |the )?(blind|low-vision)|(blind|low-vision) (shoppers?|people|persons?|users?|testers?) (have |has )?(tested|tried|used)/i },
];
const MARKETING_WORDS = /\b(seamless|robust|powerful|cutting-edge|effortless|world-class|next-generation|revolutionary|blazing|lightning-fast|elegant|delightful|turnkey|best-in-class|state-of-the-art|game-changing|first-class|battle-tested|enterprise-grade|supercharge|unlock|unleash|empower|elevate|streamline|revolutionize)/i;
const MAX_WORDS_IN_SENTENCE = 25;
```

- [ ] **Step 4: Write `numbers.json` and implement `numbers.ts`**

`numbers.json`:

```json
{
  "context": null,
  "items": [
    { "id": "accuracy-correct", "label": "Frames with the correct product", "value": null, "unit": "of 100", "note": "100 frames from the glasses, over all products of the catalog." },
    { "id": "accuracy-wrong", "label": "Frames with a wrong product named", "value": null, "unit": "of 100", "note": "The target is 0. If the model is not sure, the voice gives an aim hint and no name." },
    { "id": "latency-median", "label": "Glance to voice, median", "value": null, "unit": "s", "note": "20 glances at the venue, timed on video from the product at rest to the first sound of the line." },
    { "id": "latency-p95", "label": "Glance to voice, 95th percentile", "value": null, "unit": "s", "note": "Value 19 of the same 20 glances, in order of time." },
    { "id": "false-yes", "label": "False yes in the walk test", "value": null, "unit": "in 15 minutes", "note": "Two people walk, talk, and put products back on a low shelf." },
    { "id": "false-no", "label": "False no in the walk test", "value": null, "unit": "in 15 minutes", "note": "The same walk test." },
    { "id": "kiosk-distance", "label": "Kiosk code decodes from", "value": null, "unit": "m", "note": "Measured from a chair to the kiosk screen." },
    { "id": "battery", "label": "Glasses battery used in 10 minutes", "value": null, "unit": "percent", "note": "Camera stream, head motion, and audio together." }
  ]
}
```

`parseNumbers` rules: `items` is a list with one item or more. Each ID is unique. `label` and `unit` are strings that are not empty. `value` is `null` or a finite number. If one value is a number, `context` is a string that is not empty. `formatMeasured` returns `Not measured yet` for `null`, and the value, a space, and the unit for a number.

- [ ] **Step 5: Implement `landing.ts` from these three tables**

Sources. `research` is the file path, a comma, and the section name.

| Key | `research` | `name` | `url` |
|---|---|---|---|
| `sGroup` | `docs/research/2026-11-13-context-and-prior-art.md`, Retail facts | SOK press release, 25 June 2026 | `https://www.sttinfo.fi/tiedote/72160887/ei-enaa-ostosten-nostelua-hihnalle-keraa-ja-skannaa-palvelun-kaytto-onnistuu-yha-useammassa-myymalassa-omalla-puhelimella?lang=fi` |
| `amazon` | same file, Retail facts | Retail Dive, 3 April 2024 | `https://www.retaildive.com/news/amazon-removes-just-walk-out-tech-amazon-fresh-stores-dash-carts/712150` |
| `gs1` | `docs/research/2026-11-13-accessibility-and-trust.md`, section 2 | Packaging Europe, 12 January 2026 | `https://packagingeurope.com/news/seven-in-ten-visually-impaired-consumers-struggle-to-read-food-labels/13795.article` |
| `accessBoard` | same file, section 2 | US Access Board, 27 September 2022 | `https://www.access-board.gov/news/2022/09/27/u-s-access-board-seeks-public-comment-on-accessibility-guidelines-for-self-service-transaction-machines/` |
| `eaaScope` | same file, section 1 | Directive (EU) 2019/882, Article 2 | `https://www.legislation.gov.uk/eudr/2019/882/article/2` |
| `eaaOld` | same file, section 1 | Directive (EU) 2019/882, Article 32 | `https://www.legislation.gov.uk/eudr/2019/882/article/32` |
| `metaUse` | `docs/research/2026-11-13-context-and-prior-art.md`, Meta policy for DAT apps | Meta acceptable use guidance | `https://wearables.developer.meta.com/docs/develop/dat/acceptable-use` |
| `led` | `docs/research/2026-11-13-dat-feasibility.md`, Camera | Meta DAT issue 318 | `https://github.com/meta/meta-wearables-dat-ios/issues/318` |
| `devMode` | same file, Registration and distribution | Meta DAT docs, getting started | `https://wearables.developer.meta.com/docs/develop/dat/getting-started-toolkit` |
| `oneApp` | same file, Registration and distribution | Meta DAT docs, permission requests | `https://wearables.developer.meta.com/docs/develop/dat/permissions-requests` |
| `devModeOff` | same file, Registration and distribution | Meta DAT skill, iOS debugging | `null` |
| `junction` | `docs/research/2026-11-13-context-and-prior-art.md`, Junction 2026 | Junction 2026 | `https://2026.hackjunction.com/` |

Copy that depends on the main yes. The spec gives the line for `touch`. The line for `key` is a choice of the author.

| Key | `head` | `touch` | `key` |
|---|---|---|---|
| `headline` | Glance tells. Nod buys. | Glance tells. Tap buys. | Glance tells. Press buys. |
| `stepTitle` | Nod | Tap | Press |
| `add` | Nod to add the product. | Double tap the side of the glasses to add the product. | Press volume up on the phone to add the product. |
| `skip` | Shake your head to skip it. | Press Skip on the phone to skip it. | Press volume down to skip it. |
| `pay` | Nod to pay. | Double tap to pay. | Press volume up to pay. |

Fixed copy. A slash separates the entries of a list. In a `steps` row, the word before the colon is the title. A word in code style is a value from the tables above or a constant. "Design" in the last column means a statement about Glance from the named spec section. Task 8 checks each such line against the build.

| Key | Exact text | Source |
|---|---|---|
| `brand` | Meta Glance | |
| `lead` | Meta Glance makes smart glasses the scanner for scan-as-you-shop. A glance tells you the name and the price. Only a deliberate yes changes your cart. | Design, 1 |
| `headings`, in the order of the type | Why glasses / The demo / Three steps / Accessibility / What leaves the phone / Measured numbers / Try it / Team | Spec 12 |
| `story` 1 | Scan-as-you-shop exists. In June 2026, the Kerää ja skannaa service of S Group was in 67 stores. | `sGroup` |
| `story` 2 | That service still needs a hand for a scanner or a phone. | Design, 1 |
| `story` 3 | The camera of the glasses sees what your hand holds. Both hands stay free. | Design, 1 |
| `story` 4 | Ceiling cameras need an installation in each store. In 2024, Amazon removed Just Walk Out from its Amazon Fresh stores in the US. | `amazon` |
| `story` 5 | With Glance, the store adds no camera and no sensor. Its kiosk software shows one code and accepts the cart. | Design, 1 |
| `videoCaption` | One take of the full loop, from the first glance to the paid checkout. | Spec 18 |
| `videoMissing` | The video is not online yet. | |
| `steps` 1 | Look: Hold a product up. The voice in the glasses says its name and its price. The cart does not change. | Design, 6.1 |
| `steps` 2 | `stepTitle`: `add` `skip` The voice names each product that it adds. | Design, 6.1 and 6.3 |
| `steps` 3 | Pay: Look at the code on the checkout screen. The voice names the store and the total. `pay` The payment is a demo. No money moves. | Design, 6.1 and 11.4 |
| `rules` | A glance never changes the cart. / A yes answers only the prompt that you just heard. / Silence never adds and never pays. | Design, 6.2 |
| `accessibility` 1 | You can add a product or pay in `N` ways. Use `list`. | Design, 6.3 and 16 |
| `accessibility` 2 | No action needs your head, your voice, or the touchpad alone. Each action has a button on the phone. | Design, 6.3 |
| `accessibility` 3 | Each spoken line also shows as text on the phone. The phone vibrates for each key event. | Design, 6.4 |
| `accessibility` 4, only if `motion` | You can turn head gestures off. You can swap the meaning of nod and shake. | Design, 6.5 |
| `accessibility` 5 | You set the speech speed and the level of detail. | Design, 6.5 |
| `accessibility` 6 | The voice says when it is not sure. It never guesses a price or an allergen. | Design, 2 and 11.1 |
| `accessibility` 7 | At the checkout, you look at one code. You do not touch the screen. | Design, 1 |
| `accessibility` 8 | In GS1 UK research, 83 percent of visually impaired consumers found the information on food packaging difficult or impossible to access. | `gs1` |
| `accessibility` 9 | The US Access Board states that self-service machines without tactile controls and without speech are unusable for many blind people. | `accessBoard` |
| `accessibility` 10 | The European Accessibility Act covers payment terminals that enter the market after 28 June 2025. | `eaaScope` |
| `accessibility` 11 | A member state can let self-service terminals in use before that date stay for up to 20 years. | `eaaOld` |
| `accessibility` 12 | Blind and low-vision shoppers have not tested Glance yet. The next step is to ask the Finnish Federation of the Visually Impaired for a test. | Spec 18 |
| `data` 1 | The phone picks at most two frames each second. | Design, 9.5 |
| `data` 2 | The phone pixelates faces and crops each frame before upload. | Design, 9.5 |
| `data` 3 | The server holds a frame in memory for one recognition call. It never stores a frame. | Design, 11.1 |
| `data` 4 | The Google Gemini API receives the frame for that call. | Design, 11.1 |
| `data` 5 | `glasses`: No raw audio leaves the glasses. The glasses turn your speech into text. `phone`: Voice input uses the speech service of your Android phone, after you press the microphone button. `none`: Glance does not use a microphone. | Design, 13 and 16 |
| `data` 6 | The server stores your cart, your preferences, and your order. It stores no name and no account. | Design, 13 |
| `data` 7 | The capture LED on the glasses stays on while the camera runs. The voice says "Camera on" and "Camera off". | `led` |
| `data` 8 | The camera runs for the whole session, not only for each glance. The Meta guidance for glasses apps says: "Deliberate, not ambient." | `metaUse` |
| `data` 9 | Glance does not meet that guidance yet. A product needs a wake signal on the glasses, and we ask Meta for that signal. | Design, 13 |
| `privacyLink` | Read the privacy page | |
| `numbersMissing` | The team has not measured these numbers yet. | |
| `tradeoff` | A handheld scanner is faster for each item. Glance gives free hands and a checkout without touch. The demo catalog has `CATALOG_SIZE` products. | Design, 14 and 18 |
| `trySetup` | You need Ray-Ban Meta glasses, an Android phone with Android 10 or later, and the Meta AI app. Developer Mode lets an unpublished app connect to your glasses. | `devMode` |
| `trySteps` | In the Meta AI app, open Settings, then App Info. / Tap the app version five times. A Developer Mode toggle appears. / Turn Developer Mode on and confirm. / Download the APK on the phone and install it. Android asks you to allow the install. / Open Glance and follow the three setup steps: link glasses, allow camera, ready. | `devMode`, and Design, 10 |
| `trySteps`, only `releaseChannel`, as entry 4 | Ask the team for an invite to the Glance release channel. Accept it with your Meta account. | `docs/research/2026-11-13-dat-feasibility.md`, Registration and distribution |
| `tryNotes` 1 | Developer Mode keeps one third-party app registered at a time. | `oneApp` |
| `tryNotes` 2 | An update of the Meta AI app or of the glasses can turn Developer Mode off. | `devModeOff` |
| `tryNotes` 3 | The team tested Glance on Ray-Ban Meta Gen 2 glasses. The app works only with the demo server and its `CATALOG_SIZE` products. | Design, 2 and 18 |
| `apkLabel` | Download the Android app (APK) | |
| `apkMissing` | The APK is not online yet. | |
| `event` | The team built Glance at Junction 2026 in Espoo, from 13 to 15 November 2026. It answers the Meta challenge "AI Glasses for Everyone, Everyday". | `junction` |
| `builtWith` | Gemini names the product. ElevenLabs speaks each line. MongoDB Atlas stores the cart and the order. The server runs on Vultr. | Design, 2 and 11 |
| `disclaimer` | Meta Glance is a hackathon prototype. It is not a product of Meta. | |
| `repoLabel` | Source code on GitHub | |

Rules for `accessibility` 1: the list has these parts in this order. `a nod` if `motion`. `a spoken word` if `speech` is `glasses`. `a double tap on the glasses` if `inputs`. `the volume keys of the phone` if `motion` and `inputs` are both false. `a button on the phone` always. `N` is the count as a word. Join two parts with "or". Join three or more with commas and ", or".

Notes on two claims:

- Article 2 of the directive lists payment terminals, not checkout kiosks in general. Keep the narrow text of `accessibility` 10.
- `accessibility` 12 names an organization. If a blind or low-vision person tests Glance on Saturday, ask the team before you change this line and the copy guard.

- [ ] **Step 6: Run the tests and make sure they pass**

Run: `npm test --workspace apps/website -- src/content`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/website/src/content
git commit -m "feat(website): add landing content and the copy guard"
```

---

### Task 3 (C3): Landing page

**Branch:** `feat/website-pages`

**Files:**
- Modify: `apps/website/src/pages/Landing.tsx` (the placeholder of Plan 3)
- Test: `apps/website/src/pages/Landing.test.tsx`

**Interfaces:**
- Consumes: `Probe`, `PROBE`, `Numbers`, `NUMBERS`, `formatMeasured`, `Links`, `LINKS`, `TeamMember`, `TEAM`, `landingCopy` (Task 2). `renderWithTheme(ui)` from `apps/website/src/test/render.tsx` (Plan 3, Task 1).
- Produces: `export function Landing(props: { probe?: Probe; numbers?: Numbers; links?: Links; team?: TeamMember[] })`. Each prop defaults to the constant of Task 2. The router of Plan 3 renders it with no props at `/`. Its `App.test.tsx` requires one `main` element and one `h1` on this page.

- [ ] **Step 1: Look up the Astryx components, before you write page code**

Run in `apps/website`:

```bash
npx @astryxdesign/cli component --list
npx @astryxdesign/cli component Heading Text Link VStack List ListItem AspectRatio
```

Expected: the first command prints the catalog (174 components with CLI 0.7.15). The second command prints the import path and the props table of each name. If a name is missing, select its replacement from the list. Do not write a component by hand that the list has. Facts from CLI 0.7.15 that this task uses:

- Each component has its own import path, for example `@astryxdesign/core/Heading`. `ListItem` comes from `@astryxdesign/core/List`.
- `Heading` needs `level`. `Text` takes `as` (`span`, `p`, `div`, `label`) and `type`, and has no `variant` prop.
- `Link` with `isExternalLink` opens a new tab and adds hidden text to its name. Match link names with a regular expression in tests.
- A plain string in `label` or `description` of `ListItem` is cut to one line. Pass a `Text` element for a sentence.
- `List` with `listStyle="decimal"` renders an `ol` element.

- [ ] **Step 2: Write the failing tests**

`Landing.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { LINKS, landingCopy } from '../content/landing';
import type { Probe } from '../content/probe';
import { renderWithTheme as render } from '../test/render';
import { Landing } from './Landing';

const head: Probe = { motion: true, inputs: true, speech: 'glasses', access: 'developerMode' };
const numbers = (value: number | null) => ({
  context: value === null ? null : 'Measured on 14 November 2026 at the venue.',
  items: [{ id: 'false-yes', label: 'False yes in the walk test', value, unit: 'in 15 minutes', note: 'Two people walk.' }],
});

it('shows the headline as the only level 1 heading', () => {
  render(<Landing probe={head} />);
  expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Glance tells. Nod buys.']);
});
it('has one level 2 heading for each part of spec section 12, in order', () => {
  render(<Landing />);
  expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
    'Why glasses', 'The demo', 'Three steps', 'Accessibility', 'What leaves the phone', 'Measured numbers', 'Try it', 'Team']);
});
it('shows "Not measured yet" for a number with no value', () => {
  render(<Landing numbers={numbers(null)} />);
  expect(screen.getByText('Not measured yet')).toBeTruthy();
  expect(screen.getByText('The team has not measured these numbers yet.')).toBeTruthy();
});
it('shows a measured value of 0 with its unit and the context sentence', () => {
  render(<Landing numbers={numbers(0)} />);
  expect(screen.getByText('0 in 15 minutes')).toBeTruthy();
  expect(screen.getByText('Measured on 14 November 2026 at the venue.')).toBeTruthy();
});
it('shows one plain line and no link while the APK is not online', () => {
  render(<Landing links={{ ...LINKS, apkUrl: null }} />);
  expect(screen.queryByRole('link', { name: /Download the Android app/ })).toBeNull();
  expect(screen.getByText('The APK is not online yet.')).toBeTruthy();
});
it('links to the APK when it is online', () => {
  render(<Landing links={{ ...LINKS, apkUrl: 'https://example.org/glance.apk' }} />);
  expect(screen.getByRole('link', { name: /Download the Android app/ }).getAttribute('href')).toBe('https://example.org/glance.apk');
});
it('shows one plain line while the video is not online, and the player when it is', () => {
  const { unmount } = render(<Landing links={{ ...LINKS, videoId: null }} />);
  expect(screen.getByText('The video is not online yet.')).toBeTruthy();
  unmount();
  render(<Landing links={{ ...LINKS, videoId: 'abc123XYZ_-' }} />);
  expect(screen.getByTitle('Meta Glance demo video').getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/abc123XYZ_-');
});
it('gives each sourced claim a link to its source', () => {
  render(<Landing probe={head} />);
  const copy = landingCopy(head);
  for (const claim of [...copy.story, ...copy.accessibility, ...copy.data, copy.trySetup, ...copy.tryNotes, copy.event]) {
    if (!claim.source?.url) continue;
    const links = screen.getAllByRole('link', { name: new RegExp(`Source: ${claim.source.name.replace(/[()]/g, '\\$&')}`) });
    expect(links.map((a) => a.getAttribute('href'))).toContain(claim.source.url);
  }
});
it('links to the privacy page and lists the team', () => {
  render(<Landing team={[{ name: 'Ada Example', role: 'Server' }]} />);
  expect(screen.getByRole('link', { name: /Read the privacy page/ }).getAttribute('href')).toBe('/privacy');
  expect(screen.getByText('Ada Example, Server')).toBeTruthy();
});
```

The test setup of Plan 3 runs jsdom, wraps the page in the theme, and cleans the DOM after each test. `Link` and `AspectRatio` are not checked in jsdom yet. If one of them throws there, tell seat 3 and do not add a config file. Each test passes the values that it depends on, so the fills of Task 8 break no test.

- [ ] **Step 3: Run the tests and make sure they fail**

Run: `npm test --workspace apps/website -- src/pages/Landing`
Expected: FAIL, because the placeholder renders none of this.

- [ ] **Step 4: Implement `Landing.tsx`**

- Keep the named export `Landing` and the outer element of the placeholder: `<VStack as="main" padding={6} gap={4}>`. Add `maxWidth={720}` and `style={{ marginInline: 'auto' }}` to it, for one centered column.
- Top: `copy.brand` as `Text` with `type="label"`, then the one `Heading` with `level={1}` for `copy.headline`, then `copy.lead`.
- Then one block for each key of `copy.headings`, in the order of the type, each with a `Heading` of `level={2}`.
- A `Claim` is one paragraph. If `source.url` is not null, an external `Link` with the text `Source: <name>` follows it.
- Steps: one ordered `List`. Each `ListItem` has the step title as `label` and the step text as a `Text` element in `description`. The three `rules` follow as paragraphs.
- Video: if `links.videoId` is not null, one `AspectRatio` with `ratio={16 / 9}` around an `iframe` with the title `Meta Glance demo video`, the source `https://www.youtube-nocookie.com/embed/<videoId>`, and `allowFullScreen`. Then `copy.videoCaption`. If it is null, show `copy.videoMissing`.
- What leaves the phone: the `data` claims, then a `Link` with `copy.privacyLink` to `/privacy`.
- Numbers: `numbers.context`, or `copy.numbersMissing` if it is null. Then one `List`. Each `ListItem` has the item label as a `Text` element in `label`. Its `description` holds the result of `formatMeasured` in one `Text` element, and the note in a second `Text` element. Then `copy.tradeoff`.
- Try it: `copy.trySetup`, the ordered `trySteps`, then a `Link` with `copy.apkLabel` to `links.apkUrl`, or `copy.apkMissing` if it is null. Then `copy.tryNotes`.
- Team: one line for each member in the form `<name>, <role>`. Then `copy.event`, `copy.builtWith`, `copy.disclaimer`, and a `Link` with `copy.repoLabel` to `links.repoUrl`.
- The page shows the team logo above `copy.brand`, as one `picture` element: a `source` with `media="(prefers-color-scheme: dark)"` and `srcSet="/logo-dark.svg"`, then an `img` with `src="/logo-light.svg"`, `alt="Glance"`, and a width of 240. Before you write the component, copy `assets/Glance.svg` to `apps/website/public/logo-light.svg` and `assets/Glance Dark.svg` to `apps/website/public/logo-dark.svg`. Add one test: the page has an image with the alternative text `Glance`.
- The team decided to use this logo. It contains the Meta mark, so ask the Meta mentors before the page goes public.

- [ ] **Step 5: Run the tests, the typecheck, and the build**

Run: `npm test --workspace apps/website -- src/pages/Landing src/content`, then `npm run typecheck --workspace apps/website`, then `npm run build --workspace apps/website`
Expected: PASS, no type error, and a finished build.

- [ ] **Step 6: Check the page in a browser**

Run: `npm run dev --workspace apps/website` and open `http://localhost:5174/`.

- At a width of 320 px, the page has no horizontal scroll.
- The Tab key reaches each link in reading order, and the focus is visible.
- At 200 percent browser zoom, text wraps and nothing is cut.

- [ ] **Step 7: Commit**

```bash
git add apps/website/src/pages/Landing.tsx apps/website/src/pages/Landing.test.tsx
git commit -m "feat(website): add the landing page"
```

---

### Task 4 (C3): Privacy page

**Branch:** `feat/website-pages`

**Files:**
- Create: `apps/website/src/content/privacy.ts`
- Modify: `apps/website/src/pages/Privacy.tsx` (the placeholder of Plan 3)
- Test: `apps/website/src/content/privacy.test.ts`, `apps/website/src/pages/Privacy.test.tsx`

**Interfaces:**
- Consumes: `Probe`, `PROBE`, `copyProblems`, `Links`, `LINKS` (Task 2). `renderWithTheme` (Plan 3, Task 1). The labels `Settings`, `Delete my data`, and `Delete` of the phone UI (Plan 3, Task 9).
- Produces:

```ts
// privacy.ts
export type PrivacyFacts = { geminiNoTrainingConfirmed: boolean; contactEmail: string | null; deleteBy: string };
export const PRIVACY_FACTS: PrivacyFacts;   // { geminiNoTrainingConfirmed: false, contactEmail: null, deleteBy: '30 November 2026' }
export type PrivacySection = { heading: string; lines: string[]; list?: string[]; after?: string[]; link?: { label: string; href: string } };
export type PrivacyCopy = { title: string; intro: string; sections: PrivacySection[]; footer: string };
export function privacyCopy(probe: Probe, facts: PrivacyFacts, links: Links): PrivacyCopy;
export function privacyText(copy: PrivacyCopy): string[];   // each string of the copy, for the copy guard
```

`Privacy.tsx` exports `function Privacy(props: { probe?: Probe; facts?: PrivacyFacts; links?: Links })`. The props default to `PROBE`, `PRIVACY_FACTS`, and `LINKS`. The router of Plan 3 renders it with no props at `/privacy`.

- [ ] **Step 1: Write the failing tests**

`privacy.test.ts`:

```ts
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
```

`Privacy.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { renderWithTheme as render } from '../test/render';
import { Privacy } from './Privacy';

it('shows the title as the only level 1 heading, and one level 2 heading for each section', () => {
  render(<Privacy />);
  expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Privacy']);
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(11);
});
it('shows the steps that delete the data, and the link for a person with no app', () => {
  render(<Privacy facts={{ geminiNoTrainingConfirmed: false, contactEmail: null, deleteBy: '30 November 2026' }} />);
  expect(screen.getByText('Tap "Delete my data".')).toBeTruthy();
  expect(screen.getByRole('link', { name: /Open an issue on GitHub/ }).getAttribute('href')).toBe('https://github.com/mrBymax/glance/issues');
});
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace apps/website -- src/content/privacy src/pages/Privacy`
Expected: FAIL, because `privacy.ts` does not exist.

- [ ] **Step 3: Implement `privacy.ts` from this table**

`title`: Privacy. `intro`: Meta Glance is a hackathon prototype. This page says what data it uses, where the data goes, and how you delete it. `footer`: Meta Glance is a hackathon prototype by a team at Junction 2026. It is not a product of Meta.

A slash separates two entries. A cell with no key holds `lines` only.

| Section | Exact text |
|---|---|
| What you agree to | `lines`: Glance asks before each step. `list`: You link your glasses in the Meta AI app. / You allow the camera in the Meta AI app. / You start each session. The voice says "Camera on". / You confirm each product before it enters the cart. / You confirm each payment. |
| Camera frames | The camera runs from the start of a session to its end. / The phone picks at most two frames each second. / The phone pixelates faces and crops each frame. If that step fails, the phone drops the frame. / The phone sends each frame to the Glance server over TLS. / The server holds a frame in memory for one recognition call. It never writes a frame to a disk, a database, or a log. / The server sends the frame to the paid tier of the Google Gemini API for that call. / Only if `geminiNoTrainingConfirmed`: Google states that it does not use paid tier data to train its models. / Face detection is best effort at this image size. A frame can still show a person in the background. |
| Audio | `glasses`: No raw audio leaves the glasses. The glasses turn your speech into text, and the app gets the text. `phone`: A microphone button on the phone starts the speech service of Android. That service turns your speech into text and can send audio to its provider. `none`: Glance does not use a microphone. / Always: The voice of Glance plays speech clips. ElevenLabs makes each clip from the text of the line. |
| What the server stores | Your session: the cart and your preferences. / Your order, after a demo payment. / Speech clips with product names and prices. They hold no voice of yours. / The server stores no name, no account, and no camera frame. / The team deletes all sessions and orders by `deleteBy`. |
| Who gets data | Google gets one camera frame for each recognition call. / ElevenLabs gets the text of each spoken line. / MongoDB Atlas holds the sessions and the orders. / Vultr runs the server in Stockholm. / Glance sells no data. |
| People near you | The capture LED on the glasses stays on while the camera runs. Glance cannot turn it off. / The voice says "Camera on" and "Camera off". / Glance does not identify people. It looks for one product in your hand. / If a person objects, end the session. / In a store pilot, the store shows a notice at the entrance. |
| Camera time | You start and stop each session. / The camera also stops after 3 minutes with no product and no checkout code in view. / The camera stops after each payment. |
| Payment | The payment is a demo. No money moves, and Glance asks for no card. / Your yes is consent. It is not proof of who you are. |
| Known gap | Each purchase is deliberate, but the camera runs for the whole session. / The Meta guidance for glasses apps says: "Deliberate, not ambient." / Glance does not meet that guidance yet. A product needs a wake signal on the glasses, so that the camera runs only for a glance. |
| Delete your data | `lines`: During a session, you can delete your data in the app. `list`: Open Glance on your phone. / Tap "Settings". / Tap "Delete my data". / Tap "Delete" to confirm. `after`: Glance then deletes your session, your cart, and your order from the server. / With `contactEmail`: After a session, send the order number from your receipt to `contactEmail`. Without it: After a session, open an issue on GitHub with the order number from your receipt. / In each case, the team deletes all sessions and orders by `deleteBy`. `link` with `contactEmail`: the label `Write to <contactEmail>` and the address `mailto:<contactEmail>`. `link` without it: the label `Open an issue on GitHub` and the address `<repoUrl>/issues`. |
| This website | This website sets no cookie and runs no analytics. / The demo video plays from YouTube. YouTube can set cookies when you start the video. |

Sources: spec section 13 for each topic. The Meta developer terms require the deletion text (`docs/research/2026-11-13-context-and-prior-art.md`, Meta policy for DAT apps, terms 5.5 and 6.1). The LED line and the quote have the sources `led` and `metaUse` of Task 2.

- [ ] **Step 4: Implement `Privacy.tsx`**

Run the CLI lookup of Task 3 Step 1 for each component that you use. Keep the named export `Privacy` and the outer `VStack` with `as="main"`, with the column width of the landing page. Render `title` as the one `Heading` of `level={1}`, then `intro`. Render each section as a `Heading` of `level={2}`, its `lines` as paragraphs, its `list` as an ordered `List`, its `after` as paragraphs, and its `link` as a `Link`. Render `footer` last.

- [ ] **Step 5: Run the tests, the typecheck, and the build**

Run: `npm test --workspace apps/website -- src/content/privacy src/pages/Privacy`, then `npm run typecheck --workspace apps/website`, then `npm run build --workspace apps/website`
Expected: PASS, no type error, and a finished build.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/content/privacy.ts apps/website/src/content/privacy.test.ts apps/website/src/pages/Privacy.tsx apps/website/src/pages/Privacy.test.tsx
git commit -m "feat(website): add the privacy page"
```

---

### Task 5 (C3): Run sheet for the demo and the shoot

**Branch:** `docs/demo-run-sheet`

**Files:**
- Create: `docs/demo/run-sheet.md`

**Interfaces:**
- Consumes: the item IDs of `numbers.json` (Task 2).
- Produces: `docs/demo/run-sheet.md`, the one page that the team follows at the demo table and at the shoot.

- [ ] **Step 1: Write the file with this content**

````markdown
# Demo and shoot run sheet

Owner: seat 4. Sources: sections 15, 17, and 18 of `docs/superpowers/specs/2026-11-13-meta-glance-design.md`.

## Times (Finnish time)

| Time | Step |
|---|---|
| Saturday 13:00 | M1: a glance speaks on the real glasses. Without M1 at 14:00, only extras 1 to 3 stay. |
| Saturday 17:00 | M2: the core works end to end, with the kiosk. |
| Saturday 18:00 | Feature freeze. The shoot starts. |
| Saturday 18:00 to 21:00 | Shoot the demo store at the venue first. Then shoot plain footage in a real store before it closes. |
| Sunday 02:00 | The video cut, the website, and the deck are done. |
| Sunday 07:00 | Submit. |
| Sunday 08:00 | Team deadline. |

## Demo store

- A table or a shelf with the products of `apps/server/catalog/catalog.json`. One shelf is low, for the put-back.
- The kiosk page on a laptop at seated eye height. The store name is Demo Market. The code is 15 cm wide or more.
- The mirror page on a second screen. Viewers hear and read the voice there.
- A phone hotspot for the phone and the kiosk laptop, if the venue network fails.

## Before each take

1. Charge the glasses. One charge gives about 30 minutes of stream. Keep the case near.
2. Make sure that Developer Mode is on in the Meta AI app. An update can turn it off.
3. Open the kiosk page at `/kiosk` of the site. Make sure that it shows its code.
4. Start a new session on the phone. On the second screen, open `https://<domain>/mirror?latest=<DEMO_KEY>` and press Start mirror. The page follows the newest session of the phone. `DEMO_KEY` is in `infra/.env` on the server (Plan 1 Task 22).
5. Make sure that the capture LED is in the frame of the video camera.
6. Do three clean runs in a row before the first take.

## Main take (about 90 seconds)

Prices and totals follow the catalog. The lines below use the example values of the design.

| Step | Action | The voice says | Check |
|---|---|---|---|
| 1 | Start the session on the phone. | "Camera on. Hold a product up to hear its price." | The capture LED is on. |
| 2 | Hold the oat drink up. Put it back on the low shelf. | "Oat drink, one litre, one eighty-nine. Nod to add." | The cart does not change. |
| 3 | Hold the rye bread up. Nod. | "Added rye bread. Total two sixty." | The mirror page shows one item. |
| 4 | Hold a third product up. Shake your head. | "Skipped." | With the allergen guard, the warning comes first. |
| 5 | Show the phone to the camera. | | The captions and the cart are on the screen. |
| 6 | Look at the kiosk code. Nod after the prompt. | "Checkout 3 at Demo Market. One item, two euros sixty. Nod to pay." Then: "Paid. Two euros sixty. Your receipt is on your phone. Camera off." | The kiosk shows "Paid". The LED goes dark. |

## Separate shots

Each shot uses real hardware.

1. Take the glasses off the face. The phone names the state. Then fold the glasses. The phone names the state. A fold ends the session, so the shot ends there.
2. If extra 3 is done: hold up the two look-alike products. The voice says: "I cannot tell which oat drink this is. Turn the front to me."
3. If extra 4 is done: add the HUD clip from the Display simulator. Label it "Simulation".

## Fallbacks

- The glasses fail: use mock mode with the phone camera. Label the shot "Simulation".
- The kiosk fails: use a screen recording of the kiosk.
- The venue network fails: use the phone hotspot.

## Lines for the pitch

Say each line:

- The payment is a demo.
- The catalog has 12 products.
- Blind and low-vision shoppers have not tested Glance yet. The next step is a test with the Finnish Federation of the Visually Impaired. If a blind or low-vision person tests Glance on Saturday, show that test and change this line.
- The camera runs for the whole session. A product needs a wake signal on the glasses.

Do not say:

- The store installs nothing.
- The store lends glasses.

## Numbers to measure

Each result goes into `apps/website/src/content/numbers.json`, with the test conditions in `context`. Do not write an estimate.

| ID in `numbers.json` | Measure | Method | Seat | Target |
|---|---|---|---|---|
| `accuracy-correct`, `accuracy-wrong` | Recognition on 100 frames over all products | Put the frames in `apps/server/testdata/frames/<product ID>/`. Run `npm run replay --workspace apps/server -- --frames testdata/frames`. Read the lines `accuracy:` and `wrong identified:`. | 2 | No wrong `identified` |
| `latency-median`, `latency-p95` | Time from glance to voice at the venue | Film 20 glances with the sound of the mirror page. In the video editor, read the time from the product at rest to the first sound of the line. Sort the 20 values. The median is the mean of values 10 and 11. The 95th percentile is value 19. | 4 | None. The design estimates 2 to 4 seconds. |
| `false-yes`, `false-no` | Walk test | Plan 2 Task 8: two people, 7.5 minutes each, walk, talk, look at shelves, and do 10 put-backs on a low shelf, with no nod and no shake. Each nod that the detector reports is a false yes. Each shake is a false no. | 1 | 0 and 0 |
| `battery` | Battery after 10 minutes | Plan 2 Task 4: the 10 minute endurance run of the probe. Read the battery level at the start and at the end. | 1 | None |
| `kiosk-distance` | Distance at which the kiosk code decodes | Plan 2 Task 4: the largest distance with a decode, measured from a chair. | 1 | 1.5 m or more |
| Pitch only | Nod on five heads | Five people nod after a prompt, five times each. Count the accepted nods. | 1 | None |

## Glasses log

One charge gives about 30 minutes of stream. Write each use here. Charge the glasses in each break.

| From | To | Who | Purpose | Battery at start | Battery at end |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

## After the event

- Seat 2 deletes all sessions and orders by 30 November 2026. The privacy page states this date.
````

- [ ] **Step 2: Check the file**

Run at the repository root:

```bash
node -e "const t=require('fs').readFileSync(process.argv[1],'utf8');const m=t.match(/[\u2010-\u2015\u2018-\u201F\u2026\u2190-\u21FF\u2212\u00D7]/g);console.log(m?'banned: '+[...new Set(m)].join(' '):'clean')" docs/demo/run-sheet.md
```

Expected: `clean`. Then check by eye:

- Each of the six steps of the main take in spec section 18 has a row.
- Each number of spec section 15 has a row, and each ID exists in `numbers.json`.
- If the probe changed the main yes (spec section 16), the lines of steps 2, 3, 4, and 6 name the new input.

- [ ] **Step 3: Commit**

```bash
git add docs/demo/run-sheet.md
git commit -m "docs(demo): add the run sheet for the demo and the shoot"
```

---

### Task 6 (Extra 4): HUD project, state, and feeds

**Branch:** `feat/display-hud`, shared by Tasks 6 and 7.

**Files:**
- Create with the toolkit script: `apps/display-pow/index.html`, `apps/display-pow/package.json`, `apps/display-pow/tsconfig.json`, `apps/display-pow/vite.config.ts`
- Modify: `apps/display-pow/package.json` (whole file), `apps/display-pow/index.html` (the title), `package-lock.json`
- Create: `apps/display-pow/src/hudState.ts`, `apps/display-pow/src/feed.ts`, `apps/display-pow/src/recordings/mainTake.json`
- Test: `apps/display-pow/src/hudState.test.ts`, `apps/display-pow/src/feed.test.ts`
- Delete: `apps/display-pow/.gitkeep`

**Interfaces:**
- Consumes from `@glance/shared` (Plan 0): `ServerEvent`, `parseServerEvent`, `SessionSnapshot`, `SessionSnapshotSchema`, `Cart`, `EMPTY_CART`, `ProductRef`, `Warning`, `WebIntentRequest`, `formatEur`, `cartTotalCents`. The tests also use `DEFAULT_PROFILE`.
- Produces:

```ts
// hudState.ts
export type PendingProduct = { promptId: string; mode: 'new' | 'inCart'; product: ProductRef; warnings: Warning[]; qtyInCart: number };
export type HudState = { cameraOn: boolean; pending: PendingProduct | null; cart: Cart; caption: string | null };
export const INITIAL_HUD_STATE: HudState;   // { cameraOn: false, pending: null, cart: EMPTY_CART, caption: null }
export function reduceHud(state: HudState, event: ServerEvent): HudState;
export function hudFromSnapshot(snapshot: SessionSnapshot): HudState;
export type HudView = {
  cameraLabel: 'Camera on' | 'Camera off'; title: string; price: string | null; warnings: string[]; prompt: string;
  total: string; caption: string | null; canAnswer: boolean; yesTitle: 'Add'; noTitle: 'Skip' | 'Remove';
};
export function hudView(state: HudState): HudView;
export function mockAnswer(state: HudState, kind: 'yes' | 'no'): ServerEvent[];   // recorded mode only

// feed.ts
export type FeedParams = { mode: 'recorded' } | { mode: 'live'; sessionId: string; token: string; apiBase: string };
export function readFeedParams(search: string): FeedParams;   // s, t, and api are the query names
export type LiveUrls = { snapshot: string; events: string; intents: string };
export function liveUrls(apiBase: string, sessionId: string, token: string): LiveUrls;
export function decodeEventData(data: string): ServerEvent | null;
export type Timed<T> = { afterMs: number; event: T };   // the same form as Timed<T> of the website (Plan 3, Task 6)
export function parseRecording(input: unknown): Timed<ServerEvent>[];
export const RESTART_PAUSE_MS = 4000;
export function playRecording(steps: readonly Timed<ServerEvent>[], handlers: { onEvent: (event: ServerEvent) => void; onRestart: () => void }): () => void;
export function openLive(urls: LiveUrls, handlers: { onSnapshot: (snapshot: SessionSnapshot) => void; onEvent: (event: ServerEvent) => void }): () => void;
export function postIntent(url: string, request: WebIntentRequest): Promise<boolean>;
```

- [ ] **Step 1: Create the project with the toolkit script**

Run at the repository root:

```bash
node skills/mrbd-ui-toolkit/library/wearables-ui-toolkit-web/scripts/init-app.mjs apps/display-pow
git rm apps/display-pow/.gitkeep
```

Expected: `UI Toolkit application shell initialized.` and four new files. Do not change `vite.config.ts` or `tsconfig.json`.

- [ ] **Step 2: Replace `package.json`, set the title, and install**

Do not commit the generated `package.json`. It pins `vite` 8.0.16 with `@vitejs/plugin-react` 5.1.2, and `npm install` then fails with `ERESOLVE` for each seat. It also pins `react` 19.2.7, which can give the workspace two copies of React. The toolkit accepts `react` `^19.2.7`. The new file has no `license` key, because the license of the repository applies. It keeps each other dependency of the generated file. Replace the whole file:

```json
{
  "name": "@glance/display-pow",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@glance/shared": "*",
    "@wearables-ui-toolkit/mrbd": "^130.33.0",
    "@wearables-ui-toolkit/androidx-shapes": "^130.33.0",
    "@wearables-ui-toolkit/icons": "^130.33.0",
    "react": "^19.3.1",
    "react-dom": "^19.3.1",
    "react-router-dom": "^7.18.2"
  },
  "devDependencies": {
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.3.0",
    "typescript": "^6.0.3",
    "vite": "^8.3.8",
    "vitest": "^5.1.0"
  }
}
```

In `index.html`, change the text of `<title>` to `Glance HUD`. Then run at the repository root:

```bash
npm install
npm ls react
```

Expected: no `ERESOLVE` error. `npm ls react` shows one `react` version, and no line says `invalid`. If `package-lock.json` has a merge conflict later, take the version of `main` and run `npm install` again.

- [ ] **Step 3: Write the failing tests for `hudState`**

`hudState.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ServerEvent, SessionSnapshot } from '@glance/shared';
import { DEFAULT_PROFILE } from '@glance/shared';
import { INITIAL_HUD_STATE, hudFromSnapshot, hudView, mockAnswer, reduceHud } from './hudState';

const oat = { id: 'oat-drink-1l', name: 'Oat drink', packSize: '1 L', priceCents: 189 };
const rye = { id: 'rye-bread', name: 'Rye bread', packSize: '500 g', priceCents: 260 };
const ryeCart = { items: [{ productId: 'rye-bread', name: 'Rye bread', packSize: '500 g', qty: 1, unitPriceCents: 260 }], totalCents: 260 };
const cameraOn: ServerEvent = { type: 'session.state', phase: 'shopping', cameraOn: true };
const pending = (promptId: string, product = oat, extra: object = {}): ServerEvent =>
  ({ type: 'glance.pending', promptId, kind: 'new', product, warnings: [], qtyInCart: 0, ...extra });
const run = (...events: ServerEvent[]) => events.reduce(reduceHud, INITIAL_HUD_STATE);

describe('hudView', () => {
  it('starts with the camera off and no answer', () => {
    expect(hudView(INITIAL_HUD_STATE)).toEqual({
      cameraLabel: 'Camera off', title: 'No product in view', price: null, warnings: [], prompt: 'Start the camera on your phone.',
      total: '0.00 EUR, 0 items', caption: null, canAnswer: false, yesTitle: 'Add', noTitle: 'Skip' });
  });
  it('shows the idle text while the camera runs', () => {
    expect(hudView(run(cameraOn))).toMatchObject({
      cameraLabel: 'Camera on', title: 'No product in view', prompt: 'Hold a product up to hear its price.', canAnswer: false });
  });
  it('shows the pending product with price, warning, and prompt', () => {
    const view = hudView(run(cameraOn, pending('p-1', oat, { warnings: [{ kind: 'allergen', allergens: ['gluten', 'milk'] }] })));
    expect(view).toMatchObject({ title: 'Oat drink, 1 L', price: '1.89 EUR', warnings: ['Warning: contains gluten, milk.'],
      prompt: 'Add to cart?', canAnswer: true, noTitle: 'Skip' });
  });
  it('names missing allergen data and a diet warning', () => {
    const view = hudView(run(cameraOn, pending('p-1', oat, { warnings: [{ kind: 'allergenDataMissing' }, { kind: 'diet', diet: 'vegan' }] })));
    expect(view.warnings).toEqual(['Allergen data is missing for this product.', 'Warning: not vegan.']);
  });
  it('offers Remove for a product that is in the cart', () => {
    const view = hudView(run(cameraOn, pending('p-1', rye, { kind: 'inCart', qtyInCart: 1 })));
    expect(view).toMatchObject({ prompt: '1 in your cart. Add another?', noTitle: 'Remove' });
  });
  it('shows the total, the item count, and the last caption', () => {
    const caption: ServerEvent = { type: 'caption', id: 'c-1', text: 'Added rye bread. Total two sixty.', lang: 'en', priority: 'normal', url: null };
    expect(hudView(run({ type: 'cart.updated', cart: ryeCart, change: null }, caption))).toMatchObject({
      total: '2.60 EUR, 1 item', caption: 'Added rye bread. Total two sixty.' });
  });
});

describe('reduceHud', () => {
  it('lets a newer product replace the pending product', () => {
    expect(run(cameraOn, pending('p-1'), pending('p-2', rye)).pending?.promptId).toBe('p-2');
  });
  it('ignores a clear for an older prompt', () => {
    expect(run(cameraOn, pending('p-1'), pending('p-2', rye), { type: 'glance.cleared', promptId: 'p-1' }).pending?.promptId).toBe('p-2');
  });
  it('clears the product on a clear, an unknown product, a checkout, and a stopped camera', () => {
    const base = run(cameraOn, pending('p-1'));
    const offered: ServerEvent = { type: 'checkout.offered', promptId: 'p-9', kiosk: { id: 'kiosk-1', name: 'Checkout 3', store: 'Demo Market' },
      totalCents: 260, itemCount: 1, needsBiometric: false };
    for (const event of [{ type: 'glance.cleared', promptId: 'p-1' }, { type: 'glance.unknown' }, offered,
      { type: 'session.state', phase: 'resting', cameraOn: false }] as ServerEvent[]) {
      expect(reduceHud(base, event).pending).toBeNull();
    }
  });
  it('builds the same state from a snapshot', () => {
    const snapshot: SessionSnapshot = { sessionId: 's-1', phase: 'shopping', cameraOn: true,
      prompt: { promptId: 'p-1', kind: 'product', mode: 'inCart', product: rye, warnings: [], qtyInCart: 1 },
      cart: ryeCart, profile: DEFAULT_PROFILE, kiosk: null, lastReceipt: null,
      captions: [{ id: 'c-1', text: 'Camera on.', lang: 'en', priority: 'normal', url: null }] };
    expect(hudFromSnapshot(snapshot)).toEqual({ cameraOn: true,
      pending: { promptId: 'p-1', mode: 'inCart', product: rye, warnings: [], qtyInCart: 1 }, cart: ryeCart, caption: 'Camera on.' });
  });
});

describe('mockAnswer', () => {
  it('adds one unit of the pending product and clears the prompt', () => {
    const state = run(cameraOn, { type: 'cart.updated', cart: ryeCart, change: null }, pending('p-2'));
    const events = mockAnswer(state, 'yes');
    expect(events.map((e) => e.type)).toEqual(['glance.cleared', 'cart.updated', 'caption']);
    expect(hudView(events.reduce(reduceHud, state))).toMatchObject({
      total: '4.49 EUR, 2 items', caption: 'Added: Oat drink. Total 4.49 EUR.', canAnswer: false });
  });
  it('skips a new product with no cart change', () => {
    const events = mockAnswer(run(cameraOn, pending('p-1')), 'no');
    expect(events.map((e) => e.type)).toEqual(['glance.cleared', 'caption']);
  });
  it('removes one unit when the answer is no for a product in the cart', () => {
    const state = run(cameraOn, { type: 'cart.updated', cart: ryeCart, change: null }, pending('p-3', rye, { kind: 'inCart', qtyInCart: 1 }));
    expect(hudView(mockAnswer(state, 'no').reduce(reduceHud, state))).toMatchObject({
      total: '0.00 EUR, 0 items', caption: 'Removed: Rye bread. Total 0.00 EUR.' });
  });
  it('returns nothing when no product is pending', () => {
    expect(mockAnswer(run(cameraOn), 'yes')).toEqual([]);
  });
});
```

- [ ] **Step 4: Write the recording and the failing tests for `feed`**

`recordings/mainTake.json`. It holds what the camera and the voice do. The answers come from the buttons.

```json
[
  { "afterMs": 1000, "event": { "type": "session.state", "phase": "shopping", "cameraOn": true } },
  { "afterMs": 1200, "event": { "type": "caption", "id": "c-1", "text": "Camera on. Hold a product up to hear its price.", "lang": "en", "priority": "normal", "url": null } },
  { "afterMs": 5000, "event": { "type": "glance.pending", "promptId": "p-0001", "kind": "new", "product": { "id": "rye-bread", "name": "Rye bread", "packSize": "500 g", "priceCents": 260 }, "warnings": [], "qtyInCart": 0 } },
  { "afterMs": 5200, "event": { "type": "caption", "id": "c-2", "text": "Rye bread, five hundred grams, two sixty. Nod to add.", "lang": "en", "priority": "normal", "url": null } },
  { "afterMs": 15000, "event": { "type": "glance.pending", "promptId": "p-0002", "kind": "new", "product": { "id": "oat-drink-1l", "name": "Oat drink", "packSize": "1 L", "priceCents": 189 }, "warnings": [{ "kind": "allergen", "allergens": ["gluten"] }], "qtyInCart": 0 } },
  { "afterMs": 15200, "event": { "type": "caption", "id": "c-3", "text": "Oat drink, one litre, one eighty-nine. Warning: contains gluten.", "lang": "en", "priority": "normal", "url": null } },
  { "afterMs": 25000, "event": { "type": "glance.unknown" } },
  { "afterMs": 25200, "event": { "type": "caption", "id": "c-4", "text": "I do not know this product.", "lang": "en", "priority": "normal", "url": null } },
  { "afterMs": 31000, "event": { "type": "session.state", "phase": "resting", "cameraOn": false } },
  { "afterMs": 31200, "event": { "type": "caption", "id": "c-5", "text": "Camera off.", "lang": "en", "priority": "normal", "url": null } }
]
```

`feed.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerEvent } from '@glance/shared';
import { RESTART_PAUSE_MS, decodeEventData, liveUrls, parseRecording, playRecording, readFeedParams } from './feed';
import mainTake from './recordings/mainTake.json';

const cameraOn: ServerEvent = { type: 'session.state', phase: 'shopping', cameraOn: true };

describe('feed parameters', () => {
  it('reads a live session from the query string', () => {
    expect(readFeedParams('?s=abc&t=xyz')).toEqual({ mode: 'live', sessionId: 'abc', token: 'xyz', apiBase: '' });
  });
  it('reads the origin of the server, with no slash at the end', () => {
    expect(readFeedParams('?s=abc&t=xyz&api=http://localhost:8080/')).toMatchObject({ apiBase: 'http://localhost:8080' });
    expect(readFeedParams('?s=abc&t=xyz&api=/')).toMatchObject({ apiBase: '' });
  });
  it('uses the recording when the session or the token is missing', () => {
    expect(readFeedParams('')).toEqual({ mode: 'recorded' });
    expect(readFeedParams('?s=abc')).toEqual({ mode: 'recorded' });
    expect(readFeedParams('?s=&t=xyz')).toEqual({ mode: 'recorded' });
  });
  it('builds the three URLs of a session, with the token in the query string', () => {
    expect(liveUrls('', 'abc', 't 1')).toEqual({
      snapshot: '/api/sessions/abc?token=t%201',
      events: '/api/sessions/abc/events?token=t%201',
      intents: '/api/sessions/abc/intents?token=t%201' });
  });
});

describe('server-sent data', () => {
  it('decodes a known event', () => {
    expect(decodeEventData(JSON.stringify(cameraOn))).toEqual(cameraOn);
  });
  it('ignores data that is not JSON, and an event type that it does not know', () => {
    expect(decodeEventData('{')).toBeNull();
    expect(decodeEventData('{"type":"glance.exploded"}')).toBeNull();
  });
});

describe('recording', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });
  const steps = [{ afterMs: 100, event: cameraOn }, { afterMs: 300, event: { type: 'glance.unknown' } as ServerEvent }];

  it('accepts the committed recording', () => {
    expect(parseRecording(mainTake).map((s) => s.event.type).slice(0, 3)).toEqual(['session.state', 'caption', 'glance.pending']);
  });
  it('rejects an empty list, an unknown event, and steps out of time order, and names the step', () => {
    expect(() => parseRecording([])).toThrow();
    expect(() => parseRecording([{ afterMs: 0, event: { type: 'glance.exploded' } }])).toThrow(/step 0/);
    expect(() => parseRecording([{ afterMs: 300, event: cameraOn }, { afterMs: 100, event: cameraOn }])).toThrow(/step 1/);
  });
  it('plays each step at its time, then starts again after the pause', () => {
    const onEvent = vi.fn();
    const onRestart = vi.fn();
    playRecording(steps, { onEvent, onRestart });
    vi.advanceTimersByTime(100);
    expect(onEvent).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(200);
    expect(onEvent).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(RESTART_PAUSE_MS);
    expect(onRestart).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100);
    expect(onEvent).toHaveBeenCalledTimes(3);
  });
  it('plays no step after a stop', () => {
    const onEvent = vi.fn();
    const stop = playRecording(steps, { onEvent, onRestart: vi.fn() });
    vi.advanceTimersByTime(100);
    stop();
    vi.advanceTimersByTime(10000);
    expect(onEvent).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 5: Run the tests and make sure they fail**

Run: `npm test --workspace apps/display-pow`
Expected: FAIL, because `hudState.ts` and `feed.ts` do not exist.

- [ ] **Step 6: Implement `hudState.ts`**

`reduceHud`:

| Event | Change |
|---|---|
| `session.state` | Set `cameraOn`. If it is false, set `pending` to null. |
| `glance.pending` | Set `pending` from the event. The field `kind` of the event becomes `mode`. |
| `glance.cleared` | Set `pending` to null only if `promptId` equals the ID of the pending product. |
| `glance.unknown`, `glance.ambiguous`, `checkout.offered`, `checkout.paid` | Set `pending` to null. |
| `cart.updated` | Set `cart`. |
| `caption` | Set `caption` to `text`. |
| `error` | Set `caption` to `message`. |
| each other event | No change. |

`hudFromSnapshot`: `pending` comes from `prompt` if its `kind` is `product`, and is null if not. `caption` is the text of the last entry of `captions`, or null.

`hudView`: the tests fix each string. The item count is the sum of `qty`. A warning line is `Warning: contains <allergens joined with ", ">.`, `Warning: not <diet>.`, or `Allergen data is missing for this product.`

`mockAnswer` plays the server in recorded mode, so it computes the total with `cartTotalCents`. A live session never calls it. Yes adds one unit of the pending product. No on mode `new` changes no cart. No on mode `inCart` removes one unit, and removes the line at 0. The events have the order of the server (Plan 1 Task 4): `glance.cleared`, then for a cart change one `cart.updated` whose `change` names the kind, the product ID, and the name, then one `caption`. The caption has the ID `mock-<promptId>-<kind>`, the language `en`, the priority `normal`, and no URL. The caption text is `Added: <name>. Total <total> EUR.`, `Removed: <name>. Total <total> EUR.`, or `Skipped.`

- [ ] **Step 7: Implement `feed.ts`**

- `readFeedParams` returns live mode only if `s` and `t` are both present and not empty. `apiBase` is the value of `api` with no slash at its end, or the empty text for the same origin. The mirror page and the session query of Plan 3 use the names `s` and `t`.
- `liveUrls` encodes the session ID and the token with `encodeURIComponent`. The paths come from spec section 8.1 and Plan 0 Task 5.
- `decodeEventData` returns `parseServerEvent(JSON.parse(data))`, or null if `JSON.parse` throws.
- `parseRecording` throws an `Error` with the text `step <index>` for a step that `parseServerEvent` rejects, or whose `afterMs` is lower than the step before it. It also throws for input that is not a list, and for an empty list.
- `playRecording` sets one timer for each step. After the last step it waits `RESTART_PAUSE_MS`, calls `onRestart`, and plays again. The function that it returns clears each timer.
- `openLive` opens one `EventSource` on `urls.events`. On each `open` event it fetches `urls.snapshot`, parses the body with `SessionSnapshotSchema`, and calls `onSnapshot`. A reconnect then gets a fresh state. On each `message` event it calls `decodeEventData`, and `onEvent` if the result is not null. The function that it returns closes the `EventSource`.
- `postIntent` sends the request as JSON with `POST` and returns `response.ok`. It returns false if `fetch` rejects.

Plan 1 Task 10 fixes the stream: each message is `data: <json>` with one `ServerEvent`, and the server sends the CORS header `access-control-allow-origin: *`. A web client opens the stream first and then gets the snapshot, so no event is lost. An intent gets the answer 204, and its result arrives as events.

- [ ] **Step 8: Run the tests and the typecheck**

Run: `npm test --workspace apps/display-pow`, then `npm run typecheck --workspace apps/display-pow`
Expected: PASS, and no type error. If `tsc` rejects an option of the generated `tsconfig.json` under TypeScript 6, set `typescript` to `5.9.3` for this workspace only, which is the version of the toolkit shell, and run `npm install` again.

- [ ] **Step 9: Commit**

```bash
git add apps/display-pow package-lock.json
git commit -m "feat(display-pow): add the HUD project, state, and feeds"
```

---

### Task 7 (Extra 4): HUD screen, verification, and the simulator clip

**Branch:** `feat/display-hud`

**Files:**
- Create: `apps/display-pow/src/main.tsx`, `apps/display-pow/src/HudPage.tsx`, `apps/display-pow/src/app.css`, `apps/display-pow/src/vite-env.d.ts`

**Interfaces:**
- Consumes: each export of `hudState.ts` and `feed.ts` (Task 6). From `@wearables-ui-toolkit/mrbd`: `App`, `Page`, `ScrollView`, `Panel`, `TextView`, `TextStyle`, `TextColor`, `Button`, `ButtonRail`, `Toast`.
- Produces: the HUD at `/` (recorded mode) and at `/?s=<sessionId>&t=<token>&api=<origin of the server>` (live mode). The build output `apps/display-pow/dist` for the deployment of Plan 1. A WebM clip for the video.

- [ ] **Step 1: Load the toolkit skill and read only these references**

Load the `mrbd-ui-toolkit` skill. Read `skills/mrbd-ui-toolkit/library/wearables-ui-toolkit-web/GUIDE.md`. Its status-action pattern does not fit: that pattern allows one button, one boolean state, and no `useEffect`, and this screen has two actions and an event feed. So the guide sends you to its foundation set. Read these five files in `skills/mrbd-ui-toolkit/library/` and no other toolkit file:

- `uit-screen-architecture-web/references/route-skeletons.md`
- `uit-navigation-focus-web/references/navigation-components.md`
- `uit-accessibility-testing-web/references/validation-playbook.md`
- `uit-actions-web/references/action-components.md`
- `uit-surfaces-media-web/references/surface-media-components.md`

- [ ] **Step 2: Use this route ledger**

| Item | Decision |
|---|---|
| Top-level surface | One `Page`. `headerText` is `Glance`. `headerMetadata` is the camera status. No router, no second route. |
| Vertical owner | One `ScrollView` with `insetForHeader`, `tabIndex={0}`, and `ariaLabel="Glance status"`. |
| Content | Static text in one `Panel` with `width="100%"`, a direct child of the `ScrollView`, with one `content-inset` wrapper. No `ListItem`. |
| Actions | One `ButtonRail` in the bottom dock, outside the `ScrollView`, with the two `Button` elements. |
| Focus | The two buttons stay mounted. With no pending product they are disabled. A disabled toolkit button stays in the focus order. |
| Empty branch | Camera off, and no product in view. `hudView` gives the text. |
| Icons | None. |

- [ ] **Step 3: Write the four source files in one batch**

`main.tsx` imports `App` from the toolkit as `UITApp`, imports `./app.css`, and renders `<UITApp><HudPage /></UITApp>` into `#root` with `createRoot`.

`vite-env.d.ts` holds one line: `/// <reference types="vite/client" />`. It gives TypeScript the type of the CSS import.

`HudPage.tsx` renders this tree from `const view = hudView(state)`:

```tsx
<Page headerText="Glance" headerMetadata={view.cameraLabel} enableSystemBarInset={false}>
  <div className="action-page-shell">
    <ScrollView insetForHeader tabIndex={0} ariaLabel="Glance status">
      <Panel width="100%">
        <div className="content-inset">
          <TextView as="p" textStyle={TextStyle.LABEL} textColor={TextColor.SECONDARY}>PRODUCT</TextView>
          <TextView as="h2" textStyle={TextStyle.BODY2_EMPHASIZED}>{view.title}</TextView>
          {view.price && <TextView as="p" textStyle={TextStyle.BODY2_EMPHASIZED}>{view.price}</TextView>}
          {view.warnings.map((line) => <TextView key={line} as="p" textStyle={TextStyle.BODY2}>{line}</TextView>)}
          <TextView as="p" textStyle={TextStyle.BODY2}>{view.prompt}</TextView>
          <TextView as="p" textStyle={TextStyle.LABEL} textColor={TextColor.SECONDARY}>TOTAL</TextView>
          <TextView as="p" textStyle={TextStyle.META1}>{view.total}</TextView>
          <TextView as="p" textStyle={TextStyle.LABEL} textColor={TextColor.SECONDARY}>{captionLabel}</TextView>
          {view.caption && <TextView as="p" textStyle={TextStyle.META1}>{view.caption}</TextView>}
        </div>
      </Panel>
    </ScrollView>
    <div className="action-dock">
      <ButtonRail>
        <Button title={view.yesTitle} disabled={!view.canAnswer} onClick={() => answer('yes')} />
        <Button title={view.noTitle} disabled={!view.canAnswer} onClick={() => answer('no')} />
      </ButtonRail>
    </div>
  </div>
</Page>
```

Behavior:

- Read the feed one time: `readFeedParams(window.location.search)`.
- Live mode: one effect calls `openLive` with `liveUrls(apiBase, sessionId, token)`. `onSnapshot` sets the state to `hudFromSnapshot`. `onEvent` applies `reduceHud`.
- Recorded mode: one effect calls `playRecording(parseRecording(mainTake), ...)`. `onEvent` applies `reduceHud`. `onRestart` sets `INITIAL_HUD_STATE`.
- The effect returns the stop function of its feed.
- `answer(kind)` does nothing with no pending product. In live mode it calls `postIntent` with the `intents` URL and `{ kind, source: 'hud', promptId }`, where `promptId` is the ID of the pending product. If the result is false, it calls `Toast.show('Not sent. Try again.')`. In recorded mode it applies each event of `mockAnswer(state, kind)`.
- `captionLabel` is `CAPTION` in live mode and `CAPTION, RECORDED` in recorded mode.

`app.css` holds these rules and no other rule:

```css
html,
body,
#root {
  inline-size: 100%;
  block-size: 100%;
  margin: 0;
  background: var(--uit-color-background-window);
}

* {
  box-sizing: border-box;
}

.action-page-shell {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  block-size: 100%;
  min-block-size: 0;
  min-inline-size: 0;
}

.action-dock {
  min-inline-size: 0;
  padding-block-end: var(--uit-spacing-xsmall);
}

.content-inset {
  display: flex;
  flex-direction: column;
  gap: var(--uit-spacing-small);
  min-inline-size: 0;
  padding: var(--uit-spacing-large);
}
```

- [ ] **Step 4: Run the completion gate of the guide**

Run each command directly at the repository root, with no pipe:

```bash
npm run typecheck --workspace apps/display-pow
node skills/mrbd-ui-toolkit/library/uit-screen-architecture-web/scripts/validate-app-structure.mjs apps/display-pow/src
npm run build --workspace apps/display-pow
npm test --workspace apps/display-pow
```

Expected: no type error, no finding of the validator, a finished build, and PASS. Treat one validator report as one repair batch: fix each finding, then run the validator one more time. For a type error, read at most the one exported type file of that component.

- [ ] **Step 5: Run the runtime audit in Chrome**

1. Run `npm run dev --workspace apps/display-pow -- --port 5175 --strictPort`. The phone UI and the website use the ports 5173 and 5174.
2. Start Chrome with the flags `--remote-debugging-port=9222` and `--user-data-dir=<a new empty folder>`. Open `http://localhost:5175/` in its one tab. Set the viewport to 600 x 600 in DevTools.
3. Run: `node skills/mrbd-ui-toolkit/library/uit-screen-architecture-web/scripts/audit-runtime.mjs http://127.0.0.1:9222`

Expected: no finding. Run it one more time while a product is pending and the focus is on a button. Validation on the glasses is not in the scope of this mockup.

- [ ] **Step 6: Check the screen in the Display simulator**

Source of these steps: the Wearables Developer Center page `webapps/test`, read through the `wearables-dat` docs server on 2026-11-14.

1. In Chrome, open `https://chromewebstore.google.com/detail/jpjlmmodokemlepklkdbimceggpbjcll` and click "Add to Chrome".
2. Open `http://localhost:5175/`. Click the extension icon in the toolbar to turn on the simulator. It shows a 600 x 600 display frame with additive blending.
3. Select a background: a built-in scene, or a photo of the demo shelf as a custom image.
4. Open the quality checklist of the simulator. Each item must pass: viewport metadata, favicon, directional-focus targets, horizontal overflow, visible focus styles.
5. Use the directional controls and Select of the simulator. The focus moves between the status region, the first button, and the second button. Select on Add changes the total while a product is pending.
6. The first settled frame shows the product block and the total with no scroll. If it does not, change the `gap` of `.content-inset` to `var(--uit-spacing-xsmall)`.

- [ ] **Step 7: Record the clip**

1. Start the viewport recorder of the simulator.
2. Wait until the recording starts again: the header shows `Camera off`, then `Camera on`.
3. Press Add on the rye bread. Press Skip on the oat drink. Let the unknown product and "Camera off" pass.
4. Stop the recorder. The simulator exports a WebM file. Name it `hud-clip.webm` and keep it with the footage, not in git.
5. In the video, label the clip "Simulation: Meta Ray-Ban Display Simulator".

- [ ] **Step 8: Check live mode with the fake server of Plan 1**

This step needs Plan 1 Task 12. If the fake server is not on `main` at the freeze, skip this step and say so in the pull request.

1. Run `npm run dev:fake --workspace apps/server` in one terminal. Run the dev server of Step 5 in a second terminal.
2. Create a session. This command prints the HUD URL:

```bash
node -e "fetch('http://localhost:8080/api/sessions',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}).then(r=>r.json()).then(j=>console.log('http://localhost:5175/?s='+j.sessionId+'&t='+j.token+'&api=http://localhost:8080'))"
```

3. Open the URL. Expected: the header shows `Camera on`, and the caption label is `CAPTION`. After about 3 seconds the oat drink of the fake script is pending. Add changes the total to `1.89 EUR, 1 item`.

The deployment of Plan 1 (Task 22) serves `apps/display-pow/dist` at `https://hud.<domain>/`. The server of the API is another origin there, so a live link is `https://hud.<domain>/?<session query>&api=https://<domain>`. The debug panel of the phone UI in a browser shows the session query (Plan 3, Task 14).

- [ ] **Step 9: Commit**

```bash
git add apps/display-pow
git commit -m "feat(display-pow): add the HUD screen"
```

---

### Task 8 (C3): Late content and the publish check

**Branch:** `chore/website-late-content`

**Files:**
- Modify: `apps/website/src/content/numbers.json`, `apps/website/src/content/landing.ts` (`LINKS`, `TEAM`, `CATALOG_SIZE`), `apps/website/src/content/probe.ts` (`PROBE`), `apps/website/src/content/privacy.ts` (`PRIVACY_FACTS`)

**Interfaces:**
- Consumes: the measured values of `docs/demo/run-sheet.md`, the probe results of spec section 16, the APK of Plan 2, the video.
- Produces: the published pages `/` and `/privacy` with real values.

- [ ] **Step 1: Fill the values**

| Value | Where | Rule |
|---|---|---|
| Probe results | `PROBE` | The four values under "Values for seat 4" in `docs/research/2026-11-14-probe-results.md` (Plan 2, Task 4). Then update the run sheet lines (Task 5, Step 2). |
| Measured numbers | `numbers.json` | A number that the team measured, or `null`. If one value is a number, write the date, the place, and the glasses in `context`. If the replay ran on another count than 100 frames, change the unit `of 100`. Remove `false-yes` and `false-no` if head gestures do not start. |
| Product count | `CATALOG_SIZE` | The number of entries of `catalog.json`. |
| Team | `TEAM` | One entry for each person: name and role. |
| Video | `LINKS.videoId` | The ID of the YouTube video. The video has captions for each spoken line. |
| APK | `LINKS.apkUrl` | Seat 1 gives `glance-demo.apk` and its SHA-256 (Plan 2, Task 20). Publish the file with the command below. The URL is `https://github.com/mrBymax/glance/releases/download/demo-2026-11-15/glance-demo.apk`. |
| Contact | `PRIVACY_FACTS.contactEmail` | An address that the team reads, or `null`. |

```bash
gh release create demo-2026-11-15 glance-demo.apk --title "Meta Glance demo APK" --notes "Demo build. It needs Developer Mode in the Meta AI app. SHA-256: <value from seat 1>"
```

The release asset is a choice of the author, and its link works only if the repository is public. If the team hosts the APK on the server, use that URL.

- [ ] **Step 2: Check each privacy and data line against the build**

| Line | Who confirms | If it is not true |
|---|---|---|
| The phone pixelates faces, crops, and drops a frame on failure | Seat 1 | Write: "The phone crops each frame. This build does not pixelate faces." Change `data` 2 of the landing page in the same way. |
| The server stores no frame (`SAVE_FRAMES` is off) | Seat 2 | Fix the server. Do not publish. |
| Frames go over TLS, to the paid Gemini tier | Seat 2 | Fix the server. Do not publish. |
| Google does not train on paid tier data | Seat 2 reads the Gemini API terms | Leave `geminiNoTrainingConfirmed` at `false`. |
| The camera stops after 3 idle minutes and after payment | Seats 1 and 2 | Remove the line that is not true. |
| "Delete my data" in Settings deletes the session and the order | Seats 1 and 3 | Remove the four steps. Keep the path with the order number. |
| The receipt shows an order number | Seat 3 | Write "the time of your payment" in place of "the order number from your receipt". |
| The website runs no analytics | Seat 3 | Remove the line. |
| The demo server uses MongoDB Atlas, ElevenLabs, and Vultr in Stockholm | Seat 2 | Change "Who gets data" and `builtWith` to the services in use. |
| The team tested Glance on Ray-Ban Meta Gen 2 glasses | Seat 1 | Remove the first sentence of `tryNotes` 3. |

Also open each `Source:` link of the landing page one time, and make sure that it supports its sentence.

- [ ] **Step 3: Run the checks and commit**

Run: `npm test --workspace apps/website`, then `npm run build --workspace apps/website`
Expected: PASS and a finished build.

```bash
git add apps/website/src/content
git commit -m "chore(website): fill the measured numbers, the links, and the team"
```

- [ ] **Step 4: Publish, and check the public pages**

Merge the pull request. Ask seat 2 to build the static pages on the instance (Plan 1 Task 22, Step 6). Then open `https://<domain>/` and `https://<domain>/privacy` in a private window, and reload `/privacy`.
Expected: both pages load, the video plays, and the APK downloads.
