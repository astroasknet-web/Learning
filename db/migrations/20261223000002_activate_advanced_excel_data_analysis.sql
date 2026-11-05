-- Advanced Excel for Data Analysis now has full lessons, labs and tests, so its course product can be sold.
UPDATE pay_products SET active = 1 WHERE kind = 'course' AND sku = 'course-advanced-excel-data-analysis' AND active = 0;
