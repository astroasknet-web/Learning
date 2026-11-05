-- Essay reading tests for competitive examinations: they live in the same passage and question tables as the Reading Studio, so every attempt is
-- scored, diagnosed and tracked by the Studio. `collection` keeps them out of the level pathway; ext_no is the test number (1 to 30).
ALTER TABLE rd_passages ADD COLUMN collection VARCHAR(12) NOT NULL DEFAULT 'studio';
ALTER TABLE rd_passages ADD COLUMN ext_no INT NULL;
ALTER TABLE rd_passages ADD COLUMN theme VARCHAR(24) NULL;
ALTER TABLE rd_passages ADD COLUMN exams VARCHAR(60) NULL;
CREATE INDEX ix_rd_passage_collection ON rd_passages (collection, status, ext_no);
