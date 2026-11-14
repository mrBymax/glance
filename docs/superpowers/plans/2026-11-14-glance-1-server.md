# Meta Glance Plan 1: Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the server that turns phone frames into spoken product prompts, applies the cart rules of spec section 6.2, and runs the kiosk checkout.

**Architecture:** One Node process in `apps/server`. A pure function, `step`, owns rules R1 to R24. It takes the session state and one input with a clock value, and it returns the new state and a list of effects. A runtime runs the effects: events on a bus, speech clips, device messages, and the mock payment. Recognition (Gemini), speech (ElevenLabs), and storage (MongoDB Atlas) each sit behind one interface, and each has a stand-in that needs no key.

**Tech Stack:** Node 22, TypeScript 6 run by tsx, Fastify 5, ws 8, zod 4, MongoDB driver 7, `@google/genai` 3, Vitest 5, Docker Compose, Caddy 2.

**Spec:** `docs/superpowers/specs/2026-11-13-meta-glance-design.md` (sections 5, 6, 8, 11, 13, 15). The contract is Plan 0: `docs/superpowers/plans/2026-11-14-glance-0-foundation.md`. Vendor facts: `docs/research/2026-11-13-stack-facts.md`.

**Scope:** Steps C2 and C3 of spec section 5 for the server, then extras 1, 2, 3, 5, 6, 7, 8, 9. Not in this plan: extra 4 (Plan 4), the "if time is left" list, the `speakPrices` preference, and the `gesture` field of a recognition result.

**Other plans:** Plan 0 comes first. Plans 2, 3, and 4 run at the same time as this plan.

| This plan needs | From | Tasks | How to work before it exists |
|---|---|---|---|
| `@glance/shared` | Plan 0 | all | Wait for Plan 0. Do not copy its types. |
| A phone that sends frames | Plan 2 | 14, the M1 test | Tests use a stub recognizer. `npm run smoke` plays the phone. |
| 20 probe frames, later 100 frames | Plan 2 and seat 4 | 21 | Take portrait phone photos of the dev catalog products. |
| `apps/server/catalog/catalog.json` with 12 products | Plan 4 | 20, 22 | Use `apps/server/catalog/catalog.dev.json` from Task 2. |
| `apps/website/dist` and `apps/display-pow/dist` | Plans 3 and 4 | 22 | Create the two folders empty. The pages answer 404, and the API works. |
| Gemini key on the paid tier, ElevenLabs key and voice IDs, Atlas URI, domain | Team | 8, 13, 15, 22 | Fake mode needs none of them. |

The other plans get these things from this plan: the fake server after Task 12, `catalog:check` after Task 20, the accuracy numbers after Task 21, and the HTTPS server after Task 22. Plans 2, 3, and 4 name these task numbers, so do not renumber the tasks.

## Global Constraints

- Node 22 or later. Vitest 5 needs Node 22.12 or later. npm workspaces. Do not add pnpm or yarn.
- Versions on 2026-11-14: `typescript` `^6.0.3`, `zod` `^4.6.7`, `vitest` `^5.1.0`, `tsx` `^4.23.15`, `fastify` `^5.12.8`, `ws` `^8.23.0`, `mongodb` `^7.9.0`, `@google/genai` `^3.3.0`. Type packages: `@types/node` `^22`, `@types/ws` `^8.18.2`. Add no other dependency.
- Types, schemas, and `TIMING` come from `@glance/shared`. Do not redefine a shared type. No file in `apps/server` repeats a timing number.
- Money is an integer number of cents in EUR. Only the server computes a total. Prices come only from the catalog.
- The rules are pure. `step` and its helpers call no `Date.now()`, no timer, no random function, and no I/O. Each input carries `now`.
- Glance tells, nod buys. Only an accepted yes adds a unit or pays. Silence never adds and never pays.
- The voice says a name and a price only for an `identified` result. It never says that a product is safe.
- The server holds a frame in memory for one call. It writes no frame to disk, to the database, or to a log, unless `SAVE_FRAMES` is set.
- Recognition model: `gemini-3.5-flash-lite` from `GEMINI_MODEL`. Speech: ElevenLabs `eleven_flash_v2_5`, the HTTP streaming endpoint, format `mp3_44100_128`.
- REST paths and the device socket are those of spec section 8 and Plan 0. `GET /healthz` is the one path outside the contract.
- The author checked the vendor call shapes of Tasks 13 and 15 on 2026-11-14. The sources are the type definitions of `@google/genai` 3.3.0 and the vendor pages that each task names.
- Text in code, comments, logs, and commit messages follows `skills/anti-slop/SKILL.md`.
- Commit messages use Conventional Commits, `type(scope): description`, with the types `feat`, `fix`, `chore`, `docs`, `test`. No Claude attribution lines.
- Work on the branch `feat/server`, never on `main`.
- Deadlines in Finnish time: M1 on Saturday 13:00 (a glance speaks on the glasses), feature freeze on Saturday 18:00, submission on Sunday 08:00.

## Review Focus

1. The cart changes while a pay prompt is current (row control or undo on the phone): the old prompt cannot pay. The voice gives a new pay prompt with the new total, and an empty cart ends the checkout (Task 5).
2. A second yes arrives while the mock payment runs (a nod, then the Pay button): one payment starts, and one order exists (Tasks 5 and 16).
3. ElevenLabs fails or has no credits left: `speak.url` is `null`, the caption still goes out, and the prompt still takes a yes (Task 15).
4. The server restarts in the middle of a shop: the phone connects again with its session ID and token, and the cart is there (Task 9).
5. The phone connects again while its old socket is still open on the server: the new socket takes over, the old one closes, and no message goes out two times (Task 11).

## Two switches for the other seats

Run `npm install`, then `npm run dev:fake --workspace @glance/server`. The server listens on port 8080 with both switches on. It needs no API key and no database.

`FAKE_RECOGNITION`:

- Unset or empty means off. `1` selects `apps/server/fixtures/fake-script.json`. Each other value is the path of a script file.
- The server makes no Gemini call and does not read `GEMINI_API_KEY`.
- The device socket still decodes each frame. It logs the frame header at `info` level and drops the frame.
- One script player runs for each session. It starts when the device socket opens, or when the first client opens `GET /api/sessions/:id/events`, whichever comes first.
- Each `TIMING.uploadEveryMs` the player gives the rules the result that the script holds for the elapsed time. Outside each step the result is `none`.
- In a `kiosk` step the player sends `kiosk.seen` one time each second. `"newest"` names the kiosk that registered last. Each other value is a kiosk code.
- A player that starts from the events path, for a session with no device socket, first sends `device.state` with `stream: "streaming"`. A browser client then gets the "Camera on" caption.
- A script with an unknown product ID stops the server at start. The message names the step.
- After Task 16, the fake server has one kiosk from the start: `Checkout 3` at `Demo Market` with the code `K3X7`. A printed `GL1 K3X7` code then starts a checkout.

```json
{
  "loop": true,
  "lengthMs": 60000,
  "steps": [
    { "atMs": 3000, "forMs": 6000, "result": { "status": "identified", "productId": "oat-drink-1l" } },
    { "atMs": 14000, "forMs": 6000, "result": { "status": "identified", "productId": "rye-bread" } },
    { "atMs": 24000, "forMs": 3000, "result": { "status": "unsure", "aimHint": "left" } },
    { "atMs": 28000, "forMs": 3000, "result": { "status": "unknown" } },
    { "atMs": 33000, "forMs": 4000, "result": { "status": "ambiguous", "candidates": ["oat-drink-1l", "oat-drink-barista-1l"] } },
    { "atMs": 40000, "forMs": 15000, "kiosk": "newest" }
  ]
}
```

`FAKE_SPEECH`:

- The value `1` means on.
- The server makes no ElevenLabs call and reads no ElevenLabs variable.
- Each `speak` message and each `caption` event has `url: null`. The `text` is the real line.
- The phone decides what it does with a line that has no clip. Plan 2 speaks the text with the phone voice, and then sends `prompt.done` for a prompt.
- `GET /api/speech/:hash.mp3` answers 404.

Storage: with no `MONGODB_URI`, the server keeps its data in memory and loads the catalog from `CATALOG_PATH`.

## Spoken lines

Each `speak` effect carries a `Line`. The rules select the line, and `renderLine` (Task 7) writes its text. The priority, sound, and interrupt values of this table are the defaults of each line. Lines with (*) are not in the spec.

| Key | English text at the standard level | Priority | Sound | Interrupt |
|---|---|---|---|---|
| `session.start` | Camera on. Hold a product up to hear its price. | normal | | no |
| `session.rest` (*) | Camera off. Your cart is safe. | high | | yes |
| `glance.new` | Oat drink, one litre, one eighty-nine. | normal | | yes |
| `glance.inCart` | Oat drink. One is in your cart. Nod to add another. Shake to remove. | normal | | yes |
| `glance.unknown` | I do not know this product. | normal | | no |
| `glance.partial` | I can see part of it. Move it left a little. | normal | | no |
| `glance.skipped` | Skipped. | normal | | yes |
| `cart.added` | Added oat drink. Total four forty-nine. | normal | added | yes |
| `cart.removed` | Removed oat drink. Total two sixty. | normal | removed | yes |
| `undo.nothing` (*) | Nothing to undo. | normal | | no |
| `hint.holdAgain` | Hold it up again. | normal | | no |
| `hint.holdAgainForAnother` | Hold it up again to add another. | normal | | no |
| `hint.lookAtCode` | Look at the checkout code, then nod. | high | | no |
| `checkout.offer` | Checkout 3 at Demo Market. Three items, six euros thirty-nine. Nod to pay. | high | found | yes |
| `checkout.empty` | Your cart is empty. | normal | | no |
| `checkout.busy` | This checkout is busy. | high | | no |
| `checkout.cancelled` | Checkout cancelled. Your cart is safe. | high | | yes |
| `checkout.paid` | Paid. Six euros thirty-nine. Your receipt is on your phone. Camera off. | high | paid | yes |
| `checkout.failed` | Payment failed. Nothing was charged. Look at the code to try again. | high | | yes |
| `info.total` (*) | Three items. Total six thirty-nine. | low | | no |
| `info.cart` (*) | Rye bread, one. Oat drink, one. Potato crisps, one. Total six thirty-nine. | low | | no |
| `info.help` | Hold a product up to hear its price. Nod to add it. Look at a checkout code and nod to pay. | low | | no |
| `device.cameraOff` | Camera off. | high | | yes |
| `device.regularCheckout` | Camera off. Please use a regular checkout. | high | | yes |
| `device.paused` | Paused. Tap the side of your glasses to resume. | high | | yes |
| `device.battery` | Glasses battery at twenty percent. | low | | no |
| `net.backOnline` | Back online. | high | | no |
| `recognition.slow` | Recognition is slow right now. | high | | no |

Text rules:

- The product name is `spokenName` in the language of the profile. Inside a sentence its first letter is lower case, unless the name starts with the brand.
- Glance lines and totals use the short price form. The pay prompt, the paid line, the detailed glance line, and a budget use the full form.
- `glance.new` with `hint: true` ends with the `add` phrase: "Oat drink, one litre, one eighty-nine. Nod to add."
- Brief level: `glance.new` is "Oat drink, one eighty-nine.", `cart.added` is "Added oat drink.", and `cart.removed` is "Removed oat drink.". Each other line is the same at each level.
- Detailed level: `glance.new` is "Oatly oat drink, one litre carton, one euro eighty-nine." If the product lists allergens, "Contains gluten." follows. The brand is left out when the name starts with it.
- `glance.inCart`: "{Name}. {One, Two, ...} {is, are} in your cart. {addAnother} {remove}".
- `glance.partial`, second sentence by aim hint: `left` "Move it left a little.", `right` "Move it right a little.", `up` "Move it up a little.", `down` "Move it down a little.", `closer` "Bring it closer.", `farther` "Move it back a little.", `turn` "Turn the front to me."
- `checkout.offer`: "{kiosk.name} at {kiosk.store}. {One item, Three items}, {full price}. {pay}". No detail level shortens it.
- `hint.lookAtCode`: "Look at the checkout code, {thenYes}."
- `info.total`: "{One item, Three items}. Total {short price}."
- `info.cart`: "{Name}, {quantity word}." for each of the first five cart lines. Then "And more on your phone." if `more` is true. Then "Total {short price}."
- `info.help` for the head with a nod is the line of the table. For each other input it is "Hold a product up to hear its price. {add} Look at a checkout code. {pay}".

Yes phrases, by `profile.mainYes` and `profile.yesGesture`. If `mainYes` is `head` and `headGestures` is `false`, use the `phone` row.

| Input | `add` | `addAnother` | `remove` | `pay` | `thenYes` |
|---|---|---|---|---|---|
| `head`, `nod` | Nod to add. | Nod to add another. | Shake to remove. | Nod to pay. | then nod |
| `head`, `shake` | Shake to add. | Shake to add another. | Nod to remove. | Shake to pay. | then shake |
| `touch` | Double tap to add. | Double tap to add another. | (empty) | Double tap to pay. | then double tap |
| `voice` | Say add. | Say add to add another. | Say remove to remove. | Say pay. | then say pay |
| `phone` | Press Add on your phone. | Press Add on your phone to add another. | (empty) | Press Pay on your phone. | then press Pay on your phone |
| `key` | Press volume up to add. | Press volume up to add another. | Press volume down to remove. | Press volume up to pay. | then press volume up |

## Task order

| Task | Step | Title | Needs |
|---|---|---|---|
| 1 | C2 | Server package, config, bus, health | Plan 0 |
| 2 | C2 | Catalog index and dev catalog | 1 |
| 3 | C2 | Rules: state, sightings, glance prompts | 2 |
| 4 | C2 | Rules: answers | 3 |
| 5 | C2 | Rules: checkout | 4 |
| 6 | C2 | Rules: session, device, information, replays | 5 |
| 7 | C2 | Speech text | 3 |
| 8 | C2 | Storage | 3 |
| 9 | C2 | Session runtime and registry | 6, 7, 8 |
| 10 | C2 | REST and server-sent events | 9 |
| 11 | C2 | Device socket | 10 |
| 12 | C2 | Fake recognition | 11 |
| 13 | C2 | Recognition request | 3 |
| 14 | C2 | Recognition worker | 11, 13 |
| 15 | C2 | Speech clips | 11 |
| 16 | C2 | Kiosk, mock payment, receipt | 12 |
| 17 | C3 | Token checks | 16 |
| 18 | C3 | States that the server reports | 14 |
| 19 | C3 | No stored frame | 14 |
| 20 | C3 | Catalog check and seed | 15 |
| 21 | C3 | Replay tool | 13 |
| 22 | C3 | Deployment on Vultr with HTTPS | 1 |
| 23 | Extra 1 | Allergen guard | 9 |
| 24 | Extra 2 | Budget guard | 9 |
| 25 | Extra 3 | Answer for look-alike products | 9 |
| 26 | Extra 5 | Ask about a product | 14 |
| 27 | Extra 6 | Fingerprint above 50 EUR | 16 |
| 28 | Extra 7 | Voice in Italian | 20 |
| 29 | Extra 8 | Spot check | 16 |
| 30 | Extra 9 | Sharp second look | 25 |

- After Task 3, three lanes are independent: Tasks 4 to 6, Task 7, and Tasks 8 and 13. Run them in separate worktrees.
- Task 22 needs only Task 1. The human seat does it while agents run the other tasks. The spec timeline wants HTTPS on Friday night.
- The path to M1 is Tasks 1 to 11 and 13 to 15. Tasks 12 and 16 can run next to Tasks 14 and 15.
- Gate after Task 12: tell seats 1, 3, and 4 that the fake server is ready.
- Gate after Tasks 14 and 15: M1 is possible from the server side. Test with the phone of seat 1.
- Gate after Task 16: M2 is possible from the server side.
- Extras follow spec section 5: start an extra when Tasks 1 to 22 are merged. If M1 is not reached by Saturday 14:00, only Tasks 23 to 25 stay. At the freeze, cut each task that is not done.

Commands for each task:

- One test file: `npm test --workspace @glance/server -- <name>`. The name is a part of the file path.
- All checks: `npm test --workspace @glance/server` and `npm run typecheck --workspace @glance/server`.

---

### Task 1 (C2): Server package, config, bus, health

**Files:**
- Create: `apps/server/package.json`, `apps/server/tsconfig.json`, `apps/server/.gitignore`, `apps/server/.env.example`
- Create: `apps/server/src/config.ts`, `apps/server/src/clock.ts`, `apps/server/src/bus.ts`, `apps/server/src/app.ts`, `apps/server/src/main.ts`
- Test: `apps/server/src/config.test.ts`, `apps/server/src/bus.test.ts`, `apps/server/src/app.test.ts`

**Interfaces:**
- Consumes: nothing from this plan.
- Produces:

```ts
// config.ts
export type Config = {
  port: number;                      // PORT, default 8080
  publicBaseUrl: string;             // PUBLIC_BASE_URL, default `http://localhost:${port}`
  mongodbUri: string | null;         // MONGODB_URI. null selects the memory store
  mongodbDb: string;                 // MONGODB_DB, default 'glance'
  catalogPath: string;               // CATALOG_PATH, default 'catalog/catalog.dev.json'
  geminiApiKey: string | null;       // GEMINI_API_KEY
  geminiModel: string;               // GEMINI_MODEL, default 'gemini-3.5-flash-lite'
  geminiMediaResolution: 'default' | 'low';   // GEMINI_MEDIA_RESOLUTION, default 'default'
  minConfidence: number;             // RECOGNITION_MIN_CONFIDENCE, default 0.6
  fakeRecognition: string | null;    // FAKE_RECOGNITION. '1' becomes 'fixtures/fake-script.json'
  fakeSpeech: boolean;               // FAKE_SPEECH === '1'
  elevenlabsApiKey: string | null;   // ELEVENLABS_API_KEY
  voiceId: { en: string | null; it: string | null };   // ELEVENLABS_VOICE_EN, ELEVENLABS_VOICE_IT
  speechCacheDir: string;            // SPEECH_CACHE_DIR, default '.cache/speech'
  saveFramesDir: string | null;      // SAVE_FRAMES, a directory
  paymentDelayMs: number;            // PAYMENT_DELAY_MS, default 1500
};
export class ConfigError extends Error {}
export function loadConfig(env: Record<string, string | undefined>, argv: readonly string[]): Config;

// clock.ts
export type Clock = { now(): number };
export const systemClock: Clock;

// bus.ts
export class EventBus {
  publish(topic: string, message: unknown): void;
  subscribe(topic: string, listener: (message: unknown) => void): () => void;   // returns the unsubscribe function
}
export function sessionTopic(sessionId: string): string;   // 'session:<id>', carries ServerEvent
export function kioskTopic(kioskId: string): string;       // 'kiosk:<id>', carries KioskEvent

// app.ts
export type AppDeps = { config: Config; clock: Clock; log?: boolean };   // later tasks add fields
export function buildApp(deps: AppDeps): Promise<FastifyInstance>;
```

- [ ] **Step 1: Create the branch and the package files**

Start from the branch that holds `@glance/shared`.

```bash
git switch -c feat/server
```

`apps/server/package.json`:

```json
{
  "name": "@glance/server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch --env-file-if-exists=.env src/main.ts",
    "dev:fake": "tsx watch src/main.ts --fake",
    "start": "node --import tsx src/main.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@glance/shared": "*",
    "@google/genai": "^3.3.0",
    "fastify": "^5.12.8",
    "mongodb": "^7.9.0",
    "tsx": "^4.23.15",
    "ws": "^8.23.0",
    "zod": "^4.6.7"
  },
  "devDependencies": {
    "@types/node": "^22",
    "@types/ws": "^8.18.2",
    "typescript": "^6.0.3",
    "vitest": "^5.1.0"
  }
}
```

`tsx` is a dependency because the server runs TypeScript sources in production. `@glance/shared` has no build step.

`apps/server/tsconfig.json` extends `../../tsconfig.base.json`, sets `"types": ["node"]`, and includes `src` and `scripts`.

`apps/server/.gitignore` holds one line: `testdata/`. Test frames stay out of the repository.

`apps/server/.env.example` lists each variable of `Config` with an empty value and its default as a comment.

- [ ] **Step 2: Write the failing tests**

`config.test.ts`:

```ts
const KEYS = { GEMINI_API_KEY: 'g', ELEVENLABS_API_KEY: 'e', ELEVENLABS_VOICE_EN: 'v' };

it('uses the defaults', () => {
  expect(loadConfig(KEYS, [])).toMatchObject({
    port: 8080, publicBaseUrl: 'http://localhost:8080', mongodbUri: null, mongodbDb: 'glance',
    catalogPath: 'catalog/catalog.dev.json', geminiModel: 'gemini-3.5-flash-lite',
    geminiMediaResolution: 'default', minConfidence: 0.6, fakeRecognition: null, fakeSpeech: false,
    speechCacheDir: '.cache/speech', saveFramesDir: null, paymentDelayMs: 1500,
  });
});
it('needs no key in fake mode', () => {
  expect(loadConfig({}, ['--fake'])).toMatchObject({
    fakeRecognition: 'fixtures/fake-script.json', fakeSpeech: true, geminiApiKey: null, elevenlabsApiKey: null,
  });
  expect(loadConfig({ FAKE_RECOGNITION: 'my.json', FAKE_SPEECH: '1' }, []).fakeRecognition).toBe('my.json');
});
it('names the missing variable', () => {
  expect(() => loadConfig({ FAKE_SPEECH: '1' }, [])).toThrow(/GEMINI_API_KEY/);
  expect(() => loadConfig({ FAKE_RECOGNITION: '1' }, [])).toThrow(/ELEVENLABS_API_KEY/);
  expect(() => loadConfig({ FAKE_RECOGNITION: '1', ELEVENLABS_API_KEY: 'e' }, [])).toThrow(/ELEVENLABS_VOICE_EN/);
});
it('rejects a value that is not a number', () => {
  expect(() => loadConfig({ PORT: 'abc' }, ['--fake'])).toThrow(ConfigError);
});
```

`bus.test.ts`:

```ts
it('delivers a message to the listeners of its topic only', () => {
  const bus = new EventBus(); const a: unknown[] = []; const b: unknown[] = [];
  bus.subscribe(sessionTopic('s1'), (m) => a.push(m));
  bus.subscribe(sessionTopic('s2'), (m) => b.push(m));
  bus.publish(sessionTopic('s1'), { type: 'glance.unknown' });
  expect(a).toEqual([{ type: 'glance.unknown' }]);
  expect(b).toEqual([]);
});
it('stops after unsubscribe', () => {
  const bus = new EventBus(); const got: unknown[] = [];
  const off = bus.subscribe('t', (m) => got.push(m));
  bus.publish('t', 1); off(); bus.publish('t', 2);
  expect(got).toEqual([1]);
});
it('keeps delivering when one listener throws', () => {
  const bus = new EventBus(); const got: unknown[] = [];
  bus.subscribe('t', () => { throw new Error('x'); });
  bus.subscribe('t', (m) => got.push(m));
  bus.publish('t', 1);
  expect(got).toEqual([1]);
});
```

`app.test.ts`:

```ts
const app = await buildApp({ config: loadConfig({}, ['--fake']), clock: systemClock, log: false });

it('answers the health check', async () => {
  const res = await app.inject({ method: 'GET', url: '/healthz' });
  expect(res.json()).toEqual({ ok: true, fakeRecognition: true, fakeSpeech: true, store: 'memory' });
});
it('answers a preflight request and sets the CORS header', async () => {
  const res = await app.inject({ method: 'OPTIONS', url: '/api/sessions',
    headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'POST' } });
  expect(res.statusCode).toBe(204);
  expect(res.headers['access-control-allow-origin']).toBe('*');
  expect(res.headers['access-control-allow-methods']).toBe('GET,POST,PATCH,DELETE');
  expect(res.headers['access-control-allow-headers']).toBe('content-type');
});
it('answers an unknown path with a JSON error', async () => {
  const res = await app.inject({ method: 'GET', url: '/nope' });
  expect(res.statusCode).toBe(404);
  expect(res.json()).toEqual({ error: 'not_found' });
});
```

- [ ] **Step 3: Run the tests and make sure they fail**

Run: `npm install`, then `npm test --workspace @glance/server`
Expected: FAIL, because the modules do not exist.

- [ ] **Step 4: Implement the five modules**

- `loadConfig`: `--fake` in `argv` gives the same result as `FAKE_RECOGNITION=1` and `FAKE_SPEECH=1`. A variable that is set wins over the flag. An empty value counts as not set.
- `loadConfig` throws `ConfigError` when `GEMINI_API_KEY` is missing and fake recognition is off. The same holds for `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_EN` when fake speech is off. The message names the variable and the switch that removes the need.
- Paths are relative to the working directory, which is `apps/server`.
- `buildApp`: one `onRequest` hook sets `access-control-allow-origin: *` on each response and answers `OPTIONS` with 204. Tokens travel in the query string, so no cookie is at risk.
- `buildApp`: error bodies are `{ error: 'not_found' | 'bad_request' | 'unauthorized' }`. A body that fails to parse gets 400.
- `buildApp` keeps a set of close functions and runs them in a `preClose` hook. Later tasks add their streams and sockets to it. Without this hook, `app.close()` does not return while a client is connected.
- `main.ts`: loads the config, builds the app, listens on `0.0.0.0`, logs `listening on :8080`, and closes the app on `SIGTERM` and `SIGINT`. A `ConfigError` prints `config: <message>` and exits with code 1.

- [ ] **Step 5: Run all checks and start the server**

Run: `npm test --workspace @glance/server` and `npm run typecheck --workspace @glance/server`
Expected: PASS, and no type error.

Run: `npm run dev:fake --workspace @glance/server`, then `curl http://localhost:8080/healthz`
Expected: `{"ok":true,"fakeRecognition":true,"fakeSpeech":true,"store":"memory"}`

- [ ] **Step 6: Commit**

```bash
git add package-lock.json apps/server
git commit -m "feat(server): add the server package with config, bus, and health check"
```

---

### Task 2 (C2): Catalog index and dev catalog

**Files:**
- Create: `apps/server/catalog/catalog.dev.json`, `apps/server/src/catalog/catalog.ts`
- Test: `apps/server/src/catalog/catalog.test.ts`

**Interfaces:**
- Consumes: `Product`, `ProductSchema` from `@glance/shared`.
- Produces:

```ts
export type CatalogIndex = { readonly products: readonly Product[]; get(id: string): Product | undefined };
export function indexCatalog(products: readonly Product[]): CatalogIndex;   // throws on a duplicate ID
export function readCatalogFile(path: string): Product[];   // a JSON array, each entry through ProductSchema
```

The dev catalog has four products. The tests and the fake script of this plan use these IDs and prices.

| `id` | `name` and `spokenName` | `brand` | `packSize` | `spokenPack` | `spokenPackDetailed` | `priceCents` | `allergens` | `vegan`, `vegetarian` | `lookAlikes` |
|---|---|---|---|---|---|---|---|---|---|
| `oat-drink-1l` | copy of `packages/shared/fixtures/catalog/oat-drink-1l.json` | | | | | 189 | | | |
| `oat-drink-barista-1l` | Barista oat drink | Oatly | 1 L | one litre | one litre carton | 229 | `["gluten"]` | `true` | `["oat-drink-1l"]` |
| `rye-bread` | Rye bread | Demo Bakery | 500 g | five hundred grams | five hundred gram bag | 260 | `["gluten"]` | `true` | `[]` |
| `potato-crisps` | Potato crisps | Demo Snacks | 150 g | one hundred fifty grams | one hundred fifty gram bag | 190 | `null` | `null` | `[]` |

Write a `visual` sentence of 20 characters or more for each product.

- [ ] **Step 1: Write the dev catalog and the failing test**

```ts
import oatDrink from '@glance/shared/fixtures/catalog/oat-drink-1l.json';

const dev = readCatalogFile('catalog/catalog.dev.json');

it('holds the oat drink of the shared fixture', () => {
  expect(indexCatalog(dev).get('oat-drink-1l')).toEqual(ProductSchema.parse(oatDrink));
});
it('has the prices that the spec script uses', () => {
  expect(Object.fromEntries(dev.map((p) => [p.id, p.priceCents]))).toEqual({
    'oat-drink-1l': 189, 'oat-drink-barista-1l': 229, 'rye-bread': 260, 'potato-crisps': 190,
  });
});
it('has one product with no allergen data', () => {
  expect(indexCatalog(dev).get('potato-crisps')!.allergens).toBeNull();
});
it('rejects a duplicate ID', () => {
  expect(() => indexCatalog([dev[0]!, dev[0]!])).toThrow(/oat-drink-1l/);
});
it('names the entry that fails the schema', () => {
  // write a temp file with [valid, { ...valid, id: 'rye-bread', priceCents: 1.5 }]
  expect(() => readCatalogFile(tempPath)).toThrow(/entry 1.*rye-bread/);
});
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `npm test --workspace @glance/server -- catalog`
Expected: FAIL, because `catalog.ts` does not exist.

- [ ] **Step 3: Implement `indexCatalog` and `readCatalogFile`**

- [ ] **Step 4: Run the test and make sure it passes**

Run: `npm test --workspace @glance/server -- catalog`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server
git commit -m "feat(server): add the catalog index and a dev catalog"
```

---

### Task 3 (C2): Rules: state, sightings, glance prompts

**Files:**
- Create: `apps/server/src/recognition/result.ts`, `apps/server/src/sessions/types.ts`, `apps/server/src/sessions/say.ts`, `apps/server/src/sessions/view.ts`, `apps/server/src/sessions/step.ts`, `apps/server/src/sessions/glance.ts`
- Create: `apps/server/src/sessions/harness.ts` (a test helper, no product code imports it)
- Test: `apps/server/src/sessions/glance.test.ts`

**Interfaces:**
- Consumes: `CatalogIndex` (Task 2). From `@glance/shared`: `TIMING`, `EMPTY_CART`, `Phase`, `Profile`, `ProfilePatch`, `Cart`, `Product`, `Warning`, `KioskRef`, `Receipt`, `AimHint`, `Priority`, `SoundName`, `ServerEvent`, `IntentKind`, `IntentSource`, `DeviceState`, `toProductRef`.
- Produces:

