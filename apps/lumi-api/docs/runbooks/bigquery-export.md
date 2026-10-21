# BigQuery export

Lumi copies a team's survey responses into a BigQuery dataset in the team's own GCP
project ([ADR 0007](../../../../docs/adr/0007-teameid-bigquery-eksport.md)). The team
creates the dataset, labels it `lumi-team=<team>` and grants Lumi's service account
`roles/bigquery.dataEditor` on that dataset only. Lumi writes the tables `svar`,
`innsendinger` and, when the team has turned it on, `fritekst`. The team guide is
[BigQuery og Metabase](../../../../docs/dashboard/bigquery.md).

## How it runs

- `LUMI_BIGQUERY_EXPORT_ENABLED=true` turns the export on. A missing or false value
  turns it off: the dashboard shows the export as unavailable and no runs start.
- `LUMI_BIGQUERY_EXPORT_PILOT_TEAMS` is an optional comma-separated list. When it is set,
  only those teams can set up or run an export. Teams outside the list can still stop
  an export they already have.
- `LUMI_BIGQUERY_EXPORT_FREE_TEXT_TEAMS` lists the teams that may export free text, or
  `*` for every team. When it is unset, no team can. Production leaves it unset until a
  team's PVK covers free text in BigQuery. A team that loses access keeps its export, but
  the next run deletes its `fritekst` table.
- Load jobs run in Lumi's team project (`GCP_TEAM_PROJECT_ID`, falling back to
  `GOOGLE_CLOUD_PROJECT`; Nais sets both). The manifests grant `roles/bigquery.jobUser`
  there through `gcp.permissions`. No dataset roles are granted by the manifest.
- Every replica polls every 30 seconds. The PostgreSQL advisory lock `7316244190552`
  lets only one replica export at a time. Teams run one after another, and a run that
  takes more than 30 minutes is stopped and counted as failed.
- A run holds one connection from the main pool: the snapshot runs on the connection
  that holds the lock. Status updates borrow a second connection for a moment. With the
  small pool in dev, the dashboard can still wait for a connection while a run reads.
- Each destination is exported once a night after 01:00 Norwegian time, which is
  outside the Cloud SQL maintenance window. Saving settings, choosing
  **Oppdater tabellene nå** or deleting responses in the dashboard queues a run. A queued
  run starts at most once per five minutes per team. A failed run is retried after one
  hour, then after twice as long each time, up to 24 hours.
- A run still marked as running when a replica takes the lock was cut off, for example
  by a pod restart. It is counted as a failed run with `INTERNAL_ERROR`, so the backoff
  applies instead of an immediate retry. A run someone requested in the meantime still
  starts, at most once per five minutes.
- Before every run, Lumi checks that the project is the team's own in Nais API
  (cached for an hour), that Lumi may run jobs in its own project (a dry-run query), and
  that the dataset label, the location (`europe-north1`), the time travel window and the
  tables match. When a check cannot be made, for example because Nais API does not
  answer, nothing is written.
- A run reads the team's responses inside the 12-month window in one `REPEATABLE READ`
  snapshot and streams them to BigQuery with resumable uploads. Missing tables are
  created first, with labels and an expiry. Each load job then replaces the rows of one
  table with `WRITE_TRUNCATE`, and an empty table is emptied with `TRUNCATE TABLE`.
  Neither deletes the table, so the access teams have granted on it stays.
- Tables are replaced one at a time: `fritekst`, `innsendinger`, `svar`. A run that fails
  halfway leaves tables from different runs until the next run. `oppdatert_tidspunkt`
  shows which run wrote each table.
- Every time Lumi writes a table, it sets the table to expire seven days later. If
  exports stop for any reason, the copies disappear on their own. When a table is
  deleted or expires, the access granted on it on Datamarkedsplassen goes with it. If a
  table stays missing for seven days, Datamarkedsplassen removes the dataset and its
  Metabase database.
- Lumi only overwrites or deletes tables labelled `lumi-eksport` and `lumi-team=<team>`.
  When a team saves a new destination, the dataset must hold only Lumi's tables (views
  are allowed). Turning free text off needs no checks, so it works even when BigQuery or
  Nais API has problems.

## Problem codes

The dashboard shows these codes to the team. Codes marked *Team* need the team to
change something in its own project. Lumi retries them, but they keep failing until the
team acts.

| Code | Meaning | Who acts |
| --- | --- | --- |
| `PROJECT_NOT_TEAM_PROJECT` | The project is not the team's own project in Nais | Team |
| `DATASET_NOT_FOUND` | The dataset does not exist | Team |
| `DATASET_ACCESS_DENIED` | Lumi's service account cannot read the dataset | Team |
| `DATASET_WRONG_LOCATION` | The dataset is not in `europe-north1` | Team |
| `DATASET_TEAM_LABEL_MISSING` / `_MISMATCH` | The `lumi-team` label is missing or names another team | Team |
| `TABLE_WRITE_DENIED` | Lumi cannot create, load or empty tables in the dataset | Team |
| `TABLE_NOT_CREATED_BY_LUMI` | A table with one of Lumi's names exists without Lumi's labels | Team |
| `DATASET_NOT_DEDICATED` | The dataset holds tables Lumi did not create (checked when saving) | Team |
| `DATASET_TIME_TRAVEL_TOO_LONG` | The dataset keeps deleted rows for more than 48 hours | Team |
| `TEAM_PROJECT_UNKNOWN` | Nais API did not answer, so the project could not be checked | Lumi |
| `EXPORT_JOB_DENIED` | Lumi may not run jobs in its own project | Lumi |
| `BIGQUERY_UNAVAILABLE` | BigQuery or the metadata server did not answer | Lumi |
| `LOAD_FAILED` | A load job, a `TRUNCATE` job or a metadata update failed | Lumi |
| `INTERNAL_ERROR` | An unexpected exception, a run over 30 minutes or an interrupted run | Lumi |

