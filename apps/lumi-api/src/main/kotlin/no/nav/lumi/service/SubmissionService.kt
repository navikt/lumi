package no.nav.lumi.service

import no.nav.lumi.domain.FeedbackSubmissionV1
import no.nav.lumi.domain.SaveResult
import no.nav.lumi.domain.SurveyDefinition
import no.nav.lumi.repository.FeedbackRepository

data class SubmissionOutcome(
    val saveResult: SaveResult,
    val definitionHash: String? = null
)

class SubmissionService(
    private val feedbackService: FeedbackService = FeedbackService(),
    private val surveyDefinitionService: SurveyDefinitionService = SurveyDefinitionService(),
    private val feedbackRepository: FeedbackRepository = FeedbackRepository(),
    internal val afterScopedDeduplicationLockAcquired: suspend () -> Unit = {}
) {
    suspend fun submit(
        feedbackJson: String,
        team: String,
        app: String,
        submission: FeedbackSubmissionV1,
        definition: SurveyDefinition? = null,
        allowDefinitionExpansion: Boolean = definition == null
    ): SubmissionOutcome {
        if (submission.deduplicationKey == null) {
            val definitionResult = registerDefinition(
                team = team,
                submission = submission,
                definition = definition,
                allowDefinitionExpansion = allowDefinitionExpansion,
                inCurrentTransaction = false
            )
            val saveResult = feedbackService.save(
                feedbackJson = feedbackJson,
                team = team,
                app = app,
                surveyId = definitionResult.surveyId,
                definitionHash = definitionResult.definitionHash
            )
            return SubmissionOutcome(saveResult, definitionResult.definitionHash)
        }

        val duplicateId = feedbackService.findDuplicateSubmissionId(
            team = team,
            surveyId = submission.surveyId,
            deduplicationKey = submission.deduplicationKey
        )
        if (duplicateId != null) {
            return SubmissionOutcome(SaveResult.Duplicate(duplicateId))
        }

        val prepared = feedbackService.prepareForSave(feedbackJson, team, submission.surveyId)
        val deduplicationKeyHash = requireNotNull(prepared.deduplicationKeyHash) {
            "Expected deduplication key hash for submission with deduplicationKey"
        }

        return feedbackRepository.withScopedDeduplicationLock(team, submission.surveyId, deduplicationKeyHash) {
            afterScopedDeduplicationLockAcquired()

            val existingId = feedbackRepository.findIdByDeduplicationKeyHashInCurrentTransaction(
                team = team,
                surveyId = submission.surveyId,
                deduplicationKeyHash = deduplicationKeyHash
            )
            if (existingId != null) {
                return@withScopedDeduplicationLock SubmissionOutcome(SaveResult.Duplicate(existingId))
            }

            val definitionResult = registerDefinition(
                team = team,
                submission = submission,
                definition = definition,
                allowDefinitionExpansion = allowDefinitionExpansion,
                inCurrentTransaction = true
            )
            val saveResult = feedbackRepository.saveInCurrentTransaction(
                feedbackJson = prepared.feedbackJson,
                team = team,
                app = app,
                surveyId = definitionResult.surveyId,
                definitionHash = definitionResult.definitionHash,
                deduplicationKeyHash = deduplicationKeyHash
            )

            SubmissionOutcome(
                saveResult = saveResult,
                definitionHash = definitionResult.definitionHash.takeIf { saveResult is SaveResult.Created }
            )
        }
    }

    private suspend fun registerDefinition(
        team: String,
        submission: FeedbackSubmissionV1,
        definition: SurveyDefinition?,
        allowDefinitionExpansion: Boolean,
        inCurrentTransaction: Boolean
    ): RegistrationResult {
        return when {
            definition != null && inCurrentTransaction ->
                surveyDefinitionService.registerOrValidateV2InCurrentTransaction(team, submission, definition)

            definition != null ->
                surveyDefinitionService.registerOrValidateV2(team, submission, definition)

            allowDefinitionExpansion && inCurrentTransaction ->
                surveyDefinitionService.registerOrValidateInCurrentTransaction(team, submission)

            allowDefinitionExpansion ->
                surveyDefinitionService.registerOrValidate(team, submission)

            inCurrentTransaction ->
                surveyDefinitionService.registerOrValidateInCurrentTransaction(team, submission)

            else ->
                surveyDefinitionService.registerOrValidate(team, submission)
        }
    }
}
