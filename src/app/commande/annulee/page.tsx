import Link from "next/link";
export const metadata = { title: "Paiement annulé", robots: { index: false } };
export default function Annulee() {
  return (
    <>
      <h1>Paiement annulé</h1>
      <p>Aucun montant n'a été débité. Votre panier est conservé.</p>
      <Link className="btn" href="/panier">Retour au panier</Link>
    </>
  );
}
