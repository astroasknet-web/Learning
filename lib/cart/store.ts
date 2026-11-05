"use client";

import { useEffect, useState } from "react";

/**
 * The shopping cart: a list of product codes kept in this browser (localStorage). It holds no prices and no quantities (each item is bought once),
 * so it cannot be used to change what is charged. It works the same for visitors and signed-in people, and the same code runs in every tab.
 */
const KEY = "growqr_cart_v1";
export const CART_MAX = 10;
const EVENT = "growqr-cart-change";
const SKU = /^[a-z0-9][a-z0-9_.-]{0,79}$/i;

export function readCart(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? [...new Set(raw.filter((s): s is string => typeof s === "string" && SKU.test(s)))].slice(0, CART_MAX) : [];
  } catch {
    return [];
  }
}

function write(list: string[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, CART_MAX))); } catch { /* storage may be blocked; the cart then lasts only for this page */ }
  window.dispatchEvent(new Event(EVENT));
}

/** Returns false when the cart is full. */
export function addToCart(sku: string): boolean {
  const l = readCart();
  if (l.includes(sku)) return true;
  if (l.length >= CART_MAX) return false;
  write([...l, sku]);
  return true;
}
export const removeFromCart = (sku: string): void => write(readCart().filter((s) => s !== sku));
export const removeMany = (skus: string[]): void => write(readCart().filter((s) => !skus.includes(s)));
export const clearCart = (): void => write([]);

/** The cart as React state; updates when the cart changes here or in another tab. */
export function useCart(): { skus: string[]; ready: boolean } {
  const [skus, setSkus] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => { setSkus(readCart()); setReady(true); };
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return { skus, ready };
}

/** Whether online payment is switched on (so the cart is worth showing). Asked once per page load. */
let enabled: Promise<boolean> | null = null;
export function usePaymentsOn(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    enabled ??= fetch("/api/v1/payments/config").then((r) => r.json()).then((j) => !!j?.data?.enabled).catch(() => false);
    void enabled.then((v) => { if (live) setOn(v); });
    return () => { live = false; };
  }, []);
  return on;
}
