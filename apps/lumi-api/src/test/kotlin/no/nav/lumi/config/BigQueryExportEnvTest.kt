package no.nav.lumi.config

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

class BigQueryExportEnvTest : FunSpec({
    test("is off unless explicitly enabled") {
        BigQueryExportEnv.fromEnvironment(enabledValue = null, teamProjectValue = null, googleProjectValue = null) shouldBe
            BigQueryExportEnv.disabled()
        BigQueryExportEnv.fromEnvironment(enabledValue = "false", teamProjectValue = "p", googleProjectValue = "p").enabled shouldBe false
    }

    test("uses the team project and falls back to the project Nais sets for every workload") {
        BigQueryExportEnv.fromEnvironment("true", "team-esyfo-prod-bbe6", "other").jobProjectId shouldBe "team-esyfo-prod-bbe6"
        BigQueryExportEnv.fromEnvironment("true", " ", "team-esyfo-prod-bbe6").jobProjectId shouldBe "team-esyfo-prod-bbe6"
        BigQueryExportEnv.fromEnvironment("TRUE", null, "team-esyfo-prod-bbe6").location shouldBe "europe-north1"
    }

    test("limits the export to pilot teams when a list is set") {
        val pilot = BigQueryExportEnv.fromEnvironment("true", "p-roject", null, " team-esyfo, teamsykefravr ,,")
        pilot.pilotTeams shouldBe setOf("team-esyfo", "teamsykefravr")
        pilot.isOpenFor("teamsykefravr") shouldBe true
        pilot.isOpenFor("flex") shouldBe false

        BigQueryExportEnv.fromEnvironment("true", "p-roject", null, " ").pilotTeams shouldBe null
        BigQueryExportEnv.fromEnvironment("true", "p-roject", null, null).isOpenFor("flex") shouldBe true
        BigQueryExportEnv.disabled().isOpenFor("flex") shouldBe false
    }

    test("keeps free text closed unless teams are listed, and opens it for all with a star") {
        BigQueryExportEnv.fromEnvironment("true", "p-roject", null, null, null).allowsFreeText("team-esyfo") shouldBe false
        BigQueryExportEnv.fromEnvironment("true", "p-roject", null, null, " ").allowsFreeText("team-esyfo") shouldBe false

        val listed = BigQueryExportEnv.fromEnvironment("true", "p-roject", null, "team-esyfo,teamsykefravr", "team-esyfo")
        listed.allowsFreeText("team-esyfo") shouldBe true
        listed.allowsFreeText("teamsykefravr") shouldBe false

        val all = BigQueryExportEnv.fromEnvironment("true", "p-roject", null, "team-esyfo", "*")
        all.allowsFreeText("team-esyfo") shouldBe true
        all.allowsFreeText("flex") shouldBe false
        BigQueryExportEnv.disabled().allowsFreeText("team-esyfo") shouldBe false
    }

    test("fails fast on an invalid flag or a missing project") {
        shouldThrow<IllegalStateException> { BigQueryExportEnv.fromEnvironment("yes", "p", "p") }
        shouldThrow<IllegalStateException> { BigQueryExportEnv.fromEnvironment("true", null, null) }
    }
})
