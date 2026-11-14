# Meta Glance Pitch and Video Context Documentation - Design Document

- Date: 2026-11-14
- Status: Ready for Team Approval
- Topic: Context documentation architecture for 3-minute pitch deck and synchronized Raylight video demo
- Branch: `feat/hackathon_context`

## 1. Intent and Why

Meta Glance provides an intuitive, hands-free interaction protocol for Meta AI glasses. The team is competing in the Meta challenge at HackJunction 2026 ("AI Glasses for Everyone, Everyday").

The goal of this work is to establish structured, modular context documents that feed agentic tools (Raylight prompt generators, slide builders) and human presenters. These documents will directly drive:
1. A 3-minute pitch deck (PDF and presentation slides).
2. A 3-minute video demo generated with Raylight (or agentic video tooling), matching the slides 1:1 in narrative, pacing, visual progression, and voiceover script.
3. Rapid information retrieval across the repository so that coding agents, video generators, and presentation builders retrieve exact, high-density context without context-window overflow.

### Core Narrative Strategy
The pitch rests on three pillars:
- **The Working Hero (PoC):** Hands-free grocery shopping ("Glance tells, nod buys"). Real hardware (Ray-Ban Meta Gen 2), real DAT SDK integration, instant tangible utility today.
- **The Strategic Wedge for Meta:** Implementation velocity. Meta can roll out this everyday retail protocol from 0 to 1 in days because it requires zero store ceiling sensor retrofits (unlike Amazon Just Walk Out) and uses existing Ray-Ban Meta hardware and standard retail kiosk screens.
- **The Future Horizon (Protocol Expansion):** Demonstrates team velocity, deep platform understanding, and long-term vision. The same hands-free interaction language extends to social commerce: peer money exchange using phone/glasses BLE proximity beacons, Meta Display neural wristband (sEMG) handshake detection, and glance-to-pay at POS terminals.

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- G1. Create a modular beat-by-beat documentation directory (`docs/pitch/`) partitioned by the 180-second presentation timeline.
- G2. Maintain 1:1 synchronization between slide deck content and Raylight video scene directions (shot prompts, visual descriptions, voiceover scripts).
- G3. Deliver a dedicated technical specification for future vision protocols (`vision-peer-payment-spec.md`): BLE proximity beacon detection, Meta Display neural wristband sEMG handshake gesture mechanics, in-lens HUD confirmations, and dual-party cryptographic verification.
- G4. Deliver a comprehensive Q&A and objections document covering privacy, accidental payments, lighting/compression, and accessibility.
- G5. Update the top-level `docs/README.md` to act as an agentic retrieval index mapping specific queries to targeted document paths.

### Non-Goals
- Rendering the final video binary (MP4) or exporting the finished presentation PDF in this branch.
- Modifying production client or server code (`apps/`, `packages/`).
- Expanding beyond the 3-minute presentation limit.

### Anti-Goals
- Content drift between the video script and the pitch slides.
- Hand-waving the future vision (e.g. describing handshake payments without explicit sEMG neuromuscular activation patterns, BLE RSSI constraints, and fallback authentications).
- Monolithic documents exceeding token budgets of automated video or presentation agents.

## 3. Constraints

| Constraint | Source | Impact |
|---|---|---|
| 3-minute strict limit (180 seconds) | Hackathon presentation rules | Pacing allocates exact seconds per beat (30s, 45s, 40s, 40s, 25s; ~420 words total at 140 wpm). |
| Raylight video generation format | Production tool requirements | Each video beat needs explicit visual prompts, camera movement, and timed voiceover text. |
| Meta challenge judging criteria | Junction 2026 (`CHALLENGE.md`) | Must explicitly address Creativity (25%), Technical execution (25%), Real-world feasibility (25%), and Accessibility/trust (25%). |
| Hardware availability | Team testbed | 1x Ray-Ban Meta Gen 2, 1x Meta Display with neural wristband, Android test devices. |
| Anti-slop writing rules | Repository skill (`anti-slop`) | No emojis, no em dashes, active voice, concise sentences, professional tone. |

## 4. Approaches Considered

### Approach 1: Modular Beat-by-Beat Directory (`docs/pitch/`) [Chosen by User]
Partition the presentation into individual beat files matching each time block, supplemented by consolidated master files (`00-master-deck.md`, `00-master-script.md`) and dedicated deep-dive appendices (`vision-peer-payment-spec.md`, `qa-and-objections.md`).
- *Pros:* Agentic tools can ingest isolated, high-density context for specific slides or video clips without prompt truncation or noise.
- *Cons:* Requires disciplined cross-linking to prevent divergence.

### Approach 2: Dual Master Files (`docs/presentation/`)
Two monolithic documents: one for the slide deck and one for the video script, with an appendix for future vision.
- *Pros:* Easy for human continuous reading.
- *Cons:* Heavy context window load for automated agentic video tools generating individual scenes; higher risk of hallucinated timing.

