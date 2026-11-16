// Sessions admin en base. Chaque page et chaque action serveur admin appelle requireUser() :
// la protection ne repose pas uniquement sur un middleware.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "../db.ts";
import { can, type Permission, type Role } from "./permissions.ts";
import { SESSION_COOKIE, SESSION_MAX_MS, hashToken, isSessionValid, newSessionToken } from "./session-token.ts";

export async function createSession(userId: string, mfaPassed: boolean) {
  const { token, hash } = newSessionToken();
  await prisma.session.create({ data: { tokenHash: hash, userId, mfaPassed } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_MS / 1000,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

export async function getSessionUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!s) return null;
  const now = new Date();
  if (!isSessionValid(s, now)) {
    await prisma.session.delete({ where: { id: s.id } }).catch(() => {});
    return null;
  }
  await prisma.session.update({ where: { id: s.id }, data: { lastSeenAt: now } });
  return { id: s.user.id, email: s.user.email, role: s.user.role as Role, mfaPassed: s.mfaPassed, mfaEnabled: s.user.mfaEnabled };
}

/** Exige une session valide, un MFA passé si activé, et la permission demandée. */
export async function requireUser(permission: Permission) {
  const u = await getSessionUser();
  if (!u) redirect("/admin/login");
  if (u.mfaEnabled && !u.mfaPassed) redirect("/admin/login");
  if (!can(u.role, permission)) redirect("/admin?refus=1");
  return u;
}
