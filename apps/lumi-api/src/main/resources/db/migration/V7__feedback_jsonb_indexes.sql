-- Additional JSONB indexes for common query patterns.

CREATE INDEX IF NOT EXISTS idx_feedback_context_tags_gin
    ON feedback USING GIN ((feedback_json->'context'->'tags'));

CREATE INDEX IF NOT EXISTS idx_feedback_answers_gin
    ON feedback USING GIN ((feedback_json->'answers'));
