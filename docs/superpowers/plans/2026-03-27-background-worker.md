# Background Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a PostgreSQL-based polling worker to handle workspace cleanup, routine dispatch, and heartbeat tick asynchronously with proper locking for horizontal scaling.

**Architecture:** Worker process polls `background_jobs` table using `FOR UPDATE SKIP LOCKED`, executes jobs with timeout and retry logic, self-schedules heartbeat tick to maintain continuous operation.

**Tech Stack:** Drizzle ORM, PostgreSQL, tsx, Express routes pattern

---

## File Structure

```
packages/db/src/
  ├── schema/
  │   └── background-jobs.ts       # Drizzle schema for background_jobs table
  └── migrations/
      └── 0045_add_background_jobs.sql

server/src/
  ├── services/
  │   └── job-queue.ts            # Job queue service (enqueue, cancel, get, list)
  ├── worker/
  │   ├── index.ts                # Worker entry point and main loop
  │   └── handlers/
  │       ├── workspace-cleanup.ts
  │       ├── routine-dispatch.ts
  │       └── heartbeat-tick.ts
  └── routes/
      └── worker-jobs.ts          # Job status API

Modified:
  server/src/routes/execution-workspaces.ts
  server/src/services/routines.ts
  render.yaml
```

---

## Task 1: Database Schema - Migration

**Files:**
- Create: `packages/db/src/migrations/0045_add_background_jobs.sql`
- Modify: `packages/db/src/schema/index.ts` (add export)
- Modify: `packages/db/src/schema/background-jobs.ts` (create)

- [ ] **Step 1: Create migration file**

```sql
-- packages/db/src/migrations/0045_add_background_jobs.sql

CREATE TABLE "background_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid REFERENCES "companies"("id") ON DELETE CASCADE,
  -- Note: company_id is NULL for heartbeat_tick (global job)
  "job_type" text NOT NULL,
  -- 'workspace_cleanup' | 'routine_dispatch' | 'heartbeat_tick'
  "job_payload" jsonb NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  -- 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  "priority" integer DEFAULT 0,
  "max_attempts" integer DEFAULT 3,
  "attempts" integer DEFAULT 0,
  "last_error" text,
  "scheduled_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "next_retry_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW()
);

-- Index for worker polling (only pending/processing jobs)
CREATE INDEX "background_jobs_status_scheduled_idx"
  ON "background_jobs"("status", "scheduled_at")
  WHERE "status" IN ('pending', 'processing');

-- Index for company-scoped queries
CREATE INDEX "background_jobs_company_type_idx"
  ON "background_jobs"("company_id", "job_type");

-- Index for retry logic
CREATE INDEX "background_jobs_retry_idx"
  ON "background_jobs"("next_retry_at")
  WHERE "status" = 'pending' AND "next_retry_at" IS NOT NULL;
```

- [ ] **Step 2: Run migration to verify**

```bash
cd packages/db && npm exec -- tsx src/migrate.ts
```

Expected: Migration 0045 applies successfully

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/migrations/0045_add_background_jobs.sql
git commit -m "db: add background_jobs table for async job queue"
```

---

## Task 2: Database Schema - Drizzle Model

**Files:**
- Create: `packages/db/src/schema/background-jobs.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Create Drizzle schema file**

```typescript
// packages/db/src/schema/background-jobs.ts
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const backgroundJobs = pgTable(
  "background_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "cascade",
    }),
    jobType: text("job_type").notNull(),
    jobPayload: jsonb("job_payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("pending"),
    priority: integer("priority").default(0),
    maxAttempts: integer("max_attempts").default(3),
    attempts: integer("attempts").default(0),
    lastError: text("last_error"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    statusScheduledIdx: index("background_jobs_status_scheduled_idx").on(
      table.status,
      table.scheduledAt,
    ),
    companyTypeIdx: index("background_jobs_company_type_idx").on(
      table.companyId,
      table.jobType,
    ),
    retryIdx: index("background_jobs_retry_idx").on(table.nextRetryAt),
  }),
);

export type BackgroundJob = typeof backgroundJobs.$inferSelect;
export type NewBackgroundJob = typeof backgroundJobs.$inferInsert;
```

