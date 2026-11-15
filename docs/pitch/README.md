# Meta Glance: Pitch and Video Presentation Suite

This directory contains the canonical context documents for the Meta Glance 3-minute pitch deck and synchronized Raylight video demo for HackJunction 2026.

## The deck of the final

`Meta-Glance-pitch.pdf` is the deck of the final: pages of 1920 x 1080, in the design of the site. It follows `script.md`, the pitch script of the owner: the 12 pitch pages of the script, a team page, a recap page, and backup pages B1 to B9 for questions. It replaces the 5-slide outline of `00-master-deck.md`, which holds figures that nobody verified.

| File | Content |
|---|---|
| `Meta-Glance-pitch.pdf` | The deck |
| `script.md` | The pitch script of the owner, word for word |
| `slides/` | One PNG of each page, for the video editor |
| `notes.md` | The script per page, with the cues for the footage |
| `design.md` | The design decisions, the references, and the build steps |
| `deck.src.html` | The source of the pages; `deck.html` is the built page |
| `diagrams/` | The six diagrams, each as a standalone page |
| `assets/photos/` | The photos of the owner (see "Photo slots") |
| `assets/screens/` | Screens of the app, the kiosk page, and the HUD mockup from their replay modes, and frames of the animation |
| `assets/media/` | Team photos, the logo, the Glance code sticker, and the crops that the pages use |
| `scripts/` | The capture and build scripts |

To build again: `node docs/pitch/scripts/diagrams.mjs && node docs/pitch/scripts/build.mjs`. `design.md` has the full steps.

### Photo slots

Four pitch pages wait for a photo or a video frame of the owner. The titles and the captions are already on the page; only the image is missing. Each slot has one file with a fixed name:

| File | Page | Shot |
|---|---|---|
| `assets/photos/checkout-queue.jpg` | 3, left | A queue at a checkout belt |
| `assets/photos/one-hand-short.jpg` | 3, right | A shopper with a basket in one hand and a phone in the other |
| `assets/photos/rye-bread.jpg` | 5 and 6 | First-person, two hands hold a rye bread |
| `assets/photos/bus-door.jpg` | 11 | A bus door with a Glance code sticker |

To fill a slot:

1. Save the image as a JPEG with the name of the table in `docs/pitch/assets/photos/`. Landscape works best; the page crops it to fill the slot (`object-fit: cover`), so keep the subject near the center. The pages 5, 6, and 11 fill the whole page, so use at least 1920 x 1080 pixels there.
2. Run `node docs/pitch/scripts/build.mjs`. The build uses each file that exists and keeps the framed slot for each file that does not. Its last line lists each slot as `photo` or `slot`.

Where each photo comes from:

| File | Source | Frame |
|---|---|---|
| `checkout-queue.jpg` | The team's footage, `scanner_checkout_2.mp4` (archive 001) | 3.4 s, the sharpest frame of 1.6 to 3.6 s, cropped to the slot. A self-checkout with a shopper waiting behind, seen from the back. |
| `one-hand-short.jpg` | The team's footage, `scanner_fanta_pickup_2.mp4` (archive 002) | 8.2 s: the basket in one hand, a bottle and a handheld scanner in the other. The neighbor frames blur the scanner. |
| `rye-bread.jpg` | Not yet | It waits for the first-person footage of the glasses. |
| `bus-door.jpg` | Not yet | No footage of a bus. No online photo is in the deck yet. |

Photo credits: none. Each photo in the deck comes from the team's own footage.

For the bus page, print the sticker of `assets/media/glance-sticker.svg` (or `.png`, 1200 x 1560 pixels). It holds a real QR code with the valid Glance code `GL1 BUS4`, in the style of the kiosk page. `node docs/pitch/scripts/sticker.mjs <code>` draws it for another code. No place has the code `BUS4` today.

## Structure and Pacing

The presentation runs for strictly 180 seconds (~420 spoken words at 140 words per minute). Each beat corresponds to one presentation slide and one synchronized video scene block.

