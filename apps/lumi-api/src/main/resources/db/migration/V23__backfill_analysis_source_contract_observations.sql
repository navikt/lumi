-- Backfill after V22 installed writer capture so rolling application pods and
-- concurrent inserts cannot fall through the materialized observation table.

INSERT INTO analysis_control.analysis_source_contract_observations (
    team,
    app,
    survey_id,
    definition_hash,
    flow_hash,
    has_source_id_mismatch,
    first_submission_at,
    last_submission_at
)
SELECT
    team,
    app,
    COALESCE(survey_id, feedback_json ->> 'surveyId') AS catalog_survey_id,
    definition_hash,
    flow_hash,
    BOOL_OR(
        survey_id IS NOT NULL AND
        feedback_json ->> 'surveyId' IS NOT NULL AND
        survey_id <> feedback_json ->> 'surveyId'
    ),
    MIN(opprettet),
    MAX(opprettet)
FROM feedback
WHERE length(btrim(COALESCE(survey_id, feedback_json ->> 'surveyId', ''))) > 0
  AND length(COALESCE(survey_id, feedback_json ->> 'surveyId', '')) <= 255
  AND length(btrim(team)) > 0
  AND length(btrim(app)) > 0
GROUP BY team, app, COALESCE(survey_id, feedback_json ->> 'surveyId'), definition_hash, flow_hash
ON CONFLICT (team, app, survey_id, definition_hash, flow_hash) DO UPDATE
SET first_submission_at = LEAST(
        analysis_control.analysis_source_contract_observations.first_submission_at,
        EXCLUDED.first_submission_at
    ),
    last_submission_at = GREATEST(
        analysis_control.analysis_source_contract_observations.last_submission_at,
        EXCLUDED.last_submission_at
    ),
    has_source_id_mismatch =
        analysis_control.analysis_source_contract_observations.has_source_id_mismatch OR
        EXCLUDED.has_source_id_mismatch,
    updated_at = statement_timestamp();
