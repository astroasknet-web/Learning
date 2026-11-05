# Payments: architecture and implementation plan

This is the design of the unified payment system (`lib/pay`, `app/api/v1`, `/checkout`, `/billing`, `/console/payments`). It was written after reading the repository, not before.

## 1. What the repository already has

| Area | Finding |
|---|---|
| Stack | Next.js 15 (App Router), React 19, TypeScript, Tailwind, MySQL/MariaDB through `lib/portal/db.ts` (`all/one/val/run/tx`, `$1` placeholders), `zod` 4, vitest. Hosted on Hostinger as a standalone Node server. |
| Auth | Server-side sessions (`lib/portal/session.ts`), roles `student, employer, admin, counselor, teacher, parent`, staff two-step login, throttling in `auth_throttle`. |
| Payments today | Three separate Razorpay flows, each with its own tables: Resume Studio Pro (`studio_payments`, `lib/studio/pay.ts`), CRM verification fee (`crm_payments`, `lib/crm/verify-pay.ts`), expert bookings (`app/api/experts/book`). All INR, all Razorpay only. |
| Email | `lib/portal/mail.ts` (`mail_outbox` table, sent after the response, retried by `/api/cron/portal`). |
| Cron | `/api/cron/*` with `Authorization: Bearer $CRON_SECRET`. |
| Invoices | `lib/invoice` renders a PDF for expert bookings only. |
| Prices | Plan prices live in `lib/market/plans.ts` (display only; nothing is charged for them yet). Course prices do not exist (courses are free). |

### Issues found in the existing code (not changed by this work)
1. **`lib/payments/booking-amount.ts` has `TEST_MODE = true`**, so expert bookings charge a flat ₹1. It must be switched off before real sales. (A `TODO` in the file says so.)
2. The three Razorpay flows each re-implement signature checks and order tables; there is no shared ledger, refund handling or reconciliation.
3. Only Razorpay is wired; there is no way to take international cards.
4. Nothing records refunds or disputes anywhere.

## 2. Decisions

| Decision | Reason |
|---|---|
| New module `lib/pay/`, new tables prefixed `pay_`. Existing flows keep working untouched. | "Do not break existing functionality." Existing flows can move onto the new module one at a time. |
| Money is stored as **integer minor units** plus an explicit ISO currency code. | No floating point anywhere in money maths. |
| **Prices are explicit per currency** (`pay_prices`). There is no automatic conversion and no invented exchange rate. | Required by the brief: never silently change currency. Add a USD price in the admin screen to sell in USD. |
| Providers sit behind one interface (`lib/pay/providers/types.ts`). Implemented: **Razorpay** (INR, India methods) and **Stripe** (international). PayPal is *not* implemented; the registry is ready for it. | The brief says verify availability first; PayPal needs a merchant account and an approval for the business model. |
| Routing is rule-based and **fails closed**: a provider is only offered when it is configured and supports the country and currency. | "Never route to a provider that does not support the customer's country or currency." |
| The browser result is **never** proof of payment. The only things that move an order to *paid* are (a) a verified webhook, or (b) the confirm endpoint, which re-fetches the payment from the provider's API and checks amount, currency and order. | Brief sections 6, 7, 21. |
| "Subscriptions" (Pro / Silver / Gold) are sold as **time-limited one-time purchases** (a month or a year of access, no auto-renewal). Provider-managed recurring billing is *not* implemented. | Matches how Resume Studio Pro already works; avoids storing mandates and handling RBI e-mandate rules in the first release. Documented in the limitations list. |
| Fulfilment writes a row in `pay_entitlements`, unique per order item, **inside the same transaction** that marks the order paid. | Makes double fulfilment impossible. Side effects (course enrolment, Studio Pro grant) run in the same transaction. |
| Tax is a table of rules by country (basis points) with a per-price inclusive/exclusive flag. **No rule means no tax is charged.** Documents are titled **"Receipt"** unless `PAY_INVOICE_MODE=tax_invoice` and a seller tax ID are configured. | Do not label a document a tax invoice unless it meets the legal requirements. A finance advisor must confirm GST. |
| The audit log is **append-only and hash-chained** (each row stores the hash of the previous one). | Tamper-evident. |
| Staff permissions for payments live in `pay_staff` (`support`, `finance`, `admin`). Portal `admin` accounts are payment admins automatically. | The existing role list has no finance or support role. |
| Background work is cron-driven (`/api/cron/payments`), with attempt counters and a `dead` status instead of a message queue. | Hostinger has no queue service. The same functions are safe to call repeatedly. |

