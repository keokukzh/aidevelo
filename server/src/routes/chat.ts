import { Router } from "express";
import type { Db } from "@aideveloai/db";
import { chatMessages } from "@aideveloai/db";
import { eq, and, desc } from "drizzle-orm";
import { assertCompanyAccess } from "./authz.js";
import { sendChatMessageSchema } from "@aideveloai/shared";

export function chatRoutes(db: Db) {
  const router = Router();

  router.get("/companies/:companyId/chat/:agentId/messages", async (req, res) => {
    const companyId = req.params.companyId as string;
    const agentId = req.params.agentId as string;
    assertCompanyAccess(req, companyId);

    const messages = await db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.companyId, companyId), eq(chatMessages.agentId, agentId)))
      .orderBy(desc(chatMessages.createdAt));

    res.json(messages);
  });

  router.post("/companies/:companyId/chat/messages", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const parsed = sendChatMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const { agentId, body } = parsed.data;
    const userId = req.actor.type === "user" ? req.actor.userId : null;

    const [message] = await db
      .insert(chatMessages)
      .values({
        companyId,
        agentId,
        authorUserId: userId,
        body,
        role: "user",
      })
      .returning();

    res.status(201).json(message);
  });

  return router;
}
