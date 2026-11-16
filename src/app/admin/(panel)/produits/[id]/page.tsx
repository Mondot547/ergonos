import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { eurosToCents, slugify } from "@/lib/parse";

export const metadata = { title: "Éditer un produit" };
export const dynamic = "force-dynamic";

async function save(formData: FormData) {
  "use server";
  const u = await requireUser("products:write");
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 160);
  const description = String(formData.get("description") ?? "").slice(0, 5000);
  const price = eurosToCents(String(formData.get("price") ?? ""));
  const costRaw = String(formData.get("cost") ?? "").trim();
  const cost = costRaw === "" ? null : eurosToCents(costRaw);
  const stockRaw = String(formData.get("stock") ?? "").trim();
  const stock = stockRaw === "" ? null : Number(stockRaw);
  const images = String(formData.get("images") ?? "").split("\n").map((s) => s.trim()).filter((s) => /^https:\/\//.test(s)).slice(0, 10);

  const invalid = !name || price === null || (costRaw !== "" && cost === null) || (stock !== null && (!Number.isInteger(stock) || stock < 0));
  if (invalid) redirect(`/admin/produits/${id || "nouveau"}?erreur=1`);

  const data = { name, description, priceCents: price!, supplierCostCents: cost, stock, images };
  if (id) {
    await prisma.product.update({ where: { id }, data });
    await audit(u.id, "product.updated", id, { fields: Object.keys(data) });
  } else {
    const base = slugify(name) || "produit";
    const slug = (await prisma.product.findUnique({ where: { slug: base } })) ? `${base}-${Date.now().toString(36)}` : base;
    const p = await prisma.product.create({ data: { ...data, slug, status: "DRAFT", supplier: "MANUAL" } });
    await audit(u.id, "product.created", p.id);
  }
  redirect("/admin/produits");
}

export default async function Edit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erreur?: string }> }) {
  await requireUser("products:write");
  const { id } = await params;
  const { erreur } = await searchParams;
  const p = id === "nouveau" ? null : await prisma.product.findUnique({ where: { id } });
  if (id !== "nouveau" && !p) notFound();
  return (
    <>
      <h1>{p ? "Modifier le produit" : "Nouveau produit"}</h1>
      {erreur && <p className="notice" role="alert">Champs invalides : vérifiez nom, prix (ex. 19,90), coût et stock.</p>}
      <form action={save} className="card" style={{ maxWidth: 640 }}>
        <input type="hidden" name="id" value={p?.id ?? ""} />
        <p><label htmlFor="name">Nom</label><input id="name" name="name" required defaultValue={p?.name} style={{ width: "100%" }} /></p>
        <p><label htmlFor="description">Description (uniquement des informations confirmées)</label><textarea id="description" name="description" rows={5} defaultValue={p?.description} style={{ width: "100%" }} /></p>
        <p><label htmlFor="price">Prix de vente TTC (€)</label><input id="price" name="price" required inputMode="decimal" defaultValue={p ? (p.priceCents / 100).toFixed(2).replace(".", ",") : ""} /></p>
        <p><label htmlFor="cost">Coût d'achat connu (€) — laisser vide si inconnu</label><input id="cost" name="cost" inputMode="decimal" defaultValue={p?.supplierCostCents != null ? (p.supplierCostCents / 100).toFixed(2).replace(".", ",") : ""} /></p>
        <p><label htmlFor="stock">Stock — laisser vide si inconnu (non achetable)</label><input id="stock" name="stock" inputMode="numeric" defaultValue={p?.stock ?? ""} /></p>
        <p><label htmlFor="images">URLs d'images (https, une par ligne)</label><textarea id="images" name="images" rows={3} defaultValue={p?.images.join("\n")} style={{ width: "100%" }} /></p>
        <button className="btn" type="submit">Enregistrer en brouillon</button>
      </form>
    </>
  );
}