```ts
// recognition/result.ts
export type RecognitionResult = {
  status: 'identified' | 'ambiguous' | 'unsure' | 'unknown' | 'none';
  productId: string | null;    // a catalog ID for 'identified', else null
  candidates: string[];        // catalog IDs for 'ambiguous', else []
  confidence: number;          // 0 to 1
  aimHint: AimHint;
  gesture: 'none' | 'thumbs_up' | 'thumbs_down';
};
export const RecognitionResultSchema: z.ZodType<RecognitionResult>;
export const NO_RESULT: RecognitionResult;   // 'none', null, [], 0, 'none', 'none'

// sessions/types.ts
export type Line =
  | { key: 'session.start' } | { key: 'session.rest' }
  | { key: 'glance.new'; product: Product; hint: boolean; warnings: Warning[] }
  | { key: 'glance.inCart'; product: Product; qty: number; warnings: Warning[] }
  | { key: 'glance.unknown' } | { key: 'glance.skipped' }
  | { key: 'glance.partial'; aimHint: Exclude<AimHint, 'none'> }
  | { key: 'cart.added'; product: Product; totalCents: number; budgetCents: number | null }
  | { key: 'cart.removed'; product: Product; totalCents: number }
  | { key: 'undo.nothing' }
  | { key: 'hint.holdAgain' } | { key: 'hint.holdAgainForAnother' } | { key: 'hint.lookAtCode' }
  | { key: 'checkout.offer'; kiosk: KioskRef; itemCount: number; totalCents: number }
  | { key: 'checkout.empty' } | { key: 'checkout.busy' } | { key: 'checkout.cancelled' } | { key: 'checkout.failed' }
  | { key: 'checkout.paid'; totalCents: number }
  | { key: 'info.total'; itemCount: number; totalCents: number }
  | { key: 'info.cart'; items: { product: Product; qty: number }[]; more: boolean; totalCents: number }
  | { key: 'info.help' }
  | { key: 'device.cameraOff' } | { key: 'device.regularCheckout' } | { key: 'device.paused' }
  | { key: 'device.battery'; percent: 20 | 10 }
  | { key: 'net.backOnline' } | { key: 'recognition.slow' };

export type PromptState =
  | { id: string; kind: 'product'; mode: 'new' | 'inCart'; productId: string; doneAt: number | null }
  | { id: string; kind: 'pay'; kioskId: string; doneAt: number | null };

export type CheckoutState = { kiosk: KioskRef; step: 'offered' | 'suspended' | 'paying'; suspendedBy: string | null };

export type SessionState = {
  phase: Phase;
  cameraOn: boolean;
  profile: Profile;
  cart: Cart;
  prompt: PromptState | null;       // the current prompt
  promptSeq: number;                // the number of prompts made, for the IDs
  glanceCount: number;              // the number of 'new' prompts, for the yes hint
  seen: Record<string, number>;     // product ID to the time of its last identified result
  muted: string[];                  // no prompt until the product has left the view (R8, R10)
  excluded: { productId: string; until: number }[];   // R9
  lastAdd: { productId: string; promptId: string; at: number; hinted: boolean } | null;   // R10
  adds: string[];                   // product IDs in the order of the adds (R12)
  lastDone: { promptId: string; kind: 'product' | 'pay'; at: number; hinted: boolean } | null;   // R20
  unknownAt: number | null;         // R13
  aimHintAt: number | null;
  kioskSeen: { kioskId: string; at: number; said: boolean } | null;
  mutedKioskId: string | null;      // R18
  checkout: CheckoutState | null;
  lastTargetAt: number;             // the last product or kiosk in view (R22)
  lastSpeak: SpeakEffect | null;    // for the repeat intent
  device: DeviceState | null;
  lastReceipt: Receipt | null;
};

export type RuleInputBody =
  | { type: 'recognition'; result: RecognitionResult; still: boolean }
  | { type: 'intent'; kind: IntentKind; source: IntentSource; promptId?: string }
  | { type: 'prompt.done'; promptId: string }
  | { type: 'kiosk.seen'; kiosk: KioskRef; busy: boolean; spotCheck: boolean }
  | { type: 'tick' }
  | { type: 'device.state'; state: DeviceState }
  | { type: 'cart.edit'; productId: string; qty: number }
  | { type: 'profile.set'; patch: ProfilePatch }
  | { type: 'payment.result'; ok: boolean; orderId: string; paidAt: string };
export type RuleInput = RuleInputBody & { now: number };

export type SpeakEffect = {
  type: 'speak'; line: Line; priority: Priority; sound: SoundName | null; interrupt: boolean; promptId: string | null;
};
export type Effect =
  | { type: 'event'; event: ServerEvent }   // the rules never make a caption event
  | SpeakEffect
  | { type: 'session.rest' }
  | { type: 'session.end' }
  | { type: 'payment.start'; kiosk: KioskRef; totalCents: number };
export type RuleContext = { catalog: CatalogIndex };

// sessions/say.ts
export const LINE_DEFAULTS: Record<Line['key'], { priority: Priority; sound: SoundName | null; interrupt: boolean }>;
export function say(line: Line, over?: Partial<Pick<SpeakEffect, 'sound' | 'interrupt' | 'promptId'>>): SpeakEffect;

// sessions/view.ts
export function inView(seenAt: number | undefined, now: number): boolean;   // seenAt is set and now - seenAt < TIMING.viewMs
export function excludeList(state: SessionState, now: number): string[];    // R9, for the recognition worker

// sessions/step.ts
export function createSessionState(profile: Profile, now: number): SessionState;
export function step(state: SessionState, input: RuleInput, ctx: RuleContext): { state: SessionState; effects: Effect[] };

// sessions/harness.ts
export const OAT = 'oat-drink-1l', BARISTA = 'oat-drink-barista-1l', RYE = 'rye-bread', CRISPS = 'potato-crisps';
export const KIOSK: KioskRef = { id: 'kiosk-1', name: 'Checkout 3', store: 'Demo Market' };
export const STREAMING: DeviceState = { link: 'connected', battery: 80, worn: true, hingeOpen: true, thermal: 0, stream: 'streaming' };
export function product(id: string, priceCents: number): Product;   // a valid product for a test that needs more than the dev catalog
export type Harness = {
  state: SessionState;               // a test can replace it
  ctx: RuleContext;
  now: number;                       // starts at 1_000_000
  effects: Effect[];                 // of the last input
  all: Effect[];                     // since the start
  send(input: RuleInputBody): void;  // adds `now`, runs `step`, keeps the state and the effects
  advance(ms: number): void;         // moves the clock, then sends one tick
  at(ms: number): void;              // moves the clock to start + ms, then sends one tick
  see(productId: string): void;      // an identified result
  hold(productId: string, ms: number): void;   // see now, then advance 500 and see, until ms have passed
  result(part: Partial<RecognitionResult>): void;   // NO_RESULT with the given fields
  kiosk(opts?: { busy?: boolean; spotCheck?: boolean }): void;   // kiosk.seen for KIOSK
  done(): void;                      // prompt.done for the current prompt
  yes(source?: IntentSource, promptId?: string): void;   // defaults: 'head', and the prompt of the last done()
  no(source?: IntentSource, promptId?: string): void;
  intent(kind: IntentKind, source?: IntentSource): void;   // default source 'voice'
  lines(): string[];                 // line keys of the last input
  events(): string[];                // event types of the last input
  speak(): SpeakEffect | undefined;  // the first speak effect of the last input
  event<K extends ServerEvent['type']>(type: K): Extract<ServerEvent, { type: K }> | undefined;   // of the last input
};
export function harness(opts?: { profile?: ProfilePatch; products?: Product[]; cart?: string[] }): Harness;
```

`harness` reads the dev catalog and appends `opts.products`. `opts.cart` puts one unit of each listed product in the cart at the start.

`createSessionState` gives phase `shopping`, `cameraOn: false`, `EMPTY_CART`, `lastTargetAt: now`, and empty or `null` values for the other fields. `LINE_DEFAULTS` holds the "Spoken lines" table.

Rules of this task:

1. `step` works on a copy of the state. It runs `expire`, then the handler of the input type. An input type with no handler yet changes nothing.
2. After the handler, `step` stores the last `speak` effect of the input in `lastSpeak`.
3. `expire` removes a muted product that left the view, and an exclude entry with `until <= now`.
4. `expire` ends a product prompt when `now - seen[productId] >= TIMING.viewMs + TIMING.promptTtlAfterLeftMs`. The event is `glance.cleared` (R5).
5. A `recognition` input counts only in the phases `shopping` and `checkout`. A status other than `none` sets `lastTargetAt = now`.
6. `identified`: read "was in view" from the old `seen` value, then set `seen[productId] = now`. A muted product gets no prompt. The product of the current prompt gets no new prompt if it was in view. Each other case makes a new prompt (R1, R2, R11).
7. Each appearance gets a prompt. The product of the current prompt gets a new prompt when it comes back after it left the view.
8. A new prompt has the ID `p-` plus `promptSeq` with 4 digits, for example `p-0001`. Its mode is `inCart` if the cart holds the product, else `new`.
9. The effects of a new prompt, in order: `glance.cleared` for a product prompt that it replaces, `glance.pending`, and the `speak` with the `promptId`.
10. `glance.new` has `hint: true` while `glanceCount < 3`. `warnings` is `[]` until Task 23.
11. `unknown` (R13): speak `glance.unknown` and emit `glance.unknown` when `unknownAt` is `null` or `now - unknownAt >= TIMING.viewMs`. Then set `unknownAt = now`. While the product of the current prompt is in view, do nothing and leave `unknownAt`.
12. `unsure` with an aim hint other than `none`: emit `glance.hint` and speak `glance.partial`, at most one time each `TIMING.aimHintEveryMs`. Stay silent while the product of the current prompt is in view.
13. `ambiguous` counts as `unsure` with `aimHint: 'turn'` until Task 25. The rules ignore `gesture`.

- [ ] **Step 1: Write the harness and the failing test**

`glance.test.ts` (`T` is `TIMING`):

```ts
it('R1: a recognized product becomes the pending product and gets a glance prompt', () => {
  const h = harness();
  h.see(OAT);
  expect(h.state.prompt).toEqual({ id: 'p-0001', kind: 'product', mode: 'new', productId: OAT, doneAt: null });
  expect(h.events()).toEqual(['glance.pending']);
  expect(h.event('glance.pending')).toEqual({
    type: 'glance.pending', promptId: 'p-0001', kind: 'new',
    product: { id: OAT, name: 'Oat drink', packSize: '1 L', priceCents: 189 }, warnings: [], qtyInCart: 0,
  });
  expect(h.speak()).toMatchObject({
    line: { key: 'glance.new', hint: true }, promptId: 'p-0001', priority: 'normal', interrupt: true, sound: null,
  });
  expect(h.state.cart).toEqual(EMPTY_CART);
});
it('R1: results inside the view time give one prompt', () => {
  const h = harness();
  h.hold(OAT, 2500);
  expect(h.all.filter((e) => e.type === 'speak')).toHaveLength(1);
});
it('R1: a product that comes back after it left the view gets a new prompt', () => {
  const h = harness();
  h.see(OAT); h.advance(T.viewMs); h.see(OAT);
  expect(h.events()).toEqual(['glance.cleared', 'glance.pending']);
  expect(h.state.prompt!.id).toBe('p-0002');
});
it('R2: a new product in view replaces the pending product', () => {
  const h = harness();
  h.see(OAT); h.see(RYE);
  expect(h.events()).toEqual(['glance.cleared', 'glance.pending']);
  expect(h.event('glance.cleared')).toEqual({ type: 'glance.cleared', promptId: 'p-0001' });
  expect(h.state.prompt).toMatchObject({ id: 'p-0002', productId: RYE });
});
it('R5: a product prompt ends when its product left the view for 15 seconds', () => {
  const h = harness();
  h.see(OAT);
  h.advance(T.viewMs + T.promptTtlAfterLeftMs - 1);
  expect(h.state.prompt).not.toBeNull();
  h.advance(1);
  expect(h.state.prompt).toBeNull();
  expect(h.events()).toEqual(['glance.cleared']);
});
it('R11: a product in the cart that comes into view gets the add-another prompt', () => {
  const h = harness({ cart: [OAT] });
  h.see(OAT);
  expect(h.state.prompt).toMatchObject({ kind: 'product', mode: 'inCart', productId: OAT });
  expect(h.event('glance.pending')).toMatchObject({ kind: 'inCart', qtyInCart: 1 });
  expect(h.speak()!.line).toMatchObject({ key: 'glance.inCart', qty: 1 });
});
it('R13: the unknown line plays one time for each appearance', () => {
  const h = harness();
  h.result({ status: 'unknown' });
  expect(h.lines()).toEqual(['glance.unknown']);
  expect(h.events()).toEqual(['glance.unknown']);
  h.advance(500); h.result({ status: 'unknown' });
  expect(h.effects).toEqual([]);
  h.advance(T.viewMs); h.result({ status: 'unknown' });
  expect(h.lines()).toEqual(['glance.unknown']);
});
it('gives an aim hint at most one time each 5 seconds', () => {
  const h = harness();
  h.result({ status: 'unsure', aimHint: 'left' });
  expect(h.events()).toEqual(['glance.hint']);
  expect(h.speak()!.line).toEqual({ key: 'glance.partial', aimHint: 'left' });
  h.advance(T.aimHintEveryMs - 1); h.result({ status: 'unsure', aimHint: 'left' });
  expect(h.effects).toEqual([]);
  h.advance(1); h.result({ status: 'unsure', aimHint: 'up' });
  expect(h.lines()).toEqual(['glance.partial']);
});
it('adds the yes hint to the first three glance prompts only', () => {
  const h = harness();
  const hints = [OAT, RYE, BARISTA, CRISPS].map((id) => { h.see(id); return (h.speak()!.line as { hint: boolean }).hint; });
  expect(hints).toEqual([true, true, true, false]);
});
it('ignores a result while the camera rests', () => {
  const h = harness();
  h.state = { ...h.state, phase: 'resting' };
  h.see(OAT);
  expect(h.effects).toEqual([]);
  expect(h.state.prompt).toBeNull();
});
it('does not change the state that it gets', () => {
  const h = harness();
  const before = structuredClone(h.state);
  const result = { ...NO_RESULT, status: 'identified' as const, productId: OAT };
  step(h.state, { type: 'recognition', now: h.now, result, still: false }, h.ctx);
  expect(h.state).toEqual(before);
});
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `npm test --workspace @glance/server -- glance`
Expected: FAIL, because `step` does not exist.

- [ ] **Step 3: Implement the types, `say`, `view`, `step`, and the handler in `glance.ts`**

- [ ] **Step 4: Run the test and make sure it passes**

Run: `npm test --workspace @glance/server -- glance`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/server
git commit -m "feat(server): add the rules state and the glance prompt rules"
```

---

### Task 4 (C2): Rules: answers

**Files:**
- Create: `apps/server/src/sessions/answers.ts`
- Modify: `apps/server/src/sessions/step.ts`
- Test: `apps/server/src/sessions/answers.test.ts`

**Interfaces:**
- Consumes: the types, `say`, `inView`, `excludeList`, `step`, and the harness of Task 3. `cartTotalCents` and `toProductRef` from `@glance/shared`.
- Produces: the handlers for `prompt.done`, `cart.edit`, and the intents `yes`, `no`, and `undo`. Also:

```ts
// answers.ts
export function accepts(state: SessionState, intent: { source: IntentSource; promptId?: string }, now: number): boolean;
```

Rules of this task:

1. `prompt.done` for the current prompt sets `doneAt = now` and `lastDone = { promptId, kind, at: now, hinted: false }`. For each other ID it does nothing.
2. Source classes: `head` follows R4. `voice`, `touch`, `key`, and `camera` follow R5. `phone` and `hud` follow R6.
3. `accepts` is true when `promptId` is the ID of the current prompt and the source class agrees:
   - R6 class: always.
   - R5 class: `doneAt` is set.
   - R4 class: `profile.headGestures` is true, `doneAt` is set, the target is in view, and `now - doneAt < profile.headWindowMs`. With `headWindowMs: null` there is no time limit.
4. The target of a product prompt is in view when `inView(seen[productId], now)`. The target of a pay prompt is in view when `kioskSeen` names its kiosk and `inView(kioskSeen.at, now)`.
5. Accepted yes on a product prompt (R7): add one unit, with the name and pack size in the language of the profile and the price of the catalog. Set the total with `cartTotalCents`. Push the ID to `adds`, set `lastAdd`, mute the product, and end the prompt. Effects: `glance.cleared`, `cart.updated` with `change.kind: 'add'`, line `cart.added`.
6. Accepted no on a `new` prompt (R8, R9): mute the product, add the exclude entry with `until = now + TIMING.excludeAfterNoMs`, and end the prompt. Effects: `glance.cleared`, line `glance.skipped`.
7. Accepted no on an `inCart` prompt (R11): remove one unit, mute the product, and end the prompt. Effects: `glance.cleared`, `cart.updated` with `change.kind: 'remove'`, line `cart.removed`.
8. Not accepted, and `promptId` equals `lastAdd.promptId` (R10): a no with `now - lastAdd.at < TIMING.undoWindowMs` removes that unit and clears `lastAdd`. A yes speaks `hint.holdAgainForAnother` one time for each add.
9. Not accepted in each other case (R20): if `lastDone` is set, not hinted, and `now - lastDone.at < TIMING.hintAfterPromptMs`, speak one hint and mark `lastDone.hinted`. The hint is `hint.lookAtCode` for a pay prompt and `hint.holdAgain` for a product prompt. If not, the input has no effect.
10. `undo` (R12): remove one unit of the last entry of `adds` that the cart still holds. With no such entry, speak `undo.nothing`.
11. A removal drops the cart line at quantity 0 and removes the last matching entry of `adds`. Effects: `cart.updated` with `change.kind: 'remove'`, line `cart.removed`.
12. `cart.edit` sets the quantity of a cart line, and 0 removes the line. Ignore it if the cart has no line for the product, or if `qty` is not an integer from 0 to 99. A lower quantity speaks `cart.removed`, and a higher one speaks `cart.added`.

- [ ] **Step 1: Write the failing test**

```ts
it('R3: a yes with the ID of a replaced prompt adds nothing', () => {
  const h = harness();
  h.see(OAT); h.done(); const old = h.state.prompt!.id;
  h.see(RYE); h.done();
  h.yes('voice', old);
  expect(h.state.cart).toEqual(EMPTY_CART);
  h.yes('voice');
  expect(h.state.cart.items.map((i) => i.productId)).toEqual([RYE]);
});
it('R3: a yes with no prompt ID adds nothing', () => {
  const h = harness();
  h.see(OAT); h.done();
  h.send({ type: 'intent', kind: 'yes', source: 'phone' });
  expect(h.state.cart).toEqual(EMPTY_CART);
});
it('R4: a nod counts inside the head window', () => {
  const h = harness();
  h.see(OAT); h.done(); h.hold(OAT, T.headWindowMs - 500);
  h.yes('head');
  expect(h.state.cart.totalCents).toBe(189);
});
it('R4: a nod does not count at the end of the head window', () => {
  const h = harness();
  h.see(OAT); h.done(); h.hold(OAT, T.headWindowMs);
  h.yes('head');
  expect(h.state.cart).toEqual(EMPTY_CART);
});
it('R4: a nod does not count before the prompt finished', () => {
  const h = harness();
  h.see(OAT);
  h.yes('head', h.state.prompt!.id);
  expect(h.state.cart).toEqual(EMPTY_CART);
});
it('R4: a nod does not count when the product left the view', () => {
  const h = harness();
  h.see(OAT); h.done(); h.advance(T.viewMs);
  h.yes('head');
  expect(h.state.cart).toEqual(EMPTY_CART);
  expect(h.lines()).toEqual(['hint.holdAgain']);
});
it('R4: the profile can remove the time limit and can turn head gestures off', () => {
  const open = harness({ profile: { headWindowMs: null } });
  open.see(OAT); open.done(); open.hold(OAT, 20000); open.yes('head');
  expect(open.state.cart.totalCents).toBe(189);
  const off = harness({ profile: { headGestures: false } });
  off.see(OAT); off.done(); off.yes('head');
  expect(off.state.cart).toEqual(EMPTY_CART);
});
it('R5: a voice yes counts after the head window while the prompt is current', () => {
  const h = harness();
  h.see(OAT); h.done(); h.advance(T.headWindowMs + 1000);
  h.yes('voice');
  expect(h.state.cart.totalCents).toBe(189);
});
it('R5: a voice yes does not count for a prompt that ended', () => {
  const h = harness();
  h.see(OAT); h.done(); h.advance(T.viewMs + T.promptTtlAfterLeftMs);
  h.yes('voice');
  expect(h.state.cart).toEqual(EMPTY_CART);
});
it('R6: a phone yes names its card and needs no view and no finished prompt', () => {
  const h = harness();
  h.see(OAT); const card = h.state.prompt!.id;
  h.advance(T.viewMs + 5000);
  h.yes('phone', card);
  expect(h.state.cart.totalCents).toBe(189);
});
it('R6: a phone yes for a card that is gone adds nothing', () => {
  const h = harness();
  h.see(OAT); const card = h.state.prompt!.id;
  h.advance(T.viewMs + T.promptTtlAfterLeftMs);
  h.yes('phone', card);
  expect(h.state.cart).toEqual(EMPTY_CART);
  expect(h.effects).toEqual([]);
});
it('R7: an accepted yes adds one unit and names the product and the total', () => {
  const h = harness({ cart: [RYE] });
  h.see(OAT); h.done(); h.yes('head');
  expect(h.state.cart).toEqual({
    items: [
      { productId: RYE, name: 'Rye bread', packSize: '500 g', qty: 1, unitPriceCents: 260 },
      { productId: OAT, name: 'Oat drink', packSize: '1 L', qty: 1, unitPriceCents: 189 },
    ],
    totalCents: 449,
  });
  expect(h.events()).toEqual(['glance.cleared', 'cart.updated']);
  expect(h.event('cart.updated')!.change).toEqual({ kind: 'add', productId: OAT, name: 'Oat drink' });
  expect(h.speak()).toMatchObject({ line: { key: 'cart.added', totalCents: 449 }, sound: 'added', interrupt: true });
  expect(h.state.prompt).toBeNull();
});
it('R8: an accepted no skips the product and mutes it until it has left the view', () => {
  const h = harness();
  h.see(OAT); h.done(); h.no('head');
  expect(h.lines()).toEqual(['glance.skipped']);
  expect(h.events()).toEqual(['glance.cleared']);
  h.hold(OAT, 2000);
  expect(h.state.prompt).toBeNull();
  h.advance(T.viewMs); h.see(OAT);
  expect(h.state.prompt).toMatchObject({ productId: OAT, mode: 'new' });
  expect(h.state.cart).toEqual(EMPTY_CART);
});
it('R9: recognition excludes a skipped product for 10 seconds, and another product can become pending', () => {
  const h = harness();
  h.see(OAT); h.done(); h.no('head');
  expect(excludeList(h.state, h.now + T.excludeAfterNoMs - 1)).toEqual([OAT]);
  expect(excludeList(h.state, h.now + T.excludeAfterNoMs)).toEqual([]);
  h.see(BARISTA);
  expect(h.state.prompt).toMatchObject({ productId: BARISTA, mode: 'new' });
});
it('R10: after an add the product is muted, a second yes gets a hint, and a no removes the unit', () => {
  const h = harness();
  h.see(OAT); h.done(); h.yes('head');
  h.hold(OAT, 2000);
  expect(h.state.prompt).toBeNull();
  h.yes('head');
  expect(h.lines()).toEqual(['hint.holdAgainForAnother']);
  expect(h.state.cart.totalCents).toBe(189);
  h.no('head');
  expect(h.lines()).toEqual(['cart.removed']);
  expect(h.state.cart).toEqual(EMPTY_CART);
});
it('R10: a no later than 8 seconds after the add removes nothing', () => {
  const h = harness();
  h.see(OAT); h.done(); h.yes('head'); h.advance(T.undoWindowMs);
  h.no('head');
  expect(h.state.cart.totalCents).toBe(189);
});
it('R11: a yes on the add-another prompt adds a unit, and a no removes one', () => {
  const more = harness({ cart: [OAT] });
  more.see(OAT); more.done(); more.yes('head');
  expect(more.state.cart.items[0]!.qty).toBe(2);
  expect(more.speak()!.line).toMatchObject({ key: 'cart.added', totalCents: 378 });
  const less = harness({ cart: [OAT] });
  less.see(OAT); less.done(); less.no('head');
  expect(less.state.cart).toEqual(EMPTY_CART);
  expect(less.lines()).toEqual(['cart.removed']);
});
it('R12: an undo removes the last added unit and names it', () => {
  const h = harness();
  h.see(RYE); h.done(); h.yes('head'); h.advance(T.viewMs);
  h.see(OAT); h.done(); h.yes('head'); h.advance(T.undoWindowMs);
  h.intent('undo', 'voice');
  expect(h.speak()!.line).toMatchObject({ key: 'cart.removed', product: { id: OAT }, totalCents: 260 });
  h.intent('undo', 'phone');
  expect(h.state.cart).toEqual(EMPTY_CART);
  h.intent('undo', 'phone');
  expect(h.lines()).toEqual(['undo.nothing']);
});
it('R20: a late yes gets one hint, then silence', () => {
  const h = harness();
  h.see(OAT); h.done(); h.advance(T.headWindowMs);
  h.yes('head');
  expect(h.lines()).toEqual(['hint.holdAgain']);
  h.yes('head');
  expect(h.effects).toEqual([]);
});
it('R20: a yes more than 15 seconds after the last finished prompt does nothing', () => {
  const h = harness();
  h.see(OAT); h.done(); h.advance(T.hintAfterPromptMs);
  h.yes('head');
  expect(h.effects).toEqual([]);
  const fresh = harness();
  fresh.yes('head', 'p-9999');
  expect(fresh.effects).toEqual([]);
});
it('R21: silence never adds', () => {
  const h = harness();
  h.see(OAT); h.done();
  for (let i = 0; i < 60; i += 1) h.advance(1000);
  expect(h.state.cart).toEqual(EMPTY_CART);
});
it('a cart edit sets the quantity and names the product', () => {
  const h = harness({ cart: [RYE, OAT] });
  h.send({ type: 'cart.edit', productId: OAT, qty: 0 });
  expect(h.state.cart).toEqual({
    items: [{ productId: RYE, name: 'Rye bread', packSize: '500 g', qty: 1, unitPriceCents: 260 }], totalCents: 260,
  });
  expect(h.speak()!.line).toMatchObject({ key: 'cart.removed', product: { id: OAT }, totalCents: 260 });
});
it('a cart edit cannot add a product that the cart does not hold', () => {
  const h = harness();
  h.send({ type: 'cart.edit', productId: OAT, qty: 1 });
  expect(h.effects).toEqual([]);
  expect(h.state.cart).toEqual(EMPTY_CART);
});
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `npm test --workspace @glance/server -- answers`
Expected: FAIL, because no handler adds a unit yet.

- [ ] **Step 3: Implement `answers.ts` and register its handlers in `step.ts`**

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npm test --workspace @glance/server -- sessions`
Expected: PASS for `glance.test.ts` and `answers.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add apps/server
git commit -m "feat(server): add the answer rules for yes, no, undo, and cart edits"
```

---

### Task 5 (C2): Rules: checkout

**Files:**
- Create: `apps/server/src/sessions/checkout.ts`
- Modify: `apps/server/src/sessions/step.ts`, `apps/server/src/sessions/glance.ts`, `apps/server/src/sessions/answers.ts`
- Test: `apps/server/src/sessions/checkout.test.ts`

**Interfaces:**
- Consumes: Tasks 3 and 4.
- Produces: the handlers for `kiosk.seen` and `payment.result`, the pay prompt answers, and rule R19 in `expire`. No new export.

The phone applies R14: it reports a code after 1.5 seconds in view. The server adds no wait. The runtime (Task 16) turns the code text into the `kiosk.seen` input and sets `busy`.

Rules of this task:

1. `kiosk.seen` sets `lastTargetAt = now` and `kioskSeen = { kioskId, at: now, said }`. `said` starts at `false` for a new appearance: another kiosk, or `now - at >= TIMING.viewMs` since the last report.
2. Checkout starts (R15) when the phase is `shopping`, no checkout is open, the kiosk is not muted, and no product prompt is current.
3. A `busy` kiosk does not start a checkout. It speaks `checkout.busy` one time for each appearance (`said`). An empty cart speaks `checkout.empty` one time for each appearance.
4. Start: phase `checkout`, `checkout = { kiosk, step: 'offered', suspendedBy: null }`, event `session.state`, then the offer.
5. The offer makes a pay prompt with a new ID. It emits `checkout.offered` with the total, `itemCount` as the sum of the quantities, and `needsBiometric: false`. It speaks `checkout.offer` with the `promptId`.
6. R17: when `glance.ts` makes a product prompt while the step is `offered` or `suspended`, the step is `suspended` and `suspendedBy` is that product. On the change from `offered`, the event `checkout.suspended` comes before `glance.pending`.
7. Resume: a `kiosk.seen` for the checkout kiosk while `suspended`, with `suspendedBy` out of view. End a current product prompt with `glance.cleared`, then make the offer. The step is `offered` again.
8. Accepted yes on the pay prompt (R16, with `accepts` of Task 4): step `paying`, no prompt, and the single effect `payment.start`.
9. Accepted no on the pay prompt (R18): the checkout ends, and `mutedKioskId` is the kiosk. Line `checkout.cancelled`. `expire` clears `mutedKioskId` when the code has left the view.
10. A checkout ends this way: `checkout = null`, phase `shopping`, the pay prompt is dropped, and the events are `checkout.cancelled` then `session.state`.
11. R19 in `expire`: a checkout that is not `paying` ends when `now - kioskSeen.at >= TIMING.kioskIdleMs`. Line `checkout.cancelled`. The kiosk is not muted.
12. `payment.result` counts only in the step `paying`. With `ok: true`: set `lastReceipt`, phase `paid`, `cameraOn: false`, `checkout = null`, and the cart to `EMPTY_CART`. Effects in order: `checkout.paid` with the receipt, `cart.updated` with `change: null`, `session.state`, line `checkout.paid`, and `session.end`.
13. With `ok: false`: the checkout ends with the events `checkout.failed` (`reason: 'declined'`) then `session.state`. Line `checkout.failed`. The kiosk is muted, so the shopper must look at the code again.
14. While the step is `paying`: each yes, no, `undo`, `cart.edit`, and `stop` has no effect, and a recognition result makes no prompt.
15. A cart change while the step is `offered` makes a new offer after the cart line. This offer has `interrupt: false`. If the cart is empty, the checkout ends and the line is `checkout.empty`.
16. A `kiosk.seen` for another kiosk during a checkout changes only `kioskSeen` and `lastTargetAt`.

- [ ] **Step 1: Write the failing test**

