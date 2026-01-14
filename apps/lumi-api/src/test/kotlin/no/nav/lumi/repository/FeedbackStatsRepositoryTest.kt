package no.nav.lumi.repository

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import no.nav.lumi.TestDatabase
import no.nav.lumi.config.DatabaseHolder
import no.nav.lumi.domain.StatsQuery
import no.nav.lumi.insertTestFeedback

class FeedbackStatsRepositoryTest : FunSpec({
    val repository = FeedbackStatsRepository()

    beforeSpec {
        DatabaseHolder.initializeForTesting(TestDatabase.dataSource)
        TestDatabase.initialize()
    }

    beforeTest {
        TestDatabase.clearAllData()
    }

    context("getStats") {
        test("returns correct statistics") {
            insertTestFeedback(team = "flex", rating = 4)
            insertTestFeedback(team = "flex", rating = 5)
            insertTestFeedback(team = "flex", rating = 5)
            
            val stats = repository.getStats(StatsQuery(team = "flex"))
            
            stats.totalCount shouldBe 3L
        }
    }
})
