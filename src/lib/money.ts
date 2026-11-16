// Tous les montants sont des entiers en centimes d'euro. Jamais de flottants.

export function assertCents(n: number, label = "montant"): number {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new Error(`${label} invalide : entier de centimes >= 0 attendu`);
  }
  return n;
}

export function formatEur(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
