import { test } from "node:test";
import assert from "node:assert/strict";
import { priceCart, type ProductRow } from "../src/lib/pricing.ts";
import { computeKpis, previousRange, type OrderForKpi } from "../src/lib/kpi.ts";
import { hashPassword, verifyPassword } from "../src/lib/auth/password.ts";
import { totpAt, verifyTotp, base32Decode, generateSecret } from "../src/lib/auth/totp.ts";
import { can, lockoutAfterFailure, isLocked } from "../src/lib/auth/permissions.ts";
import { newSessionToken, hashToken, isSessionValid } from "../src/lib/auth/session-token.ts";
import { handleStripeEvent, type WebhookStore, type NewOrder, type CheckoutSnapshotRecord } from "../src/lib/stripe/webhook-handler.ts";
import { BigBuyClient, bigBuyConfigFromEnv, bigBuyStatus } from "../src/lib/bigbuy/client.ts";

// ---------- pricing ----------
const prod = (o: Partial<ProductRow> = {}): ProductRow => ({
  id: "p1", name: "Produit", priceCents: 1000, stock: 5, status: "PUBLISHED", supplierCostCents: 400, ...o,
});

test("priceCart : le prix vient de la base, jamais du client", () => {
  const r = priceCart([{ productId: "p1", quantity: 2, ...( { priceCents: 1 } as object) } as any], new Map([["p1", prod()]]), 490);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.subtotalCents, 2000);
    assert.equal(r.totalCents, 2490);
  }
});

test("priceCart : refuse brouillon, stock inconnu, stock insuffisant, quantité excessive, panier vide", () => {
  const m = (p: ProductRow) => new Map([[p.id, p]]);
  assert.equal(priceCart([{ productId: "p1", quantity: 1 }], m(prod({ status: "DRAFT" })), 0).ok, false);
  assert.equal(priceCart([{ productId: "p1", quantity: 1 }], m(prod({ stock: null })), 0).ok, false);
  assert.equal(priceCart([{ productId: "p1", quantity: 6 }], m(prod()), 0).ok, false);
  assert.equal(priceCart([{ productId: "p1", quantity: 11 }], m(prod({ stock: 99 })), 0).ok, false);
  assert.equal(priceCart([], m(prod()), 0).ok, false);
  assert.equal(priceCart([{ productId: "p1", quantity: 1.5 }], m(prod()), 0).ok, false);
  assert.equal(priceCart([{ productId: "inconnu", quantity: 1 }], m(prod()), 0).ok, false);
});

test("priceCart : fusionne les doublons avant de contrôler le stock", () => {
  const r = priceCart([{ productId: "p1", quantity: 3 }, { productId: "p1", quantity: 3 }], new Map([["p1", prod()]]), 0);
  assert.equal(r.ok, false);
});

// ---------- KPI ----------
const d = (s: string) => new Date(s);
const order = (o: Partial<OrderForKpi> = {}): OrderForKpi => ({
  createdAt: d("2026-11-10T10:00:00Z"), status: "PAID", grossCents: 5000, refundedCents: 0,
  feeCents: 100, supplierCostCents: 2000, itemsCount: 2, shipCountry: "FR", isDemo: false, ...o,
});
const range = { from: d("2026-11-01T00:00:00Z"), to: d("2026-12-01T00:00:00Z") };

test("KPI : marge estimée seulement si frais et coûts sont complets", () => {
  const ok = computeKpis([order(), order()], range, "real");
  assert.equal(ok.estimatedMargin.kind, "estimated");
  assert.equal(ok.estimatedMargin.value, 2 * (5000 - 100 - 2000));
  const partial = computeKpis([order(), order({ supplierCostCents: null })], range, "real");
  assert.equal(partial.estimatedMargin.kind, "missing");
  assert.equal(partial.estimatedMargin.value, null);
  assert.equal(partial.supplierCosts.coverage, 0.5);
});

test("KPI : démo et réel ne se mélangent jamais", () => {
  const all = [order(), order({ isDemo: true, grossCents: 99999 })];
  assert.equal(computeKpis(all, range, "real").grossRevenue.value, 5000);
  assert.equal(computeKpis(all, range, "demo").grossRevenue.value, 99999);
});

