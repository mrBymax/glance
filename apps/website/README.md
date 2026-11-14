# @glance/website

The website of Meta Glance: a Vite app with React 19, Astryx, and `react-router`. It holds the landing page, the privacy page, the kiosk page, and the mirror page.

The kiosk page works. The other three pages are placeholders with one heading. Plan 3 fills the mirror page. Plan 4 fills the landing page and the privacy page.

## Routes

```mermaid
flowchart LR
  main["main.tsx: Theme, BrowserRouter"] --> app["App.tsx: Routes"]
  app -- "/" --> landing["pages/Landing.tsx"]
  app -- "/privacy" --> privacy["pages/Privacy.tsx"]
  app -- "/kiosk" --> kiosk["kiosk/KioskPage.tsx"]
  app -- "/mirror" --> mirror["mirror/MirrorPage.tsx"]
  app -- "each other path" --> notFound["pages/NotFound.tsx"]
```

Each page renders one `main` element with exactly one `h1`. `src/App.test.tsx` checks this for each route.

## Run it

Run each command at the repository root, after `npm install`.

```bash
npm run dev --workspace @glance/website      # dev server on http://localhost:5174
npm run build --workspace @glance/website    # writes apps/website/dist
```

The host of the build must answer an unknown path with `index.html`, because the router reads the address in the browser.

## Settings

| Setting | Default | Effect |
|---|---|---|
| `GLANCE_SERVER_ORIGIN` (environment) | `http://localhost:8080` | The dev server sends each `/api` request to this origin. |

The dev server uses port 5174 only. If the port is in use, the dev server stops with an error.

## Kiosk page

`/kiosk` is the screen at the checkout. It shows a QR code with the text `GL1 <code>`, and the glasses of the shopper read that code. Open the page in full screen on a screen with a height of 1080 px or more.

Query flags of `/kiosk`:

| Flag | Default | Effect |
|---|---|---|
| `name` | `Checkout 3` | The name of the kiosk, cut at 40 characters. |
| `store` | `Demo Market` | The name of the store, cut at 40 characters. |
| `spot` | off | The server asks for a spot check at this kiosk. `spot=0` and `spot=false` mean off. |
| `fail` | off | Each payment at this kiosk fails. `fail=0` and `fail=false` mean off. |
| `replay=1` | off | The page plays `KIOSK_RUN` of `src/kiosk/kioskRun.ts` in a loop of 24 seconds. It makes no network call. |

The page registers a kiosk, and then it follows the event stream of that kiosk:

```mermaid
sequenceDiagram
  participant K as KioskPage
  participant S as Server
  K->>S: POST /api/kiosks { name, store, spotCheck, failPayment }
  S-->>K: kioskId, token, code
  Note over K: shows the code and "Look at this code to pay"
  K->>S: GET /api/kiosks/:id/events?token=... (event stream)
  S-->>K: data: KioskEvent, the current view
  S-->>K: data: KioskEvent, for each change
```

Each event holds the whole view, and its `state` selects the text:

```mermaid
stateDiagram-v2
  [*] --> registering
  registering --> unreachable: no answer, or an answer that is not a kiosk
  unreachable --> registering: after 3 seconds
  registering --> idle: the server made the kiosk
  idle --> connected: the glasses read the code
  connected --> spotcheck: the server asks for a spot check
  spotcheck --> connected
  connected --> paid
  connected --> failed
  connected --> idle: the checkout stopped
  paid --> idle: after 10 seconds
  failed --> idle: after 10 seconds
```

The server selects each state after `idle`. The page only shows it.

- The code keeps its place and its size in each state. It is black on white in each color mode, and the page uses the light mode.
- The page shows the total of the event. It never adds prices. It shows 7 cart lines, and then the line `and <n> more items`.
- The page drops a message that is not JSON and a message that `KioskEventSchema` of `@glance/shared` rejects.
- When the stream drops, the browser opens it again. The page keeps the code and the cart, and it shows "Connection lost. Reconnecting." The first message of the new stream is the current view.
- When the server refuses the stream, the browser does not open it again. This occurs after a restart of the server, which keeps its kiosks in memory. The page then registers a new kiosk each 3 seconds until one call succeeds. The new kiosk has a new code.
- Each load of the page makes a new kiosk. The server has no call that removes one.

`src/kiosk/kiosk.css` holds the sizes. On a screen of 1920 x 1080 px the total has a font of 160 px, a row has a font of 48 px, and the code is 960 px wide. The code is never smaller than 15 cm, with its quiet zone. To measure, open `/kiosk?replay=1` at 100 percent zoom, wait for the cart, and run this in the console. It must print `[true, true, true]`.

```js
const box = (selector) => document.querySelector(selector).getBoundingClientRect();
[parseFloat(getComputedStyle(document.querySelector('.kiosk-total')).fontSize) >= 160, box('.kiosk-row').height >= 48, box('.kiosk-code').width >= 567]
```

Code for the pages that read a stream:

- `src/lib/api.ts`: `createKiosk` and `kioskEventsUrl`. `createKiosk` throws `ApiError` for a status of 400 or more, and for an answer that is not a kiosk.
- `src/lib/events.ts`: `subscribeSse` follows a stream and reports `open`, `lost`, or `closed`. `replay` plays a recorded list of events.
- `src/test/fakes.ts`: `fakeFetch` and `fakeSources` (a fake `EventSource`) for the tests.

## Checks

```bash
npm test --workspace @glance/website         # Vitest with jsdom
npm run typecheck --workspace @glance/website
npx eslint apps/website
```

`build` runs no typecheck. A type error in a test file does not stop a deployment, so run `typecheck` before each commit.

## Astryx

- The theme is the stock Neutral theme. `npx @astryxdesign/cli theme add neutral` wrote `src/astryx-themes.ts`. Do not edit that file.
- The app uses the prebuilt CSS of Astryx (`src/styles/globals.css`). It has no StyleX compiler, so `xstyle` does not work here.
- Before the first use of a component, run `npx @astryxdesign/cli component <Name>` in this folder.
- `AGENTS.md` holds the Astryx rules for agents, and the Glance rules that win over them.
- `src/test/render.tsx` exports `renderWithTheme`. Use it in each test that renders an Astryx component.
- The font of the theme loads from Google Fonts. With no internet, the system font shows.
- `main.tsx` uses no `StrictMode`. The kiosk page registers in an effect, and `StrictMode` would register two kiosks in development.
- The Astryx `Text` and `Heading` components take `className`. The kiosk sizes are plain CSS classes on them, because app CSS outside a cascade layer wins over the Astryx layers.
