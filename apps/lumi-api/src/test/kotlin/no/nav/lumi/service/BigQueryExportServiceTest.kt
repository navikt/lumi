package no.nav.lumi.service

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.collections.shouldNotBeEmpty
import io.kotest.matchers.maps.shouldNotContainKey
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
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
import no.nav.lumi.domain.BigQueryExportSchedule
import no.nav.lumi.domain.BigQueryExportStopResponse
import no.nav.lumi.insertTestFeedbackWithJson
import no.nav.lumi.integrations.bigquery.BigQueryResult
import no.nav.lumi.integrations.bigquery.BigQueryJobState
import no.nav.lumi.integrations.bigquery.FakeBigQueryGateway
import no.nav.lumi.integrations.nais.NaisApiResult
import no.nav.lumi.repository.BigQueryExportRepository
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.temporal.ChronoUnit

/** A clock the tests move by hand. It starts at noon UTC, far from the nightly run at 01:00 Oslo time. */
private class TestClock(var now: Instant = Instant.now().truncatedTo(ChronoUnit.DAYS).plus(Duration.ofHours(12))) : Clock() {
    override fun getZone(): ZoneId = ZoneOffset.UTC
    override fun withZone(zone: ZoneId?): Clock = this
    override fun instant(): Instant = now
}

