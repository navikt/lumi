-- Export-affecting product control state is an atomic unit with its semantic
-- audit event and immutable effective-plan generation. These guards make the
-- transaction boundary a database invariant rather than a repository habit.

-- PAUSED existed in the original persistence model, but no pre-V26 command
-- could establish a source-backed cutoff. Never grandfather an unverified
-- timestamp into the stricter transition model.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM analysis_control.analysis_products
        WHERE lifecycle_state = 'PAUSED'
    ) THEN
        RAISE EXCEPTION 'pre-V26 paused analysis products require explicit cutoff remediation'
            USING ERRCODE = '23514';
    END IF;
END;
$$;

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
    ADD COLUMN created_transaction_id BIGINT NOT NULL DEFAULT txid_current(),
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

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM analysis_control.analysis_effective_plan_generations
        GROUP BY team, product_id, product_row_version
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'analysis product version has duplicate immutable effective generations'
            USING ERRCODE = '23514';
    END IF;
END;
$$;

ALTER TABLE analysis_control.analysis_effective_plan_generations
    ADD CONSTRAINT uq_analysis_effective_product_version
        UNIQUE (team, product_id, product_row_version);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM analysis_control.analysis_products AS product
        LEFT JOIN (
            SELECT team, product_id, max(release_number) AS latest_release_number
            FROM analysis_control.analysis_product_releases
            GROUP BY team, product_id
        ) AS release
          ON release.team = product.team AND release.product_id = product.id
        WHERE product.last_release_number <> COALESCE(release.latest_release_number, 0)
    ) THEN
        RAISE EXCEPTION 'analysis product release counter does not match immutable release history'
            USING ERRCODE = '23514';
    END IF;
END;
$$;

-- The future reconciler records one immutable row only after a product
-- snapshot has been successfully activated. Pause copies the newest verified
-- source boundary; request time is never a data boundary. PostgreSQL proves
-- the internal lineage and ordering here. Confirmation that the external
-- snapshot/pointer activation succeeded is the reconciler writer's explicit
-- trust boundary; that writer is not part of this control-plane slice.
CREATE TABLE analysis_control.analysis_product_snapshot_activations (
    team                    VARCHAR(255) NOT NULL,
    product_id              UUID NOT NULL,
    product_snapshot_id     VARCHAR(255) NOT NULL,
    effective_generation_id UUID NOT NULL,
    control_epoch           BIGINT NOT NULL CHECK (control_epoch > 0),
    release_number          BIGINT NOT NULL CHECK (release_number > 0),
    source_snapshot_at      TIMESTAMPTZ NOT NULL,
    created_transaction_id  BIGINT NOT NULL DEFAULT txid_current(),
    activated_at            TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (team, product_id, product_snapshot_id),
    CONSTRAINT uq_analysis_product_snapshot_source
        UNIQUE (team, product_id, source_snapshot_at),
    CONSTRAINT fk_analysis_product_snapshot_activation_product
        FOREIGN KEY (team, product_id)
        REFERENCES analysis_control.analysis_products(team, id),
    CONSTRAINT fk_analysis_product_snapshot_activation_generation
        FOREIGN KEY (effective_generation_id, team, product_id)
        REFERENCES analysis_control.analysis_effective_plan_generations(id, team, product_id),
    CONSTRAINT fk_analysis_product_snapshot_activation_release
        FOREIGN KEY (team, product_id, release_number)
        REFERENCES analysis_control.analysis_product_releases(team, product_id, release_number),
    CONSTRAINT chk_analysis_product_snapshot_id
        CHECK (length(btrim(product_snapshot_id)) > 0)
);

CREATE FUNCTION analysis_control.validate_product_snapshot_activation_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    product analysis_control.analysis_products%ROWTYPE;
    generation analysis_control.analysis_effective_plan_generations%ROWTYPE;
    latest_generation_id UUID;
    previous_activation analysis_control.analysis_product_snapshot_activations%ROWTYPE;
