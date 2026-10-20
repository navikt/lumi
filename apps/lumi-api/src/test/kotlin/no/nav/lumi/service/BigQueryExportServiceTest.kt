package no.nav.lumi.service

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.maps.shouldNotContainKey
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldNotContain
import io.kotest.matchers.types.shouldBeInstanceOf
import io.micrometer.prometheusmetrics.PrometheusConfig
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import no.nav.lumi.TestDatabase
import no.nav.lumi.config.BigQueryExportEnv
import no.nav.lumi.config.BigQueryExportObservability
import no.nav.lumi.domain.BigQueryExportAvailability
import no.nav.lumi.domain.BigQueryExportDestinationRequest
import no.nav.lumi.domain.BigQueryExportProblemCode
import no.nav.lumi.domain.BigQueryExportProblemDto
import no.nav.lumi.domain.BigQueryExportRowCounts
import no.nav.lumi.domain.BigQueryExportRunState
import no.nav.lumi.domain.BigQueryExportRunStatus
import no.nav.lumi.insertTestFeedbackWithJson
import no.nav.lumi.integrations.bigquery.BigQueryResult
import no.nav.lumi.integrations.bigquery.FakeBigQueryGateway
import no.nav.lumi.integrations.nais.NaisApiResult
import no.nav.lumi.repository.BigQueryExportRepository
import java.time.Clock
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.temporal.ChronoUnit

