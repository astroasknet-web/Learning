# Payments: security design and checklist

## What is protected, and how

| Risk | Control |
|---|---|
| Card data exposure | Hosted checkout only. Razorpay's secure window and Stripe Checkout take card/UPI/bank details. Our servers, logs and database never see them. This lowers our PCI scope (SAQ A style); **it is not a PCI certification and we do not claim one.** |
| Tampered prices | The client sends SKU, quantity, country, coupon. Totals, tax and discounts are computed on the server from `pay_prices`; any amount in a request is ignored (tested). Each order stores a price snapshot. |
| Fake "payment done" | The browser result is never trusted. An order becomes *paid* only from a signed webhook or from the server fetching the payment from the provider and matching order, amount and currency. |
| Forged webhooks | Razorpay HMAC-SHA256 and Stripe signature (with timestamp tolerance) over the exact raw body, constant-time compare. Unsigned or bad requests change nothing and store nothing. |
| Replayed webhooks / duplicate delivery | Unique `(provider, event id)`; repeats return 200 and do nothing. Entitlements are unique per order item, written in the same transaction as the paid state. |
| Double clicks / retries / races | `Idempotency-Key` on order creation and refunds; row locks on the order during settlement and refunds; deadlock retry. Tested with concurrent webhook + confirm + cron. |
| Access to other people's orders | Every order read checks ownership (session user, or the guest's one-time token compared by hash). Other people's ids return 404, so ids cannot be probed (tested). |
| Cross-site request forgery | State-changing calls require a same-origin `Origin` (or `Sec-Fetch-Site`). Webhooks are exempt and use signatures. |
| Privilege abuse in the console | Role permissions per endpoint and per page (support / finance / admin), two-step login for staff, no one can change their own role, refunds need an explicit confirmation and an idempotency key, every action is audited. |
| Tampering with history | Append-only, hash-chained audit log with a verify function. |
| CSV/formula injection | Export cells starting with `= + - @` are neutralised (tested). |
| Information leaks | Errors return a code and a safe message, never SQL, stack traces or provider messages. Provider keys and webhook secrets are read from the environment and never returned, logged or stored. Secrets/PII are redacted from audit details and stored webhook payloads. |
| Abuse | Rate limits on order creation, confirmation and (existing) auth. Sanctioned countries blocked by default (`PAY_BLOCKED_COUNTRIES`). |
| Receipt pages | `noindex`, served with a strict Content-Security-Policy, all values HTML-escaped. |
| Clickjacking / XSS | Site CSP allows only the Razorpay and Stripe hosts needed for checkout (`next.config.ts`). |

## Checklist before going live

- [ ] Keys are only in Hostinger environment variables. None are in git (`git log -p | grep -i secret` is empty).
- [ ] Test and live keys are not mixed. Live webhooks use the live secrets.
- [ ] HTTPS only (HSTS) on the production domain.
- [ ] Every staff account has two-step login on. The list of payment staff is reviewed (console > Payments > Prices, coupons and staff).
- [ ] Database backups run and a restore was tested.
- [ ] `CRON_SECRET` is long and random.
- [ ] Alert email is monitored by a person.
- [ ] Audit chain verifies as intact.
- [ ] Expert-booking `TEST_MODE` is off (`lib/payments/booking-amount.ts`).
- [ ] Privacy policy states what payment data you keep (name, email, billing address, tax id, order history) and which processors receive it.
- [ ] You have read `LIMITATIONS.md`.

## Reporting a problem

If you suspect a key leaked: rotate it in the provider dashboard first, update Hostinger, restart the app, then check the audit log and reconciliation for the exposure window.
