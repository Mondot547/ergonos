// Calcul du panier côté serveur. Le navigateur n'envoie que { productId, quantity } :
// aucun prix fourni par le client n'est jamais lu.
import { assertCents, sum } from "./money.ts";

export const MAX_QTY_PER_LINE = 10;
export const MAX_LINES = 20;

export type ProductStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface ProductRow {
  id: string;
  name: string;
  priceCents: number;
  /** null = stock inconnu : le produit n'est pas achetable. */
  stock: number | null;
  status: ProductStatus;
  supplierCostCents: number | null;
}

export interface CartLine {
  productId: string;
  quantity: number;
}

export interface PricedLine {
  productId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  supplierCostCents: number | null;
}

export type PricedCart =
  | { ok: true; lines: PricedLine[]; subtotalCents: number; shippingCents: number; totalCents: number }
  | { ok: false; errors: string[] };

export function priceCart(
  rawLines: CartLine[],
  products: Map<string, ProductRow>,
  shippingCents: number,
): PricedCart {
  const errors: string[] = [];
  assertCents(shippingCents, "frais de livraison");

  // Fusion des doublons
  const merged = new Map<string, number>();
  for (const l of rawLines) {
    if (typeof l?.productId !== "string" || !Number.isInteger(l.quantity) || l.quantity < 1) {
      errors.push("Ligne de panier invalide.");
      continue;
    }
    merged.set(l.productId, (merged.get(l.productId) ?? 0) + l.quantity);
  }
  if (merged.size === 0 && errors.length === 0) errors.push("Le panier est vide.");
  if (merged.size > MAX_LINES) errors.push("Trop d'articles différents dans le panier.");

  const lines: PricedLine[] = [];
  for (const [productId, quantity] of merged) {
    const p = products.get(productId);
    if (!p || p.status !== "PUBLISHED") {
      errors.push("Un article n'est plus disponible.");
      continue;
    }
    if (quantity > MAX_QTY_PER_LINE) {
      errors.push(`Quantité maximale de ${MAX_QTY_PER_LINE} par article : « ${p.name} ».`);
      continue;
    }
    if (p.stock === null || p.stock < quantity) {
      errors.push(`Stock insuffisant ou inconnu : « ${p.name} ».`);
      continue;
    }
    assertCents(p.priceCents, "prix produit");
    lines.push({
      productId,
      name: p.name,
      unitPriceCents: p.priceCents,
      quantity,
      lineTotalCents: p.priceCents * quantity,
      supplierCostCents: p.supplierCostCents,
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  const subtotalCents = sum(lines.map((l) => l.lineTotalCents));
  return { ok: true, lines, subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents };
}
