// server/src/services/job-queue.ts
import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import type { Db, BackgroundJob, NewBackgroundJob } from "@aideveloai/db";
import { backgroundJobs } from "@aideveloai/db";

export type JobType = "workspace_cleanup" | "routine_dispatch" | "heartbeat_tick";

export interface WorkspaceCleanupPayload {
  workspaceId: string;
  cleanupReason: "archive" | "delete" | "idle_timeout" | "manual";
  cleanupTrigger?: "done" | "merged" | "failed" | "manual" | "idle_timeout";
  force?: boolean;
}

export interface RoutineDispatchPayload {
  triggerId: string;
  routineId: string;
  companyId: string;
  scheduledTick: string;
  producer?: string;
  producedAt?: string;
}

export interface HeartbeatTickPayload {
  tickTimestamp: string;
  source?: string;
  producedAt?: string;
}

export type JobPayload = WorkspaceCleanupPayload | RoutineDispatchPayload | HeartbeatTickPayload;

export interface ListJobsOptions {
  status?: string;
  jobType?: JobType;
  limit?: number;
  cursor?: string;
}

export function isDuplicateHeartbeatTickPayload(
  existingPayload: Record<string, unknown> | null | undefined,
  requestedTickTimestamp: string,
  dedupeWindowMs: number,
): boolean {
  if (!existingPayload || typeof existingPayload.tickTimestamp !== "string") return false;
  const existingTick = new Date(existingPayload.tickTimestamp);
  const requestedTick = new Date(requestedTickTimestamp);
  if (Number.isNaN(existingTick.getTime()) || Number.isNaN(requestedTick.getTime())) return false;
  return Math.abs(existingTick.getTime() - requestedTick.getTime()) <= dedupeWindowMs;
}

