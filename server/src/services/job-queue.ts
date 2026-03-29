// server/src/services/job-queue.ts
import { and, desc, eq, isNull, lte, or } from "drizzle-orm";
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
          jobPayload: payload as unknown as Record<string, unknown>,
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
  };
}
