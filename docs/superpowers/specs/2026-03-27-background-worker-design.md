# Background Worker System Design

**Date:** 2026-03-27
**Status:** Draft
**Author:** Claude (with AIDEVELO team input)

---

## Context

### Problem Statement

Currently, several critical operations in AIDEVELO run synchronously within HTTP request handlers:

1. **Workspace Cleanup** (`cleanupExecutionWorkspaceArtifacts`) - Blocks when archiving/deleting execution workspaces, runs git commands and file system operations that can be slow or fail
2. **Routine Dispatch** (`dispatchRoutineRun`) - Called via HTTP webhook endpoints that can timeout
3. **Heartbeat Tick** (`tickTimers`) - External scheduler hits HTTP endpoint which can fail

This causes:
- Slow HTTP responses when cleanup operations are slow
- Unreliable execution (HTTP endpoints timeout, workers die)
- No visibility into background job status
- Race conditions when cleanup runs during active workspace use

### Goals

1. Move all background operations to async processing
2. Use PostgreSQL as the job queue (no new infrastructure)
3. Support horizontal scaling (multiple workers with proper locking)
4. Maintain multi-tenant isolation
5. Provide job status visibility

---

## Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PostgreSQL                                   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  background_jobs                                              │   │
│  │  - id, company_id, job_type, job_payload                      │   │
│  │  - status, priority, attempts, max_attempts                   │   │
│  │  - scheduled_at, started_at, completed_at, next_retry_at     │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ poll with FOR UPDATE SKIP LOCKED
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Background Worker Process                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Worker Loop (polls every 5 seconds)                          │  │
│  │  1. SELECT FOR UPDATE SKIP LOCKED - acquire job              │  │
│  │  2. Execute job with timeout                                   │  │
│  │  3. Update status to completed/failed                         │  │
│  │  4. Release lock (commit transaction)                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│         ┌────────────────────┼────────────────────┐                │
│         ▼                    ▼                    ▼                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │
│  │ Workspace   │    │ Routine     │    │ Heartbeat    │           │
│  │ Cleanup     │    │ Dispatch    │    │ Tick         │           │
│  │ Handler     │    │ Handler     │    │ Handler      │           │
│  └─────────────┘    └─────────────┘    └─────────────┘           │
└─────────────────────────────────────────────────────────────────────┘
```

### Components

#### 1. Database Schema

**`background_jobs` Table:**

```sql
CREATE TABLE background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE, -- NULL for heartbeat_tick (global)
  job_type TEXT NOT NULL, -- 'workspace_cleanup' | 'routine_dispatch' | 'heartbeat_tick'
  job_payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
    -- 'pending'    : waiting to be processed
    -- 'processing' : currently being worked on
    -- 'completed'  : finished successfully
    -- 'failed'     : failed after all retries
    -- 'cancelled'  : manually cancelled
  priority INT DEFAULT 0, -- higher = more urgent
  max_attempts INT DEFAULT 3,
  attempts INT DEFAULT 0,
  last_error TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for worker polling (only pending/processing jobs)
CREATE INDEX background_jobs_status_scheduled ON background_jobs(status, scheduled_at)
  WHERE status IN ('pending', 'processing');

-- Index for company-scoped queries
CREATE INDEX background_jobs_company_type ON background_jobs(company_id, job_type);

-- Index for retry logic
CREATE INDEX background_jobs_retry ON background_jobs(next_retry_at)
  WHERE status = 'pending' AND next_retry_at IS NOT NULL;
```

**Job Payload Schemas:**

```typescript
// workspace_cleanup
interface WorkspaceCleanupPayload {
  workspaceId: string;
  cleanupReason: 'archive' | 'delete' | 'idle_timeout' | 'manual';
  force?: boolean;
}

// routine_dispatch
interface RoutineDispatchPayload {
  triggerId: string;
  routineId: string;
  companyId: string;
  scheduledTick: string; // ISO timestamp of the scheduled tick
}

// heartbeat_tick
interface HeartbeatTickPayload {
  tickTimestamp: string;
  // No company_id - heartbeat tick processes all agents
}
```

#### 2. Job Queue Service (`server/src/services/job-queue.ts`)

```typescript
interface JobQueueService {
  // Enqueue a new job
  enqueue<T extends JobPayload>(
    jobType: JobType,
    companyId: string,
    payload: T,
    options?: { priority?: number; scheduledAt?: Date; maxAttempts?: number }
  ): Promise<BackgroundJob>;

