# Payments: set-up, deployment and go-live

Read this top to bottom the first time. Everything marked **YOU** needs an account or a decision that only you can make.

## 1. What you need (YOU)

| Item | Why | Notes |
|---|---|---|
| Razorpay account (KYC complete for live) | Takes INR payments in India (cards, UPI, netbanking, wallets) | Test mode works without KYC. |
| Stripe account (only if you sell outside India) | Takes international cards | Stripe must approve your business and your country must be supported by Stripe for your entity. If you are an Indian business, ask Stripe whether your account type can accept international payments before you promise anything to customers. |
| PayPal | **Not built.** See `LIMITATIONS.md`. | |
| A finance or tax adviser | GST/VAT rates, whether you may issue tax invoices, what your receipts must say | The system never guesses tax. |
| A lawyer or advisor for the refund policy | The checkout links to `/refund-policy` | Make sure the page matches what you actually do. |

## 2. Database

The payment tables are created by the normal migration run (`db/migrations/20261110000001_payments.sql`, applied automatically on start-up like every other portal migration). On the first start after deployment the seed adds one product for every plan in `lib/market/plans.ts` (`plan-<key>-monthly`, `plan-<key>-yearly`, `resume-studio-pro`) with INR prices, and prints "payment products added: N". Nothing can be bought until a provider has keys.

## 3. Environment variables

Copy the payments block from `migration/env.example` into Hostinger (hPanel > Node.js app > Environment variables). Never commit keys. Minimum for **test mode**:

```
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
PAY_RAZORPAY_WEBHOOK_SECRET=<any long random string you choose>
CRON_SECRET=<already set>
```

and for international test payments:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...     # from step 5
```

Redeploy (or restart the Node app) after changing variables.

## 4. Razorpay set-up (test mode)

1. Dashboard > switch to **Test Mode** > Account & Settings > API Keys > Generate. Put the Key Id and Secret in the variables above.
2. Settings > Webhooks > Add new webhook:
   * URL: `https://qrscore.mathstudy.in/api/v1/webhooks/razorpay`
   * Secret: the exact value of `PAY_RAZORPAY_WEBHOOK_SECRET`
   * Events: `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.created`, `refund.processed`, `refund.failed`, `payment.dispute.created`, `payment.dispute.won`, `payment.dispute.lost`, `payment.dispute.closed`, `payment.dispute.under_review`, `payment.dispute.action_required`
3. Payment capture must be **automatic** (Settings > Payment capture), so authorised payments are captured without manual work.
4. Use Razorpay's published test card/UPI details to pay in test mode.

## 5. Stripe set-up (test mode)

1. Dashboard > Developers > API keys > copy the **Secret key** (`sk_test_...`).
2. Developers > Webhooks > Add endpoint:
   * URL: `https://qrscore.mathstudy.in/api/v1/webhooks/stripe`
   * Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.payment_failed`, `charge.refunded`, `charge.refund.updated`, `refund.created`, `refund.updated`, `refund.failed`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`
   * Copy the **Signing secret** (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`.
3. Prices in USD (or any other currency) do not exist until you add them: console > Payments > **Prices, coupons and staff** > pick the product, currency and amount > Save price. Turn the currency on in the Currencies box first (INR and USD are on by default). **There is no automatic conversion.** A product with no price in a currency simply cannot be bought in it.

## 6. Cron job (YOU, in hPanel)

hPanel > Advanced > Cron Jobs, every 5 to 10 minutes:

```
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://qrscore.mathstudy.in/api/cron/payments
```

(write the real secret in place of `$CRON_SECRET`). It expires unpaid orders, retries failed webhooks, finishes stuck refunds, reconciles with the providers about every six hours, and emails an alert when something looks wrong. It is safe to run as often as you like.

## 7. Staff access

* Portal administrators are payment admins automatically (with two-step login).
* Give others a role in console > Payments > Prices, coupons and staff > **Payment staff** (enter the user's id): *support* (look only), *finance* (also refund, export, retry webhooks, reconcile, audit), *admin* (also prices and staff).

## 8. Test checklist (sandbox)

Run these with test keys before anything else. Tick each off.

- [ ] `GET /api/v1/payments/health` returns `ok: true`, with both providers `configured`.
- [ ] /pricing: the Pro/Silver/Gold buttons go to `/checkout?sku=...`.
- [ ] Pay with a Razorpay test card; the status page turns to "Payment received" and the plan shows under **Billing**; one receipt email arrives.
- [ ] Console > Payments shows the order as paid; the webhook shows "processed".
- [ ] Pay with a failing test card: the order does not grant anything and you can try again.
- [ ] Close the browser right after paying: within a minute the webhook (or the cron) still completes the order.
- [ ] Resend the same webhook from the provider dashboard: nothing is granted twice.
- [ ] Issue a partial refund, then the rest, from the order page; amounts and statuses match the provider dashboard; the second click on "Refund" with the same page open does not create a second refund.
- [ ] Console > Webhooks, reconciliation, audit > "Run now" finishes with no unexplained items; "Verify the chain" says intact.
- [ ] (Stripe) a USD price exists, a visitor from outside India sees USD, and the Stripe test card works.
- [ ] A customer cannot open another customer's order (`/billing/<other id>` is a 404).

## 9. Go-live checklist

Do these in order. Do not skip.

1. All of section 8 passes in test mode, on the **production** site, and the database has a backup.
2. **Expert bookings:** `lib/payments/booking-amount.ts` still has `TEST_MODE = true` (charges ₹1). That is an older flow that this work did not touch. Turn it off before expert bookings take real money.
3. Razorpay (and Stripe) accounts are activated for live payments; live API keys generated.
4. In Hostinger, replace the test keys with the **live** keys; create **new** webhooks for live mode (test and live webhooks and secrets are separate) with the same URLs and events; set the live webhook secrets.
5. Set `PAY_SELLER_NAME`, `PAY_SELLER_ADDRESS`, `PAY_SUPPORT_EMAIL`. Leave `PAY_INVOICE_MODE=receipt` unless your accountant confirms you may issue tax invoices; then also set `PAY_SELLER_TAX_ID` and the invoice mode.
6. Add tax rules (console > Prices, coupons and staff > Tax rules) only on your accountant's advice. With no rule no tax is added.
7. Check prices in every currency you sell in.
8. Check `/refund-policy` and `/privacy-policy` match reality; add terms of service if your lawyer asks.
9. Make one real payment of the smallest amount with your own card, then refund it from the console. Check it in the provider dashboard.
10. Put `GET /api/v1/payments/health` into an uptime monitor.
11. Decide who receives alerts (`PAY_ALERT_EMAIL`) and who is on call for failed refunds or disputes.
12. Review `SECURITY.md` and `LIMITATIONS.md` with the person responsible for the business.

## 10. Rollback

* To stop taking payments immediately: remove the provider keys (or set `PAY_ENABLED_PROVIDERS=none`) and restart. Pricing buttons fall back to sign-up, checkout shows a friendly "not open yet" page, existing orders and receipts stay readable.
* To take one product off sale: console > Prices, coupons and staff > "Take off sale".
* The payment tables are additive; nothing in the older flows depends on them.
