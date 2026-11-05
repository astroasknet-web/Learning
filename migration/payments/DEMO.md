# Local payment demo (no accounts, no money)

Shows the whole cycle on your own computer: add a product, set prices, a customer pays, the receipt, the admin dashboard, a partial refund.

`scripts/demo-fake-stripe.mjs` is a stand-in for Stripe. Our **real** Stripe code talks to it, the customer sees a clearly-labelled fake payment page, and the stand-in sends our app **correctly signed webhooks**, so every step on our side (order, signature check, verification, fulfilment, refund, receipts, audit) is the real code. It proves our logic; it does not prove that a real Stripe account works (see `LIMITATIONS.md`).

## Run it

1. A MySQL database for the demo (empty), and its migrations: `DATABASE_URL=mysql://... npx tsx scripts/portal-migrate.ts`
2. Create an admin and a student (`npx tsx scripts/portal-create-user.ts admin@demo.test "Demo Admin" admin`; a student can sign up normally).
3. Start the stand-in: `node scripts/demo-fake-stripe.mjs` (port 4010).
4. Start the app with these variables (never in production; `STRIPE_API_BASE` is ignored when `NODE_ENV=production`):

```
DATABASE_URL=mysql://...  DATABASE_SSL=disable
PORTAL_CAPTCHA=off  PORTAL_MFA_REQUIRE_STAFF=false
STRIPE_SECRET_KEY=sk_test_demo  STRIPE_WEBHOOK_SECRET=whsec_demo
STRIPE_API_BASE=http://127.0.0.1:4010  PAY_ENABLED_PROVIDERS=stripe
PORTAL_APP_URL=http://localhost:3000
npx next dev -p 3000
```

## The walk-through

1. Admin: **Console > Payments > Prices, coupons, staff > Add a product**, then save an INR and a USD price.
2. Customer: open `/checkout?sku=<code>&country=US` (a visitor from the US is shown USD; from India, INR). Log in, tick the agreement, press **Pay**.
3. The stand-in's payment page opens. Press **Pay with test card** (or "declined" to see a failed payment).
4. The app shows the status page, then "Payment received", the receipt, and **Billing**.
5. Admin: **Payments** (revenue per currency), open the order (timeline, webhooks, documents), refund part of it. A credit note is issued.
