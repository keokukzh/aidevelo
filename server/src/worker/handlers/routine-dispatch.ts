// server/src/worker/handlers/routine-dispatch.ts
import { createDb, routineTriggers } from "@aideveloai/db";
import { eq } from "drizzle-orm";
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
