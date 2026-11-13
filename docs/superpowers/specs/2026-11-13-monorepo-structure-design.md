# Meta Glance Monorepo Structure - Design Document

## Intent and Why
Initialize an agentic-first monorepo structure for team "Meta Glance" at HackJunction 2026. The goal is to establish clear isolation between distinct applications, provide designated spaces for agentic assets (skills and agents), create shared package foundations, and ensure git tracks all designated directories via `.gitkeep` files while ignoring generated build/environment artifacts.

## Goals, Non-Goals, and Anti-Goals
- **Goals**:
  - Establish `apps/` containing `website/`, `mobile/`, and `display-pow/`.
  - Establish agentic directories `skills/` and `agents/`.
  - Establish `packages/shared/` and `docs/`.
  - Ensure every empty directory is tracked in git using `.gitkeep`.
  - Provide a root `.gitignore` tailored for monorepo development (Node/web, mobile/React Native/Flutter, OS files, env files).
  - Update root `README.md` with team and project orientation.
- **Non-Goals**:
  - Scaffolding actual runtime frameworks (e.g. `npx create-next-app` or `npx react-native init`) at this step; framework choices remain with the team.
  - Adding CI/CD pipelines or package deployment workflows.
- **Anti-Goals**:
  - Committing empty untracked directories that disappear on git push.
  - Hardcoding framework locks before team consensus on specific tools.

## Constraints
- Must use git-friendly tracking (`.gitkeep` files).
- Must adhere strictly to the selected Approach 1 workspace structure.

## Approaches Considered
1. **Approach 1: Standard Workspace Layout (`apps/` + Agentic Root) — Selected**
   - Apps under `apps/` (`website`, `mobile`, `display-pow`), `packages/shared`, top-level `skills/`, `agents/`, `docs/`.
   - Selected because it cleanly separates deployables, preserves immediate discovery for AI agents, and supports monorepo tooling.
2. **Approach 2: Flat Root Structure**
   - Top-level folders for everything. Rejected because it crowds the root directory as the hackathon progresses.
3. **Approach 3: Agentic Domain-Grouped Layout**
   - Nesting agents and skills under `agentic/`. Rejected because it diverges from standard agentic tooling conventions.

## Decisions Made
- Layout: Approach 1 (`apps/website`, `apps/mobile`, `apps/display-pow`, `packages/shared`, `agents`, `skills`, `docs`).
- Directory tracking: `.gitkeep` placed in every directory.
- Root configuration: Comprehensive multi-stack `.gitignore` and updated `README.md`.

## What's Left to the Builder
- Generate directory tree and place `.gitkeep` files.
- Create multi-stack `.gitignore`.
- Update `README.md` to reflect project layout and HackJunction 2026 overview.
- Verify git status tracks all files cleanly.