```ts
const full = () => { const h = harness({ cart: [RYE, OAT, CRISPS] }); h.kiosk(); return h; };   // total 639, pay prompt current
const payments = (h: Harness) => h.all.filter((e) => e.type === 'payment.start');

it('R14: the first report of a kiosk code starts checkout, with no second wait on the server', () => {
  expect(full().state.phase).toBe('checkout');
});
it('R15: a kiosk code with items in the cart and no product prompt starts checkout', () => {
  const h = full();
  expect(h.events()).toEqual(['session.state', 'checkout.offered']);
  expect(h.event('checkout.offered')).toEqual({
    type: 'checkout.offered', promptId: h.state.prompt!.id, kiosk: KIOSK, totalCents: 639, itemCount: 3, needsBiometric: false,
  });
  expect(h.speak()).toMatchObject({
    line: { key: 'checkout.offer', kiosk: KIOSK, itemCount: 3, totalCents: 639 },
    priority: 'high', sound: 'found', promptId: h.state.prompt!.id,
  });
  expect(h.state.checkout).toMatchObject({ kiosk: KIOSK, step: 'offered' });
});
it('R15: with an empty cart the voice says so one time for each appearance of the code', () => {
  const h = harness();
  h.kiosk();
  expect(h.lines()).toEqual(['checkout.empty']);
  expect(h.state.phase).toBe('shopping');
  h.advance(1000); h.kiosk();
  expect(h.effects).toEqual([]);
  h.advance(T.viewMs); h.kiosk();
  expect(h.lines()).toEqual(['checkout.empty']);
});
it('R15: a current product prompt holds the checkout back', () => {
  const h = harness({ cart: [RYE] });
  h.see(OAT); h.kiosk();
  expect(h.state.phase).toBe('shopping');
  h.done(); h.no('head'); h.kiosk();
  expect(h.state.phase).toBe('checkout');
});
it('R15: a busy kiosk gets one line and no checkout', () => {
  const h = harness({ cart: [RYE] });
  h.kiosk({ busy: true });
  expect(h.lines()).toEqual(['checkout.busy']);
  expect(h.state.phase).toBe('shopping');
  h.advance(1000); h.kiosk({ busy: true });
  expect(h.effects).toEqual([]);
});
it('R16: a nod on the finished pay prompt, with the code in view, starts the payment', () => {
  const h = full(); h.done();
  h.yes('head');
  expect(h.effects).toEqual([{ type: 'payment.start', kiosk: KIOSK, totalCents: 639 }]);
  expect(h.state.checkout!.step).toBe('paying');
});
it('R16: a nod with the code out of view does not pay', () => {
  const h = full(); h.done(); h.advance(T.viewMs);
  h.yes('head');
  expect(payments(h)).toEqual([]);
  expect(h.lines()).toEqual(['hint.lookAtCode']);
});
it('R16: a yes for a product prompt never pays', () => {
  const h = harness({ cart: [RYE] });
  h.see(OAT); h.done(); const card = h.state.prompt!.id;
  h.no('phone', card); h.kiosk();
  h.yes('voice', card);
  expect(payments(h)).toEqual([]);
});
it('R17: a product held up during checkout suspends it, and the pay prompt returns with the new total', () => {
  const h = full(); const first = h.state.prompt!.id;
  h.see(BARISTA);
  expect(h.events()).toEqual(['checkout.suspended', 'glance.pending']);
  expect(h.state.checkout!.step).toBe('suspended');
  h.done(); h.yes('head');
  h.kiosk();
  expect(h.state.prompt).toBeNull();
  h.advance(T.viewMs); h.kiosk();
  expect(h.event('checkout.offered')).toMatchObject({ totalCents: 868, itemCount: 4 });
  expect(h.state.prompt!.id).not.toBe(first);
  h.yes('voice', first);
  expect(payments(h)).toEqual([]);
});
it('R18: a no on the pay prompt cancels the checkout and mutes the kiosk until its code has left the view', () => {
  const h = full(); h.done();
  h.no('head');
  expect(h.events()).toEqual(['checkout.cancelled', 'session.state']);
  expect(h.lines()).toEqual(['checkout.cancelled']);
  expect(h.state).toMatchObject({ phase: 'shopping', checkout: null, prompt: null });
  expect(h.state.cart.totalCents).toBe(639);
  h.advance(1000); h.kiosk();
  expect(h.state.phase).toBe('shopping');
  h.advance(T.viewMs); h.kiosk();
  expect(h.state.phase).toBe('checkout');
});
it('R19: the checkout ends when the code was out of view for 30 seconds, and the cart stays', () => {
  const h = full();
  h.advance(T.kioskIdleMs - 1);
  expect(h.state.phase).toBe('checkout');
  h.advance(1);
  expect(h.events()).toEqual(['checkout.cancelled', 'session.state']);
  expect(h.state).toMatchObject({ phase: 'shopping', checkout: null });
  expect(h.state.cart.totalCents).toBe(639);
});
it('R21: silence never pays', () => {
  const away = full(); away.done();
  for (let i = 0; i < 60; i += 1) away.advance(1000);
  const looking = full(); looking.done();
  for (let i = 0; i < 60; i += 1) { looking.advance(1000); looking.kiosk(); }
  expect(payments(away)).toEqual([]);
  expect(payments(looking)).toEqual([]);
  expect(looking.state.phase).toBe('checkout');
});
it('a paid checkout gives a receipt, empties the cart, and ends the session', () => {
  const h = full(); h.done(); h.yes('head');
  h.send({ type: 'payment.result', ok: true, orderId: 'ord-1', paidAt: '2026-11-14T12:00:00.000Z' });
  expect(h.events()).toEqual(['checkout.paid', 'cart.updated', 'session.state']);
  expect(h.event('checkout.paid')).toMatchObject({
    orderId: 'ord-1', totalCents: 639, paidAt: '2026-11-14T12:00:00.000Z', kiosk: KIOSK,
  });
  expect(h.event('checkout.paid')!.items).toHaveLength(3);
  expect(h.event('cart.updated')).toEqual({ type: 'cart.updated', cart: EMPTY_CART, change: null });
  expect(h.state).toMatchObject({ phase: 'paid', cameraOn: false, cart: EMPTY_CART, checkout: null });
  expect(h.state.lastReceipt).toMatchObject({ orderId: 'ord-1', totalCents: 639 });
  expect(h.speak()).toMatchObject({ line: { key: 'checkout.paid', totalCents: 639 }, sound: 'paid', priority: 'high' });
  expect(h.effects.at(-1)).toEqual({ type: 'session.end' });
});
it('a failed payment charges nothing and waits until the shopper looks at the code again', () => {
  const h = full(); h.done(); h.yes('head');
  h.send({ type: 'payment.result', ok: false, orderId: '', paidAt: '' });
  expect(h.events()).toEqual(['checkout.failed', 'session.state']);
  expect(h.event('checkout.failed')).toEqual({ type: 'checkout.failed', reason: 'declined' });
  expect(h.lines()).toEqual(['checkout.failed']);
  expect(h.state).toMatchObject({ phase: 'shopping', checkout: null });
  expect(h.state.cart.totalCents).toBe(639);
  h.advance(1000); h.kiosk();
  expect(h.state.phase).toBe('shopping');
  h.advance(T.viewMs); h.kiosk();
  expect(h.state.phase).toBe('checkout');
});
it('a payment result with no payment in progress changes nothing', () => {
  const h = full();
  h.send({ type: 'payment.result', ok: true, orderId: 'ord-1', paidAt: '2026-11-14T12:00:00.000Z' });
  expect(h.effects).toEqual([]);
  expect(h.state.phase).toBe('checkout');
});
```

Review Focus 1 and 2, in the same file:

```ts
it('a cart change during a pay prompt gives a new pay prompt, and the old one cannot pay', () => {
  const h = full(); h.done(); const old = h.state.prompt!.id;
  h.send({ type: 'cart.edit', productId: CRISPS, qty: 0 });
  expect(h.events()).toEqual(['cart.updated', 'checkout.offered']);
  expect(h.lines()).toEqual(['cart.removed', 'checkout.offer']);
  expect(h.event('checkout.offered')).toMatchObject({ totalCents: 449, itemCount: 2 });
  h.yes('phone', old);
  expect(payments(h)).toEqual([]);
});
it('an empty cart ends the checkout', () => {
  const h = harness({ cart: [RYE] }); h.kiosk();
  h.send({ type: 'cart.edit', productId: RYE, qty: 0 });
  expect(h.events()).toEqual(['cart.updated', 'checkout.cancelled', 'session.state']);
  expect(h.lines()).toEqual(['cart.removed', 'checkout.empty']);
  expect(h.state).toMatchObject({ phase: 'shopping', checkout: null, prompt: null });
});
it('a second yes while the payment runs starts no second payment and says nothing', () => {
  const h = full(); h.done(); const pay = h.state.prompt!.id;
  h.yes('head');
  h.yes('head'); expect(h.effects).toEqual([]);
  h.yes('phone', pay); expect(h.effects).toEqual([]);
  h.intent('undo', 'phone'); expect(h.effects).toEqual([]);
  h.send({ type: 'cart.edit', productId: RYE, qty: 0 }); expect(h.effects).toEqual([]);
  expect(payments(h)).toHaveLength(1);
  expect(h.state.cart.totalCents).toBe(639);
});
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `npm test --workspace @glance/server -- checkout`
Expected: FAIL, because no handler starts a checkout yet.

- [ ] **Step 3: Implement `checkout.ts`, and change `glance.ts` and `answers.ts` for rules 6, 14, and 15**

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npm test --workspace @glance/server -- sessions`
Expected: PASS for the three test files.

- [ ] **Step 5: Commit**

```bash
git add apps/server
git commit -m "feat(server): add the checkout rules and the payment result"
```

---

### Task 6 (C2): Rules: session, device, information, replays

**Files:**
- Create: `apps/server/src/sessions/general.ts`
- Modify: `apps/server/src/sessions/step.ts`, `apps/server/src/sessions/view.ts`
- Test: `apps/server/src/sessions/general.test.ts`, `apps/server/src/sessions/replays.test.ts`

**Interfaces:**
- Consumes: Tasks 3 to 5. `SessionSnapshot`, `SessionSnapshotSchema`, `Caption`, `DEFAULT_PROFILE` from `@glance/shared`.
- Produces:

```ts
// general.ts
export const CANNOT_STREAM_BATTERY = 5;    // percent
export const CANNOT_STREAM_THERMAL = 6;    // level 0 to 7
export function cannotStream(device: DeviceState): boolean;

// view.ts
export function toSnapshot(sessionId: string, state: SessionState, captions: Caption[], ctx: RuleContext): SessionSnapshot;
```

Rules of this task:

1. `device.state` stores the state in `device`.
2. `stream` is `streaming` while `cameraOn` is false, in the phase `shopping`, `checkout`, or `resting`: set `cameraOn: true`, change `resting` to `shopping`, set `lastTargetAt = now`. Effects: `session.state`, line `session.start`.
3. `stream` is `stopped` while `cameraOn` is true: set `cameraOn: false`. A checkout that is not `paying` ends (R24). Effects: the checkout events if one ended, one `session.state`, and one line.
4. That line is `device.regularCheckout` when `cannotStream(state)` is true, else `device.cameraOff`.
5. `cannotStream`: `link` is `connected`, and `battery <= CANNOT_STREAM_BATTERY` or `thermal >= CANNOT_STREAM_THERMAL`. A `null` value does not count. `DeviceState` has no stream error, so this is the closest signal.
6. R22 in `expire`: in the phase `shopping` or `checkout`, with `cameraOn` true and no payment in progress, when `now - lastTargetAt >= TIMING.restAfterIdleMs`. Set phase `resting` and `cameraOn: false`, and end a checkout. Effects: `session.state`, line `session.rest`, then `session.rest`.
7. Intent `stop`: phase `ended`, `cameraOn: false`, no prompt, no checkout. Effects: `glance.cleared` or the checkout events if they apply, `session.state`, line `device.cameraOff`, then `session.end`.
8. Intent `repeat`: speak `lastSpeak` again. Keep its `promptId` only if that prompt is still current. With no `lastSpeak`, do nothing.
9. Intent `total`: line `info.total`, or `checkout.empty` for an empty cart. Intent `help`: line `info.help`.
10. Intent `cart` (R23): line `info.cart` with the first five cart lines, and `more: true` if the cart has more.
11. `profile.set` merges the patch into `profile`.
12. In the phase `paid` or `ended`, `step` ignores each input except `tick`, `device.state`, and `profile.set`. In those two phases a `device.state` only stores the state.
13. `toSnapshot` maps the current prompt to `CurrentPrompt`. `kiosk` is the kiosk of the checkout. `needsBiometric` is `false` until Task 27.
14. Intent `ask` has no effect in this task. Task 26 gives it a meaning.

- [ ] **Step 1: Write the failing tests**

`general.test.ts`:

```ts
it('says Camera on when the stream starts', () => {
  const h = harness();
  h.send({ type: 'device.state', state: STREAMING });
  expect(h.event('session.state')).toEqual({ type: 'session.state', phase: 'shopping', cameraOn: true });
  expect(h.lines()).toEqual(['session.start']);
  h.send({ type: 'device.state', state: { ...STREAMING, battery: 79 } });
  expect(h.effects).toEqual([]);
});
it('a stop intent ends the session with Camera off', () => {
  const h = harness({ cart: [RYE] });
  h.send({ type: 'device.state', state: STREAMING });
  h.intent('stop', 'phone');
  expect(h.state).toMatchObject({ phase: 'ended', cameraOn: false });
  expect(h.lines()).toEqual(['device.cameraOff']);
  expect(h.effects.at(-1)).toEqual({ type: 'session.end' });
  h.see(OAT);
  expect(h.effects).toEqual([]);
});
it('R22: after 3 minutes with no product and no kiosk in view the camera rests, and the cart stays', () => {
  const h = harness({ cart: [RYE] });
  h.send({ type: 'device.state', state: STREAMING });
  h.see(OAT);
  h.advance(T.restAfterIdleMs - 1);
  expect(h.state.phase).toBe('shopping');
  h.advance(1);
  expect(h.state).toMatchObject({ phase: 'resting', cameraOn: false });
  expect(h.events()).toEqual(['session.state']);
  expect(h.lines()).toEqual(['session.rest']);
  expect(h.effects.at(-1)).toEqual({ type: 'session.rest' });
  expect(h.state.cart.totalCents).toBe(260);
});
it('R22: the session shops again when the phone restarts the camera', () => {
  const h = harness();
  h.send({ type: 'device.state', state: STREAMING });
  h.advance(T.restAfterIdleMs);
  h.send({ type: 'device.state', state: { ...STREAMING, stream: 'stopped' } });
  expect(h.effects).toEqual([]);
  h.send({ type: 'device.state', state: STREAMING });
  expect(h.state).toMatchObject({ phase: 'shopping', cameraOn: true });
  expect(h.lines()).toEqual(['session.start']);
});
it('R23: the cart by voice speaks at most five lines', () => {
  const six = [1, 2, 3, 4, 5, 6].map((n) => product(`item-${n}`, 100));
  const h = harness({ products: six, cart: six.map((p) => p.id) });
  h.intent('cart', 'voice');
  const line = h.speak()!.line as Extract<Line, { key: 'info.cart' }>;
  expect(line.items.map((i) => i.product.id)).toEqual(['item-1', 'item-2', 'item-3', 'item-4', 'item-5']);
  expect(line).toMatchObject({ more: true, totalCents: 600 });
});
it('R24: when the glasses cannot stream, an open checkout ends and the cart stays', () => {
  const h = harness({ cart: [RYE, OAT, CRISPS] });
  h.send({ type: 'device.state', state: STREAMING });
  h.kiosk();
  h.send({ type: 'device.state', state: { ...STREAMING, stream: 'stopped', battery: 3 } });
  expect(h.events()).toEqual(['checkout.cancelled', 'session.state']);
  expect(h.lines()).toEqual(['device.regularCheckout']);
  expect(h.state).toMatchObject({ phase: 'shopping', cameraOn: false, checkout: null });
  expect(h.state.cart.totalCents).toBe(639);
});
it('a stop by the device for another reason says Camera off', () => {
  const h = harness();
  h.send({ type: 'device.state', state: STREAMING });
  h.send({ type: 'device.state', state: { ...STREAMING, stream: 'stopped', hingeOpen: false } });
  expect(h.lines()).toEqual(['device.cameraOff']);
  expect(h.state.cameraOn).toBe(false);
});
it('repeats the last line and opens the head window again for a current prompt', () => {
  const h = harness();
  h.see(OAT); h.done(); h.hold(OAT, T.headWindowMs);
  h.intent('repeat', 'voice');
  expect(h.speak()).toMatchObject({ line: { key: 'glance.new' }, promptId: 'p-0001' });
  h.done(); h.yes('head');
  expect(h.state.cart.totalCents).toBe(189);
});
it('speaks the total, and says so for an empty cart', () => {
  const h = harness({ cart: [RYE, OAT] });
  h.intent('total', 'voice');
  expect(h.speak()!.line).toEqual({ key: 'info.total', itemCount: 2, totalCents: 449 });
  const empty = harness();
  empty.intent('total', 'voice');
  expect(empty.lines()).toEqual(['checkout.empty']);
});
it('merges a profile patch', () => {
  const h = harness();
  h.send({ type: 'profile.set', patch: { detail: 'brief' } });
  expect(h.state.profile).toEqual({ ...DEFAULT_PROFILE, detail: 'brief' });
});
it('makes a snapshot that passes the shared schema', () => {
  const h = harness({ cart: [RYE] });
  h.see(OAT);
  const snapshot = toSnapshot('s1', h.state, [], h.ctx);
  expect(SessionSnapshotSchema.parse(snapshot)).toEqual(snapshot);
  expect(snapshot.prompt).toEqual({
    promptId: 'p-0001', kind: 'product', mode: 'new',
    product: { id: OAT, name: 'Oat drink', packSize: '1 L', priceCents: 189 }, warnings: [], qtyInCart: 0,
  });
  expect(snapshot).toMatchObject({ sessionId: 's1', phase: 'shopping', kiosk: null, lastReceipt: null, captions: [] });
});
```

`replays.test.ts` replays result sequences with gaps and changes, because live results flicker:

```ts
const pendings = (h: Harness) => h.all.filter((e) => e.type === 'event' && e.event.type === 'glance.pending');
const spoken = (h: Harness) => h.all.filter((e): e is SpeakEffect => e.type === 'speak').map((e) => e.line.key);

it('gaps shorter than the view time keep one prompt', () => {
  const h = harness();
  h.see(OAT);
  h.at(500); h.result({ status: 'none' });
  h.at(1000); h.see(OAT);
  h.at(2000); h.result({ status: 'none' });
  h.at(3900); h.see(OAT);
  expect(pendings(h)).toHaveLength(1);
});
it('a gap of the view time gives a new prompt, and the old prompt ID adds nothing', () => {
  const h = harness();
  h.see(OAT); h.done(); const first = h.state.prompt!.id;
  h.at(T.viewMs); h.see(OAT);
  expect(pendings(h)).toHaveLength(2);
  h.yes('head', first);
  expect(h.state.cart).toEqual(EMPTY_CART);
});
it('a one-frame change replaces the prompt, and each yes adds only the product of its own prompt', () => {
  const h = harness();
  h.see(OAT); h.done(); const p1 = h.state.prompt!.id;
  h.at(500); h.see(BARISTA); const p2 = h.state.prompt!.id;
  h.at(1000); h.see(OAT); const p3 = h.state.prompt!.id;
  expect(new Set([p1, p2, p3]).size).toBe(3);
  h.yes('head', p1); h.yes('voice', p2);
  expect(h.state.cart).toEqual(EMPTY_CART);
  h.done(); h.yes('head');
  expect(h.state.cart.items.map((i) => i.productId)).toEqual([OAT]);
});
it('a late prompt.done for a replaced prompt opens no window', () => {
  const h = harness();
  h.see(OAT); const p1 = h.state.prompt!.id;
  h.at(500); h.see(RYE);
  h.send({ type: 'prompt.done', promptId: p1 });
  expect(h.state.prompt!.doneAt).toBeNull();
  h.yes('head', p1); h.yes('head', h.state.prompt!.id);
  expect(h.state.cart).toEqual(EMPTY_CART);
});
it('an added product that flickers for 10 seconds gets no second prompt and no second unit', () => {
  const h = harness();
  h.see(OAT); h.done(); h.yes('head');
  for (let t = 500; t <= 10000; t += 500) {
    h.at(t);
    if (t % 1500 === 0) h.result({ status: 'none' }); else h.see(OAT);
  }
  expect(pendings(h)).toHaveLength(1);
  expect(h.state.cart.items[0]!.qty).toBe(1);
});
it('unsure and unknown results between results of the pending product say nothing', () => {
  const h = harness();
  h.see(OAT);
  h.at(500); h.result({ status: 'unsure', aimHint: 'left' });
  h.at(1000); h.result({ status: 'unknown' });
  h.at(1500); h.see(OAT);
  expect(spoken(h)).toEqual(['glance.new']);
});
it('a muted product in view does not suspend the checkout', () => {
  const h = harness({ cart: [RYE] });
  h.see(OAT); h.done(); h.yes('head');
  h.kiosk();
  h.at(500); h.see(OAT);
  expect(h.state.checkout!.step).toBe('offered');
});
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/server -- sessions`
Expected: `general.test.ts` fails, because `toSnapshot` does not exist. If a replay test fails, fix the rule of Tasks 3 to 5 that it names.

- [ ] **Step 3: Implement `general.ts`, `toSnapshot`, and rule 6 in `expire`**

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npm test --workspace @glance/server -- sessions`
Expected: PASS for the five test files. Each rule R1 to R24 has a test with its number in the name.

- [ ] **Step 5: Commit**

```bash
git add apps/server
git commit -m "feat(server): add the session, device, and information rules with flicker replays"
```

---

### Task 7 (C2): Speech text

**Files:**
- Create: `apps/server/src/speech/numbers.ts`, `apps/server/src/speech/phrases.ts`, `apps/server/src/speech/lines.en.ts`, `apps/server/src/speech/render.ts`
- Test: `apps/server/src/speech/numbers.test.ts`, `apps/server/src/speech/render.test.ts`

**Interfaces:**
- Consumes: `Line` (Task 3), `readCatalogFile`, `indexCatalog` (Task 2). `Profile`, `Lang`, `localize`, `DEFAULT_PROFILE` from `@glance/shared`.
- Produces:

```ts
// numbers.ts
export function numberToWords(n: number, lang: Lang): string;   // an integer from 0 to 9999
export function spokenPrice(cents: number, lang: Lang, form: 'short' | 'full'): string;

// phrases.ts
export type YesPhrases = { add: string; addAnother: string; remove: string; pay: string; thenYes: string };
export function yesPhrases(profile: Profile): YesPhrases;   // the yes phrase table of "Spoken lines"

// lines.en.ts
export type LineTemplates = { [K in Line['key']]: (line: Extract<Line, { key: K }>, profile: Profile) => string };
export const LINES_EN: LineTemplates;

// render.ts
export function renderLine(line: Line, profile: Profile): string;
```

Price rules:

- Short form, with 1 to 99 euros and 1 to 99 cents: the euros, then the cents. Cents under 10 are "oh" and the digit.
- The short form of each other amount is its full form.
- Full form: "{euros} euros" and the cents. Cents from 1 to 9 are "and {n} cents". With no euros the form is "{cents} cents". The words "euro" and "cent" are singular for 1.
- `spokenPrice` throws `RangeError` unless `cents` is an integer from 0 to 999999.
- This task writes English. Until Task 28, the language `it` gives the English text.

- [ ] **Step 1: Write the failing tests**

`numbers.test.ts`:

```ts
it('speaks the short form', () => {
  expect(spokenPrice(189, 'en', 'short')).toBe('one eighty-nine');
  expect(spokenPrice(449, 'en', 'short')).toBe('four forty-nine');
  expect(spokenPrice(260, 'en', 'short')).toBe('two sixty');
  expect(spokenPrice(2110, 'en', 'short')).toBe('twenty-one ten');
  expect(spokenPrice(105, 'en', 'short')).toBe('one oh five');
  expect(spokenPrice(200, 'en', 'short')).toBe('two euros');
  expect(spokenPrice(99, 'en', 'short')).toBe('ninety-nine cents');
  expect(spokenPrice(12345, 'en', 'short')).toBe('one hundred twenty-three euros forty-five');
});
it('speaks the full form', () => {
  expect(spokenPrice(639, 'en', 'full')).toBe('six euros thirty-nine');
  expect(spokenPrice(189, 'en', 'full')).toBe('one euro eighty-nine');
  expect(spokenPrice(2000, 'en', 'full')).toBe('twenty euros');
  expect(spokenPrice(605, 'en', 'full')).toBe('six euros and five cents');
  expect(spokenPrice(1, 'en', 'full')).toBe('one cent');
  expect(spokenPrice(0, 'en', 'full')).toBe('zero euros');
});
it('rejects a price that is negative, not an integer, or too large', () => {
  expect(() => spokenPrice(-1, 'en', 'short')).toThrow(RangeError);
  expect(() => spokenPrice(1.5, 'en', 'full')).toThrow(RangeError);
  expect(() => spokenPrice(1000000, 'en', 'full')).toThrow(RangeError);
});
it('writes numbers as words', () => {
  const words = [0, 7, 13, 20, 21, 40, 99, 100, 101, 110, 999, 1000, 1234, 9999].map((n) => numberToWords(n, 'en'));
  expect(words).toEqual([
    'zero', 'seven', 'thirteen', 'twenty', 'twenty-one', 'forty', 'ninety-nine', 'one hundred', 'one hundred one',
    'one hundred ten', 'nine hundred ninety-nine', 'one thousand', 'one thousand two hundred thirty-four',
    'nine thousand nine hundred ninety-nine',
  ]);
});
```

`render.test.ts`:

```ts
const catalog = indexCatalog(readCatalogFile('catalog/catalog.dev.json'));
const oat = catalog.get('oat-drink-1l')!;
const rye = catalog.get('rye-bread')!;
const KIOSK = { id: 'kiosk-1', name: 'Checkout 3', store: 'Demo Market' };
const text = (line: Line, patch: ProfilePatch = {}) => renderLine(line, { ...DEFAULT_PROFILE, ...patch });
const glance = (hint: boolean): Line => ({ key: 'glance.new', product: oat, hint, warnings: [] });
const inCart = (qty: number): Line => ({ key: 'glance.inCart', product: oat, qty, warnings: [] });
const added: Line = { key: 'cart.added', product: oat, totalCents: 449, budgetCents: null };

it('speaks the lines of spec section 6.1 at the standard level', () => {
  expect(text(glance(false))).toBe('Oat drink, one litre, one eighty-nine.');
  expect(text(glance(true))).toBe('Oat drink, one litre, one eighty-nine. Nod to add.');
  expect(text(added)).toBe('Added oat drink. Total four forty-nine.');
  expect(text({ key: 'cart.removed', product: oat, totalCents: 260 })).toBe('Removed oat drink. Total two sixty.');
  expect(text(inCart(1))).toBe('Oat drink. One is in your cart. Nod to add another. Shake to remove.');
  expect(text(inCart(2))).toBe('Oat drink. Two are in your cart. Nod to add another. Shake to remove.');
  expect(text({ key: 'glance.partial', aimHint: 'left' })).toBe('I can see part of it. Move it left a little.');
  expect(text({ key: 'checkout.offer', kiosk: KIOSK, itemCount: 3, totalCents: 639 }))
    .toBe('Checkout 3 at Demo Market. Three items, six euros thirty-nine. Nod to pay.');
  expect(text({ key: 'checkout.paid', totalCents: 639 }))
    .toBe('Paid. Six euros thirty-nine. Your receipt is on your phone. Camera off.');
  expect(text({ key: 'hint.lookAtCode' })).toBe('Look at the checkout code, then nod.');
  expect(text({ key: 'info.help' }))
    .toBe('Hold a product up to hear its price. Nod to add it. Look at a checkout code and nod to pay.');
  expect(text({ key: 'device.battery', percent: 20 })).toBe('Glasses battery at twenty percent.');
});
it('speaks each fixed line of the table', () => {
  const fixed = {
    'session.start': 'Camera on. Hold a product up to hear its price.',
    'session.rest': 'Camera off. Your cart is safe.',
    'glance.unknown': 'I do not know this product.',
    'glance.skipped': 'Skipped.',
    'undo.nothing': 'Nothing to undo.',
    'hint.holdAgain': 'Hold it up again.',
    'hint.holdAgainForAnother': 'Hold it up again to add another.',
    'checkout.empty': 'Your cart is empty.',
    'checkout.busy': 'This checkout is busy.',
    'checkout.cancelled': 'Checkout cancelled. Your cart is safe.',
    'checkout.failed': 'Payment failed. Nothing was charged. Look at the code to try again.',
    'device.cameraOff': 'Camera off.',
    'device.regularCheckout': 'Camera off. Please use a regular checkout.',
    'device.paused': 'Paused. Tap the side of your glasses to resume.',
    'net.backOnline': 'Back online.',
    'recognition.slow': 'Recognition is slow right now.',
  };
  for (const [key, line] of Object.entries(fixed)) expect(text({ key } as Line)).toBe(line);
});
it('speaks the brief and the detailed level', () => {
  expect(text(glance(false), { detail: 'brief' })).toBe('Oat drink, one eighty-nine.');
  expect(text(added, { detail: 'brief' })).toBe('Added oat drink.');
  expect(text(glance(false), { detail: 'detailed' }))
    .toBe('Oatly oat drink, one litre carton, one euro eighty-nine. Contains gluten.');
});
it('never shortens the pay prompt', () => {
  expect(text({ key: 'checkout.offer', kiosk: KIOSK, itemCount: 1, totalCents: 260 }, { detail: 'brief' }))
    .toBe('Checkout 3 at Demo Market. One item, two euros sixty. Nod to pay.');
});
it('names the main yes input of the shopper', () => {
  expect(text(glance(true), { mainYes: 'touch' })).toBe('Oat drink, one litre, one eighty-nine. Double tap to add.');
  expect(text(glance(true), { mainYes: 'voice' })).toBe('Oat drink, one litre, one eighty-nine. Say add.');
  expect(text(glance(true), { mainYes: 'phone' })).toBe('Oat drink, one litre, one eighty-nine. Press Add on your phone.');
  expect(text(glance(true), { yesGesture: 'shake' })).toBe('Oat drink, one litre, one eighty-nine. Shake to add.');
  expect(text(glance(true), { headGestures: false })).toBe('Oat drink, one litre, one eighty-nine. Press Add on your phone.');
  expect(text(inCart(1), { yesGesture: 'shake' })).toBe('Oat drink. One is in your cart. Shake to add another. Nod to remove.');
  expect(text(inCart(1), { mainYes: 'touch' })).toBe('Oat drink. One is in your cart. Double tap to add another.');
  expect(text({ key: 'hint.lookAtCode' }, { mainYes: 'key' })).toBe('Look at the checkout code, then press volume up.');
  expect(text({ key: 'info.help' }, { mainYes: 'touch' }))
    .toBe('Hold a product up to hear its price. Double tap to add. Look at a checkout code. Double tap to pay.');
});
it('reads the cart and the total', () => {
  const items = [{ product: rye, qty: 1 }, { product: oat, qty: 2 }];
  expect(text({ key: 'info.cart', items, more: false, totalCents: 638 }))
    .toBe('Rye bread, one. Oat drink, two. Total six thirty-eight.');
  expect(text({ key: 'info.cart', items, more: true, totalCents: 638 }))
    .toBe('Rye bread, one. Oat drink, two. And more on your phone. Total six thirty-eight.');
  expect(text({ key: 'info.total', itemCount: 3, totalCents: 639 })).toBe('Three items. Total six thirty-nine.');
});
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/server -- speech`
Expected: FAIL, because the modules do not exist.

- [ ] **Step 3: Implement the four modules**

`LINES_EN` has one template for each line key. A template reads `profile.detail` and the yes phrases. `renderLine` selects the template by `line.key`. The text rules are in the "Spoken lines" section.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npm test --workspace @glance/server -- speech`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server
git commit -m "feat(server): add spoken prices and the English line table"
```

---

### Task 8 (C2): Storage

**Files:**
- Create: `apps/server/src/db/store.ts`, `apps/server/src/db/memory.ts`, `apps/server/src/db/mongo.ts`, `apps/server/src/db/contract.ts`
- Test: `apps/server/src/db/memory.test.ts`, `apps/server/src/db/mongo.test.ts`

**Interfaces:**
- Consumes: `SessionState` (Task 3). `Product`, `CartItem` from `@glance/shared`.
- Produces:

```ts
// store.ts
export type SessionRecord = SessionState & { _id: string; token: string; kioskId: string | null; updatedAt: number };
export type KioskRecord = {
  _id: string; token: string; code: string; name: string; store: string;
  boundSessionId: string | null; lastSeenAt: number | null; spotCheck: boolean; failPayment: boolean;
};
export type OrderRecord = {
  _id: string; sessionId: string; kioskId: string; items: CartItem[]; totalCents: number; paidAt: string; method: 'demo';
};
export type ClipRecord = { _id: string; path: string };   // _id is the clip hash

