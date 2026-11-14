# Meta Glance Plan 3: Phone UI, Kiosk, and Mirror Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the three web surfaces of Meta Glance: the phone UI that the Android app shows in a WebView, the kiosk page, and the mirror page.

**Architecture:** Two Vite apps in the npm workspace. `apps/mobile/ui` is the phone UI. A pure reducer turns `NativeToPage` messages into one state object, and each action leaves through a `GlanceBridge`. `AndroidBridge` serves the WebView. `BrowserBridge` serves a desktop browser: it talks to the server and fakes the native state. `apps/website` holds the routes `/`, `/privacy`, `/kiosk`, and `/mirror`. The kiosk and the mirror read server-sent events.

**Tech Stack:** React 19, Vite 8, TypeScript 6, Astryx 0.7 with the stock Neutral theme, `react-router` 8, `qrcode`, Vitest 5 with jsdom and Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-13-meta-glance-design.md` (sections 5, 6, 8, 10, 12). The contract is Plan 0: `docs/superpowers/plans/2026-11-14-glance-0-foundation.md`.

**Scope:** Steps C2 and C3 of spec section 5 for seat 3, then extras 1, 2, 3, 5, 6, 7, 8. Plan 4 owns the content of the landing page and the privacy page, and extra 4. This plan also leaves out extra 9 and the "if time is left" list.

**Other plans:** Plan 0 comes first. Plans 1 (server), 2 (Android app), and 4 (catalog, website pages, HUD mockup) run at the same time as this plan.

| This plan needs | From | Tasks | How to work before it exists |
|---|---|---|---|
| `@glance/shared` with its fixtures | Plan 0, Tasks 1 to 5 | all | Wait for Plan 0. Do not copy its types. |
| REST paths and event streams | Plan 1, Tasks 10 and 16 | 3 (server mode), 6, 13 | Tests use a fake `fetch` and a fake `EventSource`. In a browser, `?replay=1` plays a recorded event file. After Task 12 of Plan 1, `npm run dev:fake --workspace @glance/server` gives a server on port 8080 that needs no key. |
| A WebView host with the bridge | Plan 2, Task 13 | 3 (`AndroidBridge`), 15 (TalkBack, font size) | `BrowserBridge` fakes the native state. Tests use a fake host object. |
| The intent kind `ask` | Plan 0 Task 4, added after the cross-check | 19 | Nothing. Plan 2 relays the intent, and Plan 1 Task 26 opens the question window. |
| `GET /api/demo/latest` | Plan 1 Task 17, added after the cross-check | 13 | Tests use the fake `fetch`. The flags `s` and `t` work with no demo key. |

What the other plans get from this plan:

- Plan 4: the scaffold of `apps/website` after Task 1, with the scripts `dev`, `build`, `test`, and `typecheck`.
- Plan 2: the build output `apps/mobile/ui/dist` after Task 5, from `npm run build --workspace @glance/phone-ui`. Also a dev server on port 5173 for its `UI_DEV_URL`.
- Plan 1, Task 22: the build output `apps/website/dist`, from `npm run build --workspace apps/website`.

## Global Constraints

- Node 22 or later. npm workspaces. Do not add pnpm or yarn.
- Versions on 2026-11-14: `react` and `react-dom` `^19.3.1`, `vite` `^8.3.8`, `typescript` `^6.0.3`, `vitest` `^5.1.0`, `@testing-library/react` `^16.3.3`, `@astryxdesign/core`, `@astryxdesign/theme-neutral`, and `@astryxdesign/cli` `^0.7.15`, `@stylexjs/stylex` `^0.19.2`, `qrcode` `^1.5.4`.
- More versions, read from the npm registry on 2026-11-14: `react-router` `^8.5.1`, `@vitejs/plugin-react` `^6.3.0`, `jsdom` `^31.0.1`, `@testing-library/dom` `^10.4.2`, `@testing-library/user-event` `^14.6.10`, `@testing-library/jest-dom` `^7.0.1`, `@types/react` and `@types/react-dom` `^19.3.0`, `@types/qrcode` `^1.5.6`, `@types/node` `^22`. Add no other dependency.
- Types, schemas, and helpers come from `@glance/shared`. Do not redefine a shared type. Do not change `packages/shared` in this plan.
- The phone UI has no network code outside `BrowserBridge`. A component never calls `fetch`.
- Glance tells, nod buys. The page never changes the cart by itself. It sends a message and shows the cart that the server sends.
- Money is an integer number of cents. The page shows `cart.totalCents` and never adds prices. Show an amount as `formatEur(cents)` plus ` EUR`.
- The page never says that a product is safe. It shows no price for a product that the server did not identify.
- Astryx: the stock Neutral theme. No custom theme, no `defineTheme`, no `xstyle`, no StyleX compiler, no page template. Call the tool as `npx @astryxdesign/cli`. The unscoped `astryx` package is unrelated.
- Do not hand-write a component that Astryx has. Run `npx @astryxdesign/cli component <Name>` before the first use of a component.
- Accessibility (spec section 10): touch targets of 48 px or more, and text contrast of 4.5:1 or more. Captions and cart changes use a polite live region. The layout works at 200 percent font scale. No state shows by color alone. Each spoken string also shows as text.
- Kiosk (spec section 12): the code stays on the screen in each state and is at least 15 cm wide. On a 1080p screen the total is 160 px or more and a row is 48 px or more. Query flags: `name`, `store`, `spot`, `fail`.
- The kiosk code text comes from `formatKioskCode`. The QR code uses error correction level M.
- The receipt shows the line "Demo payment. No money moved."
- UI copy: no emoji, no exclamation mark, no semicolon, no contraction, sentences of 25 words or fewer. A button names its action.
- Text in code, comments, and commit messages follows `skills/anti-slop/SKILL.md`.
- Commit messages use Conventional Commits, `type(scope): description`, with the types `feat`, `fix`, `chore`, `docs`, `test`. No Claude attribution lines.
- Work on a branch, never on `main`. Task 1 uses `chore/website-scaffold`. Each other task uses `feat/phone-ui-kiosk-mirror`.
- After Task 1, do not change `apps/website/src/pages/Landing.tsx` and `apps/website/src/pages/Privacy.tsx`. Plan 4 owns them and each file in `apps/website/src/content/`.
- Deadlines in Finnish time: feature freeze on Saturday 18:00, submission on Sunday 08:00.

## Review Focus

1. Two fast taps on Add or on Pay, or a tap on a card that just changed. The page sends one answer for each prompt, with the ID of the prompt on the screen (Tasks 5 and 8).
2. Events that arrive out of order: `glance.cleared` for an older prompt, or `checkout.suspended` after the next product prompt. The newer prompt stays on the screen (Task 4).
3. A connection that drops and returns. The page says so in text, keeps the cart and the kiosk code, and loads the snapshot again (Tasks 3, 6, and 13).
4. A message that is not JSON, or that has a `t` or `type` from a newer app or server. The page drops it and stays alive (Tasks 3 and 6).
5. Long input: a kiosk cart of 9 lines, a product name of 60 characters, a total of 1234.56 EUR, a kiosk name of 200 characters. The page shows each part in full, or it counts the rest (Tasks 5 and 6).

## Astryx

The author ran `@astryxdesign/cli` 0.7.15 in a scratch project on 2026-11-14, with jsdom 31.0.1 and headless Edge. Each fact below comes from that run: from the output of the tool, from a jsdom test, or from a measure in the browser.

Setup for Vite. Tasks 1 and 2 run these steps:

1. The app `package.json` lists `@astryxdesign/core`, `@astryxdesign/theme-neutral`, `@stylexjs/stylex`, and the dev dependency `@astryxdesign/cli`. StyleX is a peer dependency. The app uses the prebuilt CSS and needs no StyleX compiler.
2. With `tsconfig.json` in the app folder, run `npx @astryxdesign/cli init` there. It writes `AGENTS.md` and `GEMINI.md` into the app folder.
3. Run `npx @astryxdesign/cli theme add neutral`. It writes `src/astryx-themes.ts`, which imports the built theme, `theme.css`, and `fonts.css`. Do not edit that file. With no `tsconfig.json` the tool writes a `.js` file.
4. `src/styles/globals.css` imports `@astryxdesign/core/reset.css`, then `@astryxdesign/core/astryx.css`.
5. The root wraps the app in `<Theme theme={themes[defaultThemeSlug]}>`. `Theme` comes from `@astryxdesign/core/theme`. `themes` and `defaultThemeSlug` come from `./astryx-themes`.

Facts that the tasks use:

- Each component has its own import path, `@astryxdesign/core/<Name>`. Each component takes `className`, `style`, and `data-*` and `aria-*` attributes.
- Astryx CSS sits in the cascade layers `reset`, `astryx-base`, and `astryx-theme`. App CSS outside a layer wins over them.
- Control heights are the tokens `--size-element-sm`, `--size-element-md`, and `--size-element-lg`: 28, 32, and 36 px, set on `:root`. With 48, 48, and 56 px, each `Button` and each `NumberInput` measured 48 px high or more.
- A `Button` with a short label can be narrower than 48 px.
- A `SegmentedControl` segment is 8 px lower than its control. Only `size="lg"` gives a segment of 48 px.
- A `CheckboxList` row measured 40 px. With `density="spacious"` it measured 48 px, and the whole row takes the tap.
- `Switch` is 40 x 24 px, and `Slider` has a thumb of 20 px. On a touch screen Astryx grows a hit area to 44 px at most. This plan uses neither.
- Each `Button` holds its own empty `role="status"` element. Do not look for the live region with `getByRole('status')`.
- `useAnnounce` from `@astryxdesign/core/hooks` writes into `[data-astryx-live-region="polite"]`, a child of `body`. Astryx clears a message after about two seconds.
- jsdom has no `showModal` on a dialog element. With the three functions of Task 2, an open `BottomSheet` is `getByRole('dialog', { name })`, an open `AlertDialog` is `getByRole('alertdialog', { name })`, and a closed one is not found. A key press of Escape on the dialog calls `onOpenChange(false)`.
- Roles in jsdom: `SegmentedControl` is a `radiogroup` of `radio` buttons. `CheckboxList` is a `group` of `checkbox` inputs. `NumberInput` is a `spinbutton`, and with `hasClear` it has a button named `Clear <label>`. `Stepper` is a `list` with its `label` as name, and the current `Step` has `aria-current="step"`.
- `user-event` clicks and key presses reach the `onChange` handlers of these components in jsdom.
- A plain string in `label` or `description` of `ListItem` is cut to one line. Pass a `Text` element for text that must wrap.
- `Icon` takes a fixed list of names. This plan uses `microphone` only.
- `fonts.css` of the theme loads the Figtree font from Google Fonts. With no internet the system font shows.
- Not checked: `Card`, `Step` with children, and `Button` with `href` in jsdom. `BottomSheet` with `purpose="form"`. The page templates of the tool.

Components of this plan:

| Component | Use |
|---|---|
| `Theme` | App root. `mode="light"` around the kiosk, `mode="dark"` around pocket mode. |
| `VStack`, `HStack` | Layout. `as="main"` gives the main landmark. |
| `Heading`, `Text` | All text. `Heading` needs `level`. |
| `Button` | Each action. `label` is the accessible name. `children` can show a shorter text. |
| `Card` | The prompt card. |
| `Banner` | The state banner, warnings, and notices. It makes no live region. |
| `BottomSheet` | Settings, checkout and receipt, debug panel. |
| `AlertDialog` | The confirm steps for "Delete my data", "End", and "Unlock". `onAction` does not close it. |
| `Stepper`, `Step` | The three setup steps. |
| `SegmentedControl`, `SegmentedControlItem` | Each preference with 2 to 5 values. Always `size="lg"` and `layout="fill"`. |
| `CheckboxList`, `CheckboxListItem` | On and off preferences, allergens, diet. Always `density="spacious"`. |
| `NumberInput` | The budget. |
| `List`, `ListItem` | Cart lines, captions, receipt lines, kiosk lines. |
| `Icon` | The microphone on the ask button. |
| `useAnnounce` | The polite live region. |

Not used: `Switch`, `Slider`, `StatusDot` (color only), `IconButton` (no visible text), `AppShell`, and the page templates.

## Files

Phone UI, `apps/mobile/ui/src`:

| File | Responsibility | Astryx |
|---|---|---|
| `main.tsx` | Makes the bridge and mounts the app | `Theme` |
| `App.tsx` | Selects the screen | `VStack`, `Heading`, `Text` |
| `styles/touch.css` | The 48 px rules | |
| `bridge/androidBridge.ts` | `AndroidBridge`: the WebView wire format | |
| `bridge/browserBridge.ts` | `BrowserBridge`: REST, the event stream, the fake native state | |
| `bridge/fakeNative.ts` | Native states for the browser and for tests | |
| `bridge/createBridge.ts` | Picks the bridge from the host and the address | |
| `bridge/BridgeContext.tsx` | Runs the reducer, exposes `useUi` | |
| `state/uiState.ts` | `UiState`, `reduce` | |
| `state/selectors.ts` | `screenOf`, `setupStepOf` | |
| `state/banner.ts` | `bannerOf`: one banner for the states of spec section 6.6 | |
| `state/haptics.ts` | `hapticFor` | |
| `text/strings.ts` | Each UI string, in English and later in Italian | |
| `text/format.ts` | `eur`, `cartStatusLine`, `warningText` | |
| `screens/SetupScreen.tsx` | Three setup steps | `Stepper`, `Step`, `Button`, `Text` |
| `screens/SessionScreen.tsx` | Layout of the session, action row | `VStack`, `HStack`, `Heading`, `Button`, `AlertDialog` |
| `components/PromptCard.tsx` | Product, price, warnings, yes and no buttons | `Card`, `Heading`, `Text`, `Button`, `Banner` |
| `components/CaptionList.tsx` | The last spoken lines as text | `List`, `ListItem`, `Text`, `Button` |
| `components/CartList.tsx` | Cart lines and the total | `List`, `ListItem`, `Text`, `Button`, `Banner` |
| `components/StatusRow.tsx` | Glasses, battery, camera, network as words | `HStack`, `Text` |
| `components/StateBanner.tsx` | Renders the banner of `bannerOf` | `Banner`, `Button` |
| `components/CheckoutSheet.tsx` | Pay prompt and receipt | `BottomSheet`, `Heading`, `Text`, `List`, `Button`, `Banner` |
| `components/SettingsSheet.tsx` | Preferences, privacy text, delete | `BottomSheet`, `SegmentedControl`, `CheckboxList`, `NumberInput`, `AlertDialog` |
| `components/PocketMode.tsx` | Black screen with the total | `Theme`, `VStack`, `Heading`, `Text`, `Button`, `AlertDialog` |
| `components/LookAlikeNotice.tsx` | The look-alike message | `Banner`, `List` |
| `components/useSpokenText.ts` | Announces captions and cart changes | `useAnnounce` |
| `debug/fixtures.ts` | The shared fixtures as typed values | |
| `debug/demoRun.ts` | A recorded event file and its player | |
| `debug/DebugPanel.tsx` | Sends events and native states into the page | `BottomSheet`, `Button`, `Text` |
| `test/*` | Test setup, render helpers, fakes, the touch target check | |

Website, `apps/website/src`:

| File | Responsibility | Astryx |
|---|---|---|
| `main.tsx`, `App.tsx` | Router and routes | `Theme` |
| `pages/Landing.tsx`, `pages/Privacy.tsx` | Placeholders for Plan 4 | `VStack`, `Heading`, `Text` |
| `pages/NotFound.tsx` | The page for an unknown address | `VStack`, `Heading` |
| `lib/api.ts` | REST calls of the kiosk and the mirror | |
| `lib/events.ts` | Event stream and replay | |
| `lib/format.ts` | `eur` | |
| `kiosk/qr.ts`, `kiosk/KioskCode.tsx` | The QR code as SVG | |
| `kiosk/kioskModel.ts` | Flags, event parse, row limit | |
| `kiosk/KioskView.tsx` | One layout for each kiosk state | `Theme`, `HStack`, `VStack`, `Heading`, `Text`, `List`, `ListItem` |
| `kiosk/KioskPage.tsx` | Registers, listens, tries again | |
| `kiosk/kiosk.css` | The kiosk sizes | |
| `mirror/mirrorModel.ts` | Captions and cart from session events | |
| `mirror/clipQueue.ts` | Plays clips in order | |
| `mirror/MirrorPage.tsx` | Start button, captions, cart | `HStack`, `VStack`, `Heading`, `Text`, `List`, `ListItem`, `Button` |
| `kiosk/kioskRun.ts`, `mirror/mirrorRun.ts` | Recorded event files | |

## Contract gaps

Plan 0 and the spec lack these items. This plan works around each one, and a person must decide:

1. Closed after the cross-check: `IntentKind` has `ask`. Task 19 sends `{ t: 'intent', kind: 'ask' }`, Plan 2 relays it, and Plan 1 Task 26 opens the question window.
2. `PageToNative` has no message that plays a speech sample. Task 9 sends `intent` with the kind `help`, and the voice speaks the help line at the new speed.
3. Closed after the cross-check: `GET /api/demo/latest?key=<DEMO_KEY>` of Plan 1 Task 17 gives the newest live session. The mirror takes the key as `?latest=<key>` (Task 13) and follows the session of the phone.
4. `KioskEvent` with the state `spotcheck` does not name the product. The kiosk shows a general line.
5. `NativeState` has no cause for a stopped stream. Plan 2 sends the cause as an `error` event, and the page shows its message. For the regular checkout banner, Task 10 uses the numbers of `cannotStream` in Plan 1 Task 6.
6. Spec section 6.5 lists no preference for `Profile.mainYes`. Plan 2 reads it from `profile.set` (Tasks 15, 21, and 23). Task 9 adds one control for it.

## Facts from the other plans

Each task relies on these statements. If a plan changes one, change the task that names it.

- Plan 1 Task 10: each stream message is `data: <json>` with no event name. A web client opens the stream first and then gets the snapshot. `PATCH .../profile` takes a `ProfilePatch`. An intent or a cart edit answers 204, and its outcome arrives as events. The server allows each origin.
- Plan 1 Task 4: an answer with the source `phone` needs the ID of the current prompt and no `prompt.done`. An answer with no prompt ID does nothing. A no with the ID of the prompt that was just added removes that unit.
- Plan 1 Task 5: the server sends no event when a payment starts. A cart change during checkout gives a new `checkout.offered` with a new prompt ID. A later appearance of the kiosk code does the same when the head window of the old prompt is over (its rule 7a). After a payment come `checkout.paid`, `cart.updated` with an empty cart and `change: null`, and `session.state` with the phase `paid`.
- Plan 1 Task 6: a stop gives the phase `ended`, and the server then takes no more input for that session. The idle rest gives the phase `resting`.
- Plan 1 Task 15: `caption.url` is an absolute address, or `null`.
- Plan 1 Task 16: the first message of the kiosk stream is the current view. The server shows `paid` or `failed` for 10 seconds, then `idle`. A code has 4 characters. Each `POST /api/kiosks` makes a new kiosk.
- Plan 1 Task 18: the server sends `error` events with the codes `recognition.slow` and `kiosk.busy`. The server speaks "Back online.", so that line arrives as a caption.
- Plan 1 Task 22: the site host serves `apps/website/dist`, answers an unknown path with `index.html`, and serves `/api` on the same origin.
- Plan 2 Task 13: the app loads the build at the root of `https://appassets.androidplatform.net/`. A debug build can load a dev server. The text zoom follows the font size of the phone. A link to another origin opens outside the page.
- Plan 2 Task 11: the app sends each failure cause as an `error` event with a code that starts with `native.`. The page shows `message` as it is.
- Plan 2 Task 15: on `ui.ready` the app sends `native.state`, `profile`, and the snapshot of a live session. After `profile.set` it sends `profile`. After `data.delete` it sends `profile` and `native.state`.
- Plan 2 Task 19: the app vibrates only for a `haptic` message. The page draws the pocket screen.

## Task order

| Task | Step | Title | App | Needs |
|---|---|---|---|---|
| 1 | C2 | Website scaffold with Astryx and a router | website | Plan 0 |
| 2 | C2 | Phone UI scaffold and the 48 px rules | ui | Plan 0 |
| 3 | C2 | Bridges | ui | 2 |
| 4 | C2 | UI state and reducer | ui | 3 |
| 5 | C2 | Session screen | ui | 4 |
| 6 | C2 | Kiosk page | website | 1 |
| 7 | C3 | Setup screen | ui | 5 |
| 8 | C3 | Checkout sheet and receipt | ui | 5 |
| 9 | C3 | Settings sheet | ui | 5 |
| 10 | C3 | State banner and status row | ui | 7 |
| 11 | C3 | A phone button for each action, and haptics | ui | 10 |
| 12 | C3 | Pocket mode | ui | 11 |
| 13 | C3 | Mirror page | website | 6 |
| 14 | C3 | Debug panel | ui | 10 |
| 15 | C3 | Accessibility checks of spec section 10 | ui | 7 to 14 |
| 16 | Extra 1 | Allergen and diet settings, and the warning on the card | ui | 9 |
| 17 | Extra 2 | Budget setting and the warning | ui | 9 |
| 18 | Extra 3 | Look-alike message | ui | 5 |
| 19 | Extra 5 | Microphone button for a question | ui | 11 |
| 20 | Extra 6 | Fingerprint state at checkout | ui | 8 |
| 21 | Extra 7 | Language switch | ui | 9 |
| 22 | Extra 8 | Spot check on the kiosk and on the phone | both | 5, 6 |

- Task 1 goes into its own pull request first. Plan 4 waits for it.
- Two agents can work at the same time: one on the website tasks, one on the ui tasks.
- Targets for Saturday: Tasks 1 to 6 merged by 11:00, Tasks 7 to 15 by 16:00. The server and the Android app need the spine for milestone M2 at 17:00.
- Cut rules of spec section 5: if a glance does not speak on the glasses by 14:00, cut Tasks 19 to 22. At 18:00, cut each task that is not merged.

Commands for each task:

- One test file: `npm test --workspace @glance/phone-ui -- <name>` or `npm test --workspace @glance/website -- <name>`. The name is a part of the file path.
- All checks of one app: `npm test --workspace <name>` and `npm run typecheck --workspace <name>`.
- Dev servers: `npm run dev --workspace @glance/phone-ui` on port 5173, `npm run dev --workspace @glance/website` on port 5174.

Query flags for development:

| Page | Flag | Effect |
|---|---|---|
| phone UI | `replay=1` | Plays the recorded demo run (Task 5) |
| phone UI | `ready=1` | Starts with glasses linked and the camera allowed (Task 3) |
| phone UI | `api=<origin>` | Uses a server. `api=/` means the same origin, through the dev proxy (Task 3) |
| phone UI | `native=<key>` | Starts in one native state of spec section 6.6 (Task 10) |
| phone UI | `debug=1` | Shows the debug panel inside the WebView (Task 14) |
| kiosk, mirror | `replay=1` | Plays a recorded event file, with no server (Tasks 6 and 13) |
| mirror | `s=<sessionId>&t=<token>` | Selects the session (Task 13). The HUD of Plan 4 uses the same two names. |
| mirror | `latest=<DEMO_KEY>` | Follows the newest session of the phone (Task 13). The HUD of Plan 4 has no such flag. |

---

### Task 1 (C2): Website scaffold with Astryx and a router

**Files:**
- Create: `apps/website/package.json`, `apps/website/tsconfig.json`, `apps/website/vite.config.ts`, `apps/website/index.html`
- Create: `apps/website/src/main.tsx`, `apps/website/src/App.tsx`, `apps/website/src/styles/globals.css`
- Create: `apps/website/src/pages/Landing.tsx`, `apps/website/src/pages/Privacy.tsx`, `apps/website/src/pages/NotFound.tsx`
- Create: `apps/website/src/kiosk/KioskPage.tsx`, `apps/website/src/mirror/MirrorPage.tsx` (one heading each, until Tasks 6 and 13)
- Create: `apps/website/src/test/setup.ts`, `apps/website/src/test/render.tsx`
- Generated: `apps/website/AGENTS.md`, `apps/website/GEMINI.md`, `apps/website/src/astryx-themes.ts`
- Delete: `apps/website/.gitkeep`
- Test: `apps/website/src/App.test.tsx`

**Interfaces:**
- Consumes: the workspace root of Plan 0.
- Produces:
  - `App(): JSX.Element` with the routes `/`, `/privacy`, `/kiosk`, `/mirror`, and `*`.
  - The named exports `Landing`, `Privacy`, `NotFound`, `KioskPage`, and `MirrorPage`. Each page renders one `main` element with exactly one `h1`.
  - `renderWithTheme(ui: ReactElement): RenderResult` in `src/test/render.tsx`.
  - The scripts `dev`, `build`, `test`, and `typecheck`. The dev server uses port 5174 and sends `/api` to `GLANCE_SERVER_ORIGIN`, default `http://localhost:8080`.
  - For Plan 4: keep the two export names, the outer `main` element, and the single `h1`. `App.test.tsx` checks both pages.

- [ ] **Step 1: Create the branch and the package files**

```bash
git switch -c chore/website-scaffold
git rm apps/website/.gitkeep
```

`apps/website/package.json`:

```json
{
  "name": "@glance/website",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@astryxdesign/core": "^0.7.15",
    "@astryxdesign/theme-neutral": "^0.7.15",
    "@glance/shared": "*",
    "@stylexjs/stylex": "^0.19.2",
    "qrcode": "^1.5.4",
    "react": "^19.3.1",
    "react-dom": "^19.3.1",
    "react-router": "^8.5.1"
  },
  "devDependencies": {
    "@astryxdesign/cli": "^0.7.15",
    "@testing-library/dom": "^10.4.2",
    "@testing-library/jest-dom": "^7.0.1",
    "@testing-library/react": "^16.3.3",
    "@testing-library/user-event": "^14.6.10",
    "@types/node": "^22",
    "@types/qrcode": "^1.5.6",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "^6.3.0",
    "jsdom": "^31.0.1",
    "typescript": "^6.0.3",
    "vite": "^8.3.8",
    "vitest": "^5.1.0"
  }
}
```

`build` runs no typecheck, so that a type error in a test file cannot stop the deployment of Plan 1.

`apps/website/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client", "node"]
  },
  "include": ["src", "vite.config.ts"]
}
```

`apps/website/vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: { '/api': { target: process.env.GLANCE_SERVER_ORIGIN ?? 'http://localhost:8080', changeOrigin: true } },
  },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], css: false },
});
```

`apps/website/index.html`: `lang="en"`, the title `Meta Glance`, the viewport `width=device-width, initial-scale=1, viewport-fit=cover`, one `<div id="root">`, and the module script `/src/main.tsx`.

- [ ] **Step 2: Install, then run the Astryx setup**

```bash
npm install
cd apps/website
npx @astryxdesign/cli init
npx @astryxdesign/cli theme add neutral
cd ../..
```

Expected: `init` prints `AI agent docs installed -> AGENTS.md, GEMINI.md`. `theme add` prints `modulePath: src/astryx-themes.ts`.

Add this part to the end of `apps/website/AGENTS.md`, after the line `<!-- ASTRYX:END -->`:

```md
## Glance rules

These rules win over the Astryx block above.

- Use no page template and no `xstyle`. This app has no StyleX compiler.
- Keep the px, vh, cm, and hex values of the CSS files and of the QR code. They come from the design spec.
- Plans: `docs/superpowers/plans/2026-11-14-glance-3-phone-ui-kiosk-mirror.md` and `2026-11-14-glance-4-website-hud.md`.
```

`src/styles/globals.css`:

```css
@import '@astryxdesign/core/reset.css';
@import '@astryxdesign/core/astryx.css';
```

- [ ] **Step 3: Write the test setup and the failing test**

`src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());
```

`src/test/render.tsx` exports `renderWithTheme`. It renders `ui` inside `<Theme theme={themes[defaultThemeSlug]}>`.

`src/App.test.tsx`:

```tsx
const renderAt = (address: string) =>
  renderWithTheme(<MemoryRouter initialEntries={[address]}><App /></MemoryRouter>);

it.each(['/', '/privacy', '/kiosk?replay=1', '/mirror?replay=1'])('renders one main heading at %s', (address) => {
  renderAt(address);
  expect(screen.getAllByRole('main')).toHaveLength(1);
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
});
it('names an address that has no page', () => {
  renderAt('/nope');
  expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
});
```

- [ ] **Step 4: Run the test and make sure it fails**

Run: `npm test --workspace @glance/website`
Expected: FAIL, because `./App` does not exist.

- [ ] **Step 5: Implement `main.tsx`, `App.tsx`, and the five pages**

- `main.tsx` imports `./styles/globals.css` and renders `<Theme><BrowserRouter><App /></BrowserRouter></Theme>`. `BrowserRouter`, `Routes`, `Route`, and `MemoryRouter` come from `react-router`.
- Do not use `StrictMode`. The kiosk page registers in an effect, and `StrictMode` would register two kiosks in development.
- Each page is `<VStack as="main" padding={6} gap={4}>` with one `<Heading level={1}>`. The headings are `Meta Glance`, `Privacy`, `Page not found`, `Kiosk`, and `Mirror`.

- [ ] **Step 6: Run all checks**

Run: `npm test --workspace @glance/website` and `npm run typecheck --workspace @glance/website`
Expected: 5 tests pass, and the typecheck prints no error.

- [ ] **Step 7: Check the pages in a browser**

Run: `npm run dev --workspace @glance/website`, then open `http://localhost:5174/`, `/privacy`, `/kiosk`, `/mirror`, and `/nope`.
Expected: each address shows its heading in the Figtree font, and a reload of `/kiosk` shows the kiosk heading again.

- [ ] **Step 8: Commit and open the pull request**

```bash
git add package-lock.json apps/website
git commit -m "chore(website): scaffold the website with Astryx and a router"
```

Open a pull request for this branch alone, and tell seat 4 when it is merged. Then start the branch for the other tasks from `main`: `git switch -c feat/phone-ui-kiosk-mirror`.

---

### Task 2 (C2): Phone UI scaffold and the 48 px rules

**Files:**
- Create: `apps/mobile/ui/package.json`, `apps/mobile/ui/tsconfig.json`, `apps/mobile/ui/vite.config.ts`, `apps/mobile/ui/index.html`
- Create: `apps/mobile/ui/src/main.tsx`, `apps/mobile/ui/src/App.tsx`, `apps/mobile/ui/src/styles/globals.css`, `apps/mobile/ui/src/styles/touch.css`
- Create: `apps/mobile/ui/src/test/setup.ts`, `apps/mobile/ui/src/test/render.tsx`, `apps/mobile/ui/src/test/touchTargets.ts`
- Generated: `apps/mobile/ui/AGENTS.md`, `apps/mobile/ui/GEMINI.md`, `apps/mobile/ui/src/astryx-themes.ts`
- Test: `apps/mobile/ui/src/styles/touch.test.ts`, `apps/mobile/ui/src/test/touchTargets.test.tsx`

**Interfaces:**
- Consumes: the workspace root of Plan 0.
- Produces:
  - The package `@glance/phone-ui` with the scripts `dev`, `build`, `test`, and `typecheck`. The build output is `apps/mobile/ui/dist`, with relative asset paths.
  - `renderWithTheme(ui: ReactElement): RenderResult`.
  - `uncoveredTouchTargets(root: HTMLElement): string[]`. It returns one text for each control that no 48 px rule covers, in the form `<role> "<name>"`.

- [ ] **Step 1: Create the package files and run the Astryx setup**

- `package.json`: the file of Task 1 with the name `@glance/phone-ui`, and without `qrcode`, `react-router`, and `@types/qrcode`.
- `tsconfig.json`: the file of Task 1 with `"extends": "../../../tsconfig.base.json"`.
- `vite.config.ts`: the file of Task 1 with `base: './'`, and with `server: { host: true, port: 5173, strictPort: true, proxy: ... }`. The relative base lets the Android app load the build from each asset path. `host: true` lets the phone reach the dev server.
- `index.html`: as in Task 1, with the title `Glance`. Do not turn off zoom in the viewport.
- Run `npm install`, then in `apps/mobile/ui` run `npx @astryxdesign/cli init` and `npx @astryxdesign/cli theme add neutral`. Expected output: as in Task 1.
- Add the "Glance rules" part of Task 1 to `apps/mobile/ui/AGENTS.md`, with this plan as the one plan.

`src/styles/touch.css`:

```css
/* Astryx controls are 28, 32, and 36 px high. Spec section 10 requires touch targets of 48 px or more. */
:root {
  --size-element-sm: 48px;
  --size-element-md: 48px;
  --size-element-lg: 56px;
}
.astryx-button {
  min-inline-size: 48px;
}
```

`src/styles/globals.css` imports `reset.css`, `astryx.css`, and then `./touch.css`.

`src/test/setup.ts` is the file of Task 1 plus these lines:

```ts
// jsdom 31 has no showModal, show, or close on a dialog element. BottomSheet and AlertDialog call them.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.show = function show() { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}
```

- [ ] **Step 2: Write the failing tests**

`src/styles/touch.test.ts`:

```ts
const css = readFileSync('src/styles/touch.css', 'utf8');