test("KPI : annulations et commandes à vérifier exclues des ventes ; remboursements comptés", () => {
  const k = computeKpis([order(), order({ status: "CANCELLED" }), order({ status: "NEEDS_REVIEW" }), order({ status: "PARTIALLY_REFUNDED", refundedCents: 1000 })], range, "real");
  assert.equal(k.orders, 2);
  assert.equal(k.cancelledOrders, 1);
  assert.equal(k.refunds.value, 1000);
  assert.equal(k.byCountry[0].country, "FR");
});

test("KPI : période précédente et bornes [from, to[", () => {
  const p = previousRange(range);
  assert.equal(p.to.getTime(), range.from.getTime());
  assert.equal(computeKpis([order({ createdAt: range.to })], range, "real").orders, 0);
});

// ---------- auth ----------
test("mot de passe : hash vérifiable, sel unique, refus des mots de passe courts", async () => {
  const h1 = await hashPassword("un-mot-de-passe-long");
  const h2 = await hashPassword("un-mot-de-passe-long");
  assert.notEqual(h1, h2);
  assert.equal(await verifyPassword("un-mot-de-passe-long", h1), true);
  assert.equal(await verifyPassword("autre-mot-de-passe!", h1), false);
  assert.equal(await verifyPassword("x", "format-invalide"), false);
  await assert.rejects(hashPassword("court"));
});

test("TOTP : vecteur RFC 6238 (SHA1, 59 s → 94287082 → 287082)", () => {
  // Secret RFC 6238 « 12345678901234567890 » en base32
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(base32Decode(secret).toString(), "12345678901234567890");
  assert.equal(totpAt(secret, 59_000), "287082");
});

test("TOTP : tolérance ±1 pas et anti-rejeu", () => {
  const s = generateSecret();
  const now = 1_700_000_000_000;
  const code = totpAt(s, now);
  const step = verifyTotp(s, code, now, null);
  assert.notEqual(step, null);
  assert.equal(verifyTotp(s, code, now, step), null); // rejeu refusé
  assert.notEqual(verifyTotp(s, code, now + 30_000, null), null); // décalage d'un pas accepté
  assert.equal(verifyTotp(s, code, now + 120_000, null), null);
  assert.equal(verifyTotp(s, "abc", now, null), null);
});

test("permissions : seules les rôles OWNER/ORDERS voient les données personnelles", () => {
  assert.equal(can("OWNER", "orders:pii"), true);
  assert.equal(can("ORDERS", "orders:pii"), true);
  assert.equal(can("CATALOG", "orders:pii"), false);
  assert.equal(can("VIEWER", "orders:pii"), false);
  assert.equal(can("VIEWER", "products:write"), false);
  assert.equal(can("ORDERS", "audit:view"), false);
});

test("verrouillage après 5 échecs", () => {
  const now = new Date();
  assert.equal(lockoutAfterFailure(3, now).lockedUntil, null);
  const l = lockoutAfterFailure(4, now);
  assert.ok(l.lockedUntil && isLocked(l.lockedUntil, now));
  assert.equal(isLocked(l.lockedUntil, new Date(now.getTime() + 16 * 60_000)), false);
});

test("session : jeton aléatoire, hash stocké, expiration", () => {
  const a = newSessionToken(), b = newSessionToken();
  assert.notEqual(a.token, b.token);
  assert.equal(hashToken(a.token), a.hash);
  const now = new Date();
  assert.equal(isSessionValid({ createdAt: now, lastSeenAt: now }, now), true);
  assert.equal(isSessionValid({ createdAt: now, lastSeenAt: new Date(now.getTime() - 3 * 3600_000) }, now), false);
});

