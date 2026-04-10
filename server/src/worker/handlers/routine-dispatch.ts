// server/src/worker/handlers/routine-dispatch.ts
import { backgroundJobs, createDb, routineTriggers } from "@aideveloai/db";
import { and, desc, eq } from "drizzle-orm";
import { routineService } from "../../services/routines.js";
import type { RoutineDispatchPayload } from "../../services/job-queue.js";

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return url;
}

export const routineDispatchHandler = {
  async execute(payload: unknown): Promise<{ success: boolean; skipped?: boolean }> {
    const { triggerId, routineId, companyId, scheduledTick } =
      payload as RoutineDispatchPayload;
    const db = createDb(getDatabaseUrl());
    const routines = routineService(db);

    // Check trigger is still due (prevent stale dispatch)
    const [trigger] = await db
      .select()
      .from(routineTriggers)
      .where(eq(routineTriggers.id, triggerId));

    if (!trigger) {
      return { success: false, skipped: true };
    }

    // If nextRunAt has advanced past our scheduled tick, we've already run
    if (trigger.nextRunAt && trigger.nextRunAt > new Date(scheduledTick)) {
      return { success: false, skipped: true };
    }

    // Idempotency: skip if same trigger/tick was already completed.
    const recentDispatches = await db
      .select({ status: backgroundJobs.status, jobPayload: backgroundJobs.jobPayload })
      .from(backgroundJobs)
      .where(
        and(
          eq(backgroundJobs.jobType, "routine_dispatch"),
          eq(backgroundJobs.companyId, companyId),
        ),
      )
      .orderBy(desc(backgroundJobs.updatedAt))
      .limit(200);

    const duplicateCompleted = recentDispatches.some((job) => {
      const payload = job.jobPayload as Record<string, unknown> | null;
      return (
        job.status === "completed" &&
        payload?.triggerId === triggerId &&
        payload?.scheduledTick === scheduledTick
      );
    });

    if (duplicateCompleted) {
      return { success: false, skipped: true };
    }

    // Dispatch the routine using runRoutine
    await routines.runRoutine(routineId, {
      triggerId,
      source: "api",
    });

    return { success: true };
  },

  getTimeoutMs(): number {
    return 120000; // 2 minutes
  },
};
