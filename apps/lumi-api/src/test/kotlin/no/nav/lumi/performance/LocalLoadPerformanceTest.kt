package no.nav.lumi.performance

import io.kotest.core.spec.style.FunSpec
import no.nav.lumi.TestDatabase
import no.nav.lumi.config.DatabaseHolder
import no.nav.lumi.domain.FeedbackQuery
import no.nav.lumi.domain.PhraseFilter
import no.nav.lumi.domain.StatsQuery
import no.nav.lumi.integrations.valkey.NoopStatsCache
import no.nav.lumi.repository.FeedbackRepository
import no.nav.lumi.repository.FeedbackStatsRepository
import no.nav.lumi.service.StatsService
import java.sql.Timestamp
import java.time.OffsetDateTime
import kotlin.system.measureTimeMillis

class LocalLoadPerformanceTest : FunSpec({
    val enabled = System.getProperty("lumi.perf.enabled") == "true"

    beforeSpec {
        if (enabled) {
            DatabaseHolder.initializeForTesting(TestDatabase.dataSource)
            TestDatabase.initialize()
        }
    }

    beforeTest {
        if (enabled) {
            TestDatabase.clearAllData()
        }
    }

    test("profile stats and feedback queries with many survey responses").config(enabled = enabled) {
        val rows = System.getProperty("lumi.perf.rows")?.toIntOrNull() ?: 20_000
        val team = "team-esyfo"
        val app = "lumi-loadtest"
        val surveyId = "loadtest-rating"
        val fromDate = "2026-05-01"
        val toDate = "2026-05-30"

        val insertMs = measureTimeMillis {
            insertFeedbackBatch(rows = rows, team = team, app = app, surveyId = surveyId)
        }
        perf("seed feedback rows", rows, insertMs)

        val statsRepository = FeedbackStatsRepository()
        val feedbackRepository = FeedbackRepository()
        val statsService = StatsService(
            feedbackRepository = feedbackRepository,
            statsRepository = statsRepository,
            statsCache = NoopStatsCache(),
        )

        val baseStatsQuery = StatsQuery(
            team = team,
            app = app,
            fromDate = fromDate,
            toDate = toDate,
        )
        val surveyStatsQuery = baseStatsQuery.copy(surveyId = surveyId)
        val baseFeedbackQuery = FeedbackQuery(
            team = team,
            app = app,
            fromDate = fromDate,
            toDate = toDate,
            page = 0,
            size = 25,
            surveyId = surveyId,
        )

        timed("statsRepository.getStats 30d app", rows) {
            val result = statsRepository.getStats(baseStatsQuery)
            check(result.totalCount == rows.toLong()) {
                "Expected $rows rows, got ${result.totalCount}"
            }
        }

        timed("statsService.getDashboardStats 30d app", rows) {
            val result = statsService.getDashboardStats(baseStatsQuery)
            check(result.totalCount == rows) {
                "Expected $rows rows, got ${result.totalCount}"
            }
        }

        timed("statsService.getDashboardStats 30d survey fieldStats", rows) {
            val result = statsService.getDashboardStats(surveyStatsQuery)
            check(result.totalCount == rows) {
                "Expected $rows rows, got ${result.totalCount}"
            }
            check(result.fieldStats.isNotEmpty()) {
                "Expected fieldStats for selected survey"
            }
        }

        timed("feedbackRepository.findPaginated first page", rows) {
            val (content, total) = feedbackRepository.findPaginated(baseFeedbackQuery)
            check(total == rows.toLong()) {
                "Expected $rows rows, got $total"
            }
            check(content.size == 25) {
                "Expected one page of 25 rows, got ${content.size}"
            }
        }

        timed("feedbackRepository.findPaginated phrase filter", rows) {
            val (content, total) = feedbackRepository.findPaginated(
                baseFeedbackQuery.copy(
                    phraseFilter = PhraseFilter(
                        fieldId = "feedback",
                        surface = "vanskelig skjema",
                    ),
                ),
            )
            check(total == (rows + 1L) / 2L) {
                "Expected roughly half the rows to match phrase filter, got $total"
            }
            check(content.size == 25) {
                "Expected one page of 25 rows, got ${content.size}"
            }
        }

        timed("feedbackRepository.findDistinctApps bootstrap", rows) {
            val apps = feedbackRepository.findDistinctApps(team)
            check(apps == listOf(app)) {
                "Expected one app, got $apps"
            }
        }

        timed("feedbackRepository.findSurveysByApp bootstrap", rows) {
            val surveysByApp = feedbackRepository.findSurveysByApp(team)
            check(surveysByApp == mapOf(app to listOf(surveyId))) {
                "Expected one survey by app, got $surveysByApp"
            }
        }

        timed("feedbackRepository.findAllTags bootstrap", rows) {
            val tags = feedbackRepository.findAllTags(team)
            check(tags.isEmpty()) {
                "Expected no manual tags, got $tags"
            }
        }
    }
})

