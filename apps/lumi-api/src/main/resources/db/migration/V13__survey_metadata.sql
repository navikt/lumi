-- Dashboard-side survey metadata (lifecycle/display state).
-- Deliberately independent of survey_definitions so surveys without a
-- definition row (pre-V12 submissions) can also be archived.

CREATE TABLE IF NOT EXISTS survey_metadata (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team        VARCHAR(255) NOT NULL,
    survey_id   VARCHAR(255) NOT NULL,
    archived_at TIMESTAMPTZ,
    archived_by TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_survey_metadata_team_survey UNIQUE (team, survey_id)
);
