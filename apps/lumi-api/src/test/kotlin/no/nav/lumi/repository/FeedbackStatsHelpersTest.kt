package no.nav.lumi.repository

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.shouldBe
import no.nav.lumi.domain.Answer
import no.nav.lumi.domain.AnswerValue
import no.nav.lumi.domain.ChoiceOption
import no.nav.lumi.domain.FeedbackDto
import no.nav.lumi.domain.FieldStats
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

    fun textAnswer(text: String = "Kommentar") = Answer(
        fieldId = "text-comment",
        fieldType = FieldType.TEXT,
        question = Question(label = "Q3"),
        value = AnswerValue.Text(text = text)
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

    test("buildFieldStats fallback ordering for optional fields does not depend on input order") {
        val representative = feedbackDto(
            id = "zzz",
            submittedAt = "2026-01-21T10:00:00Z",
            answers = listOf(
                ratingAnswer(),
                singleChoiceAnswer(),
                textAnswer()
            )
        )
        val optionalFieldRecord = feedbackDto(
            id = "aaa",
            submittedAt = "2026-01-21T10:00:00Z",
            answers = listOf(
                ratingAnswer(),
                singleChoiceAnswer(),
                multiChoiceAnswer()
            )
        )

        val fieldIdsInForwardOrder = buildFieldStats(
            listOf(representative, optionalFieldRecord)
        ).map { it.fieldId }
        val fieldIdsInReverseOrder = buildFieldStats(
            listOf(optionalFieldRecord, representative)
        ).map { it.fieldId }

        fieldIdsInForwardOrder shouldBe listOf(
            "svar",
            "single-choice",
            "text-comment",
            "multi-choice"
        )
        fieldIdsInReverseOrder shouldBe fieldIdsInForwardOrder
    }

    test("buildFieldStats returns top phrases with per-response deduplication and max 10 entries") {
        val repeatedPhraseText = "digital søknad digital søknad hjelper"
        val longPhraseText = "anker bjerk cider drage elgen fabel glimt havet isbre jolle kanel lampe måne"
        val uniquePhraseText = "ensom frase unik"

        val textStats = buildFieldStats(
            listOf(
                feedbackDto(
                    id = "text-1",
                    submittedAt = "2026-01-21T10:00:00Z",
                    answers = listOf(textAnswer(repeatedPhraseText))
                ),
                feedbackDto(
                    id = "text-2",
                    submittedAt = "2026-01-21T10:01:00Z",
                    answers = listOf(textAnswer("digitale søknader hjelper"))
                ),
                feedbackDto(
                    id = "text-3",
                    submittedAt = "2026-01-21T10:02:00Z",
                    answers = listOf(textAnswer("digital søknad fungerer"))
                ),
                feedbackDto(
                    id = "text-4",
                    submittedAt = "2026-01-21T10:03:00Z",
                    answers = listOf(textAnswer(longPhraseText))
                ),
                feedbackDto(
                    id = "text-5",
                    submittedAt = "2026-01-21T10:04:00Z",
                    answers = listOf(textAnswer(longPhraseText))
                ),
                feedbackDto(
                    id = "text-6",
                    submittedAt = "2026-01-21T10:05:00Z",
                    answers = listOf(textAnswer(uniquePhraseText))
                )
            )
        ).single().stats as FieldStats.Text

        textStats.topPhrases shouldHaveSize 10
        textStats.topPhrases.map { it.text } shouldContain "digital søknad"
        textStats.topPhrases.map { it.text } shouldContain "anker bjerk"
        textStats.topPhrases.map { it.text } shouldNotContain "ensom frase"
        textStats.topPhrases.first { it.text == "digital søknad" }.count shouldBe 3
    }
})
