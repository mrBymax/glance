# Meta Glance Documentation

This directory houses the research, technical specifications, presentation materials, and architecture documents for Meta Glance at HackJunction 2026.

## Directory Structure

```text
docs/
├── README.md                      # This master index and agent retrieval map
├── pitch/                         # 3-minute pitch deck and Raylight video presentation suite
│   ├── README.md                  # Pitch index, pacing matrix, and routing guide
│   ├── 00-master-deck.md          # Complete slide deck with presenter notes
│   ├── 00-master-script.md        # Complete 180s Raylight voiceover script and scene directions
│   ├── 01-beat-friction-problem.md
│   ├── 02-beat-hero-poc-grocery.md
│   ├── 03-beat-meta-speed-advantage.md
│   ├── 04-beat-future-vision-handshake.md
│   ├── 05-beat-accessibility-impact-ask.md
│   ├── vision-peer-payment-spec.md
│   ├── qa-and-objections.md
│   └── irl-shot-list.md           # Actionable physical video shot list to film IRL
├── research/                      # Domain research conducted for the hackathon
│   ├── 2026-11-13-context-and-prior-art.md
│   ├── 2026-11-13-accessibility-and-trust.md
│   ├── 2026-11-13-dat-feasibility.md
│   ├── 2026-11-13-stack-facts.md
│   ├── 2026-11-13-reviews.md
│   └── 2026-11-13-ui-references.md
└── superpowers/                   # Engineering design specs and implementation plans
    ├── specs/
    │   ├── 2026-11-13-meta-glance-design.md
    │   ├── 2026-11-13-monorepo-structure-design.md
    │   └── 2026-11-14-pitch-and-video-context-design.md
    └── plans/
        ├── 2026-11-13-monorepo-structure.md
        ├── 2026-11-14-glance-0-foundation.md
        ├── 2026-11-14-glance-1-server.md
        ├── 2026-11-14-glance-2-android.md
        ├── 2026-11-14-glance-3-phone-ui-kiosk-mirror.md
        ├── 2026-11-14-glance-4-website-hud.md
        ├── 2026-11-14-glance-overnight-run.md
        └── 2026-11-14-pitch-and-video-context.md
```

## Agent Retrieval Routing Index

Quickly locate exact files for specific agent tasks:

| Query / Topic | Primary File | Supporting File |
|---|---|---|
| Pitch presentation slides | [`pitch/00-master-deck.md`](pitch/00-master-deck.md) | [`pitch/README.md`](pitch/README.md) |
| Raylight video script and scene prompts | [`pitch/00-master-script.md`](pitch/00-master-script.md) | Individual beat files in `pitch/` |
| Physical camera shot list to film IRL | [`pitch/irl-shot-list.md`](pitch/irl-shot-list.md) | [`pitch/02-beat-hero-poc-grocery.md`](pitch/02-beat-hero-poc-grocery.md) |
| Grocery PoC architecture and user loop | [`pitch/02-beat-hero-poc-grocery.md`](pitch/02-beat-hero-poc-grocery.md) | [`superpowers/specs/2026-11-13-meta-glance-design.md`](superpowers/specs/2026-11-13-meta-glance-design.md) |
| Meta zero-to-one implementation speed | [`pitch/03-beat-meta-speed-advantage.md`](pitch/03-beat-meta-speed-advantage.md) | [`pitch/00-master-deck.md`](pitch/00-master-deck.md) |
| Peer money exchange & neural band handshake | [`pitch/vision-peer-payment-spec.md`](pitch/vision-peer-payment-spec.md) | [`pitch/04-beat-future-vision-handshake.md`](pitch/04-beat-future-vision-handshake.md) |
| Judge Q&A, objection handling, edge cases | [`pitch/qa-and-objections.md`](pitch/qa-and-objections.md) | [`research/2026-11-13-accessibility-and-trust.md`](research/2026-11-13-accessibility-and-trust.md) |
| Accessibility standards (WCAG 2.2, EAA) | [`research/2026-11-13-accessibility-and-trust.md`](research/2026-11-13-accessibility-and-trust.md) | [`pitch/05-beat-accessibility-impact-ask.md`](pitch/05-beat-accessibility-impact-ask.md) |
| Meta Wearables DAT SDK feasibility | [`research/2026-11-13-dat-feasibility.md`](research/2026-11-13-dat-feasibility.md) | [`superpowers/specs/2026-11-13-meta-glance-design.md`](superpowers/specs/2026-11-13-meta-glance-design.md) |
| Tech stack facts (Gemini, ElevenLabs, Atlas) | [`research/2026-11-13-stack-facts.md`](research/2026-11-13-stack-facts.md) | [`superpowers/specs/2026-11-13-meta-glance-design.md`](superpowers/specs/2026-11-13-meta-glance-design.md) |
| Engineering implementation plans | [`superpowers/plans/`](superpowers/plans/) | [`superpowers/specs/`](superpowers/specs/) |
