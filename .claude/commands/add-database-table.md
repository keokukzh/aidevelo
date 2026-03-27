---
name: add-database-table
description: Workflow command scaffold for add-database-table in aidevelo.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-database-table

Use this workflow when working on **add-database-table** in `aidevelo`.

## Goal

Adds a new database table, including Drizzle schema, migration, and schema index update.

## Common Files

- `packages/db/src/schema/*.ts`
- `packages/db/src/schema/index.ts`
- `packages/db/src/migrations/*.sql`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create new Drizzle schema file for the table.
- Update schema index to export the new table.
- Write SQL migration for the new table.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.