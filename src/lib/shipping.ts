/** Frais de livraison forfaitaires en centimes, définis par l'exploitant (SHIPPING_FLAT_CENTS). 0 par défaut : non validé. */
export function shippingCentsFromEnv(): number {
  const n = Number(process.env.SHIPPING_FLAT_CENTS ?? "0");
  return Number.isSafeInteger(n) && n >= 0 ? n : 0;
}
