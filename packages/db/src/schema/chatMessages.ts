import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    authorUserId: text("author_user_id"),
    authorAgentId: uuid("author_agent_id").references(() => agents.id),
    body: text("body").notNull(),
    role: text("role").notNull().default("user"), // 'user' | 'agent'
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyAgentIdx: index("chat_messages_company_agent_idx").on(table.companyId, table.agentId),
    companyAgentCreatedAtIdx: index("chat_messages_company_agent_created_at_idx").on(
      table.companyId,
      table.agentId,
      table.createdAt,
    ),
  }),
);
