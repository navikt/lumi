package no.nav.lumi.config

import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.Gauge
import io.micrometer.core.instrument.MeterRegistry
import no.nav.lumi.domain.BigQueryExportProblemCode
import no.nav.lumi.domain.BigQueryExportRowCounts
import no.nav.lumi.domain.BigQueryExportTable
import java.time.Instant
import java.util.concurrent.atomic.AtomicLong

/**
 * Metrics for the BigQuery export. Failures are tagged with the problem code, so alerts can tell
 * problems on Lumi's side from settings a team has to fix in its own project.
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

    init {
        Gauge.builder(LAST_SUCCESS_METRIC_NAME, lastSuccessTimestamp) { value -> value.get().toDouble() }
            .description("Unix timestamp of the latest successful BigQuery export run on this instance")
            .baseUnit("seconds")
            .register(meterRegistry)
        Gauge.builder(ENABLED_METRIC_NAME, enabledState) { value -> value.get().toDouble() }
            .description("Whether BigQuery export is enabled for this application instance")
            .register(meterRegistry)
    }

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
    }
}