- [ ] **Step 2: Export from schema index**

Add to `packages/db/src/schema/index.ts`:
```typescript
export { backgroundJobs } from "./background-jobs.js";
export type { BackgroundJob, NewBackgroundJob } from "./background-jobs.js";
```

- [ ] **Step 3: Verify schema compiles**

```bash
cd packages/db && npm exec -- tsc --noEmit
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/background-jobs.ts packages/db/src/schema/index.ts
git commit -m "db: add backgroundJobs Drizzle schema"
```

---

## Task 3: Job Queue Service

**Files:**
- Create: `server/src/services/job-queue.ts`

- [ ] **Step 1: Create job queue service with types**

```typescript
// server/src/services/job-queue.ts
import { and, desc, eq, isNull, lte, or } from "drizzle-orm";
import type { Db, BackgroundJob, NewBackgroundJob } from "@aideveloai/db";
import { backgroundJobs } from "@aideveloai/db";

export type JobType = "workspace_cleanup" | "routine_dispatch" | "heartbeat_tick";

export interface WorkspaceCleanupPayload {
  workspaceId: string;
  cleanupReason: "archive" | "delete" | "idle_timeout" | "manual";
  force?: boolean;
}

export interface RoutineDispatchPayload {
  triggerId: string;
  routineId: string;
  companyId: string;
  scheduledTick: string;
}

export interface HeartbeatTickPayload {
  tickTimestamp: string;
}

export type JobPayload = WorkspaceCleanupPayload | RoutineDispatchPayload | HeartbeatTickPayload;

export interface ListJobsOptions {
  status?: string;
  jobType?: JobType;
  limit?: number;
  cursor?: string;
}

export interface JobQueueService {
  enqueue<T extends JobPayload>(
    jobType: JobType,
    companyId: string | null,
    payload: T,
    options?: {
      priority?: number;
      scheduledAt?: Date;
      maxAttempts?: number;
    },
  ): Promise<BackgroundJob>;

  cancel(jobId: string): Promise<void>;
  getJob(jobId: string): Promise<BackgroundJob | null>;
  listJobs(companyId: string, options?: ListJobsOptions): Promise<BackgroundJob[]>;

  // Internal: acquire job with SKIP LOCKED
  acquireNextJob(): Promise<BackgroundJob | null>;
  markProcessing(jobId: string): Promise<void>;
  markCompleted(jobId: string): Promise<void>;
  markFailed(jobId: string, error: string, retryable: boolean): Promise<void>;
}

export function jobQueueService(db: Db): JobQueueService {
  return {
    async enqueue(jobType, companyId, payload, options = {}) {
      const now = new Date();
      const scheduledAt = options.scheduledAt ?? now;
      const maxAttempts = options.maxAttempts ?? 3;

      const [job] = await db
        .insert(backgroundJobs)
        .values({
          companyId: companyId ?? null,
          jobType,
          jobPayload: payload as Record<string, unknown>,
          status: "pending",
          priority: options.priority ?? 0,
          maxAttempts,
          scheduledAt,
        })
        .returning();

      return job;
    },

    async cancel(jobId) {
      await db
        .update(backgroundJobs)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(
          and(
            eq(backgroundJobs.id, jobId),
            eq(backgroundJobs.status, "pending"),
          ),
        );
    },

    async getJob(jobId) {
      const [job] = await db
        .select()
        .from(backgroundJobs)
        .where(eq(backgroundJobs.id, jobId));
      return job ?? null;
    },

    async listJobs(companyId, options = {}) {
      const { status, jobType, limit = 50, cursor } = options;

      const conditions = [eq(backgroundJobs.companyId, companyId)];
      if (status) conditions.push(eq(backgroundJobs.status, status));
      if (jobType) conditions.push(eq(backgroundJobs.jobType, jobType));
      if (cursor) conditions.push(lte(backgroundJobs.createdAt, new Date(cursor)));

      const jobs = await db
        .select()
        .from(backgroundJobs)
        .where(and(...conditions))
        .orderBy(desc(backgroundJobs.createdAt))
        .limit(limit + 1);

      const hasMore = jobs.length > limit;
      if (hasMore) jobs.pop();

      return jobs;
    },

    async acquireNextJob() {
      // Use raw SQL for FOR UPDATE SKIP LOCKED
      const result = await db.transaction(async (tx) => {
        const [job] = await tx
          .select()
          .from(backgroundJobs)
          .where(
            and(
              eq(backgroundJobs.status, "pending"),
              lte(backgroundJobs.scheduledAt, new Date()),
              or(
                isNull(backgroundJobs.nextRetryAt),
                lte(backgroundJobs.nextRetryAt, new Date()),
              ),
            ),
          )
          .orderBy(desc(backgroundJobs.priority), backgroundJobs.scheduledAt)
          .limit(1)
          // @ts-expect-error - Drizzle doesn't support FOR UPDATE SKIP LOCKED natively
          .for("update skip locked");

        if (!job) return null;

        await tx
          .update(backgroundJobs)
          .set({
            status: "processing",
            startedAt: new Date(),
            attempts: job.attempts + 1,
            updatedAt: new Date(),
          })
          .where(eq(backgroundJobs.id, job.id));

        return job;
      });

      return result ?? null;
    },

    async markProcessing(jobId) {
      await db
        .update(backgroundJobs)
        .set({ status: "processing", updatedAt: new Date() })
        .where(eq(backgroundJobs.id, jobId));
    },

    async markCompleted(jobId) {
      await db
        .update(backgroundJobs)
        .set({
          status: "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(backgroundJobs.id, jobId));
    },

    async markFailed(jobId, error, retryable) {
      const job = await this.getJob(jobId);
      if (!job) return;

      const shouldRetry = retryable && job.attempts < job.maxAttempts;
      const backoffMs = Math.min(30000 * Math.pow(2, job.attempts - 1), 300000);

      if (shouldRetry) {
        await db
          .update(backgroundJobs)
          .set({
            status: "pending",
            lastError: error,
            nextRetryAt: new Date(Date.now() + backoffMs),
            updatedAt: new Date(),
          })
          .where(eq(backgroundJobs.id, jobId));
      } else {
        await db
          .update(backgroundJobs)
          .set({
            status: "failed",
            lastError: `Final failure after ${job.attempts} attempts: ${error}`,
            updatedAt: new Date(),
          })
          .where(eq(backgroundJobs.id, jobId));
      }
    },
  };
}
```

