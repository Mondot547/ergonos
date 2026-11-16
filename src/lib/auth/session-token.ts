// Jetons de session : aléatoires, seul leur hash SHA-256 est stocké en base.
import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "admin_session";
export const SESSION_IDLE_MS = 2 * 60 * 60 * 1000; // 2 h d'inactivité
export const SESSION_MAX_MS = 8 * 60 * 60 * 1000; // 8 h au total

export function newSessionToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isSessionValid(s: { createdAt: Date; lastSeenAt: Date }, now: Date): boolean {
  return now.getTime() - s.lastSeenAt.getTime() < SESSION_IDLE_MS && now.getTime() - s.createdAt.getTime() < SESSION_MAX_MS;
}
