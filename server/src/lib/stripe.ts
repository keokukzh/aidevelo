/**
 * Stripe client and helpers.
 * Requires: npm install stripe
 * Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
 *       STRIPE_STARTER_PRICE_ID, STRIPE_PRO_PRICE_ID
 */
import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY env var is not set");
    _stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  }
  return _stripe;
}

export const STARTER_PRICE_ID = process.env.STRIPE_STARTER_PRICE_ID ?? "";
export const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID ?? "";
export const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

export function getPriceIdForTier(tier: "starter" | "pro"): string {
  return tier === "starter" ? STARTER_PRICE_ID : PRO_PRICE_ID;
}

export function getTierFromPriceId(priceId: string): "starter" | "pro" | null {
  if (priceId === STARTER_PRICE_ID) return "starter";
  if (priceId === PRO_PRICE_ID) return "pro";
  return null;
}
