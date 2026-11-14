# Meta Glance

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/Glance%20Dark.png">
  <source media="(prefers-color-scheme: light)" srcset="assets/Glance.png">
  <img alt="Glance logo" src="assets/Glance.png">
</picture>

Meta Glance is a proof of concept for the Meta challenge at Junction 2026. Smart glasses replace the scanner in scan-as-you-shop: a glance tells the name and the price of a product, a nod adds it to the cart, and a nod at the kiosk code pays.

The design is in `docs/superpowers/specs/2026-11-13-meta-glance-design.md`. The implementation plans are in `docs/superpowers/plans/`.

## State of the build

The repository is one npm workspace. One package has code: `packages/shared`, the message contract. The app folders are empty until their plans are done.

## Folders

| Path | Content |
|---|---|
| `packages/shared` | `@glance/shared`: the message types as zod schemas, the JSON fixtures, the money and kiosk code helpers, and the frame codec. See its `README.md`. |
| `apps/server`, `apps/mobile`, `apps/website`, `apps/display-pow` | Empty. The plans in `docs/superpowers/plans/` say what each one gets. |
| `agents` | Empty. It gets the model prompts. |
| `skills` | The agent skills of the project (part "Agent Skills") |
| `scripts/hooks` | The pre-commit checks (part "Hooks") |
| `docs/superpowers` | The design document and the implementation plans |
| `docs/research` | The research behind the design |
| `assets` | The logo files |

## Tools

- Node 22 or later, with npm. `.nvmrc` names the version. Do not use pnpm or yarn.
- Git.

## Install, test, and lint

Run each command at the repository root.

```bash
npm install          # installs each workspace and turns the pre-commit hook on
npm test             # runs the tests of each workspace
npm run typecheck    # runs the TypeScript compiler on each workspace, with no output files
npm run lint         # runs ESLint on each JavaScript and TypeScript file
```

To check one workspace, add its name: `npm test --workspace @glance/shared`.

`eslint.config.mjs` holds the lint rules for each workspace, and `tsconfig.base.json` holds the compiler options. A workspace package extends `tsconfig.base.json` and adds no ESLint of its own.

## Branches and commits

- Do not commit on `main`. Work on a branch.
- Each commit message is a conventional commit: `type(scope): description`.

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