class BigQueryExportServiceTest : FunSpec({
    beforeSpec { TestDatabase.initialize() }
    beforeTest { TestDatabase.clearAllData() }

    val team = "teamsykefravr"
    val project = "teamsykefravr-prod-1234"
    val env = BigQueryExportEnv(enabled = true, jobProjectId = "team-esyfo-prod-bbe6", freeTextTeams = null)
    val json = Json { ignoreUnknownKeys = true }
    val repository = BigQueryExportRepository(dataSourceProvider = { TestDatabase.dataSource })

    fun service(
        gateway: FakeBigQueryGateway?,
        projects: Map<String, String?> = mapOf(team to project, "team-esyfo" to "team-esyfo-prod-bbe6"),
        exportEnv: BigQueryExportEnv = env,
        clock: Clock = TestClock(),
        lookup: TeamProjectLookup = TeamProjectLookup { requested -> NaisApiResult.Success(projects[requested]) },
        minRunInterval: Duration = Duration.ZERO,
    ) = BigQueryExportService(
        env = exportEnv,
        repository = repository,
        gateway = gateway,
        teamProjects = lookup,
        observability = BigQueryExportObservability(PrometheusMeterRegistry(PrometheusConfig.DEFAULT)),
        clock = clock,
        schedule = BigQueryExportSchedule(minRunInterval = minRunInterval),
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

    fun lines(gateway: FakeBigQueryGateway, table: String, datasetId: String = "lumi"): List<JsonObject> =
        gateway.lines(project, datasetId, table).map { json.parseToJsonElement(it).jsonObject }

    suspend fun verifyProblems(export: BigQueryExportService, projectId: String = project) =
        (export.verify(team, projectId, "lumi") as BigQueryExportCommandResult.Done).value.problems

    suspend fun lastRunCode(export: BigQueryExportService) =
        export.status(team).destination.shouldNotBeNull().lastRun.shouldNotBeNull().errorCode

    test("reports that the export is off when the environment has not enabled it") {
        val disabled = service(gateway = null, exportEnv = BigQueryExportEnv.disabled())
        disabled.status(team).available shouldBe false
        disabled.verify(team, project, "lumi") shouldBe BigQueryExportCommandResult.Unavailable
        disabled.requestRun(team) shouldBe BigQueryExportCommandResult.Unavailable
    }

    test("a pilot list keeps other teams out without stopping their cleanup") {
        val gateway = readyGateway()
        service(gateway).save(team, "A123456", request())
        val pilot = service(gateway, exportEnv = env.copy(pilotTeams = setOf("team-esyfo")))

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
        status.freeTextAvailable shouldBe true
        status.destination.shouldBeNull()
    }

    test("verification explains each problem the team can fix") {
        val gateway = FakeBigQueryGateway()
        val export = service(gateway)

        verifyProblems(export, "team-esyfo-prod-bbe6") shouldContainExactly listOf(
            BigQueryExportProblemDto(BigQueryExportProblemCode.PROJECT_NOT_TEAM_PROJECT, project),
        )
        verifyProblems(export).map { it.code } shouldContainExactly listOf(BigQueryExportProblemCode.DATASET_NOT_FOUND)

        gateway.datasets["$project.lumi"] = BigQueryResult.AccessDenied
        verifyProblems(export).map { it.code } shouldContainExactly listOf(BigQueryExportProblemCode.DATASET_ACCESS_DENIED)

        gateway.addDataset(project, "lumi", emptyMap(), location = "EU")
        verifyProblems(export) shouldContainExactly listOf(
            BigQueryExportProblemDto(BigQueryExportProblemCode.DATASET_WRONG_LOCATION, "EU"),
            BigQueryExportProblemDto(BigQueryExportProblemCode.DATASET_TEAM_LABEL_MISSING),
        )

        gateway.addDataset(project, "lumi", mapOf("lumi-team" to "team-esyfo"))
        verifyProblems(export) shouldContainExactly listOf(
            BigQueryExportProblemDto(BigQueryExportProblemCode.DATASET_TEAM_LABEL_MISMATCH, "team-esyfo"),
        )

        gateway.addDataset(project, "lumi", mapOf("lumi-team" to team), maxTimeTravelHours = null)
        verifyProblems(export) shouldContainExactly listOf(
            BigQueryExportProblemDto(BigQueryExportProblemCode.DATASET_TIME_TRAVEL_TOO_LONG, "168"),
        )

        gateway.addDataset(project, "lumi", mapOf("lumi-team" to team))
        gateway.tables["$project.lumi.svar"] = FakeBigQueryGateway.Table(labels = emptyMap())
        verifyProblems(export) shouldContainExactly listOf(
            BigQueryExportProblemDto(BigQueryExportProblemCode.DATASET_NOT_DEDICATED, "svar"),
        )

        gateway.tables.clear()
        gateway.createTableOverride = BigQueryResult.AccessDenied
        verifyProblems(export).map { it.code } shouldContainExactly listOf(BigQueryExportProblemCode.TABLE_WRITE_DENIED)

        gateway.createTableOverride = null
        gateway.tables["$project.lumi.svar_bro_frontend"] = FakeBigQueryGateway.Table(labels = emptyMap(), type = "VIEW")
        (export.verify(team, project, "lumi") as BigQueryExportCommandResult.Done).value.ok shouldBe true
        gateway.tables.keys shouldContainExactly setOf("$project.lumi.svar_bro_frontend")
    }

    test("problems on Lumi's side are reported as such, and nothing is written") {
        val gateway = readyGateway()
        verifyProblems(service(gateway, lookup = { NaisApiResult.Error("unavailable") })).map { it.code } shouldContainExactly
            listOf(BigQueryExportProblemCode.TEAM_PROJECT_UNKNOWN)

        gateway.jobAccess = BigQueryResult.JobDenied
        verifyProblems(service(gateway)).map { it.code } shouldContainExactly listOf(BigQueryExportProblemCode.EXPORT_JOB_DENIED)
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
        svar.map { it["innsendt_tidspunkt"]!!.jsonPrimitive.content }.forEach { it.substring(14, 26) shouldBe "00:00.000000" }
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

        // Turning free text off needs no new checks, so it works even when Lumi cannot run jobs.
        gateway.jobAccess = BigQueryResult.JobDenied
        export.save(team, "A123456", request(includeFreeText = false))
            .shouldBeInstanceOf<BigQueryExportCommandResult.Done<*>>()
            .value.shouldBeInstanceOf<BigQueryExportSaveResult.Saved>()
        gateway.tables shouldNotContainKey "$project.lumi.fritekst"
    }

    test("a run fails when free text is off and Lumi cannot remove the fritekst table") {
        val gateway = readyGateway()
        val clock = TestClock()
        val export = service(gateway, clock = clock)
        feedback("f-1", team, "syfomodiaperson", rating = 4)
        export.save(team, "A123456", request(includeFreeText = true))
        export.runDueExports() shouldBe 1

        gateway.deleteOverride = BigQueryResult.Failure("503 Service Unavailable")
        export.save(team, "A123456", request(includeFreeText = false))
        export.runDueExports() shouldBe 1
        gateway.tables.keys shouldContain "$project.lumi.fritekst"
        lastRunCode(export) shouldBe BigQueryExportProblemCode.FREE_TEXT_NOT_REMOVED
        BigQueryExportProblemCode.FREE_TEXT_NOT_REMOVED.isTeamActionable shouldBe false

        // Lumi can see the table but not delete it, so the team must give the access back.
        gateway.deleteOverride = BigQueryResult.AccessDenied
        clock.now = clock.now.plus(Duration.ofHours(1))
        export.runDueExports() shouldBe 1
        lastRunCode(export) shouldBe BigQueryExportProblemCode.TABLE_WRITE_DENIED

        gateway.deleteOverride = null
        clock.now = clock.now.plus(Duration.ofHours(2))
        export.runDueExports() shouldBe 1
        lastRunCode(export).shouldBeNull()
        gateway.tables shouldNotContainKey "$project.lumi.fritekst"
    }

    test("free text stays closed for teams Lumi has not opened it for") {
        val gateway = readyGateway()
        feedback("f-1", team, "syfomodiaperson", rating = 4)
        service(gateway).save(team, "A123456", request(includeFreeText = true))
        val closed = service(gateway, exportEnv = env.copy(freeTextTeams = emptySet()))

        closed.status(team).freeTextAvailable shouldBe false
        shouldThrow<IllegalArgumentException> { closed.save(team, "A123456", request(includeFreeText = true)) }

        closed.runDueExports() shouldBe 1
        gateway.tables shouldNotContainKey "$project.lumi.fritekst"
        lines(gateway, "svar") shouldHaveSize 2
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

    test("emptying a table keeps it and the access granted on it") {
        val gateway = readyGateway()
        val export = service(gateway)
        feedback("f-1", team, "syfomodiaperson", rating = 3)
        export.save(team, "A123456", request())
        export.runDueExports()
        gateway.grant(project, "lumi", "svar", "user:analytiker@nav.no")
        TestDatabase.clearAllData()
        export.save(team, "A123456", request())

        export.runDueExports() shouldBe 1

        gateway.truncated shouldContain "$project.lumi.svar"
        gateway.deleted.filterNot { it.contains("lumi_tilkoblingstest_") }.shouldBeEmpty()
        gateway.tables.getValue("$project.lumi.svar").lines.shouldBeEmpty()
        gateway.tables.getValue("$project.lumi.svar").grants shouldBe setOf("user:analytiker@nav.no")
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

        lastRunCode(export) shouldBe BigQueryExportProblemCode.LOAD_FAILED
    }

    test("a run without access to run jobs in Lumi's project is Lumi's problem") {
        val gateway = readyGateway()
        val export = service(gateway)
        feedback("f-1", team, "syfomodiaperson", rating = 3)
        export.save(team, "A123456", request())
        gateway.jobAccess = BigQueryResult.JobDenied

        export.runDueExports()

        lastRunCode(export) shouldBe BigQueryExportProblemCode.EXPORT_JOB_DENIED
        BigQueryExportProblemCode.EXPORT_JOB_DENIED.isTeamActionable shouldBe false
    }

    test("a run waits for a job an earlier run did not see finish") {
        val gateway = readyGateway()
        val clock = TestClock()
        val export = service(gateway, clock = clock)
        feedback("f-1", team, "syfomodiaperson", rating = 3)
        export.save(team, "A123456", request())
        export.runDueExports() shouldBe 1
        repository.addPendingJob(team, "lumi_export_svar_gammel")
        gateway.jobStates["lumi_export_svar_gammel"] = BigQueryJobState.RUNNING
        feedback("f-2", team, "syfomodiaperson", rating = 4)

        clock.now = clock.now.plus(Duration.ofMinutes(10))
        repository.requestRun(team, clock.now)
        export.runDueExports() shouldBe 1
        lastRunCode(export) shouldBe BigQueryExportProblemCode.LOAD_FAILED
        lines(gateway, "innsendinger") shouldHaveSize 1

        gateway.jobStates["lumi_export_svar_gammel"] = BigQueryJobState.DONE
        clock.now = clock.now.plus(Duration.ofMinutes(10))
        repository.requestRun(team, clock.now)
        export.runDueExports() shouldBe 1
        lines(gateway, "innsendinger") shouldHaveSize 2
        repository.find(team).shouldNotBeNull().pendingJobIds.shouldBeEmpty()
    }

    test("a lost answer leaves the job pending until BigQuery says how it went") {
        val gateway = readyGateway()
        val clock = TestClock()
        val export = service(gateway, clock = clock)
        feedback("f-1", team, "syfomodiaperson", rating = 3)
        export.save(team, "A123456", request())
        gateway.loadOverride = BigQueryResult.Failure("connection reset")

        export.runDueExports() shouldBe 1
        repository.find(team).shouldNotBeNull().pendingJobIds.shouldNotBeEmpty()

        // BigQuery never created the job, so the next run forgets it and writes.
        gateway.loadOverride = null
        clock.now = clock.now.plus(Duration.ofMinutes(10))
        repository.requestRun(team, clock.now)
        export.runDueExports() shouldBe 1
        lastRunCode(export).shouldBeNull()
        repository.find(team).shouldNotBeNull().pendingJobIds.shouldBeEmpty()
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

    test("requested runs wait until five minutes after the previous start") {
        val gateway = readyGateway()
        val clock = TestClock()
        val export = service(gateway, clock = clock, minRunInterval = Duration.ofMinutes(5))
        export.save(team, "A123456", request())
        export.runDueExports() shouldBe 1

        export.requestRun(team)
        export.runDueExports() shouldBe 0
        export.status(team).destination.shouldNotBeNull().nextScheduledRunAt shouldBe clock.now.plus(Duration.ofMinutes(5)).toString()

        clock.now = clock.now.plus(Duration.ofMinutes(5))
        export.runDueExports() shouldBe 1
    }

    test("deleting responses queues a run for a team with an export") {
        val gateway = readyGateway()
        val export = service(gateway)
        export.requestRunAfterDeletion(team)
        export.status(team).destination.shouldBeNull()

        export.save(team, "A123456", request())
        export.runDueExports()
        export.requestRunAfterDeletion(team)

        export.status(team).destination.shouldNotBeNull().runState shouldBe BigQueryExportRunState.QUEUED
    }

    test("an interrupted run counts as failed and waits for the backoff") {
        val gateway = readyGateway()
        val clock = TestClock()
        val export = service(gateway, clock = clock)
        export.save(team, "A123456", request())
        repository.markStarted(team, clock.now).shouldNotBeNull()

        export.runDueExports() shouldBe 0

        val destination = export.status(team).destination.shouldNotBeNull()
        destination.lastRun.shouldNotBeNull().status shouldBe BigQueryExportRunStatus.FAILED
        destination.lastRun.shouldNotBeNull().errorCode shouldBe BigQueryExportProblemCode.INTERNAL_ERROR
        clock.now = clock.now.plus(Duration.ofHours(1))
        export.runDueExports() shouldBe 1
    }

    test("moving the export to another dataset removes Lumi's tables from the old one and gives new pseudonyms") {
        val gateway = readyGateway().apply { addDataset(project, "lumi_ny", mapOf("lumi-team" to team)) }
        val export = service(gateway)
        feedback("f-1", team, "syfomodiaperson", rating = 3)
        export.save(team, "A123456", request())
        export.runDueExports()
        val before = lines(gateway, "innsendinger").single()["innsending_id"]!!.jsonPrimitive.content

        export.save(team, "A123456", request(datasetId = "lumi_ny"))

        gateway.tables.keys.filter { it.startsWith("$project.lumi.") }.shouldBeEmpty()
        export.status(team).destination.shouldNotBeNull().lastSuccessAt.shouldBeNull()
        export.runDueExports() shouldBe 1
        gateway.tables.keys shouldContainExactlyInAnyOrder listOf("$project.lumi_ny.svar", "$project.lumi_ny.innsendinger")
        lines(gateway, "innsendinger", "lumi_ny").single()["innsending_id"]!!.jsonPrimitive.content shouldNotBe before
    }

    test("stopping removes Lumi's tables and the settings, and leaves other tables alone") {
        val gateway = readyGateway()
        val export = service(gateway)
        export.save(team, "A123456", request())
        export.runDueExports()
        gateway.tables["$project.lumi.teamets_egen_tabell"] = FakeBigQueryGateway.Table(labels = mapOf("eier" to "teamet"))
        // Another team's Lumi label is not enough: Lumi only deletes tables it wrote for this team.
        gateway.tables["$project.lumi.fritekst"] = FakeBigQueryGateway.Table(labels = mapOf("lumi-eksport" to "v1", "lumi-team" to "team-esyfo"))

        val stopped = (export.stop(team) as BigQueryExportCommandResult.Done).value

        // The tables Lumi wrote for the team are gone, and the others do not hold the stop back.
        stopped shouldBe BigQueryExportStopResponse(tablesRemoved = true, stopping = false)
        gateway.tables.keys shouldContainExactlyInAnyOrder setOf("$project.lumi.teamets_egen_tabell", "$project.lumi.fritekst")
        export.status(team).destination.shouldBeNull()
        export.stop(team) shouldBe BigQueryExportCommandResult.NotConfigured
    }

    test("a stop during a run waits for the run, and the scheduler retries until Lumi's tables are gone") {
        val gateway = readyGateway()
        val clock = TestClock()
        val export = service(gateway, clock = clock, minRunInterval = Duration.ofMinutes(5))
        feedback("f-1", team, "syfomodiaperson", rating = 3)
        export.save(team, "A123456", request())
        var stopped: BigQueryExportCommandResult<BigQueryExportStopResponse>? = null
        gateway.beforeCreateTable = {
            gateway.beforeCreateTable = null
            stopped = export.stop(team)
            gateway.deleteOverride = BigQueryResult.Failure("503 Service Unavailable")
        }

        export.runDueExports() shouldBe 1

        stopped shouldBe BigQueryExportCommandResult.Done(BigQueryExportStopResponse(tablesRemoved = false, stopping = true))
        // The run went on and wrote the tables, so the stop must still remove them.
        lines(gateway, "innsendinger") shouldHaveSize 1
        export.status(team).destination.shouldNotBeNull().stopping shouldBe true

        export.runDueExports() shouldBe 0
        gateway.tables.keys shouldContainExactlyInAnyOrder setOf("$project.lumi.svar", "$project.lumi.innsendinger")
        export.status(team).destination.shouldNotBeNull().stopping shouldBe true

        // A failed attempt waits five minutes before the next.
        gateway.deleteOverride = null
        export.runDueExports() shouldBe 0
        gateway.tables.keys shouldContainExactlyInAnyOrder setOf("$project.lumi.svar", "$project.lumi.innsendinger")

        clock.now = clock.now.plus(Duration.ofMinutes(5))
        export.runDueExports() shouldBe 0
        gateway.tables.keys.shouldBeEmpty()
        export.status(team).destination.shouldBeNull()
        export.stop(team) shouldBe BigQueryExportCommandResult.NotConfigured
    }

    test("a stop waits for a job Lumi has not seen finish, so the job cannot write after the stop") {
        val gateway = readyGateway()
        val clock = TestClock()
        val export = service(gateway, clock = clock, minRunInterval = Duration.ofMinutes(5))
        feedback("f-1", team, "syfomodiaperson", rating = 3)
        export.save(team, "A123456", request())
        var lateJob: String? = null
        gateway.beforeLoad = { jobId ->
            gateway.beforeLoad = null
            export.stop(team)
            // Lumi loses the answer, while the job goes on in BigQuery.
            lateJob = jobId
            gateway.jobStates[jobId] = BigQueryJobState.RUNNING
            gateway.loadOverride = BigQueryResult.Failure("connection reset")
        }

        export.runDueExports() shouldBe 1
        val jobId = lateJob.shouldNotBeNull()
        repository.find(team).shouldNotBeNull().pendingJobIds shouldContainExactly listOf(jobId)

        export.runDueExports() shouldBe 0
        gateway.cancelled shouldContainExactly listOf(jobId)
        gateway.tables.keys shouldContainExactlyInAnyOrder setOf("$project.lumi.svar", "$project.lumi.innsendinger")
        export.status(team).destination.shouldNotBeNull().stopping shouldBe true

        gateway.jobStates[jobId] = BigQueryJobState.DONE
        clock.now = clock.now.plus(Duration.ofMinutes(5))
        export.runDueExports() shouldBe 0
        gateway.tables.keys.shouldBeEmpty()
        export.status(team).destination.shouldBeNull()
    }

    test("a stop finishes without the tables when Lumi has lost access, or after two days without an answer") {
        val gateway = readyGateway()
        val clock = TestClock()
        val export = service(gateway, clock = clock)
        export.save(team, "A123456", request())
        export.runDueExports() shouldBe 1

        // The team took Lumi's access away first. The tables expire on their own.
        gateway.deleteOverride = BigQueryResult.AccessDenied
        export.stop(team) shouldBe BigQueryExportCommandResult.Done(BigQueryExportStopResponse(tablesRemoved = false, stopping = false))
        export.status(team).destination.shouldBeNull()

        gateway.deleteOverride = null
        gateway.tables.clear()
        export.save(team, "A123456", request())
        export.runDueExports() shouldBe 1
        repository.addPendingJob(team, "lumi_export_svar_tapt") shouldBe true
        gateway.jobStates["lumi_export_svar_tapt"] = BigQueryJobState.RUNNING
        export.stop(team) shouldBe BigQueryExportCommandResult.Done(BigQueryExportStopResponse(tablesRemoved = false, stopping = true))

        clock.now = clock.now.plus(Duration.ofHours(47))
        export.runDueExports() shouldBe 0
        export.status(team).destination.shouldNotBeNull().stopping shouldBe true

        clock.now = clock.now.plus(Duration.ofHours(1))
        export.runDueExports() shouldBe 0
        export.status(team).destination.shouldBeNull()
        gateway.tables.keys.shouldBeEmpty()
    }

    test("an export that is being stopped cannot be changed or run, also when the stop comes during a save") {
        val gateway = readyGateway().apply { addDataset(project, "lumi_ny", mapOf("lumi-team" to team)) }
        val clock = TestClock()
        val export = service(gateway, clock = clock)
        export.save(team, "A123456", request())

        // Another replica holds the export lock, so the stop cannot finish at once.
        repository.withExportLock {
            export.stop(team) shouldBe BigQueryExportCommandResult.Done(BigQueryExportStopResponse(tablesRemoved = false, stopping = true))
            export.save(team, "A123456", request(includeFreeText = true)) shouldBe BigQueryExportCommandResult.Stopping
            export.requestRun(team) shouldBe BigQueryExportCommandResult.Stopping
            export.status(team).destination.shouldNotBeNull().let {
                it.stopping shouldBe true
                it.runState shouldBe BigQueryExportRunState.IDLE
            }
        }.shouldNotBeNull()
        export.runDueExports() shouldBe 0
        export.status(team).destination.shouldBeNull()

        export.save(team, "A123456", request())
        gateway.beforeCreateTable = {
            gateway.beforeCreateTable = null
            repository.markStopping(team, clock.now) shouldBe true
        }
        export.save(team, "A123456", request(datasetId = "lumi_ny")) shouldBe BigQueryExportCommandResult.Stopping
        repository.find(team).shouldNotBeNull().datasetId shouldBe "lumi"
    }

    test("moving the export or stopping and setting it up again does not skip the time between runs") {
        val gateway = readyGateway().apply { addDataset(project, "lumi_ny", mapOf("lumi-team" to team)) }
        val clock = TestClock()
        val export = service(gateway, clock = clock, minRunInterval = Duration.ofMinutes(5))
        export.save(team, "A123456", request())
        export.runDueExports() shouldBe 1
        val nextAllowed = clock.now.plus(Duration.ofMinutes(5))

        export.save(team, "A123456", request(datasetId = "lumi_ny"))
        export.runDueExports() shouldBe 0
        export.status(team).destination.shouldNotBeNull().nextScheduledRunAt shouldBe nextAllowed.toString()

        export.stop(team) shouldBe BigQueryExportCommandResult.Done(BigQueryExportStopResponse(tablesRemoved = true, stopping = false))
        export.save(team, "A123456", request())
        export.runDueExports() shouldBe 0
        export.status(team).destination.shouldNotBeNull().nextScheduledRunAt shouldBe nextAllowed.toString()

        clock.now = nextAllowed
        export.runDueExports() shouldBe 1
    }

    test("the run checks the team's project and tables again before writing") {
        val gateway = readyGateway()
        val clock = TestClock()
        feedback("f-1", team, "syfomodiaperson", rating = 3)
        service(gateway, clock = clock).save(team, "A123456", request())

        service(gateway, projects = mapOf(team to "teamsykefravr-prod-9999"), clock = clock).runDueExports()
        gateway.tables.keys.shouldBeEmpty()
        lastRunCode(service(gateway, clock = clock)) shouldBe BigQueryExportProblemCode.PROJECT_NOT_TEAM_PROJECT

        clock.now = clock.now.plus(Duration.ofHours(2))
        repository.requestRun(team, clock.now)
        service(gateway, lookup = { NaisApiResult.Error("unavailable") }, clock = clock).runDueExports()
        gateway.tables.keys.shouldBeEmpty()
        lastRunCode(service(gateway, clock = clock)) shouldBe BigQueryExportProblemCode.TEAM_PROJECT_UNKNOWN

        // A missing project for the environment is Lumi's setup to look into, not the team's.
        clock.now = clock.now.plus(Duration.ofHours(2))
        repository.requestRun(team, clock.now)
        service(gateway, projects = emptyMap(), clock = clock).runDueExports()
        lastRunCode(service(gateway, clock = clock)) shouldBe BigQueryExportProblemCode.TEAM_PROJECT_UNKNOWN

        gateway.tables["$project.lumi.svar"] = FakeBigQueryGateway.Table(labels = emptyMap())
        clock.now = clock.now.plus(Duration.ofHours(2))
        repository.requestRun(team, clock.now)
        service(gateway, clock = clock).runDueExports()
        lastRunCode(service(gateway, clock = clock)) shouldBe BigQueryExportProblemCode.TABLE_NOT_CREATED_BY_LUMI
        gateway.tables.getValue("$project.lumi.svar").lines.shouldBeEmpty()

        gateway.tables.remove("$project.lumi.svar")
        gateway.addDataset(project, "lumi", mapOf("lumi-team" to team), maxTimeTravelHours = 168)
        clock.now = clock.now.plus(Duration.ofHours(2))
        repository.requestRun(team, clock.now)
        service(gateway, clock = clock).runDueExports()
        lastRunCode(service(gateway, clock = clock)) shouldBe BigQueryExportProblemCode.DATASET_TIME_TRAVEL_TOO_LONG
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
