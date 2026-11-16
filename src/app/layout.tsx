import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

const site = process.env.SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "Ergonos — accessoires pour bureau à domicile", template: "%s | Ergonos" },
  description: "Accessoires ergonomiques et pratiques pour aménager votre bureau à domicile.",
  openGraph: { type: "website", locale: "fr_FR", siteName: "Ergonos" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <a href="#contenu" className="visually-hidden">Aller au contenu</a>
        <header className="site">
          <div className="container">
            <Link href="/" style={{ fontWeight: 700, textDecoration: "none" }}>Ergonos</Link>
            <nav aria-label="Navigation principale">
              <Link href="/produits">Produits</Link>
              <Link href="/panier">Panier</Link>
              <Link href="/info/contact">Contact</Link>
            </nav>
          </div>
        </header>
        <main id="contenu" className="container">{children}</main>
        <footer className="site">
          <div className="container">
            <nav aria-label="Informations légales">
              <Link href="/info/livraison">Livraison</Link>
              <Link href="/info/retours">Retours</Link>
              <Link href="/info/conditions-de-vente">Conditions de vente</Link>
              <Link href="/info/confidentialite">Confidentialité</Link>
              <Link href="/info/cookies">Cookies</Link>
            </nav>
            <p>Ce site n'utilise aucun traceur publicitaire ni outil de mesure d'audience.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
