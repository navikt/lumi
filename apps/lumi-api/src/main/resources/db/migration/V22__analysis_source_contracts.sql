-- Materialize future source-contract observations at ingest. Full flow
-- contracts are registered by the API before the corresponding feedback row
-- is inserted; old pods and direct writers remain valid with flow_hash NULL.

ALTER TABLE feedback
    ADD COLUMN flow_hash VARCHAR(64),
    ADD CONSTRAINT chk_feedback_flow_hash
        CHECK (flow_hash IS NULL OR flow_hash ~ '^[0-9a-f]{64}$'),
    ADD CONSTRAINT chk_feedback_flow_requires_definition
        CHECK (flow_hash IS NULL OR definition_hash IS NOT NULL),
    ADD CONSTRAINT chk_feedback_flow_requires_survey
        CHECK (flow_hash IS NULL OR survey_id IS NOT NULL);

CREATE INDEX idx_feedback_analysis_source_contract
    ON feedback (
        team,
        app,
        (COALESCE(survey_id, feedback_json ->> 'surveyId')),
        definition_hash,
        flow_hash
    );

CREATE TABLE analysis_control.analysis_source_contracts (
    team              VARCHAR(255) NOT NULL,
    app               VARCHAR(255) NOT NULL,
    survey_id         VARCHAR(255) NOT NULL,
    definition_hash   VARCHAR(64) NOT NULL,
    flow_hash         VARCHAR(64) NOT NULL,
    definition        JSONB NOT NULL,
    flow_definition   JSONB NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (team, app, survey_id, definition_hash, flow_hash),
    CONSTRAINT chk_analysis_source_contract_definition_hash
        CHECK (definition_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT chk_analysis_source_contract_flow_hash
        CHECK (flow_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT chk_analysis_source_contract_definition_object
        CHECK (jsonb_typeof(definition) = 'object'),
    CONSTRAINT chk_analysis_source_contract_flow_object
        CHECK (jsonb_typeof(flow_definition) = 'object'),
    CONSTRAINT chk_analysis_source_contract_flow_schema
        CHECK (flow_definition ->> 'schemaVersion' = '1'),
    CONSTRAINT chk_analysis_source_contract_evaluator
        CHECK (flow_definition ->> 'evaluatorVersion' = 'visible-if-v1'),
    CONSTRAINT chk_analysis_source_contract_flow_size
        CHECK (octet_length(flow_definition::text) <= 65536)
);

ALTER TABLE feedback
    ADD CONSTRAINT fk_feedback_analysis_source_contract
    FOREIGN KEY (team, app, survey_id, definition_hash, flow_hash)
    REFERENCES analysis_control.analysis_source_contracts (
        team,
        app,
        survey_id,
        definition_hash,
        flow_hash
    )
    MATCH SIMPLE
    ON DELETE RESTRICT;

CREATE TABLE analysis_control.analysis_source_contract_observations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team                VARCHAR(255) NOT NULL,
    app                 VARCHAR(255) NOT NULL,
    survey_id           VARCHAR(255) NOT NULL,
    definition_hash     VARCHAR(64),
    flow_hash           VARCHAR(64),
    has_source_id_mismatch BOOLEAN NOT NULL DEFAULT FALSE,
    first_submission_at TIMESTAMPTZ NOT NULL,
    last_submission_at  TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_analysis_source_contract_observation
        UNIQUE NULLS NOT DISTINCT (team, app, survey_id, definition_hash, flow_hash),
    CONSTRAINT chk_analysis_source_observation_definition_hash
        CHECK (definition_hash IS NULL OR definition_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT chk_analysis_source_observation_flow_hash
        CHECK (flow_hash IS NULL OR flow_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT chk_analysis_source_observation_flow_requires_definition
        CHECK (flow_hash IS NULL OR definition_hash IS NOT NULL),
    CONSTRAINT chk_analysis_source_observation_activity_order
        CHECK (first_submission_at <= last_submission_at)
);

CREATE FUNCTION analysis_control.reject_source_contract_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION '% is immutable; delete only through retention cleanup', TG_TABLE_NAME
        USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER trg_analysis_source_contract_immutable
BEFORE UPDATE
ON analysis_control.analysis_source_contracts
FOR EACH ROW
EXECUTE FUNCTION analysis_control.reject_source_contract_update();

CREATE TRIGGER trg_analysis_source_contract_reject_truncate
BEFORE TRUNCATE
ON analysis_control.analysis_source_contracts
FOR EACH STATEMENT
EXECUTE FUNCTION analysis_control.reject_source_contract_update();

CREATE FUNCTION analysis_control.source_contract_lock_key(
    lock_team TEXT,
    lock_app TEXT,
    lock_survey_id TEXT,
    lock_definition_hash TEXT
)
RETURNS BIGINT
LANGUAGE SQL
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
    SELECT hashtextextended(
        length(lock_team)::TEXT || ':' || lock_team ||
        length(lock_app)::TEXT || ':' || lock_app ||
        length(lock_survey_id)::TEXT || ':' || lock_survey_id ||
        length(lock_definition_hash)::TEXT || ':' || lock_definition_hash,
        0
    );
$$;

CREATE FUNCTION analysis_control.source_contract_team_lock_key(lock_team TEXT)
RETURNS BIGINT
LANGUAGE SQL
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
    SELECT hashtextextended(length(lock_team)::TEXT || ':' || lock_team, 1);
$$;

CREATE FUNCTION analysis_control.refresh_deleted_source_contract_observations()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    affected_source RECORD;
BEGIN
    -- Serialize cleanup with registration. Without this lock, deletion of the
    -- final referenced row could remove a contract while a concurrent
    -- submission is between contract registration and feedback insertion.
    FOR affected_source IN
        SELECT DISTINCT
            team,
            app,
            COALESCE(survey_id, feedback_json ->> 'surveyId') AS survey_id,
            definition_hash
        FROM deleted_feedback
        WHERE definition_hash IS NOT NULL
          AND length(btrim(COALESCE(survey_id, feedback_json ->> 'surveyId', ''))) > 0
          AND length(COALESCE(survey_id, feedback_json ->> 'surveyId', '')) <= 255
        ORDER BY team, app, survey_id, definition_hash
    LOOP
        PERFORM pg_advisory_xact_lock(
            analysis_control.source_contract_lock_key(
                affected_source.team,
                affected_source.app,
                affected_source.survey_id,
                affected_source.definition_hash
            )
        );
    END LOOP;

    -- Recompute only the exact contract pairs touched by this DELETE. This
    -- preserves exact first/last/mismatch facts without rescanning every
    -- historical revision for the source.
    DELETE FROM analysis_control.analysis_source_contract_observations AS observation
    USING (
        SELECT DISTINCT
            team,
            app,
            COALESCE(survey_id, feedback_json ->> 'surveyId') AS survey_id,
            definition_hash,
            flow_hash
        FROM deleted_feedback
        WHERE length(btrim(COALESCE(survey_id, feedback_json ->> 'surveyId', ''))) > 0
          AND length(COALESCE(survey_id, feedback_json ->> 'surveyId', '')) <= 255
    ) AS affected
    WHERE observation.team = affected.team
      AND observation.app = affected.app
      AND observation.survey_id = affected.survey_id
      AND observation.definition_hash IS NOT DISTINCT FROM affected.definition_hash
      AND observation.flow_hash IS NOT DISTINCT FROM affected.flow_hash;

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
        feedback.team,
        feedback.app,
        COALESCE(feedback.survey_id, feedback.feedback_json ->> 'surveyId') AS survey_id,
        feedback.definition_hash,
        feedback.flow_hash,
        BOOL_OR(
            feedback.survey_id IS NOT NULL AND
            feedback.feedback_json ->> 'surveyId' IS NOT NULL AND
            feedback.survey_id <> feedback.feedback_json ->> 'surveyId'
        ),
        MIN(feedback.opprettet),
        MAX(feedback.opprettet)
    FROM feedback
    JOIN (
        SELECT DISTINCT
            team,
            app,
            COALESCE(survey_id, feedback_json ->> 'surveyId') AS survey_id,
            definition_hash,
            flow_hash
        FROM deleted_feedback
        WHERE length(btrim(COALESCE(survey_id, feedback_json ->> 'surveyId', ''))) > 0
          AND length(COALESCE(survey_id, feedback_json ->> 'surveyId', '')) <= 255
    ) AS affected
      ON affected.team = feedback.team
     AND affected.app = feedback.app
     AND affected.survey_id = COALESCE(feedback.survey_id, feedback.feedback_json ->> 'surveyId')
     AND affected.definition_hash IS NOT DISTINCT FROM feedback.definition_hash
     AND affected.flow_hash IS NOT DISTINCT FROM feedback.flow_hash
    GROUP BY
        feedback.team,
        feedback.app,
        COALESCE(feedback.survey_id, feedback.feedback_json ->> 'surveyId'),
        feedback.definition_hash,
        feedback.flow_hash
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

    -- The immutable contract contains private predicate constants. Retain it
    -- only while at least one pinned feedback row references it. The FK plus
    -- the source lock makes this safe against concurrent submissions.
    DELETE FROM analysis_control.analysis_source_contracts AS contract
    USING (
        SELECT DISTINCT
            team,
            app,
            COALESCE(survey_id, feedback_json ->> 'surveyId') AS survey_id,
            definition_hash,
            flow_hash
        FROM deleted_feedback
        WHERE definition_hash IS NOT NULL
          AND flow_hash IS NOT NULL
          AND length(btrim(COALESCE(survey_id, feedback_json ->> 'surveyId', ''))) > 0
          AND length(COALESCE(survey_id, feedback_json ->> 'surveyId', '')) <= 255
    ) AS affected
    WHERE contract.team = affected.team
      AND contract.app = affected.app
      AND contract.survey_id = affected.survey_id
      AND contract.definition_hash = affected.definition_hash
      AND contract.flow_hash = affected.flow_hash
      AND NOT EXISTS (
          SELECT 1
          FROM feedback
          WHERE feedback.team = contract.team
            AND feedback.app = contract.app
            AND feedback.survey_id = contract.survey_id
            AND feedback.definition_hash = contract.definition_hash
            AND feedback.flow_hash = contract.flow_hash
      );

    RETURN NULL;
END;
$$;

CREATE TRIGGER feedback_analysis_source_contract_delete_refresh
AFTER DELETE ON feedback
REFERENCING OLD TABLE AS deleted_feedback
FOR EACH STATEMENT
EXECUTE FUNCTION analysis_control.refresh_deleted_source_contract_observations();

CREATE OR REPLACE FUNCTION analysis_control.capture_analysis_source()
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
        VALUES (
            NEW.team,
            NEW.app,
            catalog_survey_id,
            NEW.definition_hash,
            NEW.flow_hash,
            NEW.survey_id IS NOT NULL AND
                NEW.feedback_json ->> 'surveyId' IS NOT NULL AND
                NEW.survey_id <> NEW.feedback_json ->> 'surveyId',
            NEW.opprettet,
            NEW.opprettet
        )
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
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON analysis_control.analysis_source_contracts FROM PUBLIC;
REVOKE ALL ON analysis_control.analysis_source_contracts FROM "esyfo-analyse";
REVOKE ALL ON analysis_control.analysis_source_contract_observations FROM PUBLIC;
REVOKE ALL ON analysis_control.analysis_source_contract_observations FROM "esyfo-analyse";
REVOKE ALL ON FUNCTION analysis_control.reject_source_contract_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION analysis_control.reject_source_contract_update() FROM "esyfo-analyse";
REVOKE ALL ON FUNCTION analysis_control.source_contract_lock_key(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION analysis_control.source_contract_lock_key(TEXT, TEXT, TEXT, TEXT) FROM "esyfo-analyse";
REVOKE ALL ON FUNCTION analysis_control.source_contract_team_lock_key(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION analysis_control.source_contract_team_lock_key(TEXT) FROM "esyfo-analyse";
REVOKE ALL ON FUNCTION analysis_control.refresh_deleted_source_contract_observations() FROM PUBLIC;
REVOKE ALL ON FUNCTION analysis_control.refresh_deleted_source_contract_observations() FROM "esyfo-analyse";
REVOKE ALL ON FUNCTION analysis_control.capture_analysis_source() FROM PUBLIC;
REVOKE ALL ON FUNCTION analysis_control.capture_analysis_source() FROM "esyfo-analyse";
