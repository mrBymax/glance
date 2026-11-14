# Display mock of the site

`public/hud` holds the Display HUD of Meta Glance, built for the site: the app `apps/display-pow` of the branch `feat/barcode-lookup`, in its recorded mode, with the Display toolkit `@wearables-ui-toolkit/mrbd` 130.33.0. The section "The same loop, in the lens." shows it in a sandboxed frame (`src/sections/Display.tsx`).

The site build only copies `public/hud`. It does not need the files below, the toolkit, or the other branch.

## Where it comes from

The build used these files of `feat/barcode-lookup` at commit `12d2d50adf38816c31ba178158aead459418281a`, unchanged:

- `apps/display-pow/src/HudPage.tsx`, `feed.ts`, `hudState.ts`, `app.css`, `vite-env.d.ts`, and `recordings/mainTake.json`
- each file of `packages/shared/src` that is not a test, as `shared/`

The files of this folder are the only new ones:

| File | Content |
|---|---|
| `site-main.tsx` | The entry. It renders `HudPage` in the toolkit `App`, as `main.tsx` of the app does. It takes the commands `play`, `pause`, and `still` of the site page, and in each round of the recording it presses Add for the rye bread and Skip for the oat drink, in place of a nod and a shake. |
| `no-focus.ts` | Turns `focus()` into a no-op in the frame: the toolkit moves the focus to Add when a product waits, and in a frame that call takes the focus from the page. |
| `clock.ts` | A clock that the page can pause. It replaces `setTimeout` before `HudPage` loads, so `playRecording` runs on it unchanged. |
| `index.html` | The page of the frame, 600 x 600. It holds an element with the ID `uit-noto-sans-font`, so the toolkit adds no link to Google Fonts. |
| `noto-sans.css` | Noto Sans, the font of the toolkit, from `@fontsource/noto-sans`, in the build. |
| `vite.config.mjs` | The build: a relative base, `@glance/shared` as `./shared`, and the output folder from `HUD_OUT_DIR`. |

## Build it again

1. Make an empty folder outside the repository.
2. Copy into it the files of the list above from `feat/barcode-lookup`, and the files of this folder.
3. In that folder, run `npm init -y`, then `npm install @wearables-ui-toolkit/mrbd@130.33.0 react@19.3.1 react-dom@19.3.1 zod@4.6.7 @fontsource/noto-sans@5 vite@8.3.8 @vitejs/plugin-react@6.3.0`.
4. Run `HUD_OUT_DIR=<path of apps/site/public/hud> npx vite build`.
5. With `npm run dev` of the site, run `node scripts/capture-hud-still.mjs` to write the still of the key state.

## The commands of the site page

The page and the frame talk with `postMessage`. The frame is sandboxed with `allow-scripts allow-same-origin`: the build loads its script as a module, which a frame with an opaque origin cannot fetch from a host that sends no CORS header. The frame is `inert`: it takes no focus and no input.

| Message | From | Effect |
|---|---|---|
| `{ glanceHud: 'ready' }` | frame | The HUD is on screen. The page hides the still. |
| `{ glanceHud: 'play' }` | page | The clock runs: the section is in view and motion is allowed, or the visitor pressed Play. |
| `{ glanceHud: 'pause' }` | page | The clock stops: the section is out of view, or the visitor pressed Pause. |
| `{ glanceHud: 'still' }` | capture script | The HUD jumps to 6 seconds, the rye bread that waits for the nod, and stops. |
