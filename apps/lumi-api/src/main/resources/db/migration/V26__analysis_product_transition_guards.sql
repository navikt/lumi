-- Export-affecting product control state is an atomic unit with its semantic
-- audit event and immutable effective-plan generation. These guards make the
-- transaction boundary a database invariant rather than a repository habit.

ALTER TABLE analysis_control.analysis_products
    ADD CONSTRAINT chk_analysis_product_control_shape
        CHECK (
            (lifecycle_state = 'DRAFT' AND active_release_number IS NULL AND data_cutoff_at IS NULL) OR
            (lifecycle_state = 'ENABLED' AND active_release_number IS NOT NULL AND data_cutoff_at IS NULL) OR
            (lifecycle_state = 'PAUSED' AND active_release_number IS NOT NULL AND data_cutoff_at IS NOT NULL) OR
            lifecycle_state IN ('OFFBOARDING', 'DELETED')
        ) NOT VALID,
    ADD CONSTRAINT chk_analysis_product_release_order
        CHECK (
            active_release_number IS NULL OR desired_release_number IS NULL OR
            desired_release_number >= active_release_number
        ) NOT VALID;

ALTER TABLE analysis_control.analysis_products
    VALIDATE CONSTRAINT chk_analysis_product_control_shape;
ALTER TABLE analysis_control.analysis_products
    VALIDATE CONSTRAINT chk_analysis_product_release_order;

ALTER TABLE analysis_control.analysis_product_audit_events
    DROP CONSTRAINT chk_analysis_product_audit_payload;

ALTER TABLE analysis_control.analysis_product_audit_events
    ADD CONSTRAINT chk_analysis_product_audit_payload
        CHECK (
            (
                event_type = 'PRODUCT_CREATED' AND
                draft_id IS NOT NULL AND subject_digest IS NOT NULL AND
                release_number IS NULL AND previous_state IS NULL AND next_state = 'DRAFT'
            ) OR (
                event_type IN ('DRAFT_UPDATED', 'DRAFT_VALIDATED') AND
                draft_id IS NOT NULL AND subject_digest IS NOT NULL AND
                release_number IS NULL AND previous_state IS NULL AND next_state IS NULL
            ) OR (
                event_type IN ('RELEASE_PUBLISHED', 'RELEASE_DESIRED') AND
                draft_id IS NULL AND release_number IS NOT NULL AND subject_digest IS NOT NULL AND
                previous_state IS NULL AND next_state IS NULL
            ) OR (
                event_type = 'RELEASE_ACTIVATED' AND
                draft_id IS NULL AND release_number IS NOT NULL AND subject_digest IS NOT NULL AND
                (
                    (previous_state IS NULL AND next_state IS NULL) OR
                    (previous_state = 'DRAFT' AND next_state = 'ENABLED')
                )
            ) OR (
                event_type = 'LIFECYCLE_CHANGED' AND
                draft_id IS NULL AND release_number IS NULL AND subject_digest IS NULL AND
                previous_state IS NOT NULL AND next_state IS NOT NULL AND
                previous_state <> next_state
            )
        );

ALTER TABLE analysis_control.analysis_effective_plan_generations
    ADD CONSTRAINT uq_analysis_effective_product_version
        UNIQUE (team, product_id, product_row_version);

CREATE FUNCTION analysis_control.validate_product_control_update_shape()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.lifecycle_state IS NOT DISTINCT FROM NEW.lifecycle_state AND
       OLD.desired_release_number IS NOT DISTINCT FROM NEW.desired_release_number AND
       OLD.active_release_number IS NOT DISTINCT FROM NEW.active_release_number AND
       OLD.data_cutoff_at IS NOT DISTINCT FROM NEW.data_cutoff_at THEN
        RETURN NEW;
    END IF;

    IF NEW.row_version <> OLD.row_version + 1 THEN
        RAISE EXCEPTION 'analysis product control transition must increment row_version exactly once'
            USING ERRCODE = '23514';
    END IF;

    IF OLD.lifecycle_state IS DISTINCT FROM NEW.lifecycle_state AND NOT (
        (OLD.lifecycle_state = 'DRAFT' AND NEW.lifecycle_state IN ('ENABLED', 'OFFBOARDING')) OR
        (OLD.lifecycle_state = 'ENABLED' AND NEW.lifecycle_state IN ('PAUSED', 'OFFBOARDING')) OR
        (OLD.lifecycle_state = 'PAUSED' AND NEW.lifecycle_state IN ('ENABLED', 'OFFBOARDING')) OR
        (OLD.lifecycle_state = 'OFFBOARDING' AND NEW.lifecycle_state = 'DELETED')
    ) THEN
        RAISE EXCEPTION 'analysis product lifecycle transition is not allowed'
            USING ERRCODE = '23514';
    END IF;

    IF OLD.desired_release_number IS DISTINCT FROM NEW.desired_release_number AND (
        NEW.desired_release_number IS NULL OR
        NEW.desired_release_number <> NEW.last_release_number OR
        (OLD.desired_release_number IS NOT NULL AND NEW.desired_release_number < OLD.desired_release_number) OR
        NEW.lifecycle_state NOT IN ('DRAFT', 'ENABLED', 'PAUSED')
    ) THEN
        RAISE EXCEPTION 'desired release must advance monotonically to the newest release'
            USING ERRCODE = '23514';
    END IF;

    IF OLD.active_release_number IS DISTINCT FROM NEW.active_release_number AND (
        NEW.active_release_number IS NULL OR
        NEW.active_release_number IS DISTINCT FROM NEW.desired_release_number OR
        (OLD.active_release_number IS NOT NULL AND NEW.active_release_number < OLD.active_release_number)
    ) THEN
        RAISE EXCEPTION 'active release must advance monotonically to the desired release'
            USING ERRCODE = '23514';
    END IF;

    IF OLD.active_release_number IS DISTINCT FROM NEW.active_release_number THEN
        IF NOT (
               OLD.desired_release_number IS NOT DISTINCT FROM NEW.desired_release_number OR
               (
                   OLD.lifecycle_state = 'DRAFT' AND NEW.lifecycle_state = 'ENABLED' AND
                   OLD.desired_release_number IS NULL AND
                   NEW.desired_release_number = NEW.active_release_number
               )
           ) OR
           OLD.data_cutoff_at IS DISTINCT FROM NEW.data_cutoff_at OR
           NOT (
               (OLD.lifecycle_state = 'DRAFT' AND NEW.lifecycle_state = 'ENABLED') OR
               (OLD.lifecycle_state = 'ENABLED' AND NEW.lifecycle_state = 'ENABLED')
           ) THEN
            RAISE EXCEPTION 'release activation must be a single semantic control transition'
                USING ERRCODE = '23514';
        END IF;
    ELSIF OLD.desired_release_number IS DISTINCT FROM NEW.desired_release_number THEN
        IF OLD.lifecycle_state IS DISTINCT FROM NEW.lifecycle_state OR
           OLD.data_cutoff_at IS DISTINCT FROM NEW.data_cutoff_at THEN
            RAISE EXCEPTION 'desired release must be a single semantic control transition'
                USING ERRCODE = '23514';
        END IF;
    ELSIF OLD.lifecycle_state IS NOT DISTINCT FROM NEW.lifecycle_state THEN
        RAISE EXCEPTION 'data cutoff cannot change without a lifecycle transition'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_analysis_product_control_update_shape