export function isDuplicateRoutineDispatchPayload(
  existingPayload: Record<string, unknown> | null | undefined,
  requested: RoutineDispatchPayload,
): boolean {
  if (!existingPayload) return false;
  return (
    existingPayload.triggerId === requested.triggerId &&
    existingPayload.scheduledTick === requested.scheduledTick
  );
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
  enqueueHeartbeatTick(
    tickTimestamp: string,
    options?: {
      priority?: number;
      dedupeWindowMs?: number;
      source?: string;
    },
  ): Promise<{ job: BackgroundJob; deduped: boolean }>;
  enqueueRoutineDispatchIfAbsent(
    payload: RoutineDispatchPayload,
    options?: {
      priority?: number;
      maxAttempts?: number;
      source?: string;
    },
  ): Promise<{ job: BackgroundJob; deduped: boolean }>;

  cancel(jobId: string): Promise<void>;
  getJob(jobId: string): Promise<BackgroundJob | null>;
  listJobs(companyId: string, options?: ListJobsOptions): Promise<BackgroundJob[]>;

  // Internal: acquire job with SKIP LOCKED
  acquireNextJob(): Promise<BackgroundJob | null>;
  markProcessing(jobId: string): Promise<void>;
  markCompleted(jobId: string): Promise<void>;
  markFailed(jobId: string, error: string, retryable: boolean): Promise<void>;
  getQueueHealth(companyId?: string): Promise<{
    pendingCount: number;
    processingCount: number;
    retryBacklogCount: number;
    failedCount: number;
    oldestPendingAgeSeconds: number | null;
    oldestRetryAgeSeconds: number | null;
    lastHeartbeatTickAt: string | null;
  }>;
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
          jobPayload: payload as unknown as Record<string, unknown>,
          status: "pending",
          priority: options.priority ?? 0,
          maxAttempts,
          scheduledAt,
        })
        .returning();

      return job;
    },
    async enqueueHeartbeatTick(tickTimestamp, options = {}) {
      const dedupeWindowMs = options.dedupeWindowMs ?? 120000;
      const dedupeAfter = new Date(Date.now() - dedupeWindowMs);
      const candidates = await db
        .select()
        .from(backgroundJobs)
        .where(
          and(
            eq(backgroundJobs.jobType, "heartbeat_tick"),
            or(eq(backgroundJobs.status, "pending"), eq(backgroundJobs.status, "processing")),
            gte(backgroundJobs.createdAt, dedupeAfter),
          ),
        )
        .orderBy(desc(backgroundJobs.createdAt))
        .limit(20);

      for (const candidate of candidates) {
        const payload = candidate.jobPayload as Record<string, unknown> | null;
        if (isDuplicateHeartbeatTickPayload(payload, tickTimestamp, dedupeWindowMs)) {
          return { job: candidate, deduped: true };
        }
      }

      const job = await this.enqueue(
        "heartbeat_tick",
        null,
        {
          tickTimestamp,
          source: options.source ?? "worker",
          producedAt: new Date().toISOString(),
        },
        { priority: options.priority ?? -1 },
      );
      return { job, deduped: false };
    },
    async enqueueRoutineDispatchIfAbsent(payload, options = {}) {
      const candidates = await db
        .select()
        .from(backgroundJobs)
        .where(
          and(
            eq(backgroundJobs.jobType, "routine_dispatch"),
            or(eq(backgroundJobs.status, "pending"), eq(backgroundJobs.status, "processing")),
          ),
        )
        .orderBy(desc(backgroundJobs.createdAt))
        .limit(300);

      for (const candidate of candidates) {
        const existingPayload = candidate.jobPayload as Record<string, unknown> | null;
        if (isDuplicateRoutineDispatchPayload(existingPayload, payload)) {
          return { job: candidate, deduped: true };
        }
      }

      const job = await this.enqueue(
        "routine_dispatch",
        payload.companyId,
        {
          ...payload,
          producer: options.source ?? payload.producer ?? "worker",
          producedAt: payload.producedAt ?? new Date().toISOString(),
        },
        {
          priority: options.priority,
          maxAttempts: options.maxAttempts,
        },
      );
      return { job, deduped: false };
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
            attempts: (job.attempts ?? 0) + 1,
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

      const shouldRetry = retryable && (job.attempts ?? 0) < (job.maxAttempts ?? 3);
      const backoffMs = Math.min(30000 * Math.pow(2, (job.attempts ?? 0) - 1), 300000);

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
    async getQueueHealth(companyId) {
      const withCompanyScope = <T>(conditions: T[]) =>
        companyId ? [eq(backgroundJobs.companyId, companyId), ...conditions] : conditions;
      const now = Date.now();

      const [pendingRows, processingRows, retryRows, failedRows, oldestPending, oldestRetry, heartbeatRows] =
        await Promise.all([
          db
            .select({ id: backgroundJobs.id })
            .from(backgroundJobs)
            .where(and(...withCompanyScope([eq(backgroundJobs.status, "pending")]))),
          db
            .select({ id: backgroundJobs.id })
            .from(backgroundJobs)
            .where(and(...withCompanyScope([eq(backgroundJobs.status, "processing")]))),
          db
            .select({ id: backgroundJobs.id })
            .from(backgroundJobs)
            .where(
              and(
                ...withCompanyScope([
                  eq(backgroundJobs.status, "pending"),
                  lte(backgroundJobs.nextRetryAt, new Date()),
                ]),
              ),
            ),
          db
            .select({ id: backgroundJobs.id })
            .from(backgroundJobs)
            .where(and(...withCompanyScope([eq(backgroundJobs.status, "failed")]))),
          db
            .select({ createdAt: backgroundJobs.createdAt })
            .from(backgroundJobs)
            .where(and(...withCompanyScope([eq(backgroundJobs.status, "pending")])))
            .orderBy(backgroundJobs.createdAt)
            .limit(1),
          db
            .select({ nextRetryAt: backgroundJobs.nextRetryAt })
            .from(backgroundJobs)
            .where(
              and(
                ...withCompanyScope([
                  eq(backgroundJobs.status, "pending"),
                  lte(backgroundJobs.nextRetryAt, new Date()),
                ]),
              ),
            )
            .orderBy(backgroundJobs.nextRetryAt)
            .limit(1),
          db
            .select({ completedAt: backgroundJobs.completedAt, createdAt: backgroundJobs.createdAt })
            .from(backgroundJobs)
            .where(and(eq(backgroundJobs.jobType, "heartbeat_tick"), or(eq(backgroundJobs.status, "completed"), eq(backgroundJobs.status, "processing"), eq(backgroundJobs.status, "pending"))))
            .orderBy(desc(backgroundJobs.updatedAt))
            .limit(1),
        ]);

      const oldestPendingAt = oldestPending[0]?.createdAt ?? null;
      const oldestRetryAt = oldestRetry[0]?.nextRetryAt ?? null;
      const lastHeartbeat = heartbeatRows[0]?.completedAt ?? heartbeatRows[0]?.createdAt ?? null;

      return {
        pendingCount: pendingRows.length,
        processingCount: processingRows.length,
        retryBacklogCount: retryRows.length,
        failedCount: failedRows.length,
        oldestPendingAgeSeconds: oldestPendingAt ? Math.max(0, Math.floor((now - oldestPendingAt.getTime()) / 1000)) : null,
        oldestRetryAgeSeconds: oldestRetryAt ? Math.max(0, Math.floor((now - oldestRetryAt.getTime()) / 1000)) : null,
        lastHeartbeatTickAt: lastHeartbeat ? lastHeartbeat.toISOString() : null,
      };
    },
  };
}
