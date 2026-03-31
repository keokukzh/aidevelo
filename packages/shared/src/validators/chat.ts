import { z } from "zod";

export const sendChatMessageSchema = z.object({
  agentId: z.string().uuid(),
  body: z.string().min(1),
});

export type SendChatMessage = z.infer<typeof sendChatMessageSchema>;

export const chatMessageSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  agentId: z.string().uuid(),
  authorUserId: z.string().nullable(),
  authorAgentId: z.string().uuid().nullable(),
  body: z.string(),
  role: z.enum(["user", "agent"]),
  createdAt: z.string().datetime(),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const listChatMessagesSchema = z.object({
  agentId: z.string().uuid(),
});

export type ListChatMessages = z.infer<typeof listChatMessagesSchema>;
