package no.nav.lumi.config

import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.Gauge
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.MultiGauge
import io.micrometer.core.instrument.Tags
import no.nav.lumi.domain.BigQueryExportDestination
import no.nav.lumi.domain.BigQueryExportProblemCode
import no.nav.lumi.domain.BigQueryExportRowCounts
import no.nav.lumi.domain.BigQueryExportRunStatus
import no.nav.lumi.domain.BigQueryExportTable
import java.time.Instant
import java.util.concurrent.atomic.AtomicLong

/**
 * Metrics for the BigQuery export. Failures are tagged with the problem code, so alerts can tell
 * problems on Lumi's side from settings a team has to fix in its own project.
 *
 * The per-team gauges are read from the database on every scheduler poll, so they survive restarts
 * and show how old each team's tables are even when the scheduler has stopped.
 */
class BigQueryExportObservability(
    private val meterRegistry: MeterRegistry = appMicrometerRegistry,
    enabled: Boolean = true,
) {
    private val succeededRuns = Counter.builder(RUNS_METRIC_NAME)
        .description("Number of BigQuery export runs by outcome and problem code")
        .tag("outcome", "succeeded")
        .tag("reason", "none")
        .register(meterRegistry)
    private val failedRuns = BigQueryExportProblemCode.entries.associateWith { code ->
        Counter.builder(RUNS_METRIC_NAME)
            .description("Number of BigQuery export runs by outcome and problem code")
            .tag("outcome", "failed")
            .tag("reason", code.name)
            .register(meterRegistry)
    }
    private val exportedRows = BigQueryExportTable.entries.associateWith { table ->
        Counter.builder(ROWS_METRIC_NAME)
            .description("Number of rows written to team datasets by table")
            .tag("table", table.tableId)
            .register(meterRegistry)
    }
    private val lastSuccessTimestamp = AtomicLong(0)
    private val enabledState = AtomicLong(if (enabled) 1 else 0)
    private val schedulerHeartbeat = AtomicLong(0)
    private val destinationLastSuccess = MultiGauge.builder(DESTINATION_LAST_SUCCESS_METRIC_NAME)
        .description("Unix timestamp of the team's latest successful export, or of the latest settings change before it")
        .baseUnit("seconds")
        .register(meterRegistry)
    private val destinationFailures = MultiGauge.builder(DESTINATION_FAILURES_METRIC_NAME)
        .description("Number of failed export runs in a row for the team")
        .register(meterRegistry)
    private val destinationTeamAction = MultiGauge.builder(DESTINATION_TEAM_ACTION_METRIC_NAME)
        .description("1 when the team's latest run failed on something the team has to fix")
        .register(meterRegistry)

    init {
        Gauge.builder(LAST_SUCCESS_METRIC_NAME, lastSuccessTimestamp) { value -> value.get().toDouble() }
            .description("Unix timestamp of the latest successful BigQuery export run on this instance")
            .baseUnit("seconds")
            .register(meterRegistry)
        Gauge.builder(ENABLED_METRIC_NAME, enabledState) { value -> value.get().toDouble() }
            .description("Whether BigQuery export is enabled for this application instance")
            .register(meterRegistry)
        Gauge.builder(SCHEDULER_HEARTBEAT_METRIC_NAME, schedulerHeartbeat) { value -> value.get().toDouble() }
            .description("Unix timestamp of the latest export scheduler poll on this instance")
            .baseUnit("seconds")
            .register(meterRegistry)
    }

    fun recordPoll(now: Instant, destinations: List<BigQueryExportDestination>) {
        schedulerHeartbeat.set(now.epochSecond)
        destinationLastSuccess.register(
            destinations.map { row(it.team, (it.lastSuccessAt ?: it.updatedAt).epochSecond) },
            true,
        )
        destinationFailures.register(destinations.map { row(it.team, it.consecutiveFailures.toLong()) }, true)
        destinationTeamAction.register(
            destinations.map { destination ->
                val teamMustAct = destination.lastRunStatus == BigQueryExportRunStatus.FAILED &&
                    destination.lastRunErrorCode?.isTeamActionable == true
                row(destination.team, if (teamMustAct) 1 else 0)
            },
            true,
        )
    }

    // Nais adds its own `team` label to every scraped series, so the Lumi team gets another name.
    private fun row(team: String, value: Long): MultiGauge.Row<*> = MultiGauge.Row.of(Tags.of(TEAM_TAG, team), value)

    fun recordSucceeded(finishedAt: Instant, rows: BigQueryExportRowCounts) {
        succeededRuns.increment()
        exportedRows.getValue(BigQueryExportTable.SVAR).increment(rows.svar.toDouble())
        exportedRows.getValue(BigQueryExportTable.INNSENDINGER).increment(rows.innsendinger.toDouble())
        rows.fritekst?.let { exportedRows.getValue(BigQueryExportTable.FRITEKST).increment(it.toDouble()) }
        lastSuccessTimestamp.accumulateAndGet(finishedAt.epochSecond) { current, next -> maxOf(current, next) }
    }

    fun recordFailed(code: BigQueryExportProblemCode) {
        failedRuns.getValue(code).increment()
    }

    companion object {
        const val RUNS_METRIC_NAME = "lumi_bigquery_export_runs_total"
        const val ROWS_METRIC_NAME = "lumi_bigquery_export_rows_total"
        const val LAST_SUCCESS_METRIC_NAME = "lumi_bigquery_export_last_success_timestamp_seconds"
        const val ENABLED_METRIC_NAME = "lumi_bigquery_export_enabled"
        const val TEAM_TAG = "lumi_team"
        const val SCHEDULER_HEARTBEAT_METRIC_NAME = "lumi_bigquery_export_scheduler_heartbeat_timestamp_seconds"
        const val DESTINATION_LAST_SUCCESS_METRIC_NAME = "lumi_bigquery_export_destination_last_success_timestamp_seconds"
        const val DESTINATION_FAILURES_METRIC_NAME = "lumi_bigquery_export_destination_consecutive_failures"
        const val DESTINATION_TEAM_ACTION_METRIC_NAME = "lumi_bigquery_export_destination_team_action_needed"
    }
}
