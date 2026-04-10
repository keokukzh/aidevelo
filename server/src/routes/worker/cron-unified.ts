// Unified fallback/healthkick endpoint.
// It queues heartbeat ticks and reports queue health, without running dispatch logic inline.
import { Router } from "express";
import { createDb } from "@aideveloai/db";
import { jobQueueService } from "../../services/job-queue.js";

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
    const jobQueue = jobQueueService(db);

    try {
      const results: any = { ok: true, tasks: [] };

      const enqueue = await jobQueue.enqueueHeartbeatTick(new Date().toISOString(), {
        source: "cron_unified_healthkick",
      });
      results.tasks.push({
        type: "healthkick",
        heartbeatTickScheduled: !enqueue.deduped,
        deduped: enqueue.deduped,
        jobId: enqueue.job.id,
      });

      const health = await jobQueue.getQueueHealth();
      results.tasks.push({ type: "queue_health", ...health });

      res.json(results);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: errorMessage });
    }
  });

  return router;
}
