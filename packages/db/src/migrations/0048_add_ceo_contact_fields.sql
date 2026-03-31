-- Add CEO contact fields to agents table for onboarding
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "contact_preferences" text DEFAULT 'email' NOT NULL;

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "agents_email_idx" ON "agents" ("email");