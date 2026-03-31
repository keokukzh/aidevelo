# AGENTS.md

Guidance for human and AI contributors working in this repository.

## 1. Purpose

Aidevelo is a control plane for AI-agent companies.
The current implementation target is V1 and is defined in `doc/SPEC-implementation.md`.

## 2. Read This First

Before making changes, read in this order:

1. `doc/GOAL.md`
2. `doc/PRODUCT.md`
3. `doc/SPEC-implementation.md`
4. `doc/DEVELOPING.md`
5. `doc/DATABASE.md`

`doc/SPEC.md` is long-horizon product context.
`doc/SPEC-implementation.md` is the concrete V1 build contract.

## 3. Repo Map

- `server/`: Express REST API and orchestration services
- `ui/`: React + Vite board UI
- `packages/db/`: Drizzle schema, migrations, DB clients
- `packages/shared/`: shared types, constants, validators, API path constants
- `packages/adapters/`: Agent adapter packages (claude-local, codex-local, opencode-local, cursor-local, pi-local, gemini-local)
- `doc/`: operational and product docs

### Smart Model Routing

The managed adapter routes MiniMax API calls across 3 model tiers (M2.7 → M2.5 → M2.1) using:
- **Task classifier** (`server/src/services/task-classifier.ts`): scores tasks 0-100 to pick complexity
- **Model router** (`server/src/services/model-router.ts`): circuit breaker + budget gate + tier selection
- **Config injection** (`AIDEVELO_MODEL_OVERRIDE`): passed via delegate config env to claude-local adapter

## 4. Dev Setup (Auto DB)

Use embedded PGlite in dev by leaving `DATABASE_URL` unset.

```sh
pnpm install
pnpm dev
```

This starts:

- API: `http://localhost:3100`
- UI: `http://localhost:3100` (served by API server in dev middleware mode)

Quick checks:

```sh
curl http://localhost:3100/api/health
curl http://localhost:3100/api/companies
```

Reset local dev DB:

```sh
rm -rf data/pglite
pnpm dev
```

## 5. Core Engineering Rules

1. Keep changes company-scoped.
Every domain entity should be scoped to a company and company boundaries must be enforced in routes/services.

2. Keep contracts synchronized.
If you change schema/API behavior, update all impacted layers:
- `packages/db` schema and exports
- `packages/shared` types/constants/validators
- `server` routes/services
- `ui` API clients and pages

3. Preserve control-plane invariants.
- Single-assignee task model
- Atomic issue checkout semantics
- Approval gates for governed actions
- Budget hard-stop auto-pause behavior
- Activity logging for mutating actions

4. Do not replace strategic docs wholesale unless asked.
Prefer additive updates. Keep `doc/SPEC.md` and `doc/SPEC-implementation.md` aligned.

5. Keep plan docs dated and centralized.
New plan documents belong in `doc/plans/` and should use `YYYY-MM-DD-slug.md` filenames.

## 6. Database Change Workflow

When changing data model:

1. Edit `packages/db/src/schema/*.ts`
2. Ensure new tables are exported from `packages/db/src/schema/index.ts`
3. Generate migration:

```sh
pnpm db:generate
```

4. Validate compile:

```sh
pnpm -r typecheck
```

Notes:
- `packages/db/drizzle.config.ts` reads compiled schema from `dist/schema/*.js`
- `pnpm db:generate` compiles `packages/db` first

## 7. Verification Before Hand-off

Run this full check before claiming done:

```sh
pnpm -r typecheck
pnpm test:run
pnpm build
```

If anything cannot be run, explicitly report what was not run and why.

## 8. API and Auth Expectations

- Base path: `/api`
- Board access is treated as full-control operator context
- Agent access uses bearer API keys (`agent_api_keys`), hashed at rest
- Agent keys must not access other companies

When adding endpoints:

- apply company access checks
- enforce actor permissions (board vs agent)
- write activity log entries for mutations
- return consistent HTTP errors (`400/401/403/404/409/422/500`)

## 9. UI Expectations

- Keep routes and nav aligned with available API surface
- Use company selection context for company-scoped pages
- Surface failures clearly; do not silently ignore API errors

