package no.nav.lumi.service

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import no.nav.lumi.domain.Answer
import no.nav.lumi.domain.AnswerValue
import no.nav.lumi.domain.FeedbackSubmissionV1
import no.nav.lumi.domain.FieldDefinition
import no.nav.lumi.domain.FieldType
import no.nav.lumi.domain.Question
import no.nav.lumi.domain.RatingVariant
import no.nav.lumi.domain.SaveResult
import no.nav.lumi.domain.SurveyDefinition
import no.nav.lumi.domain.SurveyType
import no.nav.lumi.repository.FeedbackRepository

class SubmissionServiceTest : FunSpec({
    test("provided definition uses v2 registration even when definition expansion is allowed") {
        val feedbackService = mockk<FeedbackService>()
        val surveyDefinitionService = mockk<SurveyDefinitionService>()
        val feedbackRepository = mockk<FeedbackRepository>()
        val service = SubmissionService(feedbackService, surveyDefinitionService, feedbackRepository)
        val submission = ratingSubmission()
        val definition = expandedDefinition()
        val registrationResult = RegistrationResult("survey-1", "definition-hash-v2")
        val saveResult = SaveResult.Created("feedback-1")

        coEvery { surveyDefinitionService.registerOrValidateV2("team-a", submission, definition) } returns registrationResult
        coEvery { feedbackService.save("{}", "team-a", "app-a", "survey-1", "definition-hash-v2") } returns saveResult

        val result = runSubmission {
            service.submit(
                feedbackJson = "{}",
                team = "team-a",
                app = "app-a",
                submission = submission,
                definition = definition,
                allowDefinitionExpansion = true
            )
        }

        result shouldBe SubmissionOutcome(saveResult, "definition-hash-v2")
        coVerify(exactly = 1) { surveyDefinitionService.registerOrValidateV2("team-a", submission, definition) }
        coVerify(exactly = 0) { surveyDefinitionService.registerOrValidate("team-a", submission) }
        coVerify(exactly = 0) { surveyDefinitionService.registerOrValidateInCurrentTransaction(any(), any()) }
        coVerify(exactly = 0) { surveyDefinitionService.registerOrValidateV2InCurrentTransaction(any(), any(), any()) }
    }

    test("provided definition uses v2 registration in current transaction even when definition expansion is allowed") {
        val feedbackService = mockk<FeedbackService>()
        val surveyDefinitionService = mockk<SurveyDefinitionService>()
        val feedbackRepository = mockk<FeedbackRepository>()
        val service = SubmissionService(feedbackService, surveyDefinitionService, feedbackRepository)
        val submission = ratingSubmission(deduplicationKey = "client-key-123456")
        val definition = expandedDefinition()
        val registrationResult = RegistrationResult("survey-1", "definition-hash-v2")
        val saveResult = SaveResult.Created("feedback-1")
        val prepared = FeedbackService.PreparedFeedbackSave("redacted-json", "dedup-hash")

        coEvery { feedbackService.findDuplicateSubmissionId("team-a", "survey-1", "client-key-123456") } returns null
        every { feedbackService.prepareForSave("{}", "team-a", "survey-1") } returns prepared
        coEvery {
            feedbackRepository.withScopedDeduplicationLock(
                "team-a",
                "survey-1",
                "dedup-hash",
                any<suspend () -> SubmissionOutcome>()
            )
        } coAnswers {
            arg<suspend () -> SubmissionOutcome>(3).invoke()
        }
        every {
            feedbackRepository.findIdByDeduplicationKeyHashInCurrentTransaction("team-a", "survey-1", "dedup-hash")
        } returns null
        coEvery {
            surveyDefinitionService.registerOrValidateV2InCurrentTransaction("team-a", submission, definition)
        } returns registrationResult
        every {
            feedbackRepository.saveInCurrentTransaction(
                "redacted-json",
                "team-a",
                "app-a",
                "survey-1",
                "definition-hash-v2",
                "dedup-hash"
            )
        } returns saveResult

        val result = runSubmission {
            service.submit(
                feedbackJson = "{}",
                team = "team-a",
                app = "app-a",
                submission = submission,
                definition = definition,
                allowDefinitionExpansion = true
            )
        }

        result shouldBe SubmissionOutcome(saveResult, "definition-hash-v2")
        coVerify(exactly = 1) {
            surveyDefinitionService.registerOrValidateV2InCurrentTransaction("team-a", submission, definition)
        }
        coVerify(exactly = 0) { surveyDefinitionService.registerOrValidateInCurrentTransaction("team-a", submission) }
        coVerify(exactly = 0) { surveyDefinitionService.registerOrValidate("team-a", submission) }
        coVerify(exactly = 0) { surveyDefinitionService.registerOrValidateV2("team-a", submission, definition) }
    }
})

private fun ratingSubmission(deduplicationKey: String? = null) = FeedbackSubmissionV1(
    schemaVersion = 2,
    surveyId = "survey-1",
    surveyType = SurveyType.RATING,
    submittedAt = "2026-01-10T12:00:12Z",
    deduplicationKey = deduplicationKey,
    answers = listOf(
        Answer(
            fieldId = "rating",
            fieldType = FieldType.RATING,
            question = Question(label = "Hvor fornøyd er du?"),
            value = AnswerValue.Rating(rating = 4, ratingVariant = RatingVariant.EMOJI, ratingScale = 5)
        )
    )
)

private fun expandedDefinition() = SurveyDefinition(
    surveyId = "survey-1",
    surveyType = SurveyType.RATING,
    fields = listOf(
        FieldDefinition("rating", FieldType.RATING, RatingVariant.EMOJI, 5, null),
        FieldDefinition("followup", FieldType.TEXT, null, null, null)
    )
)

private fun runSubmission(block: suspend () -> SubmissionOutcome): SubmissionOutcome {
    return kotlinx.coroutines.runBlocking { block() }
}
