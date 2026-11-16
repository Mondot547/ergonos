// Données de DÉMONSTRATION fictives. Refuse de tourner en production.
import { PrismaClient } from "@prisma/client";
import { DEMO_CATEGORIES, DEMO_PRODUCTS } from "../src/lib/bigbuy/demo-data.ts";

if (process.env.NODE_ENV === "production") {
  console.error("Seed de démonstration refusé en production.");
  process.exit(1);
}

const prisma = new PrismaClient();

for (const c of DEMO_CATEGORIES) {
  await prisma.category.upsert({ where: { slug: c.slug }, update: {}, create: c });
}
for (const p of DEMO_PRODUCTS) {
  const category = await prisma.category.findUnique({ where: { slug: p.category } });
  await prisma.product.upsert({
    where: { slug: p.slug },
    update: {},
    create: {
      slug: p.slug,
      name: p.name,
      description: "Produit de démonstration : données fictives.",
      priceCents: p.priceCents,
      supplierCostCents: p.supplierCostCents,
      stock: p.stock,
      status: "DRAFT", // à publier manuellement depuis l'admin
      supplier: "DEMO",
      isDemo: true,
      categoryId: category?.id,
    },
  });
}
console.log("Données de démonstration créées (produits en brouillon).");
await prisma.$disconnect();
