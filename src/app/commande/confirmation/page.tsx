import Link from "next/link";
import { ClearCart } from "./clear-cart";

export const metadata = { title: "Commande reçue", robots: { index: false } };

// Cette page ne prouve rien : seule la réception du webhook Stripe signé crée la commande.
export default function Confirmation() {
  return (
    <>
      <ClearCart />
      <h1>Merci pour votre commande</h1>
      <p>Votre paiement a été transmis. Votre commande est en cours d'enregistrement.</p>
      <p className="muted">Aucune information de livraison n'est promise ici tant qu'elle n'a pas été confirmée. Pour toute question, voir la page <Link href="/info/contact">Contact</Link>.</p>
      <Link className="btn" href="/produits">Continuer mes achats</Link>
    </>
  );
}