export interface Store {
  listProducts(): Promise<Product[]>;               // sorted by id
  replaceProducts(products: Product[]): Promise<void>;
  getSession(id: string): Promise<SessionRecord | null>;
  putSession(record: SessionRecord): Promise<void>;
  deleteSession(id: string): Promise<void>;         // also deletes the orders of the session
  listKiosks(): Promise<KioskRecord[]>;
  putKiosk(record: KioskRecord): Promise<void>;     // throws if another kiosk has the same code
  insertOrder(order: OrderRecord): Promise<void>;
  listOrders(sessionId: string): Promise<OrderRecord[]>;
  getClip(hash: string): Promise<ClipRecord | null>;
  putClip(clip: ClipRecord): Promise<void>;
  close(): Promise<void>;
}

// memory.ts
export class MemoryStore implements Store { constructor(products?: Product[]); }

// mongo.ts
export class MongoStore implements Store { static connect(uri: string, dbName: string): Promise<MongoStore>; }

// contract.ts
export function storeContract(name: string, open: () => Promise<Store>): void;   // registers one describe block
```

The collections are those of spec section 8.6: `products`, `sessions`, `kiosks`, `orders`, `speech_clips`. A product document has `_id` equal to the product `id`. The session document holds the fields of spec section 8.6 at the top level, because `SessionRecord` is the state plus four fields.

- [ ] **Step 1: Write the contract and the failing tests**

`contract.ts` registers these tests. Each one opens a new store.

```ts
it('replaces the products and lists them sorted by ID', async () => {
  await store.replaceProducts([rye, oat]);
  expect((await store.listProducts()).map((p) => p.id)).toEqual(['oat-drink-1l', 'rye-bread']);
  await store.replaceProducts([oat]);
  expect(await store.listProducts()).toEqual([oat]);
});
it('keeps a session and returns a copy', async () => {
  const record = sessionRecord('s1');            // createSessionState plus _id, token 't1', kioskId null, updatedAt 1
  await store.putSession(record);
  record.cart = { items: [], totalCents: 999 };  // a change after the write must not reach the store
  expect((await store.getSession('s1'))!.cart).toEqual(EMPTY_CART);
  expect(await store.getSession('nope')).toBeNull();
});
it('deletes a session with its orders and keeps the orders of other sessions', async () => {
  await store.putSession(sessionRecord('s1'));
  await store.insertOrder(order('ord-1', 's1'));
  await store.insertOrder(order('ord-2', 's2'));
  await store.deleteSession('s1');
  expect(await store.getSession('s1')).toBeNull();
  expect(await store.listOrders('s1')).toEqual([]);
  expect((await store.listOrders('s2')).map((o) => o._id)).toEqual(['ord-2']);
});
it('keeps a kiosk and rejects a second kiosk with the same code', async () => {
  await store.putKiosk(kiosk('k1', 'K3X7'));
  await store.putKiosk({ ...kiosk('k1', 'K3X7'), boundSessionId: 's1' });   // the same kiosk can change
  expect((await store.listKiosks())[0]!.boundSessionId).toBe('s1');
  await expect(store.putKiosk(kiosk('k2', 'K3X7'))).rejects.toThrow();
});
it('keeps a clip record', async () => {
  await store.putClip({ _id: 'a'.repeat(64), path: '/data/a.mp3' });
  expect(await store.getClip('a'.repeat(64))).toEqual({ _id: 'a'.repeat(64), path: '/data/a.mp3' });
  expect(await store.getClip('b'.repeat(64))).toBeNull();
});
```

`memory.test.ts` calls `storeContract('MemoryStore', async () => new MemoryStore())`.

`mongo.test.ts` calls `storeContract` inside `describe.skipIf(!process.env.MONGODB_URI_TEST)`. It opens a database with a random name and drops it after each test.

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/server -- db`
Expected: FAIL for `memory.test.ts`, because `MemoryStore` does not exist. `mongo.test.ts` is skipped.

- [ ] **Step 3: Implement `MemoryStore` and `MongoStore`**

- `MemoryStore` copies each record with `structuredClone` on write and on read.
- `MongoStore.connect` uses `new MongoClient(uri, { serverSelectionTimeoutMS: 5000 })`. It creates a unique index on `kiosks.code` and an index on `orders.sessionId`.
- `MongoStore` writes with `replaceOne({ _id }, document, { upsert: true })`.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npm test --workspace @glance/server -- db`
Expected: PASS for `MemoryStore`.

- [ ] **Step 5: Create the Atlas cluster and run the contract against it**

1. In MongoDB Atlas, create a free M0 cluster in the region nearest to Stockholm.
2. Create a database user. In Network Access, allow `0.0.0.0/0` for the weekend.
3. Copy the connection string. Set it as `MONGODB_URI_TEST` in the shell. Keep `MONGODB_URI` out of `.env` until Task 20: with it, the server needs seeded products.

Run: `npm test --workspace @glance/server -- mongo`
Expected: PASS, 5 tests, none skipped.

- [ ] **Step 6: Commit**

```bash
git add apps/server
git commit -m "feat(server): add the store interface with memory and MongoDB stores"
```

---

### Task 9 (C2): Session runtime and registry

**Files:**
- Create: `apps/server/src/sessions/runtime.ts`, `apps/server/src/sessions/registry.ts`
- Test: `apps/server/src/sessions/runtime.test.ts`

**Interfaces:**
- Consumes: `step`, `createSessionState`, `toSnapshot`, the rule types (Tasks 3 to 6), `renderLine` (Task 7), `Store`, `SessionRecord`, `MemoryStore` (Task 8), `EventBus`, `sessionTopic`, `Clock` (Task 1). `ServerToDevice`, `SessionSnapshot`, `Caption`, `ProfileSchema` from `@glance/shared`.
- Produces:

```ts
// runtime.ts
export type DeviceSink = { send(message: ServerToDevice): void; close(): void };
export type RuntimeDeps = {
  clock: Clock; catalog: CatalogIndex; store: Store; bus: EventBus;
  clipUrl: (text: string, lang: Lang) => Promise<string | null>;                          // Task 15
  startPayment: (session: SessionRuntime, kiosk: KioskRef, totalCents: number) => void;   // Task 16
  afterStep: (session: SessionRuntime, before: SessionState) => void;                     // Task 16
};
export class SessionRuntime {
  readonly id: string;
  readonly token: string;
  state: SessionState;
  constructor(deps: RuntimeDeps, record: SessionRecord);
  get connected(): boolean;            // a sink is attached
  dispatch(input: RuleInputBody): void;
  snapshot(): SessionSnapshot;
  attach(sink: DeviceSink): void;      // closes and replaces an older sink
  detach(sink: DeviceSink): void;
  settled(): Promise<void>;            // the outbox is empty and each store write is done
  onStop(listener: () => void): void;  // for the worker, the script player, and the event streams of the session
  stop(): void;                        // runs the stop listeners one time
}

// registry.ts
export class SessionRegistry {
  constructor(deps: RuntimeDeps);
  create(patch?: ProfilePatch): Promise<SessionRuntime>;   // profile: ProfileSchema.parse(patch ?? {})
  get(id: string): Promise<SessionRuntime | null>;         // memory first, then the store
  remove(id: string): Promise<void>;                       // stops the runtime and deletes the stored session
  live(): SessionRuntime[];
  startTicks(): void;                                      // one timer: a tick for each live session each second
  stop(): void;
}
```

Behavior:

1. `dispatch` adds `now` from the clock, runs `step`, replaces `state`, runs the effects in order, and then calls `afterStep`.
2. An `event` effect goes to the bus on `sessionTopic(id)` at once.
3. `speak`, `session.rest`, and `session.end` go through one outbox for each session. The outbox is a promise chain, so the phone gets them in order.
4. For a `speak`, `dispatch` renders the text at once with `renderLine`. The outbox then waits for `clipUrl`, sends `{ t: 'speak', id, priority, text, lang, url, sound, interrupt, promptId }`, and publishes the `caption` event with the same `id`, `text`, `lang`, `priority`, and `url`.
5. The speak ID is `s-` plus a counter of the session: `s-1`, `s-2`.
6. The runtime keeps the last 20 captions, oldest first, for the snapshot.
7. `session.rest` and `session.end` become `{ t: 'session.rest' }` and `{ t: 'session.end' }`. After `session.end` the runtime stops.
8. `payment.start` calls `startPayment`.
9. With no sink, the runtime drops device messages. Events and captions still go to the bus.
10. After a step with one or more `event` effects, the runtime writes the record to the store. `dispatch` does not wait for the write. A failed write is logged.
11. `kioskId` of the record is `state.checkout?.kiosk.id ?? null`.
12. The session ID is `randomUUID()`. The token is `randomBytes(24).toString('base64url')`.
13. The tick timer sends `tick` only to sessions in the phase `shopping` or `checkout`.

- [ ] **Step 1: Write the failing test**

The test file builds `RuntimeDeps` with a `MemoryStore` of the dev catalog, a clock object `{ now: () => time }`, `clipUrl: async () => null`, and spies for `startPayment` and `afterStep`. `seeOat` is the input `{ type: 'recognition', result: { ...NO_RESULT, status: 'identified', productId: 'oat-drink-1l' }, still: false }`. `busEvents` keeps each message of `sessionTopic(session.id)`. `sink` and `other` are `DeviceSink` objects that keep each message in `sent` and set `closed` on `close()`.

```ts
const glanceText = 'Oat drink, one litre, one eighty-nine. Nod to add.';

it('runs the rules with the clock time and publishes the events', () => {
  session.dispatch(seeOat);
  expect(busEvents.map((e) => e.type)).toEqual(['glance.pending']);
  expect(session.state.seen['oat-drink-1l']).toBe(time);
});
it('sends a line to the phone and a caption to the bus', async () => {
  session.attach(sink); session.dispatch(seeOat); await session.settled();
  expect(sink.sent).toEqual([{
    t: 'speak', id: 's-1', priority: 'normal', text: glanceText, lang: 'en', url: null,
    sound: null, interrupt: true, promptId: 'p-0001',
  }]);
  expect(busEvents.at(-1)).toEqual({ type: 'caption', id: 's-1', text: glanceText, lang: 'en', priority: 'normal', url: null });
});
it('keeps the order of the lines when an early clip is slow', async () => {
  // clipUrl waits 50 ms for the first text and 0 ms for the second
  session.attach(sink); session.dispatch(seeOat); session.dispatch({ type: 'intent', kind: 'help', source: 'phone' });
  await session.settled();
  expect(sink.sent.map((m) => (m.t === 'speak' ? m.id : m.t))).toEqual(['s-1', 's-2']);
});
it('sends session.end after the last line', async () => {
  session.attach(sink); session.dispatch({ type: 'intent', kind: 'stop', source: 'phone' }); await session.settled();
  expect(sink.sent.map((m) => m.t)).toEqual(['speak', 'session.end']);
});
it('keeps the last 20 captions, oldest first', async () => {
  for (let i = 0; i < 25; i += 1) session.dispatch({ type: 'intent', kind: 'help', source: 'phone' });
  await session.settled();
  expect(session.snapshot().captions.map((c) => c.id)).toEqual(Array.from({ length: 20 }, (_, i) => `s-${i + 6}`));
});
it('stores the session after an event and not after a sighting', async () => {
  const put = vi.spyOn(store, 'putSession');
  session.dispatch(seeOat); await session.settled();
  expect(put).toHaveBeenCalledTimes(1);
  session.dispatch(seeOat); await session.settled();
  expect(put).toHaveBeenCalledTimes(1);
});
it('a second sink closes the first', () => {
  session.attach(sink); session.attach(other);
  expect(sink.closed).toBe(true);
  expect(session.connected).toBe(true);
});
it('starts the payment and calls afterStep', () => {
  // cart with one unit, then kiosk.seen, prompt.done, and a voice yes through dispatch
  expect(startPayment).toHaveBeenCalledWith(session, KIOSK, 189);
  expect(afterStep).toHaveBeenCalled();
});
it('sends a tick to each live session each second', async () => {
  vi.useFakeTimers();
  const registry = new SessionRegistry({ ...deps, clock: systemClock });   // fake timers also move Date.now()
  const live = await registry.create(); registry.startTicks();
  live.dispatch(seeOat);
  await vi.advanceTimersByTimeAsync(TIMING.viewMs + TIMING.promptTtlAfterLeftMs + 1000);
  expect(live.state.prompt).toBeNull();
  registry.stop(); vi.useRealTimers();
});
```

Review Focus 4, in the same file:

```ts
it('gives the session and its cart back after a restart', async () => {
  const first = new SessionRegistry(deps);
  const session = await first.create();
  session.dispatch(seeOat);
  session.dispatch({ type: 'intent', kind: 'yes', source: 'phone', promptId: 'p-0001' });
  await session.settled();
  const second = new SessionRegistry(deps);       // the same store, as after a restart
  const again = await second.get(session.id);
  expect(again!.token).toBe(session.token);
  expect(again!.snapshot().cart.totalCents).toBe(189);
  expect(await second.get('no-such-session')).toBeNull();
});
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `npm test --workspace @glance/server -- runtime`
Expected: FAIL, because `runtime.ts` does not exist.

- [ ] **Step 3: Implement `SessionRuntime` and `SessionRegistry`**

- [ ] **Step 4: Run the test and make sure it passes**

Run: `npm test --workspace @glance/server -- runtime`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/server
git commit -m "feat(server): add the session runtime and the registry"
```

---

### Task 10 (C2): REST and server-sent events

**Files:**
- Create: `apps/server/src/http/sessions.ts`, `apps/server/src/http/sse.ts`, `apps/server/src/testing.ts`
- Modify: `apps/server/src/app.ts`, `apps/server/src/main.ts`, `apps/server/src/app.test.ts` (it now passes a `MemoryStore` and the dev catalog)
- Test: `apps/server/src/http/sessions.test.ts`

**Interfaces:**
- Consumes: `SessionRegistry`, `SessionRuntime` (Task 9), `Store`, `MemoryStore`, `MongoStore` (Task 8), `CatalogIndex` (Task 2). From `@glance/shared`: `CreateSessionRequestSchema`, `CreateSessionResponseSchema`, `WebIntentRequestSchema`, `CartEditRequestSchema`, `ProfilePatchSchema`, `SessionSnapshotSchema`, `parseServerEvent`.
- Produces:

```ts
// app.ts
export type AppDeps = { config: Config; clock: Clock; store: Store; catalog: CatalogIndex; log?: boolean };
// buildApp decorates the instance: app.sessions (SessionRegistry) and app.bus (EventBus)

// http/sse.ts
export function sendEventStream(
  app: FastifyInstance, request: FastifyRequest, reply: FastifyReply,
  subscribe: (write: (message: unknown) => void) => () => void,
  first?: unknown,   // sent before each other message
): FastifyReply;

// testing.ts
export type TestApp = { app: FastifyInstance; base: string; wsBase: string; store: MemoryStore; close(): Promise<void> };
export function testApp(env?: Record<string, string>, over?: Partial<AppDeps>): Promise<TestApp>;
export function eventReader(response: Response): { next(): Promise<unknown> };   // the JSON of the next `data:` message
```

Routes, from spec section 8.1 and Plan 0:

| Call | Body | Answer |
|---|---|---|
| `POST /api/sessions` | `CreateSessionRequest` | 201, `CreateSessionResponse` |
| `GET /api/sessions/:id` | | 200, `SessionSnapshot` |
| `PATCH /api/sessions/:id/profile` | `ProfilePatch` | 200, the new `Profile` |
| `POST /api/sessions/:id/intents` | `WebIntentRequest` | 204 |
| `POST /api/sessions/:id/cart` | `CartEditRequest` | 204 |
| `GET /api/sessions/:id/events` | | an events stream of `ServerEvent` |
| `DELETE /api/sessions/:id` | | 204 |

Decisions:

- `wsUrl` is `PUBLIC_BASE_URL` with the scheme `http` changed to `ws`, plus `/ws/device?session=<id>&token=<token>`. `https` becomes `wss` the same way.
- A body that fails its shared schema gets 400 with `{ error: 'bad_request' }`. An unknown session gets 404.
- Clients send `?token=` from the start. The check comes in Task 17.
- The outcome of an intent or a cart edit arrives as events. The answer 204 only says that the server took the input.
- A web client opens the events stream first and then gets the snapshot. No event is lost that way.
- `DELETE` sends `session.end` to the phone, closes the socket, and removes the session with its orders. Each events stream of the session ends through `session.onStop`.
- `sendEventStream` writes `data: <json>` and an empty line for each message, and `: ping` each 15 seconds. The headers are `content-type: text/event-stream` and `cache-control: no-cache`.
- `sendEventStream` sends a `PassThrough` stream with `reply.send`. Do not call `reply.hijack()`: the CORS hook of Task 1 must still apply.
- When the request closes, the stream unsubscribes and ends. The app also ends each open stream in its `preClose` hook.
- `buildApp` passes `clipUrl: async () => null` until Task 15. `startPayment` and `afterStep` do nothing until Task 16.
- `main.ts`: with `MONGODB_URI` it uses `MongoStore` and the products of the store. It stops with `products is empty. Run npm run catalog:seed.` if there is none. Without `MONGODB_URI` it uses `MemoryStore` with the file of `CATALOG_PATH`.
- `main.ts` logs `store: memory` or `store: mongo`, and `catalog: 4 products`.
- `testApp` uses a `MemoryStore` with the dev catalog and the config `loadConfig({ FAKE_SPEECH: '1', GEMINI_API_KEY: 'test', PAYMENT_DELAY_MS: '10', ...env }, [])`. It listens on port 0 of `127.0.0.1`.

- [ ] **Step 1: Write the failing test**

`seeOat` is the recognition input of Task 9. `get`, `post`, `patch`, and `del` call `fetch` on `t.base` with a JSON body. Each test starts a new `testApp` and creates a session with the profile `{ detail: 'brief' }`, which gives `id` and `token`.

```ts
it('creates a session', async () => {
  const res = await post('/api/sessions', { profile: { detail: 'brief' } });
  expect(res.status).toBe(201);
  const body = CreateSessionResponseSchema.parse(await res.json());
  expect(body.wsUrl).toBe(`${t.wsBase}/ws/device?session=${body.sessionId}&token=${body.token}`);
});
it('returns a snapshot that passes the shared schema', async () => {
  const snapshot = SessionSnapshotSchema.parse(await (await get(`/api/sessions/${id}?token=${token}`)).json());
  expect(snapshot).toMatchObject({ sessionId: id, phase: 'shopping', cart: EMPTY_CART, profile: { detail: 'brief' } });
});
it('patches the profile, drops an unknown key, and rejects a bad value', async () => {
  const ok = await patch(`/api/sessions/${id}/profile?token=${token}`, { speechRate: 1.5, foo: 1 });
  expect(ok.status).toBe(200);
  expect(await ok.json()).toMatchObject({ speechRate: 1.5, detail: 'brief' });
  expect((await patch(`/api/sessions/${id}/profile?token=${token}`, { speechRate: 3 })).status).toBe(400);
});
it('takes a yes from a web client', async () => {
  const session = (await t.app.sessions.get(id))!;
  session.dispatch(seeOat);
  const res = await post(`/api/sessions/${id}/intents?token=${token}`, { kind: 'yes', source: 'phone', promptId: 'p-0001' });
  expect(res.status).toBe(204);
  expect(session.state.cart.totalCents).toBe(189);
});
it('edits the cart', async () => {
  const session = (await t.app.sessions.get(id))!;
  session.dispatch(seeOat);
  session.dispatch({ type: 'intent', kind: 'yes', source: 'phone', promptId: 'p-0001' });
  expect((await post(`/api/sessions/${id}/cart?token=${token}`, { productId: 'oat-drink-1l', qty: 0 })).status).toBe(204);
  expect(session.state.cart).toEqual(EMPTY_CART);
});
it('streams the events of a session with the CORS header', async () => {
  const res = await fetch(`${t.base}/api/sessions/${id}/events?token=${token}`, { signal: abort.signal });
  expect(res.headers.get('content-type')).toBe('text/event-stream');
  expect(res.headers.get('access-control-allow-origin')).toBe('*');
  (await t.app.sessions.get(id))!.dispatch(seeOat);
  expect(parseServerEvent(await eventReader(res).next())?.type).toBe('glance.pending');
});
it('deletes a session with its data', async () => {
  expect((await del(`/api/sessions/${id}?token=${token}`)).status).toBe(204);
  expect((await get(`/api/sessions/${id}?token=${token}`)).status).toBe(404);
  expect(await t.store.getSession(id)).toBeNull();
});
it('answers 400 for a bad body and 404 for an unknown session', async () => {
  expect((await post(`/api/sessions/${id}/intents?token=${token}`, { kind: 'maybe', source: 'phone' })).status).toBe(400);
  expect((await get('/api/sessions/nope?token=x')).status).toBe(404);
});
it('closes while a client is on the events stream', async () => {
  const res = await fetch(`${t.base}/api/sessions/${id}/events?token=${token}`);
  await res.body!.getReader().read().catch(() => undefined);   // the stream is open
  await expect(Promise.race([t.close(), new Promise((_, no) => setTimeout(no, 2000))])).resolves.toBeUndefined();
});
```

The read in the last test waits for the first chunk. Send a `: ping` comment at once when a stream opens, so that the client sees the open stream.

- [ ] **Step 2: Run the test and make sure it fails**

Run: `npm test --workspace @glance/server -- http`
Expected: FAIL, because the routes do not exist.

- [ ] **Step 3: Implement the routes, the event stream helper, `testing.ts`, and the changes in `app.ts` and `main.ts`**

- [ ] **Step 4: Run all checks**

Run: `npm test --workspace @glance/server` and `npm run typecheck --workspace @glance/server`
Expected: PASS, and no type error.

- [ ] **Step 5: Commit**

```bash
git add apps/server
git commit -m "feat(server): add the session REST paths and the events stream"
```

---

### Task 11 (C2): Device socket

**Files:**
- Create: `apps/server/src/ws/device.ts`, `apps/server/src/sessions/voice.ts`
- Modify: `apps/server/src/app.ts`, `apps/server/src/testing.ts`
- Test: `apps/server/src/ws/device.test.ts`, `apps/server/src/sessions/voice.test.ts`

**Interfaces:**
- Consumes: `SessionRegistry`, `SessionRuntime`, `DeviceSink` (Task 9), `testApp` (Task 10). From `@glance/shared`: `parseDeviceToServer`, `decodeFrame`, `encodeFrame`, `FrameFormatError`, `FrameHeader`, `DeviceToServer`, `ServerToDevice`.
- Produces:

```ts
// ws/device.ts
export type FrameHandler = (session: SessionRuntime, frame: { header: FrameHeader; jpeg: Uint8Array }) => void;
export function registerDeviceSocket(app: FastifyInstance, deps: { onFrame: FrameHandler }): void;

// sessions/voice.ts
export type VoiceCommand = { kind: IntentKind; only: 'product' | 'pay' | null };
export function parseVoiceCommand(text: string): VoiceCommand | null;

// testing.ts
export type TestPhone = {
  messages: ServerToDevice[];
  send(message: DeviceToServer): void;
  sendRaw(data: string | Uint8Array): void;   // for a test of bad input
  sendFrame(header: FrameHeader, jpeg: Uint8Array): void;
  next(match: (message: ServerToDevice) => boolean): Promise<ServerToDevice>;   // also matches a message that came before
  closed: Promise<void>;
  close(): void;
};
export function connectPhone(t: TestApp, sessionId: string, token: string): Promise<TestPhone>;
```

Socket behavior:

1. The path is `/ws/device?session=<id>&token=<token>`, as in spec section 8.2. Use `ws` with `noServer: true` and `maxPayload` of 2 MB, on the `upgrade` event of `app.server`.
2. An upgrade for another path, or for an unknown session, gets `HTTP/1.1 404 Not Found` and a closed socket.
3. On open: `session.attach(sink)`, then send `{ t: 'snapshot', session }`. Subscribe to `sessionTopic(id)` and send each event as `{ t: 'event', event }`.
4. A text message goes through `parseDeviceToServer`. The server logs a `null` at `warn` level and drops it. The socket stays open.
5. `intent`, `prompt.done`, `device.state`, `cart.edit`, and `profile.set` become the rule inputs of the same name. After `profile.set` the server sends a new `snapshot`.
6. `speech.final` with `confidence >= 0.5` goes through `parseVoiceCommand`. A command becomes an `intent` with the source `voice` and the `promptId` of `state.lastDone`. The server logs `speech.final text=<text> confidence=<n>` at `info` level.
7. Drop a command whose `only` does not match the kind of the current prompt. `only: 'product'` also matches when no prompt is current, for the "remove" of R10.
8. Drop `kiosk.seen` until Task 16, and `biometric.result` until Task 27.
9. A binary message goes through `decodeFrame`. The server logs a `FrameFormatError` with its message and drops the frame. A good frame goes to `onFrame`. Until Task 14, `onFrame` does nothing.
10. The server sends a ping each 20 seconds. It terminates a socket that sent no pong since the last ping.
11. On close: `session.detach(sink)` and unsubscribe. The session stays.
12. The `preClose` hook of the app terminates each socket.

Voice commands. Compare the text in lower case, with no punctuation and no outer spaces. Only a full match counts.

| Words | Intent | `only` |
|---|---|---|
| add, add it | `yes` | `product` |
| yes | `yes` | `null` |
| pay | `yes` | `pay` |
| no | `no` | `null` |
| skip, skip it, remove, remove it | `no` | `product` |
| cancel | `no` | `pay` |
| undo, repeat, total, cart, help, stop | the same word | `null` |

- [ ] **Step 1: Write the failing tests**

`voice.test.ts`:

```ts
it('maps the command words', () => {
  expect(parseVoiceCommand('Add')).toEqual({ kind: 'yes', only: 'product' });
  expect(parseVoiceCommand(' yes. ')).toEqual({ kind: 'yes', only: null });
  expect(parseVoiceCommand('pay')).toEqual({ kind: 'yes', only: 'pay' });
  expect(parseVoiceCommand('skip it')).toEqual({ kind: 'no', only: 'product' });
  expect(parseVoiceCommand('cancel')).toEqual({ kind: 'no', only: 'pay' });
  expect(parseVoiceCommand('undo')).toEqual({ kind: 'undo', only: null });
});
it('takes a full match only', () => {
  expect(parseVoiceCommand('I do not want to pay')).toBeNull();
  expect(parseVoiceCommand('add milk to my list')).toBeNull();
  expect(parseVoiceCommand('')).toBeNull();
});
```

`device.test.ts`. Each test makes a session over REST and connects a `TestPhone`. `session` is the runtime from `t.app.sessions`.

```ts
const isSpeak = (m: ServerToDevice) => m.t === 'speak';

it('sends a snapshot on connect', async () => {
  expect(await phone.next((m) => m.t === 'snapshot')).toMatchObject({ session: { sessionId: id, phase: 'shopping' } });
});
it('device.state with a running stream says Camera on', async () => {
  phone.send({ t: 'device.state', state: STREAMING });
  expect(await phone.next(isSpeak)).toMatchObject({ text: 'Camera on. Hold a product up to hear its price.', url: null });
});
it('a glance prompt reaches the phone as an event and as a line', async () => {
  session.dispatch(seeOat);
  await phone.next((m) => m.t === 'event' && m.event.type === 'glance.pending');
  expect(await phone.next(isSpeak)).toMatchObject({
    text: 'Oat drink, one litre, one eighty-nine. Nod to add.', promptId: 'p-0001', url: null,
  });
});
it('prompt.done and a nod add the product', async () => {
  session.dispatch(seeOat);
  phone.send({ t: 'prompt.done', promptId: 'p-0001' });
  phone.send({ t: 'intent', kind: 'yes', source: 'head', promptId: 'p-0001' });
  expect(await phone.next((m) => m.t === 'speak' && m.text.startsWith('Added'))).toMatchObject({
    text: 'Added oat drink. Total one eighty-nine.', sound: 'added',
  });
});
it('the word add never pays, and the word pay does', async () => {
  session.dispatch(seeOat);
  session.dispatch({ type: 'intent', kind: 'yes', source: 'phone', promptId: 'p-0001' });
  session.dispatch({ type: 'kiosk.seen', kiosk: KIOSK, busy: false, spotCheck: false });
  phone.send({ t: 'prompt.done', promptId: 'p-0002' });
  phone.send({ t: 'speech.final', text: 'add', confidence: 0.9, locale: 'en-US' });
  phone.send({ t: 'intent', kind: 'help', source: 'phone' });
  await phone.next((m) => m.t === 'speak' && m.text.startsWith('Hold a product up'));   // the server read both messages
  expect(session.state.checkout!.step).toBe('offered');
  phone.send({ t: 'speech.final', text: 'pay', confidence: 0.9, locale: 'en-US' });
  await vi.waitFor(() => expect(session.state.checkout!.step).toBe('paying'));
});
it('drops text that is not JSON, an unknown message, and a broken frame, and keeps the socket open', async () => {
  phone.sendRaw('not json'); phone.sendRaw(JSON.stringify({ t: 'launch.rocket' })); phone.sendRaw(new Uint8Array([0, 0]));
  phone.send({ t: 'intent', kind: 'help', source: 'phone' });
  expect(await phone.next(isSpeak)).toBeDefined();
});
it('gives a good frame to the frame handler', async () => {
  // registerDeviceSocket with a spy as onFrame
  phone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: true }, JPEG);
  await vi.waitFor(() => expect(onFrame).toHaveBeenCalledTimes(1));
  expect(onFrame.mock.calls[0]![1].header.seq).toBe(1);
});
it('closes while a phone is connected', async () => {
  await expect(Promise.race([t.close(), new Promise((_, no) => setTimeout(no, 2000))])).resolves.toBeUndefined();
});
```

`JPEG` is `new Uint8Array([0xff, 0xd8, 0xff, 0xd9])`. `STREAMING` and `KIOSK` come from the harness of Task 3.

Review Focus 5, in the same file:

```ts
it('a second socket for the session takes over, and no message goes out two times', async () => {
  const second = await connectPhone(t, id, token);
  await phone.closed;
  session.dispatch(seeOat);
  const isPrompt = (m: ServerToDevice) => m.t === 'speak' && m.promptId === 'p-0001';
  await second.next(isPrompt);
  expect(phone.messages.filter(isPrompt)).toEqual([]);
  expect(second.messages.filter(isPrompt)).toHaveLength(1);
  expect(session.connected).toBe(true);
});
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/server -- device voice`
Expected: FAIL, because the modules do not exist.

- [ ] **Step 3: Implement `voice.ts`, `device.ts`, and the `TestPhone` helper**

`AppDeps` gains `onFrame?: FrameHandler`, and the test passes a spy through the second argument of `testApp`. The default handler does nothing until Task 14.

- [ ] **Step 4: Run all checks**

Run: `npm test --workspace @glance/server` and `npm run typecheck --workspace @glance/server`
Expected: PASS, and no type error.

- [ ] **Step 5: Commit**

```bash
git add apps/server
git commit -m "feat(server): add the device socket and the voice command table"
```

---

### Task 12 (C2): Fake recognition

**Files:**
- Create: `apps/server/fixtures/fake-script.json`, `apps/server/src/recognition/fake.ts`
- Modify: `apps/server/src/app.ts`, `apps/server/src/ws/device.ts`, `apps/server/src/http/sessions.ts`
- Test: `apps/server/src/recognition/fake.test.ts`

**Interfaces:**
- Consumes: `RecognitionResult`, `NO_RESULT` (Task 3), `SessionRuntime` (Task 9), `CatalogIndex` (Task 2), `Clock` (Task 1), `testApp`, `eventReader` (Task 10).
- Produces:

```ts
export type FakeStep =
  | { atMs: number; forMs: number; result: Partial<RecognitionResult> }
  | { atMs: number; forMs: number; kiosk: string };   // 'newest' or a kiosk code
