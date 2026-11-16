import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { formatEur } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Détail commande" };

export default async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser("orders:view");
  const o = await prisma.order.findUnique({ where: { id: (await params).id }, include: { items: true } });
  if (!o) notFound();
  const pii = can(u.role, "orders:pii");
  if (pii) await audit(u.id, "order.pii_viewed", o.id); // la consultation de données personnelles est tracée
  const addr = (o.shipAddress ?? {}) as Record<string, string | null>;

  return (
    <>
      <h1>Commande #{o.number} {o.isDemo && <span className="badge demo">démo</span>}</h1>
      {o.status === "NEEDS_REVIEW" && <p className="notice" role="alert">À vérifier : {o.reviewReason}</p>}
      <p>Statut : <strong>{o.status}</strong> · Créée le {o.createdAt.toLocaleString("fr-FR")}</p>
      <h2>Articles</h2>
      <table>
        <thead><tr><th>Article</th><th>Qté</th><th>Prix unitaire</th><th>Coût d'achat connu</th></tr></thead>
        <tbody>{o.items.map((i) => <tr key={i.id}><td>{i.nameSnapshot}</td><td>{i.quantity}</td><td>{formatEur(i.unitPriceCents)}</td><td>{formatEur(i.supplierCostCentsSnapshot)}</td></tr>)}</tbody>
      </table>
      <p>Encaissé : {formatEur(o.grossCents)} (dont livraison {formatEur(o.shippingCents)}) · Remboursé : {formatEur(o.refundedCents)} · Frais de paiement : {formatEur(o.feeCents)}</p>
      <h2>Destination</h2>
      <p>Pays : {o.shipCountry ?? "—"}</p>
      {pii ? (
        <>
          <p>Client : {o.customerName ?? "—"} — {o.customerEmail ?? "—"}</p>
          <p>Adresse : {[addr.line1, addr.line2, addr.postal_code, addr.city].filter(Boolean).join(", ") || "—"}</p>
        </>
      ) : <p className="muted">Les données personnelles ne sont pas visibles avec votre rôle.</p>}
      <h2>Fournisseur</h2>
      <p className="muted">Aucune commande n'est transmise au fournisseur automatiquement. L'envoi d'une commande fournisseur n'est pas implémenté (voir docs/BIGBUY.md).</p>
      <p className="muted">Stripe : session {o.stripeSessionId}</p>
    </>
  );
}
