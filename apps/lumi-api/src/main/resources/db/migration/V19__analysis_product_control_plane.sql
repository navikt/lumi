-- Team-scoped control-plane state for managed analysis products.
--
-- This deliberately lives outside public. The legacy esyfo-analyse role has
-- broad SELECT/default privileges in public and must never see drafts, owner
-- metadata, release specifications or audit actors.

CREATE SCHEMA analysis_control;

REVOKE ALL ON SCHEMA analysis_control FROM PUBLIC;
REVOKE ALL ON SCHEMA analysis_control FROM "esyfo-analyse";

CREATE TABLE analysis_control.analysis_products (
    id                     UUID PRIMARY KEY,
    team                   VARCHAR(255) NOT NULL,
    lifecycle_state        VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    row_version            BIGINT NOT NULL DEFAULT 1 CHECK (row_version > 0),
    last_release_number    BIGINT NOT NULL DEFAULT 0 CHECK (last_release_number >= 0),
    desired_release_number BIGINT,
    active_release_number  BIGINT,
    data_cutoff_at         TIMESTAMPTZ,
    created_by             TEXT NOT NULL,
    updated_by             TEXT NOT NULL,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_analysis_products_team_id UNIQUE (team, id),
    CONSTRAINT chk_analysis_product_lifecycle
        CHECK (lifecycle_state IN ('DRAFT', 'ENABLED', 'PAUSED', 'OFFBOARDING', 'DELETED')),
    CONSTRAINT chk_analysis_product_desired_release
        CHECK (
            desired_release_number IS NULL OR
            (desired_release_number > 0 AND desired_release_number <= last_release_number)
        ),
    CONSTRAINT chk_analysis_product_active_release
        CHECK (
            active_release_number IS NULL OR
            (active_release_number > 0 AND active_release_number <= last_release_number)
        )
);

