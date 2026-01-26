-- Migrate feedback_json to JSONB for better indexing and query performance.

ALTER TABLE feedback
    ALTER COLUMN feedback_json TYPE JSONB
    USING feedback_json::jsonb;

-- Common filter expression indexes.
CREATE INDEX IF NOT EXISTS idx_feedback_survey_id ON feedback ((feedback_json->>'surveyId'));
CREATE INDEX IF NOT EXISTS idx_feedback_device_type ON feedback ((feedback_json->'context'->>'deviceType'));
