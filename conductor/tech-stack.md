# Aidevelo Technology Stack

This document outlines the core technologies and architectural components used in the Aidevelo control plane.

## Frontend
- **Framework:** React (TypeScript)
- **Styling:** Vanilla CSS (Refining existing modern minimalist aesthetic)
- **Deployment:** Vercel

## Backend & API
- **Runtime:** Node.js (>=20)
- **Framework:** Node.js (Express-like, located in `server/`)
- **API Model:** REST and SSE for realtime updates
- **Functions:** Cloudflare Pages/Functions for edge execution

## Data & Storage
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **Migrations:** Automated via Drizzle-kit

## Orchestration & Agency
- **Agent Adapters:** Support for Process-based (e.g., Claude Code, local scripts) and HTTP-based (e.g., OpenClaw, external APIs) runtimes.
- **Task Model:** Hierarchical task management with parentage tracking.

## Quality & Tooling
- **Unit/Integration Testing:** Vitest
- **End-to-End Testing:** Playwright
- **Package Management:** PNPM (Monorepo)
- **Build System:** Turbo (for monorepo orchestration)
- **Development Tooling:** Custom dev-runner for parallel service execution
