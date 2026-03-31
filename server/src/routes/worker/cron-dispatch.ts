// Vercel Cron handler for routine dispatch.
// Mounted at /api/worker/cron-dispatch via vercel.json crons config.
// Invoked every minute by Vercel's cron service.
import { Router } from "express";
import type { Db } from "@aideveloai/db";
import { createDb } from "@aideveloai/db";
import { routineService } from "../../services/routines.js";
import { jobQueueService } from "../../services/job-queue.js";
import type { RoutineDispatchPayload } from "../../services/job-queue.js";
import { routineTriggers } from "@aideveloai/db";
import { eq } from "drizzle-orm";

function verifyCronAuth(req: { headers: Headers }): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${cronSecret}`;
}

export function cronDispatchRoutes(_db?: Db) {
  const router = Router({ mergeParams: true });

  router.post("/cron-dispatch", async (req, res) => {
    if (!verifyCronAuth(req as any)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const db = createDb(process.env.DATABASE_URL!);
    const jobQueue = jobQueueService(db);
    const routines = routineService(db);

    const job = await jobQueue.acquireNextJob();
    if (!job) {
      res.json({ ok: true, processed: false, reason: "no_jobs_available" });
      return;
    }

    if (job.jobType !== "routine_dispatch") {
      // Acknowledge but not our job type — re-queue (skip processing)
      await jobQueue.markCompleted(job.id);
      res.json({ ok: true, processed: false, reason: "not_routine_dispatch" });
      return;
    }

    try {
      const payload = job.jobPayload as unknown as RoutineDispatchPayload;

      // Check trigger is still due (prevent stale dispatch)
      const [trigger] = await db
        .select()
        .from(routineTriggers)
        .where(eq(routineTriggers.id, payload.triggerId));

      if (!trigger) {
        await jobQueue.markCompleted(job.id);
        res.json({ ok: true, skipped: true, reason: "trigger_not_found" });
        return;
      }

      if (trigger.nextRunAt && trigger.nextRunAt > new Date(payload.scheduledTick)) {
        await jobQueue.markCompleted(job.id);
        res.json({ ok: true, skipped: true, reason: "trigger_advanced" });
        return;
      }

      await routines.runRoutine(payload.routineId, {
        triggerId: payload.triggerId,
        source: "api",
      });

      await jobQueue.markCompleted(job.id);
      res.json({ ok: true, processed: true, jobId: job.id });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isRetryable = (job.attempts ?? 0) < (job.maxAttempts ?? 3);
      await jobQueue.markFailed(job.id, errorMessage, isRetryable);
      res.status(500).json({ ok: false, error: errorMessage });
    }
  });

  return router;
}
