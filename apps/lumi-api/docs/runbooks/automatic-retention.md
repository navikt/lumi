# Automatic retention

Lumi deletes stored survey responses when their server-side creation timestamp is
older than 12 months. When `LUMI_RETENTION_ENABLED=true`, every API instance polls
hourly. A PostgreSQL advisory lock and the persisted
`feedback_retention_job_state` row allow only one global cleanup every 24 hours,
including across pod restarts and replica changes. The setting is fail-closed: a
missing or false value disables deletion.

Each global run deletes at most 500 of the oldest eligible responses. Later runs
continue with the remaining rows. The deletion and the persisted completion time
commit in the same database transaction. This bounds deletion to 500 rows in any
rolling 24-hour period and must not be increased without checking production volume
and query performance first.

Production is initially deployed with cleanup disabled. Enable it in a separate,
controlled manifest change after verifying the migration, metrics, eligible-row
count, query plan, and database recovery readiness.

## Production activation

Before opening the activation PR:

1. Let development complete at least one global run and confirm that
   `lumi_retention_runs_total{outcome="failed"}` does not increase.
2. Confirm that Flyway migrations V16–V18 succeeded and inspect
   `feedback_retention_job_state`.
3. Count eligible rows with the same UTC calendar cutoff as the application:

   ```sql
   SELECT COUNT(*)
   FROM feedback
   WHERE opprettet < (
       (now() AT TIME ZONE 'UTC' - INTERVAL '12 months') AT TIME ZONE 'UTC'
   );
   ```

4. Run `EXPLAIN (ANALYZE, BUFFERS)` on the bounded `SELECT` from the cleanup CTE,
   never on the `DELETE`, and confirm use of `idx_feedback_opprettet`.
5. Follow the [database recovery runbook](./database-recovery.md). Confirm the
   latest successful backup and explicitly accept the recovery window from
   [ADR 0005](../../../../docs/adr/0005-database-recovery-og-kapasitet.md).
6. Change only the production `LUMI_RETENTION_ENABLED` value in a separately
   reviewed PR. Development must already have been observed before that PR merges,
   because the current workflow deploys production automatically after development.

After deployment:

1. Confirm `min(lumi_retention_enabled{app="lumi-api"}) == 1`, so every live pod has
   the intended configuration.
2. Confirm one executed run and no failed runs.
3. Confirm the increase in `lumi_retention_deleted_feedback_total` is at most 500
   over 24 hours, and compare it with the eligible-row count.
4. Confirm that dashboard counts and filters are refreshed for affected teams.

## Emergency stop

Set production `LUMI_RETENTION_ENABLED` back to `false` by reverting the activation
commit or merging an emergency manifest PR. The switch is deploy-based: a deletion
transaction already in progress may commit up to its 500-row limit before the old pod
terminates.

After the rollout, confirm
`max(lumi_retention_enabled{app="lumi-api"}) == 0` across all live pods. Record the
increase in the deletion counter, recount eligible rows, and use the verified recovery
procedure if rows outside the approved retention set were removed.

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
- `lumi_retention_last_success_timestamp_seconds` records the latest committed
  successful run. After a restart, each instance restores this timestamp from
  `feedback_retention_job_state` on its first interval check. The stale alert
  also evaluates 36 hours of gauge history and separately detects a missing
  metric series.
- `lumi_retention_enabled` is `1` when deletion is enabled for an instance and
  `0` when it is disabled. The stale alert is inactive while all instances are
  disabled.

A skipped poll is expected when the global 24-hour interval has not elapsed or
another instance holds the lock. The metric combines both reasons; application logs
distinguish them. Skips are not errors as long as a global executed run is reported
within the stale-alert window.