BEGIN
    IF NEW.created_transaction_id <> txid_current() THEN
        RAISE EXCEPTION 'analysis product snapshot activation transaction seal is invalid'
            USING ERRCODE = '55000';
    END IF;

    IF NEW.source_snapshot_at > clock_timestamp() THEN
        RAISE EXCEPTION 'analysis product snapshot activation cannot be in the future'
            USING ERRCODE = '23514';
    END IF;

    -- This is also the lock order used by pause. It prevents a snapshot from
    -- being activated concurrently with or after a transition to PAUSED.
    SELECT * INTO product
    FROM analysis_control.analysis_products
    WHERE team = NEW.team AND id = NEW.product_id
    FOR UPDATE;

    IF NOT FOUND OR product.lifecycle_state <> 'ENABLED' THEN
        RAISE EXCEPTION 'analysis product snapshot can only be activated while the product is enabled'
            USING ERRCODE = '23514';
    END IF;

    SELECT * INTO generation
    FROM analysis_control.analysis_effective_plan_generations
    WHERE id = NEW.effective_generation_id
      AND team = NEW.team
      AND product_id = NEW.product_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'analysis product snapshot activation references an unknown effective generation'
            USING ERRCODE = '23514';
    END IF;

    SELECT candidate.id INTO latest_generation_id
    FROM analysis_control.analysis_effective_plan_generations AS candidate
    WHERE candidate.team = NEW.team AND candidate.product_id = NEW.product_id
    ORDER BY candidate.generation DESC
    LIMIT 1;

    IF NOT FOUND OR
       generation.id IS DISTINCT FROM latest_generation_id OR
       generation.plan_kind <> 'ENABLED' OR
       generation.lifecycle_state <> 'ENABLED' OR
       generation.control_epoch <> NEW.control_epoch OR
       generation.lifecycle_state IS DISTINCT FROM product.lifecycle_state OR
       generation.active_release_number IS DISTINCT FROM NEW.release_number OR
       generation.active_release_number IS DISTINCT FROM product.active_release_number OR
       generation.desired_release_number IS DISTINCT FROM product.desired_release_number OR
       generation.data_cutoff_at IS DISTINCT FROM product.data_cutoff_at THEN
        RAISE EXCEPTION 'analysis product snapshot activation does not match its enabled effective generation'
            USING ERRCODE = '23514';
    END IF;

    SELECT * INTO previous_activation
    FROM analysis_control.analysis_product_snapshot_activations
    WHERE team = NEW.team AND product_id = NEW.product_id
    ORDER BY source_snapshot_at DESC
    LIMIT 1;

    IF FOUND AND (
        NEW.source_snapshot_at <= previous_activation.source_snapshot_at OR
        NEW.control_epoch < previous_activation.control_epoch
    ) THEN
        RAISE EXCEPTION 'analysis product snapshot activation cannot move backwards'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_analysis_product_snapshot_activation_validate_insert
BEFORE INSERT
ON analysis_control.analysis_product_snapshot_activations
FOR EACH ROW
EXECUTE FUNCTION analysis_control.validate_product_snapshot_activation_insert();

CREATE FUNCTION analysis_control.reject_product_snapshot_activation_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'analysis product snapshot activation history is immutable'
        USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER trg_analysis_product_snapshot_activation_immutable_rows
BEFORE UPDATE OR DELETE
ON analysis_control.analysis_product_snapshot_activations
FOR EACH ROW
EXECUTE FUNCTION analysis_control.reject_product_snapshot_activation_mutation();

CREATE TRIGGER trg_analysis_product_snapshot_activation_immutable_table
BEFORE TRUNCATE
ON analysis_control.analysis_product_snapshot_activations
FOR EACH STATEMENT
EXECUTE FUNCTION analysis_control.reject_product_snapshot_activation_mutation();

