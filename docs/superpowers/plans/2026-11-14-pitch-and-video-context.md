# Pitch and Video Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a modular, agent-optimized documentation suite under `docs/pitch/` and reorganize `docs/README.md` for a synchronized 3-minute pitch deck and Raylight video demo.

**Architecture:** A 180-second modular 5-beat presentation layout with 1:1 synchronization between slides and video scenes, master roll-ups (`00-master-deck.md`, `00-master-script.md`), deep-dive technical specs (`vision-peer-payment-spec.md`, `qa-and-objections.md`), and an agentic context-retrieval routing index in `docs/README.md`.

**Tech Stack:** Markdown, Raylight generation prompt schemas, ASD-STE100 anti-slop technical documentation rules.

**Spec:** `docs/superpowers/specs/2026-11-14-pitch-and-video-context-design.md`

## Global Constraints

- Presentation duration: strictly 180 seconds total (~420 spoken words at 140 words per minute).
- Pacing allocations: Beat 1 (0:00 - 0:30, 30s), Beat 2 (0:30 - 1:15, 45s), Beat 3 (1:15 - 1:55, 40s), Beat 4 (1:55 - 2:35, 40s), Beat 5 (2:35 - 3:00, 25s).
- Anti-slop writing rules: no emoji, no em dashes (use colons, commas, or parentheses), active voice, concise sentences, zero conversational fluff.
- Hardware integrity: Ray-Ban Meta Gen 2 is audio-first (spatial audio, earcons); visual HUD elements are explicitly attributed as "Phone companion HUD / Audience visualization", and in-lens UI is attributed to Meta Ray-Ban Display (`apps/display-pow`).
- Future vision: Peer money exchange uses phone/glasses BLE proximity beacons (RSSI < 1m) and Meta Display neural wristband sEMG neuromuscular handshake clasp detection.
- Redundant accessibility: Every gesture input has audio, tap, and phone screen fallbacks per WCAG 2.2 and the European Accessibility Act.

## Review Focus

1. Total voiceover word count in `00-master-script.md` exceeds 450 words, exceeding the 180-second hard limit.
2. Beat 2 provides only synthetic prompts or only physical video shot lists, failing either automated Raylight pipeline generation or physical demo splicing.
3. Ray-Ban Meta Gen 2 falsely depicted as possessing an in-lens optical display, undermining technical credibility with Meta evaluators.
4. Future vision spec lacks cryptographic and regulatory bounds (EU 50 EUR contactless cap, BLE anti-relay timestamps, cancellation triggers).
5. Information retrieval queries fail because `docs/README.md` or `docs/pitch/README.md` lack explicit keyword routing.

---

### Task 1: Top-Level Repository Docs Reorganization & Pitch Index

**Files:**
- Create: `docs/pitch/README.md`
- Modify: `docs/README.md`

**Interfaces:**
- Consumes: Directory layout from `2026-11-14-pitch-and-video-context-design.md` section 5.
- Produces: Master index routing table for agentic tools and human readers navigating the monorepo docs.

- [ ] **Step 1: Write `docs/pitch/README.md`**
  Include:
  - Overview of the 3-minute pitch deck and Raylight video demo assets.
  - The 180-second pacing table (Beats 1 to 5, duration, word budget, core focus).
  - Agent retrieval routing guide: exact file targets for slide generation, video prompt generation, technical defense, and accessibility questions.
  - Style rules (anti-slop, no emoji, active voice).

- [ ] **Step 2: Update `docs/README.md`**
  Include:
  - Complete navigation table linking `docs/research/`, `docs/superpowers/`, and `docs/pitch/`.
  - Fast-lookup index for LLM agents (e.g. "Where is the kiosk payment spec?", "Where is the pitch script?", "Where is the BLE handshake protocol?").

- [ ] **Step 3: Verification**
  Run markdown link verification and check that all referenced paths exist:
  `test -f docs/pitch/README.md && test -f docs/README.md`

- [ ] **Step 4: Commit**
  `git add docs/README.md docs/pitch/README.md`
  `git commit -m "docs: establish pitch directory index and reorganize docs navigation"`

---

### Task 2: Beat 1 Context - Everyday Retail Friction & Problem

**Files:**
- Create: `docs/pitch/01-beat-friction-problem.md`

