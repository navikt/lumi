-- Immutable, normalized control-plane generations consumed by the future
-- analysis reconciler. The API derives these rows from locked product state
-- and immutable V2 releases; consumers never provide an effective scope.

CREATE SEQUENCE analysis_control.analysis_control_epoch_seq AS BIGINT;

CREATE TABLE analysis_control.analysis_effective_plan_generations (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team                   VARCHAR(255) NOT NULL,
    product_id             UUID NOT NULL,
    generation             BIGINT NOT NULL CHECK (generation > 0),
    control_epoch          BIGINT NOT NULL DEFAULT nextval(
        'analysis_control.analysis_control_epoch_seq'
    ) CHECK (control_epoch > 0),
    product_row_version    BIGINT NOT NULL CHECK (product_row_version > 0),
    plan_kind              VARCHAR(24) NOT NULL,
    lifecycle_state        VARCHAR(32) NOT NULL,
    active_release_number  BIGINT,
    desired_release_number BIGINT,
    data_cutoff_at         TIMESTAMPTZ,
    plan_digest            VARCHAR(64) NOT NULL,
    created_transaction_id BIGINT NOT NULL DEFAULT txid_current(),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_analysis_effective_generation
        UNIQUE (team, product_id, generation),
    CONSTRAINT uq_analysis_effective_control_epoch UNIQUE (control_epoch),
    CONSTRAINT uq_analysis_effective_generation_identity
        UNIQUE (id, team, product_id),
    CONSTRAINT fk_analysis_effective_generation_product
        FOREIGN KEY (team, product_id)
        REFERENCES analysis_control.analysis_products(team, id),
    CONSTRAINT fk_analysis_effective_generation_active_release
        FOREIGN KEY (team, product_id, active_release_number)
        REFERENCES analysis_control.analysis_product_releases(team, product_id, release_number),
    CONSTRAINT fk_analysis_effective_generation_desired_release
        FOREIGN KEY (team, product_id, desired_release_number)
        REFERENCES analysis_control.analysis_product_releases(team, product_id, release_number),
    CONSTRAINT chk_analysis_effective_plan_kind
        CHECK (plan_kind IN ('NONE', 'ENABLED', 'PAUSED', 'OFFBOARDING')),
    CONSTRAINT chk_analysis_effective_lifecycle
        CHECK (lifecycle_state IN ('DRAFT', 'ENABLED', 'PAUSED', 'OFFBOARDING', 'DELETED')),
    CONSTRAINT chk_analysis_effective_plan_digest
        CHECK (plan_digest ~ '^[0-9a-f]{64}$'),
    CONSTRAINT chk_analysis_effective_header_shape
        CHECK (
            (plan_kind = 'NONE' AND lifecycle_state IN ('DRAFT', 'DELETED')) OR
            (plan_kind = 'ENABLED' AND lifecycle_state = 'ENABLED' AND
                active_release_number IS NOT NULL AND data_cutoff_at IS NULL) OR
            (plan_kind = 'PAUSED' AND lifecycle_state = 'PAUSED' AND
                active_release_number IS NOT NULL AND data_cutoff_at IS NOT NULL) OR
            (plan_kind = 'OFFBOARDING' AND lifecycle_state = 'OFFBOARDING')
        ),
    CONSTRAINT chk_analysis_effective_release_order
        CHECK (
            active_release_number IS NULL OR desired_release_number IS NULL OR
            desired_release_number >= active_release_number
        )
);

