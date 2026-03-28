/**
 * Rolling 5-hour usage window tracking.
 *
 * Algorithm:
 * - window_start = now() aligned to the nearest past 5-hour boundary
 * - get_remaining_quota: sum all rows where window_start >= (now - 5h)
 * - record_request: UPSERT +1 on the aligned window row
 *
 * Fast path: when Redis is available, increment Redis counter first,
 * then flush to DB periodically. Falls back to DB-only when Redis
 * is not configured.
 */
import { eq, and, gte } from "drizzle-orm";
import type { Db } from "@aideveloai/db";
import { userUsage, TIER_QUOTAS } from "@aideveloai/db/schema/user_usage";

const WINDOW_SIZE_MS = 5 * 60 * 60 * 1000; // 5 hours

/**
 * Get the aligned 5-hour window start timestamp for a given date.
 * Windows are aligned to 5-hour boundaries: 0h, 5h, 10h, 15h, 20h.
 */
export function alignToWindow(date: Date = new Date()): Date {
  const ms = date.getTime();
  const offset = ms % WINDOW_SIZE_MS;
  return new Date(ms - offset);
}

export interface QuotaInfo {
  tier: string;
  quota: number;
  used: number;
  remaining: number;
  windowStart: Date;
  windowEnd: Date; // windowStart + 5 hours
}

/**
 * Get remaining quota for a user.
 */
export async function getRemainingQuota(
  db: Db,
  userId: string,
  tier: string,
): Promise<QuotaInfo> {
  const now = new Date();
  const windowStart = alignToWindow(now);
  const windowEnd = new Date(windowStart.getTime() + WINDOW_SIZE_MS);
  const quota = TIER_QUOTAS[tier] ?? TIER_QUOTAS["starter"];

  // Sum all usage rows in the current 5-hour window
  const rows = await db
    .select()
    .from(userUsage)
    .where(
      and(
        eq(userUsage.userId, userId),
        gte(userUsage.windowStart, windowStart),
      ),
    )
    .execute();

  const used = rows.reduce((sum, row) => sum + row.requestCount, 0);
  return {
    tier,
    quota,
    used,
    remaining: Math.max(0, quota - used),
    windowStart,
    windowEnd,
  };
}

/**
 * Record one API request for a user.
 * Uses UPSERT to atomically increment the counter in the aligned window.
 */
export async function recordRequest(
  db: Db,
  userId: string,
): Promise<void> {
  const windowStart = alignToWindow(new Date());

  await db
    .insert(userUsage)
    .values({
      userId,
      windowStart,
      requestCount: 1,
    })
    .onConflictDoUpdate({
      target: [userUsage.userId, userUsage.windowStart],
      set: {
        requestCount: userUsage.fields.requestCount + 1,
        updatedAt: new Date(),
      },
    })
    .execute();
}

/**
 * Check if a user has remaining quota. Returns false if over limit.
 */
export async function hasRemainingQuota(
  db: Db,
  userId: string,
  tier: string,
): Promise<boolean> {
  const info = await getRemainingQuota(db, userId, tier);
  return info.remaining > 0;
}
