package no.nav.lumi.repository

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import no.nav.lumi.TestDatabase
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.domain.*
import no.nav.lumi.insertTestFeedbackWithJson
import no.nav.lumi.integrations.valkey.InMemoryStatsCache
import no.nav.lumi.service.ExportService
import no.nav.lumi.service.StatsService
import no.nav.lumi.sensitive.SensitiveDataFilter
import java.time.Instant

class FeedbackRedactionRepositoryTest : FunSpec({
    beforeSpec { TestDatabase.initialize() }
    beforeTest { TestDatabase.clearAllData() }
    val repository = FeedbackRedactionRepository()
    val feedback = FeedbackRepository()

    test("masking changes only the selected text and preserves rating, context, ids and tags") {
        val id = seedText("Bra skjema. Mvh Ola Nordmann")
        repository.redact(id, "team-test", "A123456", selection("Bra skjema. Mvh Ola Nordmann", "Ola Nordmann")) shouldBe true
        val raw = feedback.findRawById(id, "team-test")!!
        raw.feedbackJson shouldNotContain "Ola Nordmann"
        val dto = feedback.findById(id, "team-test")!!
        dto.sensitiveDataRedacted shouldBe true
        (dto.answers.first().value as AnswerValue.Rating).rating shouldBe 5
        (dto.answers[1].value as AnswerValue.Text).text shouldBe "Bra skjema. Mvh [TEKST FJERNET]"
        (dto.answers[2].value as AnswerValue.Text).text shouldBe "Behold dette svaret"
        dto.context!!.pathname shouldBe "/test"
        dto.tags shouldBe listOf("testtagg")
        repository.generation("team-test") shouldBe 1L
        repository.generation("flex") shouldBe 0L
    }

    test("display-time automatic masking defines the selectable offsets") {
        val raw = "Skriv til person@example.no. Mvh Ola Nordmann"
        val visible = SensitiveDataFilter.DEFAULT.redact(raw).redactedText
        val id = seedText(raw)
        repository.redact(id, "team-test", "A123456", selection(visible, "Ola Nordmann")) shouldBe true
        val stored = feedback.findRawById(id, "team-test")!!.feedbackJson
        stored shouldNotContain "person@example.no"
        stored shouldNotContain "Ola Nordmann"
        stored shouldContain "E-POST FJERNET"
    }

    test("another team cannot modify a response or create an audit event") {
        val id = seedText("Mvh Ola Nordmann")
        repository.redact(id, "flex", "A123456", selection("Mvh Ola Nordmann", "Ola Nordmann")) shouldBe false
        repository.generation("flex") shouldBe 0L
        feedback.findRawById(id, "team-test")!!.feedbackJson shouldContain "Ola Nordmann"
    }

    test("simultaneous masks cannot apply selections to a changed answer") {
        val text = "Mvh Ola Nordmann"
        val id = seedText(text)
        val results = coroutineScope {
            listOf("Ola", "Nordmann").map { part ->
                async { runCatching { repository.redact(id, "team-test", "A123456", selection(text, part)) } }
            }.awaitAll()
        }
        results.count { it.isSuccess } shouldBe 1
        (results.single { it.isFailure }.exceptionOrNull() is ApiErrorException.ConflictException) shouldBe true
        repository.generation("team-test") shouldBe 1L
        sqlLong("SELECT count(*) FROM feedback_redaction.events") shouldBe 1L
    }

    test("non-text answers and stale fingerprints are rejected without writes") {
        val text = "Mvh Ola Nordmann"
        val id = seedText(text)
        shouldThrow<ApiErrorException.BadRequestException> {
            repository.redact(id, "team-test", "A123456", selection(text, "Ola").copy(fieldId = "rating"))
        }
        shouldThrow<ApiErrorException.ConflictException> {
            repository.redact(id, "team-test", "A123456", selection("different answer", "answer"))
        }
        repository.generation("team-test") shouldBe 0L
    }

    test("simultaneous changes to different fields preserve both changes and the actor pseudonym") {
        val text = "Mvh Ola Nordmann"
        val id = seedText(text)
        coroutineScope {
            listOf(
                selection(text, "Ola Nordmann"),
                selection("Behold dette svaret", "svaret").copy(fieldId = "second"),
            ).map { input -> async { repository.redact(id, "team-test", "A123456", input) } }.awaitAll()
                .all { it } shouldBe true
        }
        val stored = feedback.findRawById(id, "team-test")!!.feedbackJson
        stored shouldNotContain "Ola Nordmann"
        stored shouldNotContain "dette svaret"
        repository.generation("team-test") shouldBe 2L
        sqlLong("SELECT count(DISTINCT actor) FROM feedback_redaction.events") shouldBe 1L
    }

    test("audit records retain no original text or raw identity and are deleted with the response") {
        val text = "Mvh Ola Nordmann"
        val id = seedText(text)
        repository.redact(id, "team-test", "A123456", selection(text, "Ola Nordmann"))
        val event = sqlText("SELECT row_to_json(e)::text FROM feedback_redaction.events e")
        event shouldNotContain "Ola Nordmann"
        event shouldNotContain "A123456"
        event shouldNotContain textRedactionHash(text)
        event shouldContain "occurred_at"
        event shouldContain "feedback"
        feedback.delete(id, "team-test") shouldBe true
        sqlLong("SELECT count(*) FROM feedback_redaction.events") shouldBe 0L
    }

    test("a late cache write cannot resurrect the old namespace, even in a different service instance") {
        val text = "Mvh Ola Nordmann"
        val id = seedText(text)
        val cache = InMemoryStatsCache()
        val first = StatsService(statsCache = cache)
        val query = StatsQuery(team = "team-test")
        val oldKey = first.redactionAwareCacheKey("dashboard", query)
        val oldStats = first.getDashboardStats(query).copy(totalCount = 999)
        repository.redact(id, "team-test", "A123456", selection(text, "Ola Nordmann"))
        cache.set(oldKey, Json.encodeToString(oldStats))
        val next = StatsService(statsCache = cache)
        next.redactionAwareCacheKey("dashboard", query) shouldNotBe oldKey
        next.getDashboardStats(query).totalCount shouldBe 1
    }

    test("search, downloads and the BigQuery snapshot use only the masked text") {
        val text = "Bra skjema. Mvh Ola Nordmann"
        val id = seedText(text)
        val exports = BigQueryExportRepository()
        exports.upsert("team-test", "test-project", "lumi", true, "test-actor", Instant.now())
        TestDatabase.dataSource.connection.use { connection ->
            connection.createStatement().use { it.executeUpdate("UPDATE bigquery_export.destinations SET run_requested_at = NULL") }
            connection.commit()
        }
        repository.redact(id, "team-test", "A123456", selection(text, "Ola Nordmann"))
        exports.find("team-test")!!.runRequestedAt shouldNotBe null
        feedback.findPaginated(FeedbackQuery(team = "team-test", query = "Nordmann")).second shouldBe 0L
        val service = ExportService()
        val rows = service.getFeedbackForExport(FeedbackQuery(team = "team-test")).feedbacks
        service.exportToJson(rows) shouldNotContain "Ola Nordmann"
        service.exportToCsv(rows) shouldNotContain "Ola Nordmann"
        org.apache.poi.xssf.usermodel.XSSFWorkbook(service.exportToExcel(rows).inputStream()).use { workbook ->
            val cells = workbook.getSheetAt(0).flatMap { row -> row.map { it.toString() } }.joinToString(" ")
            cells shouldNotContain "Ola Nordmann"
            cells shouldContain "TEKST FJERNET"
        }
        exports.withExportLock { lock ->
            lock.readExportSnapshot("team-test", 12) { snapshot ->
                snapshot.forEachRow { row ->
                    row.feedbackJson shouldNotContain "Ola Nordmann"
                    row.feedbackJson shouldContain "TEKST FJERNET"
                }
            }
        }
    }

    test("failure to queue the exported copy rolls back the text, audit and generation") {
        val copyQueue = mockk<BigQueryExportRepository>()
        coEvery { copyQueue.requestRun(any(), any()) } throws IllegalStateException("queue unavailable")
        val id = seedText("Mvh Ola Nordmann")
        shouldThrow<IllegalStateException> {
            FeedbackRedactionRepository(copyQueue).redact(id, "team-test", "A123456", selection("Mvh Ola Nordmann", "Ola"))
        }
        feedback.findRawById(id, "team-test")!!.feedbackJson shouldContain "Ola Nordmann"
        repository.generation("team-test") shouldBe 0L
        sqlLong("SELECT count(*) FROM feedback_redaction.events") shouldBe 0L
    }

    test("the legacy analysis role cannot read the private audit or actor key") {
        sqlLong("SELECT CASE WHEN has_schema_privilege('esyfo-analyse', 'feedback_redaction', 'USAGE') THEN 1 ELSE 0 END") shouldBe 0L
        sqlLong("SELECT CASE WHEN has_table_privilege('esyfo-analyse', 'feedback_redaction.team_state', 'SELECT') THEN 1 ELSE 0 END") shouldBe 0L
        sqlLong("SELECT CASE WHEN has_table_privilege('esyfo-analyse', 'feedback_redaction.events', 'SELECT') THEN 1 ELSE 0 END") shouldBe 0L
    }
})