class BigQueryExportServiceTest : FunSpec({
    beforeSpec { TestDatabase.initialize() }
    beforeTest { TestDatabase.clearAllData() }

    val team = "teamsykefravr"
    val project = "teamsykefravr-prod-1234"
    val env = BigQueryExportEnv(enabled = true, jobProjectId = "team-esyfo-prod-bbe6")
    val json = Json { ignoreUnknownKeys = true }

    fun service(
        gateway: FakeBigQueryGateway?,
        projects: Map<String, String?> = mapOf(team to project, "team-esyfo" to "team-esyfo-prod-bbe6"),
        enabled: Boolean = true,
    ) = BigQueryExportService(
        env = if (enabled) env else BigQueryExportEnv.disabled(),
        repository = BigQueryExportRepository(dataSourceProvider = { TestDatabase.dataSource }),
        gateway = gateway,
        teamProjects = TeamProjectLookup { requested -> NaisApiResult.Success(projects[requested]) },
        observability = BigQueryExportObservability(PrometheusMeterRegistry(PrometheusConfig.DEFAULT)),
        clock = Clock.systemUTC(),
    )

    fun readyGateway() = FakeBigQueryGateway().apply {
        addDataset(project, "lumi", mapOf("lumi-team" to team))
    }

    fun request(includeFreeText: Boolean = false, datasetId: String = "lumi") =
        BigQueryExportDestinationRequest(projectId = project, datasetId = datasetId, includeFreeText = includeFreeText)

    fun feedback(
        id: String,
        forTeam: String,
        app: String,
        rating: Int,
        text: String = "Fint",
        received: OffsetDateTime = OffsetDateTime.now(ZoneOffset.UTC).minusHours(1),
    ) = insertTestFeedbackWithJson(
        id = id,
        team = forTeam,
        app = app,
        opprettet = received.truncatedTo(ChronoUnit.MICROS),
        feedbackJson = """
            {"schemaVersion":2,"surveyId":"modia-kartleggingssporsmal","surveyType":"custom",
             "context":{"deviceType":"desktop"},
             "answers":[
               {"fieldId":"opplevelse","fieldType":"RATING","question":{"label":"Hvordan var det?"},
                "value":{"type":"rating","rating":$rating,"ratingVariant":"emoji","ratingScale":5}},
               {"fieldId":"identifisering","fieldType":"SINGLE_CHOICE",
                "question":{"label":"Ble det enklere å identifisere?","options":[{"id":"ja","label":"Ja"},{"id":"nei","label":"Nei"}]},
                "value":{"type":"singleChoice","selectedOptionId":"ja"}},
               {"fieldId":"innspill","fieldType":"TEXT","question":{"label":"Innspill"},"value":{"type":"text","text":"$text"}}
             ]}
        """.trimIndent(),
    )

    fun lines(gateway: FakeBigQueryGateway, table: String): List<JsonObject> =
        gateway.lines(project, "lumi", table).map { json.parseToJsonElement(it).jsonObject }

    test("reports that the export is off when the environment has not enabled it") {
        val disabled = service(gateway = null, enabled = false)
        disabled.status(team).available shouldBe false
        disabled.verify(team, project, "lumi") shouldBe BigQueryExportCommandResult.Unavailable
        disabled.requestRun(team) shouldBe BigQueryExportCommandResult.Unavailable
    }

    test("a pilot list keeps other teams out without stopping their cleanup") {
        val gateway = readyGateway()
        service(gateway).save(team, "A123456", request())
        val pilot = BigQueryExportService(
            env = env.copy(pilotTeams = setOf("team-esyfo")),
            repository = BigQueryExportRepository(dataSourceProvider = { TestDatabase.dataSource }),
            gateway = gateway,
            teamProjects = TeamProjectLookup { NaisApiResult.Success(project) },
            observability = BigQueryExportObservability(PrometheusMeterRegistry(PrometheusConfig.DEFAULT)),
        )

        pilot.status(team).availability shouldBe BigQueryExportAvailability.PILOT_ONLY
        pilot.status(team).available shouldBe false
        pilot.verify(team, project, "lumi") shouldBe BigQueryExportCommandResult.Unavailable
        pilot.runDueExports() shouldBe 0
        pilot.stop(team).shouldBeInstanceOf<BigQueryExportCommandResult.Done<*>>()
    }

    test("status suggests the team's project and shows Lumi's service account") {
        val status = service(readyGateway()).status(team)

        status.available shouldBe true
        status.suggestedProjectId shouldBe project
        status.serviceAccount shouldBe "lumi-api-team-esyfo-1@nais-test.iam.gserviceaccount.com"
        status.location shouldBe "europe-north1"
        status.destination.shouldBeNull()
    }

    test("verification explains each problem the team can fix") {
        val gateway = FakeBigQueryGateway()
        suspend fun verify(projectId: String) =
            (service(gateway).verify(team, projectId, "lumi") as BigQueryExportCommandResult.Done).value

        verify("team-esyfo-prod-bbe6").problems shouldContainExactly listOf(
            BigQueryExportProblemDto(BigQueryExportProblemCode.PROJECT_NOT_TEAM_PROJECT, project),
        )
        verify(project).problems.map { it.code } shouldContainExactly listOf(BigQueryExportProblemCode.DATASET_NOT_FOUND)

        gateway.datasets["$project.lumi"] = BigQueryResult.AccessDenied
        verify(project).problems.map { it.code } shouldContainExactly listOf(BigQueryExportProblemCode.DATASET_ACCESS_DENIED)

        gateway.addDataset(project, "lumi", emptyMap(), location = "EU")
        verify(project).problems shouldContainExactly listOf(
            BigQueryExportProblemDto(BigQueryExportProblemCode.DATASET_WRONG_LOCATION, "EU"),
            BigQueryExportProblemDto(BigQueryExportProblemCode.DATASET_TEAM_LABEL_MISSING),
        )

        gateway.addDataset(project, "lumi", mapOf("lumi-team" to "team-esyfo"))
        verify(project).problems shouldContainExactly listOf(
            BigQueryExportProblemDto(BigQueryExportProblemCode.DATASET_TEAM_LABEL_MISMATCH, "team-esyfo"),
        )

        gateway.addDataset(project, "lumi", mapOf("lumi-team" to team))
        gateway.tables["$project.lumi.svar"] = FakeBigQueryGateway.Table(labels = emptyMap())
        verify(project).problems shouldContainExactly listOf(
            BigQueryExportProblemDto(BigQueryExportProblemCode.TABLE_NOT_CREATED_BY_LUMI, "svar"),
        )

        gateway.tables.clear()
        gateway.createTableOverride = BigQueryResult.AccessDenied
        verify(project).problems.map { it.code } shouldContainExactly listOf(BigQueryExportProblemCode.TABLE_WRITE_DENIED)

        gateway.createTableOverride = null
        verify(project).ok shouldBe true
        gateway.tables.keys.shouldBeEmpty()
    }

    test("saving an unusable destination stores nothing") {
        val gateway = FakeBigQueryGateway()
        val result = (service(gateway).save(team, "A123456", request()) as BigQueryExportCommandResult.Done).value

        result.shouldBeInstanceOf<BigQueryExportSaveResult.Rejected>()
        service(gateway).status(team).destination.shouldBeNull()
    }

    test("saving a destination queues the first run, and the run writes the team's own rows") {
        val gateway = readyGateway()
        val export = service(gateway)
        feedback("f-1", team, "syfomodiaperson", rating = 5, received = OffsetDateTime.now(ZoneOffset.UTC).minusHours(2))
        feedback("f-2", team, "syfomodiaperson", rating = 0)
        feedback("other", "team-esyfo", "bro-frontend", rating = 1)

        val saved = (export.save(team, "A123456", request()) as BigQueryExportCommandResult.Done).value
        saved.shouldBeInstanceOf<BigQueryExportSaveResult.Saved>().status.destination.shouldNotBeNull().runState shouldBe BigQueryExportRunState.QUEUED

        export.runDueExports() shouldBe 1

        val svar = lines(gateway, "svar")
        svar shouldHaveSize 3
        svar.map { it["sporsmal_id"]!!.jsonPrimitive.content }.toSet() shouldBe setOf("opplevelse", "identifisering")
        svar.filter { it["sporsmal_id"]!!.jsonPrimitive.content == "identifisering" }
            .map { it["valg_tekst"]!!.jsonPrimitive.content } shouldContainExactly listOf("Ja", "Ja")
        svar.map { it["app"]!!.jsonPrimitive.content }.toSet() shouldBe setOf("syfomodiaperson")
        lines(gateway, "innsendinger") shouldHaveSize 2
        gateway.tables shouldNotContainKey "$project.lumi.fritekst"
        gateway.tables.getValue("$project.lumi.svar").labels shouldBe mapOf("lumi-eksport" to "v1", "lumi-team" to team)
        gateway.tables.getValue("$project.lumi.svar").expiresAt.shouldNotBeNull()

        val status = export.status(team).destination.shouldNotBeNull()
        status.runState shouldBe BigQueryExportRunState.IDLE
        status.lastRun.shouldNotBeNull().status shouldBe BigQueryExportRunStatus.SUCCEEDED
        status.lastSuccessRows shouldBe BigQueryExportRowCounts(svar = 3, innsendinger = 2, fritekst = null)

        export.runDueExports() shouldBe 0
    }

    test("free text goes to its own table, and turning it off removes the table") {
        val gateway = readyGateway()
        val export = service(gateway)
        feedback("f-1", team, "syfomodiaperson", rating = 4, text = "Send til ola.nordmann@example.com")

        export.save(team, "A123456", request(includeFreeText = true))
        export.runDueExports()

        val fritekst = lines(gateway, "fritekst").single()
        fritekst["tekst"]!!.jsonPrimitive.content shouldNotContain "ola.nordmann@example.com"
        fritekst["maskert"]!!.jsonPrimitive.content shouldBe "true"

        export.save(team, "A123456", request(includeFreeText = false))
        gateway.tables shouldNotContainKey "$project.lumi.fritekst"
    }

    test("a team without responses gets empty tables with the full schema") {
        val gateway = readyGateway()
        val export = service(gateway)
        export.save(team, "A123456", request())

        export.runDueExports()

        gateway.tables.getValue("$project.lumi.svar").lines.shouldBeEmpty()
        gateway.tables.getValue("$project.lumi.innsendinger").lines.shouldBeEmpty()
        export.status(team).destination.shouldNotBeNull().lastSuccessRows shouldBe BigQueryExportRowCounts(0, 0, null)
    }

    test("a run that loses access is marked failed with a code the team can act on") {
        val gateway = readyGateway()
        val export = service(gateway)
        feedback("f-1", team, "syfomodiaperson", rating = 3)
        export.save(team, "A123456", request())
        gateway.datasets["$project.lumi"] = BigQueryResult.AccessDenied

        export.runDueExports()

        val run = export.status(team).destination.shouldNotBeNull().lastRun.shouldNotBeNull()
        run.status shouldBe BigQueryExportRunStatus.FAILED
        run.errorCode shouldBe BigQueryExportProblemCode.DATASET_ACCESS_DENIED
    }

    test("a failed load is reported as a load failure, not as success") {
        val gateway = readyGateway()
        val export = service(gateway)
        feedback("f-1", team, "syfomodiaperson", rating = 3)
        export.save(team, "A123456", request())
        gateway.loadOverride = BigQueryResult.Failure("boom")

        export.runDueExports()

        export.status(team).destination.shouldNotBeNull().lastRun.shouldNotBeNull().errorCode shouldBe BigQueryExportProblemCode.LOAD_FAILED
    }

    test("a requested run is queued and picked up") {
        val gateway = readyGateway()
        val export = service(gateway)
        export.save(team, "A123456", request())
        export.runDueExports()

        val queued = (export.requestRun(team) as BigQueryExportCommandResult.Done).value
        queued.destination.shouldNotBeNull().runState shouldBe BigQueryExportRunState.QUEUED
        export.runDueExports() shouldBe 1
        service(gateway).requestRun("team-esyfo") shouldBe BigQueryExportCommandResult.NotConfigured
    }

    test("moving the export to another dataset removes Lumi's tables from the old one") {
        val gateway = readyGateway().apply { addDataset(project, "lumi_ny", mapOf("lumi-team" to team)) }
        val export = service(gateway)
        export.save(team, "A123456", request())
        export.runDueExports()

        export.save(team, "A123456", request(datasetId = "lumi_ny"))

        gateway.tables.keys.filter { it.startsWith("$project.lumi.") }.shouldBeEmpty()
        export.runDueExports() shouldBe 1
        gateway.tables.keys shouldContainExactlyInAnyOrder listOf("$project.lumi_ny.svar", "$project.lumi_ny.innsendinger")
    }

    test("stopping removes Lumi's tables and the settings, and leaves other tables alone") {
        val gateway = readyGateway()
        val export = service(gateway)
        export.save(team, "A123456", request())
        export.runDueExports()
        gateway.tables["$project.lumi.teamets_egen_tabell"] = FakeBigQueryGateway.Table(labels = mapOf("eier" to "teamet"))

        val stopped = (export.stop(team) as BigQueryExportCommandResult.Done).value

        stopped.tablesRemoved shouldBe true
        gateway.tables.keys shouldContainExactly setOf("$project.lumi.teamets_egen_tabell")
        export.status(team).destination.shouldBeNull()
        export.stop(team) shouldBe BigQueryExportCommandResult.NotConfigured
    }

    test("the run checks the team's project again before writing") {
        val gateway = readyGateway()
        feedback("f-1", team, "syfomodiaperson", rating = 3)
        service(gateway).save(team, "A123456", request())

        service(gateway, projects = mapOf(team to "teamsykefravr-prod-9999")).runDueExports()

        gateway.tables.keys.shouldBeEmpty()
        service(gateway).status(team).destination.shouldNotBeNull().lastRun.shouldNotBeNull().errorCode shouldBe
            BigQueryExportProblemCode.PROJECT_NOT_TEAM_PROJECT
    }

    test("pseudonyms are stable between runs and never equal the internal id") {
        val gateway = readyGateway()
        val export = service(gateway)
        feedback("11111111-2222-3333-4444-555555555555", team, "syfomodiaperson", rating = 3)
        export.save(team, "A123456", request())
        export.runDueExports()
        val first = lines(gateway, "innsendinger").single()["innsending_id"]!!.jsonPrimitive.content

        export.requestRun(team)
        export.runDueExports()
        val second = lines(gateway, "innsendinger").single()["innsending_id"]!!.jsonPrimitive.content

        first shouldBe second
        first shouldNotContain "11111111"
    }
})
