package no.nav.lumi.repository

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import no.nav.lumi.TestDatabase
import no.nav.lumi.config.DatabaseHolder
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.config.exception.ErrorType
import no.nav.lumi.insertTestFeedback
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.andWhere
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.time.OffsetDateTime

class InMemoryAnalysisGuardTest : FunSpec({
    beforeSpec {
        DatabaseHolder.initializeForTesting(TestDatabase.dataSource)
        TestDatabase.initialize()
    }

    beforeTest {
        TestDatabase.clearAllData()
    }

    test("rejects analysis before materializing more than the configured row cap") {
        repeat(3) { index ->
            insertTestFeedback(id = "feedback-$index", team = "team-a")
        }

        val exception = shouldThrow<ApiErrorException.BadRequestException> {
            dbQuery {
                FeedbackTable.selectAll()
                    .materializeFeedbackForAnalysis(maxRows = 2)
            }
        }

        exception.type shouldBe ErrorType.ANALYSIS_BUDGET_EXCEEDED
        exception.message shouldContain "Narrow the date range or add filters"
    }

    test("allows analysis when the result is exactly at the configured row cap") {
        repeat(2) { index ->
            insertTestFeedback(id = "feedback-$index", team = "team-a")
        }

        val records = dbQuery {
            FeedbackTable.selectAll()
                .materializeFeedbackForAnalysis(maxRows = 2)
        }

        records shouldHaveSize 2
    }

    test("rejects analysis when JSON bytes exceed the configured memory budget") {
        insertTestFeedback(
            id = "large-feedback",
            team = "team-a",
            text = "x".repeat(2_000),
        )

        val exception = shouldThrow<ApiErrorException.BadRequestException> {
            dbQuery {
                FeedbackTable.selectAll()
                    .materializeFeedbackForAnalysis(
                        maxRows = 10,
                        maxJsonBytes = 128,
                    )
            }
        }

        exception.type shouldBe ErrorType.ANALYSIS_BUDGET_EXCEEDED
        exception.message shouldContain "JSON size"
    }

    test("applies SQL-compatible context filters before enforcing the analysis budget") {
        insertTestFeedback(
            id = "old-1",
            team = "team-a",
            surveyId = "survey-a",
            opprettet = OffsetDateTime.parse("2024-01-01T12:00:00Z"),
        )
        insertTestFeedback(
            id = "old-2",
            team = "team-a",
            surveyId = "survey-a",
            opprettet = OffsetDateTime.parse("2024-01-02T12:00:00Z"),
        )
        insertTestFeedback(
            id = "in-range",
            team = "team-a",
            surveyId = "survey-a",
            opprettet = OffsetDateTime.parse("2024-02-01T12:00:00Z"),
        )

        val records = dbQuery {
            val query = FeedbackTable.selectAll()
            query.andWhere { FeedbackTable.team eq "team-a" }
            query.andWhere { JsonExtract(FeedbackTable.feedbackJson, listOf("surveyId")) eq "survey-a" }
            applyContextTagAnalysisFilters(
                query = query,
                segments = emptyList(),
                fromDate = "2024-02-01",
                toDate = "2024-02-01",
                deviceType = null,
                hasText = false,
                lowRating = false,
            )
            query.materializeFeedbackForAnalysis(maxRows = 1)
        }

        records shouldHaveSize 1
    }
})
