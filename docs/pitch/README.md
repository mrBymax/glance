# Meta Glance: Pitch and Video Presentation Suite

This directory contains the canonical context documents for the Meta Glance 3-minute pitch deck and synchronized Raylight video demo for HackJunction 2026.

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
- [`irl-shot-list.md`](irl-shot-list.md): Actionable physical video shot list to film IRL with a smartphone/camera for intercutting with Raylight AI and screen captures.

## Technical Appendices

- [`vision-peer-payment-spec.md`](vision-peer-payment-spec.md): In-depth engineering specification for the peer money exchange protocol (BLE proximity beacons, Meta Display neural wristband sEMG neuromuscular handshake clasp detection, in-lens MRBD HUD).
- [`qa-and-objections.md`](qa-and-objections.md): Anticipated judge questions, security objections, sensor false triggers, and lighting/privacy defense.

## Agent Retrieval Routing Guide

For agentic LLM workers, video generators, and deck builders:

| If your agent needs to generate... | Read this primary file: | Read this supporting file: |
|---|---|---|
| Full slide deck content or PDF slides | [`00-master-deck.md`](00-master-deck.md) | Targeted beat files (`01` through `05`) |
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
