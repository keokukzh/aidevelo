import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const backgroundJobs = pgTable(
  "background_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "cascade",
    }),
    jobType: text("job_type").notNull(),
    jobPayload: jsonb("job_payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("pending"),
    priority: integer("priority").default(0),
    maxAttempts: integer("max_attempts").default(3),
    attempts: integer("attempts").default(0),
    lastError: text("last_error"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    statusScheduledIdx: index("background_jobs_status_scheduled_idx").on(
      table.status,
      table.scheduledAt,
    ),
    companyTypeIdx: index("background_jobs_company_type_idx").on(
      table.companyId,
      table.jobType,
    ),
    retryIdx: index("background_jobs_retry_idx").on(table.nextRetryAt),
  }),
);

export type BackgroundJob = typeof backgroundJobs.$inferSelect;
export type NewBackgroundJob = typeof backgroundJobs.$inferInsert;
