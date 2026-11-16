import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { formatEur } from "@/lib/money";
import { addToCart } from "@/app/actions/shop";

export const dynamic = "force-dynamic";
type P = Promise<{ slug: string }>;

async function load(slug: string) {
  const p = await prisma.product.findUnique({ where: { slug } });
  return p && p.status === "PUBLISHED" ? p : null;
}

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const p = await load((await params).slug);
  return p ? { title: p.name, description: p.description.slice(0, 155) || undefined } : {};
}

export default async function Fiche({ params }: { params: P }) {
  const p = await load((await params).slug);
  if (!p) notFound();
  const inStock = p.stock !== null && p.stock > 0;
  return (
    <article>
      <h1>{p.name}</h1>
      {p.isDemo && <p className="notice">Produit de démonstration : données fictives, non destiné à la vente.</p>}
      {p.images.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src} src={src} alt={`${p.name} — photo ${i + 1}`} width={480} style={{ maxWidth: "100%", height: "auto" }} />
      ))}
      <p style={{ fontSize: "1.6rem" }}><strong>{formatEur(p.priceCents)}</strong> <span className="tag">TTC</span></p>
      <p>{p.description || <span className="muted">Description à venir.</span>}</p>
      <p>{inStock ? "Disponible" : "Indisponible actuellement"}</p>
      <p className="muted">Informations de livraison : voir la page <a href="/info/livraison">Livraison</a>. Aucun délai n'est garanti tant qu'il n'a pas été confirmé.</p>
      <form action={addToCart}>
        <input type="hidden" name="productId" value={p.id} />
        <button className="btn" type="submit" disabled={!inStock}>Ajouter au panier</button>
      </form>
    </article>
  );
}
