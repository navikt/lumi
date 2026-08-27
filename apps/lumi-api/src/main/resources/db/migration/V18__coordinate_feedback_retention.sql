-- Persist the global retention cadence so pod restarts and replica changes
-- cannot execute more than one deletion batch in a rolling 24-hour window.
CREATE TABLE feedback_retention_job_state
(
    job_name         VARCHAR(100) PRIMARY KEY,
    last_completed_at TIMESTAMPTZ NOT NULL
);

-- Retention warnings are always team-scoped and ordered by retention time.
DROP INDEX idx_survey_definitions_active_retention;

CREATE INDEX idx_survey_definitions_active_retention
    ON survey_definitions(team, definition_retention_at)
    WHERE retired_at IS NULL;
