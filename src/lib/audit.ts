import { prisma } from "./db.ts";

/** Journal des opérations sensibles. Ne jamais y mettre de secret ni de donnée de carte. */
export async function audit(actorId: string | null, action: string, entityId?: string, meta?: Record<string, unknown>) {
  await prisma.auditLog.create({ data: { actorId, action, entityId, meta: (meta ?? {}) as object } });
}