it('raises the Astryx control heights to 48 px or more', () => {
  expect(css).toMatch(/--size-element-sm:\s*48px/);
  expect(css).toMatch(/--size-element-md:\s*48px/);
  expect(css).toMatch(/--size-element-lg:\s*56px/);
  expect(css).toMatch(/\.astryx-button\s*\{[^}]*min-inline-size:\s*48px/);
});
```

`src/test/touchTargets.test.tsx` (`noop` is `() => {}`):

```tsx
it('accepts the controls that a 48 px rule covers', () => {
  const { container } = renderWithTheme(<>
    <Button label="Add" />
    <SegmentedControl label="Voice detail" size="lg" value="a" onChange={noop}>
      <SegmentedControlItem value="a" label="A" /><SegmentedControlItem value="b" label="B" />
    </SegmentedControl>
    <CheckboxList label="Feedback" density="spacious" value={[]} onChange={noop}>
      <CheckboxListItem value="haptics" label="Haptics" />
    </CheckboxList>
    <NumberInput label="Budget" value={20} onChange={noop} hasClear />
  </>);
  expect(uncoveredTouchTargets(container)).toEqual([]);
});
it('reports each control that no rule covers', () => {
  const { container } = renderWithTheme(<>
    <button type="button">Raw</button>
    <SegmentedControl label="Voice detail" value="a" onChange={noop}>
      <SegmentedControlItem value="a" label="A" /><SegmentedControlItem value="b" label="B" />
    </SegmentedControl>
    <Switch label="Haptics" value onChange={noop} />
    <CheckboxList label="Feedback" value={[]} onChange={noop}>
      <CheckboxListItem value="x" label="X" />
    </CheckboxList>
  </>);
  expect(uncoveredTouchTargets(container)).toEqual(['button "Raw"', 'radio "A"', 'radio "B"', 'switch "Haptics"', 'checkbox "X"']);
});
```

- [ ] **Step 3: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/phone-ui`
Expected: FAIL, because `touchTargets.ts` does not exist.

- [ ] **Step 4: Implement `uncoveredTouchTargets`, `renderWithTheme`, and a first `App`**

`uncoveredTouchTargets` looks at each `a[href]`, `button`, `input`, `select`, `textarea`, and each element with the role `button`, `link`, `radio`, `checkbox`, `switch`, `slider`, or `tab`. It skips an element inside a `dialog` with no `open` attribute, inside `[aria-hidden="true"]`, or inside `[popover]`. A control is covered in these four cases only:

1. It has the class `astryx-button`.
2. It has the class `astryx-segmented-control-item` and `data-size="lg"`.
3. It is an `input` of type `checkbox` inside `li.astryx-list-item[data-density="spacious"]`.
4. It is an `input` inside `.astryx-number-input`.

The role in the text is the `role` attribute, or `checkbox` for a checkbox input, or the tag name. The name is `aria-label`, or the text of the first label of the control, or its own text.

`App` renders `<VStack as="main" padding={4} gap={4}>` with `<Heading level={1}>Glance</Heading>` and `<Button label="Add" variant="primary" />`. `main.tsx` mounts it inside `Theme`, with no `StrictMode`.

- [ ] **Step 5: Run all checks**

Run: `npm test --workspace @glance/phone-ui` and `npm run typecheck --workspace @glance/phone-ui`
Expected: 3 tests pass, and the typecheck prints no error.

- [ ] **Step 6: Measure in a browser**

Run: `npm run dev --workspace @glance/phone-ui`, open `http://localhost:5173/`, and run this in the console:

```js
[...document.querySelectorAll('.astryx-button')].map((b) => b.getBoundingClientRect()).every((r) => r.width >= 48 && r.height >= 48)
```

Expected: `true`. jsdom has no layout, so this step is the one that measures.

- [ ] **Step 7: Commit**

```bash
git add package-lock.json apps/mobile/ui
git commit -m "chore(ui): scaffold the phone UI with Astryx and the 48 px rules"
```

---

### Task 3 (C2): Bridges

**Files:**
- Create: `apps/mobile/ui/src/bridge/androidBridge.ts`, `browserBridge.ts`, `fakeNative.ts`, `createBridge.ts` (same folder)
- Create: `apps/mobile/ui/src/debug/fixtures.ts`, `apps/mobile/ui/src/test/fakes.ts`
- Modify: `apps/mobile/ui/src/main.tsx`
- Test: `apps/mobile/ui/src/bridge/androidBridge.test.ts`, `browserBridge.test.ts`, `createBridge.test.ts`

**Interfaces:**
- Consumes from `@glance/shared`: `GlanceBridge`, `PageToNative`, `NativeToPage`, `NativeState`, `parseNativeToPage`, `ServerEvent`, `parseServerEvent`, `SessionSnapshot`, `SessionSnapshotSchema`, `CreateSessionResponseSchema`, `Profile`, `DEFAULT_PROFILE`, `EMPTY_CART`, and the fixture folders `events`, `bridge-native-to-page`, and `rest`.
- Produces:

```ts
// bridge/fakeNative.ts
export const NATIVE_NEW: NativeState;     // nothing linked yet
export const NATIVE_READY: NativeState;   // linked, camera allowed, glasses connected

// bridge/androidBridge.ts
export type NativeHost = {
  GlanceNative?: { postMessage(json: string): void };
  __glanceReceive?: (json: string) => void;
};
export class AndroidBridge implements GlanceBridge {
  constructor(host: NativeHost);            // sets host.__glanceReceive
  send(message: PageToNative): void;
  subscribe(listener: (message: NativeToPage) => void): () => void;
}

// bridge/browserBridge.ts
export type EventSourceLike = {
  addEventListener(type: 'open' | 'message' | 'error', listener: (event: { data?: unknown }) => void): void;
  close(): void;
};
export type BrowserBridgeOptions = {
  apiBase: string | null;                   // null: no server, no network call
  nativeState?: NativeState;                // start state, default NATIVE_NEW
  fetch?: typeof fetch;
  createEventSource?: (url: string) => EventSourceLike;   // default: new EventSource(url)
};
export class BrowserBridge implements GlanceBridge {
  constructor(options: BrowserBridgeOptions);
  send(message: PageToNative): void;
  subscribe(listener: (message: NativeToPage) => void): () => void;
  inject(message: NativeToPage): void;      // delivers a message to the page, for tests and the debug panel
  readonly sent: readonly PageToNative[];   // each message of the page, oldest first
  sessionQuery(): string | null;            // 's=<sessionId>&t=<token>' while a server session exists
}

// bridge/createBridge.ts
export function createBridge(host: NativeHost, search: string): GlanceBridge;

// debug/fixtures.ts
export const EVENT_TYPES: ServerEvent['type'][];   // the 16 types
export function eventFixture<K extends ServerEvent['type']>(type: K): Extract<ServerEvent, { type: K }>;
export function eventMessage<K extends ServerEvent['type']>(type: K, change?: Partial<Extract<ServerEvent, { type: K }>>): NativeToPage;
export const SNAPSHOT: SessionSnapshot;            // from bridge-native-to-page/snapshot.json

// test/fakes.ts
export type FakeSource = EventSourceLike & { url: string; closed: boolean; emit(type: 'open' | 'message' | 'error', data?: string): void };
export function fakeSources(): { create(url: string): FakeSource; sources: FakeSource[] };
export function fakeFetch(answer: (method: string, url: string, body: unknown) => { status?: number; json?: unknown }):
  { fetch: typeof fetch; calls: { method: string; url: string; body: unknown }[] };   // a throw in `answer` rejects the call
```

`androidBridge.ts` also adds the two members of `NativeHost` to the global `Window` type, so that `window` is a `NativeHost`.

Values of `NATIVE_NEW`: `metaAiInstalled: true`, `registration: 'available'`, `cameraPermission: 'unknown'`, `device: null`, `session: 'idle'`, `stream: 'stopped'`, `network: 'online'`, each capability `true`, `mock: true`.

`NATIVE_READY` changes three fields: `registration: 'registered'`, `cameraPermission: 'granted'`, and `device: { name: 'Mock glasses', link: 'connected', battery: 80, worn: true, hingeOpen: true, thermal: 0, updateRequired: false }`.

`debug/fixtures.ts` imports each JSON file with a static import, parses it with the shared parse helper, and throws at load time if a fixture does not parse.

What `BrowserBridge` does for each message of the page:

| Message | With a server | Fake native state |
|---|---|---|
| `ui.ready` | | Sends `native.state`, then `profile`, to the page |
| `setup.register` | | `registration: 'registered'`, `device` of `NATIVE_READY` |
| `setup.requestCamera` | | `cameraPermission: 'granted'` |
| `setup.openUpdate`, `pocket.set`, `haptic` | | No change |
| `session.start` | With no session: `POST /api/sessions` with `{ profile }`, then the stream `/api/sessions/:id/events` | `session: 'started'`, `stream: 'streaming'`. With no server it sends a snapshot with `sessionId: 'offline'`, the phase `shopping`, and an empty cart. |
| `intent` | `POST /api/sessions/:id/intents` with `{ kind, source: 'phone', promptId }` | |
| `cart.edit` | `POST /api/sessions/:id/cart` with `{ productId, qty }` | |
| `profile.set` | `PATCH /api/sessions/:id/profile` with the patch, if a session exists | Merges the patch and sends `profile` |
| `session.end` | `POST .../intents` with `{ kind: 'stop', source: 'phone' }` | `session: 'stopped'`, `stream: 'stopped'` |
| `data.delete` | `DELETE /api/sessions/:id`, then it closes the stream and forgets the session | `session: 'idle'`, `stream: 'stopped'` |

More rules of `BrowserBridge`:

- Each call after `POST /api/sessions` carries `?token=<token>`. Encode the ID and the token with `encodeURIComponent`.
- The bridge opens the stream first. At each `open` of the stream it sets `network: 'online'`, gets `GET /api/sessions/:id`, and sends the snapshot to the page.
- A stream message goes through `JSON.parse` and `parseServerEvent`. A message that fails is dropped.
- A `session.state` event sets the fake `stream` to `streaming` or `stopped` from `cameraOn`. With the phase `paid` or `ended`, the bridge also closes the stream and forgets the session.
- A stream `error` sets `network: 'offline'`.
- A call that rejects sets `network: 'offline'`. A response status of 400 or more logs one line with `console.warn`: `bridge: <method> <path> failed with <status>`.
- `AndroidBridge` runs each incoming text through `JSON.parse` and `parseNativeToPage`, and drops what fails.

`createBridge`: with `host.GlanceNative` it returns an `AndroidBridge`. If not, it returns a `BrowserBridge`. The flag `api` gives `apiBase` (`/` means an empty base, and no flag means `null`). The flag `ready` selects `NATIVE_READY`.

- [ ] **Step 1: Write the failing tests**

`androidBridge.test.ts` (`nativeStateJson` is `bridge-native-to-page/native.state.json`):

```ts
const setup = () => {
  const posted: string[] = [];
  const host: NativeHost = { GlanceNative: { postMessage: (json) => posted.push(json) } };
  const bridge = new AndroidBridge(host);
  const seen: NativeToPage[] = [];
  const leave = bridge.subscribe((message) => seen.push(message));
  return { host, posted, bridge, seen, leave };
};

it('posts each message to the app as JSON', () => {
  const { bridge, posted } = setup();
  bridge.send({ t: 'intent', kind: 'yes', promptId: 'p-0001' });
  expect(posted.map((json) => JSON.parse(json))).toEqual([{ t: 'intent', kind: 'yes', promptId: 'p-0001' }]);
});
it('delivers a message of the app to the listener', () => {
  const { host, seen } = setup();
  host.__glanceReceive?.(JSON.stringify(nativeStateJson));
  expect(seen).toEqual([parseNativeToPage(nativeStateJson)]);
});
it('drops text that is not JSON and a message with an unknown t', () => {
  const { host, seen } = setup();
  expect(() => host.__glanceReceive?.('{not json')).not.toThrow();
  host.__glanceReceive?.(JSON.stringify({ t: 'future.message' }));
  expect(seen).toEqual([]);
});
it('stops delivery when the listener leaves', () => {
  const { host, seen, leave } = setup();
  leave();
  host.__glanceReceive?.(JSON.stringify(nativeStateJson));
  expect(seen).toEqual([]);
});
```

`browserBridge.test.ts`. Helpers:

- `created` is `rest/CreateSessionResponse.json`. `path` is `/api/sessions/<encoded sessionId>`. `q` is `?token=<encoded token>`.
- `offline()` makes a bridge with `apiBase: null` and one listener. It returns `{ bridge, seen }`.
- `online()` makes a bridge with `apiBase: ''`, a `fakeFetch` that answers `created` for the `POST` and `SNAPSHOT` for the `GET`, and `fakeSources`. It returns `{ bridge, seen, http, sources }`.
- `started()` calls `online()`, sends `session.start`, waits for the first source, emits `open` on it, and waits for the `GET`.
- `lastNative(seen)` is the state of the last `native.state` message.