- [ ] **Step 2: Export from services index**

Check `server/src/services/index.ts` and add export if needed.

- [ ] **Step 3: Verify compiles**

```bash
cd server && npm exec -- tsc --noEmit src/services/job-queue.ts
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add server/src/services/job-queue.ts
git commit -m "feat(worker): add job queue service for background job management"
```

---

## Task 4: Worker Entry Point

**Files:**
- Create: `server/src/worker/index.ts`

- [ ] **Step 1: Create worker entry point**

```typescript
// server/src/worker/index.ts
import { jobQueueService, type JobType } from "../services/job-queue.js";
import { workspaceCleanupHandler } from "./handlers/workspace-cleanup.js";
import { routineDispatchHandler } from "./handlers/routine-dispatch.js";
import { heartbeatTickHandler } from "./handlers/heartbeat-tick.js";
import { createDb } from "@aideveloai/db";
import pino from "pino";

const log = pino({ level: "info" });

interface WorkerConfig {
  pollIntervalMs: number;
  jobTimeoutMs: number;
  maxRetries: number;
  retryBackoffMs: number;
}

const HANDLERS: Record<JobType, { execute: (payload: unknown) => Promise<{ success: boolean; skipped?: boolean }>; getTimeoutMs: () => number }> = {
  workspace_cleanup: workspaceCleanupHandler,
  routine_dispatch: routineDispatchHandler,
  heartbeat_tick: heartbeatTickHandler,
};

let isShuttingDown = false;
let currentJobCompletion: Promise<void> | null = null;

export function createWorker(config: WorkerConfig) {
  const db = createDb();
  const jobQueue = jobQueueService(db);

  async function runJobCycle() {
    if (isShuttingDown) return;

    try {
      const job = await jobQueue.acquireNextJob();
      if (!job) return;

      log.info({
        jobId: job.id,
        jobType: job.jobType,
        companyId: job.companyId,
        attempt: job.attempts,
      }, "Job acquired");

      const handler = HANDLERS[job.jobType as JobType];
      if (!handler) {
        await jobQueue.markFailed(job.id, `Unknown job type: ${job.jobType}`, false);
        return;
      }

      // Execute with timeout
      const timeoutMs = handler.getTimeoutMs();
      const executePromise = handler.execute(job.jobPayload);
      const timeoutPromise = new Promise<{ success: false; error: string }>((_, reject) =>
        setTimeout(() => reject(new Error("Job timeout")), timeoutMs),
      );

      let result: { success: boolean; skipped?: boolean };
      try {
        const raceResult = await Promise.race([executePromise, timeoutPromise]);
        result = raceResult;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error({ jobId: job.id, error: errorMessage }, "Job failed");
        await jobQueue.markFailed(job.id, errorMessage, true);
        return;
      }

      if (result.success) {
        await jobQueue.markCompleted(job.id);
        log.info({ jobId: job.id }, "Job completed");
      } else if (result.skipped) {
        await jobQueue.markCompleted(job.id);
        log.info({ jobId: job.id }, "Job skipped");
      }
    } catch (error) {
      log.error({ error }, "Unexpected error in job cycle");
    }
  }

  async function workerLoop() {
    log.info("Worker loop started");
    while (!isShuttingDown) {
      await runJobCycle();
      await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
    }
    log.info("Worker loop stopped");
  }

  async function shutdown() {
    log.info("Worker receiving shutdown signal");
    isShuttingDown = true;

    if (currentJobCompletion) {
      try {
        await Promise.race([
          currentJobCompletion,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Graceful shutdown timeout")), 30000),
          ),
        ]);
      } catch {
        log.error("Shutdown timeout exceeded");
      }
    }

    log.info("Worker exiting");
    process.exit(0);
  }

  return {
    start: workerLoop,
    shutdown,
  };
}

// Bootstrap: enqueue initial heartbeat tick
async function bootstrap() {
  const db = createDb();
  const jobQueue = jobQueueService(db);

  // Enqueue initial heartbeat tick
  await jobQueue.enqueue("heartbeat_tick", null, {
    tickTimestamp: new Date().toISOString(),
  });

  log.info("Bootstrap complete: initial heartbeat tick enqueued");
}

// Main entry point
async function main() {
  const config: WorkerConfig = {
    pollIntervalMs: 5000,
    jobTimeoutMs: 300000,
    maxRetries: 3,
    retryBackoffMs: 30000,
  };

  process.on("SIGTERM", () => createWorker(config).shutdown());

  await bootstrap();
  await createWorker(config).start();
}

main().catch((error) => {
  console.error("Worker failed to start:", error);
  process.exit(1);
});
```

