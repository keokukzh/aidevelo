// Fallback/healthkick endpoint.
// It does not dispatch jobs directly to avoid split-brain scheduling behavior.
import { Router } from "express";
import type { Db } from "@aideveloai/db";
import { createDb } from "@aideveloai/db";
import { jobQueueService } from "../../services/job-queue.js";

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
    try {
      const enqueue = await jobQueue.enqueueHeartbeatTick(new Date().toISOString(), {
        source: "cron_dispatch_healthkick",
      });
      res.json({
        ok: true,
        mode: "healthkick",
        heartbeatTickScheduled: !enqueue.deduped,
        deduped: enqueue.deduped,
        jobId: enqueue.job.id,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: errorMessage });
    }
  });

  return router;
}
