import { pgTable, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { authUsers } from "./auth.js";

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey(), // Supabase auth user id
    userId: text("user_id").notNull().references(() => authUsers.id),
    stripeSubscriptionId: text("stripe_subscription_id").unique(),
    stripeCustomerId: text("stripe_customer_id"),
    tier: text("tier").notNull().default("starter"), // "starter" | "pro"
    status: text("status").notNull().default("active"), // "active" | "past_due" | "cancelled" | "trialing"
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("subscriptions_user_id_idx").on(table.userId),
    stripeCustomerIdx: index("subscriptions_stripe_customer_idx").on(table.stripeCustomerId),
  }),
);

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
