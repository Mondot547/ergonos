"use client";
import { useEffect } from "react";
import { clearCart } from "@/app/actions/shop";

export function ClearCart() {
  useEffect(() => { void clearCart(); }, []);
  return null;
}
