package no.nav.lumi.domain

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain

class DefinitionHashTest : FunSpec({
    test("computeHash is deterministic and excludes labels") {
        val base = submission(
            surveyId = "survey-1",
            surveyType = SurveyType.RATING,
            answers = listOf(
                Answer(
                    fieldId = "rating",
                    fieldType = FieldType.RATING,
                    question = Question(label = "Hvor fornøyd er du?"),
                    value = AnswerValue.Rating(rating = 4, ratingVariant = RatingVariant.EMOJI, ratingScale = 5)
                ),
                Answer(
                    fieldId = "reason",
                    fieldType = FieldType.TEXT,
                    question = Question(label = "Hvorfor?"),
                    value = AnswerValue.Text("Bra")
                )
            )
        )

        val relabeled = base.copy(
            answers = listOf(
                base.answers[0].copy(question = Question(label = "Ny label", description = "Ny tekst")),
                base.answers[1].copy(question = Question(label = "Forklar", description = "Detaljer"))
            )
        )

        SurveyDefinition.fromSubmission(base).computeHash() shouldBe
            SurveyDefinition.fromSubmission(base).computeHash()

        SurveyDefinition.fromSubmission(base).computeHash() shouldBe
            SurveyDefinition.fromSubmission(relabeled).computeHash()
    }

    test("computeHash produces stable value (golden test)") {
        // This test guards against accidental changes to the canonical JSON format.
        // If this test breaks, ALL stored definition hashes in production are invalidated.
        val definition = SurveyDefinition(
            surveyId = "survey-1",
            surveyType = SurveyType.RATING,
            fields = listOf(
                FieldDefinition("rating", FieldType.RATING, RatingVariant.EMOJI, 5, null),
                FieldDefinition("reason", FieldType.TEXT, null, null, null)
            )
        )

        definition.computeHash() shouldBe "38202779b74caab0a97c5d0bcc1556660322ce19a700d665b02712a90af3fc9c"
    }

    test("computeHash treats structural option order as significant") {
        val first = submission(
            surveyId = "survey-choice",
            surveyType = SurveyType.TOP_TASKS,
            answers = listOf(
                Answer(
                    fieldId = "task",
                    fieldType = FieldType.SINGLE_CHOICE,
                    question = Question(
                        label = "Hva gjorde du?",
                        options = listOf(
                            ChoiceOption("a", "A"),
                            ChoiceOption("b", "B")
                        )
                    ),
                    value = AnswerValue.SingleChoice("a")
                )
            )
        )

        val second = first.copy(
            answers = listOf(
                first.answers.first().copy(
                    question = Question(
                        label = "Hva gjorde du?",
                        options = listOf(
                            ChoiceOption("b", "B"),
                            ChoiceOption("a", "A")
                        )
                    )
                )
            )
        )

        SurveyDefinition.fromSubmission(first).computeHash() shouldBe
            SurveyDefinition.fromSubmission(first).computeHash()
        (SurveyDefinition.fromSubmission(first).computeHash() ==
            SurveyDefinition.fromSubmission(second).computeHash()) shouldBe false
    }

    test("diff reports added removed and changed fields") {
        val stored = SurveyDefinition(
            surveyId = "survey-1",
            surveyType = SurveyType.RATING,
            fields = listOf(
                FieldDefinition("rating", FieldType.RATING, RatingVariant.EMOJI, 5, null),
                FieldDefinition("reason", FieldType.TEXT, null, null, null)
            )
        )

        val incoming = SurveyDefinition(
            surveyId = "survey-1",
            surveyType = SurveyType.RATING,
            fields = listOf(
                FieldDefinition("rating", FieldType.RATING, RatingVariant.NPS, 11, null),
                FieldDefinition("task", FieldType.SINGLE_CHOICE, null, null, listOf("a", "b"))
            )
        )

        val definitionDiff = diff(stored, incoming)

        definitionDiff.addedFields shouldBe listOf("task")
        definitionDiff.removedFields shouldBe listOf("reason")
        definitionDiff.changedFields.single().change shouldContain "ratingVariant EMOJI -> NPS"
    }

    test("field order does not affect hash (sorted by fieldId)") {
        val definition1 = SurveyDefinition(
            surveyId = "survey-1",
            surveyType = SurveyType.RATING,
            fields = listOf(
                FieldDefinition("rating", FieldType.RATING, RatingVariant.EMOJI, 5, null),
                FieldDefinition("reason", FieldType.TEXT, null, null, null)
            )
        )

        val definition2 = SurveyDefinition(
            surveyId = "survey-1",
            surveyType = SurveyType.RATING,
            fields = listOf(
                FieldDefinition("reason", FieldType.TEXT, null, null, null),
                FieldDefinition("rating", FieldType.RATING, RatingVariant.EMOJI, 5, null)
            )
        )

        definition1.computeHash() shouldBe definition2.computeHash()
    }

    test("diff detects field reordering") {
        val stored = SurveyDefinition(
            surveyId = "survey-1",
            surveyType = SurveyType.RATING,
            fields = listOf(
                FieldDefinition("a", FieldType.TEXT, null, null, null),
                FieldDefinition("b", FieldType.TEXT, null, null, null)
            )
        )
        val incoming = SurveyDefinition(
            surveyId = "survey-1",
            surveyType = SurveyType.RATING,
            fields = listOf(
                FieldDefinition("b", FieldType.TEXT, null, null, null),
                FieldDefinition("a", FieldType.TEXT, null, null, null)
            )
        )

        val definitionDiff = diff(stored, incoming)

        definitionDiff.changedFields.any { it.fieldId == "_fieldOrder" } shouldBe true
    }

    test("fromSubmission excludes options for non-choice types") {
        val submission = submission(
            surveyId = "survey-1",
            surveyType = SurveyType.RATING,
            answers = listOf(
                Answer(
                    fieldId = "rating",
                    fieldType = FieldType.RATING,
                    question = Question(
                        label = "Vurdering",
                        options = listOf(ChoiceOption("spurious", "Should be ignored"))
                    ),
                    value = AnswerValue.Rating(rating = 4, ratingVariant = RatingVariant.EMOJI, ratingScale = 5)
                )
            )
        )

        val definition = SurveyDefinition.fromSubmission(submission)

        definition.fields.first().optionIds shouldBe null
    }

    test("fromSubmission includes options for choice types") {
        val submission = submission(
            surveyId = "survey-choice",
            surveyType = SurveyType.TOP_TASKS,
            answers = listOf(
                Answer(
                    fieldId = "task",
                    fieldType = FieldType.SINGLE_CHOICE,
                    question = Question(
                        label = "Hva gjorde du?",
                        options = listOf(ChoiceOption("a", "A"), ChoiceOption("b", "B"))
                    ),
                    value = AnswerValue.SingleChoice("a")
                )
            )
        )

        val definition = SurveyDefinition.fromSubmission(submission)

        definition.fields.first().optionIds shouldBe listOf("a", "b")
    }
})

private fun submission(
    surveyId: String,
    surveyType: SurveyType,
    answers: List<Answer>
) = FeedbackSubmissionV1(
    schemaVersion = 1,
    surveyId = surveyId,
    surveyType = surveyType,
    submittedAt = "2026-01-10T12:00:12Z",
    answers = answers
)
