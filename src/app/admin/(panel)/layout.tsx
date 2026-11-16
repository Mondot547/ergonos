import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, destroySession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

async function logout() {
  "use server";
  await destroySession();
  redirect("/admin/login");
}

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const u = await getSessionUser();
  if (!u || (u.mfaEnabled && !u.mfaPassed)) redirect("/admin/login");
  return (
    <>
      <nav aria-label="Administration" style={{ display: "flex", gap: "1rem", flexWrap: "wrap", paddingBlock: ".8rem", borderBottom: "1px solid var(--line)" }}>
        <Link href="/admin">Tableau de bord</Link>
        <Link href="/admin/commandes">Commandes</Link>
        <Link href="/admin/produits">Produits</Link>
        {can(u.role, "supplier:view") && <Link href="/admin/fournisseur">Fournisseur</Link>}
        {can(u.role, "audit:view") && <Link href="/admin/audit">Journal</Link>}
        <Link href="/admin/securite">Sécurité</Link>
        <span style={{ marginLeft: "auto" }} className="muted">{u.email} ({u.role})</span>
        <form action={logout}><button className="btn secondary" type="submit">Déconnexion</button></form>
      </nav>
      {!u.mfaEnabled && <p className="notice">La double authentification n'est pas activée sur ce compte. <Link href="/admin/securite">L'activer</Link></p>}
      {children}
    </>
  );
}
