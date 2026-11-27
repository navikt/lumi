-- How a survey from Surveyverkstedet is meant to be shown: as the floating
-- panel ('dock') or at the content it asks about ('inline'), with an optional
-- note on where in the app it belongs. The choice is authoring metadata. It
-- is kept outside the document, which stays a SurveyDocumentV1, and it is
-- frozen with each shared revision like name and survey_id.
--
-- Existing projects and revisions become the floating panel, which is what
-- they have been shown as. The defaults are constants, so PostgreSQL adds the
-- columns without rewriting the tables.
--
-- An API from before this migration knows none of the columns. That is safe
-- for projects: it cannot choose the content, and a draft save leaves the
-- columns alone. A revision it shares must still get the project's choice,
-- so the revision columns keep no default and a trigger copies the project's
-- values when an insert leaves them out. This holds while old and new
-- instances run side by side, and after a rollback of the API.

ALTER TABLE survey_authoring_projects
    ADD COLUMN display_mode   VARCHAR(16) NOT NULL DEFAULT 'dock',
    ADD COLUMN placement_note VARCHAR(200),
    ADD CONSTRAINT chk_survey_authoring_display_mode
        CHECK (display_mode IN ('dock', 'inline')),
    ADD CONSTRAINT chk_survey_authoring_placement_note
        CHECK (placement_note IS NULL OR btrim(placement_note) <> '');

ALTER TABLE survey_authoring_revisions
    ADD COLUMN display_mode   VARCHAR(16) NOT NULL DEFAULT 'dock',
    ADD COLUMN placement_note VARCHAR(200),
    ADD CONSTRAINT chk_survey_authoring_revision_display_mode
        CHECK (display_mode IN ('dock', 'inline')),
    ADD CONSTRAINT chk_survey_authoring_revision_placement_note
        CHECK (placement_note IS NULL OR btrim(placement_note) <> '');

-- Existing rows keep 'dock'. Dropping the default changes no stored row.
ALTER TABLE survey_authoring_revisions
    ALTER COLUMN display_mode DROP DEFAULT;

CREATE FUNCTION survey_authoring_revision_presentation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS
$$
DECLARE
    project survey_authoring_projects%ROWTYPE;
BEGIN
    -- The API from this migration on sets both columns itself.
    IF NEW.display_mode IS NOT NULL THEN
        RETURN NEW;
    END IF;

    SELECT * INTO project
    FROM survey_authoring_projects
    WHERE id = NEW.project_id;

    -- Draft saves do not take the lock that sharing takes. The copied values
    -- must belong to the draft version the revision was made from.
    IF NOT FOUND OR project.draft_version <> NEW.draft_version THEN
        RAISE EXCEPTION 'survey authoring project % changed while revision % was shared',
            NEW.project_id, NEW.revision_number
            USING ERRCODE = '40001';
    END IF;

    NEW.display_mode := project.display_mode;
    NEW.placement_note := project.placement_note;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_survey_authoring_revision_presentation
    BEFORE INSERT
    ON survey_authoring_revisions
    FOR EACH ROW
EXECUTE FUNCTION survey_authoring_revision_presentation();
