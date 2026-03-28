-- packages/db/src/migrations/0046_billing_tables.sql

-- Subscriptions: links a user to their Stripe subscription
CREATE TABLE "subscriptions" (
  "id" text PRIMARY KEY, -- Supabase auth user id
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "stripe_subscription_id" text UNIQUE,
  "stripe_customer_id" text,
  "tier" text NOT NULL DEFAULT 'starter', -- 'starter' | 'pro'
  "status" text NOT NULL DEFAULT 'active', -- 'active' | 'past_due' | 'cancelled' | 'trialing'
  "current_period_start" timestamp with time zone,
  "current_period_end" timestamp with time zone,
  "cancel_at_period_end" boolean DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions"("user_id");
CREATE INDEX "subscriptions_stripe_customer_idx" ON "subscriptions"("stripe_customer_id");

-- User usage: tracks per-user request counts within aligned 5-hour windows
CREATE TABLE "user_usage" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "window_start" timestamp with time zone NOT NULL, -- Aligned 5-hour boundary
  "request_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX "user_usage_user_window_idx" ON "user_usage"("user_id", "window_start");

-- User API keys: created after successful Stripe checkout
CREATE TABLE "user_api_keys" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "key_hash" text NOT NULL, -- SHA-256 hash of plaintext key
  "name" text NOT NULL DEFAULT 'Default',
  "last_used_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE INDEX "user_api_keys_key_hash_idx" ON "user_api_keys"("key_hash");
CREATE INDEX "user_api_keys_user_id_idx" ON "user_api_keys"("user_id");
