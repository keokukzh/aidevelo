-- packages/db/src/migrations/0047_fk_cascades.sql
-- Add ON DELETE actions to foreign keys in activity_log and cost_events tables.
-- This prevents orphaned rows and ensures cascading deletes work correctly.

-- activity_log: companyId -> companies.id (CASCADE - required FK)
ALTER TABLE "activity_log" DROP CONSTRAINT IF EXISTS "activity_log_company_id_fkey";
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;

-- activity_log: agentId -> agents.id (SET NULL)
ALTER TABLE "activity_log" DROP CONSTRAINT IF EXISTS "activity_log_agent_id_agents_id_fk";
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_agent_id_agents_id_fk"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL;

-- activity_log: runId -> heartbeat_runs.id (SET NULL)
ALTER TABLE "activity_log" DROP CONSTRAINT IF EXISTS "activity_log_run_id_heartbeat_runs_id_fk";
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_run_id_heartbeat_runs_id_fk"
  FOREIGN KEY ("run_id") REFERENCES "heartbeat_runs"("id") ON DELETE SET NULL;

--> statement-breakpoint

-- cost_events: nullable FKs get SET NULL, required companyId gets CASCADE
ALTER TABLE "cost_events" DROP CONSTRAINT IF EXISTS "cost_events_company_id_fkey";
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;

ALTER TABLE "cost_events" DROP CONSTRAINT IF EXISTS "cost_events_agent_id_agents_id_fk";
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_agent_id_agents_id_fk"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE;

ALTER TABLE "cost_events" DROP CONSTRAINT IF EXISTS "cost_events_issue_id_issues_id_fk";
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_issue_id_issues_id_fk"
  FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE SET NULL;

ALTER TABLE "cost_events" DROP CONSTRAINT IF EXISTS "cost_events_project_id_projects_id_fk";
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_project_id_projects_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL;

ALTER TABLE "cost_events" DROP CONSTRAINT IF EXISTS "cost_events_goal_id_goals_id_fk";
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_goal_id_goals_id_fk"
  FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL;

ALTER TABLE "cost_events" DROP CONSTRAINT IF EXISTS "cost_events_heartbeat_run_id_heartbeat_runs_id_fk";
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_heartbeat_run_id_heartbeat_runs_id_fk"
  FOREIGN KEY ("heartbeat_run_id") REFERENCES "heartbeat_runs"("id") ON DELETE SET NULL;

--> statement-breakpoint

-- Add index for retention cleanup queries on activity_log
CREATE INDEX IF NOT EXISTS "activity_log_created_at_idx" ON "activity_log"("created_at");