- [ ] **Step 2: Verify compiles**

```bash
cd server && npm exec -- tsc --noEmit src/worker/index.ts
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add server/src/worker/index.ts
git commit -m "feat(worker): add worker entry point with polling loop and graceful shutdown"
```

---

## Task 5: Workspace Cleanup Handler

**Files:**
- Create: `server/src/worker/handlers/workspace-cleanup.ts`

- [ ] **Step 1: Create workspace cleanup handler**

```typescript
// server/src/worker/handlers/workspace-cleanup.ts
import { createDb, executionWorkspaces, projectWorkspaces } from "@aideveloai/db";
import { eq } from "drizzle-orm";
import { cleanupExecutionWorkspaceArtifacts } from "../../services/workspace-runtime.js";
import type { JobQueueService, WorkspaceCleanupPayload } from "../../services/job-queue.js";
import { jobQueueService } from "../../services/job-queue.js";

export const workspaceCleanupHandler = {
  async execute(payload: unknown): Promise<{ success: boolean; skipped?: boolean }> {
    const { workspaceId, cleanupReason, force } = payload as WorkspaceCleanupPayload;
    const db = createDb();

    // Fetch workspace with related data
    const [workspace] = await db
      .select()
      .from(executionWorkspaces)
      .where(eq(executionWorkspaces.id, workspaceId));

    if (!workspace) {
      return { success: false, skipped: true };
    }

    // Fetch project workspace if linked
    let projectWorkspace = null;
    if (workspace.projectWorkspaceId) {
      const [pw] = await db
        .select()
        .from(projectWorkspaces)
        .where(eq(projectWorkspaces.id, workspace.projectWorkspaceId));
      projectWorkspace = pw ?? null;
    }

    // Execute cleanup
    await cleanupExecutionWorkspaceArtifacts({
      workspace: {
        id: workspace.id,
        cwd: workspace.cwd,
        providerType: workspace.providerType,
        providerRef: workspace.providerRef,
        branchName: workspace.branchName,
        repoUrl: workspace.repoUrl,
        baseRef: workspace.baseRef,
        projectId: workspace.projectId,
        projectWorkspaceId: workspace.projectWorkspaceId,
        sourceIssueId: workspace.sourceIssueId,
        metadata: workspace.metadata as Record<string, unknown> | null,
      },
      projectWorkspace: projectWorkspace
        ? {
            cwd: projectWorkspace.cwd,
            cleanupCommand: projectWorkspace.cleanupCommand,
          }
        : null,
      force: force ?? false,
    });

    return { success: true };
  },

  getTimeoutMs(): number {
    return 60000; // 1 minute
  },
};
```

