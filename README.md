# Meta Glance

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

| Path | Purpose |
|---|---|
| `apps/website` | Front-end web application |
| `apps/mobile` | Mobile application (React Native / Flutter / native) |
| `apps/display-pow` | Display Proof of Work module and future implementations |
| `packages/shared` | Reusable utilities, shared types, and shared configurations |
| `agents` | System prompts, model configs, and agentic specifications |
| `skills` | Reusable task playbooks and tool skills for coding assistants and runtime agents |
| `docs` | Project architecture, design specs, and hackathon presentation material |

## Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/mrBymax/glance.git
   cd glance
   ```

2. **Branching & Workflow:**
   - Create feature branches off `main` (e.g. `feature/<name>` or `fix/<name>`).
   - Keep empty target folders tracked with `.gitkeep` until initial project code is generated.