## 3. Payment lifecycle

```
Customer                 Our server                            Provider
   | pick product            |                                      |
   |------------------------>| POST /api/v1/orders                  |
   |                         | validate sku, price, currency, tax,  |
   |                         | coupon; recalc totals; INSERT order  |
   |                         | + order items (price snapshot)       |
   |                         | choose provider (country+currency)   |
   |                         | INSERT payment attempt (pending)     |
   |                         |------------------------------------->| create session / order
   |                         |<-------------------------------------| provider reference
   |<------------------------| checkout descriptor (redirect/modal) |
   | pay on hosted page      |                                      |
   |------------------------------------------------------------->| card/UPI/netbanking handled by provider
   |                         |<-------------------------------------| signed webhook (raw body)
   |                         | verify signature + timestamp         |
   |                         | INSERT webhook event (unique id)     |  duplicate? -> acknowledge, stop
   |                         | fetch payment from provider API      |
   |                         | check amount, currency, order, status|
   |                         | TX: payment -> succeeded             |
   |                         |     order -> paid -> fulfilled       |
   |                         |     entitlement rows, audit rows     |
   |                         | queue receipt email                  |
   |<------------------------| status page polls GET /orders/:id    |
```

If the customer closes the tab, the webhook still completes the order. If the webhook is late, the status page calls `POST /orders/:id/confirm`, which performs the same verified steps.

## 4. State machines

**Order:** `pending → paid → fulfilled`; `pending → failed | cancelled | expired`; `paid|fulfilled → partially_refunded → refunded`; `paid|fulfilled|partially_refunded → disputed → (previous state)`.
**Payment attempt:** `created → pending → succeeded | failed | cancelled | expired`; `succeeded → partially_refunded → refunded`; `succeeded → disputed`.
**Refund:** `requested → pending → succeeded | failed`.
Every transition goes through `lib/pay/state.ts`; an illegal transition throws and nothing is written. Out-of-order webhooks (for example `failed` after `succeeded`) are recorded and ignored.

## 5. Data model (`db/migrations/20261110000001_payments.sql`)

`pay_products`, `pay_prices` (unique product+currency), `pay_currencies`, `pay_tax_rules`, `pay_coupons`, `pay_coupon_redemptions` (unique coupon+order), `pay_orders`, `pay_order_items` (snapshot of title, unit price, tax), `pay_payments` (unique provider+provider payment reference), `pay_webhook_events` (unique provider+event id), `pay_refunds`, `pay_disputes`, `pay_invoices` (unique numbered series), `pay_entitlements` (unique per order item), `pay_audit_events` (hash chain), `pay_idempotency`, `pay_reconciliation_runs`, `pay_reconciliation_items`, `pay_staff`. Details and indexes are in the migration file comments and in `OPERATIONS.md`.

## 6. Security controls (summary; full list in `SECURITY-CHECKLIST.md`)
Server-side price recalculation; ownership checks on every read; opaque order access tokens (hashed in the database) for guest checkout; HMAC verification over the raw body (Razorpay `X-Razorpay-Signature`; Stripe `Stripe-Signature` via the official `constructEvent` with its five-minute tolerance); event de-duplication by provider event id; idempotency keys on order creation and refunds; per-IP and per-user rate limits; no card data ever reaches our servers (Razorpay Checkout and Stripe Checkout are provider-hosted); secrets only from environment variables; log redaction; CSV exports restricted by permission and audited.

## 7. Phases and status
See the "Status" section at the end of `README.md` in this folder; it is updated as each phase lands.