- [ ] **Step 2: Verify compiles**

```bash
cd server && npm exec -- tsc --noEmit src/worker/handlers/workspace-cleanup.ts
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add server/src/worker/handlers/workspace-cleanup.ts
git commit -m "feat(worker): add workspace cleanup handler"
```

---

## Task 6: Routine Dispatch Handler

**Files:**
- Create: `server/src/worker/handlers/routine-dispatch.ts`

- [ ] **Step 1: Create routine dispatch handler**

```typescript
// server/src/worker/handlers/routine-dispatch.ts
import { createDb, routineTriggers } from "@aideveloai/db";
import { eq } from "drizzle-orm";
import { routineService } from "../../services/routines.js";
import type { RoutineDispatchPayload } from "../../services/job-queue.js";

export const routineDispatchHandler = {
  async execute(payload: unknown): Promise<{ success: boolean; skipped?: boolean }> {
    const { triggerId, routineId, companyId, scheduledTick } =
      payload as RoutineDispatchPayload;
    const db = createDb();
    const routines = routineService(db);

    // Check trigger is still due (prevent stale dispatch)
    const [trigger] = await db
      .select()
      .from(routineTriggers)
      .where(eq(routineTriggers.id, triggerId));

    if (!trigger) {
      return { success: false, skipped: true };
    }

    // If nextRunAt has advanced past our scheduled tick, we've already run
    if (trigger.nextRunAt > new Date(scheduledTick)) {
      return { success: false, skipped: true };
    }

    // Dispatch the routine
    await routines.dispatchRoutineRun({
      routineId,
      triggerId,
      companyId,
    });

    return { success: true };
  },

  getTimeoutMs(): number {
    return 120000; // 2 minutes
  },
};
```

- [ ] **Step 2: Verify compiles**

```bash
cd server && npm exec -- tsc --noEmit src/worker/handlers/routine-dispatch.ts
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add server/src/worker/handlers/routine-dispatch.ts
git commit -m "feat(worker): add routine dispatch handler"
```

---

## Task 7: Heartbeat Tick Handler

**Files:**
- Create: `server/src/worker/handlers/heartbeat-tick.ts`

- [ ] **Step 1: Create heartbeat tick handler**

