// Rôles et permissions de l'espace admin (principe du moindre privilège).
export type Role = "OWNER" | "ORDERS" | "CATALOG" | "VIEWER";
export type Permission =
  | "dashboard:view"
  | "orders:view"
  | "orders:pii" // données personnelles client (email, adresse)
  | "orders:manage"
  | "products:view"
  | "products:write"
  | "audit:view"
  | "supplier:view"
  | "users:manage";

const MATRIX: Record<Role, Permission[]> = {
  OWNER: ["dashboard:view", "orders:view", "orders:pii", "orders:manage", "products:view", "products:write", "audit:view", "supplier:view", "users:manage"],
  ORDERS: ["dashboard:view", "orders:view", "orders:pii", "orders:manage", "products:view"],
  CATALOG: ["dashboard:view", "orders:view", "products:view", "products:write", "supplier:view"],
  VIEWER: ["dashboard:view", "orders:view", "products:view"],
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role]?.includes(permission) ?? false;
}

// Politique de verrouillage après échecs de connexion.
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

export function lockoutAfterFailure(failedLogins: number, now: Date): { failedLogins: number; lockedUntil: Date | null } {
  const next = failedLogins + 1;
  return {
    failedLogins: next,
    lockedUntil: next >= MAX_FAILED_LOGINS ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : null,
  };
}

export function isLocked(lockedUntil: Date | null, now: Date): boolean {
  return lockedUntil !== null && lockedUntil > now;
}