  // Cancel a pending job
  cancel(jobId: string): Promise<void>;

  // Get job status (for API)
  getJob(jobId: string): Promise<BackgroundJob | null>;

  // List jobs for a company (for dashboard)
  listJobs(companyId: string, options?: ListJobsOptions): Promise<BackgroundJob[]>;
}
```

#### 3. Worker Process (`server/src/worker/index.ts`)

**Entry Point:**
```typescript
// Runs as separate process: node server/dist/worker/index.js
async function main() {
  const worker = createWorker({
    pollIntervalMs: 5000,
    jobTimeoutMs: 300000, // 5 minutes
    maxRetries: 3,
    retryBackoffMs: 30000,
  });

  process.on('SIGTERM', () => worker.shutdown());
  await worker.start();
}
```

**Worker Loop:**
```typescript
async function runWorkerCycle() {
  return await db.transaction(async (tx) => {
    // Acquire job with SKIP LOCKED (allows horizontal scaling)
    const job = await tx
      .select()
      .from(backgroundJobs)
      .where(
        and(
          eq(backgroundJobs.status, 'pending'),
          lte(backgroundJobs.scheduledAt, new Date()),
          or(
            isNull(backgroundJobs.nextRetryAt),
            lte(backgroundJobs.nextRetryAt, new Date())
          )
        )
      )
      .orderBy(desc(backgroundJobs.priority), backgroundJobs.scheduledAt)
      .limit(1)
      .for('update skip locked'); // Key for horizontal scaling

    if (!job) return null;

    // Mark as processing
    await tx
      .update(backgroundJobs)
      .set({ status: 'processing', startedAt: new Date() })
      .where(eq(backgroundJobs.id, job.id));

    return job;
  });
}
```

#### 4. Job Handlers

Each job type has a dedicated handler:

```typescript
interface JobHandler {
  execute(payload: unknown): Promise<HandlerResult>;
  getTimeoutMs(): number;
}