BEFORE UPDATE
ON analysis_control.analysis_products
FOR EACH ROW
EXECUTE FUNCTION analysis_control.validate_product_control_update_shape();

CREATE FUNCTION analysis_control.validate_product_control_transition_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    audit analysis_control.analysis_product_audit_events%ROWTYPE;
    generation analysis_control.analysis_effective_plan_generations%ROWTYPE;
BEGIN
    IF OLD.lifecycle_state IS NOT DISTINCT FROM NEW.lifecycle_state AND
       OLD.desired_release_number IS NOT DISTINCT FROM NEW.desired_release_number AND
       OLD.active_release_number IS NOT DISTINCT FROM NEW.active_release_number AND
       OLD.data_cutoff_at IS NOT DISTINCT FROM NEW.data_cutoff_at THEN
        RETURN NEW;
    END IF;

    SELECT * INTO audit
    FROM analysis_control.analysis_product_audit_events AS event
    WHERE event.team = NEW.team
      AND event.product_id = NEW.id
      AND event.product_version = NEW.row_version;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'analysis product control transition is missing its audit event'
            USING ERRCODE = '23514';
    END IF;

    IF OLD.active_release_number IS DISTINCT FROM NEW.active_release_number THEN
        IF audit.event_type <> 'RELEASE_ACTIVATED' OR
           audit.release_number IS DISTINCT FROM NEW.active_release_number OR
           (
               OLD.lifecycle_state IS DISTINCT FROM NEW.lifecycle_state AND
               (audit.previous_state IS DISTINCT FROM OLD.lifecycle_state OR
                audit.next_state IS DISTINCT FROM NEW.lifecycle_state)
           ) THEN
            RAISE EXCEPTION 'release activation audit does not match control transition'
                USING ERRCODE = '23514';
        END IF;
    ELSIF OLD.desired_release_number IS DISTINCT FROM NEW.desired_release_number THEN
        IF audit.event_type <> 'RELEASE_DESIRED' OR
           audit.release_number IS DISTINCT FROM NEW.desired_release_number THEN
            RAISE EXCEPTION 'desired release audit does not match control transition'
                USING ERRCODE = '23514';
        END IF;
    ELSE
        IF audit.event_type <> 'LIFECYCLE_CHANGED' OR
           audit.previous_state IS DISTINCT FROM OLD.lifecycle_state OR
           audit.next_state IS DISTINCT FROM NEW.lifecycle_state THEN
            RAISE EXCEPTION 'lifecycle audit does not match control transition'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    SELECT * INTO generation
    FROM analysis_control.analysis_effective_plan_generations AS candidate
    WHERE candidate.team = NEW.team
      AND candidate.product_id = NEW.id
      AND candidate.product_row_version = NEW.row_version;

    IF NOT FOUND OR
       generation.lifecycle_state <> NEW.lifecycle_state OR
       generation.active_release_number IS DISTINCT FROM NEW.active_release_number OR
       generation.desired_release_number IS DISTINCT FROM NEW.desired_release_number OR
       generation.data_cutoff_at IS DISTINCT FROM NEW.data_cutoff_at THEN
        RAISE EXCEPTION 'analysis product control transition is missing its exact effective generation'
            USING ERRCODE = '40001';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_analysis_product_control_transition_complete
AFTER UPDATE
ON analysis_control.analysis_products
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION analysis_control.validate_product_control_transition_complete();

REVOKE ALL ON FUNCTION analysis_control.validate_product_control_update_shape() FROM PUBLIC;
REVOKE ALL ON FUNCTION analysis_control.validate_product_control_update_shape() FROM "esyfo-analyse";
REVOKE ALL ON FUNCTION analysis_control.validate_product_control_transition_complete() FROM PUBLIC;
REVOKE ALL ON FUNCTION analysis_control.validate_product_control_transition_complete() FROM "esyfo-analyse";
