-- Data Analytics with Python & SQL now has full lessons, live SQL labs and tests, so its course product can be sold.
UPDATE pay_products SET active = 1 WHERE kind = 'course' AND sku = 'course-data-analytics-python-sql' AND active = 0;
