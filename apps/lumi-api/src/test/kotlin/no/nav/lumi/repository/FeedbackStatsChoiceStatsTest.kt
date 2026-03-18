package no.nav.lumi.repository

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.shouldBe
import no.nav.lumi.domain.Answer
import no.nav.lumi.domain.AnswerValue
import no.nav.lumi.domain.ChoiceOption
import no.nav.lumi.domain.FeedbackDto
import no.nav.lumi.domain.FieldStats
import no.nav.lumi.domain.FieldType
import no.nav.lumi.domain.Question
import no.nav.lumi.domain.SubmissionContext
import no.nav.lumi.domain.SurveyType

class FeedbackStatsChoiceStatsTest : FunSpec({
    val choiceOptions = listOf(
        ChoiceOption(id = "time", label = "Tid"),
        ChoiceOption(id = "rules", label = "Regelverk"),
        ChoiceOption(id = "systems", label = "Systemer")
    )

    fun multiChoiceAnswer(selectedOptionIds: List<String>) = Answer(
        fieldId = "hindringer",
        fieldType = FieldType.MULTI_CHOICE,
        question = Question(label = "Hindringer", options = choiceOptions),
        value = AnswerValue.MultiChoice(selectedOptionIds = selectedOptionIds)
    )

    fun feedbackDto(id: String, selectedOptionIds: List<String>) = FeedbackDto(
        id = id,
        submittedAt = "2026-03-18T09:00:00Z",
        app = "dinesykmeldte",
        surveyId = "survey-multi-choice",
        surveyType = SurveyType.CUSTOM,
        context = SubmissionContext(pathname = "/test"),
        answers = listOf(multiChoiceAnswer(selectedOptionIds))
    )

    test("buildFieldStats separates respondent count from total selections for multi choice") {
        val fieldStats = buildFieldStats(
            listOf(
                feedbackDto("a", listOf("time", "rules")),
                feedbackDto("b", listOf("time")),
                feedbackDto("c", listOf("systems"))
            )
        ).single().stats as FieldStats.Choice

        fieldStats.responseCount shouldBe 3
        fieldStats.totalSelections shouldBe 4
        fieldStats.responseRate shouldBe (1.0 plusOrMinus 0.0001)
        fieldStats.distribution["time"]?.count shouldBe 2
        fieldStats.distribution["time"]?.percentage shouldBe 67
        fieldStats.distribution["rules"]?.count shouldBe 1
        fieldStats.distribution["rules"]?.percentage shouldBe 33
        fieldStats.distribution["systems"]?.count shouldBe 1
        fieldStats.distribution["systems"]?.percentage shouldBe 33
    }
})
