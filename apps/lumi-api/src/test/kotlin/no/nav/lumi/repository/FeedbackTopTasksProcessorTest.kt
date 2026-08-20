package no.nav.lumi.repository

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import no.nav.lumi.domain.Answer
import no.nav.lumi.domain.AnswerValue
import no.nav.lumi.domain.ChoiceOption
import no.nav.lumi.domain.FeedbackDto
import no.nav.lumi.domain.FieldType
import no.nav.lumi.domain.Question
import no.nav.lumi.domain.SurveyType

class FeedbackTopTasksProcessorTest : FunSpec({
    test("reads the canonical task, success and blocker fields") {
        val taskOptions = listOf(ChoiceOption("apply", "Søke"))
        val successOptions = listOf(
            ChoiceOption("yes", "Ja"),
            ChoiceOption("partial", "Delvis"),
            ChoiceOption("no", "Nei")
        )
        val feedback = FeedbackDto(
            id = "feedback-1",
            submittedAt = "2026-08-20T12:00:00Z",
            app = "test-app",
            surveyId = "top-tasks-test",
            surveyType = SurveyType.TOP_TASKS,
            answers = listOf(
                Answer(
                    fieldId = "task",
                    fieldType = FieldType.SINGLE_CHOICE,
                    question = Question("Hva prøvde du å gjøre?", options = taskOptions),
                    value = AnswerValue.SingleChoice("apply")
                ),
                Answer(
                    fieldId = "success",
                    fieldType = FieldType.SINGLE_CHOICE,
                    question = Question("Klarte du det?", options = successOptions),
                    value = AnswerValue.SingleChoice("partial")
                ),
                Answer(
                    fieldId = "blocker",
                    fieldType = FieldType.TEXT,
                    question = Question("Hva hindret deg?"),
                    value = AnswerValue.Text("Fant ikke skjemaet")
                )
            )
        )

        val result = processTopTasks(listOf(feedback))

        result.totalSubmissions shouldBe 1
        result.tasks.shouldHaveSize(1)
        result.tasks.single().task shouldBe "Søke"
        result.tasks.single().taskId shouldBe "apply"
        result.tasks.single().partialCount shouldBe 1
        result.tasks.single().blockerCounts shouldBe mapOf("Fant ikke skjemaet" to 1)
    }

    test("groups by stable task id when the displayed label changes") {
        fun feedback(id: String, submittedAt: String, label: String) = FeedbackDto(
            id = id,
            submittedAt = submittedAt,
            app = "test-app",
            surveyId = "top-tasks-test",
            surveyType = SurveyType.TOP_TASKS,
            answers = listOf(
                Answer(
                    fieldId = "task",
                    fieldType = FieldType.SINGLE_CHOICE,
                    question = Question("Hva prøvde du å gjøre?", options = listOf(ChoiceOption("apply", label))),
                    value = AnswerValue.SingleChoice("apply")
                ),
                Answer(
                    fieldId = "success",
                    fieldType = FieldType.SINGLE_CHOICE,
                    question = Question(
                        "Klarte du det?",
                        options = listOf(
                            ChoiceOption("yes", "Ja"),
                            ChoiceOption("partial", "Delvis"),
                            ChoiceOption("no", "Nei")
                        )
                    ),
                    value = AnswerValue.SingleChoice("yes")
                )
            )
        )

        val result = processTopTasks(
            listOf(
                feedback("first", "2026-08-19T12:00:00Z", "Søke"),
                feedback("second", "2026-08-20T12:00:00Z", "Sende søknad"),
            )
        )

        result.tasks.shouldHaveSize(1)
        result.tasks.single().taskId shouldBe "apply"
        result.tasks.single().task shouldBe "Sende søknad"
        result.tasks.single().totalCount shouldBe 2
    }

    test("ignores the discovery-only legacy task alias in Top Tasks") {
        val successOptions = listOf(
            ChoiceOption("yes", "Ja"),
            ChoiceOption("partial", "Delvis"),
            ChoiceOption("no", "Nei")
        )
        val feedback = FeedbackDto(
            id = "feedback-alias",
            submittedAt = "2026-08-20T12:00:00Z",
            app = "test-app",
            surveyId = "top-tasks-test",
            surveyType = SurveyType.TOP_TASKS,
            answers = listOf(
                Answer(
                    fieldId = "discoveredTask",
                    fieldType = FieldType.TEXT,
                    question = Question("Ekstra discovery-felt"),
                    value = AnswerValue.Text("Feil oppgave")
                ),
                Answer(
                    fieldId = "task",
                    fieldType = FieldType.SINGLE_CHOICE,
                    question = Question(
                        "Hva prøvde du å gjøre?",
                        options = listOf(ChoiceOption("apply", "Søke"))
                    ),
                    value = AnswerValue.SingleChoice("apply")
                ),
                Answer(
                    fieldId = "success",
                    fieldType = FieldType.SINGLE_CHOICE,
                    question = Question("Klarte du det?", options = successOptions),
                    value = AnswerValue.SingleChoice("yes")
                )
            )
        )

        val result = processTopTasks(listOf(feedback))
        result.tasks.single().taskId shouldBe "apply"
        result.tasks.single().task shouldBe "Søke"
    }
})
