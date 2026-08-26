-- Activity timestamps used by automatic survey retention.
-- The structural definition remains NOT NULL until all running application
-- versions can safely read retired definition rows.

ALTER TABLE survey_definitions
    ADD COLUMN last_submission_at TIMESTAMPTZ;

WITH submission_activity AS (
    SELECT
        team,
        COALESCE(survey_id, feedback_json ->> 'surveyId') AS survey_id,
        MAX(opprettet) AS last_submission_at
    FROM feedback
    GROUP BY team, COALESCE(survey_id, feedback_json ->> 'surveyId')
)
UPDATE survey_definitions definition
SET last_submission_at = submission_activity.last_submission_at
FROM submission_activity
WHERE submission_activity.team = definition.team
  AND submission_activity.survey_id = definition.survey_id;

UPDATE survey_definitions
SET last_submission_at = created_at
WHERE last_submission_at IS NULL;

ALTER TABLE survey_definitions
    ALTER COLUMN last_submission_at SET NOT NULL,
    ALTER COLUMN last_submission_at SET DEFAULT now();

ALTER TABLE survey_definitions
    ADD COLUMN definition_retention_at TIMESTAMPTZ,
    ADD COLUMN retired_at TIMESTAMPTZ;

-- Existing definitions that are already beyond 18 months receive the same
-- three-month warning period as definitions that approach the limit later.
UPDATE survey_definitions
SET definition_retention_at = GREATEST(
    last_submission_at + INTERVAL '18 months',
    now() + INTERVAL '3 months'
);

ALTER TABLE survey_definitions
    ALTER COLUMN definition_retention_at SET NOT NULL,
    ALTER COLUMN definition_retention_at SET DEFAULT (now() + INTERVAL '18 months');

CREATE INDEX idx_survey_definitions_active_retention
    ON survey_definitions(definition_retention_at)
    WHERE retired_at IS NULL;

-- Keep activity correct while old and new application versions run together.
-- The application also records activity transactionally, but the trigger covers
-- writers from before these columns existed and remains safe for retries because
-- it only runs after a feedback row has actually been inserted.
CREATE OR REPLACE FUNCTION update_survey_definition_activity()
RETURNS TRIGGER AS $$
DECLARE
    submitted_survey_id TEXT := COALESCE(NEW.survey_id, NEW.feedback_json ->> 'surveyId');
BEGIN
    IF submitted_survey_id IS NOT NULL THEN
        UPDATE survey_definitions
        SET last_submission_at = GREATEST(last_submission_at, NEW.opprettet),
            definition_retention_at = GREATEST(
                definition_retention_at,
                NEW.opprettet + INTERVAL '18 months'
            )
        WHERE team = NEW.team
          AND survey_id = submitted_survey_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER feedback_survey_definition_activity
    AFTER INSERT ON feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_survey_definition_activity();

-- CREATE TRIGGER takes a lock that blocks later inserts until this migration
-- commits. Repeating the activity aggregation after that lock is acquired
-- closes the gap for inserts that committed after the first backfill but before
-- the trigger existed.
WITH submission_activity AS (
    SELECT
        team,
        COALESCE(survey_id, feedback_json ->> 'surveyId') AS survey_id,
        MAX(opprettet) AS last_submission_at
    FROM feedback
    GROUP BY team, COALESCE(survey_id, feedback_json ->> 'surveyId')
)
UPDATE survey_definitions definition
SET last_submission_at = GREATEST(
        definition.last_submission_at,
        submission_activity.last_submission_at
    ),
    definition_retention_at = GREATEST(
        definition.definition_retention_at,
        submission_activity.last_submission_at + INTERVAL '18 months'
    )
FROM submission_activity
WHERE submission_activity.team = definition.team
  AND submission_activity.survey_id = definition.survey_id;