CREATE TABLE analysis_control.analysis_effective_specs (
    generation_id                  UUID NOT NULL,
    role                           VARCHAR(16) NOT NULL,
    team                           VARCHAR(255) NOT NULL,
    product_id                     UUID NOT NULL,
    target_release_number          BIGINT NOT NULL CHECK (target_release_number > 0),
    upper_allowlist_release_number BIGINT NOT NULL CHECK (upper_allowlist_release_number > 0),
    lifecycle_mode                 VARCHAR(16) NOT NULL,
    retention                      VARCHAR(32) NOT NULL,
    data_cutoff_at                 TIMESTAMPTZ,
    submitted_hour_mode            VARCHAR(16) NOT NULL,
    effective_specification_digest VARCHAR(64) NOT NULL,
    effective_schema_digest        VARCHAR(64) NOT NULL,
    resources                      JSONB NOT NULL,
    PRIMARY KEY (generation_id, role),
    CONSTRAINT fk_analysis_effective_spec_generation
        FOREIGN KEY (generation_id, team, product_id)
        REFERENCES analysis_control.analysis_effective_plan_generations(id, team, product_id),
    CONSTRAINT fk_analysis_effective_spec_target_release
        FOREIGN KEY (team, product_id, target_release_number)
        REFERENCES analysis_control.analysis_product_releases(team, product_id, release_number),
    CONSTRAINT fk_analysis_effective_spec_upper_release
        FOREIGN KEY (team, product_id, upper_allowlist_release_number)
        REFERENCES analysis_control.analysis_product_releases(team, product_id, release_number),
    CONSTRAINT chk_analysis_effective_spec_role
        CHECK (role IN ('MAINTAINED', 'CANDIDATE')),
    CONSTRAINT chk_analysis_effective_spec_lifecycle
        CHECK (lifecycle_mode IN ('ACTIVE', 'PAUSED')),
    CONSTRAINT chk_analysis_effective_spec_retention
        CHECK (retention IN ('SOURCE_MAXIMUM', 'DAYS_30', 'DAYS_90', 'DAYS_180')),
    CONSTRAINT chk_analysis_effective_spec_hour_mode
        CHECK (submitted_hour_mode IN ('INCLUDED', 'NULL_ONLY')),
    CONSTRAINT chk_analysis_effective_spec_digests
        CHECK (
            effective_specification_digest ~ '^[0-9a-f]{64}$' AND
            effective_schema_digest ~ '^[0-9a-f]{64}$'
        ),
    CONSTRAINT chk_analysis_effective_spec_resources
        CHECK (jsonb_typeof(resources) = 'array'),
    CONSTRAINT chk_analysis_effective_spec_cutoff
        CHECK (
            (lifecycle_mode = 'ACTIVE' AND data_cutoff_at IS NULL) OR
            (lifecycle_mode = 'PAUSED' AND data_cutoff_at IS NOT NULL)
        )
);

-- A typed atom table keeps scope membership relational and queryable without
-- storing a nested scope blob. dimension_definition/resources are immutable value
-- metadata; source/field/definition/flow membership remains normalized.
CREATE TABLE analysis_control.analysis_effective_atoms (
    generation_id       UUID NOT NULL,
    spec_role            VARCHAR(16) NOT NULL,
    atom_kind            VARCHAR(24) NOT NULL,
    atom_key             VARCHAR(64) NOT NULL,
    app                  VARCHAR(255),
    survey_id            VARCHAR(255),
    survey_type          VARCHAR(32),
    membership_allowed   BOOLEAN,
    field_id             VARCHAR(200),
    field_mode           VARCHAR(16),
    definition_hash      VARCHAR(64),
    field_presence       VARCHAR(16),
    field_type           VARCHAR(32),
    rating_variant       VARCHAR(32),
    rating_scale         INTEGER,
    max_selections       INTEGER,
    option_id            VARCHAR(200),
    flow_hash            VARCHAR(64),
    evaluator_version    VARCHAR(128),
    dependency_source    VARCHAR(16),
    dependency_key       VARCHAR(255),
    dimension_key        VARCHAR(128),
    dimension_mode       VARCHAR(16),
    dimension_output_id  VARCHAR(128),
    dimension_type       VARCHAR(32),
    dimension_definition JSONB,
    PRIMARY KEY (generation_id, spec_role, atom_kind, atom_key),
    CONSTRAINT fk_analysis_effective_atom_spec
        FOREIGN KEY (generation_id, spec_role)
        REFERENCES analysis_control.analysis_effective_specs(generation_id, role),
    CONSTRAINT chk_analysis_effective_atom_kind
        CHECK (atom_kind IN (
            'SOURCE', 'FIELD', 'DEFINITION', 'DEFINITION_FIELD',
            'OPTION', 'FLOW', 'DEPENDENCY', 'DIMENSION'
        )),
    CONSTRAINT chk_analysis_effective_atom_key
        CHECK (atom_key ~ '^[0-9a-f]{64}$'),
    CONSTRAINT chk_analysis_effective_atom_modes
        CHECK (
            (field_mode IS NULL OR field_mode IN ('INCLUDED', 'NULL_ONLY')) AND
            (dimension_mode IS NULL OR dimension_mode IN ('INCLUDED', 'NULL_ONLY')) AND
            (field_presence IS NULL OR field_presence IN ('PRESENT', 'ABSENT')) AND
            (dependency_source IS NULL OR dependency_source IN ('ANSWER', 'METADATA'))
        ),
    CONSTRAINT chk_analysis_effective_atom_enums
        CHECK (
            (survey_type IS NULL OR survey_type IN (
                'RATING', 'TOP_TASKS', 'DISCOVERY', 'TASK_PRIORITY', 'CUSTOM'
            )) AND
            (field_type IS NULL OR field_type IN ('RATING', 'SINGLE_CHOICE', 'MULTI_CHOICE')) AND
            (rating_variant IS NULL OR rating_variant IN ('EMOJI', 'THUMBS', 'STARS', 'NPS')) AND
            (dimension_type IS NULL OR dimension_type IN (
                'STRING', 'INT64', 'BOOL', 'FLOAT64', 'DATE', 'TIMESTAMP'
            ))
        ),
    CONSTRAINT chk_analysis_effective_atom_hashes
        CHECK (
            (definition_hash IS NULL OR definition_hash ~ '^[0-9a-f]{64}$') AND
            (flow_hash IS NULL OR flow_hash ~ '^[0-9a-f]{64}$')
        ),
    CONSTRAINT chk_analysis_effective_atom_dimension_json
        CHECK (dimension_definition IS NULL OR jsonb_typeof(dimension_definition) = 'object')
);

