package no.nav.lumi.repository

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import no.nav.lumi.TestDatabase
import no.nav.lumi.config.DatabaseHolder
import no.nav.lumi.domain.StatsQuery
import no.nav.lumi.insertTestFeedback
import no.nav.lumi.insertTestFeedbackWithJson

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

        test("filters by choiceFieldId and choiceValue for singleChoice and multiChoice") {
            insertTestFeedbackWithJson(
                id = "single-match",
                team = "flex",
                app = "app-test",
                feedbackJson = """
                    {
                        "surveyId": "survey-choice",
                        "answers": [
                            {"fieldId": "task_choice", "fieldType": "SINGLE_CHOICE", "question": {"label": "Velg"}, "value": {"type": "singleChoice", "selectedOptionId": "opt-1"}}
                        ]
                    }
                """.trimIndent()
            )
            insertTestFeedbackWithJson(
                id = "multi-match",
                team = "flex",
                app = "app-test",
                feedbackJson = """
                    {
                        "surveyId": "survey-choice",
                        "answers": [
                            {"fieldId": "task_choice", "fieldType": "MULTI_CHOICE", "question": {"label": "Velg"}, "value": {"type": "multiChoice", "selectedOptionIds": ["opt-1", "opt-2"]}}
                        ]
                    }
                """.trimIndent()
            )
            insertTestFeedbackWithJson(
                id = "no-match",
                team = "flex",
                app = "app-test",
                feedbackJson = """
                    {
                        "surveyId": "survey-choice",
                        "answers": [
                            {"fieldId": "task_choice", "fieldType": "SINGLE_CHOICE", "question": {"label": "Velg"}, "value": {"type": "singleChoice", "selectedOptionId": "opt-9"}}
                        ]
                    }
                """.trimIndent()
            )

            val stats = repository.getStats(
                StatsQuery(team = "flex", choiceFieldId = "task_choice", choiceValue = "opt-1")
            )

            stats.totalCount shouldBe 2L
        }

        test("returns empty stats for unknown choice optionId") {
            insertTestFeedbackWithJson(
                id = "single-match",
                team = "flex",
                app = "app-test",
                feedbackJson = """
                    {
                        "surveyId": "survey-choice",
                        "answers": [
                            {"fieldId": "task_choice", "fieldType": "SINGLE_CHOICE", "question": {"label": "Velg"}, "value": {"type": "singleChoice", "selectedOptionId": "opt-1"}}
                        ]
                    }
                """.trimIndent()
            )

            val stats = repository.getStats(
                StatsQuery(team = "flex", choiceFieldId = "task_choice", choiceValue = "unknown-option")
            )

            stats.totalCount shouldBe 0L
        }

        test("filters by choice and rating together with AND semantics") {
            insertTestFeedbackWithJson(
                id = "match-both",
                team = "flex",
                app = "app-test",
                feedbackJson = """
                    {
                        "surveyId": "survey-choice-rating",
                        "answers": [
                            {"fieldId": "task_choice", "fieldType": "SINGLE_CHOICE", "question": {"label": "Oppgave"}, "value": {"type": "singleChoice", "selectedOptionId": "opt-1"}},
                            {"fieldId": "rating_main", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 1}}
                        ]
                    }
                """.trimIndent()
            )
            insertTestFeedbackWithJson(
                id = "match-choice-only",
                team = "flex",
                app = "app-test",
                feedbackJson = """
                    {
                        "surveyId": "survey-choice-rating",
                        "answers": [
                            {"fieldId": "task_choice", "fieldType": "SINGLE_CHOICE", "question": {"label": "Oppgave"}, "value": {"type": "singleChoice", "selectedOptionId": "opt-1"}},
                            {"fieldId": "rating_main", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 3}}
                        ]
                    }
                """.trimIndent()
            )
            insertTestFeedbackWithJson(
                id = "match-rating-only",
                team = "flex",
                app = "app-test",
                feedbackJson = """
                    {
                        "surveyId": "survey-choice-rating",
                        "answers": [
                            {"fieldId": "task_choice", "fieldType": "SINGLE_CHOICE", "question": {"label": "Oppgave"}, "value": {"type": "singleChoice", "selectedOptionId": "opt-2"}},
                            {"fieldId": "rating_main", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 1}}
                        ]
                    }
                """.trimIndent()
            )

            val stats = repository.getStats(
                StatsQuery(
                    team = "flex",
                    choiceFieldId = "task_choice",
                    choiceValue = "opt-1",
                    ratingFieldId = "rating_main",
                    ratingValue = 1
                )
            )

            stats.totalCount shouldBe 1L
        }
    }
})
