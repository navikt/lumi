package no.nav.lumi.config

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import no.nav.lumi.domain.BigQueryExportProblemCode
import java.nio.file.Files
import java.nio.file.Path

class BigQueryExportAlertRulesTest : FunSpec({
    val rules = Files.readString(Path.of("nais/alerts/prod.yaml"))

    test("alerts on failures only for problems on Lumi's side, using the metric the service records") {
        val lumiSide = BigQueryExportProblemCode.entries.filterNot { it.isTeamActionable }.joinToString("|") { it.name }

        lumiSide shouldBe "TEAM_PROJECT_UNKNOWN|EXPORT_JOB_DENIED|BIGQUERY_UNAVAILABLE|LOAD_FAILED|INTERNAL_ERROR"
        rules shouldContain
            """${BigQueryExportObservability.RUNS_METRIC_NAME}{app="lumi-api",outcome="failed",reason=~"$lumiSide"}"""
        rules shouldContain "apps/lumi-api/docs/runbooks/bigquery-export.md"
    }

    test("alerts when a team's tables get old or the scheduler stops, using the gauges the service records") {
        rules shouldContain "alert: LumiBigQueryExportStale"
        rules shouldContain "${BigQueryExportObservability.DESTINATION_LAST_SUCCESS_METRIC_NAME}{app=\"lumi-api\"}"
        rules shouldContain "${BigQueryExportObservability.DESTINATION_TEAM_ACTION_METRIC_NAME}{app=\"lumi-api\"}"
        rules shouldContain "alert: LumiBigQueryExportSchedulerStopped"
        rules shouldContain "${BigQueryExportObservability.SCHEDULER_HEARTBEAT_METRIC_NAME}{app=\"lumi-api\"}"
        rules shouldContain "${BigQueryExportObservability.ENABLED_METRIC_NAME}{app=\"lumi-api\"}"
    }
})
