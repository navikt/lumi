package no.nav.lumi.repository

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import no.nav.lumi.TestDatabase

class SurveyMetadataRepositoryTest : FunSpec({
    val repository = SurveyMetadataRepository()

    beforeSpec {
        TestDatabase.initialize()
    }

    beforeTest {
        TestDatabase.clearAllData()
    }

    test("archive creates a metadata row with archivedAt and archivedBy") {
        val state = repository.archive(team = "team-test", surveyId = "survey-1", archivedBy = "A123456")

        state.surveyId shouldBe "survey-1"
        state.archivedAt shouldNotBe null
        state.archivedBy shouldBe "A123456"
    }

    test("archive is idempotent and keeps the original archivedAt and archivedBy") {
        val first = repository.archive(team = "team-test", surveyId = "survey-1", archivedBy = "A123456")
        val second = repository.archive(team = "team-test", surveyId = "survey-1", archivedBy = "B999999")

        second.archivedAt shouldBe first.archivedAt
        second.archivedBy shouldBe "A123456"
    }

    test("unarchive clears archivedAt but keeps the row") {
        repository.archive(team = "team-test", surveyId = "survey-1", archivedBy = "A123456")

        repository.unarchive(team = "team-test", surveyId = "survey-1") shouldBe true

        val states = repository.findByTeam("team-test")
        states.size shouldBe 1
        states.single().archivedAt shouldBe null
    }

    test("unarchive without an existing row reports no change") {
        repository.unarchive(team = "team-test", surveyId = "never-archived") shouldBe false
    }

    test("re-archive after unarchive sets a fresh archivedAt and archivedBy") {
        repository.archive(team = "team-test", surveyId = "survey-1", archivedBy = "A123456")
        repository.unarchive(team = "team-test", surveyId = "survey-1")

        val state = repository.archive(team = "team-test", surveyId = "survey-1", archivedBy = "B999999")

        state.archivedAt shouldNotBe null
        state.archivedBy shouldBe "B999999"
    }

    test("findByTeam only returns rows for the given team") {
        repository.archive(team = "team-test", surveyId = "survey-1", archivedBy = "A123456")
        repository.archive(team = "flex", surveyId = "survey-2", archivedBy = "A123456")

        repository.findByTeam("team-test").map { it.surveyId } shouldBe listOf("survey-1")
    }
})
