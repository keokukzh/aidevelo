// server/src/worker/handlers/heartbeat-tick.ts
import { createDb, routineTriggers } from "@aideveloai/db";
import { and, eq, lte } from "drizzle-orm";
import { heartbeatService } from "../../services/heartbeat.js";
import { jobQueueService } from "../../services/job-queue.js";

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return url;
}

export const heartbeatTickHandler = {
  async execute(payload: unknown): Promise<{ success: boolean; skipped?: boolean }> {
    const { tickTimestamp } = payload as { tickTimestamp: string };
    const db = createDb(getDatabaseUrl());
    const jobQueue = jobQueueService(db);
    const heartbeat = heartbeatService(db);

    // 1. Process timer-based wakeups for all companies
    await heartbeat.tickTimers(new Date(tickTimestamp));

    // 2. Find routine triggers that are due, enqueue routine_dispatch jobs
    const dueTriggers = await db
      .select()
      .from(routineTriggers)
      .where(
        and(
          eq(routineTriggers.kind, "schedule"),
          eq(routineTriggers.enabled, true),
          lte(routineTriggers.nextRunAt, new Date()),
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
