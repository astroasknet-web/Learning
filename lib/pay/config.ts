/**
 * Payment configuration, read from the environment at call time (never at build time, never sent to the browser).
 * Every secret is optional: a provider without its keys is simply not offered.
 */
const env = (k: string): string => (process.env[k] ?? "").trim();
const list = (k: string, fallback: string): string[] => (env(k) || fallback).split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);

export type ProviderId = "razorpay" | "stripe";
export const PROVIDER_IDS: ProviderId[] = ["razorpay", "stripe"];

export const cfg = {
  razorpayKeyId: () => env("RAZORPAY_KEY_ID") || env("NEXT_PUBLIC_RAZORPAY_KEY_ID"),
  razorpaySecret: () => env("RAZORPAY_KEY_SECRET"),
  /** The webhook secret for the unified endpoint. The older Studio webhook keeps its own secret. */
  razorpayWebhookSecret: () => env("PAY_RAZORPAY_WEBHOOK_SECRET") || env("RAZORPAY_WEBHOOK_SECRET"),
  razorpayCurrencies: () => list("RAZORPAY_CURRENCIES", "INR"),
  razorpayCountries: () => list("RAZORPAY_COUNTRIES", "IN"),
  stripeSecret: () => env("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: () => env("STRIPE_WEBHOOK_SECRET"),
  stripeCurrencies: () => list("STRIPE_CURRENCIES", "USD,EUR,GBP,AED,AUD,CAD,SGD"),
  /** Countries we do not sell to (sanctions and provider restrictions). Review with your advisers. */
  blockedCountries: () => list("PAY_BLOCKED_COUNTRIES", "CU,IR,KP,SY"),
  enabledProviders: () => (env("PAY_ENABLED_PROVIDERS") ? list("PAY_ENABLED_PROVIDERS", "").map((s) => s.toLowerCase()) : PROVIDER_IDS),
  orderTtlMinutes: () => Math.max(35, Math.min(24 * 60, Number(env("PAY_ORDER_TTL_MINUTES")) || 60)), // Stripe Checkout sessions last at least 30 minutes
  defaultCurrency: () => (env("PAY_DEFAULT_CURRENCY") || "INR").toUpperCase(),
  /** Sent in the receipt and on the checkout page. */
  seller: () => ({
    name: env("PAY_SELLER_NAME") || "GrowQR",
    address: env("PAY_SELLER_ADDRESS"),
    taxId: env("PAY_SELLER_TAX_ID"),
    email: env("PAY_SUPPORT_EMAIL") || env("PORTAL_ADMIN_EMAIL"),
  }),
  /** "receipt" until finance has confirmed the tax-invoice rules for your business; then "tax_invoice" together with a seller tax id and address. */
  invoiceMode: (): "receipt" | "tax_invoice" => (env("PAY_INVOICE_MODE") === "tax_invoice" ? "tax_invoice" : "receipt"),
  alertEmail: () => env("PAY_ALERT_EMAIL") || env("PORTAL_ADMIN_EMAIL"),
  /** Reconciliation looks this many hours back. */
  reconcileHours: () => Math.max(1, Number(env("PAY_RECONCILE_HOURS")) || 48),
  webhookRetentionDays: () => Math.max(7, Number(env("PAY_WEBHOOK_RETENTION_DAYS")) || 90),
};

/** Whether the countries and currencies are on an ISO-looking shape. */
export const isCountry = (c: string): boolean => /^[A-Z]{2}$/.test(c);
