-- Excel Automation with Macros & VBA now has full lessons, labs and tests, so its course product can be sold.
UPDATE pay_products SET active = 1 WHERE kind = 'course' AND sku = 'course-excel-macros-vba' AND active = 0;
