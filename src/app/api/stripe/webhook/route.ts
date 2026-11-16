import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { handleStripeEvent } from "@/lib/stripe/webhook-handler";
import { prismaWebhookStore } from "@/lib/stripe/prisma-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "Requête non signée" }, { status: 400 });

  const stripe = getStripe();
  const body = await req.text(); // corps brut indispensable à la vérification de signature

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  try {
    const result = await handleStripeEvent(event as never, prismaWebhookStore(stripe));
    return NextResponse.json({ received: true, result });
  } catch (err) {
    console.error("[stripe-webhook]", event.id, event.type, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Traitement échoué" }, { status: 500 }); // Stripe rejouera
  }
}
