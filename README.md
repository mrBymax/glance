# Meta Glance

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/Glance%20Dark.png">
  <source media="(prefers-color-scheme: light)" srcset="assets/Glance.png">
  <img alt="Glance logo" src="assets/Glance.png">
</picture>

> Monorepo for team **Meta Glance** at **HackJunction 2026**.

## Overview

This repository is organized as an agentic-first monorepo hosting the applications, shared packages, AI agent definitions, skills, and documentation for Meta Glance.

## Repository Structure

```text
glance/
├── apps/
│   ├── website/        # Web application
│   ├── mobile/         # Mobile application (iOS / Android)
│   └── display-pow/    # Display Proof of Work / implementations
├── packages/
│   └── shared/         # Shared libraries, utilities, and schemas
├── agents/             # AI agent definitions, personas, and prompts
├── skills/             # Agentic workflows, playbooks, and capabilities
├── docs/               # Architecture, hackathon submission, specifications
├── .gitignore          # Comprehensive monorepo ignore rules
└── README.md           # Project orientation and instructions
```

### Directory Details

| Path               | Purpose                                                                          |
| ------------------ | -------------------------------------------------------------------------------- |
| `apps/website`     | Front-end web application                                                        |
| `apps/mobile`      | Mobile application (React Native / Flutter / native)                             |
| `apps/display-pow` | Display Proof of Work module and future implementations                          |
| `packages/shared`  | Reusable utilities, shared types, and shared configurations                      |
| `agents`           | System prompts, model configs, and agentic specifications                        |
| `skills`           | Reusable task playbooks and tool skills for coding assistants and runtime agents |
| `docs`             | Project architecture, design specs, and hackathon presentation material          |

## Getting Started

1. **Clone the repository:**

   ```bash
   git clone https://github.com/mrBymax/glance.git
   cd glance
   ```

2. **Branching & Workflow:**
   - Create feature branches off `main` (e.g. `feature/<name>` or `fix/<name>`).
   - Keep empty target folders tracked with `.gitkeep` until initial project code is generated.

## Hooks

The repository has two hooks.

**Pre-commit hook.** `.githooks/pre-commit` runs `scripts/hooks/pre-commit.mjs` on the staged files. It stops a commit that holds one of these:

- a secret, or a file that can hold one (`.env`, `local.properties`, a keystore)
- an ESLint error in a staged JavaScript or TypeScript file (rules: `eslint.config.mjs`)
- a ktlint error in `apps/mobile/android`, when a Kotlin file is staged

`npm install` at the repository root turns the hook on. Without npm, run `git config core.hooksPath .githooks` one time. Do not commit with `--no-verify`. Fix the finding.

**Stop hook of Claude Code.** `.claude/settings.json` runs `.claude/hooks/stop-docs.cjs` each time Claude Code wants to stop. If code changed and no documentation changed with it, the hook asks Claude one time to update the documentation: this file, the `README.md` of each changed app or package, and `docs/architecture.md`. Each diagram in the documentation is a Mermaid code block.

## Agent Skills

`skills/` is the only copy of the project skills. `.claude/skills` (Claude Code) and `.agents/skills` (Codex, Cursor, Gemini CLI, and other agents that read `.agents/`) are symlinks to it.

| Skill                | Use for                                                                              |
| -------------------- | ------------------------------------------------------------------------------------ |
| `anti-slop`          | Output hygiene for code, comments, docs, and commit messages                         |
| `refero-design`      | Phone and web UI design (`apps/website`, `apps/mobile`)                              |
| `mrbd-ui-toolkit`    | UI that renders on the Ray-Ban Display glasses (React, `@wearables-ui-toolkit/mrbd`) |
| `meta-wearables-dat` | Native iOS and Android code that connects to the glasses (DAT SDK)                   |
| `diagram-design`     | Standalone diagrams as HTML and SVG, for the website, the deck, and the video        |

`diagram-design` came from `npx skills add cathrynlavery/diagram-design`. `skills-lock.json` records the source of each skill that this command added. The documentation in Markdown keeps Mermaid diagrams, because GitHub renders them. Use `diagram-design` for a diagram that stands alone. Its checks need Python 3.

`.mcp.json` adds the hosted Meta Wearables docs server (`wearables-dat`, no auth). Approve it when Claude Code asks.

Keep the skill count low. Each skill description uses space in the context of every agent session, and overlapping skills compete for the same tasks. Before you add a skill, remove one that the team does not use.

On Windows, the symlinks need `git config core.symlinks true` and Developer Mode before you clone. Without them, create junctions after the clone:

```bat
rmdir .claude\skills .agents\skills 2>nul & del .claude\skills .agents\skills 2>nul
mklink /J .claude\skills skills
mklink /J .agents\skills skills
git update-index --skip-worktree .claude/skills .agents/skills
(echo .claude/skills/& echo .agents/skills/)>> .git\info\exclude
```
