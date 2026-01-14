---
name: flyway-migration
description: Database migration patterns using Flyway with versioned SQL scripts
---

# Flyway Migration Skill

This skill provides patterns for managing database schema changes with Flyway.

## Migration File Naming

```text
db/migration/V{version}__{description}.sql
```

Examples:

- `V1__Initial_schema.sql`
- `V2__Text_themes.sql`
- `V3__add_star_column.sql`

## Creating Tables

```sql
-- V1__Initial_schema.sql

CREATE TABLE IF NOT EXISTS feedback
(
    id            VARCHAR DEFAULT gen_random_uuid() PRIMARY KEY,
    opprettet     TIMESTAMPTZ NOT NULL,
    feedback_json TEXT NOT NULL,
    team          VARCHAR(255) NOT NULL,
    app           VARCHAR(255) NOT NULL,
    tags          TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_opprettet ON feedback(opprettet);
CREATE INDEX IF NOT EXISTS idx_feedback_team ON feedback(team);
CREATE INDEX IF NOT EXISTS idx_feedback_team_app ON feedback(team, app);
```

## Adding Columns

```sql
-- V3__add_star_column.sql
ALTER TABLE feedback ADD COLUMN stjerne BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_feedback_stjerne ON feedback(stjerne);
```

## Best Practices

1. **Never modify existing migrations**: Create a new migration instead
2. **Prefer simple transactional migrations**
3. **Keep migrations small**: One logical change per migration