**Interfaces:**
- Consumes: Research facts from `docs/research/2026-11-13-context-and-prior-art.md` and `docs/research/2026-11-13-accessibility-and-trust.md`.
- Produces: Slide 1 layout, Raylight Beat 1 prompt, and 30-second voiceover narration.

- [ ] **Step 1: Write `docs/pitch/01-beat-friction-problem.md`**
  Cover:
  - Duration: 0:00 - 0:30 (30 seconds, budget ~70 words).
  - The Core Problem: Everyday activities force manual screen interaction. Holding groceries while managing a smartphone or handheld scanner creates physical friction and drops.
  - Accessibility barrier: Touchscreen kiosks and packaging labels completely lock out blind and motor-impaired shoppers.
  - Failed alternatives: Amazon Just Walk Out ceiling cameras proved economically unviable and technically fragile.
  - Slide 1 specifications: visual layout, headline, bullet points, presenter notes.
  - Raylight visual prompt: first-person POV looking down at overloaded hands, struggling to retrieve phone from pocket.
  - Voiceover script: exact 70-word spoken script.

- [ ] **Step 2: Verification**
  Verify word count of voiceover script (between 60 and 75 words) and ensure absence of emojis or em dashes:
  `grep -E "—|–" docs/pitch/01-beat-friction-problem.md || echo "Pass"`

- [ ] **Step 3: Commit**
  `git add docs/pitch/01-beat-friction-problem.md`
  `git commit -m "docs(pitch): add beat 1 retail friction and problem specification"`

---

### Task 3: Beat 2 Context - Hero PoC Grocery Shopping

**Files:**
- Create: `docs/pitch/02-beat-hero-poc-grocery.md`

**Interfaces:**
- Consumes: Spec `2026-11-13-meta-glance-design.md` sections 1 and 4, and server catalog facts.
- Produces: Slide 2 layout, Raylight Beat 2 prompt, hardware testbed recording shot list, and 45-second voiceover narration.

- [ ] **Step 1: Write `docs/pitch/02-beat-hero-poc-grocery.md`**
  Cover:
  - Duration: 0:30 - 1:15 (45 seconds, budget ~105 words).
  - The Protocol: "Glance tells, nod buys." Looking at an item triggers instant spatial audio announcement (item name and price). Nodding adds it to the cart. Walking to the kiosk, glancing at the QR screen, and nodding completes payment.
  - Hardware honesty: Ray-Ban Meta Gen 2 is audio-first. Graphics are explicitly labeled "Phone companion HUD / Audience visualization".
  - Slide 2 specifications: 3-step loop diagram (Glance, Hear, Nod), kiosk QR display, companion HUD.
  - Dual video sourcing:
    - Raylight generative prompt schema for end-to-end synthetic video.
    - Physical testbed camera shot list for recording the Android app, glasses, and laptop kiosk screen with real items (oat milk, rye bread).
  - Voiceover script: exact ~105-word spoken script.

- [ ] **Step 2: Verification**
  Verify word count (95 to 115 words) and ensure hardware disclaimer is present:
  `grep -i "audience visualization" docs/pitch/02-beat-hero-poc-grocery.md`

- [ ] **Step 3: Commit**
  `git add docs/pitch/02-beat-hero-poc-grocery.md`
  `git commit -m "docs(pitch): add beat 2 grocery poc specification and dual video guidance"`

---

### Task 4: Beat 3 Context - Meta's 0-to-1 Speed Advantage

**Files:**
- Create: `docs/pitch/03-beat-meta-speed-advantage.md`

**Interfaces:**
- Consumes: Architecture constraints and deployment economics from `2026-11-13-meta-glance-design.md`.
- Produces: Slide 3 layout, Raylight Beat 3 prompt, and 40-second voiceover narration.

- [ ] **Step 1: Write `docs/pitch/03-beat-meta-speed-advantage.md`**
  Cover:
  - Duration: 1:15 - 1:55 (40 seconds, budget ~95 words).
  - Strategic Advantage: Meta can deploy this protocol in days. Competitors require custom store infrastructure or unreleased hardware. Meta Glance uses existing Ray-Ban Meta glasses and existing retail checkout displays.
  - Zero Store Retrofit: Comparison with Amazon Just Walk Out ($100k+ per store ceiling rigs vs. zero hardware cost for Meta Glance). The store only renders a dynamic QR code on existing monitors.
  - Slide 3 specifications: Side-by-side comparison matrix (Cost, Installation time, Maintenance, Privacy).
  - Raylight visual prompt: Sleek motion graphic contrasting heavy ceiling camera grid with lightweight wearable software connection to POS screen.
  - Voiceover script: exact ~95-word spoken script.