```ts
it('answers ui.ready with the native state and the profile', () => {
  const { bridge, seen } = offline();
  bridge.send({ t: 'ui.ready' });
  expect(seen).toEqual([{ t: 'native.state', state: NATIVE_NEW }, { t: 'profile', profile: DEFAULT_PROFILE }]);
});
it('fakes the link step and the camera permission', () => {
  const { bridge, seen } = offline();
  bridge.send({ t: 'setup.register' });
  bridge.send({ t: 'setup.requestCamera' });
  expect(lastNative(seen)).toEqual(NATIVE_READY);
});
it('starts a session with no server and no network call', () => {
  const { bridge, seen } = offline();
  bridge.send({ t: 'session.start' });
  expect(lastNative(seen)).toMatchObject({ session: 'started', stream: 'streaming' });
  expect(seen.at(-1)).toMatchObject({ t: 'snapshot', session: { sessionId: 'offline', phase: 'shopping', cart: EMPTY_CART } });
});
it('creates a session, opens the event stream, and loads the snapshot', async () => {
  const { bridge, seen, http, sources } = await started();
  expect(http.calls.map((call) => `${call.method} ${call.url}`)).toEqual(['POST /api/sessions', `GET ${path}${q}`]);
  expect(sources.sources[0]?.url).toBe(`${path}/events${q}`);
  expect(seen).toContainEqual({ t: 'snapshot', session: SNAPSHOT });
  expect(bridge.sessionQuery()).toBe(`s=${encodeURIComponent(created.sessionId)}&t=${encodeURIComponent(created.token)}`);
});
it('relays each event of the stream and drops what it cannot parse', async () => {
  const { seen, sources } = await started();
  sources.sources[0]?.emit('message', JSON.stringify(eventFixture('glance.pending')));
  sources.sources[0]?.emit('message', 'not json');
  sources.sources[0]?.emit('message', JSON.stringify({ type: 'glance.exploded' }));
  expect(seen.filter((message) => message.t === 'event')).toEqual([{ t: 'event', event: eventFixture('glance.pending') }]);
});
it('sends each action of the page to its path', async () => {
  const { bridge, http } = await started();
  bridge.send({ t: 'intent', kind: 'yes', promptId: 'p-0001' });
  bridge.send({ t: 'cart.edit', productId: 'oat-drink-1l', qty: 0 });
  bridge.send({ t: 'profile.set', patch: { detail: 'brief' } });
  bridge.send({ t: 'session.end' });
  await vi.waitFor(() => expect(http.calls).toHaveLength(6));
  expect(http.calls.slice(2)).toEqual([
    { method: 'POST', url: `${path}/intents${q}`, body: { kind: 'yes', source: 'phone', promptId: 'p-0001' } },
    { method: 'POST', url: `${path}/cart${q}`, body: { productId: 'oat-drink-1l', qty: 0 } },
    { method: 'PATCH', url: `${path}/profile${q}`, body: { detail: 'brief' } },
    { method: 'POST', url: `${path}/intents${q}`, body: { kind: 'stop', source: 'phone' } },
  ]);
});
it('deletes the session and forgets it', async () => {
  const { bridge, http, sources } = await started();
  bridge.send({ t: 'data.delete' });
  await vi.waitFor(() => expect(http.calls.at(-1)).toMatchObject({ method: 'DELETE', url: `${path}${q}` }));
  expect(sources.sources[0]?.closed).toBe(true);
  expect(bridge.sessionQuery()).toBeNull();
});
it('follows the camera state of the server and forgets a session that ended', async () => {
  const { bridge, seen, sources } = await started();
  sources.sources[0]?.emit('message', JSON.stringify({ type: 'session.state', phase: 'ended', cameraOn: false }));
  expect(lastNative(seen)).toMatchObject({ stream: 'stopped' });
  expect(sources.sources[0]?.closed).toBe(true);
  expect(bridge.sessionQuery()).toBeNull();
});
it('says offline while the stream is lost, then loads the snapshot again', async () => {
  const { seen, http, sources } = await started();
  sources.sources[0]?.emit('error');
  expect(lastNative(seen)?.network).toBe('offline');
  sources.sources[0]?.emit('open');
  await vi.waitFor(() => expect(http.calls.filter((call) => call.method === 'GET')).toHaveLength(2));
  expect(lastNative(seen)?.network).toBe('online');
});
it('says offline when the server does not answer', async () => {
  const http = fakeFetch(() => { throw new Error('down'); });
  const bridge = new BrowserBridge({ apiBase: '', fetch: http.fetch, createEventSource: fakeSources().create });
  const seen: NativeToPage[] = [];
  bridge.subscribe((message) => seen.push(message));
  bridge.send({ t: 'session.start' });
  await vi.waitFor(() => expect(lastNative(seen)).toMatchObject({ network: 'offline', session: 'idle' }));
});
it('keeps each sent message and delivers an injected one', () => {
  const { bridge, seen } = offline();
  bridge.send({ t: 'haptic', pattern: 'added' });
  bridge.inject({ t: 'profile', profile: DEFAULT_PROFILE });
  expect(bridge.sent).toEqual([{ t: 'haptic', pattern: 'added' }]);
  expect(seen).toEqual([{ t: 'profile', profile: DEFAULT_PROFILE }]);
});
```

`createBridge.test.ts`:

```ts
it('uses the app bridge inside the WebView', () => {
  expect(createBridge({ GlanceNative: { postMessage() {} } }, '')).toBeInstanceOf(AndroidBridge);
});
it('uses the browser bridge elsewhere, and reads the ready flag', () => {
  const bridge = createBridge({}, '?ready=1');
  expect(bridge).toBeInstanceOf(BrowserBridge);
  const seen: NativeToPage[] = [];
  bridge.subscribe((message) => seen.push(message));
  bridge.send({ t: 'ui.ready' });
  expect(seen[0]).toEqual({ t: 'native.state', state: NATIVE_READY });
});
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/phone-ui -- bridge`
Expected: FAIL, because the modules do not exist.

- [ ] **Step 3: Implement the four bridge modules, `fixtures.ts`, and `fakes.ts`**

`main.tsx` calls `createBridge(window, location.search)`. In development only (`import.meta.env.DEV`), it also stores the bridge as `window.glanceBridge`.

- [ ] **Step 4: Run all checks**

Run: `npm test --workspace @glance/phone-ui` and `npm run typecheck --workspace @glance/phone-ui`
Expected: PASS, and no type error.

- [ ] **Step 5: Try the bridge in a browser console**

Open `http://localhost:5173/`. In the console, subscribe `console.log` with `glanceBridge.subscribe`, then send `{ t: 'ui.ready' }` with `glanceBridge.send`.
Expected: the console prints one `native.state` message and one `profile` message. This task has no screen. Task 5 shows the bridge at work.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/ui
git commit -m "feat(ui): add the Android bridge and the browser bridge"
```

---

### Task 4 (C2): UI state and reducer

**Files:**
- Create: `apps/mobile/ui/src/state/uiState.ts`
- Test: `apps/mobile/ui/src/state/uiState.test.ts`

**Interfaces:**
- Consumes: `eventFixture`, `eventMessage`, `EVENT_TYPES`, `SNAPSHOT`, `NATIVE_READY` (Task 3). From `@glance/shared`: `NativeToPage`, `NativeState`, `Profile`, `ProfilePatch`, `DEFAULT_PROFILE`, `Phase`, `CurrentPrompt`, `ProductRef`, `Cart`, `EMPTY_CART`, `Caption`, `Receipt`.
- Produces:

```ts
export type UiState = {
  native: NativeState | null;      // null until the app sends the first native.state
  profile: Profile;
  sessionId: string | null;        // null until the first snapshot
  phase: Phase | null;
  prompt: CurrentPrompt | null;    // the product card or the pay prompt
  lookAlikes: ProductRef[] | null; // extra 3
  spotCheck: ProductRef | null;    // extra 8
  cart: Cart;
  cartSeq: number;                 // +1 for each cart.updated with a change. It drives the announcement.
  captions: Caption[];             // oldest first, at most MAX_CAPTIONS
  receipt: Receipt | null;
  checkout: 'none' | 'offered' | 'suspended' | 'spotcheck' | 'failed' | 'paid';
  budget: { budgetCents: number; totalCents: number } | null;   // extra 2
  error: { code: string; message: string } | null;              // the last error event of the server or of the app
};
export type UiAction = NativeToPage
  | { t: 'local.reset' }                           // the shopper leaves a session that is over
  | { t: 'local.profile'; patch: ProfilePatch }    // the shopper changes a preference
  | { t: 'local.attempt' };                        // the shopper tries a setup step or a start again
export const MAX_CAPTIONS = 20;
export const initialUiState: UiState;
export function reduce(state: UiState, action: UiAction): UiState;
```

What each action changes:

| Action | Change |
|---|---|
| `native.state` | `native`. Clears `error` if `stream` becomes `streaming`. |
| `profile` | `profile` |
| `snapshot` | `sessionId`, `phase`, `prompt`, `cart`, `profile`, `receipt` (from `lastReceipt`), and `captions` (the last 20). `checkout` is `offered` for a pay prompt, `paid` for the phase `paid` with a receipt, else `none`. Clears `lookAlikes`, `spotCheck`, `budget`, and `error`. |
| `session.state` | `phase` |
| `glance.pending` | `prompt` becomes a product prompt, with `mode` from the `kind` of the event. Clears `lookAlikes` and `error`. A `checkout` of `failed` becomes `none`. |
| `glance.cleared` | Clears `prompt` only if the IDs are equal |
| `glance.hint`, `glance.unknown` | Nothing. The caption carries the line. |
| `glance.ambiguous` | `lookAlikes` |
| `cart.updated` | `cart`. `cartSeq + 1` if `change` is not `null`. Clears `lookAlikes`. Clears `budget` if the new total is not over `budget.budgetCents`. |
| `budget.exceeded` | `budget` |
| `checkout.offered` | `prompt` becomes the pay prompt, `checkout: 'offered'`. Clears `spotCheck` and `error`. |
| `checkout.suspended` | `checkout: 'suspended'`. Clears `prompt` only if it is a pay prompt. |
| `checkout.spotcheck` | `spotCheck`, `checkout: 'spotcheck'` |
| `checkout.cancelled` | `checkout: 'none'`. Clears a pay prompt and `spotCheck`. |
| `checkout.paid` | `receipt` (the event without `type`), `checkout: 'paid'`. Clears a pay prompt, `spotCheck`, and `error`. |
| `checkout.failed` | `checkout: 'failed'`. Clears a pay prompt. |
| `caption` | Appends the caption. A caption with a known ID replaces the old one. Keeps the last 20. |
| `error` | `error` |
| `local.reset` | `initialUiState`, with the `native` and `profile` of the old state |
| `local.profile` | Merges the patch into `profile` |
| `local.attempt` | Clears `error` |

An `error` event of the app can arrive before or after its `native.state`. So a change to `stopped` or `paused` does not clear `error`.

- [ ] **Step 1: Write the failing test**

```ts
const run = (...actions: UiAction[]) => actions.reduce(reduce, initialUiState);
const productPrompt = eventMessage('glance.pending');
const payPrompt = eventMessage('checkout.offered');
const added = { kind: 'add', productId: 'oat-drink-1l', name: 'Oat drink' } as const;

it('starts empty', () => {
  expect(initialUiState).toEqual({
    native: null, profile: DEFAULT_PROFILE, sessionId: null, phase: null, prompt: null, lookAlikes: null, spotCheck: null,
    cart: EMPTY_CART, cartSeq: 0, captions: [], receipt: null, checkout: 'none', budget: null, error: null,
  });
});
it('shows a pending glance as the product prompt', () => {
  expect(run(eventMessage('glance.pending', { kind: 'inCart' })).prompt).toMatchObject({
    kind: 'product', mode: 'inCart', promptId: 'p-0001', product: { id: 'oat-drink-1l', packSize: '1 L', priceCents: 189 },
  });
});
it('clears the prompt for its own ID only', () => {
  expect(run(productPrompt, eventMessage('glance.cleared', { promptId: 'p-0001' })).prompt).toBeNull();
  expect(run(productPrompt, eventMessage('glance.cleared', { promptId: 'p-0000' })).prompt).not.toBeNull();
});
it('takes the cart of the server, and counts each change', () => {
  const state = run(eventMessage('cart.updated', { change: added }), eventMessage('cart.updated', { change: null }));
  expect(state.cart).toEqual(eventFixture('cart.updated').cart);
  expect(state.cart.totalCents).toBe(449);
  expect(state.cartSeq).toBe(1);
});
it('opens checkout with the pay prompt', () => {
  expect(run(payPrompt)).toMatchObject({
    checkout: 'offered',
    prompt: { kind: 'pay', promptId: 'p-0001', kiosk: { id: 'kiosk-1', name: 'Checkout 3', store: 'Demo Market' } },
  });
});
it('suspends checkout, and keeps a product prompt that came first', () => {
  expect(run(payPrompt, eventMessage('checkout.suspended'))).toMatchObject({ checkout: 'suspended', prompt: null });
  expect(run(payPrompt, productPrompt, eventMessage('checkout.suspended')).prompt).toMatchObject({ kind: 'product' });
});
it('keeps the receipt after the payment', () => {
  const { type, ...receipt } = eventFixture('checkout.paid');
  expect(run(payPrompt, eventMessage('checkout.paid'))).toMatchObject({ checkout: 'paid', prompt: null, receipt });
});
it('marks a failed payment until the next glance, and a cancelled checkout', () => {
  expect(run(payPrompt, eventMessage('checkout.failed'))).toMatchObject({ checkout: 'failed', prompt: null });
  expect(run(payPrompt, eventMessage('checkout.failed'), productPrompt).checkout).toBe('none');
  expect(run(payPrompt, eventMessage('checkout.cancelled'))).toMatchObject({ checkout: 'none', prompt: null });
});
it('keeps the last 20 captions, and one caption for each ID', () => {
  const caption = (n: number, text = `Line ${n}`) => eventMessage('caption', { id: `c-${n}`, text });
  const state = run(...Array.from({ length: 25 }, (_, n) => caption(n)), caption(24, 'Line 24 again'));
  expect(state.captions).toHaveLength(20);
  expect(state.captions[0]?.id).toBe('c-5');
  expect(state.captions.at(-1)?.text).toBe('Line 24 again');
});
it('stores look-alike products until the next prompt', () => {
  expect(run(eventMessage('glance.ambiguous')).lookAlikes).toEqual(eventFixture('glance.ambiguous').candidates);
  expect(run(eventMessage('glance.ambiguous'), productPrompt).lookAlikes).toBeNull();
});
it('stores the product of a spot check', () => {
  expect(run(eventMessage('checkout.spotcheck'))).toMatchObject({ checkout: 'spotcheck', spotCheck: eventFixture('checkout.spotcheck').product });
});
it('keeps a budget warning until the total is within the budget', () => {
  expect(run(eventMessage('budget.exceeded', { budgetCents: 400, totalCents: 449 }), eventMessage('cart.updated')).budget).toEqual({ budgetCents: 400, totalCents: 449 });
  expect(run(eventMessage('budget.exceeded', { budgetCents: 500, totalCents: 520 }), eventMessage('cart.updated')).budget).toBeNull();
});
it('keeps an error until a sign of recovery', () => {
  const failed = run({ t: 'native.state', state: NATIVE_READY }, eventMessage('error'));
  expect(failed.error).toEqual({ code: eventFixture('error').code, message: eventFixture('error').message });
  expect(reduce(failed, eventMessage('caption')).error).not.toBeNull();
  expect(reduce(failed, eventMessage('session.state')).error).not.toBeNull();
  expect(reduce(failed, { t: 'native.state', state: { ...NATIVE_READY, session: 'stopped', device: null } }).error).not.toBeNull();
  expect(reduce(failed, productPrompt).error).toBeNull();
  expect(reduce(failed, { t: 'native.state', state: { ...NATIVE_READY, stream: 'streaming' } }).error).toBeNull();
  expect(reduce(failed, { t: 'local.attempt' }).error).toBeNull();
});
it('replaces the session data from a snapshot', () => {
  const state = run(productPrompt, { t: 'snapshot', session: SNAPSHOT });
  expect(state).toMatchObject({
    sessionId: SNAPSHOT.sessionId, phase: SNAPSHOT.phase, prompt: SNAPSHOT.prompt, cart: SNAPSHOT.cart,
    profile: SNAPSHOT.profile, receipt: SNAPSHOT.lastReceipt,
  });
  expect(state.captions).toEqual(SNAPSHOT.captions.slice(-20));
});
it('keeps the native state and the profile on a local reset', () => {
  const state = run({ t: 'native.state', state: NATIVE_READY }, { t: 'local.profile', patch: { detail: 'brief' } },
    eventMessage('cart.updated'), { t: 'local.reset' });
  expect(state).toEqual({ ...initialUiState, native: NATIVE_READY, profile: { ...DEFAULT_PROFILE, detail: 'brief' } });
});
it('accepts each of the 16 event fixtures', () => {
  expect(EVENT_TYPES).toHaveLength(16);
  for (const type of EVENT_TYPES) expect(() => run(eventMessage(type))).not.toThrow();
});
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `npm test --workspace @glance/phone-ui -- uiState`
Expected: FAIL, because `uiState.ts` does not exist.

- [ ] **Step 3: Implement `reduce` from the table**

Use one `switch` on `action.t`, and one on `event.type` with a `never` check in the default branch. The compiler then names an event that the reducer forgets.

- [ ] **Step 4: Run all checks**

Run: `npm test --workspace @glance/phone-ui` and `npm run typecheck --workspace @glance/phone-ui`
Expected: PASS, and no type error. This task has no screen. Its tests are the deliverable.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/ui
git commit -m "feat(ui): add the UI state and its reducer"
```

---

### Task 5 (C2): Session screen

**Files:**
- Create: `apps/mobile/ui/src/bridge/BridgeContext.tsx`, `apps/mobile/ui/src/text/strings.ts`, `apps/mobile/ui/src/text/format.ts`
- Create: `apps/mobile/ui/src/components/PromptCard.tsx`, `CaptionList.tsx`, `CartList.tsx`, `useSpokenText.ts` (same folder)
- Create: `apps/mobile/ui/src/screens/SessionScreen.tsx`, `apps/mobile/ui/src/debug/demoRun.ts`
- Modify: `apps/mobile/ui/src/App.tsx`, `apps/mobile/ui/src/main.tsx`, `apps/mobile/ui/src/test/render.tsx`
- Test: `apps/mobile/ui/src/text/format.test.ts`, `apps/mobile/ui/src/screens/SessionScreen.test.tsx`, `apps/mobile/ui/src/debug/demoRun.test.ts`

**Interfaces:**
- Consumes: `reduce`, `initialUiState`, `UiState`, `UiAction` (Task 4). `BrowserBridge`, `NATIVE_READY`, the fixtures (Task 3). `formatEur`, `Lang`, `Cart` from `@glance/shared`.
- Produces:

```tsx
// bridge/BridgeContext.tsx
export type Ui = { state: UiState; strings: Strings; bridge: GlanceBridge; send(message: PageToNative): void; dispatch(action: UiAction): void };
export function BridgeProvider(props: { bridge: GlanceBridge; children: ReactNode }): JSX.Element;
export function useUi(): Ui;

// text/strings.ts
export const EN: { ... };                          // see the lists of the tasks
export type Strings = typeof EN;
export function stringsFor(lang: Lang): Strings;   // returns EN for each language until Task 21

// text/format.ts
export function eur(cents: number): string;                              // '1.89 EUR'
export function itemCount(cart: Cart): number;                           // the sum of the quantities
export function cartStatusLine(cart: Cart, strings: Strings): string;    // 'Cart: 2 items, 4.49 EUR.'

// components
export function PromptCard(props: { prompt: Extract<CurrentPrompt, { kind: 'product' }> }): JSX.Element;
export function CaptionList(): JSX.Element;
export function CartList(): JSX.Element;
export function useSpokenText(state: UiState, strings: Strings): void;
export function SessionScreen(): JSX.Element;

// debug/demoRun.ts
export type Recording = { afterMs: number; message: NativeToPage }[];   // afterMs counts from the start of the run
export const DEMO_RUN: Recording;
export function playRecording(recording: Recording, deliver: (message: NativeToPage) => void): () => void;   // returns stop

// test/render.tsx
export function renderWithUi(ui: ReactElement, options?: { native?: NativeState; messages?: NativeToPage[] }):
  RenderResult & { bridge: BrowserBridge; user: UserEvent; deliver(...messages: NativeToPage[]): void };
```

`BridgeProvider` subscribes to the bridge, then sends `ui.ready`. It runs `reduce` for each message, and it calls `useSpokenText`. `send` passes a message to the bridge. Before `setup.register`, `setup.requestCamera`, and `session.start`, it runs `dispatch({ t: 'local.attempt' })`.

`renderWithUi` makes a `BrowserBridge` with no server and the start state `options.native`, default `NATIVE_READY`. It renders `ui` inside `Theme` and `BridgeProvider`. `deliver` calls `bridge.inject` inside `act`.

Strings of this task:

```ts
appTitle: 'Glance',
idleHint: 'Hold a product up to hear its price.',
add: 'Add', skip: 'Skip', addAnother: 'Add another', removeOne: 'Remove one',
inCart: (qty: number) => `In your cart: ${qty}`,
captions: 'Captions',
noCaptions: 'Each line that the voice speaks shows here.',
cart: 'Cart',
cartEmpty: 'Your cart is empty.',
cartLine: (packSize: string, qty: number, unit: string) => `${packSize}, ${qty} x ${unit}`,
total: 'Total',
items: (count: number) => (count === 1 ? '1 item' : `${count} items`),
cartStatus: (count: number, total: string) => (count === 0 ? 'Cart: empty.' : `Cart: ${count === 1 ? '1 item' : `${count} items`}, ${total}.`),
```

Layout of `SessionScreen`, top to bottom, inside `<VStack as="main" padding={4} gap={4}>`:

1. `<Heading level={1}>` with `appTitle`.
2. The prompt area: `PromptCard` for a product prompt, else `idleHint`.
3. `CaptionList`: `<Heading level={2}>` and the last 4 captions, the newest last. Each caption is a `Text` element with `lang={caption.lang}`. With no caption it shows `noCaptions`.
4. `CartList`: `<Heading level={2}>`, one `ListItem` for each line, then `total` and `eur(cart.totalCents)`. The `label` and the `description` of a line are `Text` elements, so a long name wraps. With no line it shows `cartEmpty`.

`PromptCard`: the name as `<Heading level={2}>`, the pack size, the price as `<Text type="display-1">`, and two buttons of `size="lg"`. For the mode `new` the buttons are `add` (primary) and `skip`. For `inCart` they are `addAnother` (primary) and `removeOne`, and the card shows `inCart(qtyInCart)`. The first button sends `{ t: 'intent', kind: 'yes', promptId }`, the second sends the same with `kind: 'no'`. After one answer the card sends nothing more for that `promptId`, and both buttons get `isDisabled`. A second answer can undo an add on the server (Plan 1 Task 4).

`useSpokenText` calls `announce` of `useAnnounce` with the text of each caption that an event brings, and with `cartStatusLine` each time `cartSeq` grows. It does not announce the captions of a snapshot.

`DEMO_RUN` holds these messages. Build each one from the fixtures:

| `afterMs` | Message |
|---|---|
| 0 | `snapshot`: `SNAPSHOT` with the phase `shopping`, no prompt, no receipt, no captions, and the cart of the `cart.updated` fixture without the line `oat-drink-1l` (total 260) |
| 500 | `caption`: "Camera on. Hold a product up to hear its price." |
| 2500 | `glance.pending` with `kind: 'new'`, then `caption`: "Oat drink, one litre, one eighty-nine. Nod to add." |
| 6000 | `glance.cleared`, `cart.updated` (the fixture, total 449, with the change `add` for the oat drink), then `caption`: "Added oat drink. Total four forty-nine." |
| 9000 | `checkout.offered`, then `caption`: "Checkout 3 at Demo Market. Two items, four euros forty-nine. Nod to pay." |
| 13000 | `checkout.paid`, `session.state` with the phase `paid`, then `caption`: "Paid. Four euros forty-nine. Your receipt is on your phone. Camera off." |

Each caption of the run has `lang: 'en'`, `priority: 'normal'`, `url: null`, and its own ID.

- [ ] **Step 1: Write the failing tests**

`format.test.ts`:

```ts
it('formats an amount with the currency code', () => {
  expect(eur(189)).toBe('1.89 EUR');
  expect(eur(123456)).toBe('1234.56 EUR');
});
it('states the cart for the live region', () => {
  const line = (qty: number, totalCents: number) => cartStatusLine({
    items: qty === 0 ? [] : [{ productId: 'oat-drink-1l', name: 'Oat drink', packSize: '1 L', qty, unitPriceCents: 189 }],
    totalCents,
  }, EN);
  expect(line(0, 0)).toBe('Cart: empty.');
  expect(line(1, 189)).toBe('Cart: 1 item, 1.89 EUR.');
  expect(line(2, 378)).toBe('Cart: 2 items, 3.78 EUR.');
});
```

`SessionScreen.test.tsx`:

```tsx
const pending = (change = {}) => eventMessage('glance.pending', { kind: 'new', qtyInCart: 0, warnings: [], ...change });
const product = eventFixture('glance.pending').product;
const added = { kind: 'add', productId: 'oat-drink-1l', name: 'Oat drink' } as const;
const politeRegion = () => document.querySelector('[data-astryx-live-region="polite"]');

