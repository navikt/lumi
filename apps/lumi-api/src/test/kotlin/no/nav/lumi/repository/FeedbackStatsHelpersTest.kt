package no.nav.lumi.repository

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import no.nav.lumi.domain.Answer
import no.nav.lumi.domain.AnswerValue
import no.nav.lumi.domain.ChoiceOption
import no.nav.lumi.domain.FeedbackDto
import no.nav.lumi.domain.FieldType
import no.nav.lumi.domain.Question
import no.nav.lumi.domain.SurveyType
import no.nav.lumi.domain.SubmissionContext

class FeedbackStatsHelpersTest : FunSpec({
    val choiceOptions = listOf(
        ChoiceOption(id = "often", label = "Ofte"),
        ChoiceOption(id = "time", label = "Tid"),
        ChoiceOption(id = "rules", label = "Regler")
    )

    fun ratingAnswer() = Answer(
        fieldId = "svar",
        fieldType = FieldType.RATING,
        question = Question(label = "Q1"),
        value = AnswerValue.Rating(rating = 5)
    )

    fun singleChoiceAnswer() = Answer(
        fieldId = "single-choice",
        fieldType = FieldType.SINGLE_CHOICE,
        question = Question(label = "Q2", options = choiceOptions),
        value = AnswerValue.SingleChoice(selectedOptionId = "often")
    )

    fun textAnswer() = Answer(
        fieldId = "text-comment",
        fieldType = FieldType.TEXT,
        question = Question(label = "Q3"),
        value = AnswerValue.Text(text = "Kommentar")
    )

    fun multiChoiceAnswer() = Answer(
        fieldId = "multi-choice",
        fieldType = FieldType.MULTI_CHOICE,
        question = Question(label = "Q4", options = choiceOptions),
        value = AnswerValue.MultiChoice(selectedOptionIds = listOf("time", "rules"))
    )

    fun feedbackDto(
        id: String,
        submittedAt: String,
        answers: List<Answer>
    ) = FeedbackDto(
        id = id,
        submittedAt = submittedAt,
        app = "syfo-oppfolgingsplan-frontend",
        surveyId = "survey-ordering",
        surveyType = SurveyType.CUSTOM,
        context = SubmissionContext(pathname = "/ordering"),
        answers = answers
    )

    test("buildFieldStats prefers latest submittedAt when answer counts tie") {
        val olderOrder = feedbackDto(
            id = "aaa",
            submittedAt = "2026-01-21T09:59:00Z",
            answers = listOf(
                ratingAnswer(),
                textAnswer(),
                singleChoiceAnswer(),
                multiChoiceAnswer()
            )
        )
        val newerOrder = feedbackDto(
            id = "bbb",
            submittedAt = "2026-01-21T10:00:00Z",
            answers = listOf(
                ratingAnswer(),
                singleChoiceAnswer(),
                textAnswer(),
                multiChoiceAnswer()
            )
        )

        val fieldStats = buildFieldStats(listOf(olderOrder, newerOrder))

        fieldStats.map { it.fieldId } shouldBe listOf(
            "svar",
            "single-choice",
            "text-comment",
            "multi-choice"
        )
    }

    test("buildFieldStats falls back to id when answer count and submittedAt tie") {
        val lowerId = feedbackDto(
            id = "aaa",
            submittedAt = "2026-01-21T10:00:00Z",
            answers = listOf(
                ratingAnswer(),
                textAnswer(),
                singleChoiceAnswer(),
                multiChoiceAnswer()
            )
        )
        val higherId = feedbackDto(
            id = "zzz",
            submittedAt = "2026-01-21T10:00:00Z",
            answers = listOf(
                ratingAnswer(),
                singleChoiceAnswer(),
                textAnswer(),
                multiChoiceAnswer()
            )
        )

        val fieldStats = buildFieldStats(listOf(lowerId, higherId))

        fieldStats.map { it.fieldId } shouldBe listOf(
            "svar",
            "single-choice",
            "text-comment",
            "multi-choice"
        )
    }
})
