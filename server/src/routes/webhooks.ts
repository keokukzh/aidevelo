import { Router } from "express";
import type { Request } from "express";
import { eq } from "drizzle-orm";
import type { Db } from "@aideveloai/db";
import { subscriptions, userApiKeys } from "@aideveloai/db";
import { getStripe, getTierFromPriceId, WEBHOOK_SECRET } from "../lib/stripe.js";
import { generateApiKey, hashApiKey } from "../lib/api-keys.js";
import { unauthorized, badRequest } from "../errors.js";
import { logger } from "../middleware/logger.js";

export function webhookRoutes(db: Db) {
  const router = Router();

  /**
   * POST /api/webhooks/stripe
   * Stripe webhook endpoint.
   * WARNING: This route should be mounted BEFORE express.json() body parser
   * since we need the raw body for signature verification.
   * In practice we use verifyStripeSignature middleware inline below.
   */
  router.post("/webhooks/stripe", async (req: Request, res) => {
    const sig = req.header("stripe-signature");
    if (!sig) {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }

    let event: ReturnType<typeof getStripe>["webhooks"]["constructEvent"] extends (...args: never[]) => infer R ? R : never;
    try {
      const rawBody = (req as unknown as { rawBody: Buffer }).rawBody;
      if (!rawBody) {
        res.status(400).json({ error: "rawBody not available — ensure express.json verify callback is set" });
        return;
      }
      event = getStripe().webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
    } catch (err) {
      logger.warn({ err }, "Stripe webhook signature verification failed");
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    // Acknowledge immediately — Stripe expects 200 within 10s
    res.json({ received: true });

    try {
      await handleStripeEvent(db, event);
    } catch (err) {
      logger.error({ err, eventType: event.type }, "Error handling Stripe webhook");
    }
  });

  return router;
}

async function handleStripeEvent(db: Db, event: { type: string; data: { object: Record<string, unknown> } }) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as {
        metadata?: { userId?: string; tier?: string };
        subscription?: string;
        customer?: string;
      };
      const userId = session.metadata?.userId;
      const tier = (session.metadata?.tier as "starter" | "pro") ?? "starter";

      if (!userId) {
        logger.warn({ session }, "checkout.session.completed missing userId metadata");
        return;
      }

      // Upsert subscription
      await db
        .insert(subscriptions)
        .values({
          id: userId, // maps 1:1 with authUsers.id
          userId,
          stripeSubscriptionId: session.subscription ?? null,
          stripeCustomerId: session.customer ?? null,
          tier,
          status: "active",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // approximated
        })
        .onConflictDoUpdate({
          target: subscriptions.id,
          set: {
            stripeSubscriptionId: session.subscription ?? null,
            stripeCustomerId: session.customer ?? null,
            tier,
            status: "active",
            updatedAt: new Date(),
          },
        })
        .execute();

      // Generate and store API key for the user
      const { plaintext, hash } = generateApiKey();
      await db
        .insert(userApiKeys)
        .values({
          userId,
          keyHash: hash,
          name: "Default",
        })
        .execute();

      logger.info({ userId, apiKeyHash: hash }, "API key generated and stored for new subscriber");
      // Log plaintext so it can be included in the welcome email
      logger.info({ plaintext, userId }, "NEW_API_KEY_GENERATED");

      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as {
        id: string;
        customer: string;
        status?: string;
        items?: { data?: { price?: { id?: string } }[] };
      };

      const tier = sub.items?.data?.[0]?.price?.id
        ? getTierFromPriceId(sub.items.data[0].price.id) ?? "starter"
        : "starter";

      const statusMap: Record<string, string> = {
        active: "active",
        trialing: "trialing",
        past_due: "past_due",
        canceled: "cancelled",
        unpaid: "past_due",
      };

      await db
        .update(subscriptions)
        .set({
          tier,
          status: statusMap[sub.status ?? ""] ?? "active",
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.stripeSubscriptionId, sub.id))
        .execute();

      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as { id: string };

      await db
        .update(subscriptions)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(subscriptions.stripeSubscriptionId, sub.id))
        .execute();

      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as { subscription?: string };

      if (invoice.subscription) {
        await db
          .update(subscriptions)
          .set({ status: "past_due", updatedAt: new Date() })
          .where(eq(subscriptions.stripeSubscriptionId, invoice.subscription))
          .execute();
      }

      break;
    }

    default:
      // Unhandled event types — silently ignore
      break;
  }
}
