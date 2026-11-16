import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Journal d'activité" };
export const dynamic = "force-dynamic";

export default async function Audit() {
  await requireUser("audit:view");
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { actor: { select: { email: true } } } });
  return (
    <>
      <h1>Journal d'activité</h1>
      <table>
        <thead><tr><th>Date</th><th>Acteur</th><th>Action</th><th>Objet</th></tr></thead>
        <tbody>{logs.map((l) => <tr key={l.id}><td>{l.createdAt.toLocaleString("fr-FR")}</td><td>{l.actor?.email ?? "système"}</td><td>{l.action}</td><td>{l.entityId ?? "—"}</td></tr>)}</tbody>
      </table>
    </>
  );
}
