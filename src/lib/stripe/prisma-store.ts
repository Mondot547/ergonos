import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.ts";
import { audit } from "../audit.ts";
import type { CheckoutSnapshotRecord, NewOrder, SnapshotLine, WebhookStore } from "./webhook-handler.ts";

export function prismaWebhookStore(stripe: Stripe): WebhookStore {
  return {
    async claimEvent(id, type) {
      try {
        await prisma.webhookEvent.create({ data: { id, type } });
        return true;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
        throw e;
      }
    },
    async releaseEvent(id) {
      await prisma.webhookEvent.delete({ where: { id } }).catch(() => {});
    },
    async getSnapshot(id): Promise<CheckoutSnapshotRecord | null> {
      const s = await prisma.checkoutSnapshot.findUnique({ where: { id } });
      if (!s) return null;
      return { id: s.id, lines: s.linesJson as unknown as SnapshotLine[], totalCents: s.totalCents, shippingCents: s.shippingCents, isDemo: s.isDemo };
    },
    async createOrderIfAbsent(o: NewOrder) {
      try {
        await prisma.order.create({
          data: {
            stripeSessionId: o.stripeSessionId,
            stripePaymentIntentId: o.stripePaymentIntentId,
            status: o.status,
            reviewReason: o.reviewReason,
            grossCents: o.grossCents,
            shippingCents: o.shippingCents,
            feeCents: o.feeCents,
            customerEmail: o.customerEmail,
            customerName: o.customerName,
            shipCountry: o.shipCountry,
            shipAddress: (o.shipAddress ?? undefined) as Prisma.InputJsonValue | undefined,
            isDemo: o.isDemo,
            items: {
              create: o.lines.map((l) => ({
                productId: l.productId,
                nameSnapshot: l.name,
                unitPriceCents: l.unitPriceCents,
                quantity: l.quantity,
                supplierCostCentsSnapshot: l.supplierCostCents,
              })),
            },
          },
        });
        return { created: true };
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { created: false };
        throw e;
      }
    },
    async markSnapshotExpired(id) {
      await prisma.checkoutSnapshot.updateMany({ where: { id }, data: { status: "EXPIRED" } });
    },
    async setRefundedTotal(pi, refundedCents, fullyRefunded) {
      const r = await prisma.order.updateMany({
        where: { stripePaymentIntentId: pi },
        data: { refundedCents, status: fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED" },
      });
      return r.count > 0;
    },
    async fetchFeeCents(pi) {
      if (!pi) return null;
      try {
        const intent = await stripe.paymentIntents.retrieve(pi, { expand: ["latest_charge.balance_transaction"] });
        const charge = intent.latest_charge;
        if (charge && typeof charge !== "string") {
          const bt = charge.balance_transaction;
          if (bt && typeof bt !== "string") return bt.fee;
        }
      } catch {
        /* frais indisponibles : on laisse null plutôt que d'inventer une valeur */
      }
      return null;
    },
    async audit(action, entityId, meta) {
      await audit(null, action, entityId, meta);
    },
  };
}