it('shows the idle hint and an empty cart before the first glance', () => {
  renderWithUi(<SessionScreen />);
  expect(screen.getByRole('main')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1, name: 'Glance' })).toBeInTheDocument();
  expect(screen.getByText('Hold a product up to hear its price.')).toBeInTheDocument();
  expect(screen.getByText('Your cart is empty.')).toBeInTheDocument();
});
it('shows the product of the prompt with its pack size and price', () => {
  renderWithUi(<SessionScreen />, { messages: [pending()] });
  expect(screen.getByRole('heading', { level: 2, name: product.name })).toBeInTheDocument();
  expect(screen.getByText('1 L')).toBeInTheDocument();
  expect(screen.getByText('1.89 EUR')).toBeInTheDocument();
});
it('sends a yes and a no with the ID of the prompt on the card', async () => {
  const first = renderWithUi(<SessionScreen />, { messages: [pending()] });
  await first.user.click(screen.getByRole('button', { name: 'Add' }));
  expect(first.bridge.sent).toContainEqual({ t: 'intent', kind: 'yes', promptId: 'p-0001' });
  first.unmount();
  const second = renderWithUi(<SessionScreen />, { messages: [pending()] });
  await second.user.click(screen.getByRole('button', { name: 'Skip' }));
  expect(second.bridge.sent).toContainEqual({ t: 'intent', kind: 'no', promptId: 'p-0001' });
});
it('sends one answer for each prompt, also after two fast taps', async () => {
  const { bridge, user, deliver } = renderWithUi(<SessionScreen />, { messages: [pending()] });
  await user.click(screen.getByRole('button', { name: 'Add' }));
  await user.click(screen.getByRole('button', { name: 'Add' }));
  await user.click(screen.getByRole('button', { name: 'Skip' }));
  deliver(pending({ promptId: 'p-0002' }));
  await user.click(screen.getByRole('button', { name: 'Add' }));
  expect(bridge.sent.filter((message) => message.t === 'intent')).toEqual([
    { t: 'intent', kind: 'yes', promptId: 'p-0001' },
    { t: 'intent', kind: 'yes', promptId: 'p-0002' },
  ]);
});
it('offers add another and remove one for a product that is in the cart', () => {
  renderWithUi(<SessionScreen />, { messages: [pending({ kind: 'inCart', qtyInCart: 1 })] });
  expect(screen.getByText('In your cart: 1')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add another' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Remove one' })).toBeInTheDocument();
});
it('shows a product name of 60 characters in full', () => {
  const name = 'Organic whole grain rye bread with seeds, sliced, family pack';
  renderWithUi(<SessionScreen />, { messages: [pending({ product: { ...product, name } })] });
  expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
});
it('shows each caption as text, with its language', () => {
  renderWithUi(<SessionScreen />, { messages: [
    eventMessage('caption', { id: 'c-a', text: 'Camera on.', lang: 'en' }),
    eventMessage('caption', { id: 'c-b', text: 'Aggiunto.', lang: 'it' }),
  ] });
  expect(screen.getByText('Camera on.')).toHaveAttribute('lang', 'en');
  expect(screen.getByText('Aggiunto.')).toHaveAttribute('lang', 'it');
});
it('shows the cart lines and the total of the server', () => {
  renderWithUi(<SessionScreen />, { messages: [eventMessage('cart.updated')] });
  for (const item of eventFixture('cart.updated').cart.items) expect(screen.getByText(item.name)).toBeInTheDocument();
  expect(screen.getByText('4.49 EUR')).toBeInTheDocument();
});
it('announces each caption in the polite live region', async () => {
  renderWithUi(<SessionScreen />, { messages: [eventMessage('caption', { id: 'c-a', text: 'Skipped.' })] });
  await waitFor(() => expect(politeRegion()).toHaveTextContent('Skipped.'));
  expect(document.querySelector('[data-astryx-live-region="assertive"]')?.textContent ?? '').toBe('');
});
it('announces each cart change in the polite live region', async () => {
  renderWithUi(<SessionScreen />, { messages: [eventMessage('cart.updated', { change: added })] });
  await waitFor(() => expect(politeRegion()).toHaveTextContent(cartStatusLine(eventFixture('cart.updated').cart, EN)));
});
it('does not announce the captions of a snapshot', async () => {
  const old = { id: 'c-old', text: 'An old line.', lang: 'en', priority: 'normal', url: null } as const;
  renderWithUi(<SessionScreen />, { messages: [{ t: 'snapshot', session: { ...SNAPSHOT, captions: [old] } }, eventMessage('caption', { id: 'c-new', text: 'A new line.' })] });
  await waitFor(() => expect(politeRegion()).toHaveTextContent('A new line.'));
  expect(politeRegion()).not.toHaveTextContent('An old line.');
});
```

`demoRun.test.ts`:

```ts
it('delivers each message at its time, and stops on request', () => {
  vi.useFakeTimers();
  const seen: NativeToPage[] = [];
  const message = eventMessage('glance.unknown');
  const stop = playRecording([{ afterMs: 0, message }, { afterMs: 1000, message }, { afterMs: 2000, message }], (m) => seen.push(m));
  vi.advanceTimersByTime(1000);
  expect(seen).toHaveLength(2);
  stop();
  vi.advanceTimersByTime(5000);
  expect(seen).toHaveLength(2);
  vi.useRealTimers();
});
it('holds a demo run that the bridge schema accepts, in time order, to the payment', () => {
  for (const entry of DEMO_RUN) expect(parseNativeToPage(entry.message)).not.toBeNull();
  const times = DEMO_RUN.map((entry) => entry.afterMs);
  expect(times).toEqual([...times].sort((a, b) => a - b));
  expect(DEMO_RUN.map((entry) => entry.message).reduce(reduce, initialUiState).checkout).toBe('paid');
});
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/phone-ui`
Expected: FAIL, because the modules do not exist.

- [ ] **Step 3: Implement the modules**

`App` renders `<SessionScreen />`. `main.tsx` wraps `App` in `BridgeProvider`. With the flag `replay` and a `BrowserBridge`, it calls `playRecording(DEMO_RUN, (message) => bridge.inject(message))`.

- [ ] **Step 4: Run all checks**

Run: `npm test --workspace @glance/phone-ui` and `npm run typecheck --workspace @glance/phone-ui`
Expected: PASS, and no type error.

- [ ] **Step 5: Check the screen in a browser**

Open `http://localhost:5173/?replay=1` at a width of 360 px.
Expected: the cart shows one line first. The oat drink card appears with "1.89 EUR", Add, and Skip. After 6 seconds the cart has two lines and the total "4.49 EUR". Each caption shows as text. `glanceBridge.sent` in the console lists a tap on Add.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/ui
git commit -m "feat(ui): add the session screen with prompt card, captions, and cart"
```

Tell seat 1 that `npm run build --workspace @glance/phone-ui` now gives a page for the WebView.

---

### Task 6 (C2): Kiosk page

**Files:**
- Create: `apps/website/src/lib/api.ts`, `apps/website/src/lib/events.ts`, `apps/website/src/lib/format.ts`, `apps/website/src/test/fakes.ts`
- Create: `apps/website/src/kiosk/qr.ts`, `KioskCode.tsx`, `kioskModel.ts`, `KioskView.tsx`, `kiosk.css`, `kioskRun.ts` (same folder)
- Modify: `apps/website/src/kiosk/KioskPage.tsx`
- Test: `apps/website/src/kiosk/qr.test.ts`, `kioskModel.test.ts`, `kiosk.css.test.ts`, `KioskView.test.tsx`, `KioskPage.test.tsx`, `apps/website/src/lib/events.test.ts`

**Interfaces:**
- Consumes from `@glance/shared`: `formatKioskCode`, `formatEur`, `CreateKioskRequest`, `CreateKioskResponse`, `CreateKioskResponseSchema`, `KioskEvent`, `KioskEventSchema`, `Cart`, `CartItem`, and the fixtures `rest/KioskEvent.json`, `rest/CreateKioskResponse.json`, `events/cart.updated.json`, `events/checkout.paid.json`.
- Produces:

```ts
// lib/format.ts
export function eur(cents: number): string;   // '4.49 EUR'

// lib/api.ts
export class ApiError extends Error { readonly status: number; }
export function createKiosk(request: CreateKioskRequest, fetchFn?: typeof fetch): Promise<CreateKioskResponse>;   // POST /api/kiosks
export function kioskEventsUrl(kioskId: string, token: string): string;   // '/api/kiosks/<id>/events?token=<token>'

// lib/events.ts
export type EventSourceLike = { /* as in Task 3 */ };
export type StreamHandlers<T> = { onEvent(event: T): void; onStatus(status: 'open' | 'lost'): void };
export function subscribeSse<T>(url: string, parse: (input: unknown) => T | null, handlers: StreamHandlers<T>,
  create?: (url: string) => EventSourceLike): () => void;                 // returns close. Default create: new EventSource(url)
export type Timed<T> = { afterMs: number; event: T };
export function replay<T>(recording: Timed<T>[], onEvent: (event: T) => void, loop?: boolean): () => void;   // returns stop

// kiosk/qr.ts
export const QR_QUIET_MODULES = 4;
export function kioskQr(code: string): { size: number; path: string };   // size counts the quiet zone on both sides

// kiosk/kioskModel.ts
export const KIOSK_MAX_ROWS = 7;
export function kioskFlags(search: string): Required<CreateKioskRequest>;
export function parseKioskEvent(input: unknown): KioskEvent | null;
export function idleEvent(request: CreateKioskRequest, response: CreateKioskResponse): KioskEvent;
export function kioskRows(cart: Cart | null): { rows: CartItem[]; hiddenCount: number };

// kiosk components
export function KioskCode(props: { code: string }): JSX.Element;
export type KioskLink = 'registering' | 'unreachable' | 'open' | 'lost';
export function KioskView(props: { event: KioskEvent | null; link: KioskLink }): JSX.Element;
export function KioskPage(props: { fetchFn?: typeof fetch; createEventSource?: (url: string) => EventSourceLike; retryMs?: number }): JSX.Element;

// kiosk/kioskRun.ts
export const KIOSK_RUN: Timed<KioskEvent>[];

// test/fakes.ts: fakeSources and fakeFetch, as in Task 3
```

Decisions:

- `kioskQr` calls `QRCode.create(formatKioskCode(code), { errorCorrectionLevel: 'M' })` from the `qrcode` package. The path holds one part for each dark module, in row order: `M<x> <y>h1v1h-1z`, with `x = column + 4` and `y = row + 4`. A bad code makes `formatKioskCode` throw `RangeError`.
- `KioskCode` renders `<svg viewBox="0 0 29 29" role="img" aria-label="Checkout code K3X7" shapeRendering="crispEdges" className="kiosk-code">` with a `rect` of `fill="#fff"` over the whole box, and one `path` of `fill="#000"`. The code is black on white in each color mode.
- `kioskFlags` reads `name` (default `Checkout 3`) and `store` (default `Demo Market`). It trims each one, uses the default for an empty text, and cuts at 40 characters. `spot` and `fail` are `true` when the flag is present and its value is not `0` or `false`.
- `parseKioskEvent` parses with `KioskEventSchema`, and returns `null` if `formatKioskCode(event.code)` throws.
- `createKiosk` checks the response with `CreateKioskResponseSchema` and with `formatKioskCode`. It throws `ApiError` for a status of 400 or more.
- `KioskPage`: read the flags, call `createKiosk`, show `idleEvent`, then follow `kioskEventsUrl` with `subscribeSse` and `parseKioskEvent`. If `createKiosk` fails, show the link state `unreachable` and try again each `retryMs`, default 3000. With the flag `replay` it makes no network call and plays `KIOSK_RUN` in a loop.
- `KioskView` wraps its content in `<Theme theme={themes[defaultThemeSlug]} mode="light">` and `<HStack as="main" className="kiosk">`. The code is the first child. It keeps its place and its size in each state. The second child is a `VStack` with the line `<kiosk name>, <store>` and the state.
- The page shows `event.totalCents`. It never adds prices.

Text of each state:

| State | `h1` | More content |
|---|---|---|
| `registering` (no event yet) | Connecting to the store | No code yet |
| `unreachable` (no event yet) | The store server does not answer | "The page tries again every 3 seconds." |
| `idle` | Look at this code to pay | "No glasses? Use a staffed checkout." |
| `connected` | Waiting for your nod | The total, then the rows of `kioskRows`, then `and <n> more items` if `hiddenCount` is over 0 |
| `spotcheck` | Waiting for your nod | As `connected`, until Task 22 |
| `paid` | Paid | The total, the receipt rows, "Demo payment. No money moved." |
| `failed` | Payment failed. Nothing was charged. | "Look at the code to try again." |
| link `lost`, any state | (the heading of the state) | Also "Connection lost. Reconnecting." |

The total is a `Text` with the class `kiosk-total`. Each text of a row is a `Text` with the class `kiosk-row`: the name, then `<qty> x <unit price>`.

`kiosk.css` holds at least these rules. The vh values give 160 px and 48 px on a screen of 1080 px height, at each scale setting of the system.

```css
.kiosk {
  --kiosk-total-size: 14.9vh;
  --kiosk-row-size: 4.5vh;
  --kiosk-code-size: max(15cm, min(50vw, 92vh));
  min-block-size: 100vh;
  background: var(--color-background-body);
}
.kiosk-code { inline-size: var(--kiosk-code-size); block-size: var(--kiosk-code-size); flex: none; }
.kiosk-total { font-size: var(--kiosk-total-size); line-height: 1; font-weight: 700; }
.kiosk-row { font-size: var(--kiosk-row-size); line-height: 1.3; }
.kiosk h1 { font-size: calc(var(--kiosk-row-size) * 1.5); line-height: 1.2; }
```

A row uses a font of 48 px, so its height is more than 48 px. This covers both readings of "a row is 48 px or more". The 15 cm of the spec apply to the code image with its quiet zone.

`KIOSK_RUN` holds seven events, built from the fixtures. The states are `idle`, `connected`, `paid`, `idle`, `connected`, `failed`, and `idle`. The times are 0, 3000, 8000, 13000, 16000, 20000, and 24000 ms. `connected` has the cart of `cart.updated`, and `paid` has the receipt of `checkout.paid`.

- [ ] **Step 1: Write the failing tests for the code, the model, and the sizes**

`qr.test.ts`:

```ts
it('makes a version 1 code with a quiet zone of 4 modules', () => {
  const qr = kioskQr('K3X7');
  expect(qr.size).toBe(29);
  expect(qr.path.match(/M/g)).toHaveLength(224);
});
it('draws rows as y and columns as x', () => {
  const { path } = kioskQr('K3X7');
  expect(path).toContain('M12 17h1v1h-1z');   // the fixed dark module of a QR code: row 13, column 8
  expect(path).not.toContain('M17 12h1v1h-1z');
});
it('keeps version 1 for the longest code', () => {
  expect(kioskQr('ABCD1234').size).toBe(29);
});
it('rejects a code that the contract does not allow', () => {
  expect(() => kioskQr('k3')).toThrow(RangeError);
});
```

`kioskModel.test.ts` (`fixture` is `rest/KioskEvent.json`):

```ts
it('reads the flags of the address', () => {
  expect(kioskFlags('?name=Checkout%205&store=Corner%20Shop&spot=1&fail=1'))
    .toEqual({ name: 'Checkout 5', store: 'Corner Shop', spotCheck: true, failPayment: true });
});
it('uses the demo names when a flag is missing or empty', () => {
  expect(kioskFlags('')).toEqual({ name: 'Checkout 3', store: 'Demo Market', spotCheck: false, failPayment: false });
  expect(kioskFlags('?name=%20%20&spot=0&fail=false')).toEqual({ name: 'Checkout 3', store: 'Demo Market', spotCheck: false, failPayment: false });
});
it('cuts a name of 200 characters to 40', () => {
  expect(kioskFlags(`?name=${'A'.repeat(200)}`).name).toHaveLength(40);
});
it('accepts the fixture, and drops a kiosk event that is not valid', () => {
  expect(parseKioskEvent(fixture)?.type).toBe('kiosk.state');
  expect(parseKioskEvent({ ...fixture, code: 'k!' })).toBeNull();
  expect(parseKioskEvent({ type: 'kiosk.exploded' })).toBeNull();
  expect(parseKioskEvent('x')).toBeNull();
});
it('shows at most 7 cart lines and counts the rest', () => {
  const item = (n: number) => ({ productId: `p-${n}`, name: `Product ${n}`, packSize: '1 L', qty: 1, unitPriceCents: 100 });
  const cart = { items: Array.from({ length: 9 }, (_, n) => item(n)), totalCents: 900 };
  expect(kioskRows(cart).rows).toHaveLength(7);
  expect(kioskRows(cart).hiddenCount).toBe(2);
  expect(kioskRows(null)).toEqual({ rows: [], hiddenCount: 0 });
});
```

`kiosk.css.test.ts`:

```ts
const css = readFileSync('src/kiosk/kiosk.css', 'utf8');
const vh = (name: string) => Number(new RegExp(`${name}:\\s*([\\d.]+)vh`).exec(css)?.[1]);

it('gives a total of 160 px or more and a row of 48 px or more on a 1080p screen', () => {
  expect(vh('--kiosk-total-size') * 10.8).toBeGreaterThanOrEqual(160);
  expect(vh('--kiosk-row-size') * 10.8).toBeGreaterThanOrEqual(48);
});
it('keeps the code at 15 cm or more, as large as the screen allows', () => {
  expect(css).toContain('--kiosk-code-size: max(15cm, min(50vw, 92vh))');
});
```

`events.test.ts`:

```ts
it('parses each stream message, drops bad ones, and reports the link', () => {
  const sources = fakeSources();
  const events: unknown[] = [];
  const status: string[] = [];
  const close = subscribeSse('/x', (input) => (typeof input === 'object' ? input : null),
    { onEvent: (event) => events.push(event), onStatus: (s) => status.push(s) }, sources.create);
  const source = sources.sources[0]!;
  source.emit('open');
  source.emit('message', '{"a":1}');
  source.emit('message', 'not json');
  source.emit('message', '"text"');
  source.emit('error');
  expect(events).toEqual([{ a: 1 }]);
  expect(status).toEqual(['open', 'lost']);
  close();
  expect(source.closed).toBe(true);
});
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/website`
Expected: FAIL, because the modules do not exist.

- [ ] **Step 3: Implement `format.ts`, `api.ts`, `events.ts`, `fakes.ts`, `qr.ts`, `kioskModel.ts`, and `kiosk.css`**

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npm test --workspace @glance/website -- qr kioskModel kiosk.css events`
Expected: PASS.

- [ ] **Step 5: Write the failing tests for the view and the page**

`KioskView.test.tsx`. Helpers: `base` is `parseKioskEvent(fixture)`. `cart` is the cart of `events/cart.updated.json`. `receipt` is `events/checkout.paid.json` without `type`.

```tsx
const at = (state: KioskEvent['state'], more: Partial<KioskEvent> = {}): KioskEvent =>
  ({ ...base, state, cart: null, totalCents: null, receipt: null, ...more });
const code = () => screen.getByRole('img', { name: `Checkout code ${base.code}` });

it.each([
  ['idle', 'Look at this code to pay'],
  ['connected', 'Waiting for your nod'],
  ['paid', 'Paid'],
  ['failed', 'Payment failed. Nothing was charged.'],
] as const)('names the state %s in the main heading and keeps the code', (state, heading) => {
  renderWithTheme(<KioskView event={at(state)} link="open" />);
  expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
  expect(code()).toBeInTheDocument();
});
it('keeps the code black on white, with its quiet zone', () => {
  renderWithTheme(<KioskView event={at('idle')} link="open" />);
  expect(code()).toHaveAttribute('viewBox', '0 0 29 29');
  expect(code().querySelector('rect')).toHaveAttribute('fill', '#fff');
  expect(code().querySelector('path')).toHaveAttribute('fill', '#000');
});
it('shows the kiosk, the store, and a line for a shopper with no glasses', () => {
  renderWithTheme(<KioskView event={at('idle')} link="open" />);
  expect(screen.getByText(`${base.kiosk.name}, ${base.kiosk.store}`)).toBeInTheDocument();
  expect(screen.getByText('No glasses? Use a staffed checkout.')).toBeInTheDocument();
});
it('shows the total of the server and each cart line', () => {
  renderWithTheme(<KioskView event={at('connected', { cart, totalCents: cart.totalCents })} link="open" />);
  expect(screen.getByText('4.49 EUR')).toHaveClass('kiosk-total');
  for (const item of cart.items) expect(screen.getByText(item.name)).toHaveClass('kiosk-row');
});
it('counts the cart lines that do not fit', () => {
  const items = Array.from({ length: 9 }, (_, n) => ({ ...cart.items[0]!, productId: `p-${n}`, name: `Product ${n}` }));
  renderWithTheme(<KioskView event={at('connected', { cart: { items, totalCents: 900 }, totalCents: 900 })} link="open" />);
  expect(screen.getByText('and 2 more items')).toBeInTheDocument();
});
it('shows the paid amount, the receipt lines, and the demo line', () => {
  renderWithTheme(<KioskView event={at('paid', { receipt, totalCents: receipt.totalCents })} link="open" />);
  expect(screen.getByText(eur(receipt.totalCents))).toHaveClass('kiosk-total');
  for (const item of receipt.items) expect(screen.getByText(item.name)).toBeInTheDocument();
  expect(screen.getByText('Demo payment. No money moved.')).toBeInTheDocument();
});
it('keeps the code, and says so, while the connection is lost', () => {
  renderWithTheme(<KioskView event={at('connected', { cart, totalCents: cart.totalCents })} link="lost" />);
  expect(screen.getByText('Connection lost. Reconnecting.')).toBeInTheDocument();
  expect(code()).toBeInTheDocument();
});
it('says that it connects before a code exists', () => {
  renderWithTheme(<KioskView event={null} link="registering" />);
  expect(screen.getByRole('heading', { level: 1, name: 'Connecting to the store' })).toBeInTheDocument();
});
```

`KioskPage.test.tsx`. `created` is `rest/CreateKioskResponse.json`, and `base` is the parsed kiosk event fixture. `renderKiosk(address, http, sources)` renders the page in a `MemoryRouter` with `retryMs={10}`.

```tsx
it('registers with the flags of the address, shows the code, and follows the stream', async () => {
  const http = fakeFetch(() => ({ json: created }));
  const sources = fakeSources();
  renderKiosk('/kiosk?name=Checkout%205&fail=1', http, sources);
  expect(await screen.findByRole('heading', { level: 1, name: 'Look at this code to pay' })).toBeInTheDocument();
  expect(http.calls).toEqual([{ method: 'POST', url: '/api/kiosks',
    body: { name: 'Checkout 5', store: 'Demo Market', spotCheck: false, failPayment: true } }]);
  expect(screen.getByText('Checkout 5, Demo Market')).toBeInTheDocument();
  expect(sources.sources[0]?.url).toBe(`/api/kiosks/${encodeURIComponent(created.kioskId)}/events?token=${encodeURIComponent(created.token)}`);
  act(() => sources.sources[0]?.emit('message', JSON.stringify({ ...base, state: 'failed' })));
  expect(await screen.findByRole('heading', { level: 1, name: 'Payment failed. Nothing was charged.' })).toBeInTheDocument();
  act(() => sources.sources[0]?.emit('message', 'not json'));
  expect(screen.getByRole('heading', { level: 1, name: 'Payment failed. Nothing was charged.' })).toBeInTheDocument();
});
it('tries again while the server does not answer', async () => {
  let down = true;
  const http = fakeFetch(() => { if (down) throw new Error('down'); return { json: created }; });
  renderKiosk('/kiosk', http, fakeSources());
  expect(await screen.findByRole('heading', { level: 1, name: 'The store server does not answer' })).toBeInTheDocument();
  down = false;
  expect(await screen.findByRole('heading', { level: 1, name: 'Look at this code to pay' })).toBeInTheDocument();
  expect(http.calls.length).toBeGreaterThan(1);
});
```

