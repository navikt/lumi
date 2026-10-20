package no.nav.lumi.config

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import no.nav.lumi.domain.BigQueryExportProblemCode
import java.nio.file.Files
import java.nio.file.Path

class BigQueryExportAlertRulesTest : FunSpec({
    test("alerts only on problems on Lumi's side, using the metric the service records") {
        val rules = Files.readString(Path.of("nais/alerts/prod.yaml"))
        val lumiSide = BigQueryExportProblemCode.entries.filterNot { it.isTeamActionable }.joinToString("|") { it.name }

        lumiSide shouldBe "BIGQUERY_UNAVAILABLE|LOAD_FAILED|INTERNAL_ERROR"
        rules shouldContain
            """${BigQueryExportObservability.RUNS_METRIC_NAME}{app="lumi-api",outcome="failed",reason=~"$lumiSide"}"""
        rules shouldContain "apps/lumi-api/docs/runbooks/bigquery-export.md"
    }
})
