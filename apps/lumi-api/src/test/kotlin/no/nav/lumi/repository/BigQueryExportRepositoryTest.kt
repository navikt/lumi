package no.nav.lumi.repository

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
            connection.prepareStatement(
                """
                    SELECT has_schema_privilege('esyfo-analyse', 'bigquery_export', 'USAGE'),
                           has_table_privilege('esyfo-analyse', 'bigquery_export.destinations', 'SELECT'),
                           EXISTS (
                               SELECT 1 FROM pg_class c, aclexplode(c.relacl) acl
                               WHERE c.oid = 'bigquery_export.destinations'::regclass AND acl.grantee = 0
                           ),
                           EXISTS (
                               SELECT 1 FROM pg_namespace n, aclexplode(n.nspacl) acl
                               WHERE n.nspname = 'bigquery_export' AND acl.grantee = 0
                           )
                """.trimIndent(),
            ).use { statement ->
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
        repository.markStarted("team-a", now.plusSeconds(1)) shouldBe true
        repository.markSucceeded("team-a", now.plusSeconds(1), now.plusSeconds(2), BigQueryExportRowCounts(3, 1))

        val unchanged = repository.upsert("team-a", "team-a-prod-1234", "lumi", false, "B234567", now.plusSeconds(10))
        unchanged.runRequestedAt.shouldBeNull()
        unchanged.pseudonymKey.contentEquals(created.pseudonymKey) shouldBe true

        val withText = repository.upsert("team-a", "team-a-prod-1234", "lumi", true, "B234567", now.plusSeconds(20))
        withText.includeFreeText shouldBe true
        withText.runRequestedAt shouldBe now.plusSeconds(20)
        withText.pseudonymKey.contentEquals(created.pseudonymKey) shouldBe true
    }

    test("tracks a run from start to success and from start to failure") {
        repository.upsert("team-a", "team-a-prod-1234", "lumi", false, "A123456", now)
        val started = now.plusSeconds(5)
        repository.markStarted("team-a", started) shouldBe true
        repository.find("team-a").shouldNotBeNull().let {
            it.lastRunStatus shouldBe BigQueryExportRunStatus.RUNNING
            it.runRequestedAt.shouldBeNull()
        }

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
        repository.streamSourceRows("team-a", 12) { rows += it }

        rows.map { it.feedbackId } shouldContainExactly listOf("a-new", "a-old")
        rows.map { it.surveyId }.distinct() shouldContainExactly listOf("s1")
        rows.all { it.surveyArchived } shouldBe true
        rows.first().receivedAt shouldBe fresh.minusDays(1).toInstant()
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
