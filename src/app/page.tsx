import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: { where: { status: "PUBLISHED" } } } } },
  });
  return (
    <>
      <section style={{ paddingBlock: "2.5rem" }}>
        <h1>Aménagez un bureau à domicile plus confortable</h1>
        <p className="muted">Accessoires ergonomiques et pratiques, vendus en France.</p>
        <Link className="btn" href="/produits">Voir les produits</Link>
      </section>
      <section aria-labelledby="cats">
        <h2 id="cats">Catégories</h2>
        {categories.length === 0 ? (
          <p className="muted">Le catalogue est en cours de constitution.</p>
        ) : (
          <div className="grid">
            {categories.map((c) => (
              <Link key={c.id} href={`/produits?categorie=${c.slug}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>
                <strong>{c.name}</strong>
                <div className="muted">{c._count.products} produit(s)</div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
