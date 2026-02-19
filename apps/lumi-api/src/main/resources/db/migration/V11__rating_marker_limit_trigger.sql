-- Enforce a hard limit of 50 markers per (team, survey_id).
-- We serialize inserts per (team, survey_id) to avoid concurrent inserts crossing the limit.

CREATE OR REPLACE FUNCTION enforce_rating_marker_limit()
RETURNS TRIGGER AS
$$
DECLARE
    existing_count INTEGER;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.team), hashtext(NEW.survey_id));

    SELECT COUNT(*) INTO existing_count
    FROM rating_marker
    WHERE team = NEW.team
      AND survey_id = NEW.survey_id;

    IF existing_count >= 50 THEN
        RAISE EXCEPTION 'Maximum number of markers (50) reached for survey % in team %', NEW.survey_id, NEW.team
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rating_marker_limit ON rating_marker;

CREATE TRIGGER trg_rating_marker_limit
    BEFORE INSERT
    ON rating_marker
    FOR EACH ROW
EXECUTE FUNCTION enforce_rating_marker_limit();
