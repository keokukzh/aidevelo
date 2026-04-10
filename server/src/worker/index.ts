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

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return url;
}

export function createWorker(config: WorkerConfig) {
  const db = createDb(getDatabaseUrl());
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
  const db = createDb(getDatabaseUrl());
  const jobQueue = jobQueueService(db);

  // Enqueue initial heartbeat tick
  await jobQueue.enqueueHeartbeatTick(new Date().toISOString(), {
    source: "worker_bootstrap",
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
