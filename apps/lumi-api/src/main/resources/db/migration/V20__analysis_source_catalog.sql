-- Stable app-scoped source identities for the analysis-product catalog.
--
-- Install writer capture in this short migration before V21 backfills existing
-- rows. This also covers old application pods during a rolling deployment.

CREATE TABLE analysis_control.analysis_sources (
    team                VARCHAR(255) NOT NULL,
    app                 VARCHAR(255) NOT NULL,
    survey_id           VARCHAR(255) NOT NULL,
    first_submission_at TIMESTAMPTZ NOT NULL,
    last_submission_at  TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (team, app, survey_id),
    CONSTRAINT chk_analysis_source_team_nonblank CHECK (length(btrim(team)) > 0),
    CONSTRAINT chk_analysis_source_app_nonblank CHECK (length(btrim(app)) > 0),
    CONSTRAINT chk_analysis_source_survey_nonblank CHECK (length(btrim(survey_id)) > 0),
    CONSTRAINT chk_analysis_source_activity_order CHECK (first_submission_at <= last_submission_at)
);

CREATE INDEX idx_analysis_sources_team_survey
    ON analysis_control.analysis_sources(team, survey_id, app);

CREATE FUNCTION analysis_control.capture_analysis_source()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    catalog_survey_id TEXT := COALESCE(NEW.survey_id, NEW.feedback_json ->> 'surveyId');
BEGIN
    IF catalog_survey_id IS NOT NULL
       AND length(btrim(catalog_survey_id)) > 0
       AND length(catalog_survey_id) <= 255
       AND length(btrim(NEW.team)) > 0
       AND length(btrim(NEW.app)) > 0 THEN
        INSERT INTO analysis_control.analysis_sources (
            team,
            app,
            survey_id,
            first_submission_at,
            last_submission_at
        )
        VALUES (
            NEW.team,
            NEW.app,
            catalog_survey_id,
            NEW.opprettet,
            NEW.opprettet
        )
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
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER feedback_analysis_source_capture
    AFTER INSERT ON feedback
    FOR EACH ROW
    EXECUTE FUNCTION analysis_control.capture_analysis_source();

REVOKE ALL ON analysis_control.analysis_sources FROM PUBLIC;
REVOKE ALL ON analysis_control.analysis_sources FROM "esyfo-analyse";
REVOKE ALL ON FUNCTION analysis_control.capture_analysis_source() FROM PUBLIC;
REVOKE ALL ON FUNCTION analysis_control.capture_analysis_source() FROM "esyfo-analyse";
