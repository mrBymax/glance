# Design of the pitch deck

This file holds the decisions behind `deck.src.html` and the references for them. `notes.md` holds the speaker notes. The build is in "Build" below.

## Brief

A 16:9 deck for the final of the Meta challenge at Junction 2026, and the base of a video that cuts between pages and real footage. The deck follows `script.md`, the pitch script of the owner: 12 pitch pages with the wording of the script, a team page, a recap page, and backup pages B1 to B9 for the questions of the judges. The design language is that of the site and the app.

The first version of the deck (18 slides in the order title, problem, solution, why now, use case, business model, competition, go-to-market, vision, team, end) is in the history of this folder. Its best pages are the backup pages now.

## Research

| Source | What it gave the deck |
|---|---|
| Kevin Hale, "How to Design a Better Pitch Deck", Y Combinator blog (read on 2026-11-15) | Legible, simple, obvious. One idea for each slide, large type near the top, the conclusion written on the slide, no dense diagrams, no visual essay. Hale advises against screenshots; the deck keeps them because they are the proof, but each one is large, cropped to one state, and the headline states what it proves. |
| Refero style "Chronicle: outcomes on a stage" (`7d81f47c-78f8-4c0f-9e5a-f12d2653c5f2`) | A pale gray canvas, near-black type, black for the one action, and finished output shown large on a stage. An unequal split: a short claim beside a large artifact. A soft shadow only on the active artifact. Strong color only inside the artifact. |
| Refero styles "Augen" (`91a29339-e98b-4169-9d0d-1db906d69170`) and "Electronic Materials Office" (`467d0d59-a87d-4d55-93c9-b05889ccc552`), previews only | A device or an object on a dark stage, with little text. Used for the title and the end slide only. |
| Refero screens of comparison tables (Intercom `5accbc5d-4a51-413d-a1d9-814bd8f33dd4`, Sunsama `eb52c33b-ccff-4f8c-a9ea-48d155d44aea`) | Rows of products against a few true axes, check marks, our row lifted on a white sheet. |
| Refero screens of roadmaps (Todoist `aefd059f-b01c-457b-8d49-8418981fe97b`, GitHub `e623b6fd-db19-4a7b-b13f-4b1f79aab3bb`) | A path as a few stages, each with what it needs, not a dated Gantt chart, because no date is agreed. |
| `apps/site/docs/design.md` | The tokens, the font, the logo, the bezels, the dark stage of the hero, the rule "colour only for a state", and the reference lock of the site. |
| The `diagram-design` skill | The grammar of every diagram: orthogonal connectors with r=8 corners, labels on an opaque mask with a gap, one or two focal elements, a legend strip, the complexity budget, the accessible SVG contract. |

## Reference lock

- Primary direction: the site and the app, the stock Neutral theme of Astryx. Ink on the gray canvas `#f1f1f1`, white cards, black `#1b1b1b` for the one focal element, Optimistic VF, Lucide icons.
- Preserve: (1) one message as the headline of each slide, 64 px, weight 650; (2) one large numeral where a number is the point (2.2 bn, 300 to 430 ms, 7 fps, 30 Hz, 1.2 s); (3) colour only for a state: green for a check and for "Built", yellow only inside the real app screen; (4) real screens of the app and the kiosk in plain black bezels; (5) dark stages only for the title, the end, the spoken lines, and the footage slots.
- Borrow only: the unequal stage of Chronicle (claim left, artifact right) on the title and the use-case slides.
- Reject: stock photos, generated pictures, clip-art glasses, fake glossy 3D, gradients on cards, a blue accent (the blue of the mark belongs to the animation asset), text under 24 px, a slide with two ideas.

## Decision ledger

