// Vercel Cron handler for heartbeat timer ticks.
// Mounted at /api/worker/heartbeat-tick via vercel.json crons config.
// Invoked every 5 minutes by Vercel's cron service.
// Handles: timer-based wakeups + routine trigger scheduling + orphaned run recovery.
import { Router } from "express";
import type { Db } from "@aideveloai/db";
import { createDb, routineTriggers } from "@aideveloai/db";
import { and, eq, lte } from "drizzle-orm";
import { heartbeatService } from "../../services/heartbeat.js";
import { jobQueueService } from "../../services/job-queue.js";

function verifyCronAuth(req: { headers: Headers }): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${cronSecret}`;
}

export function cronHeartbeatTickRoutes(_db?: Db) {
  const router = Router({ mergeParams: true });

  router.post("/heartbeat-tick", async (req, res) => {
    if (!verifyCronAuth(req as any)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const db = createDb(process.env.DATABASE_URL!);
    const heartbeat = heartbeatService(db);
    const jobQueue = jobQueueService(db);

    try {
      const now = new Date();

      // 1. Process timer-based wakeups for all agents
      const tickResult = await heartbeat.tickTimers(now);

      // 2. Find due cron triggers and enqueue routine_dispatch jobs
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

      let enqueuedRoutines = 0;
      for (const trigger of dueTriggers) {
        if (!trigger.nextRunAt) continue;
        await jobQueue.enqueue("routine_dispatch", trigger.companyId, {
          triggerId: trigger.id,
          routineId: trigger.routineId,
          companyId: trigger.companyId,
          scheduledTick: trigger.nextRunAt.toISOString(),
        });
        enqueuedRoutines++;
      }

      // 3. Reap orphaned runs (staleness threshold)
      await heartbeat.reapOrphanedRuns({ staleThresholdMs: 5 * 60 * 1000 });
      await heartbeat.resumeQueuedRuns();

      // 4. Schedule next heartbeat tick (enqueue for next 5 min window)
      await jobQueue.enqueue(
        "heartbeat_tick",
        null,
        { tickTimestamp: new Date(Date.now() + 300_000).toISOString() },
        { priority: -1 },
      );

      res.json({
        ok: true,
        timers: tickResult.enqueued,
        routines: enqueuedRoutines,
        heartbeatTickScheduled: true,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: errorMessage });
    }
  });

  return router;
}
