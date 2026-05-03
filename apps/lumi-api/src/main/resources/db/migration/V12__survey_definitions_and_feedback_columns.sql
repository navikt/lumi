-- V12__survey_definitions_and_feedback_columns.sql
-- Immutable survey definition registry and new feedback columns
-- for definition tracking and deduplication.

-- 1. Survey definitions table
CREATE TABLE survey_definitions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team            VARCHAR(255) NOT NULL,
    survey_id       VARCHAR(255) NOT NULL,
    definition_hash VARCHAR(64) NOT NULL
                    CHECK (definition_hash ~ '^[a-f0-9]{64}$'),
    definition      JSONB NOT NULL,
    source          VARCHAR(50) NOT NULL DEFAULT 'auto'
                    CHECK (source IN ('auto', 'api', 'dashboard', 'import')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (team, survey_id)
);

CREATE INDEX idx_survey_definitions_team ON survey_definitions(team);

-- 2. New columns on feedback (all nullable for rolling deploy compatibility)
ALTER TABLE feedback ADD COLUMN survey_id VARCHAR(255);

ALTER TABLE feedback ADD COLUMN definition_hash VARCHAR(64)
    CHECK (definition_hash IS NULL OR definition_hash ~ '^[a-f0-9]{64}$');

ALTER TABLE feedback ADD COLUMN deduplication_key_hash VARCHAR(64)
    CHECK (deduplication_key_hash IS NULL OR deduplication_key_hash ~ '^[a-f0-9]{64}$');

-- 3. Indexes
CREATE INDEX idx_feedback_definition_hash ON feedback(definition_hash)
    WHERE definition_hash IS NOT NULL;

CREATE INDEX idx_feedback_survey_id_column ON feedback(team, survey_id)
    WHERE survey_id IS NOT NULL;

CREATE UNIQUE INDEX idx_feedback_dedup_key
    ON feedback(team, survey_id, deduplication_key_hash)
    WHERE survey_id IS NOT NULL
      AND deduplication_key_hash IS NOT NULL;
