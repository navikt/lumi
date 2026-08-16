-- Mutable, team-scoped working copies for Surveyverkstedet.
-- Kept deliberately separate from survey_definitions: authoring drafts are not
-- production configuration and must never affect submission compatibility.

CREATE TABLE survey_authoring_projects (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team          VARCHAR(255) NOT NULL,
    name          VARCHAR(120) NOT NULL,
    survey_id     VARCHAR(200) NOT NULL,
    draft         JSONB NOT NULL,
    draft_version BIGINT NOT NULL DEFAULT 1 CHECK (draft_version > 0),
    created_by    TEXT NOT NULL,
    updated_by    TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_survey_authoring_draft_object
        CHECK (jsonb_typeof(draft) = 'object'),
    CONSTRAINT chk_survey_authoring_schema_v1
        CHECK (draft ->> 'authoringSchemaVersion' = '1')
);

CREATE INDEX idx_survey_authoring_projects_team_updated
    ON survey_authoring_projects(team, updated_at DESC);
