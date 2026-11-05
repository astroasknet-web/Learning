-- Plan prices raised before launch: Pro Rs 599, Silver Rs 999, Gold Rs 1,699 a month; a year costs eight months (Rs 4,792, 7,992 and 13,592).
-- Only prices still at the previous seeded value are moved, so a price changed in the console is left alone. Idempotent.
UPDATE pay_prices pr JOIN pay_products p ON p.id = pr.product_id SET pr.amount_minor = 59900   WHERE p.sku = 'plan-pro-monthly'    AND pr.currency = 'INR' AND pr.amount_minor = 49900;
UPDATE pay_prices pr JOIN pay_products p ON p.id = pr.product_id SET pr.amount_minor = 479200  WHERE p.sku = 'plan-pro-yearly'     AND pr.currency = 'INR' AND pr.amount_minor = 399200;
UPDATE pay_prices pr JOIN pay_products p ON p.id = pr.product_id SET pr.amount_minor = 99900   WHERE p.sku = 'plan-silver-monthly' AND pr.currency = 'INR' AND pr.amount_minor = 89900;
UPDATE pay_prices pr JOIN pay_products p ON p.id = pr.product_id SET pr.amount_minor = 799200  WHERE p.sku = 'plan-silver-yearly'  AND pr.currency = 'INR' AND pr.amount_minor = 719200;
UPDATE pay_prices pr JOIN pay_products p ON p.id = pr.product_id SET pr.amount_minor = 169900  WHERE p.sku = 'plan-gold-monthly'    AND pr.currency = 'INR' AND pr.amount_minor = 129900;
UPDATE pay_prices pr JOIN pay_products p ON p.id = pr.product_id SET pr.amount_minor = 1359200 WHERE p.sku = 'plan-gold-yearly'     AND pr.currency = 'INR' AND pr.amount_minor = 1039200;
