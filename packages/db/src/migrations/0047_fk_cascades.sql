-- packages/db/src/migrations/0047_fk_cascades.sql
-- Add ON DELETE actions to foreign keys in activity_log and cost_events tables.
-- This prevents orphaned rows and ensures cascading deletes work correctly.

-- activity_log: companyId -> companies.id
ALTER TABLE "activity_log" DROP CONSTRAINT IF EXISTS "activity_log_company_id_fkey";
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;

-- activity_log: agentId -> agents.id
ALTER TABLE "activity_log" DROP CONSTRAINT IF EXISTS "activity_log_agent_id_fkey";
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL;

-- activity_log: runId -> heartbeat_runs.id
ALTER TABLE "activity_log" DROP CONSTRAINT IF EXISTS "activity_log_run_id_fkey";
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "heartbeat_runs"("id") ON DELETE SET NULL;

-- cost_events: companyId -> companies.id
ALTER TABLE "cost_events" DROP CONSTRAINT IF EXISTS "cost_events_company_id_fkey";
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;

-- cost_events: agentId -> agents.id
ALTER TABLE "cost_events" DROP CONSTRAINT IF EXISTS "cost_events_agent_id_fkey";
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE;

-- cost_events: issueId -> issues.id
ALTER TABLE "cost_events" DROP CONSTRAINT IF EXISTS "cost_events_issue_id_fkey";
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_issue_id_fkey"
  FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE SET NULL;

-- cost_events: projectId -> projects.id
ALTER TABLE "cost_events" DROP CONSTRAINT IF EXISTS "cost_events_project_id_fkey";
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL;

-- cost_events: goalId -> goals.id
ALTER TABLE "cost_events" DROP CONSTRAINT IF EXISTS "cost_events_goal_id_fkey";
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_goal_id_fkey"
  FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL;

-- cost_events: heartbeatRunId -> heartbeat_runs.id
ALTER TABLE "cost_events" DROP CONSTRAINT IF EXISTS "cost_events_heartbeat_run_id_fkey";
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_heartbeat_run_id_fkey"
  FOREIGN KEY ("heartbeat_run_id") REFERENCES "heartbeat_runs"("id") ON DELETE SET NULL;
