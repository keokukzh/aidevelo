-- packages/db/src/migrations/0045_add_background_jobs.sql

CREATE TABLE "background_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid REFERENCES "companies"("id") ON DELETE CASCADE,
  -- Note: company_id is NULL for heartbeat_tick (global job)
  "job_type" text NOT NULL,
  -- 'workspace_cleanup' | 'routine_dispatch' | 'heartbeat_tick'
  "job_payload" jsonb NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  -- 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  "priority" integer DEFAULT 0,
  "max_attempts" integer DEFAULT 3,
  "attempts" integer DEFAULT 0,
  "last_error" text,
  "scheduled_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "next_retry_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW()
);

-- Index for worker polling (only pending/processing jobs)
CREATE INDEX "background_jobs_status_scheduled_idx"
  ON "background_jobs"("status", "scheduled_at")
  WHERE "status" IN ('pending', 'processing');

-- Index for company-scoped queries
CREATE INDEX "background_jobs_company_type_idx"
  ON "background_jobs"("company_id", "job_type");

-- Index for retry logic
CREATE INDEX "background_jobs_retry_idx"
  ON "background_jobs"("next_retry_at")
  WHERE "status" = 'pending' AND "next_retry_at" IS NOT NULL;