export type FakeScript = { loop: boolean; lengthMs: number; steps: FakeStep[] };
export function readFakeScript(path: string, catalog: CatalogIndex): FakeScript;
export function scriptAt(script: FakeScript, elapsedMs: number): { result: RecognitionResult; kiosk: string | null };
export class ScriptPlayer {
  constructor(deps: { script: FakeScript; clock: Clock; onKiosk: (session: SessionRuntime, which: string) => void });
  start(session: SessionRuntime, opts: { fakeDevice: boolean }): void;   // a second start for the same session does nothing
  stop(sessionId: string): void;
}
```

The behavior is in the section "Two switches for the other seats". More decisions:

- `fixtures/fake-script.json` is the script of that section.
- `scriptAt`: with `loop: true` the script time is `elapsedMs % lengthMs`. With `loop: false`, a time past `lengthMs` gives `NO_RESULT`.
- A result step fills its missing fields from `NO_RESULT`, with `confidence: 0.95`. A step covers the times from `atMs` up to, and not including, `atMs + forMs`.
- `readFakeScript` checks each step with zod, and each `productId` and candidate against the catalog. The error names the step, counted from 1.
- The player runs one timer for each session, each `TIMING.uploadEveryMs`. It dispatches `recognition` with `still: false`. In a kiosk step it calls `onKiosk` one time each second.
- `onKiosk` does nothing until Task 16.
- In fake mode the device socket calls `start(session, { fakeDevice: false })` on open. The events path calls `start(session, { fakeDevice: !session.connected })`.
- The events path subscribes to the bus before it starts the player. The client then gets the first events.
- `fakeDevice: true` dispatches `device.state` with `STREAMING` values before the first result.
- The player stops when the session stops (`session.onStop`).
- In fake mode, `onFrame` logs `frame seq=<n> w=<w> h=<h> blurred=<b> kind=<k> bytes=<n>` at `info` level and drops the frame. Seat 1 can check its uploads this way.

- [ ] **Step 1: Write the script file and the failing test**

```ts
const script = readFakeScript('fixtures/fake-script.json', catalog);

it('reads the default script', () => {
  expect(script).toMatchObject({ loop: true, lengthMs: 60000 });
  expect(script.steps).toHaveLength(6);
});
it('rejects an unknown product ID and names the step', () => {
  // a temp file whose second step has productId 'no-such-product'
  expect(() => readFakeScript(tempPath, catalog)).toThrow(/step 2.*no-such-product/);
});
it('gives the result of the step for the elapsed time', () => {
  expect(scriptAt(script, 2999).result).toEqual(NO_RESULT);
  expect(scriptAt(script, 3000).result).toEqual({ ...NO_RESULT, status: 'identified', productId: 'oat-drink-1l', confidence: 0.95 });
  expect(scriptAt(script, 8999).result.productId).toBe('oat-drink-1l');
  expect(scriptAt(script, 9000).result).toEqual(NO_RESULT);
  expect(scriptAt(script, 41000)).toEqual({ result: NO_RESULT, kiosk: 'newest' });
});
it('loops', () => {
  expect(scriptAt(script, 63000).result.productId).toBe('oat-drink-1l');
  expect(scriptAt({ ...script, loop: false }, 63000).result).toEqual(NO_RESULT);
});
it('plays the script into a session', async () => {
  vi.useFakeTimers();
  // a runtime as in Task 9, with a clock that reads Date.now()
  player.start(session, { fakeDevice: true });
  await vi.advanceTimersByTimeAsync(3500);
  expect(session.state.cameraOn).toBe(true);
  expect(session.state.prompt).toMatchObject({ productId: 'oat-drink-1l' });
  player.stop(session.id);
});
it('a fake server speaks to a browser client with no key', async () => {
  // a temp script with one identified step at 100 ms; testApp({ FAKE_RECOGNITION: tempPath, GEMINI_API_KEY: '' })
  const { sessionId, token } = await (await post('/api/sessions', {})).json();
  const events = eventReader(await fetch(`${t.base}/api/sessions/${sessionId}/events?token=${token}`, { signal }));
  const seen: string[] = [];
  while (!seen.includes('glance.pending')) seen.push((await events.next() as ServerEvent).type);
  expect(seen).toContain('session.state');
  expect(seen).toContain('caption');
});
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `npm test --workspace @glance/server -- fake`
Expected: FAIL, because `fake.ts` does not exist.

- [ ] **Step 3: Implement `fake.ts` and the three call sites**

- [ ] **Step 4: Run all checks, then try the fake server by hand**

Run: `npm test --workspace @glance/server`
Expected: PASS.

Run: `npm run dev:fake --workspace @glance/server`. In a second terminal:

```bash
curl -s -X POST http://localhost:8080/api/sessions -H "content-type: application/json" -d "{}"
curl -N "http://localhost:8080/api/sessions/<sessionId>/events?token=<token>"
```

Expected: a `session.state` event and a "Camera on" caption at once. After 3 seconds, a `glance.pending` event for the oat drink and its caption with `"url":null`.

- [ ] **Step 5: Commit, then tell seats 1, 3, and 4 that the fake server is ready**

```bash
git add apps/server
git commit -m "feat(server): add scripted recognition for work with no API key"
```

---

### Task 13 (C2): Recognition request

**Files:**
- Create: `agents/recognition.md`, `apps/server/src/recognition/prompt.ts`, `apps/server/src/recognition/gemini.ts`, `apps/server/scripts/check-model.ts`
- Modify: `apps/server/src/recognition/result.ts`, `apps/server/package.json` (script `model:check`)
- Delete: `agents/.gitkeep`
- Test: `apps/server/src/recognition/result.test.ts`, `apps/server/src/recognition/prompt.test.ts`

**Interfaces:**
- Consumes: `RecognitionResult`, `RecognitionResultSchema`, `NO_RESULT` (Task 3), `CatalogIndex` (Task 2), `TIMING`.
- Produces:

```ts
// result.ts
export function normalizeResult(
  raw: unknown, ctx: { catalog: CatalogIndex; exclude: readonly string[]; minConfidence: number },
): RecognitionResult;

// prompt.ts
export function buildSystemInstruction(template: string, products: readonly Product[]): string;
export function recognitionResponseSchema(productIds: readonly string[]): unknown;   // a JSON Schema object
export function userText(exclude: readonly string[]): string;

// gemini.ts
export interface Recognizer {
  recognize(jpeg: Uint8Array, opts: { exclude: readonly string[]; still: boolean; signal: AbortSignal }): Promise<RecognitionResult>;
}
export function createGeminiRecognizer(deps: {
  apiKey: string; model: string; mediaResolution: 'default' | 'low'; minConfidence: number;
  catalog: CatalogIndex; template: string;
}): Recognizer;
```

`normalizeResult` never turns another status into `identified`. Its rules:

1. Input that fails `RecognitionResultSchema` gives `NO_RESULT`.
2. `identified` with a `productId` that is `null` or not in the catalog gives `unknown`.
3. `identified` with a `productId` in `exclude` gives `none`.
4. `identified` with `confidence < minConfidence` gives `unsure` and keeps `aimHint`.
5. `ambiguous` keeps the candidates that are in the catalog and not in `exclude`. With two or more it stays `ambiguous`. With one it becomes `unsure` with `aimHint: 'turn'`. With none it becomes `unknown`.
6. Only `identified` keeps `productId`. Only `ambiguous` keeps `candidates`.

Prompt decisions:

- `agents/recognition.md` holds the system instruction with the placeholder `{{catalog}}`. The server reads it from `../../agents/recognition.md`.
- `buildSystemInstruction` puts one line for each product in place of the placeholder: `- id: <id> | name: <name.en> | brand: <brand> | pack: <packSize> | look: <visual>`. A product with look-alikes also gets ` | lookAlikes: <ids>`.
- The instruction holds no price.
- `userText` gives `Exclude: none.` or `Exclude: <id>, <id>.` (rule R9).
- `recognitionResponseSchema` is `z.toJSONSchema` of a zod object with the six fields of spec section 11.1. `productId` is `z.enum(ids).nullable()`, and `candidates` is `z.array(z.enum(ids))`. The model then cannot write an ID outside the catalog.

The wording of `agents/recognition.md` is free. It must state these rules:

1. Answer about one product that a hand holds up, large in the frame. A product on a shelf does not count.
2. `identified`: the package matches exactly one catalog entry. Do not guess.
3. `ambiguous`: the frame fits two or more entries. List them in `candidates`.
4. `unsure`: a hand holds a product, and the frame does not show enough of it.
5. `aimHint` is the move of the product in the image that helps: `left`, `right`, `up`, `down`, `closer`, `farther`, or `turn` for another side of the package.
6. `unknown`: a hand holds a product that is not in the catalog.
7. `none`: no hand holds a product.
8. Never answer with an ID of the exclude list in the request.
9. `gesture`: `thumbs_up` or `thumbs_down` if the other hand shows it, else `none`.

The call. The keys match the type definitions of `@google/genai` 3.3.0.

```ts
import { GoogleGenAI, MediaResolution } from '@google/genai';

const ai = new GoogleGenAI({ apiKey });
const response = await ai.models.generateContent({
  model,
  contents: [
    { inlineData: { mimeType: 'image/jpeg', data: Buffer.from(jpeg).toString('base64') } },
    { text: userText(opts.exclude) },
  ],
  config: {
    systemInstruction,
    responseMimeType: 'application/json',
    responseJsonSchema: responseSchema,
    abortSignal: opts.signal,
    httpOptions: { timeout: TIMING.recognitionTimeoutMs, retryOptions: { attempts: 1 } },
    ...(low ? { mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW } : {}),
  },
});
```

- `retryOptions.attempts: 1` is necessary. The SDK default is 5 attempts, which breaks the limit of 4 seconds.
- `low` is true when `mediaResolution` is `'low'` and `opts.still` is false.
- Set no thinking level. The default of `gemini-3.5-flash-lite` is `minimal`, per the stack facts.
- This plan uses generateContent, not the Interactions API. The glance is one call with no state, and the stack facts give the JavaScript parameters.
- The result is `normalizeResult` of the parsed `response.text`. A text that is empty or not JSON gives `NO_RESULT`.

- [ ] **Step 1: Write the failing tests**

`result.test.ts` (`OAT`, `BARISTA` as in the harness, `catalog` from the dev catalog):

```ts
const ctx = { catalog, exclude: [] as string[], minConfidence: 0.6 };
const raw = (part: object) => ({ ...NO_RESULT, confidence: 0.9, ...part });

it('keeps a good identified result', () => {
  const good = raw({ status: 'identified', productId: OAT });
  expect(normalizeResult(good, ctx)).toEqual(good);
});
it('turns broken input into no result', () => {
  expect(normalizeResult(undefined, ctx)).toEqual(NO_RESULT);
  expect(normalizeResult({ status: 'identified' }, ctx)).toEqual(NO_RESULT);
  expect(normalizeResult(raw({ status: 'sure' }), ctx)).toEqual(NO_RESULT);
});
it('never names a product outside the catalog', () => {
  expect(normalizeResult(raw({ status: 'identified', productId: 'cola-zero' }), ctx)).toMatchObject({ status: 'unknown', productId: null });
  expect(normalizeResult(raw({ status: 'identified', productId: null }), ctx).status).toBe('unknown');
});
it('drops an excluded product', () => {
  expect(normalizeResult(raw({ status: 'identified', productId: OAT }), { ...ctx, exclude: [OAT] }).status).toBe('none');
});
it('turns a weak identified result into unsure', () => {
  expect(normalizeResult(raw({ status: 'identified', productId: OAT, confidence: 0.59, aimHint: 'closer' }), ctx))
    .toEqual(raw({ status: 'unsure', confidence: 0.59, aimHint: 'closer' }));
});
it('needs two known candidates for ambiguous', () => {
  expect(normalizeResult(raw({ status: 'ambiguous', candidates: [OAT, BARISTA, 'x'] }), ctx).candidates).toEqual([OAT, BARISTA]);
  expect(normalizeResult(raw({ status: 'ambiguous', candidates: [OAT, 'x'] }), ctx))
    .toMatchObject({ status: 'unsure', aimHint: 'turn', candidates: [] });
  expect(normalizeResult(raw({ status: 'ambiguous', candidates: ['x'] }), ctx).status).toBe('unknown');
});
it('keeps productId only for identified', () => {
  expect(normalizeResult(raw({ status: 'unsure', productId: OAT, aimHint: 'left' }), ctx).productId).toBeNull();
});
```

`prompt.test.ts` (`dev` is the dev catalog):

```ts
const template = 'Rules.\n{{catalog}}\nEnd.';
type Schema = { required: string[]; properties: Record<string, { enum?: string[]; anyOf?: unknown[]; items?: { enum: string[] } }> };

it('lists each product with ID, name, brand, pack size, and look', () => {
  const text = buildSystemInstruction(template, dev);
  for (const p of dev) for (const part of [p.id, p.name.en, p.brand, p.packSize, p.visual]) expect(text).toContain(part);
  expect(text).toContain('lookAlikes: oat-drink-barista-1l');
  expect(text).not.toContain('{{catalog}}');
});
it('holds no price', () => {
  const text = buildSystemInstruction(template, dev);
  for (const p of dev) expect(text).not.toContain(String(p.priceCents));
});
it('limits the answer to the catalog IDs', () => {
  const schema = recognitionResponseSchema(['a', 'b']) as Schema;
  expect(schema.required).toEqual(['status', 'productId', 'candidates', 'confidence', 'aimHint', 'gesture']);
  expect(schema.properties.status!.enum).toEqual(['identified', 'ambiguous', 'unsure', 'unknown', 'none']);
  expect(schema.properties.productId!.anyOf).toEqual([{ type: 'string', enum: ['a', 'b'] }, { type: 'null' }]);
  expect(schema.properties.candidates!.items!.enum).toEqual(['a', 'b']);
  expect(schema.properties.aimHint!.enum).toEqual(['none', 'left', 'right', 'up', 'down', 'closer', 'farther', 'turn']);
});
it('writes the exclude list', () => {
  expect(userText([])).toBe('Exclude: none.');
  expect(userText(['a', 'b'])).toBe('Exclude: a, b.');
});
it('the instruction file has the catalog placeholder', () => {
  expect(readFileSync('../../agents/recognition.md', 'utf8')).toContain('{{catalog}}');
});
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/server -- recognition/result recognition/prompt`
Expected: FAIL, because `normalizeResult` and `prompt.ts` do not exist.

- [ ] **Step 3: Implement `normalizeResult`, `prompt.ts`, `gemini.ts`, and write `agents/recognition.md`**

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npm test --workspace @glance/server -- recognition`
Expected: PASS.

- [ ] **Step 5: Write `scripts/check-model.ts` and verify the model ID with one call**

The script is `npm run model:check --workspace @glance/server -- [frame.jpg]`, which runs `tsx --env-file-if-exists=.env scripts/check-model.ts`. It does two things:

1. It calls `ai.models.get({ model: config.geminiModel })` and prints `model: <name>`.
2. With a frame path, it calls `recognize` one time and prints the result as JSON and `ms: <n>`.

Put `GEMINI_API_KEY` in `apps/server/.env`. The key must belong to a project on the paid tier: the Google terms require it for users in the European Economic Area.

Run: `npm run model:check --workspace @glance/server -- <a JPEG of a product>`
Expected: a `model:` line with the name of the model, then a result with `"status"` and a time under 4000 ms.

- If the first call answers 404, the model ID is wrong. Read `https://aistudio.google.com/docs/models`, set `GEMINI_MODEL`, and tell the team.
- If the second call answers `400 INVALID_ARGUMENT`, the API rejects the schema. Read `https://aistudio.google.com/docs/structured-output.md?generate-content=true` and change `recognitionResponseSchema` to the keywords that the page lists.
- Read the rate limits of the project in Google AI Studio. The docs publish no number.

- [ ] **Step 6: Commit**

```bash
git rm agents/.gitkeep
git add agents apps/server
git commit -m "feat(server): add the recognition prompt, the result checks, and the Gemini call"
```

---

### Task 14 (C2): Recognition worker

**Files:**
- Create: `apps/server/src/recognition/worker.ts`, `apps/server/src/recognition/intake.ts`
- Modify: `apps/server/src/app.ts`, `apps/server/src/main.ts`, `apps/server/src/testing.ts`, `apps/server/src/config.ts`, `apps/server/.env.example`
- Test: `apps/server/src/recognition/worker.test.ts`, `apps/server/src/recognition/intake.test.ts`

**Interfaces:**
- Consumes: `Recognizer`, `createGeminiRecognizer` (Task 13), `FrameHandler` (Task 11), `excludeList` (Task 3), `SessionRuntime` (Task 9), `TIMING`, `FrameHeader`.
- Produces:

```ts
// worker.ts
export type Frame = { header: FrameHeader; jpeg: Uint8Array };
export class RecognitionWorker {
  constructor(deps: {
    recognizer: Recognizer;
    exclude: () => string[];   // read at the start of each call
    onResult: (result: RecognitionResult, info: { seq: number; still: boolean; ms: number }) => void;
    onSlow: () => void;        // 3 failed calls in a row
  });
  submit(frame: Frame): void;
  heldBytes(): number;         // the bytes of the frame in the call plus the waiting frame
  stop(): void;
}

// intake.ts
export function createFrameHandler(deps: {
  recognizer: Recognizer; clock: Clock; log: FastifyBaseLogger;
  onSlow: (session: SessionRuntime) => void;
  requireBlur: boolean;   // config.requireBlur
}): FrameHandler;

// config.ts: Config gains
requireBlur: boolean;     // REQUIRE_BLUR === '1', default false
```

`AppDeps` gains `recognizer?: Recognizer`. `main.ts` passes the Gemini recognizer when fake recognition is off. With a recognizer and no `onFrame`, the app uses `createFrameHandler`.

Worker behavior:

1. One call at a time. `submit` starts a call if none runs.
2. While a call runs, the worker keeps one waiting frame. A newer frame replaces it. A newer frame replaces a waiting still only if it is a still.
3. When the call ends, the worker starts the waiting frame.
4. A call that takes `TIMING.recognitionTimeoutMs` is dropped. The worker aborts its signal, ignores its late result, and counts it as failed.
5. A call that rejects counts as failed. The log gets `error.name` and at most 200 characters of `error.message`.
6. After 3 failed calls in a row the worker calls `onSlow` one time. A good call resets the count.
7. The worker drops its reference to a frame when the call ends.
8. `stop()` aborts the call and drops the waiting frame. No callback runs after `stop()`.

Frame handler behavior:

1. A frame with `blurred: false` still goes to the worker when `requireBlur` is false. The handler logs `frame not blurred: the phone did not run face detection` at `warn` level, one time for each session. Plan 2 sends `false` until its Task 18, and M1 comes before that task.
1a. When `requireBlur` is true, the handler drops a frame with `blurred: false` before the worker sees it. It logs `frame dropped: not blurred` at `warn` level, one time for each session. Set `REQUIRE_BLUR=1` on the deployed server when Plan 2 Task 18 is on the phone, and keep it set for the demo and the shoot.
2. It keeps one worker for each session, made at the first frame. The worker stops when the session stops (`session.onStop`).
3. `exclude` is `excludeList(session.state, clock.now())`.
4. `onResult` dispatches `{ type: 'recognition', result, still }`, and logs `recognition session=<id> seq=<n> status=<status> ms=<n>` at `info` level. These lines give the server share of the time from glance to voice.
5. `still` is `header.kind === 'still'`.
6. In fake mode the app does not use this handler (Task 12).

- [ ] **Step 1: Write the failing tests**

`worker.test.ts` uses `vi.useFakeTimers()` and a stub recognizer. The stub keeps each call as `{ opts, resolve, reject }` in `calls`. `results` keeps each `onResult` call. `flush` waits for the pending promises. The worker reads its exclude list from the variable `exclude`.

```ts
const frame = (seq: number, kind?: 'still'): Frame =>
  ({ header: { seq, ts: 0, w: 576, h: 768, blurred: true, kind }, jpeg: new Uint8Array(1000) });
const ok: RecognitionResult = { ...NO_RESULT, status: 'identified', productId: 'oat-drink-1l', confidence: 0.9 };

it('runs one call at a time, and the newest frame wins', async () => {
  for (const seq of [1, 2, 3, 4]) worker.submit(frame(seq));
  expect(calls).toHaveLength(1);
  calls[0]!.resolve(ok); await flush();
  calls[1]!.resolve(ok); await flush();
  expect(results.map((r) => r.info.seq)).toEqual([1, 4]);   // frames 2 and 3 never reach the recognizer
  expect(calls).toHaveLength(2);
});
it('drops a call after 4 seconds and goes on with the next frame', async () => {
  worker.submit(frame(1)); worker.submit(frame(2));
  await vi.advanceTimersByTimeAsync(TIMING.recognitionTimeoutMs);
  expect(calls[0]!.opts.signal.aborted).toBe(true);
  expect(calls).toHaveLength(2);
  calls[0]!.resolve(ok); await flush();   // the late answer
  expect(results).toEqual([]);
});
it('reports slow after 3 failed calls in a row, one time, and counts again after a good call', async () => {
  for (const seq of [1, 2, 3, 4]) { worker.submit(frame(seq)); calls.at(-1)!.reject(new Error('503')); await flush(); }
  expect(onSlow).toHaveBeenCalledTimes(1);
  worker.submit(frame(5)); calls.at(-1)!.resolve(ok); await flush();
  for (const seq of [6, 7, 8]) { worker.submit(frame(seq)); calls.at(-1)!.reject(new Error('503')); await flush(); }
  expect(onSlow).toHaveBeenCalledTimes(2);
});
it('reads the exclude list at the start of each call', async () => {
  exclude = ['a']; worker.submit(frame(1));
  exclude = ['b']; worker.submit(frame(2));
  calls[0]!.resolve(ok); await flush();
  expect(calls.map((c) => c.opts.exclude)).toEqual([['a'], ['b']]);
});
it('holds no frame after the call', async () => {
  worker.submit(frame(1)); worker.submit(frame(2));
  expect(worker.heldBytes()).toBe(2000);
  calls[0]!.resolve(ok); await flush();
  calls[1]!.resolve(ok); await flush();
  expect(worker.heldBytes()).toBe(0);
});
it('a later frame does not replace a waiting still', async () => {
  worker.submit(frame(1)); worker.submit(frame(2, 'still')); worker.submit(frame(3));
  calls[0]!.resolve(ok); await flush();
  expect(calls[1]!.opts.still).toBe(true);
});
it('stop ends the work', async () => {
  worker.submit(frame(1)); worker.submit(frame(2)); worker.stop();
  expect(calls[0]!.opts.signal.aborted).toBe(true);
  calls[0]!.resolve(ok); await flush();
  expect(results).toEqual([]);
  expect(calls).toHaveLength(1);
  expect(worker.heldBytes()).toBe(0);
});
```

`intake.test.ts` uses `testApp` with a stub recognizer that answers `ok`, and a `TestPhone`:

```ts
it('a frame from the phone becomes a spoken glance', async () => {
  phone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: true }, JPEG);
  expect(await phone.next((m) => m.t === 'speak')).toMatchObject({
    text: 'Oat drink, one litre, one eighty-nine. Nod to add.', promptId: 'p-0001',
  });
});
it('a frame with blurred false still becomes a glance', async () => {
  phone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: false }, JPEG);
  await phone.next((m) => m.t === 'speak');
  expect(recognize).toHaveBeenCalledTimes(1);
});
it('with REQUIRE_BLUR a frame with blurred false never reaches the recognizer', async () => {
  // strictPhone is a TestPhone on a second test app: testApp({ REQUIRE_BLUR: '1' }) with the same stub recognizer
  strictPhone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: false }, JPEG);
  strictPhone.send({ t: 'intent', kind: 'help', source: 'phone' });
  await strictPhone.next((m) => m.t === 'speak');
  expect(recognize).not.toHaveBeenCalled();
});
it('the call excludes a product that the shopper just skipped', async () => {
  phone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: true }, JPEG);
  await phone.next((m) => m.t === 'speak');
  phone.send({ t: 'intent', kind: 'no', source: 'phone', promptId: 'p-0001' });
  await phone.next((m) => m.t === 'speak' && m.text === 'Skipped.');
  phone.sendFrame({ seq: 2, ts: 2, w: 576, h: 768, blurred: true }, JPEG);
  await vi.waitFor(() => expect(recognize).toHaveBeenCalledTimes(2));
  expect(recognize.mock.calls[1]![1].exclude).toEqual(['oat-drink-1l']);
});
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/server -- worker intake`
Expected: FAIL, because the modules do not exist.

- [ ] **Step 3: Implement `worker.ts`, `intake.ts`, and the wiring in `app.ts` and `main.ts`**

`testApp` takes the stub through `over.recognizer`.

- [ ] **Step 4: Run all checks**

Run: `npm test --workspace @glance/server` and `npm run typecheck --workspace @glance/server`
Expected: PASS, and no type error.

- [ ] **Step 5: Commit**

```bash
git add apps/server
git commit -m "feat(server): add the recognition worker with one call at a time"
```

---

### Task 15 (C2): Speech clips

**Files:**
- Create: `apps/server/src/speech/clips.ts`, `apps/server/src/speech/elevenlabs.ts`, `apps/server/src/speech/service.ts`, `apps/server/src/http/speech.ts`
- Modify: `apps/server/src/app.ts`, `apps/server/src/main.ts`, `apps/server/src/testing.ts`
- Test: `apps/server/src/speech/clips.test.ts`, `apps/server/src/http/speech.test.ts`

**Interfaces:**
- Consumes: `Store` (Task 8), `RuntimeDeps.clipUrl` (Task 9), `testApp`, `connectPhone` (Tasks 10 and 11).
- Produces:

```ts
// clips.ts
export function clipKey(text: string, lang: Lang, voiceId: string, modelId: string): string;   // sha256 hex of JSON.stringify of the four values
export class ClipCache {
  constructor(dir: string, store: Store);
  path(hash: string): string;                          // <dir>/<hash>.mp3
  has(hash: string): boolean;                          // the file exists
  put(hash: string, mp3: Uint8Array): Promise<void>;   // writes a temp file, renames it, then calls store.putClip
}

// elevenlabs.ts
export const ELEVENLABS_MODEL = 'eleven_flash_v2_5';
export const ELEVENLABS_FORMAT = 'mp3_44100_128';
export const ELEVENLABS_TIMEOUT_MS = 3000;
export type Synthesize = (text: string, voiceId: string) => Promise<Uint8Array>;
export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;
export function createSynthesize(apiKey: string, fetchFn?: FetchFn): Synthesize;   // the default is the global fetch

// service.ts
export function createClipUrl(deps: {
  fake: boolean; cache: ClipCache; synthesize: Synthesize | null;
  voiceId: { en: string | null; it: string | null }; publicBaseUrl: string;
}): (text: string, lang: Lang) => Promise<string | null>;
```

`AppDeps` gains `synthesize?: Synthesize`. `main.ts` passes `createSynthesize(apiKey)` when `FAKE_SPEECH` is off.

The ElevenLabs call, from `https://elevenlabs.io/docs/api-reference/text-to-speech/stream`:

- `POST https://api.elevenlabs.io/v1/text-to-speech/<voiceId>/stream?output_format=mp3_44100_128`
- Headers: `xi-api-key` with the key, and `content-type: application/json`.
- Body: `{ "text": "<text>", "model_id": "eleven_flash_v2_5" }`.
- Signal: `AbortSignal.timeout(ELEVENLABS_TIMEOUT_MS)`.
- The body of a 200 answer is the MP3. Read it whole. Each other status throws an error that holds the status.

`createClipUrl`:

1. With `fake: true` it returns `null` and makes no call.
2. The voice is `voiceId[lang] ?? voiceId.en`.
3. The hash is `clipKey(text, lang, voice, ELEVENLABS_MODEL)`. The URL is `<publicBaseUrl>/api/speech/<hash>.mp3`.
4. A hit in the cache returns the URL. A miss calls `synthesize`, puts the clip in the cache, and returns the URL.
5. Two calls for one hash at the same time share one request.
6. If `synthesize` throws, the function logs the message and returns `null`. The next call for that text tries again.

`GET /api/speech/:file`:

- A name that does not match `/^[0-9a-f]{64}\.mp3$/` gets 404, and the server reads no file.
- A known hash gets the file with `content-type: audio/mpeg` and `cache-control: public, max-age=31536000, immutable`.
- `testApp` sets `SPEECH_CACHE_DIR` to a new temp directory.

- [ ] **Step 1: Write the failing tests**

`clips.test.ts`. `clipUrl` is built with a temp cache directory, the voice `{ en: 'voice-en', it: null }`, the base URL `http://localhost:8080`, and `synthesize` as a spy that returns three bytes. `fakeClipUrl` is the same with `fake: true`. Each test starts with a new cache directory and a new spy.

