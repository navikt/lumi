-- flyway:transaction=false
-- Expression indexes for frequent JSONB filters/aggregations.

CREATE INDEX ${concurrently} IF NOT EXISTS idx_feedback_survey_id
    ON feedback ((feedback_json->>'surveyId'));

CREATE INDEX ${concurrently} IF NOT EXISTS idx_feedback_survey_type
    ON feedback ((feedback_json->>'surveyType'));

CREATE INDEX ${concurrently} IF NOT EXISTS idx_feedback_context_device_type
    ON feedback ((feedback_json->'context'->>'deviceType'));

CREATE INDEX ${concurrently} IF NOT EXISTS idx_feedback_context_pathname
    ON feedback ((feedback_json->'context'->>'pathname'));

CREATE INDEX ${concurrently} IF NOT EXISTS idx_feedback_team_survey_id
    ON feedback (team, (feedback_json->>'surveyId'));

CREATE INDEX ${concurrently} IF NOT EXISTS idx_feedback_team_survey_type
    ON feedback (team, (feedback_json->>'surveyType'));
