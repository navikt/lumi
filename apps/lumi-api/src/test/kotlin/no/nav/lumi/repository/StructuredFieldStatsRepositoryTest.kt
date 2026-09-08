package no.nav.lumi.repository

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import no.nav.lumi.TestDatabase
import no.nav.lumi.domain.*
import no.nav.lumi.insertTestFeedbackWithJson
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.sql.Connection
import java.time.OffsetDateTime

class StructuredFieldStatsRepositoryTest : FunSpec({
    beforeSpec { TestDatabase.initialize() }
    beforeTest { TestDatabase.clearAllData() }
    val date = OffsetDateTime.parse("2026-08-01T12:00:00+02:00")
    val query = StatsQuery(team = "team-a", app = "app-a", surveyId = "survey-a")
    val definition = SurveyDefinition("survey-a", SurveyType.CUSTOM, listOf(
        FieldDefinition("score", FieldType.RATING, RatingVariant.NPS, 11, null),
        FieldDefinition("choice", FieldType.SINGLE_CHOICE, null, null, listOf("a", "b")),
        FieldDefinition("comment", FieldType.TEXT, null, null, null),
    ))

    suspend fun register() {
        SurveyDefinitionRepository().insertApiDefinitionIfUnderLimit("team-a", definition, definition.computeHash(), 100)
    }

    fun payload(answers: List<Answer>) = buildJsonObject {
        put("surveyId", "survey-a")
        put("surveyType", "custom")
        put("answers", Json.encodeToJsonElement(answers))
    }.toString()

    suspend fun insert(answers: List<Answer>, app: String = "app-a", at: OffsetDateTime = date) {
        insertTestFeedbackWithJson(team = "team-a", app = app, feedbackJson = payload(answers), opprettet = at)
    }

    test("stored catalog preserves empty fields options and NPS scale outside selected period with scoped labels") {
        register()
        insert(listOf(Answer("score", FieldType.RATING, Question("Vurder tjenesten"), AnswerValue.Rating(1, RatingVariant.NPS, 11))))
        insert(listOf(Answer("score", FieldType.RATING, Question("Annen app"), AnswerValue.Rating(2, RatingVariant.NPS, 11))), app = "app-b", at = date.plusDays(1))
        val emptyQuery = query.copy(fromDate = "2026-08-10", toDate = "2026-08-11")
        val fields = FeedbackStatsRepository().getAnalyticsStats(emptyQuery, true).fieldStats
        val emptyStats = no.nav.lumi.service.StatsService().getDashboardStats(emptyQuery)
        emptyStats.totalCount shouldBe 0
        emptyStats.surveyType shouldBe SurveyType.CUSTOM
        emptyStats.fieldStats.size shouldBe 3
        fields.map { it.fieldId } shouldBe listOf("score", "choice", "comment")
        fields.first().label shouldBe "Vurder tjenesten"
        val rating = fields.first().stats as FieldStats.Rating
        rating.ratingVariant shouldBe RatingVariant.NPS
        rating.ratingScale shouldBe 11
        rating.distribution shouldBe emptyMap()
        (fields[1].stats as FieldStats.Choice).distribution.keys.toList() shouldBe listOf("a", "b")
        (fields[1].stats as FieldStats.Choice).distribution.values.map { it.count } shouldBe listOf(0, 0)
        FeedbackStatsRepository().getAnalyticsStats(emptyQuery.copy(app = "unknown"), true).fieldStats shouldBe emptyList()
        FeedbackStatsRepository().getAnalyticsStats(emptyQuery.copy(team = "other"), true).fieldStats shouldBe emptyList()
        val trend = QuestionTrendRepository().getQuestionTrend(emptyQuery, "score", QuestionTrendInterval.DAY)!!
        trend.response.label shouldBe "Vurder tjenesten"
        trend.response.ratingVariant shouldBe RatingVariant.NPS
        trend.response.buckets shouldBe emptyList()
        QuestionTrendRepository().getQuestionTrend(emptyQuery, "missing", QuestionTrendInterval.DAY) shouldBe null
    }

    test("trend exposes exact rating distribution without inferring scale from observed low scores") {
        register()
        listOf(0, 1, 1, 9, 10).forEach { value ->
            insert(listOf(Answer("score", FieldType.RATING, Question("Score"), AnswerValue.Rating(value, RatingVariant.NPS, 11))))
        }
        val trend = QuestionTrendRepository().getQuestionTrend(query, "score", QuestionTrendInterval.DAY)!!.response
        trend.ratingScale shouldBe 11
        trend.buckets.single().ratingDistribution shouldBe mapOf("0" to 1, "1" to 2, "9" to 1, "10" to 1)
        trend.buckets.single().responseCount shouldBe 5
    }

    test("runtime definition without retained responses supplies survey type without inventing app ownership") {
        register()
        val stats = no.nav.lumi.service.StatsService().getDashboardStats(query.copy(app = null))
        stats.totalCount shouldBe 0
        stats.surveyType shouldBe SurveyType.CUSTOM
        stats.fieldStats.size shouldBe 3
        val unknownApp = no.nav.lumi.service.StatsService().getDashboardStats(query)
        unknownApp.surveyType shouldBe null
        unknownApp.fieldStats shouldBe emptyList()
    }

    test("current registered definition does not reinterpret ambiguous legacy rating semantics") {
        register()
        insert(listOf(Answer("score", FieldType.RATING, Question("Score"), AnswerValue.Rating(1))))
        insert(listOf(Answer("score", FieldType.RATING, Question("Score"), AnswerValue.Rating(1, RatingVariant.NPS, 11))))
        val rating = FeedbackStatsRepository().getAnalyticsStats(query, true).fieldStats.first().stats as FieldStats.Rating
        rating.ratingVariant shouldBe null
        rating.ratingScale shouldBe null
        rating.distribution shouldBe mapOf("1" to 2)
        QuestionTrendRepository().getQuestionTrend(query, "score", QuestionTrendInterval.DAY)!!.response.ratingVariant shouldBe null
    }

    test("legacy fields with changing types are not combined into misleading statistics") {
        insert(listOf(Answer("score", FieldType.RATING, Question("Score"), AnswerValue.Rating(1))))
        insert(listOf(Answer("score", FieldType.SINGLE_CHOICE, Question("Score"), AnswerValue.SingleChoice("a"))))
        FeedbackStatsRepository().getAnalyticsStats(query, true).fieldStats shouldBe emptyList()
        QuestionTrendRepository().getQuestionTrend(query, "score", QuestionTrendInterval.DAY)!!.fieldTypeCount shouldBe 2
    }

    test("structured counts exceed former materialization limit and text summaries disclose bounded sample") {
        register()
        val content = payload(listOf(
            Answer("score", FieldType.RATING, Question("Score"), AnswerValue.Rating(1, RatingVariant.NPS, 11)),
            Answer("comment", FieldType.TEXT, Question("Kommentar"), AnswerValue.Text("Kontakt meg på test@example.no. Enkel tjeneste.")),
        ))
        dbQuery {
            val connection = TransactionManager.current().connection.connection as Connection
            connection.prepareStatement("""
                INSERT INTO feedback (id, team, app, opprettet, feedback_json)
                SELECT 'bulk-' || n, 'team-a', 'app-a', '2026-08-01T10:00:00Z'::timestamptz + n * interval '1 second', ?::jsonb
                FROM generate_series(1, 10001) n
            """.trimIndent()).use { statement -> statement.setString(1, content); statement.executeUpdate() }
        }
        val fields = FeedbackStatsRepository().getAnalyticsStats(query, true).fieldStats
        (fields[0].stats as FieldStats.Rating).distribution shouldBe mapOf("1" to 10001)
        val text = fields[2].stats as FieldStats.Text
        text.responseCount shouldBe 10001
        text.responseRate shouldBe 1.0
        text.analysisSampleSize shouldBe 1000
        text.recentResponses.size shouldBe 5
        text.recentResponses.any { it.text.contains("test@example.no") } shouldBe false
    }

    test("dashboard aggregates and field stats use the same task filter as trend") {
        for (task in listOf("a", "a", "b")) {
            insert(listOf(
                Answer("task", FieldType.SINGLE_CHOICE, Question("Oppgave"), AnswerValue.SingleChoice(task)),
                Answer("score", FieldType.RATING, Question("Score"), AnswerValue.Rating(if (task == "a") 1 else 5, RatingVariant.EMOJI, 5)),
            ))
        }
        val filtered = query.copy(task = "a")
        FeedbackStatsRepository().getStats(filtered).totalCount shouldBe 2
        val fields = FeedbackStatsRepository().getAnalyticsStats(filtered, true).fieldStats
        (fields.first { it.fieldId == "score" }.stats as FieldStats.Rating).distribution shouldBe mapOf("1" to 2)
        QuestionTrendRepository().getQuestionTrend(filtered, "score", QuestionTrendInterval.DAY)!!.response.buckets.single().responseCount shouldBe 2
    }

    test("whitespace-only text does not count as a response or trigger a sampling disclosure") {
        for (text in listOf(" ", "\n\t", "\r\n", "Kommentar")) {
            insert(listOf(Answer("comment", FieldType.TEXT, Question("Kommentar"), AnswerValue.Text(text))))
        }
        val stats = FeedbackStatsRepository().getAnalyticsStats(query, true).fieldStats.single().stats as FieldStats.Text
        stats.responseCount shouldBe 1
        stats.responseRate shouldBe 0.25
        stats.analysisSampleSize shouldBe null
        stats.recentResponses.single().text shouldBe "Kommentar"
    }
})