private fun selection(text: String, part: String): RedactFeedbackInput =
    RedactFeedbackInput("feedback", textRedactionHash(text), listOf(TextRedactionRange(text.indexOf(part), text.indexOf(part) + part.length)))

private fun seedText(text: String): String {
    val id = java.util.UUID.randomUUID().toString()
    insertTestFeedbackWithJson(id = id, tags = "testtagg", feedbackJson = buildJsonObject {
        put("schemaVersion", 1)
        put("surveyId", "survey-test")
        put("surveyType", "custom")
        putJsonObject("context") { put("pathname", "/test") }
        putJsonArray("answers") {
            add(buildJsonObject {
                put("fieldId", "rating"); put("fieldType", "RATING")
                putJsonObject("question") { put("label", "Vurdering") }
                putJsonObject("value") { put("type", "rating"); put("rating", 5) }
            })
            listOf("feedback" to text, "second" to "Behold dette svaret").forEach { (field, answer) ->
                add(buildJsonObject {
                    put("fieldId", field); put("fieldType", "TEXT")
                    putJsonObject("question") { put("label", "Tilbakemelding") }
                    putJsonObject("value") { put("type", "text"); put("text", answer) }
                })
            }
        }
    }.toString())
    return id
}

private fun sqlLong(sql: String): Long = TestDatabase.dataSource.connection.use { connection ->
    connection.createStatement().use { statement -> statement.executeQuery(sql).use { result -> result.next(); result.getLong(1) } }
}

private fun sqlText(sql: String): String = TestDatabase.dataSource.connection.use { connection ->
    connection.createStatement().use { statement -> statement.executeQuery(sql).use { result -> result.next(); result.getString(1) } }
}
