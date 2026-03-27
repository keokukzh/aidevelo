# CLAUDE.md — AIDEVELO AI Agent Orchestration Platform

## Quick Start

```bash
# Install deps (use pnpm)
npm exec -- pnpm@9.15.4 -- install

# Build all packages
npm exec -- pnpm@9.15.4 -- build

# Run server (port 3100)
cd server && npm exec -- tsx src/index.ts

# Run UI dev (port 5173, proxies /api to 3100)
cd ui && npm exec -- vite
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, Tailwind CSS, Radix UI |
| Backend | Express 5, TypeScript, better-auth, drizzle-orm |
| Database | Supabase PostgreSQL + embedded Postgres for local |
| AI | MiniMax Anthropic-compatible API (M2.7-highspeed) |
| Runtime | tsx for monorepo TypeScript |
| Storage | Cloudflare R2 |

## Key Paths

```
aidevelo/
├── server/src/           # Express API (port 3100)
├── ui/src/              # React frontend (port 5173)
├── packages/db/src/     # Drizzle schema
├── server/src/routes/    # API endpoints
├── server/src/services/  # Business logic services
├── server/src/worker/    # Background worker process
└── .env                 # Local env vars (PORT=3100, SERVE_UI=false)
```

## Critical Rules

1. **NEVER commit secrets** — Use environment variables
2. **Use tsx for server** — Required for monorepo compatibility
3. **RLS is enforced** — All queries respect tenant isolation
4. **pnpm workspace** — Use `npm exec -- pnpm@9.15.4 -- <command>` (not plain pnpm)
5. **embedded Postgres** — Runs on dynamic port (54329) when no DATABASE_URL
6. **createDb() requires URL** — Use `createDb(getDatabaseUrl())`, not empty

## Service Pattern

Services follow `function serviceName(db: Db)` returning an object with methods:

```typescript
export function jobQueueService(db: Db) {
  return {
    enqueue: async (...) => { ... },
    getJob: async (...) => { ... },
  };
}
```

## Handler Pattern

Background worker handlers export:

```typescript
export const handler = {
  execute: async (payload) => Promise<{ success: boolean; skipped?: boolean }>,
  getTimeoutMs: () => number,
};
```

## Key Commands

```bash
# TypeScript check
cd server && npm exec -- tsc --noEmit

# Run migration
cd packages/db && npm exec -- tsx src/migrate.ts

# Build all packages
npm exec -- pnpm@9.15.4 -- build
```

## Background Worker

- Worker process at `server/src/worker/index.ts`
- Job queue via `background_jobs` table with `FOR UPDATE SKIP LOCKED`
- Handlers in `server/src/worker/handlers/`
- Job status API at `GET/POST /api/companies/:id/jobs/:jobId`

## API Endpoints

- Health: `GET http://localhost:3100/api/health`
- Dashboard: `GET http://localhost:3100/api/companies/:id/dashboard`
- Issues: `GET/POST/PATCH http://localhost:3100/api/issues`

## Troubleshooting

| Error | Fix |
|-------|-----|
| `MODULE_NOT_FOUND` | Run `npm exec -- pnpm@9.15.4 -- install` |
| `workspace:*` protocol error | Use pnpm: `npm exec -- pnpm@9.15.4 -- install` |
| 500 on comments | Retry without `?after=` filter |

## Full Onboarding Docs

See `AGENTS_ONBOARDING.md` for agent-specific context, company state, and issue workflows.
