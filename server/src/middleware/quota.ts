/**
 * Quota check middleware.
 * Protects routes that make MiniMax API calls by enforcing the
 * per-user 5-hour rolling window quota.
 *
 * Usage in app.ts:
 *   app.use(quotaMiddleware(db));
 *
 * The middleware expects req.actor to have a userId (board session).
 * If no subscription is found, the request is allowed through (free tier / no billing).
 * Quota-exhausted requests receive HTTP 429.
 */
import type { RequestHandler } from "express";
import type { Db } from "@aideveloai/db";
import { eq } from "drizzle-orm";
import { subscriptions } from "@aideveloai/db";
import { hasRemainingQuota, recordRequest } from "../lib/usage.js";
import { logger } from "./logger.js";

export function quotaMiddleware(_db: Db): RequestHandler {
  return async (req, res, next) => {
    // Only enforce on API routes that call the AI provider
    const path = req.path.toLowerCase();
    if (!path.startsWith("/llms") && !path.startsWith("/agents/")) {
      next();
      return;
    }

    // Skip for unauthenticated or agent requests
    if (req.actor.type !== "board" || !req.actor.userId) {
      next();
      return;
    }

    // Check if user has an active subscription
    const subs = await _db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, req.actor.userId))
      .execute();

    const sub = subs[0];

    // No subscription = free tier or no billing = skip quota check
    if (!sub) {
      next();
      return;
    }

    // Skip if subscription is not active
    if (sub.status !== "active" && sub.status !== "trialing") {
      next();
      return;
    }

    const quotaOk = await hasRemainingQuota(_db, req.actor.userId, sub.tier);
    if (!quotaOk) {
      const windowEnd = new Date(Date.now() + 5 * 60 * 60 * 1000);
      res.status(429).json({
        error: "Quota exceeded",
        message: `You have reached your ${sub.tier} plan limit (${sub.tier === "starter" ? 300 : 1000} requests per 5-hour window).`,
        resetsAt: windowEnd.toISOString(),
      });
      return;
    }

    // Record the request (non-fatal if it fails)
    try {
      await recordRequest(_db, req.actor.userId);
    } catch (err) {
      logger.warn({ err, userId: req.actor.userId }, "Failed to record request in quota tracking");
    }

    next();
  };
}