- [ ] **Step 6: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/website -- Kiosk`
Expected: FAIL, because `KioskView` does not exist.

- [ ] **Step 7: Implement `KioskCode`, `KioskView`, `KioskPage`, and `kioskRun.ts`**

- [ ] **Step 8: Run all checks**

Run: `npm test --workspace @glance/website` and `npm run typecheck --workspace @glance/website`
Expected: PASS, and no type error. The test of Task 1 for `/kiosk?replay=1` still passes.

- [ ] **Step 9: Measure in a browser**

Open `http://localhost:5174/kiosk?replay=1` in a window of 1920 x 1080 at 100 percent zoom. Wait for the cart state, then run this in the console:

```js
const box = (selector) => document.querySelector(selector).getBoundingClientRect();
[parseFloat(getComputedStyle(document.querySelector('.kiosk-total')).fontSize) >= 160, box('.kiosk-row').height >= 48, box('.kiosk-code').width >= 567]
```

Expected: `[true, true, true]`. The page shows idle, cart, paid, idle, cart, and failed in turn, and the code does not move. A phone camera reads the code as `GL1 K3X7`.

Then open the page in full screen on the demo laptop, and measure the code with a ruler.
Expected: 15 cm or more. On a 16:9 screen this needs a diagonal of 14 inches or more. If the code is smaller, or if the 1.5 m test of spec section 16 fails, use a larger screen.

- [ ] **Step 10: Commit**

```bash
git add apps/website
git commit -m "feat(website): add the kiosk page with its states and the QR code"
```

---

### Task 7 (C3): Setup screen

**Files:**
- Create: `apps/mobile/ui/src/state/selectors.ts`, `apps/mobile/ui/src/screens/SetupScreen.tsx`
- Modify: `apps/mobile/ui/src/App.tsx`, `apps/mobile/ui/src/text/strings.ts`
- Test: `apps/mobile/ui/src/state/selectors.test.ts`, `apps/mobile/ui/src/screens/SetupScreen.test.tsx`

**Interfaces:**
- Consumes: `UiState`, `initialUiState` (Task 4), `useUi`, `renderWithUi` (Task 5), `NATIVE_NEW`, `NATIVE_READY` (Task 3).
- Produces:

```ts
// state/selectors.ts
export type Screen = 'loading' | 'setup' | 'session';
export function setupStepOf(native: NativeState): 0 | 1 | 2;   // 0: not registered. 1: camera not granted. 2: ready.
export function screenOf(state: UiState): Screen;              // 'loading' with no native state. 'session' at step 2 with a session ID. Else 'setup'.

// screens/SetupScreen.tsx
export const META_AI_STORE_URL = 'https://play.google.com/store/apps/details?id=com.facebook.stella';
export function SetupScreen(): JSX.Element;
```

The store address is the Play Store page that the DAT docs give for the Meta AI app (`dat/display-overview`, Requirements). The app of Plan 2 opens the link outside the page.

Strings of this task:

```ts
setupTitle: 'Set up Glance',
setupSteps: 'Setup',
loading: 'Starting Glance.',
stepLink: 'Link glasses', stepCamera: 'Allow camera', stepReady: 'Ready',
linkOpens: 'This opens the Meta AI app.',
linkConfirm: 'Confirm there that Glance may connect to your glasses.',
linkReturn: 'Meta AI then returns you to Glance.',
linking: 'Waiting for Meta AI.',
metaAiMissing: 'The Meta AI app is not on this phone. Install it, then return here.',
getMetaAi: 'Get Meta AI',
noInternet: 'No internet. Connect the phone, then try again.',
tryAgain: 'Try again',
cameraWhy: 'Glance uses the camera of your glasses to name the product that you hold. The phone blurs faces. No frame is stored.',
cameraOpens: 'This opens the Meta AI app again.',
cameraChoose: 'Choose Allow always or Allow once.',
cameraDenied: 'The camera permission was denied. Glance cannot name a product without it.',
readyText: 'Hold a product up to hear its price. Nod to add it. Look at a checkout code and nod to pay.',
start: 'Start shopping',
```

`SetupScreen` is `<VStack as="main">` with `<Heading level={1}>` (`setupTitle`) and `<Stepper orientation="vertical" label={setupSteps} activeStep={step}>` with three `Step` elements. Only the current step has children:

| Step | Condition | Text | Button |
|---|---|---|---|
| 0 | `metaAiInstalled` is false | `metaAiMissing` | `getMetaAi`, a `Button` with `href={META_AI_STORE_URL}` |
| 0 | `network` is `offline` | `noInternet` | `tryAgain` sends `setup.register` |
| 0 | `registration` is `registering` | `linking` | none |
| 0 | else | `linkOpens`, `linkConfirm`, `linkReturn` | `stepLink` sends `setup.register` |
| 1 | always | `cameraWhy`, `cameraOpens`, `cameraChoose`, `linkReturn`. With `cameraPermission: 'denied'` also `cameraDenied`. | `stepCamera` sends `setup.requestCamera` |
| 2 | always | `readyText` | `start` sends `session.start` |

`App` selects from `screenOf`: `SetupScreen`, `SessionScreen`, or for `loading` one `main` element with `appTitle` as `h1` and the text `loading`.

- [ ] **Step 1: Write the failing tests**

`selectors.test.ts`:

```ts
const at = (native: NativeState | null, sessionId: string | null = null): UiState => ({ ...initialUiState, native, sessionId });

it('picks the setup step from the native state', () => {
  expect(setupStepOf(NATIVE_NEW)).toBe(0);
  expect(setupStepOf({ ...NATIVE_NEW, registration: 'registered' })).toBe(1);
  expect(setupStepOf({ ...NATIVE_READY, cameraPermission: 'denied' })).toBe(1);
  expect(setupStepOf(NATIVE_READY)).toBe(2);
});
it('picks the screen', () => {
  expect(screenOf(at(null))).toBe('loading');
  expect(screenOf(at(NATIVE_NEW))).toBe('setup');
  expect(screenOf(at(NATIVE_READY))).toBe('setup');
  expect(screenOf(at(NATIVE_READY, 's-1'))).toBe('session');
  expect(screenOf(at(NATIVE_NEW, 's-1'))).toBe('setup');
});
```

`SetupScreen.test.tsx`:

```tsx
it('shows three steps and marks the current one', () => {
  renderWithUi(<SetupScreen />, { native: NATIVE_NEW });
  const steps = within(screen.getByRole('list', { name: 'Setup' })).getAllByRole('listitem');
  expect(steps).toHaveLength(3);
  expect(steps[0]).toHaveAttribute('aria-current', 'step');
  expect(steps.map((step) => step.textContent)).toEqual([
    expect.stringContaining('Link glasses'), expect.stringContaining('Allow camera'), expect.stringContaining('Ready'),
  ]);
});
it('says what opens, what to confirm, and how to return, then links the glasses', async () => {
  const { bridge, user } = renderWithUi(<SetupScreen />, { native: NATIVE_NEW });
  for (const text of ['This opens the Meta AI app.', 'Confirm there that Glance may connect to your glasses.', 'Meta AI then returns you to Glance.']) {
    expect(screen.getByText(text)).toBeInTheDocument();
  }
  await user.click(screen.getByRole('button', { name: 'Link glasses' }));
  expect(bridge.sent).toContainEqual({ t: 'setup.register' });
  expect(await screen.findByRole('button', { name: 'Allow camera' })).toBeInTheDocument();
});
it('explains the purpose of the camera before it asks', async () => {
  const { bridge, user } = renderWithUi(<SetupScreen />, { native: { ...NATIVE_NEW, registration: 'registered' } });
  expect(screen.getByText(EN.cameraWhy)).toBeInTheDocument();
  expect(screen.getByText('Choose Allow always or Allow once.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Allow camera' }));
  expect(bridge.sent).toContainEqual({ t: 'setup.requestCamera' });
});
it('explains a denied camera permission and asks again', () => {
  renderWithUi(<SetupScreen />, { native: { ...NATIVE_READY, cameraPermission: 'denied' } });
  expect(screen.getByText(EN.cameraDenied)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Allow camera' })).toBeInTheDocument();
});
it('offers the store when the Meta AI app is missing', () => {
  renderWithUi(<SetupScreen />, { native: { ...NATIVE_NEW, metaAiInstalled: false, registration: 'unavailable' } });
  expect(screen.getByRole('link', { name: 'Get Meta AI' })).toHaveAttribute('href', META_AI_STORE_URL);
  expect(screen.queryByRole('button', { name: 'Link glasses' })).toBeNull();
});
it('offers a new try with no internet', async () => {
  const { bridge, user } = renderWithUi(<SetupScreen />, { native: { ...NATIVE_NEW, network: 'offline' } });
  expect(screen.getByText(EN.noInternet)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(bridge.sent).toContainEqual({ t: 'setup.register' });
});
it('starts the session from the ready step', async () => {
  const { bridge, user } = renderWithUi(<SetupScreen />);
  await user.click(screen.getByRole('button', { name: 'Start shopping' }));
  expect(bridge.sent).toContainEqual({ t: 'session.start' });
});
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/phone-ui -- selectors SetupScreen`
Expected: FAIL, because the modules do not exist.

- [ ] **Step 3: Implement `selectors.ts`, `SetupScreen`, and the screen switch in `App`**

- [ ] **Step 4: Run all checks**

Run: `npm test --workspace @glance/phone-ui` and `npm run typecheck --workspace @glance/phone-ui`
Expected: PASS, and no type error.

- [ ] **Step 5: Check the flow in a browser**

Open `http://localhost:5173/`.
Expected: the setup screen shows step 1. Link glasses moves to step 2, Allow camera moves to step 3, and Start shopping shows the session screen. `?ready=1` starts at step 3. `?replay=1&ready=1` shows the session screen at once, because the run brings a session.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/ui
git commit -m "feat(ui): add the setup screen with three steps"
```

---

### Task 8 (C3): Checkout sheet and receipt

**Files:**
- Create: `apps/mobile/ui/src/components/CheckoutSheet.tsx`
- Modify: `apps/mobile/ui/src/screens/SessionScreen.tsx`, `apps/mobile/ui/src/text/strings.ts`
- Test: `apps/mobile/ui/src/components/CheckoutSheet.test.tsx`

**Interfaces:**
- Consumes: `useUi`, `renderWithUi`, `eur`, `eventMessage`, `eventFixture` (Tasks 3 and 5).
- Produces: `export function CheckoutSheet(): JSX.Element`. `SessionScreen` renders it.

Strings of this task:

```ts
checkout: 'Checkout', pay: 'Pay', cancel: 'Cancel',
payee: (kiosk: string, store: string) => `${kiosk} at ${store}`,
receipt: 'Receipt', paid: 'Paid', order: (id: string) => `Order ${id}`,
demoPayment: 'Demo payment. No money moved.',
done: 'Done',
```

Decisions:

- One `BottomSheet` with `purpose="form"` and `height="hug"`. It is open while the prompt is a pay prompt, or while `checkout` is `paid`.
- Pay view, with the label `checkout`: `payee(kiosk.name, kiosk.store)`, `items(itemCount)`, the total, then `pay` (primary, `size="lg"`) and `cancel`. Pay sends `{ t: 'intent', kind: 'yes', promptId }`. Cancel sends the same with `kind: 'no'`.
- The server sends no event when a payment starts. After a tap on Pay, the button shows `isLoading`, and the sheet sends nothing more for that `promptId`.
- A dismissed sheet (`onOpenChange(false)`, for example the back key) counts as Cancel.
- While `state.error` is set, the pay view shows its message in a `Banner` with `status="warning"`. The main screen is under the sheet then.
- Receipt view, with the label `receipt`: `<Heading level={2}>` with `paid`, the total, the payee line, each receipt line, `order(orderId)`, the time of `paidAt`, `demoPayment`, and `done`. Done runs `dispatch({ t: 'local.reset' })`.

- [ ] **Step 1: Write the failing test**

```tsx
const offered = eventFixture('checkout.offered');
const offer = eventMessage('checkout.offered', { needsBiometric: false });
const sheet = (name: string) => within(screen.getByRole('dialog', { name }));
const intents = (bridge: BrowserBridge) => bridge.sent.filter((message) => message.t === 'intent');