### Approach 3: Flat Agent Retrieval Directory (`docs/context/`)
A flat collection of topic notes without sequential presentation numbering.
- *Pros:* Simple flat layout.
- *Cons:* Loses chronological pacing and explicit scene-to-slide mapping.

The team selected Approach 1.

## 5. Architectural Calls and Decisions

1. **Hardware Modality (Audio vs HUD):**
   - The grocery PoC on Ray-Ban Meta Gen 2 is audio-first (spatial voice prompts, earcon chimes). Visual overlays shown in the video and slides are explicitly labeled as "Phone companion HUD / Audience visualization".
   - The future vision explicitly integrates the Meta Display (`apps/display-pow`), rendering native in-lens HUD prompts via `@wearables-ui-toolkit/mrbd`.
2. **Handshake Gesture Sensor Modality:**
   - Peer money exchange detects mutual proximity via phone/glasses BLE advertising beacons (RSSI < 1m).
   - Handshake confirmation is sensed via the **Meta Display neural wristband (sEMG neuromuscular sensing)**, registering the distinctive wrist extensor/flexor activation profile of a handshake grip.
   - Confirmation is displayed natively in the Meta Display's in-lens HUD and signaled with an audio earcon.
3. **Video Footage Sourcing:**
   - Beat 2 provides dual-track guidance: (a) complete Raylight generative AI prompt schemas for end-to-end synthetic video generation, and (b) physical camera shot lists for splicing in real hardware prototype recordings.
4. **Presentation Delivery Model:**
   - `00-master-script.md` provides a continuous, standalone 180-second narration track (~420 words) for the autonomous Raylight video submission.
   - `00-master-deck.md` provides synchronized slide layouts, visual asset pointers, and live presenter speaker notes.

## 6. Directory Structure and File Inventory

```text
docs/
├── README.md                                 # Master documentation index and agent retrieval map
├── research/                                 # Existing domain research (accessibility, DAT, UI)
├── superpowers/                              # Existing engineering specs and plans
└── pitch/                                    # Pitch and video presentation suite
    ├── README.md                             # Pitch index, pacing matrix, and agent retrieval instructions
    ├── 00-master-deck.md                     # Complete slide deck (all slides, visual assets, presenter notes)
    ├── 00-master-script.md                   # Complete 3-minute Raylight script (timed VO and visual cues)
    ├── 01-beat-friction-problem.md           # 0:00 - 0:30 (Everyday friction, retail scanning failure, accessibility)
    ├── 02-beat-hero-poc-grocery.md           # 0:30 - 1:15 (Glance tells nod buys, live kiosk flow, dual shotlist/prompts)
    ├── 03-beat-meta-speed-advantage.md       # 1:15 - 1:55 (Zero retrofit, 0-to-1 in days for Meta, standard POS)
    ├── 04-beat-future-vision-handshake.md    # 1:55 - 2:35 (BLE beacon, neural band handshake, in-lens HUD, glance-to-pay)
    ├── 05-beat-accessibility-impact-ask.md   # 2:35 - 3:00 (WCAG compliance, pilot path, team ask)
    ├── vision-peer-payment-spec.md           # Technical deep-dive: BLE proximity + neural wristband sEMG handshake
    └── qa-and-objections.md                  # Judge defense: privacy, fraud, sEMG accuracy, lighting, accessibility
```

## 7. Beat Breakdown and Narrative Flow

### Beat 1: The Everyday Friction (0:00 - 0:30 | 30s | ~70 words)
- **Problem Statement:** Everyday tasks force constant manual interaction. In retail, holding a basket while managing a phone or scanning gun creates physical friction. For blind or motor-impaired shoppers, self-checkout kiosks and product labels are almost completely inaccessible.
- **Why Prior Tech Failed:** Store ceiling cameras (Amazon Just Walk Out) proved economically unviable and technically fragile. Handheld scanners shift the physical burden onto shoppers' hands.
- **Slide 1 Layout:** High-contrast problem comparison: Full-hands retail friction and kiosk inaccessibility versus an unencumbered first-person viewpoint.
- **Raylight Visual Prompt:** First-person POV looking down at full hands holding grocery items; struggling to pull a phone from a pocket; visual overlay highlighting friction points.

### Beat 2: Meta Glance PoC - Grocery Shopping (0:30 - 1:15 | 45s | ~105 words)
- **Core Mechanism:** "Glance tells, nod buys." The shopper holds an item and looks at it. Spatial audio announces the item name and price privately. A natural nod adds it to the digital cart. At checkout, the shopper glances at the kiosk QR code and nods to finalize payment.
- **Technical Architecture:** Thin Android client connecting via Meta DAT SDK, streaming frames to FastAPI/Gemini vision service, with instant audio synthesized via ElevenLabs and cart synchronization on MongoDB Atlas.
- **Slide 2 Layout:** Product loop diagram showing the 3-step interaction cycle (Glance -> Hear -> Nod) alongside phone mirror and kiosk screens.
- **Visual Sourcing:** Dual guidance:
  - Raylight generative prompt: First-person POV looking at an apple, hearing clean audio cue "Honeycrisp Apple, 1.20 EUR", camera dips slightly in a natural nod, "+1 Added to Cart" indicator, walking to kiosk screen, glancing at QR, nodding to complete.
  - Testbed recording shot list: Live video capture script matching real items (oat milk, rye bread) from `apps/server` catalog and laptop kiosk screen.