- [ ] **Step 2: Verification**
  Verify word count (85 to 105 words) and ensure no em dashes or buzzword slop:
  `grep -E "—|–" docs/pitch/03-beat-meta-speed-advantage.md || echo "Pass"`

- [ ] **Step 3: Commit**
  `git add docs/pitch/03-beat-meta-speed-advantage.md`
  `git commit -m "docs(pitch): add beat 3 meta speed advantage specification"`

---

### Task 5: Beat 4 Context - Future Horizon: Neural Band Handshake & Glance-to-Pay

**Files:**
- Create: `docs/pitch/04-beat-future-vision-handshake.md`

**Interfaces:**
- Consumes: Technical architecture from design spec section 5 and `apps/display-pow` capabilities.
- Produces: Slide 4 layout, Raylight Beat 4 prompt, and 40-second voiceover narration.

- [ ] **Step 1: Write `docs/pitch/04-beat-future-vision-handshake.md`**
  Cover:
  - Duration: 1:55 - 2:35 (40 seconds, budget ~95 words).
  - Protocol Expansion: Hands-free commerce beyond retail into everyday social life.
  - Peer Money Exchange Flow:
    1. BLE advertising beacons between phones/glasses establish proximity (< 1m).
    2. Looking at peer confirms recipient in Meta Display in-lens HUD.
    3. Meta Display neural wristband detects neuromuscular sEMG signature of a physical handshake clasp to authorize the transfer.
  - Merchant Glance-to-Pay: Glance at turnstile or POS terminal with confirmation chime.
  - Slide 4 specifications: Multi-device diagram (BLE beacon, neural band sEMG clasp, MRBD in-lens HUD).
  - Raylight visual prompt: First-person POV looking at friend, contact tag in MRBD HUD, physical handshake clasp, confirmation earcon and text.
  - Voiceover script: exact ~95-word spoken script.

- [ ] **Step 2: Verification**
  Verify word count (85 to 105 words) and presence of neural wristband references:
  `grep -i "neural wristband" docs/pitch/04-beat-future-vision-handshake.md`

- [ ] **Step 3: Commit**
  `git add docs/pitch/04-beat-future-vision-handshake.md`
  `git commit -m "docs(pitch): add beat 4 future vision neural band handshake specification"`

---

### Task 6: Beat 5 Context - Accessibility, Real-World Impact, and Team Ask

**Files:**
- Create: `docs/pitch/05-beat-accessibility-impact-ask.md`

**Interfaces:**
- Consumes: WCAG 2.2 and European Accessibility Act facts from `docs/research/2026-11-13-accessibility-and-trust.md`.
- Produces: Slide 5 layout, Raylight Beat 5 prompt, and 25-second voiceover narration.

- [ ] **Step 1: Write `docs/pitch/05-beat-accessibility-impact-ask.md`**
  Cover:
  - Duration: 2:35 - 3:00 (25 seconds, budget ~55 words).
  - Inclusive Interaction: 4 redundant input modalities for every action (head nod, voice, touch tap, phone screen). Blind and low-vision accessibility.
  - Privacy and Trust: Bystander faces blurred on device; zero cloud storage of raw video; visible recording LED compliance.
  - Pilot Pathway and Ask: Proposal for a live pilot in European grocery chains in partnership with Meta.
  - Slide 5 specifications: Impact scorecards, compliance badges, team credentials, call-to-action.
  - Raylight visual prompt: Transition from glasses POV into Meta Glance brand identity, partner pilot roadmap, and closing visual.
  - Voiceover script: exact ~55-word spoken script.

- [ ] **Step 2: Verification**
  Verify word count (45 to 65 words) and check compliance mentions:
  `grep -i "WCAG" docs/pitch/05-beat-accessibility-impact-ask.md`

- [ ] **Step 3: Commit**
  `git add docs/pitch/05-beat-accessibility-impact-ask.md`
  `git commit -m "docs(pitch): add beat 5 accessibility impact and team ask specification"`

