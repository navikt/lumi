-- BigQuery-eksport til teamets eget datasett (ADR 0007).
--
-- Tabellen ligger i et eget skjema. V9 gir esyfo-analyse SELECT og default
-- privileges i public, og denne tabellen har pseudonymnøkkelen per team.

CREATE SCHEMA bigquery_export;
REVOKE ALL ON SCHEMA bigquery_export FROM PUBLIC;
REVOKE ALL ON SCHEMA bigquery_export FROM "esyfo-analyse";

CREATE TABLE bigquery_export.destinations
(
    team                 VARCHAR(255) PRIMARY KEY,
    project_id           VARCHAR(30)  NOT NULL,
    dataset_id           VARCHAR(100) NOT NULL,
    include_free_text    BOOLEAN      NOT NULL DEFAULT FALSE,
    pseudonym_key        BYTEA        NOT NULL,
    created_by           TEXT         NOT NULL,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT clock_timestamp(),
    updated_by           TEXT         NOT NULL,
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT clock_timestamp(),
    run_requested_at     TIMESTAMPTZ  NULL,
    last_run_started_at  TIMESTAMPTZ  NULL,
    last_run_finished_at TIMESTAMPTZ  NULL,
    last_run_status      VARCHAR(16)  NULL,
    last_run_error_code  VARCHAR(64)  NULL,
    consecutive_failures INTEGER      NOT NULL DEFAULT 0,
    last_success_at      TIMESTAMPTZ  NULL,
    last_success_rows    JSONB        NULL,
    -- Load and TRUNCATE jobs Lumi has started but not seen finish. A new run waits for
    -- them, so a late job cannot replace newer data.
    pending_job_ids      TEXT[]       NOT NULL DEFAULT '{}',
    -- Set when the team stops the export. Nothing more runs, and Lumi deletes the row
    -- under the export lock once every pending job is done and the tables are gone.
    stop_requested_at    TIMESTAMPTZ  NULL,
    stop_attempted_at    TIMESTAMPTZ  NULL,
    CONSTRAINT bigquery_export_destinations_project_id_format
        CHECK (project_id ~ '^[a-z][a-z0-9-]{4,28}[a-z0-9]$'),
    CONSTRAINT bigquery_export_destinations_dataset_id_format
        CHECK (dataset_id ~ '^[A-Za-z0-9_]{1,100}$'),
    CONSTRAINT bigquery_export_destinations_pseudonym_key_length
        CHECK (octet_length(pseudonym_key) = 32),
    CONSTRAINT bigquery_export_destinations_run_status
        CHECK (last_run_status IS NULL OR last_run_status IN ('RUNNING', 'SUCCEEDED', 'FAILED')),
    CONSTRAINT bigquery_export_destinations_error_code
        CHECK (last_run_error_code IS NULL OR last_run_error_code ~ '^[A-Z_]{1,64}$'),
    CONSTRAINT bigquery_export_destinations_consecutive_failures
        CHECK (consecutive_failures >= 0)
);

-- The latest run start per team. It stays when the team moves or stops the export, so
-- the five minutes between runs cannot be skipped by saving or by stopping and starting.
CREATE TABLE bigquery_export.team_runs
(
    team                VARCHAR(255) PRIMARY KEY,
    last_run_started_at TIMESTAMPTZ  NOT NULL
);

REVOKE ALL ON ALL TABLES IN SCHEMA bigquery_export FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA bigquery_export FROM "esyfo-analyse";
