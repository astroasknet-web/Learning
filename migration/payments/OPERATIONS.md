# Payments: operations runbook and troubleshooting

Console: **Admin > Payments** (`/console/payments`). API: `migration/payments/openapi.yaml`.

## Daily

1. Open Payments. If the yellow alert box is showing, read it first. Alerts appear for: a low success rate, webhooks stuck or failed, stale pending payments, an unreviewed reconciliation difference, and open disputes.
2. Check "Webhooks waiting" is 0. If not, go to *Webhooks, reconciliation, audit* and retry the failed events (the cron also retries them automatically, with growing delays, and marks an event `dead` after the last try).
3. Review reconciliation items, mark each as reviewed once someone has looked at the provider dashboard.

## Refunds

* Open the order, scroll to **Refunds**. Leave the amount empty for everything that is left, or type an amount in the order's currency (for example `150` or `12.50`). Give a reason. Tick the box. Press Refund.
* The refund is saved first, then sent to the provider. It shows **pending** until the provider confirms (webhook, or the cron checks). Only then does the order show *refunded* or *partly refunded*, and only then is the customer's access removed (when the whole order is refunded).
* If it says the provider did not accept the refund, nothing was refunded. Read the reason, fix it (for example the payment is too old for a card refund, or the provider balance is too low) and try again.
* You cannot refund more than was paid. Refunds are for confirmed payments only.
* Money moved by hand in a provider dashboard (not through this console) is picked up through the refund webhook and shows in reconciliation.

## Disputes (chargebacks)

* A dispute marks the order *disputed* and is listed on the order. **Submit the evidence in the provider dashboard**; the console only tracks status and the response deadline. When the dispute closes the order returns to its earlier state, or to *refunded* if you lost.

## Stuck or odd payments

| Symptom | What it means | What to do |
|---|---|---|
| Customer says "I paid, nothing happened" | Webhook late or lost | Open the order. If a payment attempt shows `pending`, press the **Retry** next to its webhook, or ask the customer to open the order page (it re-checks with the provider). The cron fixes it within minutes anyway. |
| Order `pending`, payment attempt `failed` | Bank declined | Customer can retry from the same checkout page. The order stays open until its time limit. |
| Order `expired` but the customer paid late | Payment arrived after the time limit | The payment is still accepted and fulfilled (late payments are never ignored). Check the timeline for `order.paid` with `late: true`. |
| Webhook `dead` | 8 tries failed | Read `last error`, fix the cause, press **Retry**. |
| Webhook rejected (bad signature) | Wrong secret, or someone is probing | Compare the secret in the provider dashboard and the Hostinger variable. Rejected requests change nothing. |
| Reconciliation: `missing_internal` | Provider has a payment we have no record of | Look it up in the provider dashboard by id; usually a payment started outside our checkout. Refund or record it manually. |
| Reconciliation: `missing_provider` / `status_mismatch` / `amount_mismatch` | Our record and the provider disagree | Treat as urgent. The provider is the source of truth for money. Do not edit the database by hand; ask for a code fix. |
| `stale_pending` | Pending for a long time | Usually an abandoned checkout. It closes itself at the order time limit. |
| Customer was charged twice | Two separate orders, each paid | Refund one from the console. The system prevents duplicate *fulfilment* for one order, not two intentional orders. |
| Receipt email did not arrive | Mail queue or spam | Check `mail_outbox`; the customer can always open the receipt from **Billing**. |

## Prices, currencies, tax, coupons

* Everything is in *Prices, coupons and staff*. All changes apply to **new** orders only and are written to the audit log with the old value.
* There is no automatic currency conversion. To sell in USD, add a USD price to each product.
* Tax rules: only on advice. A rate of 18 is entered as `18`. "Tax included" prices already contain tax; otherwise it is added at checkout.

## Reports and exports

* The overview lists revenue per currency (gross, refunded, net, tax). Currencies are never added together.
* **Download CSV** exports the current search (up to 5,000 rows). It is logged. Open it in a spreadsheet; cells that begin with `=`, `+`, `-` or `@` are prefixed with `'` so they cannot run as formulas.

## Audit log

Every state change (order, payment, refund, dispute, price, staff role, export) is a row in an append-only, hash-chained log. **Verify the chain** recomputes every hash; "intact" means no row was edited or removed. A broken chain means someone changed the database directly. Treat it as a security incident.

## Backups and retention

* Back up the MySQL database daily (hPanel). Payment rows are never deleted by the application.
* Raw webhook bodies are not stored (only a reduced, secret-free copy); stored events older than `PAY_WEBHOOK_RETENTION_DAYS` (default 90) are purged by the cron.
* Keep financial records for the period the law in your country requires (often 6 to 8 years). Ask your accountant.

## Monitoring

* Uptime monitor on `GET /api/v1/payments/health` (503 when the database is down or no provider is configured).
* Alerts go to `PAY_ALERT_EMAIL` at most once every six hours per condition.
* Application logs never contain card data, keys or full provider payloads.
