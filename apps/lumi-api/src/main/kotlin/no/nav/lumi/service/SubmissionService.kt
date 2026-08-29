package no.nav.lumi.service

import no.nav.lumi.domain.FeedbackSubmissionV1
import no.nav.lumi.domain.SaveResult
import no.nav.lumi.domain.SurveyDefinition
import no.nav.lumi.domain.SurveyFlowDefinitionV1
import no.nav.lumi.repository.AnalysisSourceContractRepository
import no.nav.lumi.repository.FeedbackRepository
import no.nav.lumi.validation.SurveyFlowValidator

data class SubmissionOutcome(
    val saveResult: SaveResult,
    val definitionHash: String? = null,
    val flowHash: String? = null,
)

class SubmissionService(
    private val feedbackService: FeedbackService = FeedbackService(),
    private val surveyDefinitionService: SurveyDefinitionService = SurveyDefinitionService(),
    private val feedbackRepository: FeedbackRepository = FeedbackRepository(),
    private val sourceContractRepository: AnalysisSourceContractRepository = AnalysisSourceContractRepository(),
    internal val afterScopedDeduplicationLockAcquired: suspend () -> Unit = {}
) {
    suspend fun submit(
        feedbackJson: String,
        team: String,
        app: String,
        submission: FeedbackSubmissionV1,
        definition: SurveyDefinition? = null,
        flow: SurveyFlowDefinitionV1? = null,
    ): SubmissionOutcome {
        if (submission.deduplicationKey == null) {
            val prepared = feedbackService.prepareForSave(feedbackJson, team, submission.surveyId)
            return feedbackRepository.withTransaction {
                val definitionResult = registerDefinition(
                    team = team,
                    submission = submission,
                    definition = definition,
                    inCurrentTransaction = true
                )
                val flowHash = registerFlowContract(team, app, definitionResult, definition, flow)
                val saveResult = feedbackRepository.saveInCurrentTransaction(
                    feedbackJson = prepared.feedbackJson,
                    team = team,
                    app = app,
                    surveyId = definitionResult.surveyId,
                    definitionHash = definitionResult.definitionHash,
                    flowHash = flowHash,
                )
                surveyDefinitionService.recordStoredSubmissionInCurrentTransaction(
                    team,
                    definitionResult.surveyId,
                )
                SubmissionOutcome(saveResult, definitionResult.definitionHash, flowHash)
            }
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
                inCurrentTransaction = true
            )
            val flowHash = registerFlowContract(team, app, definitionResult, definition, flow)
            val saveResult = feedbackRepository.saveInCurrentTransaction(
                feedbackJson = prepared.feedbackJson,
                team = team,
                app = app,
                surveyId = definitionResult.surveyId,
                definitionHash = definitionResult.definitionHash,
                flowHash = flowHash,
                deduplicationKeyHash = deduplicationKeyHash
            )

            if (saveResult is SaveResult.Created) {
                surveyDefinitionService.recordStoredSubmissionInCurrentTransaction(
                    team,
                    definitionResult.surveyId,
                )
            }

            SubmissionOutcome(
                saveResult = saveResult,
                definitionHash = definitionResult.definitionHash.takeIf { saveResult is SaveResult.Created },
                flowHash = flowHash.takeIf { saveResult is SaveResult.Created },
            )
        }
    }

    private fun registerFlowContract(
        team: String,
        app: String,
        definitionResult: RegistrationResult,
        definition: SurveyDefinition?,
        flow: SurveyFlowDefinitionV1?,
    ): String? {
        if (definition == null || flow == null) return null
        SurveyFlowValidator.validate(flow, definition)
        return sourceContractRepository.registerInCurrentTransaction(
            team = team,
            app = app,
            definitionHash = definitionResult.definitionHash,
            definition = definition,
            flow = flow,
        )
    }

    private suspend fun registerDefinition(
        team: String,
        submission: FeedbackSubmissionV1,
        definition: SurveyDefinition?,
        inCurrentTransaction: Boolean
    ): RegistrationResult {
        return when {
            definition != null && inCurrentTransaction ->
                surveyDefinitionService.registerOrValidateV2InCurrentTransaction(team, submission, definition)

            definition != null ->
                surveyDefinitionService.registerOrValidateV2(team, submission, definition)

            inCurrentTransaction ->
                surveyDefinitionService.registerOrValidateInCurrentTransaction(team, submission)

            else ->
                surveyDefinitionService.registerOrValidate(team, submission)
        }
    }
}