```typescript
// server/src/worker/handlers/heartbeat-tick.ts
import { createDb, routineTriggers } from "@aideveloai/db";
import { and, eq, lte } from "drizzle-orm";
import { heartbeatService } from "../../services/heartbeat.js";
import { jobQueueService } from "../../services/job-queue.js";

export const heartbeatTickHandler = {
  async execute(payload: unknown): Promise<{ success: boolean; skipped?: boolean }> {
    const { tickTimestamp } = payload as { tickTimestamp: string };
    const db = createDb();
    const jobQueue = jobQueueService(db);
    const heartbeat = heartbeatService(db);

    // 1. Process timer-based wakeups for all companies
    await heartbeat.tickTimers(tickTimestamp);

    // 2. Find routine triggers that are due, enqueue routine_dispatch jobs
    const dueTriggers = await db
      .select()
      .from(routineTriggers)
      .where(
        and(
          eq(routineTriggers.kind, "cron"),
          eq(routineTriggers.enabled, true),
          lte(routineTriggers.nextRunAt, new Date()),
        ),
      );

    for (const trigger of dueTriggers) {
      await jobQueue.enqueue("routine_dispatch", trigger.companyId, {
        triggerId: trigger.id,
        routineId: trigger.routineId,
        companyId: trigger.companyId,
        scheduledTick: trigger.nextRunAt.toISOString(),
      });
    }

    // 3. Schedule next heartbeat tick
    await jobQueue.enqueue(
      "heartbeat_tick",
      null,
      {
        tickTimestamp: new Date(Date.now() + 30000).toISOString(),
      },
      { priority: -1 }, // Lower priority than other jobs
    );

    return { success: true };
  },

  getTimeoutMs(): number {
    return 30000; // 30 seconds
  },
};
```

- [ ] **Step 2: Verify compiles**

```bash
cd server && npm exec -- tsc --noEmit src/worker/handlers/heartbeat-tick.ts
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add server/src/worker/handlers/heartbeat-tick.ts
git commit -m "feat(worker): add heartbeat tick handler with routine trigger dispatch"
```

---

## Task 8: Job Status API

**Files:**
- Create: `server/src/routes/worker-jobs.ts`

- [ ] **Step 1: Create job status API routes**

```typescript
// server/src/routes/worker-jobs.ts
import { Router } from "express";
import type { Db } from "@aideveloai/db";
import { jobQueueService } from "../services/job-queue.js";
import { assertCompanyAccess } from "./authz.js";

export function workerJobRoutes(db: Db) {
  const router = Router();
  const jobQueue = jobQueueService(db);

  // GET /api/companies/:companyId/jobs - List jobs for company
  router.get("/companies/:companyId/jobs", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const { status, jobType, limit, cursor } = req.query as Record<string, string>;

    const jobs = await jobQueue.listJobs(companyId, {
      status,
      jobType: jobType as "workspace_cleanup" | "routine_dispatch" | "heartbeat_tick",
      limit: limit ? parseInt(limit, 10) : 50,
      cursor,
    });

    const nextCursor = jobs.length > 0
      ? jobs[jobs.length - 1].createdAt.toISOString()
      : null;

    res.json({
      jobs: jobs.map((job) => ({
        id: job.id,
        jobType: job.jobType,
        status: job.status,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        lastError: job.lastError,
        attempts: job.attempts,
      })),
      pagination: {
        cursor: nextCursor,
        hasMore: jobs.length > (parseInt(limit ?? "50", 10)),
      },
    });
  });

  // GET /api/companies/:companyId/jobs/:jobId - Get job details
  router.get("/companies/:companyId/jobs/:jobId", async (req, res) => {
    const { companyId, jobId } = req.params;
    assertCompanyAccess(req, companyId as string);

    const job = await jobQueue.getJob(jobId as string);

    if (!job || job.companyId !== companyId) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    res.json({
      id: job.id,
      jobType: job.jobType,
      jobPayload: job.jobPayload,
      status: job.status,
      priority: job.priority,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      lastError: job.lastError,
      scheduledAt: job.scheduledAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      nextRetryAt: job.nextRetryAt,
      createdAt: job.createdAt,
    });
  });

  // POST /api/companies/:companyId/jobs/:jobId/cancel - Cancel pending job
  router.post("/companies/:companyId/jobs/:jobId/cancel", async (req, res) => {
    const { companyId, jobId } = req.params;
    assertCompanyAccess(req, companyId as string);

    const job = await jobQueue.getJob(jobId as string);

    if (!job || job.companyId !== companyId) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    if (job.status !== "pending") {
      res.status(409).json({ error: "Can only cancel pending jobs" });
      return;
    }

    await jobQueue.cancel(jobId as string);
    res.json({ success: true });
  });

  return router;
}
```

- [ ] **Step 2: Register routes in app.ts**

Add to `server/src/app.ts`:
```typescript
import { workerJobRoutes } from "./routes/worker-jobs.js";

// In createApp function, after other routes:
app.use("/api", workerJobRoutes(db));
```

