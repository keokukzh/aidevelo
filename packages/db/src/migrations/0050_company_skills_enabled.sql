-- packages/db/src/migrations/0050_company_skills_enabled.sql

ALTER TABLE "company_skills" ADD COLUMN IF NOT EXISTS "enabled" boolean NOT NULL DEFAULT true;