## Alerts

- `LumiBigQueryExportFailure` fires on two or more runs within three hours that failed
  with a code marked *Lumi* above.
- `LumiBigQueryExportStale` fires when a team's tables are more than 30 hours old,
  unless the team's latest run failed on something the team has to fix. The alert names
  the team in the label `lumi_team`, because Nais sets `team` on every series.
- `LumiBigQueryExportSchedulerStopped` fires when no replica has polled for ten minutes
  while the export is enabled.

Search the `lumi-api` logs for `BigQuery export` with the team name. The log lines name
the team, the table, the HTTP status and the BigQuery error reason, and for failed jobs
the job id. They never contain response data. To see the full error of a job, look it up
in Lumi's team project:

```sql
SELECT job_id, creation_time, state, error_result.reason, error_result.message
FROM `region-europe-north1`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE job_id = 'lumi_export_svar_…'
```

The message can quote values from the rows, so do not copy it into issues or chats.

Typical causes:

1. `EXPORT_JOB_DENIED`: the workload identity or `roles/bigquery.jobUser` is missing
   after a manifest change, or Config Connector has not reconciled the `IAMPolicyMember`
   yet. Check that the `IAMPolicyMember` for `lumi-api` exists in the namespace and is
   ready.
2. `TEAM_PROJECT_UNKNOWN`: Nais API is down or Lumi's token for it does not work. Runs
   are retried with backoff.
3. BigQuery throttling or an outage. The run is retried automatically.
4. A schema change in Lumi that the existing tables cannot take. Columns may only be
   added, as `NULLABLE`. A breaking change needs a new table name, see ADR 0007.

## Requests to delete data at once

Deleting a response in the dashboard queues a run, so the copy follows within a few
minutes when the run succeeds. A team can also choose **Oppdater tabellene nå**.
BigQuery keeps time travel for 48 hours on the dataset, and Google keeps fail-safe data
for seven more days. Copies the team has made in Metabase, notebooks or data stories are
the team's responsibility.

## Emergency stop

To stop all exports without a deploy, hold the export lock from a database session. Every
replica then skips the export until the session ends:

```sql
SELECT pg_advisory_lock(7316244190552);
-- Keep this session open. End it, or run SELECT pg_advisory_unlock(7316244190552), to resume.
```

A run that is already in progress finishes first, and load jobs already sent to BigQuery
complete on Google's side.

To turn the export off for good, set `LUMI_BIGQUERY_EXPORT_ENABLED` to `false` in the
manifest and deploy. The tables in the teams' projects then expire within seven days.
**Stopp eksporten** cannot delete tables while the flag is off, so ask the teams to stop
the export first if the tables must go sooner.

To find every table Lumi has written in a team's project, run in that project:

```sql
SELECT table_schema, table_name, option_value
FROM `region-europe-north1`.INFORMATION_SCHEMA.TABLE_OPTIONS
WHERE option_name = 'labels' AND option_value LIKE '%lumi-eksport%'
```

## Metrics

- `lumi_bigquery_export_runs_total{outcome,reason}` counts succeeded and failed runs.
- `lumi_bigquery_export_rows_total{table}` counts rows written per table.
- `lumi_bigquery_export_destination_last_success_timestamp_seconds{lumi_team}` is the
  team's latest successful run, or the latest change of its settings if no run has
  succeeded since. It is read from the database on every poll, so it survives restarts.
  Only teams the export is open for are reported.
- `lumi_bigquery_export_destination_consecutive_failures{lumi_team}` counts failed runs in
  a row.
- `lumi_bigquery_export_destination_team_action_needed{lumi_team}` is 1 when the team's
  latest run failed on something the team has to fix.
- `lumi_bigquery_export_scheduler_heartbeat_timestamp_seconds` is the latest poll on the
  instance.
- `lumi_bigquery_export_last_success_timestamp_seconds` is the latest successful run on
  the instance.
- `lumi_bigquery_export_enabled` is 1 when the export is on.

## Checking a new environment

Production stays off (`LUMI_BIGQUERY_EXPORT_ENABLED=false` in `nais/app/prod.yaml`) until
these steps pass in dev. Turning it on in production is a one-line change to `"true"`.

1. Deploy to dev and open **Eksporter → BigQuery-eksport** in the dev dashboard. The page
   shows Lumi's service account. It comes from the metadata server; if it is missing,
   workload identity does not work for the pod. Also check that the page suggests your
   team's dev project: that shows that Nais API returns the team's `gcpProjectID` for
   the environment.
2. Create a dataset in your team's dev project with the SQL from the page, choose
   **Sjekk tilkoblingen** and then **Start eksporten**.
3. Confirm that `svar` and `innsendinger` appear with labels and an expiry, that the row
   counts in the dashboard match the tables, and that no `failed` runs were recorded.
4. Grant a colleague `roles/bigquery.dataViewer` on `svar`, choose
   **Oppdater tabellene nå**, and check that the grant is still there after the run. Then
   delete all responses of a test survey and check that the run empties the table and
   keeps the grant.
