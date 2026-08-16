-- Immutable handoff snapshots from Surveyverkstedet. Revisions are authoring
-- artifacts only and remain separate from production survey_definitions.

CREATE TABLE survey_authoring_revisions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id        UUID NOT NULL REFERENCES survey_authoring_projects(id) ON DELETE CASCADE,
    revision_number   BIGINT NOT NULL CHECK (revision_number > 0),
    draft_version     BIGINT NOT NULL CHECK (draft_version > 0),
    name              VARCHAR(120) NOT NULL,
    survey_id         VARCHAR(200) NOT NULL,
    document          JSONB NOT NULL,
    document_hash     VARCHAR(64) NOT NULL,
    definition        JSONB NOT NULL,
    definition_hash   VARCHAR(64) NOT NULL,
    created_by        TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_survey_authoring_revision_number
        UNIQUE (project_id, revision_number),
    CONSTRAINT chk_survey_authoring_revision_document_object
        CHECK (jsonb_typeof(document) = 'object'),
    CONSTRAINT chk_survey_authoring_revision_schema_v1
        CHECK (document ->> 'authoringSchemaVersion' = '1'),
    CONSTRAINT chk_survey_authoring_revision_definition_object
        CHECK (jsonb_typeof(definition) = 'object'),
    CONSTRAINT chk_survey_authoring_revision_document_hash
        CHECK (document_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT chk_survey_authoring_revision_definition_hash
        CHECK (definition_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX idx_survey_authoring_revisions_project_created
    ON survey_authoring_revisions(project_id, revision_number DESC);

CREATE INDEX idx_survey_authoring_revisions_project_survey
    ON survey_authoring_revisions(project_id, survey_id, revision_number DESC);
