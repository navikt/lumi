package no.nav.lumi.repository

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.string.shouldContain
import no.nav.lumi.TestDatabase
import no.nav.lumi.config.DatabaseHolder
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.insertTestFeedback
import org.jetbrains.exposed.v1.jdbc.selectAll

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
})
