import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { verifyTotp } from "@/lib/auth/totp";
import { isLocked, lockoutAfterFailure } from "@/lib/auth/permissions";
import { createSession, getSessionUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export const metadata = { title: "Connexion administration", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Hash factice pour égaliser le temps de réponse quand l'e-mail n'existe pas.
const DUMMY_HASH = "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==";

async function login(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const password = String(formData.get("password") ?? "").slice(0, 200);
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  const fail = () => redirect("/admin/login?erreur=1"); // message volontairement générique

  const user = await prisma.user.findUnique({ where: { email } });
  const now = new Date();
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH).catch(() => false);

  if (!user || isLocked(user.lockedUntil, now)) {
    await audit(user?.id ?? null, "auth.login_refused", undefined, { reason: user ? "locked" : "unknown" });
    return fail();
  }

  let mfaOk = true;
  let step: number | null = null;
  if (user.mfaEnabled && user.mfaSecret) {
    step = verifyTotp(user.mfaSecret, code, Date.now(), user.mfaLastStep);
    mfaOk = step !== null;
  }

  if (!passwordOk || !mfaOk) {
    const next = lockoutAfterFailure(user.failedLogins, now);
    await prisma.user.update({ where: { id: user.id }, data: next });
    await audit(user.id, "auth.login_failed", undefined, { failedLogins: next.failedLogins });
    return fail();
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null, ...(step !== null ? { mfaLastStep: step } : {}) },
  });
  await createSession(user.id, true);
  await audit(user.id, "auth.login_ok");
  redirect("/admin");
}

export default async function Login({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  if (await getSessionUser()) redirect("/admin");
  const { erreur } = await searchParams;
  return (
    <div style={{ maxWidth: 380, margin: "3rem auto" }}>
      <h1>Administration</h1>
      {erreur && <p className="notice" role="alert">Identifiants ou code invalides, ou compte temporairement verrouillé.</p>}
      <form action={login} className="card" autoComplete="on">
        <p><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" required autoComplete="username" style={{ width: "100%" }} /></p>
        <p><label htmlFor="password">Mot de passe</label><input id="password" name="password" type="password" required autoComplete="current-password" style={{ width: "100%" }} /></p>
        <p><label htmlFor="code">Code à 6 chiffres (si la double authentification est activée)</label><input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" style={{ width: "100%" }} /></p>
        <button className="btn" type="submit">Se connecter</button>
      </form>
    </div>
  );
}
