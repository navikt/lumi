-- Replace comma-separated tags with a normalized tag table.
-- No existing data, so we drop legacy column if present.

CREATE TABLE IF NOT EXISTS feedback_tag
(
    feedback_id VARCHAR(255) NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
    tag         VARCHAR(255) NOT NULL,
    PRIMARY KEY (feedback_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_feedback_tag_tag ON feedback_tag(tag);
CREATE INDEX IF NOT EXISTS idx_feedback_tag_feedback_id ON feedback_tag(feedback_id);

ALTER TABLE feedback DROP COLUMN IF EXISTS tags;
