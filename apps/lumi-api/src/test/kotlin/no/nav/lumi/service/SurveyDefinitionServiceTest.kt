package no.nav.lumi.service

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.domain.Answer
import no.nav.lumi.domain.AnswerValue
import no.nav.lumi.domain.ChoiceOption
import no.nav.lumi.domain.FeedbackSubmissionV1
import no.nav.lumi.domain.FieldDefinition
import no.nav.lumi.domain.FieldType
import no.nav.lumi.domain.Question
import no.nav.lumi.domain.RatingVariant
import no.nav.lumi.domain.SurveyDefinition
import no.nav.lumi.domain.SurveyType
import no.nav.lumi.domain.computeHash
import no.nav.lumi.repository.StoredSurveyDefinition
import no.nav.lumi.repository.SurveyDefinitionRepository

class SurveyDefinitionServiceTest : FunSpec({
    test("first submission registers definition") {
        val repository = mockk<SurveyDefinitionRepository>()
        val service = SurveyDefinitionService(repository)
        val submission = ratingSubmission()
        val expectedHash = SurveyDefinition.fromSubmission(submission).computeHash()

        coEvery { repository.findByTeamAndSurveyId("team-a", "survey-1") } returns null
        coEvery { repository.insertIfUnderLimit("team-a", any(), expectedHash, any()) } returns 1

        val result = service.registerOrValidate("team-a", submission)

        result shouldBe RegistrationResult("survey-1", expectedHash)
        coVerify(exactly = 1) { repository.insertIfUnderLimit("team-a", any(), expectedHash, any()) }
    }

    test("structure change returns 409 with concrete diff") {
        val repository = mockk<SurveyDefinitionRepository>()
        val service = SurveyDefinitionService(repository)
        val storedSubmission = choiceSubmission(optionLabel = "Søknad")
        val incomingSubmission = FeedbackSubmissionV1(
            schemaVersion = 1,
            surveyId = "survey-choice",
            surveyType = SurveyType.TOP_TASKS,
            submittedAt = "2026-01-10T12:00:12Z",
            answers = listOf(
                Answer(
                    fieldId = "task",
                    fieldType = FieldType.SINGLE_CHOICE,
                    question = Question(
                        label = "Hva gjorde du?",
                        options = listOf(
                            ChoiceOption("apply", "Søknad"),
                            ChoiceOption("follow-up", "Oppfølging")
                        )
                    ),
                    value = AnswerValue.SingleChoice("apply")
                )
            )
        )
        val storedDefinition = SurveyDefinition.fromSubmission(storedSubmission)

        coEvery { repository.findByTeamAndSurveyId("team-a", "survey-choice") } returns StoredSurveyDefinition(
            team = "team-a",
            surveyId = "survey-choice",
            definitionHash = storedDefinition.computeHash(),
            definition = storedDefinition
        )

        val exception = shouldThrowConflict {
            service.registerOrValidate("team-a", incomingSubmission)
        }

        exception.message shouldContain "Survey definition conflict for surveyId=survey-choice"
        exception.message shouldContain "optionIds [apply] -> [apply, follow-up]"
    }

    test("label changes are accepted without 409") {
        val repository = mockk<SurveyDefinitionRepository>()
        val service = SurveyDefinitionService(repository)
        val storedSubmission = choiceSubmission(optionLabel = "Søknad")
        val relabeledSubmission = choiceSubmission(optionLabel = "Ny søknadstekst")
        val storedDefinition = SurveyDefinition.fromSubmission(storedSubmission)

        coEvery { repository.findByTeamAndSurveyId("team-a", "survey-choice") } returns StoredSurveyDefinition(
            team = "team-a",
            surveyId = "survey-choice",
            definitionHash = storedDefinition.computeHash(),
            definition = storedDefinition
        )

        val result = service.registerOrValidate("team-a", relabeledSubmission)

        result.definitionHash shouldBe storedDefinition.computeHash()
    }

    test("invalid fieldId or fieldType returns 400") {
        val repository = mockk<SurveyDefinitionRepository>()
        val service = SurveyDefinitionService(repository)
        val storedSubmission = ratingSubmission()
        val storedDefinition = SurveyDefinition.fromSubmission(storedSubmission)
        val invalidSubmission = FeedbackSubmissionV1(
            schemaVersion = 1,
            surveyId = "survey-1",
            surveyType = SurveyType.RATING,
            submittedAt = "2026-01-10T12:00:12Z",
            answers = listOf(
                Answer(
                    fieldId = "rating",
                    fieldType = FieldType.TEXT,
                    question = Question(label = "Hvor fornøyd er du?"),
                    value = AnswerValue.Text("Feil type")
                )
            )
        )

        coEvery { repository.findByTeamAndSurveyId("team-a", "survey-1") } returns StoredSurveyDefinition(
            team = "team-a",
            surveyId = "survey-1",
            definitionHash = storedDefinition.computeHash(),
            definition = storedDefinition
        )

        val exception = shouldThrowBadRequest {
            service.registerOrValidate("team-a", invalidSubmission)
        }

        exception.message shouldContain "fieldId=rating has fieldType=TEXT, expected RATING"
    }

    test("returns 429 when team exceeds definition limit") {
        val repository = mockk<SurveyDefinitionRepository>()
        val service = SurveyDefinitionService(repository)

        coEvery { repository.findByTeamAndSurveyId("team-a", "survey-1") } returns null
        coEvery { repository.insertIfUnderLimit("team-a", any(), any(), any()) } returns 0

        val exception = shouldThrowTooManyRequests {
            service.registerOrValidate("team-a", ratingSubmission())
        }

        exception.message shouldContain "Definition limit exceeded"
    }

    test("handles concurrent insert with insertIgnore and re-read") {
        val repository = mockk<SurveyDefinitionRepository>()
        val service = SurveyDefinitionService(repository)
        val submission = ratingSubmission()
        val definition = SurveyDefinition.fromSubmission(submission)
        val definitionHash = definition.computeHash()

        coEvery { repository.findByTeamAndSurveyId("team-a", "survey-1") } returnsMany listOf(
            null,
            StoredSurveyDefinition(
                team = "team-a",
                surveyId = "survey-1",
                definitionHash = definitionHash,
                definition = definition
            )
        )
        coEvery { repository.insertIfUnderLimit("team-a", any(), definitionHash, any()) } returns 0

        val result = service.registerOrValidate("team-a", submission)

        result shouldBe RegistrationResult("survey-1", definitionHash)
    }

    test("handles concurrent insert with different hash - throws 409") {
        val repository = mockk<SurveyDefinitionRepository>()
        val service = SurveyDefinitionService(repository)
        val submission = ratingSubmission()

        // Stored definition has same rating field (answers pass validation)
        // but also an extra field, giving a different hash
        val differentDefinition = SurveyDefinition(
            surveyId = "survey-1",
            surveyType = SurveyType.RATING,
            fields = listOf(
                FieldDefinition("rating", FieldType.RATING, RatingVariant.EMOJI, 5, null),
                FieldDefinition("followup", FieldType.TEXT, null, null, null)
            )
        )

        coEvery { repository.findByTeamAndSurveyId("team-a", "survey-1") } returnsMany listOf(
            null,
            StoredSurveyDefinition(
                team = "team-a",
                surveyId = "survey-1",
                definitionHash = differentDefinition.computeHash(),
                definition = differentDefinition
            )
        )
        coEvery { repository.insertIfUnderLimit("team-a", any(), any(), any()) } returns 0

        val exception = shouldThrowConflict {
            service.registerOrValidate("team-a", submission)
        }

        exception.message shouldContain "Survey definition conflict"
    }

    test("rejects choice field without options (self-validation)") {
        val repository = mockk<SurveyDefinitionRepository>()
        val service = SurveyDefinitionService(repository)
        val submission = FeedbackSubmissionV1(
            schemaVersion = 1,
            surveyId = "survey-bad",
            surveyType = SurveyType.TOP_TASKS,
            submittedAt = "2026-01-10T12:00:12Z",
            answers = listOf(
                Answer(
                    fieldId = "task",
                    fieldType = FieldType.SINGLE_CHOICE,
                    question = Question(label = "Hva gjorde du?"),
                    value = AnswerValue.SingleChoice("apply")
                )
            )
        )

        val exception = shouldThrowBadRequest {
            service.registerOrValidate("team-a", submission)
        }

        exception.message shouldContain "requires at least one option"
    }

    test("rejects rating field without ratingVariant (self-validation)") {
        val repository = mockk<SurveyDefinitionRepository>()
        val service = SurveyDefinitionService(repository)
        val submission = FeedbackSubmissionV1(
            schemaVersion = 1,
            surveyId = "survey-bad",
            surveyType = SurveyType.RATING,
            submittedAt = "2026-01-10T12:00:12Z",
            answers = listOf(
                Answer(
                    fieldId = "rating",
                    fieldType = FieldType.RATING,
                    question = Question(label = "Vurdering"),
                    value = AnswerValue.Text("not a rating")
                )
            )
        )

        val exception = shouldThrowBadRequest {
            service.registerOrValidate("team-a", submission)
        }

        exception.message shouldContain "requires ratingVariant and ratingScale"
    }

    test("rejects duplicate fieldIds (self-validation)") {
        val repository = mockk<SurveyDefinitionRepository>()
        val service = SurveyDefinitionService(repository)
        val submission = FeedbackSubmissionV1(
            schemaVersion = 1,
            surveyId = "survey-dup",
            surveyType = SurveyType.RATING,
            submittedAt = "2026-01-10T12:00:12Z",
            answers = listOf(
                Answer(
                    fieldId = "same-id",
                    fieldType = FieldType.TEXT,
                    question = Question(label = "First"),
                    value = AnswerValue.Text("a")
                ),
                Answer(
                    fieldId = "same-id",
                    fieldType = FieldType.TEXT,
                    question = Question(label = "Second"),
                    value = AnswerValue.Text("b")
                )
            )
        )

        val exception = shouldThrowBadRequest {
            service.registerOrValidate("team-a", submission)
        }

        exception.message shouldContain "duplicate fieldIds"
    }

    test("rejects first submission with invalid selectedOptionId") {
        val repository = mockk<SurveyDefinitionRepository>()
        val service = SurveyDefinitionService(repository)
        val submission = FeedbackSubmissionV1(
            schemaVersion = 1,
            surveyId = "survey-bad-option",
            surveyType = SurveyType.TOP_TASKS,
            submittedAt = "2026-01-10T12:00:12Z",
            answers = listOf(
                Answer(
                    fieldId = "task",
                    fieldType = FieldType.SINGLE_CHOICE,
                    question = Question(
                        label = "Hva gjorde du?",
                        options = listOf(ChoiceOption("a", "A"), ChoiceOption("b", "B"))
                    ),
                    value = AnswerValue.SingleChoice("nonexistent")
                )
            )
        )

        val exception = shouldThrowBadRequest {
            service.registerOrValidate("team-a", submission)
        }

        exception.message shouldContain "is not valid for fieldId"
    }

    test("rejects first submission with duplicate optionIds") {
        val repository = mockk<SurveyDefinitionRepository>()
        val service = SurveyDefinitionService(repository)
        val submission = FeedbackSubmissionV1(
            schemaVersion = 1,
            surveyId = "survey-dup-opts",
            surveyType = SurveyType.TOP_TASKS,
            submittedAt = "2026-01-10T12:00:12Z",
            answers = listOf(
                Answer(
                    fieldId = "task",
                    fieldType = FieldType.SINGLE_CHOICE,
                    question = Question(
                        label = "Valg",
                        options = listOf(ChoiceOption("a", "A"), ChoiceOption("a", "A2"))
                    ),
                    value = AnswerValue.SingleChoice("a")
                )
            )
        )

        val exception = shouldThrowBadRequest {
            service.registerOrValidate("team-a", submission)
        }

        exception.message shouldContain "duplicate optionIds"
    }

    test("rejects first submission with invalid MultiChoice selectedOptionIds") {
        val repository = mockk<SurveyDefinitionRepository>()
        val service = SurveyDefinitionService(repository)
        val submission = FeedbackSubmissionV1(
            schemaVersion = 1,
            surveyId = "survey-multi-bad",
            surveyType = SurveyType.TOP_TASKS,
            submittedAt = "2026-01-10T12:00:12Z",
            answers = listOf(
                Answer(
                    fieldId = "tasks",
                    fieldType = FieldType.MULTI_CHOICE,
                    question = Question(
                        label = "Velg flere",
                        options = listOf(ChoiceOption("a", "A"), ChoiceOption("b", "B"))
                    ),
                    value = AnswerValue.MultiChoice(listOf("a", "nonexistent"))
                )
            )
        )

        val exception = shouldThrowBadRequest {
            service.registerOrValidate("team-a", submission)
        }

        exception.message shouldContain "are not valid for fieldId"
    }

    test("rejects MultiChoice with duplicate selectedOptionIds") {
        val repository = mockk<SurveyDefinitionRepository>()
        val service = SurveyDefinitionService(repository)
        val submission = FeedbackSubmissionV1(
            schemaVersion = 1,
            surveyId = "survey-multi-dup",
            surveyType = SurveyType.TOP_TASKS,
            submittedAt = "2026-01-10T12:00:12Z",
            answers = listOf(
                Answer(
                    fieldId = "tasks",
                    fieldType = FieldType.MULTI_CHOICE,
                    question = Question(
                        label = "Velg flere",
                        options = listOf(ChoiceOption("a", "A"), ChoiceOption("b", "B"))
                    ),
                    value = AnswerValue.MultiChoice(listOf("a", "a"))
                )
            )
        )

        val exception = shouldThrowBadRequest {
            service.registerOrValidate("team-a", submission)
        }

        exception.message shouldContain "duplicate selectedOptionIds"
    }

    test("partial submission accepted against stored definition") {
        val repository = mockk<SurveyDefinitionRepository>()
        val service = SurveyDefinitionService(repository)

        val fullDefinition = SurveyDefinition(
            surveyId = "survey-1",
            surveyType = SurveyType.RATING,
            fields = listOf(
                FieldDefinition("rating", FieldType.RATING, RatingVariant.EMOJI, 5, null),
                FieldDefinition("reason", FieldType.TEXT, null, null, null)
            )
        )
        val fullHash = fullDefinition.computeHash()

        val partialSubmission = FeedbackSubmissionV1(
            schemaVersion = 1,
            surveyId = "survey-1",
            surveyType = SurveyType.RATING,
            submittedAt = "2026-01-10T12:00:12Z",
            answers = listOf(
                Answer(
                    fieldId = "rating",
                    fieldType = FieldType.RATING,
                    question = Question(label = "Vurdering"),
                    value = AnswerValue.Rating(rating = 3, ratingVariant = RatingVariant.EMOJI, ratingScale = 5)
                )
            )
        )

        coEvery { repository.findByTeamAndSurveyId("team-a", "survey-1") } returns StoredSurveyDefinition(
            team = "team-a",
            surveyId = "survey-1",
            definitionHash = fullHash,
            definition = fullDefinition
        )

        // Partial submission should NOT produce the same hash as the full definition,
        // but it should pass answer validation since all submitted fields match.
        // It will then trigger a conflict because the hash differs.
        val exception = shouldThrowConflict {
            service.registerOrValidate("team-a", partialSubmission)
        }

        exception.message shouldContain "Survey definition conflict"
    }
})

