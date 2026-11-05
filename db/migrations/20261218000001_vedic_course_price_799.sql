-- Vedic Mathematics can now be bought on its own at Rs 799 (plans still open it). The shop had seeded it as a hidden Rs 399 product from its category fee.
-- Only the untouched seeded product (Rs 399, off sale) is moved and put on sale, so anything changed in the console is left alone. Idempotent.
UPDATE pay_prices pr JOIN pay_products p ON p.id = pr.product_id
SET pr.amount_minor = 79900
WHERE p.sku = 'course-vedic-mathematics' AND pr.currency = 'INR' AND pr.amount_minor = 39900 AND p.active = 0;
UPDATE pay_products SET active = 1
WHERE sku = 'course-vedic-mathematics' AND active = 0 AND id IN (SELECT product_id FROM (SELECT product_id FROM pay_prices WHERE currency = 'INR' AND amount_minor = 79900) x);
