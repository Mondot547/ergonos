import { cookies } from "next/headers";
import type { CartLine } from "./pricing.ts";

const COOKIE = "cart";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 jours — cookie strictement nécessaire, ne contient aucun prix

export async function readCart(): Promise<CartLine[]> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((l): l is CartLine => typeof l?.productId === "string" && Number.isInteger(l?.quantity) && l.quantity > 0)
      .slice(0, 20)
      .map((l) => ({ productId: l.productId, quantity: l.quantity }));
  } catch {
    return [];
  }
}

export async function writeCart(lines: CartLine[]) {
  (await cookies()).set(COOKIE, JSON.stringify(lines), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearCartCookie() {
  (await cookies()).delete(COOKIE);
}
