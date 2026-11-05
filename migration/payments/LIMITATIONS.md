# Payments: what is NOT done, and what is not proven

Read this before telling anyone the system is "complete".

## Not built

* **PayPal.** The provider interface and registry are ready, but no adapter exists. PayPal needs a merchant account and approval for the business model, and the adapter must be tested against PayPal's sandbox.
* **Auto-renewing subscriptions.** Pro, Silver and Gold are sold as one-time purchases for a month or a year of access. When access ends the customer buys again. Provider-managed recurring billing (Razorpay Subscriptions, Stripe Billing), renewal reminders, dunning, proration, and plan changes mid-term are not built.
* **Tax engine.** Only simple per-country rates in basis points, inclusive or exclusive. No GST place-of-supply logic (CGST/SGST/IGST split), no reverse charge, no VAT OSS, no HSN/SAC codes, no e-invoicing (IRN/QR). Receipts are titled **Receipt** and say they are not a tax invoice. Do not switch `PAY_INVOICE_MODE=tax_invoice` until your accountant confirms the legal fields are right.
* **Payouts, settlements, provider fees** are not imported. Reconciliation compares payments and refunds, not bank settlements.
* **Dispute evidence submission.** Disputes are tracked; evidence is uploaded in the provider dashboard.
* **Saved cards / wallets / one-click re-purchase.**
* **Multi-currency prices beyond INR are not seeded.** USD and others exist only after you add prices. No automatic conversion, by design.
* **Emails** use the existing mail queue. No PDF attachments; the receipt is an HTML page (print to PDF from the browser).
* **Migration of the older flows.** Resume Studio Pro, the CRM verification fee and expert bookings still use their own Razorpay code and tables. They keep working and are not in the unified console or ledger.
* **Fraud scoring** beyond the providers' own tools and basic rate limits.

## Not proven

* **No live provider has been called.** All tests use fake providers that imitate the documented Razorpay and Stripe API shapes. Run the sandbox checklist in `DEPLOYMENT.md` with real test keys before relying on this. Field names, signature formats and webhook payloads were implemented from the providers' documentation and should be confirmed against a real sandbox.
* **No browser-based checkout test has been run against the real Razorpay modal or Stripe page.** The checkout page, status page and console were type-checked, built and exercised through their API, but not clicked through with a real payment.
* **Load and performance** were not tested. The design uses short transactions and row locks; it is sized for a small to medium site, not for thousands of orders per minute.
* **No PCI DSS assessment** has been done. Hosted checkout reduces scope; the merchant is still responsible for its own compliance questionnaire.
* **Accessibility** was designed for (labels, focus on errors, live regions, keyboard use) but not audited with assistive technology.

## Known rough edges

* The Resume Studio Pro product (`resume-studio-pro`) is seeded but the older Studio payment button still uses the older flow.
* Limits listed on the pricing cards (for example "5 resume scores a month") are display text; this system grants a plan but does not enforce usage quotas.
* Guest purchases are limited to products flagged "allow guest"; none of the seeded plans are.
* Staff are granted payment roles by user id.
* Coupons are per-order percent or fixed amounts; no stacking, no per-customer targeting beyond a per-user limit.

## Plan features: what is live and what is not

A plan (Pro, Silver, Gold) is bought through checkout and held as an entitlement. This table says what each advertised feature does today. "Live" means the server enforces it.

| Advertised feature | State |
|---|---|
| Every course is paid; the course page (what is in it) stays public, the lessons open only after purchase or a plan pick | **Live** |
| Courses included: Pro 1, Silver 2, Gold 4 (chosen by the student from courses that have lessons; shown on the dashboard and My courses with progress) | **Live.** Chosen by the student from all courses with lessons, not limited to the resume-scan recommendations (that link is not built) |
| Vedic Mathematics: module 1 free, all 30 modules with Pro, Silver or Gold | **Live** |
| Resume Studio Pro features (all templates, no waiting between saves) with any paid plan | **Live.** The 3/10/25/45 template and 1/3/10/unlimited resume steps are not separated: every paid plan gets everything |
| Verified Skill Passport (QR), IELTS practice tests, study abroad portal, mock visa interview | Exist, but are open to everyone today; they are **not** restricted to Silver or Gold |
| Writing Clinic essay checks (2 / 15 / 25 / unlimited a month) | **Not built** (the page is a description only) |
| AI resume score checks per month, ATS feedback | **Not enforced** (no monthly quota) |
| AI interview practice sessions, monthly counselling and doubt-solving session, expert resume review, 1:1 overseas counselling | **Not built as plan benefits** (done by staff outside this system) |
| QR Score Booster plan, maths calculation speed studio, live English speaking classes | **Not built** |
| Priority email support | A staff practice, not a system feature |

If a plan lapses, its picked courses lock again (progress is kept); renewing opens them. A lower plan keeps only the earliest picks open. A course that was bought stays open for good.
