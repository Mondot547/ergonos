// DONNÉES DE DÉMONSTRATION — fictives. Ne correspondent à aucun produit, prix ni fournisseur réel.
// Utilisées uniquement par `npm run db:seed` hors production. Toujours marquées isDemo = true.
export const DEMO_CATEGORIES = [
  { slug: "supports", name: "Supports et rehausseurs" },
  { slug: "rangement", name: "Rangement et organisation" },
  { slug: "confort", name: "Confort et posture" },
];

export const DEMO_PRODUCTS = [
  { slug: "demo-support-ordinateur", name: "[DÉMO] Support d'ordinateur portable", category: "supports", priceCents: 3990, supplierCostCents: 1800, stock: 25 },
  { slug: "demo-repose-poignets", name: "[DÉMO] Repose-poignets clavier", category: "confort", priceCents: 1990, supplierCostCents: 700, stock: 40 },
  { slug: "demo-organiseur-cables", name: "[DÉMO] Organiseur de câbles", category: "rangement", priceCents: 1290, supplierCostCents: null, stock: 60 },
  { slug: "demo-repose-pieds", name: "[DÉMO] Repose-pieds réglable", category: "confort", priceCents: 2990, supplierCostCents: 1300, stock: 0 },
];