```ts
it('makes a stable key from text, language, voice, and model', () => {
  const key = clipKey('Skipped.', 'en', 'v1', ELEVENLABS_MODEL);
  expect(key).toMatch(/^[0-9a-f]{64}$/);
  expect(clipKey('Skipped.', 'en', 'v1', ELEVENLABS_MODEL)).toBe(key);
  const others = [clipKey('Skipped', 'en', 'v1', ELEVENLABS_MODEL), clipKey('Skipped.', 'it', 'v1', ELEVENLABS_MODEL),
    clipKey('Skipped.', 'en', 'v2', ELEVENLABS_MODEL), clipKey('Skipped.', 'en', 'v1', 'other-model')];
  for (const other of others) expect(other).not.toBe(key);
});
it('sends the request of the vendor docs', async () => {
  const fetchFn = vi.fn<FetchFn>(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
  const mp3 = await createSynthesize('key-1', fetchFn)('Skipped.', 'voice-1');
  const [url, init] = fetchFn.mock.calls[0]!;
  expect(url).toBe('https://api.elevenlabs.io/v1/text-to-speech/voice-1/stream?output_format=mp3_44100_128');
  expect(init).toMatchObject({ method: 'POST', headers: { 'xi-api-key': 'key-1', 'content-type': 'application/json' } });
  expect(JSON.parse(init.body as string)).toEqual({ text: 'Skipped.', model_id: 'eleven_flash_v2_5' });
  expect(mp3).toEqual(new Uint8Array([1, 2, 3]));
});
it('throws with the status of a failed call', async () => {
  const fetchFn = vi.fn<FetchFn>(async () => new Response('quota', { status: 401 }));
  await expect(createSynthesize('k', fetchFn)('x', 'v')).rejects.toThrow(/401/);
});
it('makes a clip one time and then uses the cache', async () => {
  const url = await clipUrl('Skipped.', 'en');
  expect(url).toBe(`http://localhost:8080/api/speech/${clipKey('Skipped.', 'en', 'voice-en', ELEVENLABS_MODEL)}.mp3`);
  await clipUrl('Skipped.', 'en');
  expect(synthesize).toHaveBeenCalledTimes(1);
});
it('shares one request between two calls at the same time', async () => {
  await Promise.all([clipUrl('Hold it up again.', 'en'), clipUrl('Hold it up again.', 'en')]);
  expect(synthesize).toHaveBeenCalledTimes(1);
});
it('uses the English voice when the language has none', async () => {
  await clipUrl('Saltato.', 'it');
  expect(synthesize).toHaveBeenCalledWith('Saltato.', 'voice-en');
});
it('makes no call with FAKE_SPEECH', async () => {
  expect(await fakeClipUrl('Skipped.', 'en')).toBeNull();
  expect(synthesize).not.toHaveBeenCalled();
});
it('returns null when the call fails, and tries again the next time', async () => {
  synthesize.mockRejectedValueOnce(new Error('ElevenLabs answered 503'));
  expect(await clipUrl('Camera off.', 'en')).toBeNull();
  expect(await clipUrl('Camera off.', 'en')).toMatch(/\.mp3$/);
});
```

`speech.test.ts`:

```ts
it('serves a clip', async () => {
  // put three bytes in the cache of the test app under the hash 'a' x 64
  const res = await fetch(`${t.base}/api/speech/${'a'.repeat(64)}.mp3`);
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toBe('audio/mpeg');
  expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
});
it('answers 404 for an unknown clip and for a name that is not a hash', async () => {
  expect((await fetch(`${t.base}/api/speech/${'b'.repeat(64)}.mp3`)).status).toBe(404);
  expect((await fetch(`${t.base}/api/speech/..%2F..%2Fpackage.json`)).status).toBe(404);
  expect((await fetch(`${t.base}/api/speech/%2E%2E%2Fsecret.mp3`)).status).toBe(404);
});
```

Review Focus 3, in `speech.test.ts`. The app has `FAKE_SPEECH` off, test values for the ElevenLabs variables, and `synthesize: async () => { throw new Error('503'); }`.

```ts
it('with ElevenLabs down, the line goes out with no clip, and the prompt still takes a yes', async () => {
  session.dispatch(seeOat);
  expect(await phone.next((m) => m.t === 'speak')).toMatchObject({
    text: 'Oat drink, one litre, one eighty-nine. Nod to add.', url: null, promptId: 'p-0001',
  });
  phone.send({ t: 'prompt.done', promptId: 'p-0001' });
  phone.send({ t: 'intent', kind: 'yes', source: 'head', promptId: 'p-0001' });
  expect(await phone.next((m) => m.t === 'speak' && m.text.startsWith('Added'))).toMatchObject({ url: null });
  expect(session.snapshot().captions.map((c) => c.url)).toEqual([null, null]);
});
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/server -- speech`
Expected: FAIL for the two new files, because the modules do not exist.

- [ ] **Step 3: Implement the four modules and pass `clipUrl` to the runtime**

- [ ] **Step 4: Run all checks**

Run: `npm test --workspace @glance/server` and `npm run typecheck --workspace @glance/server`
Expected: PASS, and no type error.

- [ ] **Step 5: Verify the ElevenLabs call with one request**

Put `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_EN` in `apps/server/.env`, and export them in the shell.

```bash
curl -s -o camera-on.mp3 -w "%{http_code}\n" -X POST \
  "https://api.elevenlabs.io/v1/text-to-speech/$ELEVENLABS_VOICE_EN/stream?output_format=mp3_44100_128" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" -H "content-type: application/json" \
  -d '{"text":"Camera on.","model_id":"eleven_flash_v2_5"}'
```

Expected: `200`, and `camera-on.mp3` plays "Camera on." With another status, read the docs page above and fix `elevenlabs.ts`. Delete the file after the check.

- [ ] **Step 6: Commit, then test M1 with the phone of seat 1**

```bash
git add apps/server
git commit -m "feat(server): add speech clips with a cache and the ElevenLabs call"
```

M1 test: run `npm run dev --workspace @glance/server` with the keys in `.env`, or use the deployed server of Task 22. The phone starts a session and sends frames of the oat drink. The glasses say "Oat drink, one litre, one eighty-nine. Nod to add."

---

### Task 16 (C2): Kiosk, mock payment, receipt

**Files:**
- Create: `apps/server/src/kiosk/kiosks.ts`, `apps/server/src/kiosk/payment.ts`, `apps/server/src/http/kiosks.ts`
- Modify: `apps/server/src/app.ts`, `apps/server/src/ws/device.ts`, `apps/server/src/http/sessions.ts`
- Test: `apps/server/src/kiosk/kiosks.test.ts`, `apps/server/src/http/kiosks.test.ts`

**Interfaces:**
- Consumes: `RuntimeDeps.startPayment`, `RuntimeDeps.afterStep`, `SessionRuntime` (Task 9), `Store`, `KioskRecord`, `OrderRecord` (Task 8), `sendEventStream` (Task 10), `ScriptPlayer` (Task 12). From `@glance/shared`: `parseKioskCode`, `formatKioskCode`, `KioskEvent`, `KioskEventSchema`, `CreateKioskRequestSchema`, `CreateKioskResponseSchema`, `Receipt`.
- Produces:

```ts
// kiosks.ts
export const KIOSK_RESULT_MS = 10000;   // how long the kiosk shows "paid" or "failed"
export type KioskResult = { state: 'paid'; receipt: Receipt } | { state: 'failed' };
export function kioskView(kiosk: KioskRecord, session: SessionState | null, result: KioskResult | null): KioskEvent;
export class KioskService {
  constructor(deps: { store: Store; bus: EventBus; clock: Clock });
  load(): Promise<void>;                                       // reads the kiosks of the store at start
  register(request: CreateKioskRequest, fixedCode?: string): Promise<CreateKioskResponse>;
  get(id: string): KioskRecord | null;
  newest(): KioskRecord | null;
  sight(session: SessionRuntime, text: string): void;          // for kiosk.seen
  sync(session: SessionRuntime, before: SessionState): void;   // this is RuntimeDeps.afterStep
  release(sessionId: string): void;                            // when a session is deleted
  view(id: string): KioskEvent;
}

// payment.ts
export function createPayments(deps: { store: Store; clock: Clock; kiosks: KioskService; delayMs: number }):
  (session: SessionRuntime, kiosk: KioskRef, totalCents: number) => void;   // this is RuntimeDeps.startPayment
```

Routes:

| Call | Body | Answer |
|---|---|---|
| `POST /api/kiosks` | `CreateKioskRequest` | 201, `CreateKioskResponse` |
| `GET /api/kiosks/:id/events` | | an events stream of `KioskEvent`. The first message is the current view. |

Behavior:

1. `register`: the kiosk ID is `randomUUID()`, and the token is made as for a session. The code has 4 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. Draw again if the code is taken. `spotCheck` and `failPayment` default to `false`.
2. `sight`: `parseKioskCode(text)`, then the kiosk with that code. With no kiosk it does nothing (R14). Else it sets `lastSeenAt` and dispatches `kiosk.seen` with `kiosk: { id, name, store }`, the `spotCheck` of the record, and `busy`.
3. `busy` is true when the kiosk is bound to another session.
4. `sync` binds the kiosk when the session opened a checkout, and releases it when the checkout ended. Each change of `boundSessionId` goes to the store.
5. When a checkout ends from the step `paying`, the kiosk shows a result for `KIOSK_RESULT_MS`: `paid` with the receipt if the phase is `paid`, else `failed`. Then it shows `idle`.
6. `sync` publishes `view(kioskId)` on `kioskTopic(kioskId)` when the view changed.
7. `kioskView`: a result wins. Else an open checkout gives `connected` with the cart and the total. Else the state is `idle`, and `cart`, `totalCents`, and `receipt` are `null`. `paid` carries the receipt and its total.
8. Payment: after `delayMs`, a kiosk with `failPayment` gives `payment.result` with `ok: false`. Each other kiosk gets an order in the store, then `payment.result` with `ok: true`, the order ID, and `paidAt`.
9. The order is `{ _id, sessionId, kioskId, items, totalCents, paidAt, method: 'demo' }`. The ID is `ord-` plus 8 hex characters. `paidAt` is the ISO time of the clock.
10. The device socket gives `kiosk.seen` to `sight`. `DELETE /api/sessions/:id` calls `release`.
11. The fake player's `onKiosk` finds the kiosk (`newest`, or by code) and calls `sight` with `formatKioskCode(code)`.
12. In fake mode, `buildApp` registers one kiosk at start: `{ name: 'Checkout 3', store: 'Demo Market' }` with the fixed code `K3X7`. Plan 2 tests with a printed `GL1 K3X7` code. Only this case passes `fixedCode`. If the store already has a kiosk with that code, the app keeps it.

- [ ] **Step 1: Write the failing tests**

`kiosks.test.ts`:

```ts
const record: KioskRecord = { _id: 'k1', token: 't', code: 'K3X7', name: 'Checkout 3', store: 'Demo Market',
  boundSessionId: null, lastSeenAt: null, spotCheck: false, failPayment: false };
const kiosk = { id: 'k1', name: 'Checkout 3', store: 'Demo Market' };

it('shows idle with the code and no cart', () => {
  expect(kioskView(record, null, null)).toEqual({
    type: 'kiosk.state', state: 'idle', kiosk, code: 'K3X7', cart: null, totalCents: null, receipt: null,
  });
});
it('shows the cart of the session during a checkout', () => {
  const h = harness({ cart: [RYE, OAT, CRISPS] }); h.send({ type: 'kiosk.seen', kiosk, busy: false, spotCheck: false });
  expect(kioskView(record, h.state, null)).toMatchObject({ state: 'connected', totalCents: 639, cart: h.state.cart, receipt: null });
});
it('shows a result before the checkout state', () => {
  const receipt = { orderId: 'ord-1', totalCents: 639, paidAt: '2026-11-14T12:00:00.000Z', items: [], kiosk };
  expect(kioskView(record, null, { state: 'paid', receipt })).toMatchObject({ state: 'paid', receipt, totalCents: 639, cart: null });
  expect(kioskView(record, null, { state: 'failed' })).toMatchObject({ state: 'failed', receipt: null });
});
it('each view passes the shared schema', () => {
  expect(KioskEventSchema.safeParse(kioskView(record, null, null)).success).toBe(true);
});
```

`http/kiosks.test.ts`. `shopperWithOatDrink()` makes a session with one oat drink in the cart and a `TestPhone`. `checkoutReady()` adds a kiosk and an `eventReader` on the kiosk stream. Its argument goes into the kiosk request.

```ts
it('registers a kiosk with a code that makes a valid QR text', async () => {
  const res = await post('/api/kiosks', { name: 'Checkout 3', store: 'Demo Market' });
  expect(res.status).toBe(201);
  const body = CreateKioskResponseSchema.parse(await res.json());
  expect(parseKioskCode(formatKioskCode(body.code))).toBe(body.code);
});
it('runs the checkout from the code to the receipt', async () => {
  const { phone, session, kiosk, kioskEvents } = await checkoutReady();
  expect(await kioskEvents.next()).toMatchObject({ type: 'kiosk.state', state: 'idle', code: kiosk.code });
  phone.send({ t: 'kiosk.seen', text: `gl1 ${kiosk.code.toLowerCase()}` });   // a decoder can return lower case
  const offered = await phone.next((m) => m.t === 'event' && m.event.type === 'checkout.offered');
  const promptId = (offered as { event: { promptId: string } }).event.promptId;
  expect(await kioskEvents.next()).toMatchObject({ state: 'connected', totalCents: 189 });
  phone.send({ t: 'prompt.done', promptId });
  phone.send({ t: 'intent', kind: 'yes', source: 'head', promptId });
  const paid = await phone.next((m) => m.t === 'event' && m.event.type === 'checkout.paid');
  expect(paid).toMatchObject({ event: { totalCents: 189, kiosk: { name: 'Checkout 3', store: 'Demo Market' } } });
  expect(await kioskEvents.next()).toMatchObject({ state: 'paid', receipt: { totalCents: 189 } });
  expect(await t.store.listOrders(session.id)).toMatchObject([{ method: 'demo', totalCents: 189, kioskId: kiosk.kioskId }]);
  await phone.next((m) => m.t === 'session.end');
  expect(phone.messages.filter((m) => m.t === 'speak').at(-1)).toMatchObject({
    text: 'Paid. One euro eighty-nine. Your receipt is on your phone. Camera off.', sound: 'paid',
  });
});
it('a kiosk with failPayment fails the payment and makes no order', async () => {
  const { phone, session, kioskEvents } = await checkoutReady({ failPayment: true });
  // kiosk.seen, prompt.done, and a yes, as in the test above
  expect(await phone.next((m) => m.t === 'event' && m.event.type === 'checkout.failed'))
    .toMatchObject({ event: { reason: 'declined' } });
  expect(await t.store.listOrders(session.id)).toEqual([]);
  // the kiosk stream shows idle, connected, then failed
});
it('a second shopper hears that the checkout is busy', async () => {
  const first = await checkoutReady();
  first.phone.send({ t: 'kiosk.seen', text: formatKioskCode(first.kiosk.code) });
  await first.phone.next((m) => m.t === 'event' && m.event.type === 'checkout.offered');
  const second = await shopperWithOatDrink();
  second.phone.send({ t: 'kiosk.seen', text: formatKioskCode(first.kiosk.code) });
  expect(await second.phone.next((m) => m.t === 'speak' && m.text.startsWith('This'))).toMatchObject({ text: 'This checkout is busy.' });
  expect(second.session.state.phase).toBe('shopping');
});
it('a text that is no code of a kiosk changes nothing', async () => {
  const { phone, session } = await checkoutReady();
  phone.send({ t: 'kiosk.seen', text: 'https://example.com' });
  phone.send({ t: 'kiosk.seen', text: 'GL1 ZZZZ' });
  phone.send({ t: 'intent', kind: 'help', source: 'phone' });
  await phone.next((m) => m.t === 'speak');
  expect(session.state.phase).toBe('shopping');
});
it('the kiosk is free again after a cancelled checkout', async () => {
  // first shopper: kiosk.seen, then a phone no on the pay prompt. Second shopper: kiosk.seen
  expect(second.session.state.phase).toBe('checkout');
});
it('shows idle again after the result time', async () => {
  // fake timers, a KioskService with a MemoryStore, and a session that paid
  await vi.advanceTimersByTimeAsync(KIOSK_RESULT_MS);
  expect(kiosks.view(kioskId).state).toBe('idle');
});
it('the fake server has the kiosk K3X7 from the start', async () => {
  // testApp({ FAKE_RECOGNITION: '1', GEMINI_API_KEY: '' }), and a shopper with one oat drink in the cart
  phone.send({ t: 'kiosk.seen', text: 'GL1 K3X7' });
  const offered = await phone.next((m) => m.t === 'event' && m.event.type === 'checkout.offered');
  expect(offered).toMatchObject({ event: { kiosk: { name: 'Checkout 3', store: 'Demo Market' } } });
});
```

Review Focus 2, in `http/kiosks.test.ts`:

```ts
it('a second yes during the payment makes one order', async () => {
  const { phone, session, kiosk } = await checkoutReady();
  phone.send({ t: 'kiosk.seen', text: formatKioskCode(kiosk.code) });
  const offered = await phone.next((m) => m.t === 'event' && m.event.type === 'checkout.offered');
  const promptId = (offered as { event: { promptId: string } }).event.promptId;
  phone.send({ t: 'prompt.done', promptId });
  phone.send({ t: 'intent', kind: 'yes', source: 'head', promptId });
  phone.send({ t: 'intent', kind: 'yes', source: 'head', promptId });
  phone.send({ t: 'intent', kind: 'yes', source: 'phone', promptId });
  await phone.next((m) => m.t === 'event' && m.event.type === 'checkout.paid');
  expect(await t.store.listOrders(session.id)).toHaveLength(1);
});
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/server -- kiosk`
Expected: FAIL, because the modules do not exist.

- [ ] **Step 3: Implement `kiosks.ts`, `payment.ts`, the two routes, and the wiring**

`buildApp` now passes `kiosks.sync` as `afterStep` and the function of `createPayments` as `startPayment`. It calls `kiosks.load()` before it returns.

- [ ] **Step 4: Run all checks**

Run: `npm test --workspace @glance/server` and `npm run typecheck --workspace @glance/server`
Expected: PASS, and no type error.

- [ ] **Step 5: Try the loop by hand with the fake server**

Run: `npm run dev:fake --workspace @glance/server`. Register a kiosk, then create a session and read its events:

```bash
curl -s -X POST http://localhost:8080/api/kiosks -H "content-type: application/json" -d '{"name":"Checkout 3","store":"Demo Market"}'
curl -s -X POST http://localhost:8080/api/sessions -H "content-type: application/json" -d "{}"
curl -N "http://localhost:8080/api/sessions/<sessionId>/events?token=<token>"
```

When a `glance.pending` event comes, send a phone yes with its `promptId`. The rye bread prompt at second 14 stays current for about 20 seconds.

```bash
curl -s -X POST "http://localhost:8080/api/sessions/<sessionId>/intents?token=<token>" -H "content-type: application/json" -d '{"kind":"yes","source":"phone","promptId":"<promptId>"}'
```

Expected: a `cart.updated` event with the new total. At second 40 of the script, a `checkout.offered` event comes. A phone yes with its `promptId` gives `checkout.paid`.

- [ ] **Step 6: Commit**

```bash
git add apps/server
git commit -m "feat(server): add the kiosk, the mock payment, and the receipt"
```

The server side of M2 is complete: glance, yes, cart, kiosk, pay, receipt.

---

### Task 17 (C3): Token checks

**Files:**
- Create: `apps/server/src/http/auth.ts`, `apps/server/src/http/demo.ts`
- Modify: `apps/server/src/http/sessions.ts`, `apps/server/src/http/kiosks.ts`, `apps/server/src/ws/device.ts`, `apps/server/src/app.ts`, `apps/server/src/testing.ts`, `apps/server/src/config.ts`, `apps/server/.env.example`
- Test: `apps/server/src/http/auth.test.ts`, `apps/server/src/http/demo.test.ts`

**Interfaces:**
- Consumes: the routes of Tasks 10 and 16, the socket of Task 11.
- Produces:

```ts
// http/auth.ts
export function tokenMatches(expected: string, given: unknown): boolean;   // timingSafeEqual. false for a missing value or another length

// testing.ts
export function upgradeStatus(url: string): Promise<number>;   // the HTTP status of a refused socket upgrade
```

Rules:

1. Each session path with `:id` needs `?token=` with the session token. The kiosk events path needs the kiosk token.
2. An unknown ID gets 404. A missing or wrong token gets 401 with `{ error: 'unauthorized' }`.
3. The token check runs before the body check: a wrong token with a bad body gets 401.
4. The socket upgrade answers `HTTP/1.1 401 Unauthorized` for a missing or wrong token, and 404 for an unknown session.
5. `POST /api/sessions`, `POST /api/kiosks`, `GET /api/speech/:file`, and `GET /healthz` need no token.
6. The request log holds the method and the path with no query string, because the query string holds the token.
7. `AppDeps.log` also takes `{ stream }`, an object with `write(line: string)`, for the log test.
8. `Config` gains `demoKey: string | null` from `DEMO_KEY`. An empty value counts as not set.
9. `GET /api/demo/latest?key=<key>` answers 200 with a `LatestSessionResponse` of `@glance/shared`: the ID and the token of the session in `app.sessions.live()` that was created last. The mirror page of Plan 3 and the HUD of Plan 4 call it each 2 seconds, so that they follow the session of the phone with no typed ID.
10. That path answers 404 with `{ error: 'not_found' }` when `demoKey` is `null`, when the key does not match (`tokenMatches`), or when no session is live. It needs no session token. By rule 6 the log never holds the key.

- [ ] **Step 1: Write the failing test**

`call(method, path)` sends the request with an empty JSON body for `POST` and `PATCH`. `id` and `token` belong to a session, and `kiosk` is the answer of `POST /api/kiosks`.

```ts
const sessionPaths: [string, (id: string) => string][] = [
  ['GET', (id) => `/api/sessions/${id}`],
  ['PATCH', (id) => `/api/sessions/${id}/profile`],
  ['POST', (id) => `/api/sessions/${id}/intents`],
  ['POST', (id) => `/api/sessions/${id}/cart`],
  ['GET', (id) => `/api/sessions/${id}/events`],
  ['DELETE', (id) => `/api/sessions/${id}`],
];

it.each(sessionPaths)('%s on a session path needs the session token', async (method, path) => {
  expect((await call(method, path(id))).status).toBe(401);
  expect((await call(method, `${path(id)}?token=wrong`)).status).toBe(401);
  expect((await call(method, `${path('nope')}?token=${token}`)).status).toBe(404);
});
it('the kiosk stream needs the kiosk token', async () => {
  expect((await call('GET', `/api/kiosks/${kiosk.kioskId}/events`)).status).toBe(401);
  expect((await call('GET', `/api/kiosks/${kiosk.kioskId}/events?token=${token}`)).status).toBe(401);
  const ok = await fetch(`${t.base}/api/kiosks/${kiosk.kioskId}/events?token=${kiosk.token}`, { signal: abort.signal });
  expect(ok.status).toBe(200);
});
it('the socket needs the token', async () => {
  expect(await upgradeStatus(`${t.wsBase}/ws/device?session=${id}&token=wrong`)).toBe(401);
  expect(await upgradeStatus(`${t.wsBase}/ws/device?session=${id}`)).toBe(401);
  expect(await upgradeStatus(`${t.wsBase}/ws/device?session=nope&token=${token}`)).toBe(404);
});
it('a wrong token changes nothing', async () => {
  await call('DELETE', `/api/sessions/${id}?token=wrong`);
  expect((await call('GET', `/api/sessions/${id}?token=${token}`)).status).toBe(200);
});
it('compares a token of each length and type with no throw', () => {
  expect(tokenMatches('abc', 'abc')).toBe(true);
  expect(tokenMatches('abc', 'abd')).toBe(false);
  expect(tokenMatches('abc', 'abcd')).toBe(false);
  expect(tokenMatches('abc', undefined)).toBe(false);
  expect(tokenMatches('abc', ['abc'])).toBe(false);
});
it('writes no token to the log', async () => {
  // a test app with a log stream that keeps each line in logLines
  await call('GET', `/api/sessions/${id}?token=${token}`);
  expect(logLines.length).toBeGreaterThan(0);
  expect(logLines.join('\n')).not.toContain(token);
});
```

`demo.test.ts`. `demo` is a second test app with `testApp({ DEMO_KEY: 'k-demo' })`. `demoCall` is `call` on that app. `newSession()` posts to `/api/sessions` of that app and returns the answer.

```ts
it('gives the newest live session to a caller with the demo key', async () => {
  expect((await demoCall('GET', '/api/demo/latest?key=k-demo')).status).toBe(404);   // no session yet
  const first = await newSession();
  const second = await newSession();
  const latest = await (await demoCall('GET', '/api/demo/latest?key=k-demo')).json();
  expect(latest).toEqual({ sessionId: second.sessionId, token: second.token });
  await demoCall('DELETE', `/api/sessions/${second.sessionId}?token=${second.token}`);
  const next = await (await demoCall('GET', '/api/demo/latest?key=k-demo')).json();
  expect(next.sessionId).toBe(first.sessionId);
});
it('answers 404 for a wrong key, for no key, and when DEMO_KEY is not set', async () => {
  await newSession();
  expect((await demoCall('GET', '/api/demo/latest?key=wrong')).status).toBe(404);
  expect((await demoCall('GET', '/api/demo/latest')).status).toBe(404);
  expect((await call('GET', '/api/demo/latest?key=k-demo')).status).toBe(404);   // the first test app has no DEMO_KEY
});
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `npm test --workspace @glance/server -- auth`
Expected: FAIL. The paths answer 200 or 204 with no token.

- [ ] **Step 3: Implement `tokenMatches`, add the check to each path and to the upgrade, and set the log serializer**

- [ ] **Step 4: Run all checks**

Run: `npm test --workspace @glance/server`
Expected: PASS. The tests of Tasks 10, 11, and 16 already send the token.

- [ ] **Step 5: Commit**

```bash
git add apps/server
git commit -m "feat(server): check the token on each session and kiosk path"
```

---

### Task 18 (C3): States that the server reports

**Files:**
- Modify: `apps/server/src/sessions/types.ts`, `apps/server/src/sessions/general.ts`, `apps/server/src/sessions/checkout.ts`, `apps/server/src/sessions/step.ts`, `apps/server/src/ws/device.ts`, `apps/server/src/app.ts`
- Test: `apps/server/src/sessions/states.test.ts`, `apps/server/src/ws/device.test.ts`

**Interfaces:**
- Consumes: the rules of Tasks 3 to 6, the worker `onSlow` (Task 14), the socket (Task 11).
- Produces: two more variants of `RuleInputBody`, and one more field of `SessionState`.

```ts
| { type: 'recognition.slow' }
| { type: 'socket.open' }

batteryWarned: 20 | 10 | null;   // SessionState, starts at null
```

The states of spec section 6.6 that the server reports:

| State | Signal on the server | Line | Event |
|---|---|---|---|
| Paused | `device.state` with `stream: 'paused'` | `device.paused` | |
| Stopped by the device | `device.state` with `stream: 'stopped'` | `device.cameraOff` | `session.state` |
| Battery at 20 and 10 percent | `device.state`, `battery` | `device.battery` | |
| Battery too low, too warm | `stream: 'stopped'` and `cannotStream` | `device.regularCheckout` | `session.state` |
| Server not reachable | the socket of the session opens again | `net.backOnline` | |
| Recognition slow | 3 failed calls in a row | `recognition.slow` | `error`, code `recognition.slow` |
| Payment failed (mock) | `failPayment` of the kiosk | `checkout.failed` | `checkout.failed`, reason `declined` |
| Checkout busy | the kiosk is bound to another session | `checkout.busy` | `error`, code `kiosk.busy` |

Tasks 5, 6, and 16 already cover the rows "Stopped", "Battery too low", and "Payment failed". The phone knows the other states of spec section 6.6 before the server does, and it shows them from `native.state`.

Rules of this task:

1. `device.state` with `stream: 'paused'`, while the stored stream is not `paused`: line `device.paused`. `cameraOn` stays true.
2. Battery at 10 or less, while `batteryWarned` is not 10: line `device.battery` with 10, and `batteryWarned = 10`.
3. Battery at 20 or less, while `batteryWarned` is `null`: line `device.battery` with 20, and `batteryWarned = 20`. Check rule 2 first.
4. Battery above 20 sets `batteryWarned` to `null`. A `device.state` with `stream: 'stopped'` gives no battery line.
5. `recognition.slow`: line `recognition.slow`, and the event `{ type: 'error', code: 'recognition.slow', message: 'Recognition is slow right now.' }`.
6. `socket.open` while `device` is set: line `net.backOnline`. A session with no device state yet gets no line. The stored session holds `device`, so this also works after a server restart.
7. A busy kiosk (Task 5, rule 3) also emits `{ type: 'error', code: 'kiosk.busy', message: 'This checkout is busy.' }` with its line.
8. The frame handler's `onSlow` dispatches `recognition.slow`. The socket dispatches `socket.open` after the snapshot.

The phone holds the line "Connection lost. Your cart is safe. Glances are paused." The server cannot send a clip while the link is down.

- [ ] **Step 1: Write the failing tests**

`states.test.ts`:

```ts
it('says Paused one time when the stream pauses', () => {
  const h = harness();
  h.send({ type: 'device.state', state: STREAMING });
  h.send({ type: 'device.state', state: { ...STREAMING, stream: 'paused' } });
  expect(h.lines()).toEqual(['device.paused']);
  h.send({ type: 'device.state', state: { ...STREAMING, stream: 'paused', battery: 79 } });
  expect(h.effects).toEqual([]);
  h.send({ type: 'device.state', state: STREAMING });
  expect(h.effects).toEqual([]);
  expect(h.state.cameraOn).toBe(true);
});
it('reports the battery at 20 and at 10 percent, one time each', () => {
  const h = harness();
  h.send({ type: 'device.state', state: STREAMING });
  const level = (battery: number) => {
    h.send({ type: 'device.state', state: { ...STREAMING, battery } });
    return h.speak()?.line;
  };
  expect(level(21)).toBeUndefined();
  expect(level(20)).toEqual({ key: 'device.battery', percent: 20 });
  expect(level(19)).toBeUndefined();
  expect(level(10)).toEqual({ key: 'device.battery', percent: 10 });
  expect(level(9)).toBeUndefined();
  expect(level(80)).toBeUndefined();
  expect(level(8)).toEqual({ key: 'device.battery', percent: 10 });
});
it('reports slow recognition with a line and an error event', () => {
  const h = harness();
  h.send({ type: 'recognition.slow' });
  expect(h.lines()).toEqual(['recognition.slow']);
  expect(h.event('error')).toEqual({ type: 'error', code: 'recognition.slow', message: 'Recognition is slow right now.' });
});
it('says Back online when the socket opens again', () => {
  const h = harness();
  h.send({ type: 'socket.open' });
  expect(h.effects).toEqual([]);
  h.send({ type: 'device.state', state: STREAMING });
  h.send({ type: 'socket.open' });
  expect(h.lines()).toEqual(['net.backOnline']);
});
it('a busy kiosk also sends an error event', () => {
  const h = harness({ cart: [RYE] });
  h.kiosk({ busy: true });
  expect(h.event('error')).toEqual({ type: 'error', code: 'kiosk.busy', message: 'This checkout is busy.' });
});
```

Add to `ws/device.test.ts`:

```ts
it('a phone that connects again hears Back online', async () => {
  phone.send({ t: 'device.state', state: STREAMING });
  await phone.next((m) => m.t === 'speak');
  phone.close(); await phone.closed;
  const again = await connectPhone(t, id, token);
  expect(await again.next((m) => m.t === 'speak')).toMatchObject({ text: 'Back online.', priority: 'high' });
});
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/server -- states device`
Expected: FAIL. The new inputs have no handler.

- [ ] **Step 3: Implement the eight rules**

- [ ] **Step 4: Run all checks**

Run: `npm test --workspace @glance/server` and `npm run typecheck --workspace @glance/server`
Expected: PASS, and no type error.

- [ ] **Step 5: Commit**

```bash
git add apps/server
git commit -m "feat(server): report pause, battery, slow recognition, and reconnect"
```

---

### Task 19 (C3): No stored frame

