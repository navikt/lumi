-- Team-scoped markers for rating trend annotations
-- Used to highlight notable events on specific dates per survey

CREATE TABLE IF NOT EXISTS rating_marker (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team        VARCHAR(255) NOT NULL,
    survey_id   VARCHAR(255) NOT NULL,
    marker_date DATE         NOT NULL,
    label       VARCHAR(80)  NOT NULL,
    description VARCHAR(500),
    color       VARCHAR(7),
    created_by  TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rating_marker_team_survey
    ON rating_marker(team, survey_id);

CREATE INDEX IF NOT EXISTS idx_rating_marker_team_survey_date
    ON rating_marker(team, survey_id, marker_date);