| Decision | Source | Why |
|---|---|---|
| 1920 x 1080, 96 px side margins, headline 64 px, body 28 to 34 px, nothing under 24 px | Owner brief, Hale ("legible") | The deck is projected and cut into a video at 1080p. |
| Kicker over each headline, "Our protocol: a use case, n of 8" | Owner structure | The use case runs over 8 slides; the kicker keeps the place in the story. |
| Title and end on a dark rounded stage with the frames of the project animation | Site hero, `assets/animation` | The same object as the site: the mark at the end, the Glance code at the start. Rendered from the GLB with the lights of the site, no other 3D. |
| Real screens from the replay modes of the app branch | Refero rule on imagery, site decision ledger | Each frame is true: the phone app (`?replay=1&ready=1`), the kiosk page (`/kiosk?replay=1`), and the Display HUD mockup. |
| Footage slots as dark 16:9 frames with corner marks and a "Footage" tag | Owner brief | The video cuts to real recordings there. The test frames in `logs/frames` show a venue and people, so they are not used. |
| The loop as a "Steps" diagram with a dashed return | `diagram-design` type Steps | Four ordered stages; the Loop type needs five to eight stations and a hub, which this loop does not have. The nod is the focal step. |
| The protocol as an "Architecture" diagram, five parts, one focal path | `diagram-design` type Architecture, `docs/protocol.md`, the site diagram | The code that the camera sees is the one flow that is not a network message, so it is the dashed ink path. The server is the focal node. |
| The store demo as a storyboard of four moments with the spoken line of each | `diagram-design` type User journey | The line that the wearer hears is the interface, so it is the content of each panel. |
| The head window on an honest time axis, with an example line of 3 s | `diagram-design` type Timeline, `apps/mobile/android/README.md` | Shows why a nod during the line counts for a product and never for a payment. The example length is said on the slide. |
| Competition as a table, not a quadrant | `diagram-design` rule "if a table says the same, pick the table", Refero comparison screens | Four yes or no axes over seven ways to pay; a quadrant would hide three of the axes. "not stated" where a source says nothing. |
| Go-to-market as three stages with what each one needs, marked "a plan" | `diagram-design` type Steps, owner truth rules | No date and no partner exist, so the path has no time axis. |
| The future as a map of places around the loop; only the checkout is solid and marked "Built" | `docs/protocol.md` ("Built today, and enabled by the protocol") | The dashed cards are what the protocol enables; the slide says "not built" in its kicker and in its footer. |
| The business slide as a layer stack and four reasons, the ask on a black band | Owner brief | The ask is the one call to action of the deck, so it takes the black of the one action. |
| What the glasses say, in the captions window of the app (pages 1, 2, 5, 6, 7, 11) | The phone UI (`apps/mobile/ui`, the dark captions window), owner brief | The captions read as speech. The earlier line stays above in gray, as the app shows it, on each "same page, new caption" pair. |
| Photo slots for the owner's photos (pages 3, 5, 6, 11), with the titles and captions already laid out | Owner brief: no stock or generated image | A missing photo shows as a framed dark slot with the shot description and the file name. `build.mjs` swaps in `assets/photos/<name>.jpg` when it exists. |
| The Glance code sticker drawn as a real QR code (`GL1 BUS4`), error correction M and a quiet zone of 4 modules | `apps/website/src/kiosk/qr.ts`, `packages/shared/src/kioskCode.ts` | It can be printed for the bus shot. A check of the PNG against the QR matrix found no wrong module. |
| Pages 7 and 8 from the replay of the kiosk page | `apps/website/src/kiosk/kioskRun.ts` | The replay shows Checkout 3, Demo Market, two items, and 4.49 EUR, waiting for the nod and then paid. The capture script renames the rye bread of the replay to Fanta (2.60) and hides the demo note, so the page matches the script. |
| The head window drawn as built now: it opens 300 ms after the line of each prompt starts | `apps/mobile/android/README.md` (the head window, after commit `2a82c11`) | The first deck drew the older rule (1.2 s, product prompts only). |

## Tokens

| Role | Value |
|---|---|
| Canvas | `#f1f1f1` |
| Card | `#ffffff`, inset hairline `rgba(0,0,0,0.08)` |
| Text, secondary text | `#000000`, `#474747` |
| Focal, bezel, dark stage | `#1b1b1b` |
| Success (checks, "Built") | `#2f7d33` text, `#198100` fill |
| Radius | 28 px for cards and stages, 12 px inside |
| Shadow | only on the device bezels: the `--shadow-high` of Astryx |
| Font | Optimistic VF from `apps/site/public/fonts`, weights 400 to 700; `DRKM` 1 on dark grounds |

## Build

The deck is HTML and CSS, printed by headless Chrome. Each script names its tools in its header.

1. `scripts/capture-app.mjs`: the screens of the phone app, the kiosk page, and the HUD mockup, from the replay modes of the app checkout (three Vite dev servers on ports 18431 to 18433). No server and no vendor call.
2. `scripts/capture-hero.mjs`: frames of the project animation (`assets/animation`), rendered with SwiftShader.
3. `scripts/prepare-assets.mjs`: the team photos, the pixelated photo, and the logo of the site build, and the crops of the screens, into `assets/media`.
4. `scripts/diagrams.mjs`: the six diagrams as standalone pages in `diagrams/`. `scripts/sticker.mjs`: the Glance code sticker in `assets/media`.
5. `scripts/build.mjs`: inlines the icons, the diagrams, and the photos of `assets/photos` (or their slots) into `deck.html`, checks that nothing leaves its slide and that no text is under 24 px, and writes `Meta-Glance-pitch.pdf` and `slides/NN-name.png`.

The PDF keeps the text as text and the diagrams as vectors. Chrome embeds the variable font as Type 3 glyphs.

Checks of the diagrams: `verify_geometry.py` of the skill finds nothing in each one. `self_check.py` flags one thing in each page: the `url()` of the font file. It is the local font of the site, as `apps/site` uses it; the deck inlines the SVG and loads the same file.
