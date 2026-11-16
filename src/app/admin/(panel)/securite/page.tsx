import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { generateSecret, otpauthUri, verifyTotp } from "@/lib/auth/totp";

export const metadata = { title: "Sécurité du compte" };
export const dynamic = "force-dynamic";

async function startMfa() {
  "use server";
  const u = await requireUser("dashboard:view");
  await prisma.user.update({ where: { id: u.id }, data: { mfaSecret: generateSecret(), mfaEnabled: false } });
  redirect("/admin/securite");
}

async function confirmMfa(formData: FormData) {
  "use server";
  const u = await requireUser("dashboard:view");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
  if (!user.mfaSecret) redirect("/admin/securite");
  const step = verifyTotp(user.mfaSecret, String(formData.get("code") ?? "").replace(/\s/g, ""), Date.now(), null);
  if (step === null) redirect("/admin/securite?erreur=1");
  await prisma.user.update({ where: { id: u.id }, data: { mfaEnabled: true, mfaLastStep: step } });
  await audit(u.id, "auth.mfa_enabled");
  redirect("/admin/securite?ok=1");
}

export default async function Securite({ searchParams }: { searchParams: Promise<{ erreur?: string; ok?: string }> }) {
  const u = await requireUser("dashboard:view");
  const sp = await searchParams;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
  return (
    <>
      <h1>Sécurité du compte</h1>
      {sp.ok && <p className="notice">Double authentification activée.</p>}
      {sp.erreur && <p className="notice" role="alert">Code invalide.</p>}
      {user.mfaEnabled ? <p>Double authentification : <strong>activée</strong>.</p> : user.mfaSecret ? (
        <div className="card" style={{ maxWidth: 560 }}>
          <p>Ajoutez ce compte dans votre application d'authentification (saisie manuelle) :</p>
          <p><code>{user.mfaSecret}</code></p>
          <p className="muted">URI : <code style={{ wordBreak: "break-all" }}>{otpauthUri(user.mfaSecret, user.email, "Boutique Bureau")}</code></p>
          <form action={confirmMfa}>
            <label htmlFor="code">Code à 6 chiffres</label>
            <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required />{" "}
            <button className="btn" type="submit">Confirmer et activer</button>
          </form>
        </div>
      ) : (
        <form action={startMfa}><button className="btn" type="submit">Configurer la double authentification</button></form>
      )}
    </>
  );
}