CREATE TABLE analysis_control.analysis_product_drafts (
    id                               UUID PRIMARY KEY,
    team                             VARCHAR(255) NOT NULL,
    product_id                       UUID NOT NULL,
    revision                         BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
    base_release_number              BIGINT,
    document                         JSONB NOT NULL,
    document_hash                    VARCHAR(64) NOT NULL,
    validated_revision               BIGINT,
    validated_catalog_revision       VARCHAR(128),
    validated_base_schema_digest     VARCHAR(64),
    validated_by                     TEXT,
    validated_at                     TIMESTAMPTZ,
    created_by                       TEXT NOT NULL,
    updated_by                       TEXT NOT NULL,
    created_at                       TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at                       TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_analysis_product_draft_product UNIQUE (product_id),
    CONSTRAINT uq_analysis_product_draft_team_product UNIQUE (team, product_id),
    CONSTRAINT fk_analysis_product_draft_product
        FOREIGN KEY (team, product_id)
        REFERENCES analysis_control.analysis_products(team, id),
    CONSTRAINT chk_analysis_product_draft_base_release
        CHECK (base_release_number IS NULL OR base_release_number > 0),
    CONSTRAINT chk_analysis_product_draft_document_object
        CHECK (jsonb_typeof(document) = 'object'),
    CONSTRAINT chk_analysis_product_draft_schema_v1
        CHECK (
            document ->> 'schemaVersion' IS NOT NULL AND
            document ->> 'schemaVersion' = '1'
        ),
    CONSTRAINT chk_analysis_product_draft_hash
        CHECK (document_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT chk_analysis_product_draft_validation_complete
        CHECK (
            (
                validated_revision IS NULL AND
                validated_catalog_revision IS NULL AND
                validated_base_schema_digest IS NULL AND
                validated_by IS NULL AND
                validated_at IS NULL
            ) OR (
                validated_revision IS NOT NULL AND
                validated_revision = revision AND
                validated_catalog_revision IS NOT NULL AND
                length(btrim(validated_catalog_revision)) > 0 AND
                validated_base_schema_digest IS NOT NULL AND
                validated_base_schema_digest ~ '^[0-9a-f]{64}$' AND
                validated_by IS NOT NULL AND
                validated_at IS NOT NULL
            )
        )
);

CREATE TABLE analysis_control.analysis_product_releases (
    id                   UUID PRIMARY KEY,
    team                 VARCHAR(255) NOT NULL,
    product_id           UUID NOT NULL,
    release_number       BIGINT NOT NULL CHECK (release_number > 0),
    source_draft_id      UUID NOT NULL,
    source_draft_revision BIGINT NOT NULL CHECK (source_draft_revision > 0),
    source_document      JSONB NOT NULL,
    source_document_hash VARCHAR(64) NOT NULL,
    publication_specification JSONB NOT NULL,
    publication_specification_digest VARCHAR(64) NOT NULL,
    catalog_revision     VARCHAR(128) NOT NULL,
    base_schema_digest   VARCHAR(64) NOT NULL,
    published_by         TEXT NOT NULL,
    published_at         TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_analysis_product_release_number
        UNIQUE (team, product_id, release_number),
    CONSTRAINT fk_analysis_product_release_product
        FOREIGN KEY (team, product_id)
        REFERENCES analysis_control.analysis_products(team, id),
    CONSTRAINT chk_analysis_product_release_source_document_object
        CHECK (jsonb_typeof(source_document) = 'object'),
    CONSTRAINT chk_analysis_product_release_source_schema_v1
        CHECK (
            source_document ->> 'schemaVersion' IS NOT NULL AND
            source_document ->> 'schemaVersion' = '1'
        ),
    CONSTRAINT chk_analysis_product_release_source_document_hash
        CHECK (source_document_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT chk_analysis_product_release_specification_object
        CHECK (jsonb_typeof(publication_specification) = 'object'),
    CONSTRAINT chk_analysis_product_release_specification_schema_v1
        CHECK (
            publication_specification ->> 'schemaVersion' IS NOT NULL AND
            publication_specification ->> 'schemaVersion' = '1'
        ),
    CONSTRAINT chk_analysis_product_release_specification_digest
        CHECK (publication_specification_digest ~ '^[0-9a-f]{64}$'),
    CONSTRAINT chk_analysis_product_release_catalog_revision
        CHECK (length(btrim(catalog_revision)) > 0),
    CONSTRAINT chk_analysis_product_release_schema_digest
        CHECK (base_schema_digest ~ '^[0-9a-f]{64}$')
);

ALTER TABLE analysis_control.analysis_products
    ADD CONSTRAINT fk_analysis_product_desired_release
        FOREIGN KEY (team, id, desired_release_number)
        REFERENCES analysis_control.analysis_product_releases(team, product_id, release_number),
    ADD CONSTRAINT fk_analysis_product_active_release
        FOREIGN KEY (team, id, active_release_number)
        REFERENCES analysis_control.analysis_product_releases(team, product_id, release_number);

ALTER TABLE analysis_control.analysis_product_drafts
    ADD CONSTRAINT fk_analysis_product_draft_base_release
        FOREIGN KEY (team, product_id, base_release_number)
        REFERENCES analysis_control.analysis_product_releases(team, product_id, release_number);

CREATE TABLE analysis_control.analysis_product_audit_events (
    id                 UUID PRIMARY KEY,
    team               VARCHAR(255) NOT NULL,
    product_id         UUID NOT NULL,
    event_number       BIGINT NOT NULL CHECK (event_number > 0),
    event_type         VARCHAR(40) NOT NULL,
    actor_id           TEXT NOT NULL,
    product_version    BIGINT NOT NULL CHECK (product_version > 0),
    draft_id           UUID,
    draft_revision     BIGINT,
    release_number     BIGINT,
    subject_digest     VARCHAR(64),
    previous_state     VARCHAR(32),
    next_state         VARCHAR(32),
    occurred_at        TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_analysis_product_audit_event_number
        UNIQUE (team, product_id, event_number),
    CONSTRAINT fk_analysis_product_audit_product
        FOREIGN KEY (team, product_id)
        REFERENCES analysis_control.analysis_products(team, id),
    CONSTRAINT chk_analysis_product_audit_event_type
        CHECK (event_type IN (
            'PRODUCT_CREATED',
            'DRAFT_UPDATED',
            'DRAFT_VALIDATED',
            'RELEASE_PUBLISHED',
            'RELEASE_DESIRED',
            'RELEASE_ACTIVATED',
            'LIFECYCLE_CHANGED'
        )),
    CONSTRAINT chk_analysis_product_audit_version
        CHECK (event_number = product_version),
    CONSTRAINT chk_analysis_product_audit_draft_revision
        CHECK (
            (draft_id IS NULL AND draft_revision IS NULL) OR
            (draft_id IS NOT NULL AND draft_revision IS NOT NULL AND draft_revision > 0)
        ),
    CONSTRAINT chk_analysis_product_audit_release_number
        CHECK (release_number IS NULL OR release_number > 0),
    CONSTRAINT chk_analysis_product_audit_digest
        CHECK (subject_digest IS NULL OR subject_digest ~ '^[0-9a-f]{64}$'),
    CONSTRAINT chk_analysis_product_audit_previous_state
        CHECK (
            previous_state IS NULL OR
            previous_state IN ('DRAFT', 'ENABLED', 'PAUSED', 'OFFBOARDING', 'DELETED')
        ),
    CONSTRAINT chk_analysis_product_audit_next_state
        CHECK (
            next_state IS NULL OR
            next_state IN ('DRAFT', 'ENABLED', 'PAUSED', 'OFFBOARDING', 'DELETED')
        ),
    CONSTRAINT chk_analysis_product_audit_payload
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
                event_type IN ('RELEASE_PUBLISHED', 'RELEASE_DESIRED', 'RELEASE_ACTIVATED') AND
                draft_id IS NULL AND release_number IS NOT NULL AND subject_digest IS NOT NULL AND
                previous_state IS NULL AND next_state IS NULL
            ) OR (
                event_type = 'LIFECYCLE_CHANGED' AND
                draft_id IS NULL AND release_number IS NULL AND subject_digest IS NULL AND
                previous_state IS NOT NULL AND next_state IS NOT NULL AND
                previous_state <> next_state
            )
        )
);

