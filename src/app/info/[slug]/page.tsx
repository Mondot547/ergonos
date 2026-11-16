import { notFound } from "next/navigation";

// TEXTES PROVISOIRES — À FAIRE VÉRIFIER par un professionnel du droit avant tout lancement.
// Les champs entre crochets sont à compléter par l'exploitant. Rien ici n'est une promesse commerciale.
const PAGES: Record<string, { title: string; body: string[] }> = {
  contact: { title: "Contact", body: ["Adresse e-mail de contact : [À COMPLÉTER].", "Éditeur : [dénomination, forme juridique, adresse, SIRET, TVA — À COMPLÉTER]."] },
  livraison: { title: "Livraison", body: ["Zone de livraison : France.", "Frais et délais : [À DÉFINIR après confirmation des transporteurs et conditions fournisseur]. Aucun délai n'est garanti tant que cette section n'est pas complétée."] },
  retours: { title: "Retours et rétractation", body: ["Les conditions de retour et de rétractation applicables aux ventes à distance en France doivent être rédigées et vérifiées : [À COMPLÉTER].", "Adresse de retour, prise en charge des frais et délais : [À DÉFINIR]."] },
  confidentialite: { title: "Politique de confidentialité", body: ["Responsable de traitement : [À COMPLÉTER].", "Données traitées pour la commande : identité, e-mail, adresse de livraison. Paiement réalisé par Stripe : la boutique ne stocke aucun numéro de carte.", "Durées de conservation, destinataires, droits RGPD et contact : [À COMPLÉTER ET FAIRE VÉRIFIER]."] },
  cookies: { title: "Cookies", body: ["Ce site utilise uniquement des cookies strictement nécessaires : panier et, pour l'administration, session sécurisée.", "Aucun outil de mesure d'audience ni traceur publicitaire n'est installé. S'il en est ajouté, un bandeau de consentement conforme devra être mis en place au préalable."] },
  "conditions-de-vente": { title: "Conditions générales de vente", body: ["Modèle à rédiger : identité du vendeur, prix TTC, paiement, livraison, droit de rétractation, garanties légales, médiation de la consommation, droit applicable : [À COMPLÉTER ET FAIRE VÉRIFIER]."] },
};

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const p = PAGES[(await params).slug];
  return p ? { title: p.title } : {};
}

export default async function Info({ params }: { params: Promise<{ slug: string }> }) {
  const p = PAGES[(await params).slug];
  if (!p) notFound();
  return (
    <>
      <h1>{p.title}</h1>
      <p className="notice" role="note">Texte provisoire, à faire vérifier avant le lancement.</p>
      {p.body.map((t) => <p key={t}>{t}</p>)}
    </>
  );
}