// ---------- webhook ----------
function memoryStore(snap: CheckoutSnapshotRecord | null, opts: { failOnce?: boolean } = {}) {
  const events = new Set<string>();
  const orders = new Map<string, NewOrder>();
  const refunds = new Map<string, number>();
  let failed = false;
  const store: WebhookStore = {
    async claimEvent(id) { if (events.has(id)) return false; events.add(id); return true; },
    async releaseEvent(id) { events.delete(id); },
    async getSnapshot() { return snap; },
    async createOrderIfAbsent(o) {
      if (opts.failOnce && !failed) { failed = true; throw new Error("panne base"); }
      if (orders.has(o.stripeSessionId)) return { created: false };
      orders.set(o.stripeSessionId, o); return { created: true };
    },
    async markSnapshotExpired() {},
    async setRefundedTotal(pi, cents) { refunds.set(pi, cents); return true; },
    async fetchFeeCents() { return 120; },
    async audit() {},
  };
  return { store, orders, refunds, events };
}
const snapshot: CheckoutSnapshotRecord = {
  id: "ck1", totalCents: 2490, shippingCents: 490, isDemo: false,
  lines: [{ productId: "p1", name: "Produit", unitPriceCents: 1000, quantity: 2, supplierCostCents: 400 }],
};
const completed = (id = "evt_1", amount = 2490) => ({
  id, type: "checkout.session.completed",
  data: { object: { id: "cs_1", payment_status: "paid", amount_total: amount, currency: "eur", payment_intent: "pi_1",
    metadata: { checkoutId: "ck1" }, customer_details: { email: "a@b.fr", name: "A B" },
    shipping_details: { address: { country: "FR" } } } },
});

test("webhook : un même événement ne crée qu'une commande", async () => {
  const { store, orders } = memoryStore(snapshot);
  assert.equal(await handleStripeEvent(completed(), store), "order_created");
  assert.equal(await handleStripeEvent(completed(), store), "duplicate");
  assert.equal(orders.size, 1);
});

test("webhook : deux événements distincts pour la même session ne dupliquent pas la commande", async () => {
  const { store, orders } = memoryStore(snapshot);
  await handleStripeEvent(completed("evt_1"), store);
  assert.equal(await handleStripeEvent(completed("evt_2"), store), "order_exists");
  assert.equal(orders.size, 1);
});

test("webhook : montant payé ≠ total serveur → commande à vérifier", async () => {
  const { store, orders } = memoryStore(snapshot);
  await handleStripeEvent(completed("evt_1", 1), store);
  assert.equal(orders.get("cs_1")?.status, "NEEDS_REVIEW");
});

test("webhook : paiement non encore réglé ignoré", async () => {
  const { store, orders } = memoryStore(snapshot);
  const e = completed(); e.data.object.payment_status = "unpaid";
  assert.equal(await handleStripeEvent(e, store), "ignored");
  assert.equal(orders.size, 0);
});

test("webhook : échec de traitement → événement libéré, Stripe peut rejouer", async () => {
  const { store, orders } = memoryStore(snapshot, { failOnce: true });
  await assert.rejects(handleStripeEvent(completed(), store));
  assert.equal(await handleStripeEvent(completed(), store), "order_created");
  assert.equal(orders.size, 1);
});

test("webhook : remboursement enregistré en valeur absolue (rejouable)", async () => {
  const { store, refunds } = memoryStore(snapshot);
  const e = { id: "evt_r", type: "charge.refunded", data: { object: { payment_intent: "pi_1", amount_refunded: 500, refunded: false } } };
  assert.equal(await handleStripeEvent(e, store), "refund_recorded");
  assert.equal(refunds.get("pi_1"), 500);
});

// ---------- BigBuy ----------
test("BigBuy : désactivé par défaut, client non instanciable", () => {
  const cfg = bigBuyConfigFromEnv({});
  assert.equal(bigBuyStatus(cfg).state, "disabled");
  assert.throws(() => new BigBuyClient(cfg));
  assert.equal(bigBuyStatus(bigBuyConfigFromEnv({ BIGBUY_ENABLED: "true" })).state, "disabled"); // clé manquante
});

test("BigBuy : envoie le Bearer et refuse les erreurs HTTP (fetch simulé, aucun appel réseau)", async () => {
  const calls: { url: string; auth: string }[] = [];
  const fake = (async (url: URL, init: RequestInit) => {
    calls.push({ url: String(url), auth: (init.headers as Record<string, string>).Authorization });
    return new Response(JSON.stringify([]), { status: calls.length === 1 ? 200 : 401 });
  }) as unknown as typeof fetch;
  const c = new BigBuyClient(bigBuyConfigFromEnv({ BIGBUY_ENABLED: "true", BIGBUY_API_KEY: "cle-test" }), fake);
  await c.taxonomies();
  assert.match(calls[0].url, /\/rest\/catalog\/taxonomies\.json\?firstLevel=true$/);
  assert.equal(calls[0].auth, "Bearer cle-test");
  await assert.rejects(c.taxonomies(), /HTTP 401/);
});
