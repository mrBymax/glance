# Overnight status

## Summary

Iteration 1 started on 2026-11-14. Nothing works yet. Branch: `feat/overnight-build`.

## Log of attempts

None yet.

## Tasks

Status values: `todo`, `done`, `blocked`, `morning`.

| Plan | Task | Title | Phase | Lane | Status | Commit |
|---|---|---|---|---|---|---|
| 0 | 1 | Workspace and package skeleton | A | main | todo | |
| 0 | 2 | Money, timing, and kiosk code | A | main | todo | |
| 0 | 3 | Profile, catalog, and cart | A | main | todo | |
| 0 | 4 | Events, device messages, and the frame codec | A | main | todo | |
| 0 | 5 | Bridge, REST shapes, and the fixture check | A | main | todo | |
| 1 | 1 | Server package, config, bus, health (C2) | B | server | todo | |
| 1 | 2 | Catalog index and dev catalog (C2) | B | server | todo | |
| 1 | 3 | Rules: state, sightings, glance prompts (C2) | B | server | todo | |
| 1 | 4 | Rules: answers (C2) | B | server | todo | |
| 1 | 5 | Rules: checkout (C2) | B | server | todo | |
| 1 | 6 | Rules: session, device, information, replays (C2) | B | server | todo | |
| 1 | 7 | Speech text (C2) | B | server | todo | |
| 1 | 8 | Storage (C2) | B | server | todo | |
| 1 | 9 | Session runtime and registry (C2) | B | server | todo | |
| 1 | 10 | REST and server-sent events (C2) | B | server | todo | |
| 1 | 11 | Device socket (C2) | B | server | todo | |
| 1 | 12 | Fake recognition (C2) | B | server | todo | |
| 1 | 13 | Recognition request (C2) | B | server | todo | |
| 1 | 14 | Recognition worker (C2) | B | server | todo | |
| 1 | 15 | Speech clips (C2) | B | server | todo | |
| 1 | 16 | Kiosk, mock payment, receipt (C2) | B | server | todo | |
| 1 | 17 | Token checks (C3) | D | server | todo | |
| 1 | 18 | States that the server reports (C3) | D | server | todo | |
| 1 | 19 | No stored frame (C3) | D | server | todo | |
| 1 | 20 | Catalog check and seed (C3) | D | server | todo | |
| 1 | 21 | Replay tool (C3) | D | server | todo | |
| 1 | 22 | Deployment on Vultr with HTTPS (C3) | D | server | todo | |
| 1 | 23 | Allergen guard (Extra 1) | E | server | todo | |
| 1 | 24 | Budget guard (Extra 2) | E | server | todo | |
| 1 | 25 | Answer for look-alike products (Extra 3) | E | server | todo | |
| 1 | 26 | Ask about a product (Extra 5) | E | server | todo | |
| 1 | 27 | Fingerprint above 50 EUR, server part (Extra 6) | E | server | todo | |
| 1 | 28 | Voice in Italian (Extra 7) | E | server | todo | |
| 1 | 29 | Spot check (Extra 8) | E | server | todo | |
| 1 | 30 | Sharp second look (Extra 9) | E | server | todo | |
| 2 | 1 | Gradle project, motion CSV, probe screen (C1) | B | android | todo | |
| 2 | 2 | Probe link: registration, session, stream, frames (C1) | B | android | todo | |
| 2 | 3 | Probe capabilities: Motion, Inputs, Speech, audio, still (C1) | B | android | todo | |
| 2 | 4 | Probe run on the glasses, results file (C1) | - | android | morning | |
| 2 | 5 | Contract mirror and frame codec (C2) | B | android | todo | |
| 2 | 6 | Kiosk code parser and dwell (C2) | B | android | todo | |
| 2 | 7 | Frame selection and image math (C2) | B | android | todo | |
| 2 | 8 | Head gesture detector (C2) | B | android | todo | |
| 2 | 9 | Speech queue (C2) | B | android | todo | |
| 2 | 10 | Prompt tracker and head input (C2) | B | android | todo | |
| 2 | 11 | State mapping and stop causes (C2) | B | android | todo | |
| 2 | 12 | REST client, device socket, fake server (C2) | B | android | todo | |
| 2 | 13 | Bridge, WebView host, placeholder page (C2) | B | android | todo | |
| 2 | 14 | Pipeline and audio adapters (C2) | B | android | todo | |
| 2 | 15 | Session controller and the spine check (C2) | B | android | todo | |
| 2 | 16 | Setup flow (C3) | D | android | todo | |
| 2 | 17 | Mock menu, device and error states (C3) | D | android | todo | |
| 2 | 18 | Face blur and crop (C3) | D | android | todo | |
| 2 | 19 | Haptics and pocket mode (C3) | D | android | todo | |
| 2 | 20 | Signed demo APK (C3) | D | android | todo | |
| 2 | 21 | Volume keys as yes and no (Extra, core if the probe selects it) | E | android | todo | |
| 2 | 22 | Double tap and swipe (Extra) | E | android | todo | |
| 2 | 23 | Voice commands (Extra) | E | android | todo | |
| 2 | 24 | Fingerprint above 50 EUR (Extra 6) | E | android | todo | |
| 2 | 25 | Sharp second look (Extra 9) | E | android | todo | |
| 3 | 1 | Website scaffold with Astryx and a router (C2) | B | web | todo | |
| 3 | 2 | Phone UI scaffold and the 48 px rules (C2) | B | web | todo | |
| 3 | 3 | Bridges (C2) | B | web | todo | |
| 3 | 4 | UI state and reducer (C2) | B | web | todo | |
| 3 | 5 | Session screen (C2) | B | web | todo | |
| 3 | 6 | Kiosk page (C2) | B | web | todo | |
| 3 | 7 | Setup screen (C3) | D | web | todo | |
| 3 | 8 | Checkout sheet and receipt (C3) | D | web | todo | |
| 3 | 9 | Settings sheet (C3) | D | web | todo | |
| 3 | 10 | State banner and status row (C3) | D | web | todo | |
| 3 | 11 | A phone button for each action, and haptics (C3) | D | web | todo | |
| 3 | 12 | Pocket mode (C3) | D | web | todo | |
| 3 | 13 | Mirror page (C3) | D | web | todo | |
| 3 | 14 | Debug panel (C3) | D | web | todo | |
| 3 | 15 | Accessibility checks of spec section 10 (C3) | D | web | todo | |
| 3 | 16 | Allergen and diet settings, and the warning on the card (Extra 1) | E | web | todo | |
| 3 | 17 | Budget setting and the warning (Extra 2) | E | web | todo | |
| 3 | 18 | Look-alike message (Extra 3) | E | web | todo | |
| 3 | 19 | Microphone button for a question (Extra 5) | E | web | todo | |
| 3 | 20 | Fingerprint state at checkout (Extra 6) | E | web | todo | |
| 3 | 21 | Language switch (Extra 7) | E | web | todo | |
| 3 | 22 | Spot check on the kiosk and on the phone (Extra 8) | E | web | todo | |
| 4 | 1 | Catalog content (C3) | D | web | todo | |
| 4 | 2 | Landing content and the copy guard (C3) | D | web | todo | |
| 4 | 3 | Landing page (C3) | D | web | todo | |
| 4 | 4 | Privacy page (C3) | D | web | todo | |
| 4 | 5 | Run sheet for the demo and the shoot (C3) | D | web | todo | |
| 4 | 6 | HUD project, state, and feeds (Extra 4) | E | hud | todo | |
| 4 | 7 | HUD screen, verification, and the simulator clip (Extra 4) | E | hud | todo | |
| 4 | 8 | Late content and the publish check (C3) | - | main | morning | |
| I | 1 | Integration: server and Kotlin client | C | main | todo | |
| I | 2 | Integration: server and web pages | C | main | todo | |
| I | 3 | Integration: app with mock glasses on the phone | C | main | todo | |
| F | 1 | Draft pull request into main with the status table | end | main | todo | |