it('names the kiosk, the store, and the total before the payment', () => {
  renderWithUi(<SessionScreen />, { messages: [offer] });
  expect(sheet('Checkout').getByText('Checkout 3 at Demo Market')).toBeInTheDocument();
  expect(sheet('Checkout').getByText(eur(offered.totalCents))).toBeInTheDocument();
});
it('pays one time with the ID of the pay prompt, also after two fast taps', async () => {
  const { bridge, user } = renderWithUi(<SessionScreen />, { messages: [offer] });
  const pay = sheet('Checkout').getByRole('button', { name: 'Pay' });
  await user.click(pay);
  await user.click(pay);
  await user.click(sheet('Checkout').getByRole('button', { name: 'Cancel' }));
  expect(intents(bridge)).toEqual([{ t: 'intent', kind: 'yes', promptId: 'p-0001' }]);
});
it('cancels with the ID of the pay prompt', async () => {
  const { bridge, user } = renderWithUi(<SessionScreen />, { messages: [offer] });
  await user.click(sheet('Checkout').getByRole('button', { name: 'Cancel' }));
  expect(intents(bridge)).toEqual([{ t: 'intent', kind: 'no', promptId: 'p-0001' }]);
});
it('cancels when the shopper dismisses the sheet', () => {
  const { bridge } = renderWithUi(<SessionScreen />, { messages: [offer] });
  fireEvent.keyDown(screen.getByRole('dialog', { name: 'Checkout' }), { key: 'Escape' });
  expect(intents(bridge)).toEqual([{ t: 'intent', kind: 'no', promptId: 'p-0001' }]);
});
it('takes a new pay prompt after a cart change', async () => {
  const { bridge, user, deliver } = renderWithUi(<SessionScreen />, { messages: [offer] });
  deliver(eventMessage('checkout.offered', { promptId: 'p-0002', totalCents: 260, itemCount: 1 }));
  expect(sheet('Checkout').getByText('2.60 EUR')).toBeInTheDocument();
  await user.click(sheet('Checkout').getByRole('button', { name: 'Pay' }));
  expect(intents(bridge)).toEqual([{ t: 'intent', kind: 'yes', promptId: 'p-0002' }]);
});
it('shows an error of the app inside the sheet', () => {
  const message = 'Set a screen lock or a fingerprint on this phone first.';
  renderWithUi(<SessionScreen />, { messages: [offer, eventMessage('error', { code: 'native.biometric_unavailable', message })] });
  expect(sheet('Checkout').getByText(message)).toBeInTheDocument();
});
it('closes while checkout is suspended', () => {
  renderWithUi(<SessionScreen />, { messages: [offer, eventMessage('checkout.suspended')] });
  expect(screen.queryByRole('dialog', { name: 'Checkout' })).toBeNull();
});
it('shows the receipt with the demo line after the payment', () => {
  const paid = eventFixture('checkout.paid');
  renderWithUi(<SessionScreen />, { messages: [offer, eventMessage('checkout.paid')] });
  expect(sheet('Receipt').getByRole('heading', { name: 'Paid' })).toBeInTheDocument();
  expect(sheet('Receipt').getByText(eur(paid.totalCents))).toBeInTheDocument();
  for (const item of paid.items) expect(sheet('Receipt').getByText(item.name)).toBeInTheDocument();
  expect(sheet('Receipt').getByText('Demo payment. No money moved.')).toBeInTheDocument();
});
it('clears the session after Done', async () => {
  const { user } = renderWithUi(<SessionScreen />, { messages: [eventMessage('cart.updated'), offer, eventMessage('checkout.paid')] });
  await user.click(sheet('Receipt').getByRole('button', { name: 'Done' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByText('Your cart is empty.')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `npm test --workspace @glance/phone-ui -- CheckoutSheet`
Expected: FAIL, because `CheckoutSheet` does not exist.

- [ ] **Step 3: Implement `CheckoutSheet` and render it in `SessionScreen`**

- [ ] **Step 4: Run all checks**

Run: `npm test --workspace @glance/phone-ui` and `npm run typecheck --workspace @glance/phone-ui`
Expected: PASS, and no type error.

- [ ] **Step 5: Check the sheet in a browser**

Open `http://localhost:5173/?replay=1&ready=1`.
Expected: after 9 seconds the sheet shows "Checkout 3 at Demo Market" and "4.49 EUR". After 13 seconds it shows "Paid" and "Demo payment. No money moved.". Done returns to the ready step.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/ui
git commit -m "feat(ui): add the checkout sheet and the receipt"
```

---

### Task 9 (C3): Settings sheet

**Files:**
- Create: `apps/mobile/ui/src/components/SettingsSheet.tsx`
- Modify: `apps/mobile/ui/src/bridge/BridgeContext.tsx`, `apps/mobile/ui/src/screens/SessionScreen.tsx`, `apps/mobile/ui/src/text/strings.ts`
- Test: `apps/mobile/ui/src/components/SettingsSheet.test.tsx`

**Interfaces:**
- Consumes: `useUi`, `renderWithUi`. `ProfilePatch`, `DEFAULT_PROFILE` from `@glance/shared`.
- Produces:
  - `Ui.setProfile(patch: ProfilePatch): void`. It runs `dispatch({ t: 'local.profile', patch })`, then `send({ t: 'profile.set', patch })`.
  - `export const SPEECH_RATES = [0.8, 1, 1.2, 1.5, 2] as const`.
  - `export function SettingsSheet(props: { isOpen: boolean; onClose(): void }): JSX.Element`. `SessionScreen` opens it from a button with the label `settings`, in one `HStack` with `wrap="wrap"`: the action row.

Strings of this task:

```ts
settings: 'Settings',
voiceDetail: 'Voice detail', brief: 'Brief', standard: 'Standard', detailed: 'Detailed',
speechSpeed: 'Speech speed', rate: (value: number) => `${value.toFixed(1)}x`, playSample: 'Play sample',
inputAndFeedback: 'Input and feedback', headGestures: 'Head gestures', haptics: 'Haptics',
gestureMeaning: 'Gesture meaning', nodIsYes: 'Nod is yes', shakeIsYes: 'Shake is yes',
headWindow: 'Head window', window8: '8 seconds', window15: '15 seconds', windowInView: 'While in view',
mainYes: 'Main yes input', yesHead: 'Head', yesTouch: 'Touch', yesVoice: 'Voice', yesPhone: 'Phone', yesKey: 'Keys',
privacyTitle: 'Privacy',
privacyText: 'The phone blurs faces and crops each frame before it leaves the phone. The server holds a frame for one recognition call and never stores it. Glance stores your cart, your preferences, and your receipt. It stores no account and no name.',
deleteData: 'Delete my data',
deleteTitle: 'Delete my data?',
deleteText: 'This deletes your session, your cart, and your order from the server.',
deleteConfirm: 'Delete', deleteCancel: 'Keep',
```

Controls, inside one `BottomSheet` with the label `settings` and `height="tall"`:

| Preference | Control | Patch |
|---|---|---|
| Voice detail | `SegmentedControl` with `brief`, `standard`, `detailed` | `{ detail }` |
| Speech speed | `SegmentedControl` with one segment for each value of `SPEECH_RATES`, then the button `playSample` | `{ speechRate }`. The button sends `{ t: 'intent', kind: 'help' }`. |
| Head gestures, haptics | One `CheckboxList` with the label `inputAndFeedback` | `{ headGestures }` or `{ haptics }`: only the key that changed |
| Gesture meaning | `SegmentedControl` with `nodIsYes`, `shakeIsYes` | `{ yesGesture: 'nod' }` or `{ yesGesture: 'shake' }` |
| Head window | `SegmentedControl` with `window8`, `window15`, `windowInView` | `{ headWindowMs: 8000 }`, `15000`, or `null` |
| Main yes input | `SegmentedControl` with `yesHead`, `yesTouch`, `yesVoice`, `yesPhone`, `yesKey` | `{ mainYes: 'head' }`, `'touch'`, `'voice'`, `'phone'`, or `'key'` |

- A speed of five steps replaces the slider of the UI research. A `Slider` thumb is 20 px, and its touch area stops at 44 px.
- A speech rate that is not in `SPEECH_RATES` marks the nearest value.
- The last row is not in spec section 6.5 (gap 6). The voice names this input in each prompt, and the app of Plan 2 can change the value when the glasses lack a capability.
- After the controls: `<Heading level={2}>` with `privacyTitle`, `privacyText`, and the button `deleteData` (`variant="destructive"`). It opens an `AlertDialog` with `deleteTitle`, `deleteText`, `deleteConfirm`, and `deleteCancel`. Delete sends `{ t: 'data.delete' }`, runs `dispatch({ t: 'local.reset' })`, and closes the dialog and the sheet. The privacy page of Plan 4 names this button.

- [ ] **Step 1: Write the failing test**

```tsx
const open = async (options?: Parameters<typeof renderWithUi>[1]) => {
  const ui = renderWithUi(<SessionScreen />, options);
  await ui.user.click(screen.getByRole('button', { name: 'Settings' }));
  return { ...ui, sheet: within(screen.getByRole('dialog', { name: 'Settings' })) };
};
const patches = (bridge: BrowserBridge) => bridge.sent.flatMap((message) => (message.t === 'profile.set' ? [message.patch] : []));

it('sends each preference as a profile patch', async () => {
  const { bridge, user, sheet } = await open();
  await user.click(sheet.getByRole('radio', { name: 'Brief' }));
  await user.click(sheet.getByRole('radio', { name: '1.5x' }));
  await user.click(sheet.getByRole('checkbox', { name: 'Head gestures' }));
  await user.click(sheet.getByRole('checkbox', { name: 'Haptics' }));
  await user.click(sheet.getByRole('radio', { name: 'Shake is yes' }));
  await user.click(sheet.getByRole('radio', { name: 'While in view' }));
  await user.click(sheet.getByRole('radio', { name: 'Voice' }));
  expect(patches(bridge)).toEqual([
    { detail: 'brief' }, { speechRate: 1.5 }, { headGestures: false }, { haptics: false }, { yesGesture: 'shake' },
    { headWindowMs: null }, { mainYes: 'voice' },
  ]);
});
it('shows a new value at once', async () => {
  const { user, sheet } = await open();
  await user.click(sheet.getByRole('radio', { name: 'Brief' }));
  expect(sheet.getByRole('radio', { name: 'Brief' })).toHaveAttribute('aria-checked', 'true');
});
it('marks the nearest speed for a rate that is not in the list', async () => {
  const { sheet } = await open({ messages: [{ t: 'profile', profile: { ...DEFAULT_PROFILE, speechRate: 1.3 } }] });
  expect(sheet.getByRole('radio', { name: '1.2x' })).toHaveAttribute('aria-checked', 'true');
});
it('plays a sample line', async () => {
  const { bridge, user, sheet } = await open();
  await user.click(sheet.getByRole('button', { name: 'Play sample' }));
  expect(bridge.sent).toContainEqual({ t: 'intent', kind: 'help' });
});
it('asks before it deletes the data', async () => {
  const { bridge, user, sheet } = await open({ messages: [eventMessage('cart.updated')] });
  await user.click(sheet.getByRole('button', { name: 'Delete my data' }));
  await user.click(within(screen.getByRole('alertdialog', { name: 'Delete my data?' })).getByRole('button', { name: 'Keep' }));
  expect(bridge.sent).not.toContainEqual({ t: 'data.delete' });
  await user.click(sheet.getByRole('button', { name: 'Delete my data' }));
  await user.click(within(screen.getByRole('alertdialog', { name: 'Delete my data?' })).getByRole('button', { name: 'Delete' }));
  expect(bridge.sent).toContainEqual({ t: 'data.delete' });
  expect(screen.getByText('Your cart is empty.')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `npm test --workspace @glance/phone-ui -- SettingsSheet`
Expected: FAIL, because `SettingsSheet` does not exist.

- [ ] **Step 3: Implement `setProfile`, `SettingsSheet`, and the Settings button**

- [ ] **Step 4: Run all checks**

Run: `npm test --workspace @glance/phone-ui` and `npm run typecheck --workspace @glance/phone-ui`
Expected: PASS, and no type error.

- [ ] **Step 5: Check the sheet in a browser**

Open `http://localhost:5173/?ready=1`, press Start shopping, and open Settings at a width of 360 px.
Expected: each control fits the width, and `glanceBridge.sent` lists a `profile.set` message for each change.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/ui
git commit -m "feat(ui): add the settings sheet with the core preferences"
```

---

### Task 10 (C3): State banner and status row

**Files:**
- Create: `apps/mobile/ui/src/state/banner.ts`, `apps/mobile/ui/src/components/StateBanner.tsx`, `apps/mobile/ui/src/components/StatusRow.tsx`
- Modify: `apps/mobile/ui/src/bridge/fakeNative.ts`, `apps/mobile/ui/src/bridge/createBridge.ts`, `apps/mobile/ui/src/screens/SessionScreen.tsx`, `apps/mobile/ui/src/screens/SetupScreen.tsx`, `apps/mobile/ui/src/text/strings.ts`
- Test: `apps/mobile/ui/src/state/banner.test.ts`, `apps/mobile/ui/src/components/StateBanner.test.tsx`

**Interfaces:**
- Consumes: `UiState`, `UiAction`, `setupStepOf`, `useUi`, `SetupScreen`, `SessionScreen`, `NATIVE_NEW`, `NATIVE_READY`.
- Produces:

```ts
// bridge/fakeNative.ts
export type NativePresetKey = 'ready' | 'metaAiMissing' | 'notRegistered' | 'cameraDenied' | 'glassesNotFound' | 'updateRequired'
  | 'paused' | 'stopped' | 'offFace' | 'battery20' | 'battery10' | 'tooWarm' | 'batteryFlat' | 'offline';
export const NATIVE_PRESETS: Record<NativePresetKey, NativeState>;

// state/banner.ts
export type BannerId = 'paymentFailed' | 'serverUnreachable' | 'regularCheckout' | 'glassesNotFound' | 'updateRequired'
  | 'ended' | 'resting' | 'stopped' | 'paused' | 'offFace' | 'error' | 'batteryLow';
export type BannerAction = { label: string; send: PageToNative } | { label: string; dispatch: UiAction };
export type BannerModel = { id: BannerId; status: 'info' | 'warning' | 'error'; title: string; description: string | null; action: BannerAction | null };
export const REGULAR_CHECKOUT_BATTERY = 5;   // percent, as cannotStream in Plan 1
export const REGULAR_CHECKOUT_THERMAL = 6;   // level 0 to 7
export function bannerOf(state: UiState, strings: Strings): BannerModel | null;

// components
export function StateBanner(): JSX.Element | null;
export function StatusRow(): JSX.Element;
```

Presets. Each one starts from `NATIVE_READY`, except the first three:

| Key | Change |
|---|---|
| `ready` | none |
| `metaAiMissing` | `NATIVE_NEW` with `metaAiInstalled: false`, `registration: 'unavailable'` |
| `notRegistered` | `NATIVE_NEW` |
| `cameraDenied` | `cameraPermission: 'denied'` |
| `glassesNotFound` | `device: null` |
| `updateRequired` | `device.updateRequired: true` |
| `paused` | `session: 'paused'`, `stream: 'paused'` |
| `stopped` | `session: 'stopped'`, `stream: 'stopped'` |
| `offFace` | `device.worn: false` |
| `battery20`, `battery10` | `device.battery: 20`, `10` |
| `tooWarm` | `stopped` with `device.thermal: 6` |
| `batteryFlat` | `stopped` with `device.battery: 3` |
| `offline` | `network: 'offline'` |

`bannerOf` returns `null` with no native state. While `setupStepOf(native)` is under 2, only the row `error` applies. If not, the first row that applies wins:

| ID | Condition | Status | Title | Description | Action |
|---|---|---|---|---|---|
| `paymentFailed` | `checkout` is `failed` | error | Payment failed. | Nothing was charged. Look at the code to try again. | |
| `serverUnreachable` | `network` is `offline` | error | Connection lost. | Your cart is safe. Glances are paused. | |
| `regularCheckout` | `session` is `stopped`, and the battery is 5 or less or the thermal level is 6 or more | error | Camera off. | Please use a regular checkout. Your cart stays on this phone as a list. | |
| `glassesNotFound` | `device` is `null`, or its `link` is `disconnected` | warning | Glasses not found. | Unfold your glasses and keep them near the phone. | |
| `updateRequired` | `device.updateRequired` | warning | Update required. | Update your glasses before you shop with Glance. | "Open the update in Meta AI" sends `setup.openUpdate` |
| `ended` | `phase` is `ended` | info | Camera off. | This shop has ended. Your cart shows below as a list. | "Start a new shop" dispatches `local.reset` |
| `resting` | `phase` is `resting` | info | Camera off. | No product was in view for 3 minutes. Your cart is safe. | "Start camera" sends `session.start` |
| `stopped` | `sessionId` is set, `session` is `stopped`, and `phase` is not `paid` | info | Camera off. | `error.message`, if an error is set | "Start camera" sends `session.start` |
| `paused` | `session` or `stream` is `paused` | info | Paused. | Tap the side of your glasses to resume. | |
| `offFace` | `device.worn` is `false` | info | Glasses are off your face. | Glances are paused. Put the glasses on to continue. | |
| `error` | `error` is set | warning | `error.message` | | |
| `batteryLow` | the battery is 20 or less | info | Glasses battery at `<n>` percent. | | |

The title and the description together hold the spoken line of spec section 6.6. Put each text into `strings.ts` under the key `banner`.

`StateBanner` renders `bannerOf` with one Astryx `Banner` (`status`, `title`, `description`) and the action as a `Button` in `endContent`. `SessionScreen` and `SetupScreen` render it as the first child of `main`.

`StatusRow` shows four `Text` elements: `Glasses: Connected` or `Glasses: Not connected`, `Battery: 80%` or `Battery: Unknown`, `Camera: On`, `Camera: Paused`, or `Camera: Off` (from `native.stream`), and `Network: Online` or `Network: Offline`. `SessionScreen` shows it under the heading.

`createBridge` reads the flag `native`: a key of `NATIVE_PRESETS` selects the start state of the `BrowserBridge`.

- [ ] **Step 1: Write the failing tests**

`banner.test.ts`:

```ts
const base: UiState = { ...initialUiState, native: NATIVE_READY };
const shopping: UiState = { ...base, sessionId: 's-1', phase: 'shopping' };
const id = (state: UiState) => bannerOf(state, EN)?.id ?? null;
const line = (state: UiState) => {
  const banner = bannerOf(state, EN);
  return banner ? [banner.title, banner.description].filter(Boolean).join(' ') : null;
};

it('shows no banner when all is well', () => {
  expect(id(base)).toBeNull();
  expect(id(shopping)).toBeNull();
  expect(id({ ...initialUiState, native: null })).toBeNull();
});
it('shows only an error of the app before setup is done', () => {
  const offlineAtSetup: UiState = { ...shopping, native: { ...NATIVE_PRESETS.cameraDenied, network: 'offline' } };
  expect(id(offlineAtSetup)).toBeNull();
  expect(id({ ...shopping, native: NATIVE_PRESETS.notRegistered })).toBeNull();
  const denied = { code: 'native.bluetooth_denied', message: 'Allow Bluetooth to connect your glasses.' };
  expect(line({ ...initialUiState, native: NATIVE_PRESETS.notRegistered, error: denied })).toBe('Allow Bluetooth to connect your glasses.');
});
it.each([
  ['glassesNotFound', 'glassesNotFound'], ['updateRequired', 'updateRequired'], ['paused', 'paused'], ['stopped', 'stopped'],
  ['offFace', 'offFace'], ['battery20', 'batteryLow'], ['battery10', 'batteryLow'], ['tooWarm', 'regularCheckout'],
  ['batteryFlat', 'regularCheckout'], ['offline', 'serverUnreachable'],
] as const)('maps the native state %s to the banner %s', (preset, banner) => {
  expect(id({ ...shopping, native: NATIVE_PRESETS[preset] })).toBe(banner);
});
it('uses the spoken lines of the design', () => {
  expect(line({ ...shopping, native: NATIVE_PRESETS.paused })).toBe('Paused. Tap the side of your glasses to resume.');
  expect(line({ ...shopping, native: NATIVE_PRESETS.stopped })).toBe('Camera off.');
  expect(line({ ...shopping, native: NATIVE_PRESETS.offline })).toBe('Connection lost. Your cart is safe. Glances are paused.');
  expect(line({ ...shopping, native: NATIVE_PRESETS.battery20 })).toBe('Glasses battery at 20 percent.');
  expect(line({ ...shopping, native: NATIVE_PRESETS.tooWarm })).toContain('Camera off. Please use a regular checkout.');
  expect(line({ ...shopping, native: NATIVE_PRESETS.glassesNotFound })).toBe('Glasses not found. Unfold your glasses and keep them near the phone.');
  expect(line({ ...shopping, checkout: 'failed' })).toBe('Payment failed. Nothing was charged. Look at the code to try again.');
  expect(line({ ...shopping, error: { code: 'recognition.slow', message: 'Recognition is slow right now.' } })).toBe('Recognition is slow right now.');
});
it('adds the cause of the app to the stopped banner', () => {
  const error = { code: 'native.hinge_closed', message: 'Unfold your glasses to continue.' };
  expect(line({ ...shopping, native: NATIVE_PRESETS.stopped, error })).toBe('Camera off. Unfold your glasses to continue.');
});
it('shows one banner by priority', () => {
  expect(id({ ...shopping, checkout: 'failed', native: NATIVE_PRESETS.offline })).toBe('paymentFailed');
  expect(id({ ...shopping, native: { ...NATIVE_PRESETS.offline, device: null } })).toBe('serverUnreachable');
  expect(id({ ...shopping, phase: 'resting', native: NATIVE_PRESETS.stopped })).toBe('resting');
  expect(id({ ...shopping, phase: 'ended', native: NATIVE_PRESETS.stopped })).toBe('ended');
  expect(id({ ...shopping, phase: 'paid', native: NATIVE_PRESETS.stopped })).toBeNull();
  expect(id({ ...base, native: NATIVE_PRESETS.stopped })).toBeNull();
});
it('offers the action that recovers', () => {
  expect(bannerOf({ ...shopping, native: NATIVE_PRESETS.updateRequired }, EN)?.action).toEqual({ label: 'Open the update in Meta AI', send: { t: 'setup.openUpdate' } });
  expect(bannerOf({ ...shopping, native: NATIVE_PRESETS.stopped }, EN)?.action).toEqual({ label: 'Start camera', send: { t: 'session.start' } });
  expect(bannerOf({ ...shopping, phase: 'ended' }, EN)?.action).toEqual({ label: 'Start a new shop', dispatch: { t: 'local.reset' } });
});
```

`StateBanner.test.tsx`:

```tsx
it('shows the banner of the state, and its action', async () => {
  const { bridge, user } = renderWithUi(<StateBanner />, { native: NATIVE_PRESETS.updateRequired });
  expect(screen.getByText('Update required.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Open the update in Meta AI' }));
  expect(bridge.sent).toContainEqual({ t: 'setup.openUpdate' });
});
it('shows no banner when all is well', () => {
  renderWithUi(<StateBanner />);
  expect(document.querySelector('.astryx-banner')).toBeNull();
});
it('removes an error of the app when the shopper tries again', async () => {
  const message = 'The link to Meta AI failed. Try again.';
  const failed = eventMessage('error', { code: 'native.registration_failed', message });
  const { user } = renderWithUi(<SetupScreen />, { native: NATIVE_NEW, messages: [failed] });
  expect(screen.getByText(message)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Link glasses' }));
  expect(screen.queryByText(message)).toBeNull();
});
it('pairs each device status with a word', () => {
  renderWithUi(<StatusRow />, { native: { ...NATIVE_PRESETS.paused, network: 'offline', device: null } });
  for (const text of ['Glasses: Not connected', 'Battery: Unknown', 'Camera: Paused', 'Network: Offline']) {
    expect(screen.getByText(text)).toBeInTheDocument();
  }
});
it('starts the browser bridge in the native state of the address', () => {
  const bridge = createBridge({}, '?native=glassesNotFound');
  const seen: NativeToPage[] = [];
  bridge.subscribe((message) => seen.push(message));
  bridge.send({ t: 'ui.ready' });
  expect(seen[0]).toEqual({ t: 'native.state', state: NATIVE_PRESETS.glassesNotFound });
});
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/phone-ui -- banner StateBanner`
Expected: FAIL, because `banner.ts` does not exist.

- [ ] **Step 3: Implement the presets, `bannerOf`, `StateBanner`, `StatusRow`, and the `native` flag**

- [ ] **Step 4: Run all checks**

Run: `npm test --workspace @glance/phone-ui` and `npm run typecheck --workspace @glance/phone-ui`
Expected: PASS, and no type error.

- [ ] **Step 5: Check each state in a browser**

Open `http://localhost:5173/?native=<key>` for each of the 14 keys.
Expected: `metaAiMissing`, `notRegistered`, and `cameraDenied` show their setup step. Each other key shows its banner on the ready step, and `ready` shows none. `stopped` needs a session: open `?native=stopped&replay=1`, and the banner "Camera off." shows with the button "Start camera".

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/ui
git commit -m "feat(ui): add one banner for the device and error states"
```

---

### Task 11 (C3): A phone button for each action, and haptics

**Files:**
- Create: `apps/mobile/ui/src/state/haptics.ts`
- Modify: `apps/mobile/ui/src/screens/SessionScreen.tsx`, `apps/mobile/ui/src/components/CartList.tsx`, `apps/mobile/ui/src/components/CaptionList.tsx`, `apps/mobile/ui/src/bridge/BridgeContext.tsx`, `apps/mobile/ui/src/text/strings.ts`
- Test: `apps/mobile/ui/src/state/haptics.test.ts`, `apps/mobile/ui/src/screens/SessionScreen.actions.test.tsx`

**Interfaces:**
- Consumes: `UiState`, `UiAction`, `reduce`, `NATIVE_PRESETS`, `renderWithUi`. `HapticPattern` from `@glance/shared`.
- Produces: `export function hapticFor(before: UiState, action: UiAction, after: UiState): HapticPattern | null`.

Strings of this task:

```ts
undo: 'Undo', end: 'End',
repeat: 'Repeat', repeatLabel: 'Repeat the last line',
remove: 'Remove', removeLabel: (name: string) => `Remove ${name}`,
endTitle: 'End this shop?',
endText: 'The camera stops. You cannot add products to this cart after that.',
endConfirm: 'End', endCancel: 'Keep shopping',
```

Buttons (spec section 6.3, the phone column):

| Button | Where | Sends |
|---|---|---|
| `undo` | Action row. Hidden while the cart is empty. | `{ t: 'intent', kind: 'undo' }` |
| `repeat`, with the name `repeatLabel` | Under the captions. Hidden with no caption. | `{ t: 'intent', kind: 'repeat' }` |
| `remove`, with the name `removeLabel(item.name)` | Each cart line | `{ t: 'cart.edit', productId, qty: item.qty - 1 }` |
| `end` | Action row | Opens an `AlertDialog` (`endTitle`, `endText`, `endConfirm`, `endCancel`). End sends `{ t: 'session.end' }`. |

- The spec names a tap on the caption for the repeat. A button under the captions does the same, and it has a name for TalkBack.
- End has a confirm step, because the server takes no input for a session that ended.
- `hapticFor` returns `null` when `after.profile.haptics` is false. The test lists each pattern. A prompt with a warning gives `warning`, not `prompt`. A stream that changes to `paused` gives `cameraPaused`. A stream that changes from `streaming` or `paused` to `stopped` gives `cameraOff`.
- `BridgeProvider` calls `hapticFor` for each incoming message, and sends `{ t: 'haptic', pattern }` for a result. The app vibrates only for these messages.

- [ ] **Step 1: Write the failing tests**

`haptics.test.ts`:

```ts
const on: UiState = { ...initialUiState, native: NATIVE_READY };
const streaming: UiState = { ...on, native: { ...NATIVE_READY, session: 'started', stream: 'streaming' } };
const pattern = (action: UiAction, before: UiState = on) => hapticFor(before, action, reduce(before, action));
const change = (kind: 'add' | 'remove') => ({ kind, productId: 'oat-drink-1l', name: 'Oat drink' });

it('maps each event to the pattern of the design', () => {
  expect(pattern(eventMessage('glance.pending', { warnings: [] }))).toBe('prompt');
  expect(pattern(eventMessage('glance.pending', { warnings: [{ kind: 'allergenDataMissing' }] }))).toBe('warning');
  expect(pattern(eventMessage('checkout.offered'))).toBe('prompt');
  expect(pattern(eventMessage('cart.updated', { change: change('add') }))).toBe('added');
  expect(pattern(eventMessage('cart.updated', { change: change('remove') }))).toBe('removed');
  expect(pattern(eventMessage('cart.updated', { change: null }))).toBeNull();
  expect(pattern(eventMessage('budget.exceeded'))).toBe('warning');
  expect(pattern(eventMessage('checkout.paid'))).toBe('paid');
  expect(pattern(eventMessage('checkout.failed'))).toBe('error');
  expect(pattern(eventMessage('error'))).toBe('error');
  expect(pattern(eventMessage('caption'))).toBeNull();
});
it('signals a paused and a stopped camera one time', () => {
  expect(pattern({ t: 'native.state', state: NATIVE_PRESETS.paused }, streaming)).toBe('cameraPaused');
  expect(pattern({ t: 'native.state', state: NATIVE_PRESETS.stopped }, streaming)).toBe('cameraOff');
  expect(pattern({ t: 'native.state', state: NATIVE_PRESETS.stopped }, { ...on, native: NATIVE_PRESETS.stopped })).toBeNull();
});
it('stays silent when haptics are off', () => {
  expect(pattern(eventMessage('checkout.paid'), { ...on, profile: { ...DEFAULT_PROFILE, haptics: false } })).toBeNull();
});
```

`SessionScreen.actions.test.tsx`:

```tsx
const actions = (bridge: BrowserBridge) => bridge.sent.filter((message) => message.t !== 'ui.ready' && message.t !== 'haptic');

it('has a phone button for undo, repeat, and remove', async () => {
  const { bridge, user } = renderWithUi(<SessionScreen />, { messages: [eventMessage('cart.updated'), eventMessage('caption')] });
  const item = eventFixture('cart.updated').cart.items[0]!;
  await user.click(screen.getByRole('button', { name: 'Undo' }));
  await user.click(screen.getByRole('button', { name: 'Repeat the last line' }));
  await user.click(screen.getByRole('button', { name: `Remove ${item.name}` }));
  expect(actions(bridge)).toEqual([
    { t: 'intent', kind: 'undo' },
    { t: 'intent', kind: 'repeat' },
    { t: 'cart.edit', productId: item.productId, qty: item.qty - 1 },
  ]);
});
it('hides undo and repeat when there is nothing to undo or to repeat', () => {
  renderWithUi(<SessionScreen />);
  expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Repeat the last line' })).toBeNull();
});
it('asks before it ends the shop', async () => {
  const { bridge, user } = renderWithUi(<SessionScreen />);
  await user.click(screen.getByRole('button', { name: 'End' }));
  await user.click(within(screen.getByRole('alertdialog', { name: 'End this shop?' })).getByRole('button', { name: 'Keep shopping' }));
  expect(actions(bridge)).toEqual([]);
  await user.click(screen.getByRole('button', { name: 'End' }));
  await user.click(within(screen.getByRole('alertdialog', { name: 'End this shop?' })).getByRole('button', { name: 'End' }));
  expect(actions(bridge)).toEqual([{ t: 'session.end' }]);
});
it('sends one haptic pattern for a message', () => {
  const { bridge } = renderWithUi(<SessionScreen />, { messages: [eventMessage('cart.updated', { change: { kind: 'add', productId: 'oat-drink-1l', name: 'Oat drink' } })] });
  expect(bridge.sent.filter((message) => message.t === 'haptic')).toEqual([{ t: 'haptic', pattern: 'added' }]);
});
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/phone-ui -- haptics actions`
Expected: FAIL, because `haptics.ts` does not exist.

- [ ] **Step 3: Implement `hapticFor`, the haptic message in `BridgeProvider`, and the four buttons**

- [ ] **Step 4: Run all checks**

Run: `npm test --workspace @glance/phone-ui` and `npm run typecheck --workspace @glance/phone-ui`
Expected: PASS, and no type error.

- [ ] **Step 5: Check in a browser**

Open `http://localhost:5173/?replay=1&ready=1` and press each button.
Expected: `glanceBridge.sent` lists each action, and one `haptic` message for each event of the run.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/ui
git commit -m "feat(ui): add a phone button for each action, and haptic messages"
```

---

### Task 12 (C3): Pocket mode

**Files:**
- Create: `apps/mobile/ui/src/components/PocketMode.tsx`, `apps/mobile/ui/src/styles/pocket.css`
- Modify: `apps/mobile/ui/src/screens/SessionScreen.tsx`, `apps/mobile/ui/src/styles/globals.css`, `apps/mobile/ui/src/text/strings.ts`
- Test: `apps/mobile/ui/src/components/PocketMode.test.tsx`

**Interfaces:**
- Consumes: `useUi`, `eur`, `itemCount`, `renderWithUi`.
- Produces: `export function PocketMode(props: { onLeave(): void }): JSX.Element`.

Strings of this task:

```ts
pocketMode: 'Pocket mode', unlock: 'Unlock',
leavePocketTitle: 'Leave pocket mode?',
leavePocketText: 'The screen shows your cart again.',
leave: 'Leave', stay: 'Stay',
```

Decisions:

- The button `pocketMode` in the action row sends `{ t: 'pocket.set', on: true }`. `SessionScreen` then renders `PocketMode` in place of all its other content.
- `PocketMode` is `<Theme theme={themes[defaultThemeSlug]} mode="dark">` around `<VStack as="main" className="pocket-screen">`. It shows `<Heading level={1}>` (`pocketMode`), the total as `<Text type="display-1">`, `items(itemCount(cart))`, and the button `unlock`.
- Unlock opens an `AlertDialog` (`leavePocketTitle`, `leavePocketText`, `leave`, `stay`, with `actionVariant="primary"`). Leave sends `{ t: 'pocket.set', on: false }` and calls `onLeave`. Two taps in two places replace the slide of the UI research. Astryx has no slide control.
- The live region keeps its work in pocket mode, because `BridgeProvider` owns it.

`pocket.css`, imported by `globals.css`:

```css
/* The design asks for a black screen. No Astryx token is pure black. */
.pocket-screen {
  position: fixed;
  inset: 0;
  background: #000;
}
```

- [ ] **Step 1: Write the failing test**

```tsx
const session = [eventMessage('glance.pending', { kind: 'new', warnings: [] }), eventMessage('cart.updated')];
const enter = async () => {
  const ui = renderWithUi(<SessionScreen />, { messages: session });
  await ui.user.click(screen.getByRole('button', { name: 'Pocket mode' }));
  return ui;
};
const ask = () => within(screen.getByRole('alertdialog', { name: 'Leave pocket mode?' }));

it('shows only the total on a black screen, and tells the app', async () => {
  const { bridge } = await enter();
  expect(bridge.sent).toContainEqual({ t: 'pocket.set', on: true });
  expect(screen.getByRole('heading', { level: 1, name: 'Pocket mode' })).toBeInTheDocument();
  expect(screen.getByRole('main')).toHaveClass('pocket-screen');
  expect(screen.getByText('4.49 EUR')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
});
it('asks before it leaves pocket mode', async () => {
  const { bridge, user } = await enter();
  await user.click(screen.getByRole('button', { name: 'Unlock' }));
  await user.click(ask().getByRole('button', { name: 'Stay' }));
  expect(screen.getByRole('heading', { level: 1, name: 'Pocket mode' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Unlock' }));
  await user.click(ask().getByRole('button', { name: 'Leave' }));
  expect(bridge.sent).toContainEqual({ t: 'pocket.set', on: false });
  expect(screen.getByRole('heading', { level: 1, name: 'Glance' })).toBeInTheDocument();
});
it('paints the pocket screen black over the whole page', () => {
  expect(readFileSync('src/styles/pocket.css', 'utf8')).toMatch(/\.pocket-screen\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;[^}]*background:\s*#000;/);
});
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `npm test --workspace @glance/phone-ui -- PocketMode`
Expected: FAIL, because `PocketMode` does not exist.

- [ ] **Step 3: Implement `PocketMode`, `pocket.css`, and the button**

- [ ] **Step 4: Run all checks**

Run: `npm test --workspace @glance/phone-ui` and `npm run typecheck --workspace @glance/phone-ui`
Expected: PASS, and no type error.

- [ ] **Step 5: Check in a browser**

Open `http://localhost:5173/?replay=1&ready=1` and press Pocket mode in the first 5 seconds.
Expected: a black screen with the total in light text. The total changes when the run adds the oat drink. Unlock, then Leave, shows the cart again.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/ui
git commit -m "feat(ui): add pocket mode"
```

---

### Task 13 (C3): Mirror page

**Files:**
- Create: `apps/website/src/mirror/mirrorModel.ts`, `clipQueue.ts`, `mirror.css`, `mirrorRun.ts` (same folder)
- Modify: `apps/website/src/mirror/MirrorPage.tsx`, `apps/website/src/lib/api.ts`
- Test: `apps/website/src/mirror/mirrorModel.test.ts`, `clipQueue.test.ts`, `MirrorPage.test.tsx`

**Interfaces:**
- Consumes: `subscribeSse`, `replay`, `Timed`, `EventSourceLike`, `eur`, `fakeFetch`, `fakeSources` (Task 6). From `@glance/shared`: `ServerEvent`, `parseServerEvent`, `SessionSnapshot`, `SessionSnapshotSchema`, `Caption`, `Cart`, `EMPTY_CART`, `Phase`.
- Produces:

```ts
// lib/api.ts
export function getSession(sessionId: string, token: string, fetchFn?: typeof fetch): Promise<SessionSnapshot>;   // GET /api/sessions/<id>?token=<token>
export function sessionEventsUrl(sessionId: string, token: string): string;   // '/api/sessions/<id>/events?token=<token>'
export function getLatestSession(key: string, fetchFn?: typeof fetch): Promise<LatestSessionResponse | null>;   // GET /api/demo/latest?key=<key>. null for 404

// mirror/mirrorModel.ts
export const MIRROR_CAPTIONS = 5;
export type MirrorState = { captions: Caption[]; cart: Cart; phase: Phase | null };
export const initialMirrorState: MirrorState;
export function fromSnapshot(snapshot: SessionSnapshot): MirrorState;
export function mirrorReduce(state: MirrorState, event: ServerEvent): MirrorState;
export type MirrorTarget = { sessionId: string; token: string } | { latestKey: string };
export const LATEST_POLL_MS = 2000;
export function mirrorFlags(search: string): MirrorTarget | null;   // the flags s and t, or the flag latest. s and t win

// mirror/clipQueue.ts
export type PlayClip = (url: string, signal: AbortSignal) => Promise<void>;   // resolves when the clip ends
export const MAX_WAITING_CLIPS = 2;
export class ClipQueue {
  constructor(play: PlayClip);
  enqueue(url: string): void;
  setMuted(muted: boolean): void;
  stop(): void;
}
export const playWithAudioElement: PlayClip;

// mirror/MirrorPage.tsx
export function MirrorPage(props: { fetchFn?: typeof fetch; createEventSource?: (url: string) => EventSourceLike; playClip?: PlayClip }): JSX.Element;

// mirror/mirrorRun.ts
export const MIRROR_RUN: Timed<ServerEvent>[];
```

Decisions:

- `mirrorReduce`: `caption` appends and keeps the last 5, with one caption for each ID. `cart.updated` sets `cart`. `session.state` sets `phase`. Each other event returns the same state object.
- `ClipQueue` plays one clip at a time, in arrival order. A clip that fails does not stop the queue. With more than 2 clips waiting, it drops the oldest waiting clip, so the mirror stays near the voice. `setMuted(true)` stops the current clip, drops the waiting clips, and ignores new ones.
- `playWithAudioElement` makes `new Audio(url)`, resolves on `ended`, rejects on `error`, and pauses on abort.
- The page starts on the button "Start mirror". A browser blocks sound before a tap. The buttons "Mute" and "Unmute" are the audio control of WCAG 1.4.2.
- After the start the page opens the stream with `subscribeSse(sessionEventsUrl, parseServerEvent, ...)`. At each `open` it calls `getSession` and shows `fromSnapshot`. A caption of the snapshot plays no clip. A new caption with a `url` goes to the queue as `new URL(url, location.origin).href`.
- Link `lost` shows "Connection lost. Reconnecting.".
- With `latest=<key>`: after the start the page calls `getLatestSession(key)` each `LATEST_POLL_MS`. With an answer it opens that session as above. When a later answer names another session, it closes the stream and opens the new one. With no answer it shows "Waiting for a session on the phone.". `getLatestSession` checks the answer with `LatestSessionResponseSchema` of `@glance/shared`.
- With no `latest`, with no `s` or no `t`, and with no `replay`, the page shows "Add ?latest=, or ?s= and ?t=, to the address." and no start button.
- Layout: `<HStack as="main" className="mirror">`. Left: `<Heading level={1}>Mirror</Heading>`, the line "Demo mirror. It shows what the glasses say.", and the captions. The newest caption has the class `mirror-caption-current`, each older one has `mirror-caption-old` and `color="secondary"`. Right: the cart lines and the total.
- `MIRROR_RUN` holds the events of `DEMO_RUN` in Task 5, without the snapshot. Build it again from the fixtures, because the website cannot import the phone UI.

`mirror.css` holds at least:

```css
.mirror-caption-current { font-size: clamp(40px, 6vw, 96px); line-height: 1.15; }
.mirror-caption-old { font-size: clamp(24px, 3vw, 48px); line-height: 1.2; }
```

- [ ] **Step 1: Write the failing tests**

`mirrorModel.test.ts` (`event(type)` parses `events/<type>.json`):

```ts
it('keeps the last 5 captions, the cart, and the phase', () => {
  const caption = (n: number): ServerEvent => ({ ...event('caption'), id: `c-${n}`, text: `Line ${n}` });
  let state = initialMirrorState;
  for (let n = 0; n < 7; n += 1) state = mirrorReduce(state, caption(n));
  state = mirrorReduce(state, event('cart.updated'));
  state = mirrorReduce(state, { type: 'session.state', phase: 'checkout', cameraOn: true });
  expect(state.captions.map((c) => c.id)).toEqual(['c-2', 'c-3', 'c-4', 'c-5', 'c-6']);
  expect(state.cart.totalCents).toBe(449);
  expect(state.phase).toBe('checkout');
});
it('ignores each other event', () => {
  expect(mirrorReduce(initialMirrorState, event('glance.pending'))).toBe(initialMirrorState);
});
it('reads the session and the token from the address', () => {
  expect(mirrorFlags('?s=s-1&t=t-1')).toEqual({ sessionId: 's-1', token: 't-1' });
  expect(mirrorFlags('?s=s-1')).toBeNull();
  expect(mirrorFlags('')).toBeNull();
});
it('reads the demo key from the address, and prefers a named session', () => {
  expect(mirrorFlags('?latest=k-demo')).toEqual({ latestKey: 'k-demo' });
  expect(mirrorFlags('?latest=k-demo&s=s-1&t=t-1')).toEqual({ sessionId: 's-1', token: 't-1' });
  expect(mirrorFlags('?latest=')).toBeNull();
});
```

`clipQueue.test.ts`. `fakePlayer()` returns `{ play, started, signals, finish(url), fail(url) }`. `finish` and `fail` settle the promise of one clip and wait one tick.

```ts
it('plays one clip at a time, in arrival order', async () => {
  const player = fakePlayer();
  const queue = new ClipQueue(player.play);
  queue.enqueue('a'); queue.enqueue('b');
  expect(player.started).toEqual(['a']);
  await player.finish('a');
  expect(player.started).toEqual(['a', 'b']);
});
it('goes on after a clip that fails', async () => {
  const player = fakePlayer();
  const queue = new ClipQueue(player.play);
  queue.enqueue('a'); queue.enqueue('b');
  await player.fail('a');
  expect(player.started).toEqual(['a', 'b']);
});
it('drops the oldest waiting clip when more than 2 wait', async () => {
  const player = fakePlayer();
  const queue = new ClipQueue(player.play);
  for (const url of ['a', 'b', 'c', 'd']) queue.enqueue(url);
  await player.finish('a'); await player.finish('c'); await player.finish('d');
  expect(player.started).toEqual(['a', 'c', 'd']);
});
it('stops the current clip and plays nothing while muted', async () => {
  const player = fakePlayer();
  const queue = new ClipQueue(player.play);
  queue.enqueue('a'); queue.enqueue('b');
  queue.setMuted(true);
  expect(player.signals[0]?.aborted).toBe(true);
  queue.enqueue('c');
  await player.fail('a');
  expect(player.started).toEqual(['a']);
  queue.setMuted(false);
  queue.enqueue('d');
  expect(player.started).toEqual(['a', 'd']);
});
```

`MirrorPage.test.tsx`. Helpers:

- `deps()` returns `{ http, sources, played }`: a `fakeFetch` that answers the snapshot fixture with no captions, `fakeSources`, and a `playClip` that records its URL and resolves. For `GET /api/demo/latest?key=k-demo` the `fakeFetch` answers `{ sessionId: 's-9', token: 't-9' }`.
- `renderMirror(address, d)` renders the page in a `MemoryRouter`. `stream(d)` is `d.sources.sources[0]`.
- `start(d)` renders `/mirror?s=s-1&t=t-1`, presses "Start mirror", emits `open` on the stream, and waits for the first `GET`.
- `line(id, text, url)` is the caption fixture with these three values.

```tsx
it('asks for the session and the token when the address has none', () => {
  renderMirror('/mirror', deps());
  expect(screen.getByText('Add ?latest=, or ?s= and ?t=, to the address.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Start mirror' })).toBeNull();
});
it('follows the newest session of the phone with the flag latest', async () => {
  const d = deps();
  renderMirror('/mirror?latest=k-demo', d);
  fireEvent.click(screen.getByRole('button', { name: 'Start mirror' }));
  await waitFor(() => expect(stream(d)?.url).toBe('/api/sessions/s-9/events?token=t-9'));
  expect(d.http.calls[0]).toMatchObject({ method: 'GET', url: '/api/demo/latest?key=k-demo' });
});
it('says that it is a demo tool', () => {
  renderMirror('/mirror?s=s-1&t=t-1', deps());
  expect(screen.getByText('Demo mirror. It shows what the glasses say.')).toBeInTheDocument();
});
it('starts on a button, then shows the captions and the cart of the session', async () => {
  const d = deps();
  await start(d);
  expect(stream(d)?.url).toBe('/api/sessions/s-1/events?token=t-1');
  expect(d.http.calls.map((call) => `${call.method} ${call.url}`)).toEqual(['GET /api/sessions/s-1?token=t-1']);
  act(() => stream(d)?.emit('message', JSON.stringify(line('c-1', 'A line for the mirror.', null))));
  expect(await screen.findByText('A line for the mirror.')).toHaveClass('mirror-caption-current');
  act(() => stream(d)?.emit('message', JSON.stringify(event('cart.updated'))));
  expect(await screen.findByText('4.49 EUR')).toBeInTheDocument();
});
it('plays the clip of each new caption, and skips a caption with no clip', async () => {
  const d = deps();
  await start(d);
  act(() => stream(d)?.emit('message', JSON.stringify(line('c-1', 'With a clip.', 'https://glance.example/api/speech/abc.mp3'))));
  act(() => stream(d)?.emit('message', JSON.stringify(line('c-2', 'With no clip.', null))));
  await waitFor(() => expect(d.played).toEqual(['https://glance.example/api/speech/abc.mp3']));
});
it('says that the connection is lost, then loads the snapshot again', async () => {
  const d = deps();
  await start(d);
  act(() => stream(d)?.emit('error'));
  expect(await screen.findByText('Connection lost. Reconnecting.')).toBeInTheDocument();
  act(() => stream(d)?.emit('open'));
  await waitFor(() => expect(d.http.calls).toHaveLength(2));
});
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/website -- mirror Mirror clipQueue`
Expected: FAIL, because the modules do not exist.

- [ ] **Step 3: Implement the model, the queue, the page, and `mirrorRun.ts`**

With the flag `replay`, the start button plays `MIRROR_RUN` and makes no network call.

- [ ] **Step 4: Run all checks**

Run: `npm test --workspace @glance/website` and `npm run typecheck --workspace @glance/website`
Expected: PASS, and no type error. The test of Task 1 for `/mirror?replay=1` still passes.

- [ ] **Step 5: Check the page in a browser**

Open `http://localhost:5174/mirror?replay=1` and press Start mirror.
Expected: each line of the run shows in large text, the newest line is the largest, and the cart shows two lines and "4.49 EUR". The run has no clip, so no sound plays.

- [ ] **Step 6: Commit**

```bash
git add apps/website
git commit -m "feat(website): add the mirror page with captions, clips, and cart"
```

---

### Task 14 (C3): Debug panel

**Files:**
- Create: `apps/mobile/ui/src/debug/DebugPanel.tsx`
- Modify: `apps/mobile/ui/src/App.tsx`
- Test: `apps/mobile/ui/src/debug/DebugPanel.test.tsx`

**Interfaces:**
- Consumes: `useUi` with its `bridge`, `EVENT_TYPES`, `eventMessage`, `NATIVE_PRESETS`, `DEMO_RUN`, `playRecording`, `BrowserBridge`.
- Produces: `export function DebugPanel(): JSX.Element`.

Decisions:

- `App` renders `DebugPanel` after the screen when the bridge is a `BrowserBridge`, or when the address has the flag `debug`.
- The panel is one button with the label `Debug` and one `BottomSheet` with the label `Debug` and `height="tall"`. The sheet stays open after a tap. Debug text is English only and is not in `strings.ts`.
- Part "Events": one button for each of the 16 `EVENT_TYPES`, with the type as label. A tap runs `dispatch(eventMessage(type))`.
- Part "Native state": one button for each key of `NATIVE_PRESETS`, with the key as label. A tap runs `dispatch({ t: 'native.state', state })`.
- Part "Run": "Play the demo run" calls `playRecording(DEMO_RUN, dispatch)`. "Reset" runs `dispatch({ t: 'local.reset' })`.
- Part "Sent", for a `BrowserBridge` only: the last 10 entries of `bridge.sent`, each as one line of JSON. Also the line `Session query: <sessionQuery()>` while a server session exists. That query opens the mirror, and the HUD of Plan 4.

- [ ] **Step 1: Write the failing test**

```tsx
const open = async () => {
  const ui = renderWithUi(<><SessionScreen /><DebugPanel /></>);
  await ui.user.click(screen.getByRole('button', { name: 'Debug' }));
  return { ...ui, panel: within(screen.getByRole('dialog', { name: 'Debug' })) };
};

it('sends an event fixture into the page', async () => {
  const { user, panel } = await open();
  await user.click(panel.getByRole('button', { name: 'glance.pending' }));
  expect(screen.getByRole('heading', { level: 2, name: eventFixture('glance.pending').product.name })).toBeInTheDocument();
});
it('has one button for each event type and each native state', async () => {
  const { panel } = await open();
  for (const name of [...EVENT_TYPES, ...Object.keys(NATIVE_PRESETS)]) expect(panel.getByRole('button', { name })).toBeInTheDocument();
});
it('switches the native state', async () => {
  const { user, panel } = await open();
  await user.click(panel.getByRole('button', { name: 'glassesNotFound' }));
  expect(screen.getByText('Glasses not found.')).toBeInTheDocument();
});
it('lists the messages that the page sent', async () => {
  const { panel } = await open();
  expect(panel.getByText('{"t":"ui.ready"}')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `npm test --workspace @glance/phone-ui -- DebugPanel`
Expected: FAIL, because `DebugPanel` does not exist.

- [ ] **Step 3: Implement `DebugPanel` and render it from `App`**

- [ ] **Step 4: Run all checks**

Run: `npm test --workspace @glance/phone-ui` and `npm run typecheck --workspace @glance/phone-ui`
Expected: PASS, and no type error.

- [ ] **Step 5: Check in a browser**

Open `http://localhost:5173/?ready=1`, press Start shopping, open Debug, and press `glance.pending`, `cart.updated`, `checkout.offered`, and `paused`.
Expected: the card, the cart, the checkout sheet, and the banner "Paused." appear in turn.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/ui
git commit -m "feat(ui): add a debug panel that sends events and native states"
```

---

### Task 15 (C3): Accessibility checks of spec section 10

**Files:**
- Create: `apps/mobile/ui/src/a11y.test.tsx`
- Modify: each component that a check of this task rejects

**Interfaces:**
- Consumes: `App`, `renderWithUi`, `uncoveredTouchTargets`, `NATIVE_NEW`, `NATIVE_PRESETS`, `SNAPSHOT`, `eventMessage`.
- Produces: no new export.

Where each requirement of spec section 10 has its test:

| Requirement | Test |
|---|---|
| Roles and names | This task: one `main`, one `h1`, a name for each control, on each screen |
| Polite live region for captions and cart changes | Task 5, and the assertive check of this task |
| Touch targets of 48 px or more | Task 2, this task on each screen, and the measure of Step 5 |
| No state by color alone | Task 10 (status words, banner text), Task 6 (kiosk headings), and the ban of this task |
| Each spoken string also as text | Task 5 (captions with their language), Task 10 (the lines that the phone speaks) |
| Contrast, 200 percent font scale, TalkBack | Steps 5 and 6 of this task |

- [ ] **Step 1: Write the test**

```tsx
const session: NativeToPage[] = [
  { t: 'snapshot', session: { ...SNAPSHOT, phase: 'shopping', prompt: null, lastReceipt: null } },
  eventMessage('glance.pending', { kind: 'new', warnings: [] }),
  eventMessage('caption'),
  eventMessage('cart.updated'),
];
const tap = async (ui: ReturnType<typeof renderWithUi>, name: string) => ui.user.click(screen.getByRole('button', { name }));

const SCENES: [string, () => Promise<unknown>][] = [
  ['setup, link step', async () => renderWithUi(<App />, { native: NATIVE_NEW })],
  ['setup, camera step', async () => renderWithUi(<App />, { native: { ...NATIVE_NEW, registration: 'registered' } })],
  ['setup, ready step', async () => renderWithUi(<App />)],
  ['session', async () => renderWithUi(<App />, { messages: session })],
  ['checkout', async () => renderWithUi(<App />, { messages: [...session, eventMessage('checkout.offered')] })],
  ['receipt', async () => renderWithUi(<App />, { messages: [...session, eventMessage('checkout.paid')] })],
  ['settings', async () => tap(renderWithUi(<App />, { messages: session }), 'Settings')],
  ['end dialog', async () => tap(renderWithUi(<App />, { messages: session }), 'End')],
  ['pocket mode', async () => tap(renderWithUi(<App />, { messages: session }), 'Pocket mode')],
  ['banner with an action', async () => renderWithUi(<App />, { native: NATIVE_PRESETS.updateRequired, messages: session })],
  ['debug panel', async () => tap(renderWithUi(<App />, { messages: session }), 'Debug')],
];

it.each(SCENES)('%s: one main landmark, one main heading, named controls, covered touch targets', async (_name, open) => {
  await open();
  expect(screen.getAllByRole('main')).toHaveLength(1);
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  const controls = ['button', 'link', 'radio', 'checkbox', 'spinbutton'].flatMap((role) => screen.queryAllByRole(role));
  expect(controls.length).toBeGreaterThan(0);
  for (const control of controls) expect(control).toHaveAccessibleName();
  expect(uncoveredTouchTargets(document.body)).toEqual([]);
  expect(document.querySelector('.astryx-status-dot, .astryx-switch, [role="slider"]')).toBeNull();
});
it('never uses the assertive live region', async () => {
  renderWithUi(<App />, { native: NATIVE_PRESETS.offline, messages: [...session, eventMessage('error'), eventMessage('checkout.failed')] });
  await waitFor(() => expect(document.querySelector('[data-astryx-live-region="polite"]')).not.toBeNull());
  expect(document.querySelector('[data-astryx-live-region="assertive"]')?.textContent ?? '').toBe('');
});
```

- [ ] **Step 2: Run the test**

Run: `npm test --workspace @glance/phone-ui -- a11y`
Expected: each failure names a scene and a control. A `Button` with `href` that lacks the class `astryx-button` shows here.

- [ ] **Step 3: Fix each finding in its component**

Use an Astryx prop first: `size="lg"`, `density="spacious"`, a `label`. Do not add a rule to `uncoveredTouchTargets` without a measure in a browser.

- [ ] **Step 4: Run all checks**

Run: `npm test --workspace @glance/phone-ui` and `npm run typecheck --workspace @glance/phone-ui`
Expected: PASS, and no type error.

- [ ] **Step 5: Measure in a browser**

Open `http://localhost:5173/?replay=1&ready=1` in the device toolbar at 360 x 800, with a touch device selected. Wait for the card, and open Settings. Run this in the console:

```js
[...document.querySelectorAll('.astryx-button, .astryx-segmented-control-item, li.astryx-list-item:has(input)')]
  .map((el) => [el, el.getBoundingClientRect()])
  .filter(([, box]) => box.width > 0 && (box.width < 48 || box.height < 48))
  .map(([el, box]) => `${el.textContent.trim()} ${Math.round(box.width)}x${Math.round(box.height)}`)
```

Expected: `[]`.

Then set the root font size to 200 percent: assign `'200%'` to `document.documentElement.style.fontSize`. Do this on the session screen, the setup screen, and the two sheets.
Expected: `document.documentElement.scrollWidth <= window.innerWidth` is `true`, and no label is cut.

Then run the Lighthouse accessibility audit of the browser on the session screen in light mode and in dark mode.
Expected: no contrast finding.

- [ ] **Step 6: Check on the phone with seat 1**

This step needs the app of Plan 2. Turn TalkBack on, and set the font size of Android to its largest value.
Expected: TalkBack reads a name for each control. It speaks a new caption and a cart change without a touch. No text is cut. Write each finding into the pull request.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/ui
git commit -m "test(ui): add the accessibility checks of spec section 10"
```

---

### Task 16 (Extra 1): Allergen and diet settings, and the warning on the card

**Files:**
- Modify: `apps/mobile/ui/src/components/SettingsSheet.tsx`, `apps/mobile/ui/src/components/PromptCard.tsx`, `apps/mobile/ui/src/text/format.ts`, `apps/mobile/ui/src/text/strings.ts`
- Test: `apps/mobile/ui/src/text/format.test.ts`, `apps/mobile/ui/src/components/SettingsSheet.test.tsx`, `apps/mobile/ui/src/screens/SessionScreen.test.tsx`

**Interfaces:**
- Consumes: `EU_ALLERGENS`, `Allergen`, `Warning` from `@glance/shared`. `setProfile` (Task 9).
- Produces: `export function warningText(warning: Warning, strings: Strings): string`.

Strings of this task:

```ts
allergens: 'Allergens', diet: 'Diet', vegan: 'Vegan', vegetarian: 'Vegetarian',
allergenNames: { gluten: 'Gluten', crustaceans: 'Crustaceans', eggs: 'Eggs', fish: 'Fish', peanuts: 'Peanuts', soy: 'Soy', milk: 'Milk',
  nuts: 'Nuts', celery: 'Celery', mustard: 'Mustard', sesame: 'Sesame', sulphites: 'Sulphites', lupin: 'Lupin', molluscs: 'Molluscs' },
and: 'and',
warningAllergen: (list: string) => `Warning: contains ${list}.`,
warningDiet: (diet: string) => `Warning: not ${diet}.`,
allergenDataMissing: 'Allergen data is missing for this product.',
```

Decisions:

- Settings gets two `CheckboxList` groups: `allergens` with one item for each value of `EU_ALLERGENS`, in that order, and `diet` with `vegan` and `vegetarian`. A change in the first group sends `{ allergens }` with the full new list. A change in the second sends `{ vegan }` or `{ vegetarian }`.
- `warningText` writes the names of `allergenNames` in lower case. Two names join with `and`. Three or more join with commas, and with `and` before the last. The text equals the spoken warning of Plan 1 Task 23.
- `PromptCard` shows one `Banner` with `status="warning"` for each warning, with `warningText` as title. With no warning it shows nothing. The card never says that a product is safe.

- [ ] **Step 1: Write the failing tests**

Add to `format.test.ts`:

```ts
it('writes each warning as one sentence', () => {
  expect(warningText({ kind: 'allergen', allergens: ['gluten'] }, EN)).toBe('Warning: contains gluten.');
  expect(warningText({ kind: 'allergen', allergens: ['gluten', 'milk'] }, EN)).toBe('Warning: contains gluten and milk.');
  expect(warningText({ kind: 'allergen', allergens: ['gluten', 'milk', 'nuts'] }, EN)).toBe('Warning: contains gluten, milk and nuts.');
  expect(warningText({ kind: 'diet', diet: 'vegan' }, EN)).toBe('Warning: not vegan.');
  expect(warningText({ kind: 'allergenDataMissing' }, EN)).toBe('Allergen data is missing for this product.');
});
```

Add to `SettingsSheet.test.tsx`:

```tsx
it('lists the 14 EU allergens and two diets, and sends each change', async () => {
  const { bridge, user, sheet } = await open();
  const allergens = within(sheet.getByRole('group', { name: 'Allergens' }));
  expect(allergens.getAllByRole('checkbox')).toHaveLength(14);
  await user.click(allergens.getByRole('checkbox', { name: 'Gluten' }));
  await user.click(allergens.getByRole('checkbox', { name: 'Milk' }));
  await user.click(sheet.getByRole('checkbox', { name: 'Vegan' }));
  expect(patches(bridge)).toEqual([{ allergens: ['gluten'] }, { allergens: ['gluten', 'milk'] }, { vegan: true }]);
});
```

Add to `SessionScreen.test.tsx`:

```tsx
it('shows each warning on the card, and never says that a product is safe', () => {
  const { deliver } = renderWithUi(<SessionScreen />, { messages: [pending({ warnings: [{ kind: 'allergen', allergens: ['gluten'] }, { kind: 'diet', diet: 'vegan' }] })] });
  expect(screen.getByText('Warning: contains gluten.')).toBeInTheDocument();
  expect(screen.getByText('Warning: not vegan.')).toBeInTheDocument();
  deliver(pending({ promptId: 'p-0002', warnings: [] }));
  expect(screen.queryByText(/warning/i)).toBeNull();
  expect(screen.queryByText(/safe/i)).toBeNull();
});
it('says when allergen data is missing', () => {
  renderWithUi(<SessionScreen />, { messages: [pending({ warnings: [{ kind: 'allergenDataMissing' }] })] });
  expect(screen.getByText('Allergen data is missing for this product.')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/phone-ui`
Expected: FAIL, because `warningText` does not exist.

- [ ] **Step 3: Implement `warningText`, the two groups, and the warnings on the card**

- [ ] **Step 4: Run all checks**

Run: `npm test --workspace @glance/phone-ui` and `npm run typecheck --workspace @glance/phone-ui`
Expected: PASS, and no type error. The scenes of Task 15 still pass with the new groups.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/ui
git commit -m "feat(ui): add allergen and diet settings, and warnings on the card"
```

---

### Task 17 (Extra 2): Budget setting and the warning

**Files:**
- Modify: `apps/mobile/ui/src/components/SettingsSheet.tsx`, `apps/mobile/ui/src/components/CartList.tsx`, `apps/mobile/ui/src/state/uiState.ts`, `apps/mobile/ui/src/text/strings.ts`
- Test: `apps/mobile/ui/src/components/SettingsSheet.test.tsx`, `apps/mobile/ui/src/screens/SessionScreen.test.tsx`, `apps/mobile/ui/src/state/uiState.test.ts`

**Interfaces:**
- Consumes: `setProfile`, `UiState.budget`, `reduce`, `eur`.
- Produces: no new export.

Strings of this task:

```ts
budget: 'Budget',
budgetOver: 'Warning: over your budget.',
budgetDetail: (total: string, budget: string) => `Total ${total}. Budget ${budget}.`,
```

Decisions:

- Settings gets `<NumberInput label={budget} units="EUR" min={1} isIntegerOnly hasClear>`. Its value is `budgetCents / 100`, or `null`. A number sends `{ budgetCents: value * 100 }`. The clear button sends `{ budgetCents: null }`.
- `CartList` shows one `Banner` with `status="warning"` above the total while `state.budget` is set: the title `budgetOver` and the description `budgetDetail`.
- The server sends `budget.exceeded` one time, when an add crosses the budget (Plan 1 Task 24). So `reduce` keeps the warning, and a `profile` or `local.profile` action also clears it when the new `budgetCents` is `null` or not under `cart.totalCents`.

- [ ] **Step 1: Write the failing tests**

Add to `uiState.test.ts`:

```ts
it('drops the budget warning when the shopper raises or removes the budget', () => {
  const over = run(eventMessage('cart.updated'), eventMessage('budget.exceeded', { budgetCents: 400, totalCents: 449 }));
  expect(reduce(over, { t: 'local.profile', patch: { budgetCents: 500 } }).budget).toBeNull();
  expect(reduce(over, { t: 'local.profile', patch: { budgetCents: null } }).budget).toBeNull();
  expect(reduce(over, { t: 'local.profile', patch: { budgetCents: 300 } }).budget).not.toBeNull();
});
```

Add to `SettingsSheet.test.tsx`:

```tsx
it('sends the budget in cents, and null when the shopper clears it', async () => {
  const { bridge, user, sheet } = await open();
  await user.type(sheet.getByRole('spinbutton', { name: 'Budget' }), '20');
  await user.tab();
  await user.click(sheet.getByRole('button', { name: 'Clear Budget' }));
  expect(patches(bridge)).toEqual([{ budgetCents: 2000 }, { budgetCents: null }]);
});
```

Add to `SessionScreen.test.tsx`:

```tsx
it('warns in text while the total is over the budget', () => {
  const { deliver } = renderWithUi(<SessionScreen />, { messages: [eventMessage('cart.updated'), eventMessage('budget.exceeded', { budgetCents: 400, totalCents: 449 })] });
  expect(screen.getByText('Warning: over your budget.')).toBeInTheDocument();
  expect(screen.getByText('Total 4.49 EUR. Budget 4.00 EUR.')).toBeInTheDocument();
  deliver(eventMessage('cart.updated', { cart: EMPTY_CART, change: null }));
  expect(screen.queryByText('Warning: over your budget.')).toBeNull();
});
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/phone-ui -- SettingsSheet SessionScreen`
Expected: FAIL, because no control has the name "Budget".

- [ ] **Step 3: Implement the input and the warning**

- [ ] **Step 4: Run all checks**

Run: `npm test --workspace @glance/phone-ui` and `npm run typecheck --workspace @glance/phone-ui`
Expected: PASS, and no type error.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/ui
git commit -m "feat(ui): add the budget setting and the budget warning"
```

---

### Task 18 (Extra 3): Look-alike message

**Files:**
- Create: `apps/mobile/ui/src/components/LookAlikeNotice.tsx`
- Modify: `apps/mobile/ui/src/screens/SessionScreen.tsx`, `apps/mobile/ui/src/text/strings.ts`
- Test: `apps/mobile/ui/src/components/LookAlikeNotice.test.tsx`

**Interfaces:**
- Consumes: `UiState.lookAlikes`, `ProductRef`.
- Produces: `export function LookAlikeNotice(props: { candidates: ProductRef[] }): JSX.Element`.

Strings of this task:

```ts
lookAlikeTitle: 'I cannot tell which product this is.',
lookAlikeText: 'Turn the front to me.',
lookAlikeList: 'It can be one of these products:',
candidate: (name: string, packSize: string) => `${name}, ${packSize}`,
```

Decisions:

- The prompt area of `SessionScreen` shows the notice when no product prompt is current and `lookAlikes` is set.
- The notice is one `Banner` with `status="info"`, `collapsible={false}`, the title, the description, and a `List` of the candidates.
- The notice shows no price. The voice never guesses a price (spec section 2), and the page follows.

- [ ] **Step 1: Write the failing test**

```tsx
const candidates = eventFixture('glance.ambiguous').candidates;

it('says that it cannot tell the products apart, and names them with no price', () => {
  renderWithTheme(<LookAlikeNotice candidates={candidates} />);
  expect(screen.getByText('I cannot tell which product this is.')).toBeInTheDocument();
  expect(screen.getByText('Turn the front to me.')).toBeInTheDocument();
  for (const item of candidates) expect(screen.getAllByText(`${item.name}, ${item.packSize}`).length).toBeGreaterThan(0);
  expect(screen.queryByText(/EUR/)).toBeNull();
});
it('shows on the session screen until the next prompt', () => {
  const { deliver } = renderWithUi(<SessionScreen />, { messages: [eventMessage('glance.ambiguous')] });
  expect(screen.getByText('I cannot tell which product this is.')).toBeInTheDocument();
  deliver(eventMessage('glance.pending'));
  expect(screen.queryByText('I cannot tell which product this is.')).toBeNull();
});
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `npm test --workspace @glance/phone-ui -- LookAlikeNotice`
Expected: FAIL, because `LookAlikeNotice` does not exist.

- [ ] **Step 3: Implement the notice and show it in the prompt area**

- [ ] **Step 4: Run all checks**

Run: `npm test --workspace @glance/phone-ui` and `npm run typecheck --workspace @glance/phone-ui`
Expected: PASS, and no type error.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/ui
git commit -m "feat(ui): add the look-alike message"
```

---

### Task 19 (Extra 5): Microphone button for a question

**Files:**
- Create: `apps/mobile/ui/src/bridge/askMessage.ts`
- Modify: `apps/mobile/ui/src/screens/SessionScreen.tsx`, `apps/mobile/ui/src/text/strings.ts`
- Test: `apps/mobile/ui/src/screens/SessionScreen.ask.test.tsx`

**Interfaces:**
- Consumes: `IntentKind` with the value `ask` (Plan 0 Task 4). The app of Plan 2 relays the intent to the server and asks for the microphone permission. Plan 1 Task 26 opens the question window.
- Produces: `export const ASK_MESSAGE: PageToNative = { t: 'intent', kind: 'ask' }`.

- [ ] **Step 1: Check the contract**

Read `packages/shared/src/device.ts`. `IntentKind` must hold `ask`. If it does not, the package was built from an older Plan 0: add the value there first, with the owner of Plan 0.

- [ ] **Step 2: Write the failing test**

```tsx
it('asks the app to listen when the shopper presses the microphone button', async () => {
  const { bridge, user } = renderWithUi(<SessionScreen />, { messages: [{ t: 'snapshot', session: { ...SNAPSHOT, phase: 'shopping' } }] });
  await user.click(screen.getByRole('button', { name: 'Ask a question' }));
  expect(bridge.sent).toContainEqual(ASK_MESSAGE);
});
it('hides the button when the shop is over', () => {
  renderWithUi(<SessionScreen />, { messages: [{ t: 'snapshot', session: { ...SNAPSHOT, phase: 'ended' } }] });
  expect(screen.queryByRole('button', { name: 'Ask a question' })).toBeNull();
});
```

- [ ] **Step 3: Run the test and make sure it fails**

Run: `npm test --workspace @glance/phone-ui -- ask`
Expected: FAIL, because `askMessage.ts` does not exist.

- [ ] **Step 4: Implement the constant and the button**

- `askMessage.ts` holds `ASK_MESSAGE` as `{ t: 'intent', kind: 'ask' }`, and nothing more.
- Add the string `ask: 'Ask a question'`. The button is `<Button label={ask} icon={<Icon icon="microphone" />}>` in the action row. It shows in the phases `shopping` and `checkout`.
- `BrowserBridge` posts it as each other intent (Task 3). A web session has no microphone, so the question window of the server closes with no question.

- [ ] **Step 5: Run all checks**

Run: `npm test --workspace @glance/phone-ui` and `npm run typecheck --workspace @glance/phone-ui`
Expected: PASS, and no type error.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/ui
git commit -m "feat(ui): add the microphone button for a question"
```

---

### Task 20 (Extra 6): Fingerprint state at checkout

**Files:**
- Modify: `apps/mobile/ui/src/components/CheckoutSheet.tsx`, `apps/mobile/ui/src/text/strings.ts`
- Test: `apps/mobile/ui/src/components/CheckoutSheet.test.tsx`

**Interfaces:**
- Consumes: `needsBiometric` of the pay prompt.
- Produces: no new export.

Strings of this task:

```ts
fingerprint: 'Over fifty euros. Confirm with your fingerprint on the phone.',
payFingerprint: 'Pay with fingerprint',
```

Decision: with `needsBiometric`, the pay view shows `fingerprint` as a `Banner` with `status="info"`, and the pay button has the label `payFingerprint`. The app shows the fingerprint prompt of Android. If the phone has no screen lock, the app sends an `error` event, and the sheet shows its message (Task 8).

- [ ] **Step 1: Write the failing test**

```tsx
it('asks for the fingerprint when the server requires it', () => {
  renderWithUi(<SessionScreen />, { messages: [eventMessage('checkout.offered', { needsBiometric: true })] });
  expect(sheet('Checkout').getByText('Over fifty euros. Confirm with your fingerprint on the phone.')).toBeInTheDocument();
  expect(sheet('Checkout').getByRole('button', { name: 'Pay with fingerprint' })).toBeInTheDocument();
  expect(sheet('Checkout').queryByRole('button', { name: 'Pay' })).toBeNull();
});
it('shows no fingerprint line for a payment that needs none', () => {
  renderWithUi(<SessionScreen />, { messages: [offer] });
  expect(sheet('Checkout').queryByText(/fingerprint/)).toBeNull();
});
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `npm test --workspace @glance/phone-ui -- CheckoutSheet`
Expected: FAIL, because no button has the name "Pay with fingerprint".

- [ ] **Step 3: Implement the line and the label**

- [ ] **Step 4: Run all checks, then commit**

Run: `npm test --workspace @glance/phone-ui` and `npm run typecheck --workspace @glance/phone-ui`
Expected: PASS, and no type error.

```bash
git add apps/mobile/ui
git commit -m "feat(ui): show the fingerprint state at checkout"
```

---

### Task 21 (Extra 7): Language switch

**Files:**
- Modify: `apps/mobile/ui/src/text/strings.ts`, `apps/mobile/ui/src/components/SettingsSheet.tsx`, `apps/mobile/ui/src/bridge/BridgeContext.tsx`
- Test: `apps/mobile/ui/src/components/SettingsSheet.test.tsx`

**Interfaces:**
- Consumes: `Lang`, `LANGS` from `@glance/shared`. `setProfile`.
- Produces: `export const IT: Strings`. `stringsFor('it')` returns `IT`.

Decisions:

- Settings gets one `SegmentedControl` with the label `language` and the segments `English` and `Italiano`. It sends `{ lang }`.
- `IT` has an Italian text for each key of `EN`. The type `Strings` makes the compiler name a missing key. A person who speaks Italian reads each text before the merge.
- `BridgeProvider` sets `document.documentElement.lang` to `profile.lang`.
- The words of Astryx itself, for example "completed" in the stepper, stay in English. Astryx has `InternationalizationProvider` for them, and this plan does not use it.
- The spoken lines come from the server in the language of the profile. The banner lines of Task 10 are a translation of the English lines.

Strings of this task: `language: 'Language'` in `EN`, and all of `IT`. Four texts are fixed: `IT.add` is `Aggiungi`, `IT.skip` is `Salta`, `IT.pay` is `Paga`, `IT.settings` is `Impostazioni`.

- [ ] **Step 1: Write the failing test**

```tsx
it('sends the language, and shows the page in Italian', async () => {
  const { bridge, user, sheet } = await open({ messages: [eventMessage('glance.pending', { kind: 'new', warnings: [] })] });
  await user.click(sheet.getByRole('radio', { name: 'Italiano' }));
  expect(patches(bridge)).toEqual([{ lang: 'it' }]);
  expect(document.documentElement).toHaveAttribute('lang', 'it');
  expect(screen.getByRole('dialog', { name: 'Impostazioni' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Aggiungi' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Salta' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `npm test --workspace @glance/phone-ui -- SettingsSheet`
Expected: FAIL, because no control has the name "Italiano".

- [ ] **Step 3: Implement `IT`, `stringsFor`, the control, and the `lang` attribute**

- [ ] **Step 4: Run all checks, then commit**

Run: `npm test --workspace @glance/phone-ui` and `npm run typecheck --workspace @glance/phone-ui`
Expected: PASS, and no type error.

```bash
git add apps/mobile/ui
git commit -m "feat(ui): add the language switch with Italian text"
```

---

### Task 22 (Extra 8): Spot check on the kiosk and on the phone

**Files:**
- Modify: `apps/website/src/kiosk/KioskView.tsx`, `apps/website/src/kiosk/kioskRun.ts`, `apps/website/src/kiosk/KioskPage.tsx`
- Modify: `apps/mobile/ui/src/screens/SessionScreen.tsx`, `apps/mobile/ui/src/text/strings.ts`
- Test: `apps/website/src/kiosk/KioskView.test.tsx`, `apps/mobile/ui/src/screens/SessionScreen.test.tsx`

**Interfaces:**
- Consumes: `KioskEvent` with the state `spotcheck`. `UiState.spotCheck`.
- Produces: `export const KIOSK_SPOT_RUN: Timed<KioskEvent>[]` in `kioskRun.ts`: `KIOSK_RUN` with one `spotcheck` event of 4 seconds after each `connected` event.

Strings of this task, in the phone UI:

```ts
spotCheckTitle: 'Quick check.',
spotCheckText: (name: string) => `Show me the ${name}.`,
```

Decisions:

- Kiosk: the state `spotcheck` shows the `h1` "Quick check" and the line "Show the product that the voice names to your glasses.". The code and the cart stay. The event does not name the product (gap 4).
- Kiosk: with the flags `replay` and `spot`, the page plays `KIOSK_SPOT_RUN`.
- Phone: while `spotCheck` is set, the prompt area shows one `Banner` with `status="info"`, the title `spotCheckTitle`, and the description `spotCheckText(product.name)`.

- [ ] **Step 1: Write the failing tests**

Add to `KioskView.test.tsx`:

```tsx
it('names a spot check, and keeps the code and the cart', () => {
  renderWithTheme(<KioskView event={at('spotcheck', { cart, totalCents: cart.totalCents })} link="open" />);
  expect(screen.getByRole('heading', { level: 1, name: 'Quick check' })).toBeInTheDocument();
  expect(screen.getByText('Show the product that the voice names to your glasses.')).toBeInTheDocument();
  expect(screen.getByText('4.49 EUR')).toBeInTheDocument();
  expect(code()).toBeInTheDocument();
});
```

Add to `SessionScreen.test.tsx`:

```tsx
it('asks the shopper to show the product of a spot check', () => {
  const { deliver } = renderWithUi(<SessionScreen />, { messages: [eventMessage('checkout.spotcheck')] });
  expect(screen.getByText('Quick check.')).toBeInTheDocument();
  expect(screen.getByText(`Show me the ${eventFixture('checkout.spotcheck').product.name}.`)).toBeInTheDocument();
  deliver(eventMessage('checkout.offered'));
  expect(screen.queryByText('Quick check.')).toBeNull();
});
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/website -- KioskView` and `npm test --workspace @glance/phone-ui -- SessionScreen`
Expected: FAIL, because the kiosk shows "Waiting for your nod" and the phone shows no banner.

- [ ] **Step 3: Implement both states and the run**

- [ ] **Step 4: Run all checks, then commit**

Run: `npm test` and `npm run typecheck` for both workspaces.
Expected: PASS, and no type error.

```bash
git add apps/website apps/mobile/ui
git commit -m "feat: show the spot check on the kiosk and on the phone"
```

---

## Checks with the other plans

Run each check when its plan delivers. None of them blocks a task above.

- [ ] **Fake server (Plan 1, after its Task 12).** Run `npm run dev:fake --workspace @glance/server`. Open `http://localhost:5173/?api=/&ready=1` and press Start shopping. Expected within 60 seconds: the caption "Camera on. Hold a product up to hear its price.", then the oat drink card with "1.89 EUR". Add puts the oat drink into the cart.
- [ ] **Kiosk with the fake server (after Task 16 of Plan 1).** Open `http://localhost:5174/kiosk` in a second window before second 40 of the script. Expected: the kiosk shows its code, then the cart. The phone page shows the checkout sheet. Pay gives "Paid" on both pages. With `?fail=1` the kiosk shows "Payment failed. Nothing was charged.".
- [ ] **Mirror.** Copy the session query from the debug panel. Open `http://localhost:5174/mirror?<query>` and press Start mirror. Expected: each caption shows. With real speech clips, each clip plays in order.
- [ ] **WebView (Plan 2, Task 13).** Run `npm run build --workspace @glance/phone-ui` and tell seat 1 that `apps/mobile/ui/dist` is ready. Expected on the phone: the setup screen shows with the Neutral theme. The theme CSS uses `@scope` and `light-dark()`, so it needs a WebView of Chrome 123 or later. If the page shows no theme, update Android System WebView.
- [ ] **Kiosk screen.** Put the kiosk page on the demo laptop in full screen. Expected: the code is 15 cm wide or more, and the glasses read it from a chair at 1.5 m (spec section 16).
- [ ] **Deployed site (Plan 1, Task 22).** Run `npm run build --workspace apps/website`. Open `https://<domain>/kiosk` and `https://<domain>/mirror`, and reload each one. Expected: the page shows again.
