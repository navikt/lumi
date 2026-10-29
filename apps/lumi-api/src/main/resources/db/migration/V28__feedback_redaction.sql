-- Only a cache generation per team is retained, without text or actor history.
CREATE SCHEMA feedback_redaction;
REVOKE ALL ON SCHEMA feedback_redaction FROM PUBLIC;
REVOKE ALL ON SCHEMA feedback_redaction FROM "esyfo-analyse";

CREATE TABLE feedback_redaction.team_state
(
    team          VARCHAR(255) PRIMARY KEY,
    generation    BIGINT NOT NULL DEFAULT 0 CHECK (generation >= 0)
);

REVOKE ALL ON ALL TABLES IN SCHEMA feedback_redaction FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA feedback_redaction FROM "esyfo-analyse";