| Beat | File | Timeline | Duration | Word Budget | Core Theme |
|---|---|---|---|---|---|
| Beat 1 | [`01-beat-friction-problem.md`](01-beat-friction-problem.md) | 0:00 - 0:30 | 30s | ~70 words | Everyday manual friction, retail scanning failure, accessibility barriers |
| Beat 2 | [`02-beat-hero-poc-grocery.md`](02-beat-hero-poc-grocery.md) | 0:30 - 1:15 | 45s | ~105 words | Hero PoC: Glance tells nod buys, live kiosk payment, audio-first flow |
| Beat 3 | [`03-beat-meta-speed-advantage.md`](03-beat-meta-speed-advantage.md) | 1:15 - 1:55 | 40s | ~95 words | Meta speed wedge: zero store retrofit, software-only deployment in days |
| Beat 4 | [`04-beat-future-vision-handshake.md`](04-beat-future-vision-handshake.md) | 1:55 - 2:35 | 40s | ~95 words | Future horizon: BLE proximity, neural band handshake payment, glance-to-pay |
| Beat 5 | [`05-beat-accessibility-impact-ask.md`](05-beat-accessibility-impact-ask.md) | 2:35 - 3:00 | 25s | ~55 words | Inclusivity by design, WCAG compliance, privacy bounds, team ask |

## Master Consolidated Files

- [`00-master-deck.md`](00-master-deck.md): Complete 5-slide presentation deck with visual layouts, key bullet points, and live presenter speaker notes.
- [`00-master-script.md`](00-master-script.md): Complete 180-second continuous voiceover script with timestamp cues, camera direction, and audio earcons for Raylight.
- [`five-minute-table-pitch.md`](five-minute-table-pitch.md): 5-minute in-person table judging runbook (staging checklist, live hardware demo choreography, team roles, judge Q&A).
- [`irl-shot-list.md`](irl-shot-list.md): Actionable physical video shot list to film IRL with a smartphone/camera for intercutting with Raylight AI and screen captures.

## Technical Appendices

- [`vision-peer-payment-spec.md`](vision-peer-payment-spec.md): In-depth engineering specification for the peer money exchange protocol (BLE proximity beacons, Meta Display neural wristband sEMG neuromuscular handshake clasp detection, in-lens MRBD HUD).
- [`qa-and-objections.md`](qa-and-objections.md): Anticipated judge questions, security objections, sensor false triggers, and lighting/privacy defense.

## Agent Retrieval Routing Guide

For agentic LLM workers, video generators, and deck builders:

| If your agent needs to generate... | Read this primary file: | Read this supporting file: |
|---|---|---|
| Full slide deck content or PDF slides | [`00-master-deck.md`](00-master-deck.md) | Targeted beat files (`01` through `05`) |
| 5-minute table pitch & live hardware demo script | [`five-minute-table-pitch.md`](five-minute-table-pitch.md) | [`00-master-deck.md`](00-master-deck.md) |
| Raylight video prompts or full voiceover track | [`00-master-script.md`](00-master-script.md) | Targeted beat files (`01` through `05`) |
| Specific video scene prompts for Beat N | `0<N>-beat-*.md` | [`00-master-script.md`](00-master-script.md) |
| Physical camera shot list to film IRL | [`irl-shot-list.md`](irl-shot-list.md) | [`02-beat-hero-poc-grocery.md`](02-beat-hero-poc-grocery.md) |
| Peer money exchange or neural band tech details | [`vision-peer-payment-spec.md`](vision-peer-payment-spec.md) | [`04-beat-future-vision-handshake.md`](04-beat-future-vision-handshake.md) |
| Judge Q&A answers or edge-case handling | [`qa-and-objections.md`](qa-and-objections.md) | [`../research/2026-11-13-accessibility-and-trust.md`](../research/2026-11-13-accessibility-and-trust.md) |
| Retailer business model or deployment economics | [`03-beat-meta-speed-advantage.md`](03-beat-meta-speed-advantage.md) | [`qa-and-objections.md`](qa-and-objections.md) |

## Output Style Rules

All presentation copy and video prompts must follow the repository anti-slop guidelines:
1. No emojis and no em dashes.
2. Active voice and sentences under 20 words where possible.
3. Accurate hardware distinction: Ray-Ban Meta Gen 2 is audio-first (spatial audio and earcons); visual overlays are explicitly labeled "Phone companion HUD / Audience visualization". Meta Display in-lens rendering is attributed to MRBD (`apps/display-pow`).