---

### Task 7: Master Pitch Deck and Master Video Script Roll-Ups

**Files:**
- Create: `docs/pitch/00-master-deck.md`
- Create: `docs/pitch/00-master-script.md`

**Interfaces:**
- Consumes: Beats 1 through 5 from Tasks 2 to 6.
- Produces: Consolidated single-source slide deck and continuous 180-second Raylight voiceover script.

- [ ] **Step 1: Write `docs/pitch/00-master-deck.md`**
  Include:
  - All 5 presentation slides formatted cleanly in Markdown with high-contrast text and layout specs.
  - Slide-by-slide visual layout guidelines, key metrics, and presenter speaker notes.
  - Pacing timestamps and slide transition cues.

- [ ] **Step 2: Write `docs/pitch/00-master-script.md`**
  Include:
  - Continuous 180-second voiceover script (strictly 390 to 430 words total).
  - Timestamp cues every 15-30 seconds.
  - Synchronized visual directions, audio earcons, and camera instructions for Raylight rendering.

- [ ] **Step 3: Verification**
  Verify total script word count does not exceed 430 words:
  `wc -w docs/pitch/00-master-script.md`
  Ensure all 5 beats are sequentially linked.

- [ ] **Step 4: Commit**
  `git add docs/pitch/00-master-deck.md docs/pitch/00-master-script.md`
  `git commit -m "docs(pitch): generate master slide deck and master raylight script"`

---

### Task 8: Technical Vision Deep Dive & Objection Defense

**Files:**
- Create: `docs/pitch/vision-peer-payment-spec.md`
- Create: `docs/pitch/qa-and-objections.md`

**Interfaces:**
- Consumes: Design spec sections 7 and 8, BLE beacon protocols, sEMG signal processing models.
- Produces: Engineering spec for peer money exchange and comprehensive judge defense handbook.

- [ ] **Step 1: Write `docs/pitch/vision-peer-payment-spec.md`**
  Cover:
  - Proximity layer: BLE peripheral advertising and central scanning, UUID payload structure, RSSI calibration (< 1m).
  - Intent alignment: Head orientation and gaze lock protocol.
  - Neural wristband sEMG detection: Extensor digitorum and flexor carpi radialis neuromuscular activation curves, sampling rates (50-100 Hz), handshake clasp confirmation.
  - In-lens MRBD HUD integration (`apps/display-pow`): UI flow, transfer confirmation pill, status indicators.
  - Security and anti-relay: EU 50 EUR contactless limit, ephemeral tokens, replay prevention, transaction cancellation timeout.

- [ ] **Step 2: Write `docs/pitch/qa-and-objections.md`**
  Cover structured answers for:
  - Accidental head movements / nods while conversing.
  - sEMG false triggers during high-five or fist bump.
  - Poor store lighting and blurry camera frames.
  - Bystander privacy and recording LED concerns.
  - Barcode versus vision recognition reliability.
  - BLE relay attacks in crowded spaces.

- [ ] **Step 3: Verification**
  Verify both files exist and satisfy all constraint rules:
  `test -f docs/pitch/vision-peer-payment-spec.md && test -f docs/pitch/qa-and-objections.md`

- [ ] **Step 4: Commit**
  `git add docs/pitch/vision-peer-payment-spec.md docs/pitch/qa-and-objections.md`
  `git commit -m "docs(pitch): add vision peer payment spec and qa objection defense"`

---

### Task 9: Final Quality Audit and Verification

**Files:**
- Verify all created files under `docs/pitch/` and updated `docs/README.md`.

- [ ] **Step 1: Anti-slop and style check**
  Run non-ASCII and style check across `docs/pitch/`:
  `python3 -c "import glob; [print(f, l.strip()) for f in glob.glob('docs/pitch/*.md') for l in open(f) if any(ord(c)>127 and c not in 'äöüéè' for c in l)]" || echo "Clean"`

- [ ] **Step 2: Link and path integrity check**
  Verify that all internal cross-links between `docs/pitch/` files and repository resources are valid relative paths.

- [ ] **Step 3: Pre-commit hook validation**
  Run repository pre-commit checks:
  `node scripts/hooks/pre-commit.mjs`

- [ ] **Step 4: Final commit and summary**
  Verify `git status` is clean.