// Registered handlers
const handlers: Record<JobType, JobHandler> = {
  workspace_cleanup: workspaceCleanupHandler,
  routine_dispatch: routineDispatchHandler,
  heartbeat_tick: heartbeatTickHandler,
};
```

**Workspace Cleanup Handler:**
```typescript
const workspaceCleanupHandler: JobHandler = {
  async execute(payload: WorkspaceCleanupPayload): Promise<HandlerResult> {
    const { workspaceId, cleanupReason, force } = payload;

    // Call existing cleanup logic
    await cleanupExecutionWorkspaceArtifacts({
      workspaceId,
      cleanupReason,
      force: force ?? false,
    });

    return { success: true };
  },

  getTimeoutMs(): number {
    return 60000; // 1 minute max for cleanup
  },
};
```

**Routine Dispatch Handler:**
```typescript
const routineDispatchHandler: JobHandler = {
  async execute(payload: RoutineDispatchPayload): Promise<HandlerResult> {
    const { triggerId, routineId, companyId } = payload;

    // Check trigger is still due (prevent stale dispatch)
    const trigger = await getRoutineTrigger(triggerId);
    if (!trigger || trigger.nextRunAt > new Date(payload.scheduledTick)) {
      return { success: true, skipped: true }; // Already dispatched
    }

    // Call existing dispatch logic
    await dispatchRoutineRun({ routineId, triggerId, companyId });

    return { success: true };
  },

  getTimeoutMs(): number {
    return 120000; // 2 minutes for routine dispatch
  },
};
```

**Heartbeat Tick Handler:**
```typescript
const heartbeatTickHandler: JobHandler = {
  async execute(payload: HeartbeatTickPayload): Promise<HandlerResult> {
    // 1. Process timer-based wakeups for all companies
    // 2. Find routine triggers that are due, enqueue routine_dispatch jobs
    // 3. Enqueue next heartbeat_tick job for continued scheduling
    await heartbeatService.tickTimers(payload.tickTimestamp);

    // Schedule next tick (self-perpetuating)
    await jobQueue.enqueue('heartbeat_tick', null, {
      tickTimestamp: new Date(Date.now() + 30000).toISOString(),
    });

    return { success: true };
  },

  getTimeoutMs(): number {
    return 30000; // 30 seconds for heartbeat tick
  },
};
```

**Note:** `company_id` is NULL for heartbeat_tick since it processes all companies' agents globally.

#### 5. Job Status API (`server/src/routes/worker-jobs.ts`)

```typescript
// GET /api/companies/:companyId/jobs - List jobs for company
// GET /api/companies/:companyId/jobs/:jobId - Get job details
// POST /api/companies/:companyId/jobs/:jobId/cancel - Cancel pending job
```

#### 6. Graceful Shutdown

```typescript
async function shutdown() {
  log.info('Worker receiving SIGTERM, finishing current job...');

  // Don't acquire new jobs
  isShuttingDown = true;

  // If processing, wait for completion (with timeout)
  if (currentJob) {
    await Promise.race([
      currentJobCompletion,
      sleep(30000).then(() => { throw new Error('Graceful shutdown timeout'); })
    ]);
  }

  process.exit(0);
}
```

---

## Integration with Existing Systems

### 1. Workspace Cleanup Integration

**Current:** `POST /api/execution-workspaces/:id/archive` runs cleanup synchronously

**New:** Returns immediately, enqueues cleanup job:

```typescript
// In execution-workspaces.ts route handler
router.post('/:workspaceId/archive', async (req, res) => {
  // Validate and update status
  await db.update(executionWorkspaces)
    .set({ status: 'archiving' })
    .where(eq(executionWorkspaces.id, workspaceId));

  // Enqueue async cleanup
  await jobQueue.enqueue('workspace_cleanup', companyId, {
    workspaceId,
    cleanupReason: 'archive',
  });

  res.json({ status: 'archiving', cleanupJobEnqueued: true });
});
```

### 2. Routine Dispatch Integration

**Current:** External cron hits `POST /api/routines/:id/triggers/:triggerId/fire`

**New:** Worker polls `routine_triggers` table directly for due triggers:

```typescript
// In heartbeat tick, worker checks for due cron triggers
// No external HTTP call needed
async function tickScheduledTriggers() {
  const dueTriggers = await db
    .select()
    .from(routineTriggers)
    .where(
      and(
        eq(routineTriggers.kind, 'cron'),
        eq(routineTriggers.enabled, true),
        lte(routineTriggers.nextRunAt, new Date())
      )
    );

  for (const trigger of dueTriggers) {
    await jobQueue.enqueue('routine_dispatch', companyId, {
      triggerId: trigger.id,
      routineId: trigger.routineId,
      companyId,
      scheduledTick: trigger.nextRunAt.toISOString(),
    });
  }
}
```

### 3. Heartbeat Tick Integration

**Current:** External scheduler (Cloudflare cron, Render cron) hits `GET /api/instance/scheduler-heartbeats`

**New:** Worker self-schedules via heartbeat_tick job chain:

```typescript
// Worker bootstrap: enqueue initial heartbeat tick
async function bootstrapHeartbeatTicks() {
  // Schedule first tick immediately
  await jobQueue.enqueue('heartbeat_tick', null, {
    tickTimestamp: new Date().toISOString(),
  });
}

// In heartbeat tick handler, reschedule for 30s later
const heartbeatTickHandler: JobHandler = {
  async execute(payload: HeartbeatTickPayload): Promise<HandlerResult> {
    await heartbeatService.tickTimers(payload.tickTimestamp);

    // Self-perpetuate: enqueue next tick
    await jobQueue.enqueue('heartbeat_tick', null, {
      tickTimestamp: new Date(Date.now() + 30000).toISOString(),
    }, { priority: -1 }); // Lower priority than cleanup/dispatch jobs

    return { success: true };
  },
  getTimeoutMs(): number { return 30000; },
};
```

---

## Deployment

### Render Configuration

**Worker Process:**
- Separate Render service: `aidevelo-worker`
- Region: Oregon (same as API)
- Runtime: Node 20
- Start command: `node server/dist/worker/index.js`
- Variables: Same DATABASE_URL as API

**Scaling:**
- 1 worker process initially (can scale horizontally with SKIP LOCKED)
- Worker is stateless - multiple instances share job queue via DB

---

## Observability

### Logging

Structured logging with correlation:

```typescript
log.info('Job started', {
  jobId: job.id,
  jobType: job.jobType,
  companyId: job.companyId,
  attempt: job.attempts,
});

