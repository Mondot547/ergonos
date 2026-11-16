// Traitement des événements Stripe, découplé de Prisma et du SDK Stripe pour être testable.
// La signature est vérifiée AVANT d'arriver ici (voir src/app/api/stripe/webhook/route.ts).

export interface StripeEventLike {
  id: string;
  type: string;
  data: { object: Record<string, any> };
}

export interface SnapshotLine {
  productId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  supplierCostCents: number | null;
}

export interface CheckoutSnapshotRecord {
  id: string;
  lines: SnapshotLine[];
  totalCents: number;
  shippingCents: number;
  isDemo: boolean;
}

export interface NewOrder {
  stripeSessionId: string;
  stripePaymentIntentId: string | null;
  status: "PAID" | "NEEDS_REVIEW";
  reviewReason: string | null;
  grossCents: number;
  shippingCents: number;
  feeCents: number | null;
  customerEmail: string | null;
  customerName: string | null;
  shipCountry: string | null;
  shipAddress: unknown;
  isDemo: boolean;
  lines: SnapshotLine[];
}

export interface WebhookStore {
  /** Insère l'id d'événement. Retourne false s'il existait déjà (doublon). */
  claimEvent(id: string, type: string): Promise<boolean>;
  /** Libère un événement dont le traitement a échoué pour permettre le rejeu Stripe. */
  releaseEvent(id: string): Promise<void>;
  getSnapshot(id: string): Promise<CheckoutSnapshotRecord | null>;
  /** Doit être idempotent sur stripeSessionId (contrainte d'unicité). */
  createOrderIfAbsent(order: NewOrder): Promise<{ created: boolean }>;
  markSnapshotExpired(id: string): Promise<void>;
  /** Fixe le total remboursé (valeur absolue, donc rejouable sans effet de bord). */
  setRefundedTotal(paymentIntentId: string, refundedCents: number, fullyRefunded: boolean): Promise<boolean>;
  /** Récupère les frais Stripe réels ; null si indisponibles. */
  fetchFeeCents(paymentIntentId: string | null): Promise<number | null>;
  audit(action: string, entityId: string, meta: Record<string, unknown>): Promise<void>;
}

export type HandleResult = "duplicate" | "order_created" | "order_exists" | "refund_recorded" | "expired" | "ignored";

export async function handleStripeEvent(event: StripeEventLike, store: WebhookStore): Promise<HandleResult> {
  const isNew = await store.claimEvent(event.id, event.type);
  if (!isNew) return "duplicate";

  try {
    const obj = event.data.object;
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        if (obj.payment_status !== "paid") return "ignored"; // paiement asynchrone en attente
        return await createOrderFromSession(obj, store);
      }
      case "checkout.session.expired": {
        const id = obj.metadata?.checkoutId;
        if (typeof id === "string") await store.markSnapshotExpired(id);
        return "expired";
      }
      case "charge.refunded": {
        const pi = typeof obj.payment_intent === "string" ? obj.payment_intent : null;
        if (!pi) return "ignored";
        const refunded = Number(obj.amount_refunded);
        const full = Boolean(obj.refunded);
        const ok = await store.setRefundedTotal(pi, refunded, full);
        await store.audit("payment.refund", pi, { eventId: event.id, refundedCents: refunded, full, orderFound: ok });
        return "refund_recorded";
      }
      default:
        return "ignored";
    }
  } catch (err) {
    await store.releaseEvent(event.id);
    throw err;
  }
}

async function createOrderFromSession(session: Record<string, any>, store: WebhookStore): Promise<HandleResult> {
  const checkoutId = session.metadata?.checkoutId;
  if (typeof checkoutId !== "string") throw new Error("Session sans checkoutId : impossible de rapprocher la commande.");

  const snap = await store.getSnapshot(checkoutId);
  if (!snap) throw new Error(`Snapshot de panier introuvable : ${checkoutId}`);

  const pi = typeof session.payment_intent === "string" ? session.payment_intent : null;
  const paid = Number(session.amount_total);

  // Contrôle de cohérence : le montant payé doit correspondre au montant calculé côté serveur.
  const mismatch = paid !== snap.totalCents || session.currency !== "eur";
  const ship = session.shipping_details ?? session.collected_information?.shipping_details ?? null;

  const order: NewOrder = {
    stripeSessionId: String(session.id),
    stripePaymentIntentId: pi,
    status: mismatch ? "NEEDS_REVIEW" : "PAID",
    reviewReason: mismatch ? `Montant Stripe (${paid} ${session.currency}) différent du total serveur (${snap.totalCents} eur).` : null,
    grossCents: paid,
    shippingCents: snap.shippingCents,
    feeCents: await store.fetchFeeCents(pi),
    customerEmail: session.customer_details?.email ?? null,
    customerName: session.customer_details?.name ?? null,
    shipCountry: ship?.address?.country ?? null,
    shipAddress: ship?.address ?? null,
    isDemo: snap.isDemo,
    lines: snap.lines,
  };

  const { created } = await store.createOrderIfAbsent(order);
  await store.audit(created ? "order.created" : "order.exists", order.stripeSessionId, { status: order.status });
  return created ? "order_created" : "order_exists";
}