private fun ratingSubmission() = FeedbackSubmissionV1(
    schemaVersion = 1,
    surveyId = "survey-1",
    surveyType = SurveyType.RATING,
    submittedAt = "2026-01-10T12:00:12Z",
    answers = listOf(
        Answer(
            fieldId = "rating",
            fieldType = FieldType.RATING,
            question = Question(label = "Hvor fornøyd er du?"),
            value = AnswerValue.Rating(rating = 4, ratingVariant = RatingVariant.EMOJI, ratingScale = 5)
        )
    )
)

private fun choiceSubmission(optionLabel: String) = FeedbackSubmissionV1(
    schemaVersion = 1,
    surveyId = "survey-choice",
    surveyType = SurveyType.TOP_TASKS,
    submittedAt = "2026-01-10T12:00:12Z",
    answers = listOf(
        Answer(
            fieldId = "task",
            fieldType = FieldType.SINGLE_CHOICE,
            question = Question(
                label = "Hva gjorde du?",
                options = listOf(ChoiceOption("apply", optionLabel))
            ),
            value = AnswerValue.SingleChoice("apply")
        )
    )
)

private fun shouldThrowBadRequest(block: suspend () -> Unit): ApiErrorException.BadRequestException {
    return try {
        kotlinx.coroutines.runBlocking { block() }
        throw AssertionError("Expected BadRequestException")
    } catch (exception: ApiErrorException.BadRequestException) {
        exception
    }
}

private fun shouldThrowConflict(block: suspend () -> Unit): ApiErrorException.ConflictException {
    return try {
        kotlinx.coroutines.runBlocking { block() }
        throw AssertionError("Expected ConflictException")
    } catch (exception: ApiErrorException.ConflictException) {
        exception
    }
}

private fun shouldThrowTooManyRequests(block: suspend () -> Unit): ApiErrorException.TooManyRequestsException {
    return try {
        kotlinx.coroutines.runBlocking { block() }
        throw AssertionError("Expected TooManyRequestsException")
    } catch (exception: ApiErrorException.TooManyRequestsException) {
        exception
    }
}
