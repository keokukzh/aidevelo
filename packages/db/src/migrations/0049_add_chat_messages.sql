-- packages/db/src/migrations/0049_add_chat_messages.sql

-- Chat messages for CEO chat feature
CREATE TABLE "chat_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "author_user_id" text,
  "author_agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "body" text NOT NULL,
  "role" text NOT NULL DEFAULT 'user',
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE INDEX "chat_messages_company_agent_idx" ON "chat_messages"("company_id", "agent_id");
CREATE INDEX "chat_messages_company_agent_created_at_idx" ON "chat_messages"("company_id", "agent_id", "created_at");