## 10. Definition of Done

A change is done when all are true:

1. Behavior matches `doc/SPEC-implementation.md`
2. Typecheck, tests, and build pass
3. Contracts are synced across db/shared/server/ui
4. Docs updated when behavior or commands change

## Learned User Preferences
- When confirming destructive actions in CursorBrowser, avoid native `window.prompt()` / `window.confirm()` since those dialogs are suppressed and input may be empty; use an in-app `Dialog` with controlled text input instead.
- For browser-driven flows, ensure destructive actions rely on explicit user input validation inside React components rather than native blocking dialogs.
- When the user provides CSS/style changes with a DOM Path from browser preview, locate the target element in source JSX/TSX using the class names and element path, then update Tailwind classes or inline styles accordingly — do not write new CSS files.
- The user prefers **compound shell commands** in PowerShell — prefer `;` to chain commands rather than `&&` (which is bash syntax and not supported in PowerShell). Use `cmd.exe /c "cd /d path && command"` as a workaround when bash-style `&&` is needed.

## Learned Workspace Facts
- In `local_trusted` mode, the server must ensure `AIDEVELO_AGENT_JWT_SECRET` is generated and available so local agents can inject `AIDEVELO_API_KEY` during heartbeats.
- When creating a CEO agent, provision the default agent workspace under `workspaces/<agentId>/` with PARA directories (`life/projects`, `life/areas/*`, `life/resources`, `life/archives`) plus `memory/`, seed `MEMORY.md`, and write `HEARTBEAT.md`, `SOUL.md`, and `TOOLS.md` at the workspace root.
- For CEO agents running `opencode_local`, inline required `$AGENT_HOME/HEARTBEAT.md` / `SOUL.md` / `TOOLS.md` contents into the prompt and explicitly forbid `read`/`glob` tool calls to prevent `external_directory` permission rejections.
- Company deletion must delete dependent tables in foreign-key-safe order (e.g. delete `company_skills`, then `cost_events`/`finance_events`, then `heartbeat_runs`) to prevent 500s from FK constraint violations.
- **Vercel deployment**: The project uses a dedicated `server/src/vercel-entry.ts` entrypoint for Vercel serverless functions (not `server/src/index.ts` which is long-running). Cron handlers are at `server/src/routes/worker/cron-dispatch.ts` and `server/src/routes/worker/cron-heartbeat-tick.ts`. `turbo.json` and `vercel.json` at the repo root configure the build.
- **UI cache issue**: When Virtual Office or React UI changes don't appear in the browser, it is almost always browser cache — restart Vite (`pnpm dev`) or do a hard refresh (Ctrl+Shift+R) before assuming code is broken.

## Cursor Cloud specific instructions

### Services

| Service | Port | Start command |
|---------|------|---------------|
| API + UI (dev middleware) | 3100 | `pnpm dev` from repo root |

The single `pnpm dev` command starts everything needed: embedded PostgreSQL (auto-provisioned, no `DATABASE_URL` required), Express API server, and Vite dev middleware for the UI — all served on `http://localhost:3100`.

### Key commands

See `CLAUDE.md` for the canonical quick-start. Summary of verification commands:

- **Lint/Typecheck**: `pnpm -r typecheck` (pre-existing TS errors in `server/` due to Express `req.actor` typing — these do not block dev mode which uses `tsx`)
- **Tests**: `pnpm test:run` (Vitest)
- **Build**: `pnpm build` (same TS errors will cause server build to fail; other packages build fine)
- **Health check**: `curl http://localhost:3100/api/health`

### Gotchas

- The server uses `tsx` at runtime (not compiled JS), so TypeScript build errors in `server/` do not prevent the dev server from running.
- Embedded PostgreSQL data lives at `~/.aidevelo/instances/default/db`. To reset: `rm -rf ~/.aidevelo/instances/default/db` then restart.
- `pnpm dev` runs in watch mode by default and auto-applies pending migrations.
- No `.env` file is needed for local development — the server defaults to `local_trusted` mode with embedded Postgres and local disk storage.
