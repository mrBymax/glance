---
name: mrbd-ui-toolkit
description: Build, debug, or review Meta Ray-Ban Display glasses apps (React, `@wearables-ui-toolkit/mrbd`) - screens, D-pad focus, lists, menus, controls, materials, theming, validation. Official Meta UI Toolkit skill library. For any UI that renders on the glasses display, use this instead of refero-design or other generic design skills.
---

# UI Toolkit for Meta Ray-Ban Display (web)

This skill wraps Meta's official UI Toolkit skill library. The library is in
`library/`, with one directory for each upstream skill. Each upstream
`SKILL.md` is renamed to `GUIDE.md`, so agents do not load the 24 sub-skills
as separate skills. The guides are otherwise unchanged.

## Start here

1. Read `library/wearables-ui-toolkit-web/GUIDE.md` and follow it. It is the
   upstream entry point and its production contract is binding.
2. Resolve every relative path (`../uit-*-web/...`, `scripts/...`) from the
   directory of the guide that contains it. All guides are siblings in
   `library/`.
3. Run the bundled scripts (`init-app.mjs`, `verify-app.mjs`,
   `find-filled-icon.mjs`) from their guide directory exactly as the guide
   says.
4. If the guides do not answer a question about the glasses platform, query
   the `wearables-dat` MCP server (`.mcp.json`). It also indexes the
   Ray-Ban Display web app documentation.

## Scope

- Use this skill for UI that renders on the Ray-Ban Display glasses.
- Use `refero-design` for phone and web UI (`apps/website`, `apps/mobile`).
- Use `meta-wearables-dat` for native iOS or Android code that connects to the
  glasses (camera, audio, sessions, the DAT display API).

## Source

- Upstream: https://github.com/meta/meta-ray-ban-display-ui-toolkit-web
  (`llm-skills/`, commit `61e20dcbcd9435d585fa99a5c56c603acbc71988`)
- License: Apache-2.0, see `LICENSE` and `NOTICE`.
- Local changes: `SKILL.md` renamed to `GUIDE.md` (with path references
  updated), and the Codex `agents/openai.yaml` metadata removed.
