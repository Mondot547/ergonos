import Link from "next/link";
export default function NotFound() {
  return (
    <>
      <h1>Page introuvable</h1>
      <p>La page demandée n'existe pas ou n'est plus disponible.</p>
      <Link className="btn" href="/">Retour à l'accueil</Link>
    </>
  );
}
