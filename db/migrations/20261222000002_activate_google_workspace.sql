-- Google Workspace now has full lessons, labs and tests, so its course product can be sold (see the Advanced Excel migration for why rows were seeded inactive).
UPDATE pay_products SET active = 1 WHERE kind = 'course' AND sku = 'course-google-workspace' AND active = 0;
