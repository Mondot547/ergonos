import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { bigBuyConfigFromEnv, bigBuyStatus } from "@/lib/bigbuy/client";

export const metadata = { title: "Fournisseur" };
export const dynamic = "force-dynamic";

export default async function Fournisseur() {
  await requireUser("supplier:view");
  const cfg = bigBuyConfigFromEnv(process.env);
  const status = bigBuyStatus(cfg);
  const syncs = await prisma.supplierSync.findMany({ orderBy: { startedAt: "desc" }, take: 20 });
  const canSync = status.state === "ready" && cfg.fieldMappingVerified;
  return (
    <>
      <h1>Fournisseur — BigBuy</h1>
      <p className={status.state === "ready" ? "" : "notice"}>
        {status.state === "ready" ? "Intégration activée (clé présente)." : `Intégration désactivée : ${status.reason}`}
      </p>
      <p>Import / synchronisation : {canSync ? "autorisés" : <strong>indisponibles</strong>}.
        {!canSync && " Ils exigent BIGBUY_ENABLED, une clé API et BIGBUY_FIELD_MAPPING_VERIFIED=true après vérification des champs contre la documentation officielle (voir docs/BIGBUY.md)."}</p>
      <p className="muted">L'envoi de commandes au fournisseur n'est pas implémenté dans cette version.</p>
      <h2>Dernières synchronisations</h2>
      {syncs.length === 0 ? <p>Aucune synchronisation enregistrée.</p> : (
        <table>
          <thead><tr><th>Début</th><th>Statut</th><th>Éléments</th><th>Message / erreur</th></tr></thead>
          <tbody>{syncs.map((s) => <tr key={s.id}><td>{s.startedAt.toLocaleString("fr-FR")}</td><td>{s.status}</td><td>{s.itemsCount}</td><td>{s.message ?? "—"}</td></tr>)}</tbody>
        </table>
      )}
    </>
  );
}
