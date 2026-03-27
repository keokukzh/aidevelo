import { Router } from "express";
import { eq } from "drizzle-orm";
import type { Db } from "@aideveloai/db";
import { subscriptions, userApiKeys } from "@aideveloai/db";
import { getStripe, getPriceIdForTier } from "../lib/stripe.js";
import { generateApiKey } from "../lib/api-keys.js";
import { getRemainingQuota } from "../lib/usage.js";

export function billingRoutes(db: Db) {
  const router = Router();

  /**
   * POST /api/billing/checkout
   * Create a Stripe Checkout Session for the given tier.
   * Requires board (user) authentication.
   */
  router.post("/checkout", async (req, res) => {
    if (req.actor.type !== "board" || !req.actor.userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const tier = req.body.tier as string;
    if (tier !== "starter" && tier !== "pro") {
      res.status(400).json({ error: "Invalid tier. Must be 'starter' or 'pro'." });
      return;
    }

    const priceId = getPriceIdForTier(tier as "starter" | "pro");
    if (!priceId) {
      res.status(500).json({ error: `Price ID for tier '${tier}' is not configured.` });
      return;
    }

    const stripe = getStripe();
    const appUrl = process.env.AIDEVELO_APP_URL ?? "http://localhost:5173";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing?checkout=cancelled`,
      metadata: {
        userId: req.actor.userId,
        tier,
      },
    });

    res.json({ sessionId: session.id, sessionUrl: session.url });
  });

  /**
   * GET /api/billing/subscription
   * Get current user's active subscription and quota status.
   */
  router.get("/subscription", async (req, res) => {
    if (req.actor.type !== "board" || !req.actor.userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const sub = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, req.actor.userId))
      .execute();

    if (!sub[0]) {
      res.json({ subscription: null });
      return;
    }

    const quotaInfo = await getRemainingQuota(db, req.actor.userId, sub[0].tier);

    res.json({
      subscription: {
        id: sub[0].id,
        tier: sub[0].tier,
        status: sub[0].status,
        currentPeriodStart: sub[0].currentPeriodStart,
        currentPeriodEnd: sub[0].currentPeriodEnd,
        cancelAtPeriodEnd: sub[0].cancelAtPeriodEnd,
      },
      quota: quotaInfo,
    });
  });

  /**
   * GET /api/billing/api-keys
   * List the user's API keys (only active, not revoked).
   * Plaintext keys are never returned — only id, name, lastUsedAt, createdAt.
   */
  router.get("/api-keys", async (req, res) => {
    if (req.actor.type !== "board" || !req.actor.userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const keys = await db
      .select({
        id: userApiKeys.id,
        name: userApiKeys.name,
        lastUsedAt: userApiKeys.lastUsedAt,
        createdAt: userApiKeys.createdAt,
      })
      .from(userApiKeys)
      .where(eq(userApiKeys.userId, req.actor.userId))
      .execute();

    res.json({ apiKeys: keys.filter((k) => !k.id.includes("revoked")) });
  });

  /**
   * POST /api/billing/api-keys
   * Create a new API key for the user.
   * Returns the plaintext key ONCE — it cannot be retrieved later.
   */
  router.post("/api-keys", async (req, res) => {
    if (req.actor.type !== "board" || !req.actor.userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    // Check user has an active subscription
    const subs = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, req.actor.userId))
      .execute();

    if (!subs[0] || (subs[0].status !== "active" && subs[0].status !== "trialing")) {
      res.status(403).json({ error: "Active subscription required to create API keys." });
      return;
    }

    const { plaintext, hash } = generateApiKey();
    await db
      .insert(userApiKeys)
      .values({
        userId: req.actor.userId,
        keyHash: hash,
        name: req.body.name ?? "Default",
      })
      .execute();

    res.status(201).json({
      apiKey: plaintext,
      message: "Save this key — it will not be shown again.",
    });
  });

  /**
   * DELETE /api/billing/api-keys/:keyId
   * Revoke an API key.
   */
  router.delete("/api-keys/:keyId", async (req, res) => {
    if (req.actor.type !== "board" || !req.actor.userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    await db
      .update(userApiKeys)
      .set({ revokedAt: new Date() })
      .where(eq(userApiKeys.id, req.params.keyId))
      .execute();

    res.json({ revoked: true });
  });

  return router;
}
