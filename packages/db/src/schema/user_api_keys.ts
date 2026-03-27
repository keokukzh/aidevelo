import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { authUsers } from "./auth.js";

/**
 * Per-user API keys for the AIDEVELO platform.
 * Created after a successful Stripe checkout.
 * Only the key hash is stored; the plaintext is shown once to the user.
 */
export const userApiKeys = pgTable(
  "user_api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => authUsers.id),
    /** SHA-256 hash of the plaintext key */
    keyHash: text("key_hash").notNull(),
    /** User-provided name for this key (e.g. "Production", "Test") */
    name: text("name").notNull().default("Default"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    keyHashIdx: index("user_api_keys_key_hash_idx").on(table.keyHash),
    userIdIdx: index("user_api_keys_user_id_idx").on(table.userId),
  }),
);

export type UserApiKey = typeof userApiKeys.$inferSelect;
export type NewUserApiKey = typeof userApiKeys.$inferInsert;