CREATE INDEX idx_analysis_effective_generations_latest
    ON analysis_control.analysis_effective_plan_generations(team, product_id, generation DESC);

CREATE INDEX idx_analysis_effective_atoms_export_scope
    ON analysis_control.analysis_effective_atoms(
        generation_id, spec_role, atom_kind, app, survey_id, field_id
    );

CREATE UNIQUE INDEX uq_analysis_effective_atom_identity
    ON analysis_control.analysis_effective_atoms(
        generation_id, spec_role, atom_kind,
        app, survey_id, field_id, definition_hash, option_id,
        flow_hash, dependency_source, dependency_key, dimension_key
    ) NULLS NOT DISTINCT;

CREATE FUNCTION analysis_control.validate_effective_generation_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.created_transaction_id <> txid_current() THEN
        RAISE EXCEPTION 'effective generation transaction seal is invalid'
            USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_analysis_effective_generation_validate_insert
BEFORE INSERT
ON analysis_control.analysis_effective_plan_generations
FOR EACH ROW
EXECUTE FUNCTION analysis_control.validate_effective_generation_insert();

CREATE FUNCTION analysis_control.validate_effective_child_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    generation_transaction_id BIGINT;
BEGIN
    SELECT created_transaction_id
    INTO generation_transaction_id
    FROM analysis_control.analysis_effective_plan_generations
    WHERE id = NEW.generation_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'effective generation does not exist'
            USING ERRCODE = '23503';
    END IF;
    IF generation_transaction_id <> txid_current() THEN
        RAISE EXCEPTION 'effective generation is sealed'
            USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_analysis_effective_spec_validate_insert
BEFORE INSERT
ON analysis_control.analysis_effective_specs
FOR EACH ROW
EXECUTE FUNCTION analysis_control.validate_effective_child_insert();

