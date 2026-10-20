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
- Load jobs run in Lumi's team project (`GCP_TEAM_PROJECT_ID`, falling back to
  `GOOGLE_CLOUD_PROJECT`). The manifests grant `roles/bigquery.jobUser` there through
  `gcp.permissions`. No dataset roles are granted by the manifest.
- Every replica polls every 30 seconds. The PostgreSQL advisory lock `7316244190552`
  lets only one replica export at a time.
- Each destination is exported once a night after 01:00 Norwegian time, which is
  outside the Cloud SQL maintenance window. Saving settings or choosing **Oppdater nå**
  starts a run at once. A failed run is retried after one hour, then after twice as long
  each time, up to 24 hours.
- A run reads the team's responses inside the 12-month window in one `REPEATABLE READ`
  snapshot and streams them to BigQuery with resumable uploads. Each table is replaced
  with `WRITE_TRUNCATE` when its load job completes, so a failed run leaves the previous
  tables as they were.
- Every successful run sets the tables to expire seven days later. If exports stop for
  any reason, the copies disappear on their own.
- Lumi only overwrites or deletes tables labelled `lumi-eksport`. It refuses to write
  when the dataset label, the location (`europe-north1`) or the project does not match
  the team. The project is checked against Nais API on every run.

## Problem codes

The dashboard shows these codes to the team. The first eight need the team to change
something in its own project. Lumi retries them, but they will keep failing until the
team acts.

| Code | Meaning | Who acts |
| --- | --- | --- |
| `PROJECT_NOT_TEAM_PROJECT` | The project is not the team's own project in Nais | Team |
| `DATASET_NOT_FOUND` | The dataset does not exist | Team |
| `DATASET_ACCESS_DENIED` | Lumi's service account cannot read the dataset | Team |
| `DATASET_WRONG_LOCATION` | The dataset is not in `europe-north1` | Team |
| `DATASET_TEAM_LABEL_MISSING` / `_MISMATCH` | The `lumi-team` label is missing or names another team | Team |
| `TABLE_WRITE_DENIED` | Lumi cannot create or load tables | Team |
| `TABLE_NOT_CREATED_BY_LUMI` | A table with one of Lumi's names exists without Lumi's label | Team |
| `BIGQUERY_UNAVAILABLE` | BigQuery or the metadata server did not answer | Lumi |
| `LOAD_FAILED` | A load job or a metadata update failed | Lumi |
| `INTERNAL_ERROR` | An unexpected exception during the run | Lumi |

## Alerts

`LumiBigQueryExportFailure` fires when a run fails with `BIGQUERY_UNAVAILABLE`,
`LOAD_FAILED` or `INTERNAL_ERROR`. Search the `lumi-api` logs for
`BigQuery export failed for team`, `BigQuery load for team` and
`BigQuery metadata update for team`. The log lines name the team, the table and the
BigQuery error reason. They never contain response data.

Typical causes:

1. The workload identity or `roles/bigquery.jobUser` is missing after a manifest change.
   Check that the `IAMPolicyMember` for `lumi-api` exists in the namespace.
2. BigQuery throttling or an outage. The run is retried automatically.
3. A schema change in Lumi that the existing tables cannot take. Columns may only be
   added. A breaking change needs a new table name, see ADR 0007.

## Requests to delete data at once

The tables are replaced on every run. When a team has deleted a response in the
dashboard and needs the copy gone before the nightly run, they choose **Oppdater nå**.
BigQuery keeps time travel for 48 hours on datasets created with the recommended SQL,
and Google keeps fail-safe data for seven more days. Copies the team has made in
Metabase, notebooks or data stories are the team's responsibility.

## Emergency stop

Set `LUMI_BIGQUERY_EXPORT_ENABLED` to `false` in the manifest and deploy. Runs stop at
once, and the tables in the teams' projects expire within seven days. To remove them
sooner, ask the team to choose **Stopp eksporten** before the flag is turned off, or
delete the tables labelled `lumi-eksport` in their dataset.

## Metrics

- `lumi_bigquery_export_runs_total{outcome,reason}` counts succeeded and failed runs.
- `lumi_bigquery_export_rows_total{table}` counts rows written per table.
- `lumi_bigquery_export_last_success_timestamp_seconds` is the latest successful run on
  the instance.
- `lumi_bigquery_export_enabled` is 1 when the export is on.

## Checking a new environment

1. Deploy to dev and open **Eksporter → BigQuery og Metabase** in the dev dashboard.
   The page shows Lumi's service account. It comes from the metadata server; if it is
   missing, workload identity does not work for the pod.
2. Create a dataset in your team's dev project with the SQL from the page, choose
   **Sjekk tilkoblingen** and then **Start eksporten**.
3. Confirm that `svar` and `innsendinger` appear, that the row counts in the dashboard
   match the tables, and that no `failed` runs were recorded.
