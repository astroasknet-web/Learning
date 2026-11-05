-- New plan prices: Pro Rs 499, Silver Rs 899, Gold Rs 1,299 a month; a year costs eight months (Rs 3,992, 7,192 and 10,392). Gold is now sold monthly too:
-- its monthly product is added by the catalogue seeding at start. Only prices still at the earlier seeded value are moved, so a price changed in the
-- console is left alone. Idempotent.
UPDATE pay_prices pr JOIN pay_products p ON p.id = pr.product_id SET pr.amount_minor = 49900   WHERE p.sku = 'plan-pro-monthly'    AND pr.currency = 'INR' AND pr.amount_minor = 39900;
UPDATE pay_prices pr JOIN pay_products p ON p.id = pr.product_id SET pr.amount_minor = 399200  WHERE p.sku = 'plan-pro-yearly'     AND pr.currency = 'INR' AND pr.amount_minor = 319900;
UPDATE pay_prices pr JOIN pay_products p ON p.id = pr.product_id SET pr.amount_minor = 89900   WHERE p.sku = 'plan-silver-monthly' AND pr.currency = 'INR' AND pr.amount_minor = 69900;
UPDATE pay_prices pr JOIN pay_products p ON p.id = pr.product_id SET pr.amount_minor = 719200  WHERE p.sku = 'plan-silver-yearly'  AND pr.currency = 'INR' AND pr.amount_minor = 559900;
UPDATE pay_prices pr JOIN pay_products p ON p.id = pr.product_id SET pr.amount_minor = 1039200 WHERE p.sku = 'plan-gold-yearly'    AND pr.currency = 'INR' AND pr.amount_minor = 1198800;