CREATE FUNCTION analysis_control.validate_effective_atom_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    generation_transaction_id BIGINT;
BEGIN
    SELECT created_transaction_id
    INTO generation_transaction_id
    FROM analysis_control.analysis_effective_plan_generations
    WHERE id = NEW.generation_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'effective generation does not exist'
            USING ERRCODE = '23503';
    END IF;
    IF generation_transaction_id <> txid_current() THEN
        RAISE EXCEPTION 'effective generation is sealed'
            USING ERRCODE = '55000';
    END IF;

    IF NOT (
        (NEW.atom_kind = 'SOURCE' AND NEW.app IS NOT NULL AND NEW.survey_id IS NOT NULL AND
            NEW.survey_type IS NOT NULL AND NEW.membership_allowed IS NOT NULL) OR
        (NEW.atom_kind = 'FIELD' AND NEW.app IS NOT NULL AND NEW.survey_id IS NOT NULL AND
            NEW.field_id IS NOT NULL AND NEW.field_mode IS NOT NULL) OR
        (NEW.atom_kind = 'DEFINITION' AND NEW.app IS NOT NULL AND NEW.survey_id IS NOT NULL AND
            NEW.definition_hash IS NOT NULL) OR
        (NEW.atom_kind = 'DEFINITION_FIELD' AND NEW.app IS NOT NULL AND NEW.survey_id IS NOT NULL AND
            NEW.definition_hash IS NOT NULL AND NEW.field_id IS NOT NULL AND NEW.field_presence IS NOT NULL) OR
        (NEW.atom_kind = 'OPTION' AND NEW.app IS NOT NULL AND NEW.survey_id IS NOT NULL AND
            NEW.definition_hash IS NOT NULL AND NEW.field_id IS NOT NULL AND NEW.option_id IS NOT NULL) OR
        (NEW.atom_kind = 'FLOW' AND NEW.app IS NOT NULL AND NEW.survey_id IS NOT NULL AND
            NEW.definition_hash IS NOT NULL AND NEW.flow_hash IS NOT NULL AND NEW.evaluator_version IS NOT NULL) OR
        (NEW.atom_kind = 'DEPENDENCY' AND NEW.app IS NOT NULL AND NEW.survey_id IS NOT NULL AND
            NEW.definition_hash IS NOT NULL AND NEW.flow_hash IS NOT NULL AND NEW.field_id IS NOT NULL AND
            NEW.dependency_source IS NOT NULL AND NEW.dependency_key IS NOT NULL) OR
        (NEW.atom_kind = 'DIMENSION' AND NEW.dimension_key IS NOT NULL AND NEW.dimension_mode IS NOT NULL AND
            NEW.dimension_output_id IS NOT NULL AND NEW.dimension_type IS NOT NULL AND
            NEW.dimension_definition IS NOT NULL)
    ) THEN
        RAISE EXCEPTION 'effective atom shape does not match atom kind'
            USING ERRCODE = '23514';
    END IF;

    IF (CASE NEW.atom_kind
        WHEN 'SOURCE' THEN
            NEW.field_id IS NOT NULL OR NEW.field_mode IS NOT NULL OR NEW.definition_hash IS NOT NULL OR
            NEW.field_presence IS NOT NULL OR NEW.field_type IS NOT NULL OR NEW.rating_variant IS NOT NULL OR
            NEW.rating_scale IS NOT NULL OR NEW.max_selections IS NOT NULL OR NEW.option_id IS NOT NULL OR
            NEW.flow_hash IS NOT NULL OR NEW.evaluator_version IS NOT NULL OR NEW.dependency_source IS NOT NULL OR
            NEW.dependency_key IS NOT NULL OR NEW.dimension_key IS NOT NULL OR NEW.dimension_mode IS NOT NULL OR
            NEW.dimension_output_id IS NOT NULL OR NEW.dimension_type IS NOT NULL OR
            NEW.dimension_definition IS NOT NULL
        WHEN 'FIELD' THEN
            NEW.survey_type IS NOT NULL OR NEW.membership_allowed IS NOT NULL OR NEW.definition_hash IS NOT NULL OR
            NEW.field_presence IS NOT NULL OR NEW.field_type IS NOT NULL OR NEW.rating_variant IS NOT NULL OR
            NEW.rating_scale IS NOT NULL OR NEW.max_selections IS NOT NULL OR NEW.option_id IS NOT NULL OR
            NEW.flow_hash IS NOT NULL OR NEW.evaluator_version IS NOT NULL OR NEW.dependency_source IS NOT NULL OR
            NEW.dependency_key IS NOT NULL OR NEW.dimension_key IS NOT NULL OR NEW.dimension_mode IS NOT NULL OR
            NEW.dimension_output_id IS NOT NULL OR NEW.dimension_type IS NOT NULL OR
            NEW.dimension_definition IS NOT NULL
        WHEN 'DEFINITION' THEN
            NEW.survey_type IS NOT NULL OR NEW.membership_allowed IS NOT NULL OR NEW.field_id IS NOT NULL OR
            NEW.field_mode IS NOT NULL OR NEW.field_presence IS NOT NULL OR NEW.field_type IS NOT NULL OR
            NEW.rating_variant IS NOT NULL OR NEW.rating_scale IS NOT NULL OR NEW.max_selections IS NOT NULL OR
            NEW.option_id IS NOT NULL OR NEW.flow_hash IS NOT NULL OR NEW.evaluator_version IS NOT NULL OR
            NEW.dependency_source IS NOT NULL OR NEW.dependency_key IS NOT NULL OR NEW.dimension_key IS NOT NULL OR
            NEW.dimension_mode IS NOT NULL OR NEW.dimension_output_id IS NOT NULL OR NEW.dimension_type IS NOT NULL OR
            NEW.dimension_definition IS NOT NULL
        WHEN 'DEFINITION_FIELD' THEN
            NEW.survey_type IS NOT NULL OR NEW.membership_allowed IS NOT NULL OR NEW.field_mode IS NOT NULL OR
            NEW.option_id IS NOT NULL OR NEW.flow_hash IS NOT NULL OR NEW.evaluator_version IS NOT NULL OR
            NEW.dependency_source IS NOT NULL OR NEW.dependency_key IS NOT NULL OR NEW.dimension_key IS NOT NULL OR
            NEW.dimension_mode IS NOT NULL OR NEW.dimension_output_id IS NOT NULL OR NEW.dimension_type IS NOT NULL OR
            NEW.dimension_definition IS NOT NULL
        WHEN 'OPTION' THEN
            NEW.survey_type IS NOT NULL OR NEW.membership_allowed IS NOT NULL OR NEW.field_mode IS NOT NULL OR
            NEW.field_presence IS NOT NULL OR NEW.field_type IS NOT NULL OR NEW.rating_variant IS NOT NULL OR
            NEW.rating_scale IS NOT NULL OR NEW.max_selections IS NOT NULL OR NEW.flow_hash IS NOT NULL OR
            NEW.evaluator_version IS NOT NULL OR NEW.dependency_source IS NOT NULL OR NEW.dependency_key IS NOT NULL OR
            NEW.dimension_key IS NOT NULL OR NEW.dimension_mode IS NOT NULL OR NEW.dimension_output_id IS NOT NULL OR
            NEW.dimension_type IS NOT NULL OR NEW.dimension_definition IS NOT NULL
        WHEN 'FLOW' THEN
            NEW.survey_type IS NOT NULL OR NEW.membership_allowed IS NOT NULL OR NEW.field_id IS NOT NULL OR
            NEW.field_mode IS NOT NULL OR NEW.field_presence IS NOT NULL OR NEW.field_type IS NOT NULL OR
            NEW.rating_variant IS NOT NULL OR NEW.rating_scale IS NOT NULL OR NEW.max_selections IS NOT NULL OR
            NEW.option_id IS NOT NULL OR NEW.dependency_source IS NOT NULL OR NEW.dependency_key IS NOT NULL OR
            NEW.dimension_key IS NOT NULL OR NEW.dimension_mode IS NOT NULL OR NEW.dimension_output_id IS NOT NULL OR
            NEW.dimension_type IS NOT NULL OR NEW.dimension_definition IS NOT NULL
        WHEN 'DEPENDENCY' THEN
            NEW.survey_type IS NOT NULL OR NEW.membership_allowed IS NOT NULL OR NEW.field_mode IS NOT NULL OR
            NEW.field_presence IS NOT NULL OR NEW.field_type IS NOT NULL OR NEW.rating_variant IS NOT NULL OR
            NEW.rating_scale IS NOT NULL OR NEW.max_selections IS NOT NULL OR NEW.option_id IS NOT NULL OR
            NEW.evaluator_version IS NOT NULL OR NEW.dimension_key IS NOT NULL OR NEW.dimension_mode IS NOT NULL OR
            NEW.dimension_output_id IS NOT NULL OR NEW.dimension_type IS NOT NULL OR
            NEW.dimension_definition IS NOT NULL
        WHEN 'DIMENSION' THEN
            NEW.app IS NOT NULL OR NEW.survey_id IS NOT NULL OR NEW.survey_type IS NOT NULL OR
            NEW.membership_allowed IS NOT NULL OR NEW.field_id IS NOT NULL OR NEW.field_mode IS NOT NULL OR
            NEW.definition_hash IS NOT NULL OR NEW.field_presence IS NOT NULL OR NEW.field_type IS NOT NULL OR
            NEW.rating_variant IS NOT NULL OR NEW.rating_scale IS NOT NULL OR NEW.max_selections IS NOT NULL OR
            NEW.option_id IS NOT NULL OR NEW.flow_hash IS NOT NULL OR NEW.evaluator_version IS NOT NULL OR
            NEW.dependency_source IS NOT NULL OR NEW.dependency_key IS NOT NULL
        ELSE TRUE
    END) THEN
        RAISE EXCEPTION 'effective atom contains fields outside its atom kind'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.atom_kind = 'DEFINITION_FIELD' THEN
        IF NEW.field_presence = 'ABSENT' AND (
            NEW.field_type IS NOT NULL OR NEW.rating_variant IS NOT NULL OR
            NEW.rating_scale IS NOT NULL OR NEW.max_selections IS NOT NULL
        ) THEN
            RAISE EXCEPTION 'absent effective field contains structural data'
                USING ERRCODE = '23514';
        END IF;
        IF NEW.field_presence = 'PRESENT' AND NEW.field_type IS NULL THEN
            RAISE EXCEPTION 'present effective field lacks a type'
                USING ERRCODE = '23514';
        END IF;
        IF NEW.field_presence = 'PRESENT' AND NOT (
            (NEW.field_type = 'RATING' AND NEW.rating_variant IS NOT NULL AND
                NEW.rating_scale IS NOT NULL AND NEW.max_selections IS NULL) OR
            (NEW.field_type = 'SINGLE_CHOICE' AND NEW.rating_variant IS NULL AND
                NEW.rating_scale IS NULL AND NEW.max_selections IS NULL) OR
            (NEW.field_type = 'MULTI_CHOICE' AND NEW.rating_variant IS NULL AND
                NEW.rating_scale IS NULL AND (NEW.max_selections IS NULL OR NEW.max_selections > 0))
        ) THEN
            RAISE EXCEPTION 'present effective field has invalid structural data'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_analysis_effective_atom_validate_insert
