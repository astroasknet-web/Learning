-- Business Analytics with Power BI now has full lessons, live DAX labs and tests, so its course product can be sold.
UPDATE pay_products SET active = 1 WHERE kind = 'course' AND sku = 'course-business-analytics-power-bi' AND active = 0;
