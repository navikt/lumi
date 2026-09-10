-- Backfill only after V20 writer capture has committed. Inserts racing with
-- this scan are handled by the trigger and reconciled by ON CONFLICT.

INSERT INTO analysis_control.analysis_sources (
    team,
    app,
    survey_id,
    first_submission_at,
    last_submission_at
)
SELECT
    team,
    app,
    COALESCE(survey_id, feedback_json ->> 'surveyId') AS catalog_survey_id,
    MIN(opprettet),
    MAX(opprettet)
FROM feedback
WHERE length(btrim(team)) > 0
  AND length(btrim(app)) > 0
  AND length(btrim(COALESCE(survey_id, feedback_json ->> 'surveyId', ''))) > 0
  AND length(COALESCE(survey_id, feedback_json ->> 'surveyId', '')) <= 255
GROUP BY team, app, COALESCE(survey_id, feedback_json ->> 'surveyId')
ON CONFLICT (team, app, survey_id) DO UPDATE
SET first_submission_at = LEAST(
        analysis_control.analysis_sources.first_submission_at,
        EXCLUDED.first_submission_at
    ),
    last_submission_at = GREATEST(
        analysis_control.analysis_sources.last_submission_at,
        EXCLUDED.last_submission_at
    ),
    updated_at = statement_timestamp();