- [ ] **Step 3: Verify compiles**

```bash
cd server && npm exec -- tsc --noEmit
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/worker-jobs.ts server/src/app.ts
git commit -m "feat(api): add job status API endpoints"
```

---

## Task 9: Integrate with Execution Workspaces

**Files:**
- Modify: `server/src/routes/execution-workspaces.ts`

- [ ] **Step 1: Make workspace cleanup async**

In `server/src/routes/execution-workspaces.ts`, modify the PATCH handler:

Find the section around lines 91-153 that calls `cleanupExecutionWorkspaceArtifacts` synchronously and replace with async enqueue:

```typescript
// Instead of:
try {
  await stopRuntimeServicesForExecutionWorkspace({ ... });
  const projectWorkspace = ...;
  await cleanupExecutionWorkspaceArtifacts({ ... });
  // success path
} catch (failureReason) {
  // error path
}

// Replace with:
try {
  await stopRuntimeServicesForExecutionWorkspace({ ... });

  // Enqueue async cleanup
  const jobQueue = jobQueueService(db);
  await jobQueue.enqueue("workspace_cleanup", existing.companyId, {
    workspaceId: existing.id,
    cleanupReason: "archive",
  });

  const updatedWorkspace = await svc.update(id, {
    status: "archived",
    closedAt,
    cleanupReason: null,
  });
  res.json(updatedWorkspace);
} catch (failureReason) {
  const updatedWorkspace = await svc.update(id, patch);
  res.status(500).json({
    error: `Failed to archive execution workspace: ${failureReason}`,
  });
}
```

- [ ] **Step 2: Verify compiles**

```bash
cd server && npm exec -- tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/execution-workspaces.ts
git commit -m "feat(worker): enqueue workspace cleanup jobs instead of running synchronously"
```

---

## Task 10: Update Render Configuration

**Files:**
- Modify: `render.yaml`

- [ ] **Step 1: Add worker service to render.yaml**

```yaml
# Add to render.yaml
services:
  # ... existing API service ...

  - name: aidevelo-worker
    region: oregon
    runtime: node
    nodeVersion: "20"
    buildCommand: npm exec -- pnpm@9.15.4 -- build
    startCommand: node server/dist/worker/index.js
    envVars:
      - key: DATABASE_URL
        fromService:
          name: aidevelo-api
          envVarKey: DATABASE_URL
      - key: NODE_ENV
        value: production
      - key: PORT
        value: "3001"
```

- [ ] **Step 2: Commit**

```bash
git add render.yaml
git commit -m "deploy: add worker service to render.yaml"
```

---

## Verification

After implementation, verify the following:

1. **Workspace Cleanup:**
   ```bash
   # Create and archive workspace, verify:
   # - API returns immediately
   # - Job appears in background_jobs table
   # - Cleanup executes within 1 minute
   ```

2. **Routine Dispatch:**
   ```bash
   # Create routine with cron trigger, wait for scheduled time, verify:
   # - Job appears in background_jobs table
   # - Routine runs
   ```

3. **Heartbeat Tick:**
   ```bash
   # Verify heartbeat_tick jobs self-schedule every 30s:
   SELECT * FROM background_jobs WHERE job_type = 'heartbeat_tick' ORDER BY created_at DESC;
   ```

4. **Worker Scaling:**
   ```bash
   # Start 2 worker instances, verify no duplicate job processing
   ```

5. **Graceful Shutdown:**
   ```bash
   # Kill worker with SIGTERM, verify current job completes
   ```

---

## Self-Review Checklist

- [ ] All schema types match across tasks
- [ ] Job type strings are consistent: `workspace_cleanup`, `routine_dispatch`, `heartbeat_tick`
- [ ] Handler timeouts match design spec
- [ ] `FOR UPDATE SKIP LOCKED` properly enables horizontal scaling
- [ ] `company_id` is nullable for `heartbeat_tick`
- [ ] Retry backoff uses exponential formula
- [ ] Graceful shutdown waits for current job with timeout

---

**Plan saved to:** `docs/superpowers/plans/2026-03-27-background-worker.md`