CREATE FUNCTION analysis_control.validate_product_control_update_shape()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    latest_release_number BIGINT;
    last_active_snapshot_at TIMESTAMPTZ;
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.team IS DISTINCT FROM OLD.team THEN
        RAISE EXCEPTION 'analysis product identity and team are immutable'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.row_version < OLD.row_version OR NEW.row_version > OLD.row_version + 1 THEN
        RAISE EXCEPTION 'analysis product row_version must be monotonic and increment at most once'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.last_release_number < OLD.last_release_number THEN
        RAISE EXCEPTION 'analysis product release counter cannot move backwards'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.last_release_number IS DISTINCT FROM OLD.last_release_number THEN
        SELECT max(release_number) INTO latest_release_number
        FROM analysis_control.analysis_product_releases
        WHERE team = NEW.team AND product_id = NEW.id;

        IF NEW.last_release_number <> OLD.last_release_number + 1 OR
           NEW.last_release_number IS DISTINCT FROM latest_release_number THEN
            RAISE EXCEPTION 'analysis product release counter must advance to the newest immutable release'
                USING ERRCODE = '23514';
        END IF;
    END IF;

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

    -- PAUSED -> ENABLED remains fail-closed until a later migration can bind
    -- fresh validation evidence to an explicit resume command.
    IF OLD.lifecycle_state IS DISTINCT FROM NEW.lifecycle_state AND NOT (
        (OLD.lifecycle_state = 'DRAFT' AND NEW.lifecycle_state IN ('ENABLED', 'OFFBOARDING')) OR
        (OLD.lifecycle_state = 'ENABLED' AND NEW.lifecycle_state IN ('PAUSED', 'OFFBOARDING')) OR
        (OLD.lifecycle_state = 'PAUSED' AND NEW.lifecycle_state = 'OFFBOARDING') OR
        (OLD.lifecycle_state = 'OFFBOARDING' AND NEW.lifecycle_state = 'DELETED')
    ) THEN
        RAISE EXCEPTION 'analysis product lifecycle transition is not allowed'
            USING ERRCODE = '23514';
    END IF;

    IF OLD.lifecycle_state = 'ENABLED' AND NEW.lifecycle_state = 'PAUSED' THEN
        SELECT source_snapshot_at INTO last_active_snapshot_at
        FROM analysis_control.analysis_product_snapshot_activations
        WHERE team = NEW.team AND product_id = NEW.id
        ORDER BY source_snapshot_at DESC
        LIMIT 1
        FOR SHARE;

        IF NOT FOUND OR NEW.data_cutoff_at IS DISTINCT FROM last_active_snapshot_at THEN
            RAISE EXCEPTION 'paused product cutoff must equal its last verified active source snapshot'
                USING ERRCODE = '23514';
        END IF;
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

CREATE FUNCTION analysis_control.validate_product_release_counter_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    product_release_number BIGINT;
    latest_release_number BIGINT;
BEGIN
    SELECT last_release_number INTO product_release_number
    FROM analysis_control.analysis_products
    WHERE team = NEW.team AND id = NEW.product_id;

    SELECT max(release_number) INTO latest_release_number
    FROM analysis_control.analysis_product_releases
    WHERE team = NEW.team AND product_id = NEW.product_id;

    IF product_release_number IS DISTINCT FROM latest_release_number THEN
        RAISE EXCEPTION 'immutable release and product release counter must commit atomically'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_analysis_product_release_counter_complete
AFTER INSERT
ON analysis_control.analysis_product_releases
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION analysis_control.validate_product_release_counter_complete();

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

    IF NOT FOUND OR audit.created_transaction_id <> txid_current() THEN
        RAISE EXCEPTION 'analysis product control transition is missing its audit event'
            USING ERRCODE = '23514';
    END IF;

    IF audit.actor_id IS DISTINCT FROM NEW.updated_by THEN
        RAISE EXCEPTION 'analysis product control transition actor does not match its audit event'
            USING ERRCODE = '23514';
    END IF;

    IF OLD.active_release_number IS DISTINCT FROM NEW.active_release_number THEN
        IF audit.event_type <> 'RELEASE_ACTIVATED' OR
           audit.release_number IS DISTINCT FROM NEW.active_release_number OR
           (
               OLD.lifecycle_state IS DISTINCT FROM NEW.lifecycle_state AND
               (audit.previous_state IS DISTINCT FROM OLD.lifecycle_state OR
                audit.next_state IS DISTINCT FROM NEW.lifecycle_state)
           ) OR
           (
               OLD.lifecycle_state IS NOT DISTINCT FROM NEW.lifecycle_state AND
               (audit.previous_state IS NOT NULL OR audit.next_state IS NOT NULL)
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
       generation.created_transaction_id <> txid_current() OR
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
REVOKE ALL ON FUNCTION analysis_control.validate_product_release_counter_complete() FROM PUBLIC;
REVOKE ALL ON FUNCTION analysis_control.validate_product_release_counter_complete() FROM "esyfo-analyse";
REVOKE ALL ON FUNCTION analysis_control.validate_product_control_transition_complete() FROM PUBLIC;
REVOKE ALL ON FUNCTION analysis_control.validate_product_control_transition_complete() FROM "esyfo-analyse";
REVOKE ALL ON FUNCTION analysis_control.validate_product_snapshot_activation_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION analysis_control.validate_product_snapshot_activation_insert() FROM "esyfo-analyse";
REVOKE ALL ON FUNCTION analysis_control.reject_product_snapshot_activation_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION analysis_control.reject_product_snapshot_activation_mutation() FROM "esyfo-analyse";
REVOKE ALL ON analysis_control.analysis_product_snapshot_activations FROM PUBLIC;
REVOKE ALL ON analysis_control.analysis_product_snapshot_activations FROM "esyfo-analyse";