CREATE INDEX idx_analysis_products_team_state_updated
    ON analysis_control.analysis_products(team, lifecycle_state, updated_at DESC);

CREATE FUNCTION analysis_control.enforce_product_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    product_count INTEGER;
BEGIN
    IF NEW.lifecycle_state = 'DELETED' THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.team = NEW.team AND OLD.lifecycle_state <> 'DELETED' THEN
            RETURN NEW;
        END IF;
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtextextended('analysis-product-limit:' || NEW.team, 0)
    );

    SELECT count(*)
    INTO product_count
    FROM analysis_control.analysis_products
    WHERE team = NEW.team
      AND lifecycle_state <> 'DELETED'
      AND id <> NEW.id;

    IF product_count >= 10 THEN
        RAISE EXCEPTION 'team has reached the analysis product limit'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_analysis_product_limit
BEFORE INSERT OR UPDATE OF team, lifecycle_state
ON analysis_control.analysis_products
FOR EACH ROW
EXECUTE FUNCTION analysis_control.enforce_product_limit();

-- A release keeps the source draft UUID as immutable provenance after the
-- mutable draft row is removed. A permanent FK would prevent that lifecycle,
-- so insertion proves the composite identity and exact validation under row
-- locks instead.
CREATE FUNCTION analysis_control.validate_release_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    product_last_release BIGINT;
    draft_revision BIGINT;
    draft_document JSONB;
    draft_document_hash VARCHAR(64);
    draft_validated_revision BIGINT;
    draft_catalog_revision VARCHAR(128);
    draft_schema_digest VARCHAR(64);
BEGIN
    SELECT
        p.last_release_number,
        d.revision,
        d.document,
        d.document_hash,
        d.validated_revision,
        d.validated_catalog_revision,
        d.validated_base_schema_digest
    INTO
        product_last_release,
        draft_revision,
        draft_document,
        draft_document_hash,
        draft_validated_revision,
        draft_catalog_revision,
        draft_schema_digest
    FROM analysis_control.analysis_products AS p
    JOIN analysis_control.analysis_product_drafts AS d
      ON d.team = p.team AND d.product_id = p.id
    WHERE p.team = NEW.team
      AND p.id = NEW.product_id
      AND d.id = NEW.source_draft_id
    FOR UPDATE OF p, d;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'release source draft does not belong to product'
            USING ERRCODE = '23503';
    END IF;

    IF NEW.release_number <> product_last_release + 1 THEN
        RAISE EXCEPTION 'release number is not the next product release'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.source_draft_revision <> draft_revision OR
       NEW.source_document <> draft_document OR
       NEW.source_document_hash <> draft_document_hash THEN
        RAISE EXCEPTION 'release source does not match the current draft revision'
            USING ERRCODE = '23514';
    END IF;

    IF draft_validated_revision IS NULL OR
       draft_validated_revision <> draft_revision OR
       draft_catalog_revision <> NEW.catalog_revision OR
       draft_schema_digest <> NEW.base_schema_digest THEN
        RAISE EXCEPTION 'release source draft is not validated for this catalog and schema'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_analysis_product_release_validate_insert
