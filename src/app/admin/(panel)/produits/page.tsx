import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { formatEur } from "@/lib/money";

export const metadata = { title: "Produits (admin)" };
export const dynamic = "force-dynamic";

async function setStatus(formData: FormData) {
  "use server";
  const u = await requireUser("products:write");
  const id = String(formData.get("id"));
  const to = String(formData.get("to"));
  if (!["DRAFT", "PUBLISHED", "ARCHIVED"].includes(to)) return;
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) return;
  if (to === "PUBLISHED" && (p.priceCents <= 0 || !p.description.trim())) return; // vérification minimale avant publication
  await prisma.product.update({ where: { id }, data: { status: to as "DRAFT" | "PUBLISHED" | "ARCHIVED" } });
  await audit(u.id, `product.${to.toLowerCase()}`, id, { from: p.status });
  revalidatePath("/admin/produits");
}

export default async function Produits() {
  const u = await requireUser("products:view");
  const write = can(u.role, "products:write");
  const products = await prisma.product.findMany({ orderBy: { updatedAt: "desc" }, take: 200 });
  return (
    <>
      <h1>Produits</h1>
      {write && <p><Link className="btn" href="/admin/produits/nouveau">Créer un produit</Link></p>}
      <p className="muted">Les produits importés arrivent en brouillon et ne sont visibles qu'après publication par un administrateur.</p>
      <table>
        <thead><tr><th>Produit</th><th>Statut</th><th>Vente</th><th>Coût d'achat connu</th><th>Stock</th><th>Fournisseur</th><th>Dernière synchro</th>{write && <th>Actions</th>}</tr></thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td>{write ? <Link href={`/admin/produits/${p.id}`}>{p.name}</Link> : p.name}{p.isDemo && <> <span className="badge demo">démo</span></>}</td>
              <td>{p.status}</td>
              <td>{formatEur(p.priceCents)}</td>
              <td>{formatEur(p.supplierCostCents)}</td>
              <td>{p.stock ?? "inconnu"}</td>
              <td>{p.supplier ?? "—"}{p.supplierSku ? ` (${p.supplierSku})` : ""}</td>
              <td>{p.supplierSyncedAt ? p.supplierSyncedAt.toLocaleString("fr-FR") : "jamais"}</td>
              {write && (
                <td>
                  <form action={setStatus} style={{ display: "flex", gap: ".3rem", flexWrap: "wrap" }}>
                    <input type="hidden" name="id" value={p.id} />
                    {p.status !== "PUBLISHED" && <button className="btn" name="to" value="PUBLISHED" type="submit">Publier</button>}
                    {p.status === "PUBLISHED" && <button className="btn secondary" name="to" value="DRAFT" type="submit">Dépublier</button>}
                    {p.status !== "ARCHIVED" && <button className="btn secondary" name="to" value="ARCHIVED" type="submit">Archiver</button>}
                  </form>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