log.info('Job completed', {
  jobId: job.id,
  durationMs: Date.now() - job.startedAt.getTime(),
});

log.error('Job failed', {
  jobId: job.id,
  error: error.message,
  attempt: job.attempts,
  willRetry: job.attempts < job.maxAttempts,
});
```

### Job Status API

```
GET /api/companies/:companyId/jobs
Response: {
  jobs: [
    { id, jobType, status, createdAt, startedAt, completedAt, lastError }
  ],
  pagination: { cursor, hasMore }
}

GET /api/companies/:companyId/jobs/:jobId
Response: {
  id, jobType, status, jobPayload, attempts, maxAttempts,
  lastError, scheduledAt, startedAt, completedAt, nextRetryAt
}
```

---

## Error Handling & Retry

### Retry Logic

```typescript
async function handleJobFailure(job: BackgroundJob, error: Error) {
  const shouldRetry = job.attempts < job.maxAttempts;
  const backoffMs = Math.min(30000 * Math.pow(2, job.attempts - 1), 300000);

  if (shouldRetry) {
    await db.update(backgroundJobs)
      .set({
        status: 'pending',
        lastError: error.message,
        nextRetryAt: new Date(Date.now() + backoffMs),
      })
      .where(eq(backgroundJobs.id, job.id));
  } else {
    await db.update(backgroundJobs)
      .set({
        status: 'failed',
        lastError: `Final failure after ${job.attempts} attempts: ${error.message}`,
      })
      .where(eq(backgroundJobs.id, job.id));
  }
}
```

### Job Dead Letter

Jobs that fail all retries are marked `failed` but not deleted. They can be:
- Viewed in dashboard for debugging
- Manually retried via API
- Automatically cleaned up after 30 days

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `packages/db/src/schema/background-jobs.ts` | Drizzle schema for background_jobs table |
| `packages/db/src/migrations/0045_add_background_jobs.sql` | Migration |
| `server/src/services/job-queue.ts` | Job queue service |
| `server/src/worker/index.ts` | Worker entry point |
| `server/src/worker/handlers/workspace-cleanup.ts` | Workspace cleanup handler |
| `server/src/worker/handlers/routine-dispatch.ts` | Routine dispatch handler |
| `server/src/worker/handlers/heartbeat-tick.ts` | Heartbeat tick handler |
| `server/src/routes/worker-jobs.ts` | Job status API |

### Modified Files

| File | Change |
|------|--------|
| `server/src/routes/execution-workspaces.ts` | Make cleanup async, enqueue job |
| `server/src/services/routines.ts` | Remove HTTP-triggered dispatch, rely on worker |
| `server/src/services/heartbeat.ts` | Worker handles tickTimers() |
| `server/src/index.ts` | Start worker process |
| `render.yaml` | Add worker service |

---

## Verification

### Manual Testing

1. **Workspace Cleanup:**
   - Create execution workspace
   - Archive workspace
   - Verify cleanup job appears in `background_jobs` table
   - Verify workspace files are cleaned up within 1 minute
   - Verify API returns immediately

2. **Routine Dispatch:**
   - Create routine with cron trigger
   - Wait for scheduled time
   - Verify routine dispatch job is created
   - Verify routine actually runs

3. **Heartbeat Tick:**
   - Agent in idle state with timer-based wakeup
   - Wait for tick interval
   - Verify agent receives wakeup

4. **Worker Scaling:**
   - Start 2 worker instances
   - Enqueue 10 jobs
   - Verify each job processed exactly once

5. **Error Handling:**
   - Simulate cleanup failure
   - Verify retry with backoff
   - Verify final failure after max retries

6. **Graceful Shutdown:**
   - Send SIGTERM while job is running
   - Verify job completes
   - Verify worker exits cleanly

---

## Success Criteria

1. Workspace archive/delete returns HTTP 200 within 100ms
2. Cleanup completes asynchronously within 5 minutes
3. Routine dispatch triggers within 30 seconds of scheduled time
4. Heartbeat tick processes all due timers within 1 minute
5. Multiple workers can run without duplicate job processing
6. Failed jobs retry with exponential backoff
7. Job status visible via API

---

## Future Enhancements (Out of Scope)

- Webhook-based job enqueueing for external systems
- Job prioritization UI in dashboard
- Email/notification on job failure
- Scheduled jobs (cron-like scheduling)
- Job chaining (workflows)