BEFORE INSERT
ON analysis_control.analysis_effective_atoms
FOR EACH ROW
EXECUTE FUNCTION analysis_control.validate_effective_atom_insert();

CREATE FUNCTION analysis_control.validate_effective_generation_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    current_product analysis_control.analysis_products%ROWTYPE;
    maintained_count INTEGER;
    candidate_count INTEGER;
    invalid_count INTEGER;
BEGIN
    SELECT * INTO current_product
    FROM analysis_control.analysis_products
    WHERE team = NEW.team AND id = NEW.product_id;

    IF NOT FOUND OR
       current_product.row_version <> NEW.product_row_version OR
       current_product.lifecycle_state <> NEW.lifecycle_state OR
       current_product.active_release_number IS DISTINCT FROM NEW.active_release_number OR
       current_product.desired_release_number IS DISTINCT FROM NEW.desired_release_number OR
       current_product.data_cutoff_at IS DISTINCT FROM NEW.data_cutoff_at THEN
        RAISE EXCEPTION 'effective generation does not match current product control state'
            USING ERRCODE = '40001';
    END IF;

    SELECT
        count(*) FILTER (WHERE role = 'MAINTAINED'),
        count(*) FILTER (WHERE role = 'CANDIDATE')
    INTO maintained_count, candidate_count
    FROM analysis_control.analysis_effective_specs
    WHERE generation_id = NEW.id;

    IF NEW.plan_kind IN ('NONE', 'OFFBOARDING') THEN
        IF maintained_count <> 0 OR candidate_count <> 0 THEN
            RAISE EXCEPTION 'non-readable effective generation contains specifications'
                USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END IF;

    IF maintained_count <> 1 OR
       candidate_count <> (CASE
           WHEN NEW.plan_kind = 'ENABLED' AND
                NEW.desired_release_number IS DISTINCT FROM NEW.active_release_number AND
                NEW.desired_release_number IS NOT NULL
           THEN 1 ELSE 0
       END) THEN
        RAISE EXCEPTION 'effective generation has invalid specification roles'
            USING ERRCODE = '23514';
    END IF;

    SELECT count(*) INTO invalid_count
    FROM analysis_control.analysis_effective_specs AS spec
    WHERE spec.generation_id = NEW.id
      AND NOT (
          (spec.role = 'MAINTAINED' AND
              spec.target_release_number = NEW.active_release_number AND
              spec.upper_allowlist_release_number = COALESCE(
                  NEW.desired_release_number, NEW.active_release_number
              ) AND
              spec.lifecycle_mode = CASE WHEN NEW.plan_kind = 'PAUSED' THEN 'PAUSED' ELSE 'ACTIVE' END AND
              spec.data_cutoff_at IS NOT DISTINCT FROM NEW.data_cutoff_at) OR
          (spec.role = 'CANDIDATE' AND NEW.plan_kind = 'ENABLED' AND
              spec.target_release_number = NEW.desired_release_number AND
              spec.upper_allowlist_release_number = NEW.desired_release_number AND
              spec.lifecycle_mode = 'ACTIVE' AND spec.data_cutoff_at IS NULL)
      );
    IF invalid_count <> 0 THEN
        RAISE EXCEPTION 'effective specification does not match generation semantics'
            USING ERRCODE = '23514';
    END IF;

    -- Every normalized atom must have its required ancestor. Dependency keys
    -- may only reference data that is explicitly included in the same spec.
    SELECT count(*) INTO invalid_count
    FROM analysis_control.analysis_effective_atoms AS atom
    WHERE atom.generation_id = NEW.id
      AND (
        (atom.atom_kind IN ('FIELD', 'DEFINITION') AND NOT EXISTS (
            SELECT 1 FROM analysis_control.analysis_effective_atoms AS source
            WHERE source.generation_id = atom.generation_id AND source.spec_role = atom.spec_role
              AND source.atom_kind = 'SOURCE' AND source.app = atom.app AND source.survey_id = atom.survey_id
        )) OR
        (atom.atom_kind IN ('DEFINITION_FIELD', 'FLOW') AND NOT EXISTS (
            SELECT 1 FROM analysis_control.analysis_effective_atoms AS definition
            WHERE definition.generation_id = atom.generation_id AND definition.spec_role = atom.spec_role
              AND definition.atom_kind = 'DEFINITION' AND definition.app = atom.app
              AND definition.survey_id = atom.survey_id AND definition.definition_hash = atom.definition_hash
        )) OR
        (atom.atom_kind = 'DEFINITION_FIELD' AND NOT EXISTS (
            SELECT 1 FROM analysis_control.analysis_effective_atoms AS selected_field
            WHERE selected_field.generation_id = atom.generation_id
              AND selected_field.spec_role = atom.spec_role AND selected_field.atom_kind = 'FIELD'
              AND selected_field.app = atom.app AND selected_field.survey_id = atom.survey_id
              AND selected_field.field_id = atom.field_id AND selected_field.field_mode = 'INCLUDED'
        )) OR
        (atom.atom_kind = 'OPTION' AND NOT EXISTS (
            SELECT 1 FROM analysis_control.analysis_effective_atoms AS field
            WHERE field.generation_id = atom.generation_id AND field.spec_role = atom.spec_role
              AND field.atom_kind = 'DEFINITION_FIELD' AND field.app = atom.app
              AND field.survey_id = atom.survey_id AND field.definition_hash = atom.definition_hash
              AND field.field_id = atom.field_id AND field.field_presence = 'PRESENT'
        )) OR
        (atom.atom_kind = 'DEPENDENCY' AND NOT EXISTS (
            SELECT 1 FROM analysis_control.analysis_effective_atoms AS flow
            WHERE flow.generation_id = atom.generation_id AND flow.spec_role = atom.spec_role
              AND flow.atom_kind = 'FLOW' AND flow.app = atom.app AND flow.survey_id = atom.survey_id
              AND flow.definition_hash = atom.definition_hash AND flow.flow_hash = atom.flow_hash
        )) OR
        (atom.atom_kind = 'DEPENDENCY' AND NOT EXISTS (
            SELECT 1 FROM analysis_control.analysis_effective_atoms AS dependency_field
            WHERE dependency_field.generation_id = atom.generation_id
              AND dependency_field.spec_role = atom.spec_role
              AND dependency_field.atom_kind = 'DEFINITION_FIELD'
              AND dependency_field.app = atom.app AND dependency_field.survey_id = atom.survey_id
              AND dependency_field.definition_hash = atom.definition_hash
              AND dependency_field.field_id = atom.field_id AND dependency_field.field_presence = 'PRESENT'
        )) OR
        (atom.atom_kind = 'DEPENDENCY' AND atom.dependency_source = 'ANSWER' AND NOT EXISTS (
            SELECT 1 FROM analysis_control.analysis_effective_atoms AS selected_field
            WHERE selected_field.generation_id = atom.generation_id
              AND selected_field.spec_role = atom.spec_role AND selected_field.atom_kind = 'FIELD'
              AND selected_field.app = atom.app AND selected_field.survey_id = atom.survey_id
              AND selected_field.field_id = atom.dependency_key AND selected_field.field_mode = 'INCLUDED'
        )) OR
        (atom.atom_kind = 'DEPENDENCY' AND atom.dependency_source = 'METADATA' AND NOT EXISTS (
            SELECT 1 FROM analysis_control.analysis_effective_atoms AS dimension
            WHERE dimension.generation_id = atom.generation_id
              AND dimension.spec_role = atom.spec_role AND dimension.atom_kind = 'DIMENSION'
              AND dimension.dimension_key = atom.dependency_key AND dimension.dimension_mode = 'INCLUDED'
        ))
      );
    IF invalid_count <> 0 THEN
        RAISE EXCEPTION 'effective generation contains an orphaned or hidden-scope atom'
            USING ERRCODE = '23514';
    END IF;

    SELECT count(*) INTO invalid_count
    FROM analysis_control.analysis_effective_atoms AS field
    WHERE field.generation_id = NEW.id AND field.atom_kind = 'DEFINITION_FIELD'
      AND field.field_presence = 'PRESENT'
      AND NOT (
          (field.field_type = 'RATING' AND NOT EXISTS (
              SELECT 1 FROM analysis_control.analysis_effective_atoms AS option
              WHERE option.generation_id = field.generation_id AND option.spec_role = field.spec_role
                AND option.atom_kind = 'OPTION' AND option.app = field.app AND option.survey_id = field.survey_id
                AND option.definition_hash = field.definition_hash AND option.field_id = field.field_id
          )) OR
          (field.field_type IN ('SINGLE_CHOICE', 'MULTI_CHOICE') AND (
              SELECT count(*) FROM analysis_control.analysis_effective_atoms AS option
              WHERE option.generation_id = field.generation_id AND option.spec_role = field.spec_role
                AND option.atom_kind = 'OPTION' AND option.app = field.app AND option.survey_id = field.survey_id
                AND option.definition_hash = field.definition_hash AND option.field_id = field.field_id
          ) > 0 AND (
              field.max_selections IS NULL OR field.max_selections <= (
                  SELECT count(*) FROM analysis_control.analysis_effective_atoms AS option
                  WHERE option.generation_id = field.generation_id AND option.spec_role = field.spec_role
                    AND option.atom_kind = 'OPTION' AND option.app = field.app
                    AND option.survey_id = field.survey_id AND option.definition_hash = field.definition_hash
                    AND option.field_id = field.field_id
              )
          ))
      );
    IF invalid_count <> 0 THEN
        RAISE EXCEPTION 'effective definition field has an invalid option set'
            USING ERRCODE = '23514';
    END IF;

    SELECT count(*) INTO invalid_count
    FROM analysis_control.analysis_effective_atoms AS source
    WHERE source.generation_id = NEW.id AND source.atom_kind = 'SOURCE'
      AND source.membership_allowed IS DISTINCT FROM EXISTS (
          SELECT 1 FROM analysis_control.analysis_effective_atoms AS flow
          WHERE flow.generation_id = source.generation_id AND flow.spec_role = source.spec_role
            AND flow.atom_kind = 'FLOW' AND flow.app = source.app AND flow.survey_id = source.survey_id
      );
    IF invalid_count <> 0 THEN
        RAISE EXCEPTION 'effective source membership does not match its exact flow scope'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_analysis_effective_generation_complete