### Beat 3: Meta's 0-to-1 Speed Advantage (1:15 - 1:55 | 40s | ~95 words)
- **The Pitch Hook:** Why Meta wins: Meta can deploy this protocol immediately. Competitors require expensive sensor rollouts or speculative hardware. Meta Glance runs today on Ray-Ban Meta Gen 2 glasses and standard retail POS systems.
- **Zero Store Retrofit:** Retailers install no ceiling cameras and buy no custom scanners. The kiosk screen displays a standard dynamic QR code, and the phone handles the compute.
- **Slide 3 Layout:** Timeline and deployment comparison: Amazon Just Walk Out (months of installation, thousands of dollars per store) vs. Meta Glance (software update, standard QR code, live in days).
- **Raylight Visual Prompt:** Motion graphic contrasting an expensive store-wide ceiling camera grid with a lightweight software link connecting existing Ray-Ban Meta glasses to a standard point-of-sale monitor.

### Beat 4: The Future Horizon - Neural Band Handshake & Glance-to-Pay (1:55 - 2:35 | 40s | ~95 words)
- **Extending the Protocol:** The hands-free protocol becomes Meta's foundational physical interaction language across social and daily commerce.
- **Peer Exchange Mechanics:**
  1. Two people wearing Meta glasses approach each other.
  2. Phone/glasses BLE advertising beacons establish mutual proximity (RSSI thresholding < 1 meter).
  3. Looking at the peer resolves recipient identity and displays a transaction confirmation in the Meta Display in-lens HUD.
  4. A natural handshake gesture is verified through the Meta Display neural wristband (sEMG neuromuscular pattern matching), authorizing the transfer.
  5. Fallback glance-to-pay at POS terminals and transit turnstiles.
- **Slide 4 Layout:** System architecture diagram showing BLE proximity beacon, neural wristband sEMG clasp detection, and in-lens MRBD confirmation HUD.
- **Raylight Visual Prompt:** Split screen: Two people meeting, glasses POV shows subtle contact tag in in-lens HUD, they shake hands, soft chime sounds with "20 EUR sent to Alex".

### Beat 5: Inclusivity, Real-World Impact, and the Ask (2:35 - 3:00 | 25s | ~55 words)
- **Inclusivity by Design:** Complies with WCAG 2.2 and the European Accessibility Act. Quadruple input redundancy: every nod has a voice, tap, and phone screen equivalent. Blurs bystanders' faces; stores zero camera frames on servers.
- **Pilot Path & Ask:** Seeking a pilot partnership with Meta and retail partners to trial hands-free everyday protocols in European grocery chains.
- **Slide 5 Layout:** Summary scorecards (Feasibility, Privacy, Accessibility) and team call-to-action.
- **Raylight Visual Prompt:** Clean summary screen transitioning from the real-world POV into the Meta Glance brand identity and pilot roadmap.

## 8. Appendix Specifications

### `vision-peer-payment-spec.md`
Must document:
1. Proximity layer: BLE peripheral advertising and central scanning, UUID payload structure, signal strength (RSSI) calibration for physical proximity bounding (< 1m).
2. Intent verification: Gaze tracking and head orientation toward peer device.
3. Neural wristband gesture confirmation: sEMG neuromuscular signature detection (extensor digitorum and flexor carpi radialis activation profile during a handshake clasp).
4. Security and consent: EU contactless limit (50 EUR cap without biometric override), anti-relay protections, instant revocation, zero persistent biometric storage.
5. Meta Display integration: In-lens MRBD UI flow (`apps/display-pow`).

### `qa-and-objections.md`
Must document structured responses for:
1. Accidental nods or head gestures while walking or chatting (requires active glance lock on product before nod is evaluated; 20-second timeout).
2. Low lighting and blurry camera frames in grocery aisles (voice informs user of poor visibility; camera adjusts gain; falls back to manual entry).
3. Bystander privacy and LED recording indicators (face blurring on device; zero cloud storage of raw video; visible recording LED compliance).
4. Relay attacks on BLE proximity payments (dual-party BLE challenge-response with localized timestamp and distance bounding).
5. Neural wristband sEMG false triggers (requires simultaneous BLE proximity + gaze lock + active handshake clasp pattern).

## 9. What is Left to the Builder
- Precise phrasing of Raylight image and video generation prompts.
- Exact typography and color formatting in the markdown presentation slides.
- Fine-tuning bullet point density for high-contrast presentation legibility.