**Files:**
- Create: `apps/server/src/recognition/save.ts`
- Modify: `apps/server/src/recognition/intake.ts`, `apps/server/src/app.ts`, `apps/server/src/main.ts`, `apps/server/src/app.test.ts`
- Test: `apps/server/src/recognition/save.test.ts`

**Interfaces:**
- Consumes: `createFrameHandler`, `Frame` (Task 14).
- Produces:

```ts
// save.ts
export type FrameSaver = (sessionId: string, frame: Frame) => Promise<void>;
export function createFrameSaver(dir: string): FrameSaver;   // writes <dir>/<sessionId>/<seq>.jpg

// intake.ts: createFrameHandler takes one more dependency
saveFrame: FrameSaver | null;
```

Rules:

1. A frame lives in memory from the socket message to the end of its recognition call (Task 14, worker rule 7).
2. `save.ts` is the only file on the frame path that imports the file system. `main.ts` makes a saver only when `SAVE_FRAMES` holds a directory.
3. With a saver, the frame handler saves each frame that it accepts. A failed write is logged, and the call goes on.
4. At start with `SAVE_FRAMES` set, `main.ts` logs at `warn` level: `SAVE_FRAMES is on. The server writes each frame to <dir>.`
5. A log line about a frame holds `seq`, `w`, `h`, `blurred`, `kind`, and the byte count. It holds no bytes of the image.
6. `GET /healthz` gains `saveFrames: boolean`, so the team can check the switch before the demo.
7. The switch stays off in the demo and on the deployed server (spec section 11.1).

- [ ] **Step 1: Write the failing test**

```ts
it('the frame saver writes the JPEG under the session ID and the sequence number', async () => {
  await createFrameSaver(dir)('s1', frame(7));
  expect(new Uint8Array(readFileSync(join(dir, 's1', '7.jpg')))).toEqual(frame(7).jpeg);
});
it('the frame handler saves a frame only when it has a saver', async () => {
  const saver = vi.fn(async () => undefined);
  createFrameHandler({ ...deps, saveFrame: saver })(session, frame(1));
  createFrameHandler({ ...deps, saveFrame: null })(session, frame(2));
  await vi.waitFor(() => expect(recognize).toHaveBeenCalledTimes(2));
  expect(saver).toHaveBeenCalledTimes(1);
});
it('only the frame saver imports the file system on the frame path', () => {
  for (const file of ['src/ws/device.ts', 'src/recognition/intake.ts', 'src/recognition/worker.ts', 'src/recognition/gemini.ts']) {
    expect(readFileSync(file, 'utf8')).not.toMatch(/node:fs/);
  }
});
it('logs the header of a frame and never its bytes', async () => {
  // a handler with a log stream that keeps each line, and a frame with 50000 bytes
  expect(logLines.length).toBeGreaterThan(0);
  expect(Math.max(...logLines.map((line) => line.length))).toBeLessThan(500);
});
```

Change the health test of Task 1: the answer is now `{ ok: true, fakeRecognition: true, fakeSpeech: true, store: 'memory', saveFrames: false }`.

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/server -- save app`
Expected: FAIL, because `save.ts` does not exist and the health answer has no `saveFrames`.

- [ ] **Step 3: Implement `save.ts` and the changes**

`gemini.ts` reads the prompt template through its `template` argument, so it needs no file import. `main.ts` reads the file.

- [ ] **Step 4: Run all checks**

Run: `npm test --workspace @glance/server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server
git commit -m "feat(server): keep frames in memory only, with a SAVE_FRAMES switch for the test set"
```

---

### Task 20 (C3): Catalog check and seed

**Files:**
- Create: `apps/server/src/catalog/check.ts`, `apps/server/src/speech/seed.ts`, `apps/server/scripts/catalog-check.ts`, `apps/server/scripts/catalog-seed.ts`
- Modify: `apps/server/package.json` (scripts `catalog:check` and `catalog:seed`)
- Test: `apps/server/src/catalog/check.test.ts`, `apps/server/src/speech/seed.test.ts`

**Interfaces:**
- Consumes: `ProductSchema`, `renderLine` (Task 7), `createClipUrl` (Task 15), `Store` (Task 8), `loadConfig` (Task 1).
- Produces:

```ts
// catalog/check.ts
export type CatalogReport = { products: Product[]; errors: string[]; warnings: string[] };
export function checkCatalog(input: unknown, opts?: { lang?: Lang }): CatalogReport;

// speech/seed.ts
export function seedLines(products: readonly Product[]): string[];   // the texts that the seed makes clips for
```

`package.json` scripts: `"catalog:check": "tsx scripts/catalog-check.ts"` and `"catalog:seed": "tsx --env-file-if-exists=.env scripts/catalog-seed.ts"`. Each takes the catalog path as its argument. The default is `CATALOG_PATH`.

`checkCatalog` errors. Each message starts with the product ID and a colon.

1. The input is no array, or an entry fails `ProductSchema`. The message is `<id>: <field> <zod message>`. For an entry with no `id`, it starts with `entry <index>`.
2. An `id` does not match `/^[a-z0-9]+(-[a-z0-9]+)*$/`, or two entries share it: `duplicate id`.
3. `priceCents` is 0.
4. An ID in `lookAlikes` does not exist, is the product itself, or does not list the product back.
5. No pair of look-alikes differs in `priceCents` or in `allergens` (spec section 11.3). This message starts with `catalog:`.
6. A `gtin` has another length than 8, 12, 13, or 14 digits, or a wrong GS1 check digit.
7. With `lang: 'it'`: `name`, `spokenName`, `spokenPack`, or `spokenPackDetailed` has no Italian text.

`checkCatalog` warnings:

8. `allergens` is `null`: `<id>: no allergen data`. The voice then says that the data is missing.
9. `visual` has fewer than 20 characters: `<id>: visual is too short for the prompt`. It has a line break or a vertical bar: `<id>: visual must be one line with no vertical bar`. The prompt prints it on one line with bars between the fields.
10. The catalog has fewer than 12 products: `catalog: <n> products, the demo needs 12`.

`catalog:check` prints `error: <message>` or `warning: <message>` for each entry of the report. Then it prints `catalog: 12 products, 0 errors, 2 warnings`. The exit code is 1 with one error or more. With `--lang it` it passes `lang: 'it'`.

`catalog:seed`:

1. It runs `checkCatalog` and stops on an error.
2. With `MONGODB_URI` it calls `store.replaceProducts`. Without it, it prints `seed: no MONGODB_URI, products not stored` and goes on. The memory store reads `CATALOG_PATH` at each start.
3. Unless `--no-clips` is given or `FAKE_SPEECH` is on, it makes a clip for each text of `seedLines`, one at a time.
4. It prints `seed: 12 products, 63 clips, 0 failed`.

`seedLines`, with `DEFAULT_PROFILE`: for each product, `glance.new` with the hint, `glance.new` with no hint, and `glance.inCart` with `qty: 1`. Then the 18 lines with no parameter, `device.battery` for 20 and for 10, and `glance.partial` for the seven aim hints. That is 27 lines plus 3 for each product. `seed.ts` names the 18 keys in one array. An extra that adds a fixed line adds its key there and raises the count in the test.

- [ ] **Step 1: Write the failing tests**

`check.test.ts` (`dev` is the parsed JSON of the dev catalog, and `edit(id, patch)` returns a copy with one entry changed):

```ts
it('accepts the dev catalog with two warnings', () => {
  const report = checkCatalog(dev);
  expect(report.errors).toEqual([]);
  expect(report.warnings).toEqual(['potato-crisps: no allergen data', 'catalog: 4 products, the demo needs 12']);
  expect(report.products).toHaveLength(4);
});
it('reports a duplicate ID, a bad ID, and a price of zero', () => {
  expect(checkCatalog([...dev, dev[2]]).errors).toContain('rye-bread: duplicate id');
  expect(checkCatalog(edit('rye-bread', { id: 'Rye_Bread' })).errors[0]).toMatch(/^Rye_Bread: id/);
  expect(checkCatalog(edit('rye-bread', { priceCents: 0 })).errors).toContain('rye-bread: priceCents is 0');
});
it('reports a look-alike that does not exist or does not point back', () => {
  expect(checkCatalog(edit('rye-bread', { lookAlikes: ['no-such'] })).errors).toContain('rye-bread: look-alike no-such does not exist');
  expect(checkCatalog(edit('oat-drink-barista-1l', { lookAlikes: [] })).errors)
    .toContain('oat-drink-1l: look-alike oat-drink-barista-1l does not list it back');
});
it('needs one look-alike pair that differs in price or allergens', () => {
  expect(checkCatalog(edit('oat-drink-barista-1l', { priceCents: 189 })).errors)
    .toContain('catalog: no look-alike pair differs in price or allergens');
});
it('checks the GTIN', () => {
  const errors = (gtin: string) => checkCatalog(edit('oat-drink-1l', { gtin })).errors;
  expect(errors('4006381333931')).toEqual([]);
  expect(errors('73513537')).toEqual([]);
  expect(errors('4006381333932')).toEqual(['oat-drink-1l: gtin has a wrong check digit']);
  expect(errors('12345')).toEqual(['oat-drink-1l: gtin must have 8, 12, 13, or 14 digits']);
});
it('with the Italian option, each spoken field needs Italian text', () => {
  expect(checkCatalog(dev, { lang: 'it' }).errors).toContain('rye-bread: name has no Italian text');
});
```

`seed.test.ts`:

```ts
it('lists the lines to make in advance, with no duplicate', () => {
  const lines = seedLines(dev);
  expect(lines).toHaveLength(27 + 3 * dev.length);
  expect(new Set(lines).size).toBe(lines.length);
  for (const line of ['Oat drink, one litre, one eighty-nine. Nod to add.', 'Oat drink, one litre, one eighty-nine.',
    'Oat drink. One is in your cart. Nod to add another. Shake to remove.', 'Skipped.',
    'Glasses battery at ten percent.', 'I can see part of it. Turn the front to me.']) expect(lines).toContain(line);
});
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/server -- check seed`
Expected: FAIL, because the modules do not exist.

- [ ] **Step 3: Implement `check.ts`, `seed.ts`, and the two scripts**

- [ ] **Step 4: Run the tests, then the two commands**

Run: `npm test --workspace @glance/server -- check seed`
Expected: PASS.

Run: `npm run catalog:check --workspace @glance/server`
Expected: two `warning:` lines, then `catalog: 4 products, 0 errors, 2 warnings`, and exit code 0.

Run: `npm run catalog:seed --workspace @glance/server -- catalog/catalog.dev.json`, with `MONGODB_URI` and the ElevenLabs variables in `.env`
Expected: `seed: 4 products, 39 clips, 0 failed`. The seed uses about 1,600 characters of the ElevenLabs credits. Check the balance first.

When Plan 4 delivers `catalog/catalog.json`, run both commands on it. Fix each error with seat 4 before the seed.

- [ ] **Step 5: Commit**

```bash
git add apps/server
git commit -m "feat(server): add the catalog check and the seed with clips made in advance"
```

---

### Task 21 (C3): Replay tool

**Files:**
- Create: `apps/server/src/recognition/replay.ts`, `apps/server/scripts/replay.ts`
- Modify: `apps/server/package.json` (script `replay`)
- Test: `apps/server/src/recognition/replay.test.ts`

**Interfaces:**
- Consumes: `createGeminiRecognizer`, `RecognitionResult`, `NO_RESULT` (Tasks 3 and 13), `CatalogIndex`.
- Produces:

```ts
export type ReplayRow = { label: string; file: string; result: RecognitionResult | null; ms: number };   // null: the call failed
export type ReplayLabelRow = {
  label: string; frames: number; correct: number; wrong: number;
  ambiguous: number; unsure: number; unknown: number; none: number; failed: number;
};
export type ReplayTable = {
  rows: ReplayLabelRow[];
  frames: number; correct: number; wrongIdentified: number;
  accuracy: number;                    // correct / frames, 0 to 1
  medianMs: number; p95Ms: number;     // p95 by nearest rank
};
export function listFrames(dir: string, catalog: CatalogIndex): { label: string; file: string }[];
export function summarize(rows: ReplayRow[]): ReplayTable;
export function formatTable(table: ReplayTable): string;
```

Decisions:

- Frames lie in `<dir>/<label>/<name>.jpg`. A label is a product ID, `unknown`, or `none`. `listFrames` throws for each other folder name.
- Correct: for a product label, `identified` with that ID. For `unknown` and `none`, that status.
- Wrong: `identified` with another ID, or each `identified` for the labels `unknown` and `none`. Spec section 15 wants 0 of these.
- For a product label, the columns `unknown` and `none` count results with that status. For the labels `unknown` and `none`, the matching status counts as correct and not in its column.
- The script is `"replay": "tsx --env-file-if-exists=.env scripts/replay.ts"`. Arguments: `--frames <dir>`, `--media-resolution default|low`, `--min-confidence <n>`, `--limit <n>`.
- The script sends one frame at a time, with the timeout of the live path. The latency numbers then match the live path.
- Output: one row for each label, then `accuracy: 95.0% (95 of 100)`, `wrong identified: 0`, and `latency: median 1340 ms, p95 2210 ms`.
- The exit code is 1 when `wrongIdentified` is more than 0.

- [ ] **Step 1: Write the failing test**

```ts
const id = (productId: string): RecognitionResult => ({ ...NO_RESULT, status: 'identified', productId, confidence: 0.9 });
const rows: ReplayRow[] = [
  { label: OAT, file: 'a.jpg', result: id(OAT), ms: 1000 },
  { label: OAT, file: 'b.jpg', result: id(BARISTA), ms: 2000 },
  { label: OAT, file: 'c.jpg', result: { ...NO_RESULT, status: 'unsure' }, ms: 3000 },
  { label: 'unknown', file: 'd.jpg', result: { ...NO_RESULT, status: 'unknown' }, ms: 4000 },
  { label: 'none', file: 'e.jpg', result: null, ms: 4000 },
];

it('counts each outcome for each label', () => {
  const table = summarize(rows);
  expect(table.rows.find((r) => r.label === OAT)).toEqual({
    label: OAT, frames: 3, correct: 1, wrong: 1, ambiguous: 0, unsure: 1, unknown: 0, none: 0, failed: 0,
  });
  expect(table.rows.find((r) => r.label === 'none')).toMatchObject({ frames: 1, correct: 0, failed: 1 });
  expect(table).toMatchObject({ frames: 5, correct: 2, wrongIdentified: 1, accuracy: 0.4, medianMs: 3000, p95Ms: 4000 });
});
it('prints the three summary lines', () => {
  const text = formatTable(summarize(rows));
  expect(text).toContain('accuracy: 40.0% (2 of 5)');
  expect(text).toContain('wrong identified: 1');
  expect(text).toContain('latency: median 3000 ms, p95 4000 ms');
});
it('reads the labels from the folder names and rejects an unknown label', () => {
  // a temp dir with oat-drink-1l/a.jpg and none/b.jpg
  expect(listFrames(dir, catalog).map((f) => f.label).sort()).toEqual(['none', 'oat-drink-1l']);
  // add the folder cola/c.jpg
  expect(() => listFrames(dir, catalog)).toThrow(/cola/);
});
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `npm test --workspace @glance/server -- replay`
Expected: FAIL, because `replay.ts` does not exist.

- [ ] **Step 3: Implement `replay.ts` and the script**

- [ ] **Step 4: Run the test, then replay real frames**

Run: `npm test --workspace @glance/server -- replay`
Expected: PASS.

Put the 20 probe frames of Plan 2 in `apps/server/testdata/frames/<label>/`. Until they exist, use portrait phone photos of the catalog products.

Run: `npm run replay --workspace @glance/server -- --frames testdata/frames`
Run: `npm run replay --workspace @glance/server -- --frames testdata/frames --media-resolution low`

Expected: two tables. Decide with them:

- Spec section 16 wants 18 of the 20 probe frames correct. With fewer, tell the team: the fallback is reference photos in the prompt, which is not in this plan.
- If `low` is as accurate as the default, set `GEMINI_MEDIA_RESOLUTION=low` (spec section 11.1).
- If `wrong identified` is not 0, raise `RECOGNITION_MIN_CONFIDENCE` and replay again.
- Give seat 4 the accuracy and latency lines for the pitch. The pitch number needs 100 frames over all products.

- [ ] **Step 5: Commit**

```bash
git add apps/server
git commit -m "feat(server): add the replay tool with an accuracy table"
```

---

### Task 22 (C3): Deployment on Vultr with HTTPS

**Files:**
- Create: `infra/Dockerfile`, `infra/Dockerfile.dockerignore`, `infra/compose.yaml`, `infra/Caddyfile`, `infra/.env.example`
- Create: `apps/server/scripts/smoke.ts`
- Modify: `apps/server/package.json` (script `smoke`)
- Test: `apps/server/scripts/smoke.test.ts`

**Interfaces:**
- Consumes: `/healthz` (Task 1). The smoke script also needs Tasks 10 and 11.
- Produces: the server at `https://<domain>`, and the smoke script:

```ts
export type SmokeResult = { ok: boolean; steps: { name: string; ok: boolean; detail?: string }[] };
export function runSmoke(baseUrl: string): Promise<SmokeResult>;
```

Do the files and the instance steps right after Task 1. The first deployment then answers only `/healthz`. Write the smoke script after Task 11.

- [ ] **Step 1: Write the five infra files**

`infra/Dockerfile`. The build context is the repository root.

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY . .
RUN npm ci --omit=dev --workspace @glance/server --include-workspace-root \
 && mkdir -p /data/speech && chown node:node /data/speech
ENV NODE_ENV=production PORT=8080 SPEECH_CACHE_DIR=/data/speech
WORKDIR /app/apps/server
USER node
EXPOSE 8080
CMD ["node", "--import", "tsx", "src/main.ts"]
```

`infra/Dockerfile.dockerignore`:

```text
.git
**/node_modules
**/dist
**/.cache
**/testdata
**/.env
docs
skills
.claude
.agents
apps/mobile/android
```

`infra/compose.yaml`:

```yaml
services:
  server:
    build:
      context: ..
      dockerfile: infra/Dockerfile
    env_file: .env
    volumes:
      - speech:/data/speech
    restart: unless-stopped
  caddy:
    image: caddy:2
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    environment:
      DOMAIN: ${DOMAIN}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ../apps/website/dist:/srv/website:ro
      - ../apps/display-pow/dist:/srv/hud:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - server
    restart: unless-stopped
volumes:
  speech:
  caddy_data:
  caddy_config:
