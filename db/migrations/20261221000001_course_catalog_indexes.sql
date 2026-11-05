-- Indexes for the course catalogue's filters and sorts (level filter, title sort and title match). Duplicate-index errors are skipped by the runner, so this is safe to re-run.
CREATE INDEX ix_courses_level ON courses (level, sort);
CREATE INDEX ix_courses_title ON courses (title);
