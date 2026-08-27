# Automatic retention

Lumi deletes stored survey responses when their server-side creation timestamp is
older than 12 months. When `LUMI_RETENTION_ENABLED=true`, every API instance starts
the daily cleanup loop, while a PostgreSQL advisory lock ensures that only one
instance performs cleanup at a time. The setting is fail-closed: a missing or false
value disables deletion.

Each run deletes at most 500 of the oldest eligible responses. Later daily runs
continue with the remaining rows. This limit bounds the impact of one run and must
not be increased without checking production volume and query performance first.

Production is initially deployed with cleanup disabled. Enable it in a separate,
controlled manifest change after verifying the migration, metrics, eligible-row
count, query plan, and database recovery readiness.

## Alerts

`LumiRetentionCleanupFailure` means a cleanup attempt failed. Inspect the
`lumi-api` logs for `Automatic retention failed`, confirm database availability,
and verify that the next run completes.

`LumiRetentionCleanupStale` means no instance has reported a successful cleanup
for more than 36 hours while retention is enabled. Check whether the application
has restarted repeatedly, whether Prometheus is scraping `/internal/prometheus`,
and whether one instance can acquire a database connection and the retention lock.

## Metrics

- `lumi_retention_runs_total{outcome}` counts executed, skipped, and failed runs.
- `lumi_retention_deleted_feedback_total` counts deleted response rows.
- `lumi_retention_last_success_timestamp_seconds` records the latest successful
  run. The stale alert evaluates 36 hours of gauge history so pod restarts do
  not erase the signal, and separately detects a missing metric series.
- `lumi_retention_enabled` is `1` when deletion is enabled for an instance and
  `0` when it is disabled. The stale alert is inactive while all instances are
  disabled.

A skipped run is expected on instances that do not acquire the lock. It is not an
error as long as another instance reports an executed run.
