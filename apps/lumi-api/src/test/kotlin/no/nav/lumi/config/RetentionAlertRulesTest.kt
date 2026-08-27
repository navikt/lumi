package no.nav.lumi.config

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.string.shouldContain
import java.nio.file.Files
import java.nio.file.Path

class RetentionAlertRulesTest : FunSpec({
    test("stale alert uses absolute success history and detects missing series") {
        val rules = Files.readString(Path.of("nais/alerts/prod.yaml"))

        rules shouldContain
            """time() - max(max_over_time(lumi_retention_last_success_timestamp_seconds{app="lumi-api"}[36h])) > 129600"""
        rules shouldContain
            """or on() absent_over_time(lumi_retention_last_success_timestamp_seconds{app="lumi-api"}[15m])"""
        rules shouldContain
            """max(lumi_retention_enabled{app="lumi-api"}) == 1"""
    }

    test("production retention starts disabled while development exercises cleanup") {
        val prodManifest = Files.readString(Path.of("nais/app/prod.yaml"))
        val devManifest = Files.readString(Path.of("nais/app/dev.yaml"))

        prodManifest shouldContain """name: LUMI_RETENTION_ENABLED
      value: "false""".trimIndent()
        devManifest shouldContain """name: LUMI_RETENTION_ENABLED
      value: "true""".trimIndent()
    }
})