BEFORE INSERT
ON analysis_control.analysis_product_releases
FOR EACH ROW
EXECUTE FUNCTION analysis_control.validate_release_insert();

-- Audit rows retain semantic UUID/number references after drafts are replaced.
-- Validate the references at append time instead of using cascading FKs that
-- would either block the lifecycle or erase the audit trail.
CREATE FUNCTION analysis_control.validate_audit_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    current_product_version BIGINT;
    referenced_digest VARCHAR(64);
BEGIN
    SELECT p.row_version
    INTO current_product_version
    FROM analysis_control.analysis_products AS p
    WHERE p.team = NEW.team
      AND p.id = NEW.product_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'audit product does not exist'
            USING ERRCODE = '23503';
    END IF;

    IF NEW.product_version <> current_product_version THEN
        RAISE EXCEPTION 'audit version does not match current product version'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.draft_id IS NOT NULL THEN
        SELECT d.document_hash
        INTO referenced_digest
        FROM analysis_control.analysis_product_drafts AS d
        WHERE d.team = NEW.team
          AND d.product_id = NEW.product_id
          AND d.id = NEW.draft_id
          AND d.revision = NEW.draft_revision;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'audit draft reference does not belong to product revision'
                USING ERRCODE = '23503';
        END IF;

        IF NEW.event_type IN ('PRODUCT_CREATED', 'DRAFT_UPDATED', 'DRAFT_VALIDATED') AND
           NEW.subject_digest IS DISTINCT FROM referenced_digest THEN
            RAISE EXCEPTION 'audit digest does not match referenced draft'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    IF NEW.release_number IS NOT NULL THEN
        SELECT r.publication_specification_digest
        INTO referenced_digest
        FROM analysis_control.analysis_product_releases AS r
        WHERE r.team = NEW.team
          AND r.product_id = NEW.product_id
          AND r.release_number = NEW.release_number;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'audit release reference does not belong to product'
                USING ERRCODE = '23503';
        END IF;

        IF NEW.event_type IN ('RELEASE_PUBLISHED', 'RELEASE_DESIRED', 'RELEASE_ACTIVATED') AND
           NEW.subject_digest IS DISTINCT FROM referenced_digest THEN
            RAISE EXCEPTION 'audit digest does not match referenced release'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_analysis_product_audit_validate_insert
BEFORE INSERT
ON analysis_control.analysis_product_audit_events
FOR EACH ROW
EXECUTE FUNCTION analysis_control.validate_audit_insert();

CREATE FUNCTION analysis_control.reject_history_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME
        USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER trg_analysis_product_release_immutable
BEFORE UPDATE OR DELETE
ON analysis_control.analysis_product_releases
FOR EACH ROW
EXECUTE FUNCTION analysis_control.reject_history_mutation();

CREATE TRIGGER trg_analysis_product_release_truncate_immutable
BEFORE TRUNCATE
ON analysis_control.analysis_product_releases
FOR EACH STATEMENT
EXECUTE FUNCTION analysis_control.reject_history_mutation();

CREATE TRIGGER trg_analysis_product_audit_immutable
BEFORE UPDATE OR DELETE
ON analysis_control.analysis_product_audit_events
FOR EACH ROW
EXECUTE FUNCTION analysis_control.reject_history_mutation();

CREATE TRIGGER trg_analysis_product_audit_truncate_immutable
BEFORE TRUNCATE
ON analysis_control.analysis_product_audit_events
FOR EACH STATEMENT
EXECUTE FUNCTION analysis_control.reject_history_mutation();

REVOKE ALL ON ALL TABLES IN SCHEMA analysis_control FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA analysis_control FROM "esyfo-analyse";
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA analysis_control FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA analysis_control FROM "esyfo-analyse";
