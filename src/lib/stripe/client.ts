import Stripe from "stripe";

/**
 * Garde-fou : refuse toute clé live tant que ALLOW_LIVE_PAYMENTS n'est pas explicitement "true".
 * Le projet est livré en mode test uniquement.
 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY manquant (clé de TEST attendue).");
  const isLive = key.startsWith("sk_live_") || key.startsWith("rk_live_");
  if (isLive && process.env.ALLOW_LIVE_PAYMENTS !== "true") {
    throw new Error("Clé Stripe live refusée : ALLOW_LIVE_PAYMENTS n'est pas activé.");
  }
  return new Stripe(key);
}

export function isStripeTestMode(): boolean {
  return !(process.env.STRIPE_SECRET_KEY ?? "").includes("_live_");
}
