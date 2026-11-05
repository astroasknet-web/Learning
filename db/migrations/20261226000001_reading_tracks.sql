-- English Reading Studio tracks: which of the three tracks (skills, indian, international) a student has chosen to see on their dashboard.
ALTER TABLE rd_enrolments ADD COLUMN tracks VARCHAR(40) NOT NULL DEFAULT '';
