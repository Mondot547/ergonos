import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { formatEur } from "@/lib/money";

export const metadata = { title: "Commandes" };
export const dynamic = "force-dynamic";

export default async function Commandes() {
  const u = await requireUser("orders:view");
  const pii = can(u.role, "orders:pii");
  const orders = await prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { items: true } });
  return (
    <>
      <h1>Commandes</h1>
      <table>
        <thead><tr><th>N°</th><th>Date</th><th>Statut</th><th>Articles</th><th>Total</th><th>Pays</th>{pii && <th>Client</th>}<th></th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>#{o.number}</td>
              <td>{o.createdAt.toLocaleString("fr-FR")}</td>
              <td>{o.status}{o.isDemo && <> <span className="badge demo">démo</span></>}</td>
              <td>{o.items.reduce((s, i) => s + i.quantity, 0)}</td>
              <td>{formatEur(o.grossCents)}</td>
              <td>{o.shipCountry ?? "—"}</td>
              {pii && <td>{o.customerName ?? "—"}</td>}
              <td><Link href={`/admin/commandes/${o.id}`}>Détail</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && <p>Aucune commande.</p>}
    </>
  );
}
