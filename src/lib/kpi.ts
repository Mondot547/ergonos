// Indicateurs du tableau de bord. Principe : chaque valeur indique sa nature
// (réelle / estimée / manquante) et les données de démonstration ne sont
// jamais mélangées aux données réelles.
import { sum } from "./money.ts";

export type OrderStatus =
  | "PAID" | "NEEDS_REVIEW" | "CANCELLED" | "PARTIALLY_REFUNDED" | "REFUNDED";

export interface OrderForKpi {
  createdAt: Date;
  status: OrderStatus;
  /** Montant encaissé TTC (produits + livraison), centimes. */
  grossCents: number;
  refundedCents: number;
  /** Frais Stripe réels si connus, sinon null. */
  feeCents: number | null;
  /** Somme des coûts d'achat connus ; null si au moins une ligne n'a pas de coût. */
  supplierCostCents: number | null;
  itemsCount: number;
  shipCountry: string | null;
  isDemo: boolean;
}

export type MetricKind = "real" | "estimated" | "missing";
export interface Metric {
  value: number | null;
  kind: MetricKind;
  /** Part des commandes pour lesquelles la donnée est disponible (0..1). */
  coverage: number;
  note?: string;
}

export interface Range { from: Date; to: Date } // [from, to[

export interface Kpis {
  dataset: "real" | "demo";
  orders: number;
  itemsSold: number;
  grossRevenue: Metric;
  refunds: Metric;
  cancelledOrders: number;
  paymentFees: Metric;
  supplierCosts: Metric;
  estimatedMargin: Metric;
  byCountry: { country: string; orders: number; grossCents: number }[];
}

function inRange(d: Date, r: Range) {
  return d >= r.from && d < r.to;
}

function coverageMetric(values: (number | null)[], kind: MetricKind, note?: string): Metric {
  const known = values.filter((v): v is number => v !== null);
  if (values.length === 0) return { value: null, kind: "missing", coverage: 0, note: "Aucune commande sur la période." };
  if (known.length === 0) return { value: null, kind: "missing", coverage: 0, note };
  return { value: sum(known), kind, coverage: known.length / values.length, note };
}

export function computeKpis(all: OrderForKpi[], range: Range, dataset: "real" | "demo"): Kpis {
  const scoped = all.filter((o) => o.isDemo === (dataset === "demo") && inRange(o.createdAt, range));
  const cancelled = scoped.filter((o) => o.status === "CANCELLED");
  // Les commandes à vérifier ne sont pas comptées comme ventes confirmées.
  const sold = scoped.filter((o) => o.status !== "CANCELLED" && o.status !== "NEEDS_REVIEW");

  const gross = sum(sold.map((o) => o.grossCents));
  const refunds = sum(sold.map((o) => o.refundedCents));

  const fees = coverageMetric(sold.map((o) => o.feeCents), "real", "Frais Stripe disponibles uniquement pour les commandes où ils ont été récupérés.");
  const costs = coverageMetric(sold.map((o) => o.supplierCostCents), "real", "Coûts d'achat connus uniquement ; TVA/unité à confirmer avec le fournisseur.");

  // Marge estimée : seulement si frais ET coûts sont connus pour 100 % des commandes.
  let margin: Metric;
  if (sold.length > 0 && fees.coverage === 1 && costs.coverage === 1) {
    margin = {
      value: gross - refunds - (fees.value ?? 0) - (costs.value ?? 0),
      kind: "estimated",
      coverage: 1,
      note: "Estimation : CA encaissé − remboursements − frais de paiement − coûts d'achat. Hors TVA, hors frais de livraison fournisseur, hors autres charges.",
    };
  } else {
    margin = { value: null, kind: "missing", coverage: Math.min(fees.coverage, costs.coverage), note: "Non calculée : frais de paiement ou coûts d'achat manquants pour certaines commandes." };
  }

  const byCountryMap = new Map<string, { orders: number; grossCents: number }>();
  for (const o of sold) {
    const k = o.shipCountry ?? "Inconnu";
    const cur = byCountryMap.get(k) ?? { orders: 0, grossCents: 0 };
    cur.orders += 1;
    cur.grossCents += o.grossCents;
    byCountryMap.set(k, cur);
  }

  return {
    dataset,
    orders: sold.length,
    itemsSold: sum(sold.map((o) => o.itemsCount)),
    grossRevenue: { value: gross, kind: "real", coverage: 1, note: "Chiffre d'affaires brut encaissé — ce n'est pas un bénéfice." },
    refunds: { value: refunds, kind: "real", coverage: 1 },
    cancelledOrders: cancelled.length,
    paymentFees: fees,
    supplierCosts: costs,
    estimatedMargin: margin,
    byCountry: [...byCountryMap.entries()]
      .map(([country, v]) => ({ country, ...v }))
      .sort((a, b) => b.grossCents - a.grossCents),
  };
}

/** Période précédente de même durée, pour la comparaison. */
export function previousRange(r: Range): Range {
  const len = r.to.getTime() - r.from.getTime();
  return { from: new Date(r.from.getTime() - len), to: new Date(r.from.getTime()) };
}