AFTER INSERT
ON analysis_control.analysis_effective_plan_generations
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION analysis_control.validate_effective_generation_complete();

CREATE TRIGGER trg_analysis_effective_generation_immutable
BEFORE UPDATE OR DELETE
ON analysis_control.analysis_effective_plan_generations
FOR EACH ROW
EXECUTE FUNCTION analysis_control.reject_history_mutation();

CREATE TRIGGER trg_analysis_effective_generation_truncate_immutable
BEFORE TRUNCATE
ON analysis_control.analysis_effective_plan_generations
FOR EACH STATEMENT
EXECUTE FUNCTION analysis_control.reject_history_mutation();

CREATE TRIGGER trg_analysis_effective_spec_immutable
BEFORE UPDATE OR DELETE
ON analysis_control.analysis_effective_specs
FOR EACH ROW
EXECUTE FUNCTION analysis_control.reject_history_mutation();

CREATE TRIGGER trg_analysis_effective_spec_truncate_immutable
BEFORE TRUNCATE
ON analysis_control.analysis_effective_specs
FOR EACH STATEMENT
EXECUTE FUNCTION analysis_control.reject_history_mutation();

CREATE TRIGGER trg_analysis_effective_atom_immutable
BEFORE UPDATE OR DELETE
ON analysis_control.analysis_effective_atoms
FOR EACH ROW
EXECUTE FUNCTION analysis_control.reject_history_mutation();

CREATE TRIGGER trg_analysis_effective_atom_truncate_immutable
BEFORE TRUNCATE
ON analysis_control.analysis_effective_atoms
FOR EACH STATEMENT
EXECUTE FUNCTION analysis_control.reject_history_mutation();

REVOKE ALL ON analysis_control.analysis_effective_plan_generations FROM PUBLIC;
REVOKE ALL ON analysis_control.analysis_effective_specs FROM PUBLIC;
REVOKE ALL ON analysis_control.analysis_effective_atoms FROM PUBLIC;
REVOKE ALL ON analysis_control.analysis_effective_plan_generations FROM "esyfo-analyse";
REVOKE ALL ON analysis_control.analysis_effective_specs FROM "esyfo-analyse";
REVOKE ALL ON analysis_control.analysis_effective_atoms FROM "esyfo-analyse";
REVOKE ALL ON SEQUENCE analysis_control.analysis_control_epoch_seq FROM PUBLIC;
REVOKE ALL ON SEQUENCE analysis_control.analysis_control_epoch_seq FROM "esyfo-analyse";
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA analysis_control FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA analysis_control FROM "esyfo-analyse";
