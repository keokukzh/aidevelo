// Unified Vercel Cron handler for environments with limited cron jobs.
// Handles both heartbeat ticks and job dispatching in a single invocation.
import { Router } from "express";
import { createDb, routineTriggers } from "@aideveloai/db";
import { and, eq, lte } from "drizzle-orm";
import { heartbeatService } from "../../services/heartbeat.js";
import { jobQueueService } from "../../services/job-queue.js";
import { routineService } from "../../services/routines.js";
import type { RoutineDispatchPayload } from "../../services/job-queue.js";

function verifyCronAuth(req: { headers: Headers }): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${cronSecret}`;
}

export function cronUnifiedRoutes() {
  const router = Router({ mergeParams: true });

  router.post("/cron-unified", async (req, res) => {
    if (!verifyCronAuth(req as any)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const db = createDb(process.env.DATABASE_URL!);
    const heartbeat = heartbeatService(db);
    const jobQueue = jobQueueService(db);
    const routines = routineService(db);

    try {
      const now = new Date();
      const results: any = { ok: true, tasks: [] };

      // Task 1: Heartbeat & Trigger Enqueueing
      const tickResult = await heartbeat.tickTimers(now);
      results.tasks.push({ type: "heartbeat_tick", enqueued: tickResult.enqueued });

      const dueTriggers = await db
        .select()
        .from(routineTriggers)
        .where(
          and(
            eq(routineTriggers.kind, "cron"),
            eq(routineTriggers.enabled, true),
            lte(routineTriggers.nextRunAt, now),
          ),
        );

      for (const trigger of dueTriggers) {
        if (!trigger.nextRunAt) continue;
        await jobQueue.enqueue("routine_dispatch", trigger.companyId, {
          triggerId: trigger.id,
          routineId: trigger.routineId,
          companyId: trigger.companyId,
          scheduledTick: trigger.nextRunAt.toISOString(),
        });
      }
      results.tasks.push({ type: "triggers_processed", count: dueTriggers.length });

      await heartbeat.reapOrphanedRuns({ staleThresholdMs: 5 * 60 * 1000 });
      await heartbeat.resumeQueuedRuns();

      // Task 2: Dispatch (process up to 3 jobs per tick to stay within execution limits)
      let processedJobs = 0;
      for (let i = 0; i < 3; i++) {
        const job = await jobQueue.acquireNextJob();
        if (!job) break;

        if (job.jobType === "routine_dispatch") {
          try {
            const payload = job.jobPayload as unknown as RoutineDispatchPayload;
            await routines.runRoutine(payload.routineId, {
              triggerId: payload.triggerId,
              source: "api",
            });
            await jobQueue.markCompleted(job.id);
            processedJobs++;
          } catch (jobErr) {
            const msg = jobErr instanceof Error ? jobErr.message : String(jobErr);
            await jobQueue.markFailed(job.id, msg, true);
          }
        } else {
          // Simply acknowledge other types to clear the queue
          await jobQueue.markCompleted(job.id);
        }
      }
      results.tasks.push({ type: "worker_dispatch", processed: processedJobs });

      res.json(results);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: errorMessage });
    }
  });

  return router;
}
