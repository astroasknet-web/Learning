-- Data Engineering Fundamentals now has full lessons, live SQL labs and tests, so its course product can be sold.
UPDATE pay_products SET active = 1 WHERE kind = 'course' AND sku = 'course-data-engineering-fundamentals' AND active = 0;
