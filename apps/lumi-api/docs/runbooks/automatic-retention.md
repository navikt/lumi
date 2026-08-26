# Automatic retention

Lumi deletes stored survey responses when their server-side creation timestamp is
older than 12 months. Every API instance starts the daily cleanup loop, while a
PostgreSQL advisory lock ensures that only one instance performs cleanup at a time.

## Alerts

`LumiRetentionCleanupFailure` means a cleanup attempt failed. Inspect the
`lumi-api` logs for `Automatic retention failed`, confirm database availability,
and verify that the next run completes.

`LumiRetentionCleanupStale` means no instance has reported a successful cleanup
for more than 36 hours. Check whether the application has restarted repeatedly,
whether Prometheus is scraping `/internal/prometheus`, and whether one instance
can acquire a database connection and the retention lock.

## Metrics

- `lumi_retention_runs_total{outcome}` counts executed, skipped, and failed runs.
- `lumi_retention_deleted_feedback_total` counts deleted response rows.
- `lumi_retention_last_success_timestamp_seconds` records the latest successful
  run. The stale alert evaluates 36 hours of gauge history so pod restarts do
  not erase the signal, and separately detects a missing metric series.

A skipped run is expected on instances that do not acquire the lock. It is not an
error as long as another instance reports an executed run.
