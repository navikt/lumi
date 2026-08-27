-- Add nullable activity columns and install the rolling-deploy trigger in a
-- short migration. Backfill runs in V17 after this transaction has committed,
-- so CREATE TRIGGER does not block feedback inserts during a full table scan.

ALTER TABLE survey_definitions
    ADD COLUMN last_submission_at TIMESTAMPTZ,
    ADD COLUMN definition_retention_at TIMESTAMPTZ,
    ADD COLUMN retired_at TIMESTAMPTZ;

-- Old application instances do not write the new columns explicitly. Defaults
-- keep definitions created between V16 and V17 valid without changing existing
-- rows, which remain NULL until the backfill.
ALTER TABLE survey_definitions
    ALTER COLUMN last_submission_at SET DEFAULT now(),
    ALTER COLUMN definition_retention_at SET DEFAULT (
        (now() AT TIME ZONE 'UTC' + INTERVAL '18 months') AT TIME ZONE 'UTC'
    );

CREATE OR REPLACE FUNCTION update_survey_definition_activity()
RETURNS TRIGGER AS $$
DECLARE
    submitted_survey_id TEXT := COALESCE(NEW.survey_id, NEW.feedback_json ->> 'surveyId');
BEGIN
    IF submitted_survey_id IS NOT NULL THEN
        UPDATE survey_definitions
        SET last_submission_at = GREATEST(
                COALESCE(last_submission_at, NEW.opprettet),
                NEW.opprettet
            ),
            definition_retention_at = GREATEST(
                COALESCE(
                    definition_retention_at,
                    (NEW.opprettet AT TIME ZONE 'UTC' + INTERVAL '18 months') AT TIME ZONE 'UTC'
                ),
                (NEW.opprettet AT TIME ZONE 'UTC' + INTERVAL '18 months') AT TIME ZONE 'UTC'
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
