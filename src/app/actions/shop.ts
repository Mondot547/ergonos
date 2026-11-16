"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { readCart, writeCart, clearCartCookie } from "@/lib/cart";
import { priceCart, MAX_QTY_PER_LINE } from "@/lib/pricing";
import { getStripe } from "@/lib/stripe/client";

export async function addToCart(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  const cart = await readCart();
  const existing = cart.find((l) => l.productId === productId);
  if (existing) existing.quantity = Math.min(existing.quantity + 1, MAX_QTY_PER_LINE);
  else cart.push({ productId, quantity: 1 });
  await writeCart(cart);
  redirect("/panier");
}

export async function updateCart(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  const qty = Number(formData.get("quantity"));
  const cart = (await readCart()).filter((l) => l.productId !== productId);
  if (Number.isInteger(qty) && qty > 0) cart.push({ productId, quantity: Math.min(qty, MAX_QTY_PER_LINE) });
  await writeCart(cart);
  redirect("/panier");
}

export async function clearCart() {
  await clearCartCookie();
}

export function shippingCentsFromEnv(): number {
  const n = Number(process.env.SHIPPING_FLAT_CENTS ?? "0");
  return Number.isSafeInteger(n) && n >= 0 ? n : 0;
}

export async function startCheckout() {
  const cart = await readCart();
  const products = await prisma.product.findMany({ where: { id: { in: cart.map((l) => l.productId) } } });
  const map = new Map(products.map((p) => [p.id, p]));
  const shipping = shippingCentsFromEnv();
  // Le prix est relu en base ici : rien venant du navigateur n'entre dans le calcul.
  const priced = priceCart(cart, map, shipping);
  if (!priced.ok) redirect("/panier?erreur=" + encodeURIComponent(priced.errors[0]));

  const isDemo = priced.lines.some((l) => map.get(l.productId)?.isDemo);
  const snapshot = await prisma.checkoutSnapshot.create({
    data: { linesJson: priced.lines as object[], shippingCents: shipping, totalCents: priced.totalCents, isDemo },
  });

  const site = process.env.SITE_URL ?? "http://localhost:3000";
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    locale: "fr",
    currency: "eur",
    line_items: priced.lines.map((l) => ({
      quantity: l.quantity,
      price_data: { currency: "eur", unit_amount: l.unitPriceCents, product_data: { name: l.name } },
    })),
    shipping_address_collection: { allowed_countries: ["FR"] },
    ...(shipping > 0
      ? { shipping_options: [{ shipping_rate_data: { type: "fixed_amount", display_name: "Livraison", fixed_amount: { amount: shipping, currency: "eur" } } }] }
      : {}),
    metadata: { checkoutId: snapshot.id },
    success_url: `${site}/commande/confirmation?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/commande/annulee`,
  });

  await prisma.checkoutSnapshot.update({ where: { id: snapshot.id }, data: { stripeSessionId: session.id } });
  if (!session.url) redirect("/panier?erreur=" + encodeURIComponent("Paiement indisponible."));
  redirect(session.url);
}
