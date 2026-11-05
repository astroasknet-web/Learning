-- Basic Computer & Internet Literacy now has full lessons, labs and tests, so its course product can be sold.
UPDATE pay_products SET active = 1 WHERE kind = 'course' AND sku = 'course-basic-computer-internet-literacy' AND active = 0;
