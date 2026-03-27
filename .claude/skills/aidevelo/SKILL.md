```markdown
# aidevelo Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches you the core development patterns, coding conventions, and common workflows used in the `aidevelo` TypeScript codebase. The repository is organized with clear modularity, uses conventional commits, and emphasizes maintainability through structured documentation, database migrations, and robust API design. There is no major framework in use, but the project leverages Drizzle for database schemas and Vitest for testing.

## Coding Conventions

**File Naming**
- Use **PascalCase** for file names.
  - Example: `JobQueue.ts`, `UserService.ts`

**Import Style**
- Use **relative imports** for all modules.
  - Example:
    ```typescript
    import { JobQueue } from '../services/JobQueue'
    ```

**Export Style**
- Use **named exports**.
  - Example:
    ```typescript
    export function createJobQueue() { ... }
    export const JOB_QUEUE_STATUS = { ... }
    ```

**Commit Messages**
- Use **conventional commit** prefixes: `feat`, `docs`, `db`, `chore`, `deploy`
- Example:
  ```
  feat: add job queue worker and API endpoint
  docs: add usage guide for background workers
  db: create migration for jobs table
  ```

## Workflows

### Add Background Worker Feature
**Trigger:** When you want to add a new background worker for async job processing  
**Command:** `/add-background-worker`

1. Write an implementation plan and design spec in `docs/superpowers/plans/` and `docs/superpowers/specs/`.
2. Add a new Drizzle schema file for the worker's table in `packages/db/src/schema/`, and update `index.ts` to export it.
3. Create a new SQL migration in `packages/db/src/migrations/`.
4. Implement the job queue service in `server/src/services/job-queue.ts` and register it in `server/src/services/index.ts`.
5. Create the worker entrypoint in `server/src/worker/index.ts` and handler(s) in `server/src/worker/handlers/`.
6. Add or modify API endpoints in `server/src/routes/`, and update `server/src/app.ts` to register them.
7. Integrate the worker with relevant routes as needed.
8. Update deployment configuration in `render.yaml`.
9. Document usage and patterns in project docs (e.g., `CLAUDE.md`).

**Example:**  
_Adding a new worker handler:_
```typescript
// server/src/worker/handlers/EmailWorker.ts
export function handleEmailJob(job) {
  // process email job
}
```

### Add Database Table
**Trigger:** When you want to introduce a new table to the database  
**Command:** `/new-table`

1. Create a new Drizzle schema file for the table in `packages/db/src/schema/`.
2. Update `packages/db/src/schema/index.ts` to export the new table.
3. Write a SQL migration for the new table in `packages/db/src/migrations/`.

**Example:**  
```typescript
// packages/db/src/schema/Notifications.ts
import { pgTable, serial, varchar } from 'drizzle-orm/pg-core'

export const Notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  message: varchar('message', { length: 255 }),
})
```

### Add API Endpoint
**Trigger:** When you want to expose a new API endpoint  
**Command:** `/new-endpoint`

1. Create a new route file for the endpoint in `server/src/routes/`.
2. Register the new route in `server/src/app.ts`.

**Example:**  
```typescript
// server/src/routes/notifications.ts
import { Router } from 'express'
export const notificationsRouter = Router()
notificationsRouter.get('/', async (req, res) => {
  // handle request
})

// server/src/app.ts
import { notificationsRouter } from './routes/notifications'
app.use('/api/notifications', notificationsRouter)
```

### Add Feature Documentation
**Trigger:** When you want to document a new feature or architectural pattern  
**Command:** `/add-docs`

1. Write or update an implementation plan in `docs/superpowers/plans/`.
2. Write or update a design spec in `docs/superpowers/specs/`.
3. Update main documentation files (e.g., `CLAUDE.md`) with patterns or usage.

**Example:**  
_Adding a new plan:_
```
docs/superpowers/plans/background-worker.md
```

## Testing Patterns

- **Framework:** [Vitest](https://vitest.dev/)
- **Test file pattern:** `*.test.ts`
- **Location:** Test files are co-located with the code or in relevant directories.
- **Example:**
  ```typescript
  // server/src/services/job-queue.test.ts
  import { describe, it, expect } from 'vitest'
  import { createJobQueue } from './job-queue'

  describe('JobQueue', () => {
    it('should enqueue a job', () => {
      const queue = createJobQueue()
      queue.enqueue({ type: 'email', payload: {} })
      expect(queue.size()).toBe(1)
    })
  })
  ```

## Commands

| Command               | Purpose                                                      |
|-----------------------|--------------------------------------------------------------|
| /add-background-worker| Scaffold a new background worker feature and related files   |
| /new-table            | Add a new database table (schema + migration)                |
| /new-endpoint         | Add a new API endpoint (route + registration)                |
| /add-docs             | Add or update feature documentation                          |
```