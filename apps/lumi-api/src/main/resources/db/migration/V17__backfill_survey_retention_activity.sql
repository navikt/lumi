-- Backfill after V16 has committed its feedback trigger. Concurrent inserts
-- either appear in this aggregation or move the same timestamps forward via
-- the trigger, so this migration never needs to lock feedback against writers.

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
        COALESCE(definition.last_submission_at, submission_activity.last_submission_at),
        submission_activity.last_submission_at
    ),
    definition_retention_at = GREATEST(
        COALESCE(
            definition.definition_retention_at,
            (
                submission_activity.last_submission_at AT TIME ZONE 'UTC' + INTERVAL '18 months'
            ) AT TIME ZONE 'UTC'
        ),
        (
            submission_activity.last_submission_at AT TIME ZONE 'UTC' + INTERVAL '18 months'
        ) AT TIME ZONE 'UTC'
    )
FROM submission_activity
WHERE submission_activity.team = definition.team
  AND submission_activity.survey_id = definition.survey_id;

UPDATE survey_definitions
SET last_submission_at = created_at
WHERE last_submission_at IS NULL;

-- Existing definitions that are already beyond 18 months receive the same
-- three-month warning period as definitions that approach the limit later.
UPDATE survey_definitions
SET definition_retention_at = GREATEST(
    COALESCE(
        definition_retention_at,
        (last_submission_at AT TIME ZONE 'UTC' + INTERVAL '18 months') AT TIME ZONE 'UTC'
    ),
    (last_submission_at AT TIME ZONE 'UTC' + INTERVAL '18 months') AT TIME ZONE 'UTC',
    (now() AT TIME ZONE 'UTC' + INTERVAL '3 months') AT TIME ZONE 'UTC'
);

ALTER TABLE survey_definitions
    ALTER COLUMN last_submission_at SET NOT NULL,
    ALTER COLUMN definition_retention_at SET NOT NULL;

CREATE INDEX idx_survey_definitions_active_retention
    ON survey_definitions(definition_retention_at)
    WHERE retired_at IS NULL;
