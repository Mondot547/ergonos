import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatEur } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Produits" };

type SP = Promise<{ q?: string; categorie?: string; tri?: string; dispo?: string }>;

export default async function Produits({ searchParams }: { searchParams: SP }) {
  const { q, categorie, tri, dispo } = await searchParams;
  const where: Prisma.ProductWhereInput = { status: "PUBLISHED" };
  if (q) where.name = { contains: q.slice(0, 80), mode: "insensitive" };
  if (categorie) where.category = { slug: categorie };
  if (dispo === "1") where.stock = { gt: 0 };
  const orderBy: Prisma.ProductOrderByWithRelationInput =
    tri === "prix-asc" ? { priceCents: "asc" } : tri === "prix-desc" ? { priceCents: "desc" } : { createdAt: "desc" };

  const [products, categories] = await Promise.all([
    prisma.product.findMany({ where, orderBy, take: 60 }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <h1>Produits</h1>
      <form className="filters" role="search" method="get">
        <div><label htmlFor="q">Recherche</label><input id="q" name="q" defaultValue={q ?? ""} /></div>
        <div>
          <label htmlFor="categorie">Catégorie</label>
          <select id="categorie" name="categorie" defaultValue={categorie ?? ""}>
            <option value="">Toutes</option>
            {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="tri">Tri</label>
          <select id="tri" name="tri" defaultValue={tri ?? ""}>
            <option value="">Nouveautés</option>
            <option value="prix-asc">Prix croissant</option>
            <option value="prix-desc">Prix décroissant</option>
          </select>
        </div>
        <div><label htmlFor="dispo"><input id="dispo" type="checkbox" name="dispo" value="1" defaultChecked={dispo === "1"} /> En stock uniquement</label></div>
        <div style={{ alignSelf: "end" }}><button className="btn" type="submit">Filtrer</button></div>
      </form>
      {products.length === 0 ? <p className="muted">Aucun produit ne correspond.</p> : (
        <div className="grid">
          {products.map((p) => (
            <article key={p.id} className="card">
              <h2 style={{ fontSize: "1.05rem" }}><Link href={`/produits/${p.slug}`}>{p.name}</Link></h2>
              {p.isDemo && <span className="badge demo">Produit de démonstration</span>}
              <p><strong>{formatEur(p.priceCents)}</strong></p>
              <p className="muted">{p.stock && p.stock > 0 ? "Disponible" : "Indisponible"}</p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
