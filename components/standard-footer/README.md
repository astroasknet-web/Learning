# Standard footer (all Yugty web applications)

One footer for every Yugty app: gradient call-to-action panel with the app family, brand + newsletter + social links, four link columns,
share card, the four company offices, and the legal bar. The layout never changes between apps; only the config does.

## Use it in an app

1. Copy this folder to `components/standard-footer/` (it has no other local imports).
2. Create a config (see `lib/footer.config.ts` in the overseas app for a complete example) typed as `FooterConfig`.
3. Render it: `<StandardFooter config={FOOTER} />` (for example from `components/layout/Footer.tsx`).

## Requirements

- Packages: `lucide-react`, `react-icons`, `next`, `react`.
- Tailwind colours: `ink` (#1A1A1A), `orange` (DEFAULT #FF6A2F, dark #D44F1A). Fonts come from the app (Poppins).
- Newsletter: POSTs `{ kind: "newsletter", email, source }` to `config.newsletter.endpoint` and expects `{ ok: true }` or `{ message }` on error
  (see `app/api/enquiry/route.ts`: honeypot, rate limit, stored in `overseas_enquiries`).
- Legal pages linked by default: `/privacy-policy`, `/refund-policy`, `/data-deletion`, `/editorial-policy`. Pass `legal` to drop a link whose page
  does not exist yet.
- The "app family" panel shows only when at least two apps have a URL.

## What is shared and what is per app

Shared (edit once, in `defaults.ts` / `StandardFooter.tsx`, then copy to every app): layout, offices, share card, legal bar, behaviour.
Per app (config): brand name and logo, tagline, call-to-action, app list, link columns, social links, support email, share text.
