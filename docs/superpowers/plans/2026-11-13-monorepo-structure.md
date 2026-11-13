# Meta Glance Monorepo Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize the agentic-first monorepo directory layout for team Meta Glance at HackJunction 2026, including `.gitkeep` files, root `.gitignore`, and project documentation.

**Architecture:** Monorepo workspace structure with applications separated into `apps/` (`website`, `mobile`, `display-pow`), reusable shared libraries in `packages/shared`, agentic definitions in root `agents/` and `skills/`, documentation in `docs/`, and full git tracking via `.gitkeep`.

**Tech Stack:** Git, Shell, Markdown.

**Spec:** `docs/superpowers/specs/2026-11-13-monorepo-structure-design.md`

## Global Constraints

- Apps directory contains exactly: `apps/website`, `apps/mobile`, `apps/display-pow`.
- Shared code directory contains: `packages/shared`.
- Root agentic directories: `agents` and `skills`.
- Documentation directory: `docs`.
- Every designated empty directory must contain a `.gitkeep` file.
- `.gitignore` must ignore standard web, mobile, node, env, and OS artifacts without ignoring `.gitkeep` files.

## Review Focus

- Git ignores empty directories unless `.gitkeep` exists: verified by checking `git status` lists each `.gitkeep`.
- `.gitignore` wildcard rules might accidentally ignore `.gitkeep`: verified with `git check-ignore -v apps/website/.gitkeep` (must exit non-zero).
- Directory naming typos: verify exact names against spec (`display-pow`, `website`, `mobile`, `agents`, `skills`, `packages/shared`, `docs`).
- Missing README orientation: verify `README.md` accurately describes all 7 directories and HackJunction 2026 context.

---

### Task 1: Create Monorepo Directory Skeleton and `.gitkeep` Files

**Files:**
- Create: `apps/website/.gitkeep`
- Create: `apps/mobile/.gitkeep`
- Create: `apps/display-pow/.gitkeep`
- Create: `packages/shared/.gitkeep`
- Create: `agents/.gitkeep`
- Create: `skills/.gitkeep`
- Create: `docs/.gitkeep`

**Interfaces:**
- Produces: 7 directory paths tracked by git via `.gitkeep`.

- [ ] **Step 1: Create the target directories and touch .gitkeep files**

```bash
mkdir -p apps/website apps/mobile apps/display-pow packages/shared agents skills docs
touch apps/website/.gitkeep apps/mobile/.gitkeep apps/display-pow/.gitkeep packages/shared/.gitkeep agents/.gitkeep skills/.gitkeep docs/.gitkeep
```

- [ ] **Step 2: Verify each .gitkeep exists**

Run:
```bash
for d in apps/website apps/mobile apps/display-pow packages/shared agents skills docs; do
  test -f "$d/.gitkeep" || { echo "Missing $d/.gitkeep"; exit 1; }
done
echo "All .gitkeep files present"
```
Expected: `All .gitkeep files present`

- [ ] **Step 3: Commit directory skeleton**

```bash
git add apps packages agents skills docs
git commit -m "chore: scaffold monorepo directory structure with gitkeeps"
```

---

### Task 2: Create Multi-Stack `.gitignore`

**Files:**
- Create: `.gitignore`

**Interfaces:**
- Consumes: Directory structure from Task 1.
- Produces: Monorepo ignore rules for Node, Next.js/Vite, React Native/Expo, Flutter, iOS/Android, environment secrets, and OS files.

- [ ] **Step 1: Write `.gitignore` with comprehensive rules and `.gitkeep` protection**

Write `.gitignore` containing:
- OS artifacts (`.DS_Store`, `Thumbs.db`)
- Environment secrets (`.env`, `.env.local`, `.env.*.local`)
- Node dependencies & logs (`node_modules/`, `npm-debug.log*`, `yarn-error.log*`, `pnpm-debug.log*`)
- Web build outputs (`dist/`, `build/`, `.next/`, `out/`)
- Mobile build artifacts (iOS `Pods/`, Android `.gradle/`, Expo `.expo/`)
- Explicit un-ignore rule `!.gitkeep`

- [ ] **Step 2: Verify `.gitkeep` is not ignored and `node_modules` is ignored**

Run:
```bash
git check-ignore -v node_modules
git check-ignore -v apps/website/.gitkeep || echo "SUCCESS: .gitkeep is not ignored"
```
Expected: `node_modules` is matched, `.gitkeep` is not ignored.

- [ ] **Step 3: Commit `.gitignore`**

```bash
git add .gitignore
git commit -m "chore: add comprehensive monorepo .gitignore"
```

---

### Task 3: Update Project `README.md` and Verify Working Tree

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Project architecture and directory structure.
- Produces: Clear onboarding and architectural guide for HackJunction 2026 team members and AI agents.

- [ ] **Step 1: Update `README.md` with Meta Glance monorepo structure**

Update `README.md` with:
- Project title: Meta Glance (@ HackJunction 2026)
- Monorepo directory map table explaining each folder (`apps/website`, `apps/mobile`, `apps/display-pow`, `packages/shared`, `agents`, `skills`, `docs`)
- Quick start instructions for team contributors

- [ ] **Step 2: Verify git status is clean and all commits are valid**

Run:
```bash
git status --short
```
Expected: only `README.md` modified (or untracked plan/spec docs).

- [ ] **Step 3: Commit `README.md` and documentation**

```bash
git add README.md docs/superpowers
git commit -m "docs: document monorepo layout and add design/plan specs"
```

- [ ] **Step 4: Final verification check**

Run:
```bash
git log -n 4 --oneline
```
Expected: 3-4 clean commits reflecting the scaffolding, gitignore, and documentation.
