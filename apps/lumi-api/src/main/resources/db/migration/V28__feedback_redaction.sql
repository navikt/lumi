-- Keys and audit metadata are private: the legacy analysis role has broad
-- SELECT/default grants in public. No original text or text hash is retained.
CREATE SCHEMA feedback_redaction;
REVOKE ALL ON SCHEMA feedback_redaction FROM PUBLIC;
REVOKE ALL ON SCHEMA feedback_redaction FROM "esyfo-analyse";

CREATE TABLE feedback_redaction.team_state
(
    team          VARCHAR(255) PRIMARY KEY,
    generation    BIGINT NOT NULL DEFAULT 0 CHECK (generation >= 0),
    actor_key     BYTEA NOT NULL CHECK (octet_length(actor_key) = 32)
);

CREATE TABLE feedback_redaction.events
(
    team          VARCHAR(255) NOT NULL REFERENCES feedback_redaction.team_state(team),
    generation    BIGINT NOT NULL,
    feedback_id   VARCHAR(255) NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
    field_id      VARCHAR(255) NOT NULL,
    actor         VARCHAR(64) NOT NULL,
    occurred_at   TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (team, generation)
);
CREATE INDEX feedback_redaction_events_feedback_id ON feedback_redaction.events(feedback_id);

REVOKE ALL ON ALL TABLES IN SCHEMA feedback_redaction FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA feedback_redaction FROM "esyfo-analyse";
