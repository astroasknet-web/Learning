-- Data Visualization with Tableau now has full lessons, a live viz builder, labs and tests, so its course product can be sold.
UPDATE pay_products SET active = 1 WHERE kind = 'course' AND sku = 'course-data-visualization-tableau' AND active = 0;