private suspend fun timed(label: String, rows: Int, block: suspend () -> Unit) {
    val start = System.nanoTime()
    block()
    val elapsedMs = (System.nanoTime() - start) / 1_000_000
    perf(label, rows, elapsedMs)
}

private fun perf(label: String, rows: Int, elapsedMs: Long) {
    println("[LUMI-PERF] $label rows=$rows elapsedMs=$elapsedMs")
}

private fun insertFeedbackBatch(rows: Int, team: String, app: String, surveyId: String) {
    val base = OffsetDateTime.parse("2026-05-01T00:00:00+02:00")
    val dateWindowMinutes = 30 * 24 * 60

    TestDatabase.dataSource.connection.use { conn ->
        conn.prepareStatement(
            """
            INSERT INTO feedback (id, opprettet, feedback_json, team, app, survey_id)
            VALUES (?, ?, ?::jsonb, ?, ?, ?)
            """.trimIndent(),
        ).use { stmt ->
            for (index in 0 until rows) {
                val submittedAt = base.plusMinutes((index % dateWindowMinutes).toLong())
                val rating = (index % 5) + 1
                val device = if (index % 3 == 0) "mobile" else "desktop"
                val pathname = "/loadtest/${index % 50}"
                val text = if (index % 2 == 0) {
                    "vanskelig skjema treg lasting nummer $index"
                } else {
                    "rask og tydelig flyt nummer $index"
                }

                stmt.setString(1, "loadtest-$index")
                stmt.setObject(2, Timestamp.from(submittedAt.toInstant()))
                stmt.setString(
                    3,
                    feedbackJson(
                        surveyId = surveyId,
                        submittedAt = submittedAt,
                        pathname = pathname,
                        device = device,
                        rating = rating,
                        text = text,
                        index = index,
                    ),
                )
                stmt.setString(4, team)
                stmt.setString(5, app)
                stmt.setString(6, surveyId)
                stmt.addBatch()

                if ((index + 1) % 1_000 == 0) {
                    stmt.executeBatch()
                }
            }
            stmt.executeBatch()
        }
        conn.commit()
    }
}

private fun feedbackJson(
    surveyId: String,
    submittedAt: OffsetDateTime,
    pathname: String,
    device: String,
    rating: Int,
    text: String,
    index: Int,
): String = """
    {
      "schemaVersion": 1,
      "surveyId": "$surveyId",
      "surveyType": "rating",
      "context": {
        "pathname": "$pathname",
        "deviceType": "$device",
        "tags": {
          "audience": "${if (index % 4 == 0) "arbeidsgiver" else "arbeidstaker"}",
          "flow": "standard"
        }
      },
      "answers": [
        {
          "fieldId": "svar",
          "fieldType": "RATING",
          "question": {"label": "Hvordan opplevde du tjenesten?"},
          "value": {"type": "rating", "rating": $rating, "ratingVariant": "emoji", "ratingScale": 5}
        },
        {
          "fieldId": "feedback",
          "fieldType": "TEXT",
          "question": {"label": "Har du tilbakemelding?"},
          "value": {"type": "text", "text": "$text"}
        },
        {
          "fieldId": "kanal",
          "fieldType": "SINGLE_CHOICE",
          "question": {
            "label": "Hvilken kanal brukte du?",
            "options": [
              {"id": "web", "label": "Web"},
              {"id": "phone", "label": "Telefon"}
            ]
          },
          "value": {"type": "singleChoice", "selectedOptionId": "${if (index % 2 == 0) "web" else "phone"}"}
        }
      ],
      "startedAt": "${submittedAt.minusMinutes(1).toInstant()}",
      "submittedAt": "${submittedAt.toInstant()}"
    }
""".trimIndent()
