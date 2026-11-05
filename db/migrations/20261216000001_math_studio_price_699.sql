-- The owner set the Mathematics Speed Enhancement Studio at Rs 699 (it was seeded at Rs 599).
-- Only a price still at the old seeded value is moved, so a price someone changed in the console is left alone. Idempotent.
UPDATE pay_prices pr JOIN pay_products p ON p.id = pr.product_id
SET pr.amount_minor = 69900
WHERE p.sku = 'course-mathematics-speed-enhancement' AND pr.currency = 'INR' AND pr.amount_minor = 59900;
