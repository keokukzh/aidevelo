import { pgTable, uuid, text, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { authUsers } from "./auth.js";

/**
 * Tracks per-user request counts within rolling 5-hour windows.
 * Each row represents one aligned 5-hour window (window_start is always
 * a 5-hour boundary: now() - (now() % 5h)).
 */
export const userUsage = pgTable(
  "user_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => authUsers.id),
    /** Aligned 5-hour window start timestamp */
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    requestCount: integer("request_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userWindowIdx: uniqueIndex("user_usage_user_window_idx").on(table.userId, table.windowStart),
  }),
);

export type UserUsage = typeof userUsage.$inferSelect;
export type NewUserUsage = typeof userUsage.$inferInsert;

/** Tier quotas: requests per 5-hour window */
export const TIER_QUOTAS: Record<string, number> = {
  starter: 300,
  pro: 1000,
};
