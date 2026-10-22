package no.nav.lumi.repository

import com.zaxxer.hikari.HikariDataSource
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import no.nav.lumi.TestDatabase
import no.nav.lumi.domain.BigQueryExportProblemCode
import no.nav.lumi.domain.BigQueryExportRowCounts
import no.nav.lumi.domain.BigQueryExportRunStatus
import no.nav.lumi.domain.BigQueryExportSourceRow
import no.nav.lumi.insertTestFeedbackWithJson
import java.sql.SQLException
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.temporal.ChronoUnit

class BigQueryExportRepositoryTest : FunSpec({
    beforeSpec { TestDatabase.initialize() }
    beforeTest { TestDatabase.clearAllData() }

    val repository = BigQueryExportRepository(dataSourceProvider = { TestDatabase.dataSource })
    val now = Instant.parse("2026-10-20T10:00:00Z")

    test("the legacy analysis role and PUBLIC cannot read the export schema") {
        TestDatabase.dataSource.connection.use { connection ->
            listOf("bigquery_export.destinations", "bigquery_export.team_runs").forEach { table ->
                connection.prepareStatement(
                    """
                        SELECT has_schema_privilege('esyfo-analyse', 'bigquery_export', 'USAGE'),
                               has_table_privilege('esyfo-analyse', ?, 'SELECT'),
                               EXISTS (
                                   SELECT 1 FROM pg_class c, aclexplode(c.relacl) acl
                                   WHERE c.oid = ?::regclass AND acl.grantee = 0
                               ),
                               EXISTS (
                                   SELECT 1 FROM pg_namespace n, aclexplode(n.nspacl) acl
                                   WHERE n.nspname = 'bigquery_export' AND acl.grantee = 0
                               )
                    """.trimIndent(),
                ).use { statement ->
                    statement.setString(1, table)
                    statement.setString(2, table)
                    statement.executeQuery().use { result ->
                        result.next() shouldBe true
                        result.getBoolean(1) shouldBe false
                        result.getBoolean(2) shouldBe false
                        result.getBoolean(3) shouldBe false
                        result.getBoolean(4) shouldBe false
                    }
                }
            }
        }
    }

    test("the database rejects invalid project ids, dataset ids and key lengths") {
        TestDatabase.dataSource.connection.use { connection ->
            listOf(
                "('team-a', 'Bad_Project', 'lumi', decode(repeat('00', 32), 'hex'))",
                "('team-a', 'team-a-prod-1234', 'lumi-dataset', decode(repeat('00', 32), 'hex'))",
                "('team-a', 'team-a-prod-1234', 'lumi', decode('00', 'hex'))",
            ).forEach { values ->
                shouldThrow<SQLException> {
                    connection.createStatement().use { statement ->
                        statement.execute(
                            "INSERT INTO bigquery_export.destinations (team, project_id, dataset_id, pseudonym_key, created_by, updated_by) " +
                                "SELECT v.*, 'A123456', 'A123456' FROM (VALUES $values) AS v",
                        )
                    }
                }
                connection.rollback()
            }
        }
    }

    test("creates a destination with a random key and a queued first run") {
        val created = repository.upsert("team-a", "team-a-prod-1234", "lumi", false, "A123456", now)

        created.pseudonymKey.size shouldBe 32
        created.runRequestedAt shouldBe now
        created.lastRunStatus.shouldBeNull()

        val other = repository.upsert("team-b", "team-b-prod-1234", "lumi", false, "A123456", now)
        other.pseudonymKey.contentEquals(created.pseudonymKey) shouldBe false
    }

    test("keeps the key when settings change and only queues a run when something changed") {
        val created = repository.upsert("team-a", "team-a-prod-1234", "lumi", false, "A123456", now)
        repository.markStarted("team-a", now.plusSeconds(1)).shouldNotBeNull()
        repository.markSucceeded("team-a", now.plusSeconds(1), now.plusSeconds(2), BigQueryExportRowCounts(3, 1))

        val unchanged = repository.upsert("team-a", "team-a-prod-1234", "lumi", false, "B234567", now.plusSeconds(10))
        unchanged.runRequestedAt.shouldBeNull()
        unchanged.pseudonymKey.contentEquals(created.pseudonymKey) shouldBe true

        val withText = repository.upsert("team-a", "team-a-prod-1234", "lumi", true, "B234567", now.plusSeconds(20))
        withText.includeFreeText shouldBe true
        withText.runRequestedAt shouldBe now.plusSeconds(20)
        withText.pseudonymKey.contentEquals(created.pseudonymKey) shouldBe true
    }

    test("moving to another dataset gives a new key and a fresh run history") {
        val created = repository.upsert("team-a", "team-a-prod-1234", "lumi", false, "A123456", now)
        repository.markStarted("team-a", now.plusSeconds(1)).shouldNotBeNull()
        repository.markSucceeded("team-a", now.plusSeconds(1), now.plusSeconds(2), BigQueryExportRowCounts(3, 1))

        val moved = repository.upsert("team-a", "team-a-prod-1234", "lumi_ny", false, "A123456", now.plusSeconds(10))

        moved.pseudonymKey.contentEquals(created.pseudonymKey) shouldBe false
        moved.lastSuccessAt.shouldBeNull()
        moved.lastRunStatus.shouldBeNull()
        moved.lastRunStartedAt.shouldBeNull()
        moved.consecutiveFailures shouldBe 0
        moved.runRequestedAt shouldBe now.plusSeconds(10)
        // A run that started before the move can no longer mark the new destination as done.
        repository.markSucceeded("team-a", now.plusSeconds(1), now.plusSeconds(11), BigQueryExportRowCounts(1, 1)) shouldBe false
    }

    test("tracks a run from start to success and from start to failure") {
        repository.upsert("team-a", "team-a-prod-1234", "lumi", false, "A123456", now)
        val started = now.plusSeconds(5)
        repository.markStarted("team-a", started).shouldNotBeNull().let {
            it.lastRunStatus shouldBe BigQueryExportRunStatus.RUNNING
            it.lastRunStartedAt shouldBe started
            it.runRequestedAt.shouldBeNull()
        }
        repository.markStarted("team-b", started).shouldBeNull()

        repository.markSucceeded("team-a", started, started.plusSeconds(9), BigQueryExportRowCounts(10, 4, 2)) shouldBe true
        repository.find("team-a").shouldNotBeNull().let {
            it.lastRunStatus shouldBe BigQueryExportRunStatus.SUCCEEDED
            it.lastSuccessAt shouldBe started
            it.lastSuccessRows shouldBe BigQueryExportRowCounts(10, 4, 2)
            it.consecutiveFailures shouldBe 0
        }

        val second = started.plusSeconds(60)
        repository.markStarted("team-a", second)
        repository.markFailed("team-a", second, second.plusSeconds(1), BigQueryExportProblemCode.TABLE_WRITE_DENIED) shouldBe true
        repository.find("team-a").shouldNotBeNull().let {
            it.lastRunStatus shouldBe BigQueryExportRunStatus.FAILED
            it.lastRunErrorCode shouldBe BigQueryExportProblemCode.TABLE_WRITE_DENIED
            it.consecutiveFailures shouldBe 1
            it.lastSuccessAt shouldBe started
        }
    }

    test("a request made during a run stays queued, and an old run cannot overwrite a newer one") {
        repository.upsert("team-a", "team-a-prod-1234", "lumi", false, "A123456", now)
        val started = now.plusSeconds(5)
        repository.markStarted("team-a", started)
        repository.requestRun("team-a", started.plusSeconds(1)) shouldBe true
        repository.find("team-a").shouldNotBeNull().runRequestedAt shouldBe started.plusSeconds(1)

        repository.markSucceeded("team-a", started.minusSeconds(100), started.plusSeconds(2), BigQueryExportRowCounts(1, 1)) shouldBe false
    }

    test("remembers jobs that may still replace a table until they are removed") {
        repository.upsert("team-a", "team-a-prod-1234", "lumi", false, "A123456", now)

        // Without an export there is nowhere to remember a job, so it must not be started.
        repository.addPendingJob("team-b", "lumi_export_svar_1") shouldBe false
        repository.addPendingJob("team-a", "lumi_export_svar_1") shouldBe true
        repository.addPendingJob("team-a", "lumi_truncate_innsendinger_2")
        repository.addPendingJob("team-a", "lumi_export_svar_1")
        repository.markStarted("team-a", now.plusSeconds(1)).shouldNotBeNull().pendingJobIds shouldContainExactly
            listOf("lumi_truncate_innsendinger_2", "lumi_export_svar_1")

        repository.removePendingJob("team-a", "lumi_export_svar_1")
        repository.find("team-a").shouldNotBeNull().pendingJobIds shouldContainExactly listOf("lumi_truncate_innsendinger_2")
    }

    test("update changes an existing destination like upsert, and never creates or revives one") {
        val created = repository.upsert("team-a", "team-a-prod-1234", "lumi", false, "A123456", now)
        repository.markStarted("team-a", now.plusSeconds(1)).shouldNotBeNull()

        repository.update("team-a", "team-a-prod-1234", "lumi", true, "B234567", now.plusSeconds(10)).shouldNotBeNull().let {
            it.includeFreeText shouldBe true
            it.runRequestedAt shouldBe now.plusSeconds(10)
            it.lastRunStartedAt shouldBe now.plusSeconds(1)
            it.pseudonymKey.contentEquals(created.pseudonymKey) shouldBe true
        }
        repository.update("team-a", "team-a-prod-1234", "lumi_ny", true, "B234567", now.plusSeconds(20)).shouldNotBeNull().let {
            it.datasetId shouldBe "lumi_ny"
            it.lastRunStartedAt.shouldBeNull()
            it.pseudonymKey.contentEquals(created.pseudonymKey) shouldBe false
        }

        repository.update("team-b", "team-b-prod-1234", "lumi", false, "A123456", now).shouldBeNull()
        repository.find("team-b").shouldBeNull()
        repository.markStopping("team-a", now.plusSeconds(30)) shouldBe true
        repository.update("team-a", "team-a-prod-1234", "lumi", false, "A123456", now.plusSeconds(40)).shouldBeNull()
        repository.find("team-a").shouldNotBeNull().datasetId shouldBe "lumi_ny"
    }

    test("a destination that is not stopping is only deleted when asked to directly") {
        repository.upsert("team-a", "team-a-prod-1234", "lumi", false, "A123456", now)

        repository.delete("team-a", onlyIfStopping = true) shouldBe false
        repository.markStopping("team-a", now) shouldBe true
        repository.delete("team-a", onlyIfStopping = true) shouldBe true
        repository.find("team-a").shouldBeNull()
    }

    test("a stopping export queues and starts nothing, and keeps its settings until it is deleted") {
        repository.upsert("team-a", "team-a-prod-1234", "lumi", false, "A123456", now)
        repository.markStopping("team-a", now.plusSeconds(1)) shouldBe true
        repository.markStopping("team-a", now.plusSeconds(2)) shouldBe true
        repository.markStopping("team-b", now) shouldBe false

        val stopping = repository.find("team-a").shouldNotBeNull()
        stopping.stopRequestedAt shouldBe now.plusSeconds(1)
        stopping.runRequestedAt.shouldBeNull()
        repository.requestRun("team-a", now.plusSeconds(3)) shouldBe false
        repository.markStarted("team-a", now.plusSeconds(3)).shouldBeNull()
        // A save that comes after the stop changes nothing, and gets the stopping export back.
        repository.upsert("team-a", "team-a-prod-1234", "lumi_ny", true, "B234567", now.plusSeconds(4)) shouldBe stopping

        repository.markStopAttemptFailed("team-a", now.plusSeconds(5))
        repository.find("team-a").shouldNotBeNull().stopAttemptedAt shouldBe now.plusSeconds(5)
        repository.delete("team-a") shouldBe true
    }

    test("the latest run start per team stays when the export is moved, stopped and set up again") {
        repository.upsert("team-a", "team-a-prod-1234", "lumi", false, "A123456", now)
        repository.markStarted("team-a", now.plusSeconds(5)).shouldNotBeNull().teamLastRunStartedAt shouldBe now.plusSeconds(5)

        repository.upsert("team-a", "team-a-prod-1234", "lumi_ny", false, "A123456", now.plusSeconds(10)).let { moved ->
            moved.lastRunStartedAt.shouldBeNull()
            moved.teamLastRunStartedAt shouldBe now.plusSeconds(5)
        }
        repository.delete("team-a") shouldBe true
        repository.upsert("team-a", "team-a-prod-1234", "lumi", false, "A123456", now.plusSeconds(20))
            .teamLastRunStartedAt shouldBe now.plusSeconds(5)

        // An older start never replaces a newer one.
        repository.markStarted("team-a", now.plusSeconds(1)).shouldNotBeNull().teamLastRunStartedAt shouldBe now.plusSeconds(5)
        repository.find("team-a").shouldNotBeNull().teamLastRunStartedAt shouldBe now.plusSeconds(5)
        repository.upsert("team-b", "team-b-prod-1234", "lumi", false, "A123456", now).teamLastRunStartedAt.shouldBeNull()
    }

    test("requesting a run without a destination reports that nothing was queued") {
        repository.requestRun("team-a", now) shouldBe false
        repository.delete("team-a") shouldBe false
    }

    test("streams only the team's rows inside the retention window, newest first") {
        val fresh = OffsetDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.MICROS)
        insertTestFeedbackWithJson(id = "a-new", team = "team-a", feedbackJson = """{"surveyId":"s1","answers":[]}""", opprettet = fresh.minusDays(1))
        insertTestFeedbackWithJson(id = "a-old", team = "team-a", feedbackJson = """{"surveyId":"s1","answers":[]}""", opprettet = fresh.minusDays(30))
        insertTestFeedbackWithJson(id = "a-expired", team = "team-a", feedbackJson = """{"surveyId":"s1","answers":[]}""", opprettet = fresh.minusMonths(12).minusDays(1))
        insertTestFeedbackWithJson(id = "b-new", team = "team-b", feedbackJson = """{"surveyId":"s1","answers":[]}""", opprettet = fresh.minusHours(1))
        TestDatabase.dataSource.connection.use { connection ->
            connection.createStatement().use {
                it.execute("INSERT INTO survey_metadata (team, survey_id, archived_at) VALUES ('team-a', 's1', now())")
            }
            connection.commit()
        }

        val rows = mutableListOf<BigQueryExportSourceRow>()
        repository.withExportLock { lock ->
            lock.readExportSnapshot("team-a", 12) { snapshot -> snapshot.forEachRow { rows += it } }
        }.shouldNotBeNull()

        rows.map { it.feedbackId } shouldContainExactly listOf("a-new", "a-old")
        rows.map { it.surveyId }.distinct() shouldContainExactly listOf("s1")
        rows.all { it.surveyArchived } shouldBe true
        rows.first().receivedAt shouldBe fresh.minusDays(1).toInstant()
    }

    test("a run holds one connection: the snapshot runs on the lock's connection, and the lock stays after it") {
        insertTestFeedbackWithJson(id = "a-1", team = "team-a", feedbackJson = """{"surveyId":"s1","answers":[]}""")
        val pool = (TestDatabase.dataSource as HikariDataSource).hikariPoolMXBean

        repository.withExportLock { lock ->
            lock.readExportSnapshot("team-a", 12) { snapshot ->
                snapshot.forEachRow { }
                pool.activeConnections shouldBe 1
            }
            // A second caller still cannot take the lock after the snapshot transaction ended.
            repository.withExportLock { "second" }.shouldBeNull()
        }.shouldNotBeNull()
    }

    test("only one caller at a time gets the export lock") {
        val insideLock = CompletableDeferred<Unit>()
        val release = CompletableDeferred<Unit>()
        coroutineScope {
            val holder = async {
                repository.withExportLock {
                    insideLock.complete(Unit)
                    release.await()
                    "first"
                }
            }
            insideLock.await()
            repository.withExportLock { "second" }.shouldBeNull()
            release.complete(Unit)
            holder.await() shouldBe "first"
        }
        repository.withExportLock { "third" } shouldNotBe null
    }
})
