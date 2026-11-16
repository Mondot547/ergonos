import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.SITE_URL ?? "http://localhost:3000";
  const products = await prisma.product.findMany({ where: { status: "PUBLISHED", isDemo: false }, select: { slug: true, updatedAt: true } });
  return [
    { url: `${site}/` },
    { url: `${site}/produits` },
    ...products.map((p) => ({ url: `${site}/produits/${p.slug}`, lastModified: p.updatedAt })),
  ];
}
