import Link from "next/link";
import { prisma } from "@/lib/db";
import { readCart } from "@/lib/cart";
import { priceCart } from "@/lib/pricing";
import { formatEur } from "@/lib/money";
import { startCheckout, updateCart } from "@/app/actions/shop";
import { shippingCentsFromEnv } from "@/lib/shipping";
import { isStripeTestMode } from "@/lib/stripe/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Panier", robots: { index: false } };

export default async function Panier({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams;
  const cart = await readCart();
  const products = await prisma.product.findMany({ where: { id: { in: cart.map((l) => l.productId) } } });
  const map = new Map(products.map((p) => [p.id, p]));
  const priced = priceCart(cart, map, shippingCentsFromEnv());

  return (
    <>
      <h1>Panier</h1>
      {erreur && <p className="notice" role="alert">{erreur}</p>}
      {cart.length === 0 ? (
        <p>Votre panier est vide. <Link href="/produits">Voir les produits</Link></p>
      ) : (
        <>
          <table>
            <caption className="visually-hidden">Contenu du panier</caption>
            <thead><tr><th>Article</th><th>Quantité</th><th>Prix unitaire</th></tr></thead>
            <tbody>
              {cart.map((l) => {
                const p = map.get(l.productId);
                return (
                  <tr key={l.productId}>
                    <td>{p?.name ?? "Article indisponible"}</td>
                    <td>
                      <form action={updateCart} style={{ display: "flex", gap: ".4rem" }}>
                        <input type="hidden" name="productId" value={l.productId} />
                        <input aria-label="Quantité" type="number" name="quantity" min={0} max={10} defaultValue={l.quantity} style={{ width: "4.5rem" }} />
                        <button className="btn secondary" type="submit">Mettre à jour</button>
                      </form>
                    </td>
                    <td>{p ? formatEur(p.priceCents) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {priced.ok ? (
            <>
              <p>Sous-total : {formatEur(priced.subtotalCents)}<br />Livraison : {priced.shippingCents === 0 ? "voir page Livraison" : formatEur(priced.shippingCents)}<br /><strong>Total : {formatEur(priced.totalCents)}</strong></p>
              {isStripeTestMode() && <p className="notice">Mode test : aucun paiement réel n'est effectué.</p>}
              <form action={startCheckout}><button className="btn" type="submit">Payer</button></form>
            </>
          ) : (
            <p className="notice" role="alert">{priced.errors[0]}</p>
          )}
        </>
      )}
    </>
  );
}
