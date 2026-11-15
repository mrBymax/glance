# Split-Screen Video Mockup PoC

Browser player that pairs a 9:16 real-life clip on the left with an Android smartphone mockup and a separate Backend & Glasses Pipeline panel on the right inside a 16:9 canvas.

## Run locally

Start a static HTTP server from the repository root so the `media` symlink resolves:

```bash
python3 -m http.server 8765
```

Open `http://localhost:8765/assets/video-mockup/` in your browser. Press `Space` to play or pause, `R` to restart, and `H` to hide the top toolbar for recording.

If the video does not load (for example when opening `index.html` directly over `file://`), click **Load Video File** and select `../video_materials/glance_cereal_pickup.mp4`.

## Architecture

- `clips/cerealPickup.js`: Declarative timeline manifest for `glance_cereal_pickup.mp4` (beats, product metadata, speech timestamps, and IMU nod timing).
- `engine.js`: Pure `computeMockupState(clip, rawTime)` function that maps any timestamp to a normalized state object.
- `skins/`: Visual renderers that mount inside the phone screen (`#phone-screen`) and consume the normalized state via `{ id, name, mount(container), render(state), unmount() }`. Default skin `glanceAppSkin.js` reproduces `@glance/phone-ui` (`SessionScreen.tsx`, `PocketMode.tsx`, `CheckoutSheet.tsx`, `SetupScreen.tsx`) from PR #7 (`origin/feat/overnight-build`) with `@astryxdesign/theme-neutral` light/dark tokens.
- `app.js`: Playback clock, scrubber, beat jumps, live skin switcher, layout switcher, and separate right-hand inspector (`#backend-inspector`) that toggles between the 4-panel Pipeline view and the PR #7 `MirrorPage` + `HudPage` companion views.

## Layout modes

Use the **Layout** selector in the toolbar for combined playback or standalone recording:

- `Split: Video + Phone + Backend (16:9)`: Real-life clip alongside the Android phone and live backend panel.
- `Split: Video + Phone Only (16:9)`: Real-life clip alongside the Android phone alone.
- `Stage: Phone + Backend (Full)`: Full-width view of the Android phone next to a 2x2 backend dashboard.
- `Phone Mockup Only (Full)`: Centered Android phone mockup alone.
- `Backend View Only (Full)`: Full 2x2 Backend & Glasses Pipeline dashboard for separate recording.

## Use app screenshots per beat

Select `2. App Screenshots (Per Beat)` in the **Skin** dropdown to display static screenshots inside `#phone-screen` for each phase (`scanning`, `detecting`, `pending`, `confirmed`, `added_idle`):

1. Place PNG files in `assets/video-mockup/screenshots/<phase>.png`, or
2. Drag PNG files onto the phone screen (or click **Load Screenshot for Beat**). Single files bind to the active phase; files named after a phase (such as `pending.png` or `confirmed.png`) bind automatically.

## Swap the visual design

To replace the mockup appearance without touching timeline timing:

1. Duplicate `skins/customSlotSkin.js` (or edit `skins/shelfEdgeSkin.js`).
2. Keep the `{ id, name, mount, render, unmount }` object shape.
3. Import and add your skin to `SKINS` in `app.js`.

## Add another clip

1. Create a new manifest in `clips/` with the same structure as `clips/cerealPickup.js`.
2. Point `app.js` at the new manifest.