```

`infra/Caddyfile`. Caddy gets the certificates by itself. It passes WebSocket upgrades and flushes event streams with no extra setting.

```text
{$DOMAIN} {
	@server path /api/* /ws/* /healthz
	handle @server {
		reverse_proxy server:8080
	}
	handle {
		root * /srv/website
		encode zstd gzip
		try_files {path} /index.html
		file_server
	}
}

hud.{$DOMAIN} {
	root * /srv/hud
	encode zstd gzip
	try_files {path} /index.html
	file_server
}
```

`infra/.env.example`:

```text
DOMAIN=glance.example.com
PUBLIC_BASE_URL=https://glance.example.com
CATALOG_PATH=catalog/catalog.dev.json
MONGODB_URI=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_EN=
ELEVENLABS_VOICE_IT=
FAKE_RECOGNITION=
FAKE_SPEECH=
REQUIRE_BLUR=
DEMO_KEY=
```

`REQUIRE_BLUR` and `DEMO_KEY` come from Tasks 14 and 17. Set `REQUIRE_BLUR=1` when the face blur of Plan 2 Task 18 is on the phone. Set `DEMO_KEY` to a random word of 12 characters or more. The mirror page and the HUD take it as `?latest=<key>`.

- [ ] **Step 2: Create the instance and deploy**

1. In the Vultr console, deploy an instance: region Stockholm, plan `vc2-1c-1gb`, Marketplace app "Docker" on Ubuntu 24.04, with your SSH key.
2. Create two DNS A records for the instance address: `<domain>` and `hud.<domain>`.
3. If the repository is private, add a deploy key to the instance before the clone.
4. Run the commands below on the instance. In the editor, set `DOMAIN` and `PUBLIC_BASE_URL`.
5. Until Tasks 14 and 15 are merged, also set `FAKE_RECOGNITION=1` and `FAKE_SPEECH=1`. Leave `MONGODB_URI` empty until Task 20.

```bash
ssh root@<address>
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
git clone https://github.com/mrBymax/glance.git /opt/glance
cd /opt/glance && git switch feat/server
mkdir -p apps/website/dist apps/display-pow/dist
cp infra/.env.example infra/.env
nano infra/.env
docker compose -f infra/compose.yaml up -d --build
```

If `npm ci` reports a missing package in the build, remove the two workspace flags from the Dockerfile. The image then holds the dependencies of each app.

Run: `curl -sS https://<domain>/healthz`
Expected: `{"ok":true,...}` over HTTPS with a valid certificate. Tell the team the URL.

- [ ] **Step 3: Write the failing test of the smoke script (after Task 11)**

`runSmoke` does these steps and stops at the first failure:

1. `health`: `GET /healthz` answers 200.
2. `session`: `POST /api/sessions` answers 201.
3. `socket`: the `wsUrl` opens, and a `snapshot` message arrives.
4. `events`: `GET /api/sessions/:id/events` answers 200.
5. `line`: after `device.state` with a running stream, a `speak` with the text `Camera on. Hold a product up to hear its price.` arrives within 5 seconds.
6. `caption`: the events stream gets the `caption` of that line.
7. `delete`: `DELETE /api/sessions/:id` answers 204.

The socket opens before the events stream. In fake mode the events path would start the fake device first, and step 5 would get no line.

The script is `"smoke": "tsx scripts/smoke.ts"`. The command `npm run smoke --workspace @glance/server -- <baseUrl>` prints `ok <name>` or `FAIL <name>: <detail>` for each step, then `smoke: OK` or `smoke: FAIL`. The exit code is 1 on a failure.

```ts
it('passes against a local server', async () => {
  const result = await runSmoke(t.base);
  expect(result.steps.map((s) => s.name)).toEqual(['health', 'session', 'socket', 'events', 'line', 'caption', 'delete']);
  expect(result.ok).toBe(true);
});
it('fails at the first step when no server answers', async () => {
  const result = await runSmoke('http://127.0.0.1:9');
  expect(result.ok).toBe(false);
  expect(result.steps).toMatchObject([{ name: 'health', ok: false }]);
});
```

- [ ] **Step 4: Run the test and make sure it fails, implement `smoke.ts`, and run the test again**

Run: `npm test --workspace @glance/server -- smoke`
Expected: FAIL before the implementation, PASS after it.

- [ ] **Step 5: Deploy again and check the full path through Caddy**

On the instance: `cd /opt/glance && git pull && docker compose -f infra/compose.yaml up -d --build`

On a laptop: `npm run smoke --workspace @glance/server -- https://<domain>`
Expected: seven `ok` lines and `smoke: OK`. This proves the socket and the events stream through Caddy.

- [ ] **Step 6: Switch to the real services**

After Tasks 14 and 15, for M1:

1. Put the Gemini key, the ElevenLabs key, and the voice IDs in `infra/.env`. Clear `FAKE_RECOGNITION` and `FAKE_SPEECH`.
2. When Plan 4 has delivered the catalog, set `CATALOG_PATH=catalog/catalog.json`. Leave `MONGODB_URI` empty: the server then keeps its data in memory.
3. Deploy again as in Step 5, and run the smoke command. Expected: `smoke: OK`, and `/healthz` shows `"fakeRecognition":false,"fakeSpeech":false,"store":"memory"`.

After Task 20, for the demo:

1. Put `MONGODB_URI` in `infra/.env`.
2. Build the new image, seed the database, then start the server:

```bash
cd /opt/glance && git pull
docker compose -f infra/compose.yaml build
docker compose -f infra/compose.yaml run --rm server npm run catalog:seed -- catalog/catalog.json
docker compose -f infra/compose.yaml up -d
```

3. Run the smoke command again. Expected: `smoke: OK`, and `/healthz` shows `"store":"mongo"` and `"saveFrames":false`.

Use `catalog/catalog.dev.json` in the seed until Plan 4 delivers `catalog/catalog.json`.

When Plans 3 and 4 have builds, make the static pages on the instance:

```bash
docker run --rm -v /opt/glance:/app -w /app node:22-slim sh -c "npm ci && npm run build --workspace apps/website --workspace apps/display-pow"
```

Logs: `docker compose -f infra/compose.yaml logs -f server`.

- [ ] **Step 7: Commit**

```bash
git add infra apps/server
git commit -m "chore(infra): add the Docker image, Compose file, Caddy config, and a smoke script"
```

---

### Task 23 (Extra 1): Allergen guard

**Files:**
- Create: `apps/server/src/sessions/warnings.ts`
- Modify: `apps/server/src/sessions/glance.ts`, `apps/server/src/sessions/view.ts`, `apps/server/src/speech/lines.en.ts`
- Test: `apps/server/src/sessions/warnings.test.ts`, `apps/server/src/speech/render.test.ts`

**Interfaces:**
- Consumes: `Warning`, `Profile`, `Product` from `@glance/shared`. The glance rules (Task 3), `renderLine` (Task 7).
- Produces:

```ts
export function warningsFor(product: Product, profile: Profile): Warning[];
```

Rules:

1. With allergens in the profile: a product with `allergens: null` gives `allergenDataMissing`. Each other product gives `{ kind: 'allergen', allergens }` with the profile allergens that it lists, in the order of the profile. No match gives no warning.
2. `profile.vegan` with `product.vegan === false` gives `{ kind: 'diet', diet: 'vegan' }`. With `product.vegan === null` it gives `allergenDataMissing`.
3. `profile.vegetarian` works the same way. Skip it when the list has the vegan warning.
4. The list has at most one `allergenDataMissing`.
5. An empty list means "no known match". The guard has no value and no line for "safe".
6. `glance.pending`, both glance lines, and the snapshot carry the warnings. A glance line with a warning has the sound `warning`.
7. The warning text follows the price and comes before the yes phrase, at each detail level.
8. Text: "Warning: contains gluten.", "Warning: contains gluten and milk.", "Warning: contains gluten, milk and nuts." A diet: "Warning: not vegan." (*) or "Warning: not vegetarian." (*). Missing data: "Allergen data is missing for this product."
9. At the detailed level, an allergen warning lists each allergen of the product and replaces the "Contains" sentence.

- [ ] **Step 1: Write the failing tests**

`warnings.test.ts` (`P` is `DEFAULT_PROFILE`, and `oat` and `crisps` come from the dev catalog):

```ts
it('warns for each allergen that the profile lists and the product holds', () => {
  expect(warningsFor(oat, { ...P, allergens: ['milk', 'gluten'] })).toEqual([{ kind: 'allergen', allergens: ['gluten'] }]);
  expect(warningsFor(oat, { ...P, allergens: ['milk'] })).toEqual([]);
});
it('reports missing data one time', () => {
  expect(warningsFor(crisps, { ...P, allergens: ['gluten'] })).toEqual([{ kind: 'allergenDataMissing' }]);
  expect(warningsFor(crisps, { ...P, allergens: ['gluten'], vegan: true })).toEqual([{ kind: 'allergenDataMissing' }]);
});
it('warns for a diet', () => {
  const meat = { ...oat, vegan: false, vegetarian: false };
  expect(warningsFor(meat, { ...P, vegan: true, vegetarian: true })).toEqual([{ kind: 'diet', diet: 'vegan' }]);
  expect(warningsFor(meat, { ...P, vegetarian: true })).toEqual([{ kind: 'diet', diet: 'vegetarian' }]);
});
it('gives no warning to a profile with no allergen and no diet', () => {
  expect(warningsFor(crisps, P)).toEqual([]);
});
it('puts the warning in the event, the line, and the sound', () => {
  const h = harness({ profile: { allergens: ['gluten'] } });
  h.see(OAT);
  const warnings = [{ kind: 'allergen', allergens: ['gluten'] }];
  expect(h.event('glance.pending')!.warnings).toEqual(warnings);
  expect(h.speak()).toMatchObject({ line: { warnings }, sound: 'warning' });
});
```

Add to `render.test.ts` (`crisps` from the dev catalog):

```ts
const warned = (warnings: Warning[], hint = false): Line => ({ key: 'glance.new', product: oat, hint, warnings });
const gluten: Warning = { kind: 'allergen', allergens: ['gluten'] };

it('speaks the warnings', () => {
  expect(text(warned([gluten]))).toBe('Oat drink, one litre, one eighty-nine. Warning: contains gluten.');
  expect(text(warned([gluten], true))).toBe('Oat drink, one litre, one eighty-nine. Warning: contains gluten. Nod to add.');
  expect(text(warned([gluten]), { detail: 'brief' })).toBe('Oat drink, one eighty-nine. Warning: contains gluten.');
  expect(text(warned([{ kind: 'allergen', allergens: ['gluten', 'milk', 'nuts'] }])))
    .toBe('Oat drink, one litre, one eighty-nine. Warning: contains gluten, milk and nuts.');
  expect(text(warned([{ kind: 'diet', diet: 'vegan' }]))).toBe('Oat drink, one litre, one eighty-nine. Warning: not vegan.');
  expect(text({ key: 'glance.new', product: crisps, hint: false, warnings: [{ kind: 'allergenDataMissing' }] }))
    .toBe('Potato crisps, one hundred fifty grams, one ninety. Allergen data is missing for this product.');
});
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/server -- warnings render`
Expected: FAIL, because `warningsFor` does not exist.

- [ ] **Step 3: Implement `warningsFor`, and use it in `glance.ts`, `toSnapshot`, and the two glance templates**

- [ ] **Step 4: Run all checks**

Run: `npm test --workspace @glance/server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server
git commit -m "feat(server): add the allergen guard"
```

---

### Task 24 (Extra 2): Budget guard

**Files:**
- Modify: `apps/server/src/sessions/answers.ts`, `apps/server/src/speech/lines.en.ts`
- Test: `apps/server/src/sessions/answers.test.ts`, `apps/server/src/speech/render.test.ts`

**Interfaces:**
- Consumes: `Profile.budgetCents`, the event `budget.exceeded`, the line `cart.added` with `budgetCents` (Task 3).
- Produces: no new export.

Rules:

1. An add crosses the budget when `profile.budgetCents` is set and two things hold. The total before the add is at most the budget, and the total after it is more.
2. For that add: the line `cart.added` has `budgetCents`, its sound is `warning`, and the event `budget.exceeded` follows `cart.updated`.
3. Each other add has `budgetCents: null`. The rule holds for a yes and for a higher quantity in `cart.edit`.
4. Text: the standard added line, then "That is over your budget of twenty euros." The budget uses the full price form. The brief level also names the total here.

- [ ] **Step 1: Write the failing tests**

Add to `answers.test.ts`:

```ts
it('warns one time when an add crosses the budget', () => {
  const h = harness({ profile: { budgetCents: 2000 }, products: [product('big-box', 1921)], cart: ['big-box'] });
  h.see(OAT); h.done(); h.yes('head');
  expect(h.events()).toEqual(['glance.cleared', 'cart.updated', 'budget.exceeded']);
  expect(h.event('budget.exceeded')).toEqual({ type: 'budget.exceeded', budgetCents: 2000, totalCents: 2110 });
  expect(h.speak()).toMatchObject({ line: { key: 'cart.added', totalCents: 2110, budgetCents: 2000 }, sound: 'warning' });
  h.advance(T.viewMs); h.see(RYE); h.done(); h.yes('head');
  expect(h.events()).toEqual(['glance.cleared', 'cart.updated']);
  expect(h.speak()).toMatchObject({ line: { budgetCents: null }, sound: 'added' });
});
```

Add to `render.test.ts`:

```ts
it('speaks the budget line of the spec', () => {
  const over: Line = { key: 'cart.added', product: oat, totalCents: 2110, budgetCents: 2000 };
  const line = 'Added oat drink. Total twenty-one ten. That is over your budget of twenty euros.';
  expect(text(over)).toBe(line);
  expect(text(over, { detail: 'brief' })).toBe(line);
});
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/server -- answers render`
Expected: FAIL. The add emits no `budget.exceeded`.

- [ ] **Step 3: Implement the four rules**

- [ ] **Step 4: Run all checks**

Run: `npm test --workspace @glance/server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server
git commit -m "feat(server): add the budget guard"
```

---

### Task 25 (Extra 3): Answer for look-alike products

**Files:**
- Modify: `apps/server/src/sessions/types.ts`, `apps/server/src/sessions/say.ts`, `apps/server/src/sessions/glance.ts`, `apps/server/src/speech/lines.en.ts`
- Test: `apps/server/src/sessions/glance.test.ts`, `apps/server/src/speech/render.test.ts`

**Interfaces:**
- Consumes: the event `glance.ambiguous` of Plan 0. The glance rules (Task 3).
- Produces: one more line, and two more fields of `SessionState`.

```ts
| { key: 'glance.ambiguous'; products: Product[] }   // Line: priority normal, no sound, no interrupt

ambiguousKey: string | null;   // the sorted candidate IDs of the last ambiguous result
ambiguousAt: number | null;
```

Rules:

1. `ambiguous` no longer counts as `unsure`.
2. If the product of the current prompt is one of the candidates, the prompt ends with `glance.cleared`. The shopper cannot add a product that the model is no longer sure of.
3. If the current prompt is for another product, and that product is in view, do nothing.
4. In each other case emit `glance.ambiguous` with the candidates as `ProductRef`, and speak `glance.ambiguous`. Do this one time for each appearance: the same `ambiguousKey` with `now - ambiguousAt < TIMING.viewMs` is the same appearance.
5. Text with a common name: "I cannot tell which oat drink this is. Turn the front to me." The common name is the longest run of words that ends each `spokenName`, compared with no case.
6. Text with no common name (*): "I cannot tell if this is oat drink or rye bread. Turn the front to me." It names the first two candidates.

- [ ] **Step 1: Write the failing tests**

Add to `glance.test.ts`:

```ts
it('says that it cannot tell look-alike products apart, one time for each appearance', () => {
  const h = harness();
  h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(h.events()).toEqual(['glance.ambiguous']);
  expect(h.event('glance.ambiguous')!.candidates.map((c) => c.id)).toEqual([OAT, BARISTA]);
  expect(h.lines()).toEqual(['glance.ambiguous']);
  h.advance(500); h.result({ status: 'ambiguous', candidates: [BARISTA, OAT] });
  expect(h.effects).toEqual([]);
  h.advance(500); h.see(BARISTA);
  expect(h.state.prompt).toMatchObject({ productId: BARISTA });
});
it('ends a prompt for a product that the model is no longer sure of', () => {
  const h = harness();
  h.see(OAT); h.done();
  h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(h.events()).toEqual(['glance.cleared', 'glance.ambiguous']);
  h.yes('voice');
  expect(h.state.cart).toEqual(EMPTY_CART);
});
```

Add to `render.test.ts` (`barista` from the dev catalog):

```ts
it('speaks the look-alike lines', () => {
  expect(text({ key: 'glance.ambiguous', products: [oat, barista] }))
    .toBe('I cannot tell which oat drink this is. Turn the front to me.');
  expect(text({ key: 'glance.ambiguous', products: [oat, rye] }))
    .toBe('I cannot tell if this is oat drink or rye bread. Turn the front to me.');
});
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/server -- glance render`
Expected: FAIL. An `ambiguous` result still gives `glance.hint`.

- [ ] **Step 3: Implement the six rules**

- [ ] **Step 4: Run all checks**

Run: `npm test --workspace @glance/server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server
git commit -m "feat(server): say when two look-alike products fit the frame"
```

---

### Task 26 (Extra 5): Ask about a product

**Files:**
- Create: `agents/answers.md`, `apps/server/src/ask/ask.ts`
- Modify: `apps/server/src/sessions/types.ts`, `apps/server/src/sessions/say.ts`, `apps/server/src/sessions/general.ts`, `apps/server/src/sessions/answers.ts`, `apps/server/src/sessions/runtime.ts`, `apps/server/src/speech/lines.en.ts`, `apps/server/src/ws/device.ts`, `apps/server/src/app.ts`
- Test: `apps/server/src/ask/ask.test.ts`, `apps/server/src/sessions/ask.test.ts`

**Interfaces:**
- Consumes: the Gemini client of Task 13, `parseVoiceCommand` (Task 11), `formatEur` from `@glance/shared`.
- Produces:

```ts
// sessions/types.ts
| { type: 'question'; text: string }                    // RuleInputBody
| { type: 'answer'; text: string | null }               // RuleInputBody
| { type: 'ask'; question: string; product: Product }   // Effect
| { key: 'ask.listening' } | { key: 'ask.noProduct' } | { key: 'ask.failed' } | { key: 'ask.answer'; text: string }   // Line
askUntil: number | null;                                // SessionState

// ask/ask.ts
export const ASK_WINDOW_MS = 10000;
export type Generate = (systemInstruction: string, text: string) => Promise<string>;
export function answerQuestion(
  generate: Generate, template: string, input: { question: string; product: Product; lang: Lang },
): Promise<string>;

// RuntimeDeps gains
ask: (question: string, product: Product, lang: Lang) => Promise<string>;
```

Lines, all not in the spec (*):

| Key | Text | Priority | Interrupt |
|---|---|---|---|
| `ask.listening` | Listening. | normal | yes |
| `ask.noProduct` | Hold a product up, then ask. | normal | no |
| `ask.failed` | I could not answer that. | low | no |
| `ask.answer` | the text of the answer | low | no |

Rules:

1. A yes from the source `touch`, while no prompt is current and rule R10 does not apply, opens the question window: `askUntil = now + ASK_WINDOW_MS`, line `ask.listening`. This replaces the R20 hint for that case (spec section 16: a double tap means "listen" when no prompt waits).
1a. An intent with the kind `ask`, from each source, opens the question window in the same way. The page of Plan 3 sends it for the microphone button. It needs no prompt ID, and a current prompt stays current.
2. The socket turns a `speech.final` that is no command, with `confidence >= 0.5`, into the input `question`.
3. A `question` outside the window does nothing. A `question` inside it closes the window.
4. The target is the product of the current prompt. Else it is the product that was seen last, if it is in view. Else it is the product of `lastAdd`. With no target: line `ask.noProduct`.
5. With a target: the effect `ask`. The runtime calls `deps.ask` with a limit of 4 seconds. It dispatches `answer` with the text, or with `null` after a failure.
6. `answer` with a text speaks `ask.answer`. `answer` with `null` speaks `ask.failed`.
7. `answerQuestion` makes one text call. The system instruction is `agents/answers.md`. The user text holds the language, the question, and the product as JSON with `name`, `brand`, `packSize`, `price` from `formatEur`, `allergens`, `vegan`, and `vegetarian`.
8. `answerQuestion` trims the answer, and cuts it at a sentence end to 200 characters or fewer.
9. The `Generate` function of the app calls `generateContent` with `config.systemInstruction` and the `httpOptions` of Task 13. It sets no response schema.

`agents/answers.md` must state these rules. The wording is free.

1. Answer only from the product data in the request.
2. If the data does not hold the answer, say "I do not have that information."
3. Never say that a product is safe.
4. Use one or two short sentences, in the language that the request names.

- [ ] **Step 1: Write the failing tests**

`sessions/ask.test.ts`:

```ts
it('answers a question about the product in view', () => {
  const h = harness();
  h.see(OAT); h.done(); h.no('head');   // no prompt is current, and the oat drink is in view
  h.yes('touch');
  expect(h.lines()).toEqual(['ask.listening']);
  h.send({ type: 'question', text: 'Does it contain nuts?' });
  expect(h.effects).toEqual([{ type: 'ask', question: 'Does it contain nuts?', product: h.ctx.catalog.get(OAT) }]);
  h.send({ type: 'answer', text: 'The data lists gluten only.' });
  expect(h.speak()).toMatchObject({ line: { key: 'ask.answer', text: 'The data lists gluten only.' }, priority: 'low' });
});
it('ignores a question outside the window, and says so when no product is known', () => {
  const h = harness();
  h.send({ type: 'question', text: 'What is this?' });
  expect(h.effects).toEqual([]);
  h.yes('touch'); h.advance(ASK_WINDOW_MS);
  h.send({ type: 'question', text: 'What is this?' });
  expect(h.effects).toEqual([]);
  h.yes('touch');
  h.send({ type: 'question', text: 'What is this?' });
  expect(h.lines()).toEqual(['ask.noProduct']);
});
it('says that it could not answer', () => {
  const h = harness();
  h.see(OAT); h.done(); h.no('head'); h.yes('touch');
  h.send({ type: 'question', text: 'Is it organic?' });
  h.send({ type: 'answer', text: null });
  expect(h.lines()).toEqual(['ask.failed']);
});
it('a double tap still answers a prompt', () => {
  const h = harness();
  h.see(OAT); h.done(); h.yes('touch');
  expect(h.state.cart.totalCents).toBe(189);
  expect(h.state.askUntil).toBeNull();
});
it('the microphone button opens the question window, also while a prompt is current', () => {
  const h = harness();
  h.see(OAT); h.done();
  h.intent('ask', 'phone');
  expect(h.lines()).toEqual(['ask.listening']);
  expect(h.state.askUntil).toBe(h.now + ASK_WINDOW_MS);
  h.yes('phone');
  expect(h.state.cart.totalCents).toBe(189);   // the prompt was still current
});
```

`ask/ask.test.ts`:

```ts
it('sends the question with the data of one product', async () => {
  const generate = vi.fn<Generate>(async () => ' It contains gluten. ');
  const answer = await answerQuestion(generate, 'RULES', { question: 'Does it contain nuts?', product: oat, lang: 'en' });
  expect(answer).toBe('It contains gluten.');
  const [instruction, text] = generate.mock.calls[0]!;
  expect(instruction).toBe('RULES');
  expect(text).toContain('Does it contain nuts?');
  expect(text).toContain('"allergens":["gluten"]');
  expect(text).toContain('"price":"1.89"');
  expect(text).not.toContain('rye-bread');
});
it('cuts a long answer at a sentence end', async () => {
  const answer = await answerQuestion(async () => 'A short sentence. '.repeat(20), 'RULES', { question: 'q', product: oat, lang: 'en' });
  expect(answer.length).toBeLessThanOrEqual(200);
  expect(answer.endsWith('.')).toBe(true);
});
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/server -- ask`
Expected: FAIL, because `ask.ts` and the new inputs do not exist.

- [ ] **Step 3: Implement the rules, `ask.ts`, `agents/answers.md`, and the wiring**

- [ ] **Step 4: Run all checks**

Run: `npm test --workspace @glance/server` and `npm run typecheck --workspace @glance/server`
Expected: PASS, and no type error.

- [ ] **Step 5: Commit**

```bash
git add agents apps/server
git commit -m "feat(server): answer a spoken question about the product in view"
```

---

### Task 27 (Extra 6): Fingerprint above 50 EUR, server part

**Files:**
- Modify: `apps/server/src/sessions/types.ts`, `apps/server/src/sessions/say.ts`, `apps/server/src/sessions/checkout.ts`, `apps/server/src/sessions/view.ts`, `apps/server/src/sessions/runtime.ts`, `apps/server/src/speech/lines.en.ts`, `apps/server/src/ws/device.ts`
- Test: `apps/server/src/sessions/checkout.test.ts`

**Interfaces:**
- Consumes: `biometric.request` and `biometric.result` of Plan 0, the checkout rules (Task 5).
- Produces:

```ts
export const BIOMETRIC_ABOVE_CENTS = 5000;      // checkout.ts
| { type: 'biometric.result'; ok: boolean }     // RuleInputBody
| { type: 'biometric.request' }                 // Effect
| { key: 'checkout.biometric' }                 // Line: priority high, interrupt yes
// CheckoutState.step gains 'biometric'
```

The text of `checkout.biometric` is "Over fifty euros. Confirm with your fingerprint on the phone."

Rules:

1. `needsBiometric`, in `checkout.offered` and in the snapshot, is `cart.totalCents > BIOMETRIC_ABOVE_CENTS`.
2. An accepted yes on a pay prompt with `needsBiometric`: step `biometric`, no prompt, line `checkout.biometric`, then the effect `biometric.request`. No payment starts.
3. `biometric.result` counts only in the step `biometric`. With `ok: true`: step `paying` and `payment.start`. With `ok: false`: the checkout ends as for a no (R18).
4. R19 also ends a checkout in the step `biometric`. In that step, a yes, a no, `undo`, and `cart.edit` have no effect.
5. The runtime sends `{ t: 'biometric.request' }` through the outbox, after the line. The socket turns `biometric.result` into the rule input.
6. A browser client has no fingerprint. Its checkout above 50 EUR ends by R19.

- [ ] **Step 1: Write the failing test**

Add to `checkout.test.ts`:

```ts
const costly = () => { const h = harness({ products: [product('tv', 5001)], cart: ['tv'] }); h.kiosk(); return h; };

it('asks for a fingerprint above 50 EUR, and pays only after it', () => {
  const h = costly();
  expect(h.event('checkout.offered')!.needsBiometric).toBe(true);
  h.done(); h.yes('head');
  expect(h.lines()).toEqual(['checkout.biometric']);
  expect(h.effects.at(-1)).toEqual({ type: 'biometric.request' });
  expect(payments(h)).toEqual([]);
  h.send({ type: 'biometric.result', ok: true });
  expect(h.effects).toEqual([{ type: 'payment.start', kiosk: KIOSK, totalCents: 5001 }]);
});
it('needs no fingerprint at exactly 50 EUR', () => {
  const h = harness({ products: [product('radio', 5000)], cart: ['radio'] });
  h.kiosk();
  expect(h.event('checkout.offered')!.needsBiometric).toBe(false);
  h.done(); h.yes('head');
  expect(payments(h)).toHaveLength(1);
});
it('a failed fingerprint cancels the checkout', () => {
  const h = costly(); h.done(); h.yes('head');
  h.send({ type: 'biometric.result', ok: false });
  expect(h.lines()).toEqual(['checkout.cancelled']);
  expect(payments(h)).toEqual([]);
  expect(h.state).toMatchObject({ phase: 'shopping', checkout: null });
});
it('a fingerprint result with no request starts no payment', () => {
  const h = harness({ cart: [RYE] }); h.kiosk(); h.done();
  h.send({ type: 'biometric.result', ok: true });
  expect(h.effects).toEqual([]);
});
```

- [ ] **Step 2: Run the test and make sure it fails**

Run: `npm test --workspace @glance/server -- checkout`
Expected: FAIL. `needsBiometric` is `false` for 5001 cents.

- [ ] **Step 3: Implement the six rules**

- [ ] **Step 4: Run all checks**

Run: `npm test --workspace @glance/server` and `npm run typecheck --workspace @glance/server`
Expected: PASS, and no type error.

- [ ] **Step 5: Commit**

```bash
git add apps/server
git commit -m "feat(server): ask for a fingerprint before a payment above 50 EUR"
```

---

### Task 28 (Extra 7): Voice in Italian

**Files:**
- Create: `apps/server/src/speech/lines.it.ts`
- Modify: `apps/server/src/speech/numbers.ts`, `apps/server/src/speech/phrases.ts`, `apps/server/src/speech/render.ts`, `apps/server/src/speech/seed.ts`, `apps/server/src/sessions/general.ts`, `apps/server/scripts/catalog-seed.ts`
- Test: `apps/server/src/speech/numbers.test.ts`, `apps/server/src/speech/render.test.ts`, `apps/server/src/sessions/general.test.ts`

**Interfaces:**
- Consumes: `LineTemplates`, `LINES_EN` (Task 7), `seedLines` (Task 20), `localize` from `@glance/shared`.
- Produces:

```ts
// lines.it.ts
export const LINES_IT: LineTemplates;   // the type makes each key necessary

// seed.ts: seedLines takes the language
export function seedLines(products: readonly Product[], lang?: Lang): string[];
```

Rules:

1. `renderLine` uses `LINES_IT` when `profile.lang` is `it`. `yesPhrases` has the same six rows in Italian.
2. Italian short price: the euros, "e", and the cents: "uno e ottantanove". Italian full price: "un euro e ottantanove", "sei euro e trentanove", "venti euro". Cents only: "novantanove centesimi".
3. `numberToWords(n, 'it')` writes one word: "ventuno", "ventotto", "ventitré", "centoventitré".
4. `speak.lang` and `caption.lang` are `profile.lang`. The voice is `ELEVENLABS_VOICE_IT`, or the English voice if that is not set (Task 15).
5. A `profile.set` that changes `lang` writes each cart name again in the new language, and emits `cart.updated` with `change: null`.
6. Voice commands stay English (spec section 21, decision 16).
7. `catalog:seed --lang it` also makes the Italian clips. `catalog:check --lang it` must pass first.
8. A native speaker of the team reads `lines.it.ts` before the merge.

- [ ] **Step 1: Write the failing tests**

Add to `numbers.test.ts`:

```ts
it('speaks Italian prices and numbers', () => {
  expect(spokenPrice(189, 'it', 'short')).toBe('uno e ottantanove');
  expect(spokenPrice(449, 'it', 'short')).toBe('quattro e quarantanove');
  expect(spokenPrice(2110, 'it', 'short')).toBe('ventuno e dieci');
  expect(spokenPrice(639, 'it', 'full')).toBe('sei euro e trentanove');
  expect(spokenPrice(189, 'it', 'full')).toBe('un euro e ottantanove');
  expect(spokenPrice(2000, 'it', 'full')).toBe('venti euro');
  expect(spokenPrice(99, 'it', 'full')).toBe('novantanove centesimi');
  expect([1, 8, 21, 23, 28, 38, 100, 123, 1000, 2000].map((n) => numberToWords(n, 'it')))
    .toEqual(['uno', 'otto', 'ventuno', 'ventitré', 'ventotto', 'trentotto', 'cento', 'centoventitré', 'mille', 'duemila']);
});
```

Add to `render.test.ts`:

```ts
it('speaks Italian lines', () => {
  const italian = (line: Line) => renderLine(line, { ...DEFAULT_PROFILE, lang: 'it' });
  expect(italian({ key: 'session.start' })).toBe('Fotocamera accesa. Solleva un prodotto per sentire il prezzo.');
  expect(italian(glance(false))).toBe('Bevanda di avena, un litro, uno e ottantanove.');
  expect(italian(glance(true))).toBe('Bevanda di avena, un litro, uno e ottantanove. Annuisci per aggiungere.');
  expect(italian(added)).toBe('Aggiunto: bevanda di avena. Totale quattro e quarantanove.');
  expect(italian({ key: 'checkout.offer', kiosk: KIOSK, itemCount: 3, totalCents: 639 }))
    .toBe('Checkout 3, Demo Market. Tre articoli, sei euro e trentanove. Annuisci per pagare.');
});
```

Add to `general.test.ts`:

```ts
it('a language change writes the cart names again', () => {
  const h = harness({ cart: [OAT] });
  h.send({ type: 'profile.set', patch: { lang: 'it' } });
  expect(h.state.cart.items[0]!.name).toBe('Bevanda di avena');
  expect(h.event('cart.updated')).toMatchObject({ change: null });
});
```

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/server -- speech general`
Expected: FAIL. The Italian texts are English.

- [ ] **Step 3: Implement the Italian numbers, phrases, and templates, and rule 5**

Translate each other line in the style of the five lines above: short, with no gender agreement on the product name.

- [ ] **Step 4: Run all checks, then listen**

Run: `npm test --workspace @glance/server` and `npm run typecheck --workspace @glance/server`
Expected: PASS, and no type error.

Set `ELEVENLABS_VOICE_IT`, run `npm run catalog:seed --workspace @glance/server -- --lang it`, and play three clips. If the voice reads Italian text with English sounds, read the `language_code` field at `https://elevenlabs.io/docs/api-reference/text-to-speech/stream`. Add it to the body in `elevenlabs.ts` only if `eleven_flash_v2_5` accepts it.

- [ ] **Step 5: Commit**

```bash
git add apps/server
git commit -m "feat(server): add the Italian voice lines"
```

---

### Task 29 (Extra 8): Spot check

**Files:**
- Modify: `apps/server/src/sessions/types.ts`, `apps/server/src/sessions/say.ts`, `apps/server/src/sessions/checkout.ts`, `apps/server/src/sessions/glance.ts`, `apps/server/src/speech/lines.en.ts`, `apps/server/src/kiosk/kiosks.ts`
- Test: `apps/server/src/sessions/checkout.test.ts`, `apps/server/src/speech/render.test.ts`, `apps/server/src/kiosk/kiosks.test.ts`

**Interfaces:**
- Consumes: `spotCheck` of the `kiosk.seen` input (Task 3), the event `checkout.spotcheck` and the kiosk state `spotcheck` of Plan 0.
- Produces:

```ts
| { key: 'spotcheck.ask'; product: Product } | { key: 'spotcheck.thanks' }   // Line: priority high. The ask line interrupts
// CheckoutState.step gains 'spotcheck'. CheckoutState gains spotProductId: string | null
```

Texts: "Quick check. Show me the oat drink." and "Thank you."

Rules:

1. A checkout that starts with `spotCheck: true` has the step `spotcheck`. It makes no pay prompt yet.
2. The product to show is the cart line with the highest `unitPriceCents`. The first line wins a tie.
3. Effects of the start: `session.state`, `checkout.spotcheck` with the product, line `spotcheck.ask`.
4. An `identified` result for that product in the step `spotcheck`: line `spotcheck.thanks`, mute the product, and set the step `suspended` with `suspendedBy: null`.
5. With `suspendedBy: null`, the next `kiosk.seen` makes the offer with no view test (Task 5, rule 7).
6. Another product in view during the step follows the product rules. The step stays.
7. R19 also ends a checkout in the step `spotcheck`.
8. `kioskView` gives the state `spotcheck`, with the cart and the total.

- [ ] **Step 1: Write the failing tests**

Add to `checkout.test.ts`:

```ts
it('asks to see one product before the pay prompt', () => {
  const h = harness({ cart: [RYE, OAT, CRISPS] });
  h.kiosk({ spotCheck: true });
  expect(h.events()).toEqual(['session.state', 'checkout.spotcheck']);
  expect(h.event('checkout.spotcheck')!.product.id).toBe(RYE);   // 260 is the highest price
  expect(h.speak()!.line).toMatchObject({ key: 'spotcheck.ask', product: { id: RYE } });
  expect(h.state.prompt).toBeNull();
  h.see(RYE);
  expect(h.lines()).toEqual(['spotcheck.thanks']);
  h.kiosk({ spotCheck: true });
  expect(h.event('checkout.offered')).toMatchObject({ totalCents: 639 });
});
it('another product does not pass the spot check', () => {
  const h = harness({ cart: [RYE, OAT, CRISPS] });
  h.kiosk({ spotCheck: true });
  h.see(OAT);
  expect(h.state.checkout!.step).toBe('spotcheck');
  h.kiosk({ spotCheck: true });
  expect(h.state.prompt).toMatchObject({ kind: 'product', productId: OAT });
});
```

Add to `render.test.ts`: `text({ key: 'spotcheck.ask', product: oat })` is "Quick check. Show me the oat drink.", and `text({ key: 'spotcheck.thanks' })` is "Thank you."

Add to `kiosks.test.ts`: `kioskView` of a session in the step `spotcheck` has the state `spotcheck` and the total 639.

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/server -- checkout render kiosks`
Expected: FAIL. A kiosk with `spotCheck` still gives `checkout.offered` at once.

- [ ] **Step 3: Implement the eight rules**

- [ ] **Step 4: Run all checks**

Run: `npm test --workspace @glance/server` and `npm run typecheck --workspace @glance/server`
Expected: PASS, and no type error.

- [ ] **Step 5: Commit**

```bash
git add apps/server
git commit -m "feat(server): add the spot check before the pay prompt"
```

---

### Task 30 (Extra 9): Sharp second look

**Files:**
- Modify: `apps/server/src/config.ts`, `apps/server/src/sessions/types.ts`, `apps/server/src/sessions/glance.ts`, `apps/server/src/sessions/step.ts`, `apps/server/src/sessions/harness.ts`, `apps/server/src/app.ts`
- Test: `apps/server/src/sessions/glance.test.ts`, `apps/server/src/config.test.ts`

**Interfaces:**
- Consumes: the look-alike rules (Task 25), the still slot of the worker (Task 14), `FrameHeader.kind` of Plan 0.
- Produces:

```ts
secondLookWaitMs: number;   // Config, from SECOND_LOOK_WAIT_MS, default 0, which means off. RuleContext gains the same field
heldAmbiguous: { products: string[]; since: number } | null;   // SessionState
// harness opts gain secondLookWaitMs?: number
```

Rules:

1. The phone takes a still when it gets the event `glance.ambiguous`, and sends it as a frame with `kind: 'still'` (Plan 2). The contract has no request message, so the event is the signal.
2. The worker keeps a still in its own slot (Task 14). The Gemini call for a still uses the default media resolution (Task 13).
3. With `secondLookWaitMs` 0, Task 25 applies with no change.
4. With a wait, an `ambiguous` result of a normal frame emits `glance.ambiguous` at once and holds the line in `heldAmbiguous`.
5. An `identified` result with `still: true` drops the held line and makes the normal prompt (R1).
6. Each other result with `still: true` speaks the held line at once.
7. `expire` speaks the held line when `now - since >= secondLookWaitMs`.
8. Set `SECOND_LOOK_WAIT_MS=2500` only when the phone sends stills. One test took about 1 second for the capture (spec section 11.1).

- [ ] **Step 1: Write the failing tests**

Add to `glance.test.ts`:

```ts
const still = (part: Partial<RecognitionResult>) => ({ type: 'recognition' as const, result: { ...NO_RESULT, ...part }, still: true });
const spokenKeys = (h: Harness) => h.all.filter((e): e is SpeakEffect => e.type === 'speak').map((e) => e.line.key);

it('holds the look-alike line for the still, and a sure still gives the normal prompt', () => {
  const h = harness({ secondLookWaitMs: 2500 });
  h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(h.events()).toEqual(['glance.ambiguous']);
  expect(h.lines()).toEqual([]);
  h.advance(1500); h.send(still({ status: 'identified', productId: BARISTA }));
  expect(h.state.prompt).toMatchObject({ productId: BARISTA });
  h.advance(2500);
  expect(spokenKeys(h)).toEqual(['glance.new']);
});
it('speaks the line when no still comes in time', () => {
  const h = harness({ secondLookWaitMs: 2500 });
  h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  h.advance(2499);
  expect(spokenKeys(h)).toEqual([]);
  h.advance(1);
  expect(h.lines()).toEqual(['glance.ambiguous']);
});
it('speaks the line at once when the still is not sure', () => {
  const h = harness({ secondLookWaitMs: 2500 });
  h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  h.advance(1200); h.send(still({ status: 'ambiguous', candidates: [OAT, BARISTA] }));
  expect(h.lines()).toEqual(['glance.ambiguous']);
});
```

Add to `config.test.ts`: the default of `secondLookWaitMs` is 0, and `SECOND_LOOK_WAIT_MS: '2500'` gives 2500.

- [ ] **Step 2: Run the tests and make sure they fail**

Run: `npm test --workspace @glance/server -- glance config`
Expected: FAIL. The line plays at once.

- [ ] **Step 3: Implement the rules**

- [ ] **Step 4: Run all checks, then try it with the phone of seat 1**

Run: `npm test --workspace @glance/server` and `npm run typecheck --workspace @glance/server`
Expected: PASS, and no type error.

With stills from the phone, hold the two look-alike products up in turn. Expected: the voice names the right product with no look-alike line.

- [ ] **Step 5: Commit**

```bash
git add apps/server
git commit -m "feat(server): wait for a sharp still before the look-alike line"
```

---

## Contract gaps in Plan 0

This plan uses the closest type in each case. A change of the contract is a decision for the team.

1. `DeviceState` has no stream error. The server cannot tell "battery low" or "thermal hot" from another stop. Task 6 reads `battery` and `thermal` with two limits that the author chose.
2. Closed after the cross-check: `IntentKind` now has `ask`, and Task 26 rule 1a uses it. `speech.final` still has no `promptId`, so a voice yes binds to the last finished prompt that the server knows.
3. No message tells the server that the phone closed its checkout screen. R19 uses the 30 seconds alone.
4. `ServerToDevice` has no request for a still, and no message says that the phone can take one. The phone must act on `glance.ambiguous`, and the server needs `SECOND_LOOK_WAIT_MS` (Task 30).
5. `error.code` and `checkout.failed.reason` are free strings. This plan sets `recognition.slow`, `kiosk.busy`, and `declined`. No event says that recognition is fast again.
6. Plan 0 defines no answer body for `PATCH profile`, `POST intents`, `POST cart`, and `DELETE`. This plan answers with the `Profile`, and with 204 for the other three.
7. The server cannot give the phone a clip before the link drops. The phone must hold the line "Connection lost. Your cart is safe. Glances are paused."
8. `Warning` has no kind for missing diet data. Task 23 reports it as `allergenDataMissing`.
9. Closed after the cross-check: Plan 0 now says what `blurred: false` means, and `REQUIRE_BLUR` drops such frames (Task 14, rule 1a).

## Assumptions to confirm

Plans 2, 3, and 4 already agree with this plan on these points: the catalog file is `apps/server/catalog/catalog.json`, the web builds go to `dist`, the HUD host is `hud.<domain>`, and the two limits of point 2.

1. A frame with `blurred: false` still goes to Gemini until `REQUIRE_BLUR=1` is set. The team sets it when Plan 2 Task 18 is on the phone, and keeps it set for the demo.
2. The limits for "the glasses cannot stream": battery at 5 percent or less, or thermal level 6 or more. The probe can give better numbers.
3. `RECOGNITION_MIN_CONFIDENCE` is 0.6. The replay tool can show a better value.
4. Each appearance of a product gets a new prompt, also while its older prompt is still current (Task 3, rule 7).
5. The budget line plays only for the add that crosses the budget.
6. The lines with (*) are not in the spec: rest, undo with nothing to undo, total, cart, the diet warnings, the second look-alike line, and the four lines of Task 26.
7. The yes phrase for the volume keys is "Press volume up to add."
8. The team has the ElevenLabs voice IDs, and enough credits for the seed and the demo. The free plan has 10,000 credits each month.
9. The Gemini project is on the paid tier. The team has confirmed that the paid tier does not train on the data (spec section 13).
10. A native speaker reads the Italian lines of Task 28.
11. The domain has two DNS records: `<domain>` and `hud.<domain>`.

