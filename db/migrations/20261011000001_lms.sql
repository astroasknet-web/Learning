-- MySQL / MariaDB version of the portal schema step 20261011000001_lms.sql. Converted, then reviewed by hand. Statements run one by one; a duplicate index or column is skipped.
-- LMS roles and classes: teachers run classes that students join with a code, set assignments (a course or a practice test),
-- and read a gradebook; parents follow a child through the child's learner code. Idempotent, like every portal migration.

-- The teacher and parent roles are part of the users table definition (initial schema).
CREATE TABLE IF NOT EXISTS classes (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    teacher_id INT NOT NULL,
    name varchar(120) NOT NULL,
    join_code varchar(8) NOT NULL,
    archived smallint NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_class_code UNIQUE (join_code),
    CONSTRAINT fk_class_teacher FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_class_teacher ON classes (teacher_id);

CREATE TABLE IF NOT EXISTS class_members (
    class_id INT NOT NULL,
    student_id INT NOT NULL,
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (class_id, student_id),
    CONSTRAINT fk_member_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    CONSTRAINT fk_member_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_member_student ON class_members (student_id);

-- kind 'course': ref = course slug. kind 'test': ref = exam key (ielts-reading, ielts-listening, gre-quant), test_no = which test.
CREATE TABLE IF NOT EXISTS assignments (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    class_id INT NOT NULL,
    kind varchar(10) NOT NULL CHECK (kind IN ('course','test')),
    ref varchar(120) NOT NULL,
    test_no smallint NULL,
    title varchar(190) NOT NULL,
    note varchar(400) NOT NULL DEFAULT '',
    due_date date NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_assign_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_assign_class ON assignments (class_id, due_date);

-- A student's private learner code; sharing it with a parent lets that parent see the child's progress.
CREATE TABLE IF NOT EXISTS learner_codes (
    student_id INT NOT NULL PRIMARY KEY,
    code varchar(10) NOT NULL,
    CONSTRAINT uq_learner_code UNIQUE (code),
    CONSTRAINT fk_code_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS parent_links (
    parent_id INT NOT NULL,
    student_id INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (parent_id, student_id),
    CONSTRAINT fk_plink_parent FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_plink_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_plink_student ON parent_links (student_id);
