---
name: add-background-worker-feature
description: Workflow command scaffold for add-background-worker-feature in aidevelo.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-background-worker-feature

Use this workflow when working on **add-background-worker-feature** in `aidevelo`.

## Goal

Implements a new background worker system, including database schema, migration, services, handlers, entrypoint, API endpoints, deployment configuration, and documentation/specs.

## Common Files

- `docs/superpowers/plans/*.md`
- `docs/superpowers/specs/*.md`
- `packages/db/src/schema/*.ts`
- `packages/db/src/schema/index.ts`
- `packages/db/src/migrations/*.sql`
- `server/src/services/job-queue.ts`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Write implementation plan and design spec in docs.
- Add new Drizzle schema file and update schema index.
- Create new SQL migration for the table.
- Implement job queue service and register in services index.
- Create worker entrypoint and handler files.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.