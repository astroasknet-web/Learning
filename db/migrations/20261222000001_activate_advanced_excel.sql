-- Advanced Excel now has full lessons, labs and tests, so its course product can be sold. The row was seeded inactive while the course had no content;
-- a database seeded from now on creates it active on its own. Only an untouched inactive row is switched on, so a console change is never overridden.
UPDATE pay_products SET active = 1 WHERE kind = 'course' AND sku = 'course-advanced-excel' AND active = 0;
