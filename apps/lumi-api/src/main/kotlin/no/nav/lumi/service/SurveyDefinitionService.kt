package no.nav.lumi.service

import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.domain.DefinitionDiff
import no.nav.lumi.domain.FeedbackSubmissionV1
import no.nav.lumi.domain.SurveyDefinition
import no.nav.lumi.domain.computeHash
import no.nav.lumi.domain.diff
import no.nav.lumi.domain.mergeWith
import no.nav.lumi.repository.StoredSurveyDefinition
import no.nav.lumi.repository.SurveyDefinitionRepository
import no.nav.lumi.validation.SurveyDefinitionValidator

data class RegistrationResult(
    val surveyId: String,
    val definitionHash: String
)

class SurveyDefinitionService(
    private val repository: SurveyDefinitionRepository = SurveyDefinitionRepository()
) {
    suspend fun registerOrValidate(team: String, submission: FeedbackSubmissionV1): RegistrationResult {
        return registerOrValidate(
            team = team,
            submission = submission,
            incomingDefinition = SurveyDefinition.fromSubmission(submission),
            allowDefinitionExpansion = true,
            findStored = repository::findByTeamAndSurveyId,
            insertDefinition = repository::insertIfUnderLimit,
            updateDefinition = repository::updateDefinitionIfHashMatches
        )
    }

    suspend fun registerOrValidateV2(
        team: String,
        submission: FeedbackSubmissionV1,
        definition: SurveyDefinition
    ): RegistrationResult {
        return registerOrValidate(
            team = team,
            submission = submission,
            incomingDefinition = definition,
            allowDefinitionExpansion = false,
            findStored = repository::findByTeamAndSurveyId,
            insertDefinition = repository::insertIfUnderLimit,
            updateDefinition = repository::updateDefinitionIfHashMatches
        )
    }

    internal suspend fun registerOrValidateInCurrentTransaction(
        team: String,
        submission: FeedbackSubmissionV1
    ): RegistrationResult {
        return registerOrValidate(
            team = team,
            submission = submission,
            incomingDefinition = SurveyDefinition.fromSubmission(submission),
            allowDefinitionExpansion = true,
            findStored = repository::findByTeamAndSurveyIdInCurrentTransaction,
            insertDefinition = repository::insertIfUnderLimitInCurrentTransaction,
            updateDefinition = repository::updateDefinitionIfHashMatchesInCurrentTransaction
        )
    }

    internal suspend fun registerOrValidateV2InCurrentTransaction(
        team: String,
        submission: FeedbackSubmissionV1,
        definition: SurveyDefinition
    ): RegistrationResult {
        return registerOrValidate(
            team = team,
            submission = submission,
            incomingDefinition = definition,
            allowDefinitionExpansion = false,
            findStored = repository::findByTeamAndSurveyIdInCurrentTransaction,
            insertDefinition = repository::insertIfUnderLimitInCurrentTransaction,
            updateDefinition = repository::updateDefinitionIfHashMatchesInCurrentTransaction
        )
    }

    private suspend fun registerOrValidate(
        team: String,
        submission: FeedbackSubmissionV1,
        incomingDefinition: SurveyDefinition,
        allowDefinitionExpansion: Boolean,
        findStored: suspend (String, String) -> StoredSurveyDefinition?,
        insertDefinition: suspend (String, SurveyDefinition, String, Int) -> Int,
        updateDefinition: suspend (String, String, String, SurveyDefinition, String) -> Boolean
    ): RegistrationResult {
        validateDefinitionConsistency(incomingDefinition)
        validateAnswersAgainstIncomingDefinition(incomingDefinition, submission)
        val incomingHash = incomingDefinition.computeHash()

        repeat(MAX_REGISTRATION_ATTEMPTS) {
            val stored = findStored(team, submission.surveyId)
            if (stored != null) {
                when (
                    val result = handleExistingDefinition(
                        team = team,
                        stored = stored,
                        incomingDefinition = incomingDefinition,
                        allowDefinitionExpansion = allowDefinitionExpansion,
                        updateDefinition = updateDefinition
                    )
                ) {
                    is ExistingDefinitionResult.Resolved -> return result.registrationResult
                    ExistingDefinitionResult.Retry -> return@repeat
                }
            }

            val insertedCount = insertDefinition(
                team,
                incomingDefinition,
                incomingHash,
                MAX_DEFINITIONS_PER_TEAM
            )

            if (insertedCount == 1) {
                return RegistrationResult(submission.surveyId, incomingHash)
            }

            val existingAfterRace = findStored(team, submission.surveyId)
            if (existingAfterRace == null) {
                throw ApiErrorException.TooManyRequestsException(
                    "Definition limit exceeded for team=$team (max=$MAX_DEFINITIONS_PER_TEAM)"
                )
            }

            when (
                val result = handleExistingDefinition(
                    team = team,
                    stored = existingAfterRace,
                    incomingDefinition = incomingDefinition,
                    allowDefinitionExpansion = allowDefinitionExpansion,
                    updateDefinition = updateDefinition
                )
            ) {
                is ExistingDefinitionResult.Resolved -> return result.registrationResult
                ExistingDefinitionResult.Retry -> return@repeat
            }
        }

        throw ApiErrorException.InternalServerErrorException(
            "Failed to register survey definition for surveyId=${submission.surveyId} after retrying concurrent updates"
        )
    }

    /**
     * Validate the first submission's answers against its own derived definition.
     * Prevents a malformed first payload from persisting invalid feedback data
     * (e.g., SINGLE_CHOICE answer with selectedOptionId not in options).
     */
    private fun validateAnswersAgainstIncomingDefinition(
        definition: SurveyDefinition,
        submission: FeedbackSubmissionV1
    ) {
        SurveyDefinitionValidator.validateAnswersAgainstDefinition(
            definition = definition,
            answers = submission.answers,
            surveyId = definition.surveyId
        )
    }

    private suspend fun handleExistingDefinition(
        team: String,
        stored: StoredSurveyDefinition,
        incomingDefinition: SurveyDefinition,
        allowDefinitionExpansion: Boolean,
        updateDefinition: suspend (String, String, String, SurveyDefinition, String) -> Boolean
    ): ExistingDefinitionResult {
        if (!allowDefinitionExpansion) {
            val definitionDiff = diff(stored.definition, incomingDefinition)
            if (definitionDiff.hasChanges()) {
                throwDefinitionConflict(stored.surveyId, definitionDiff, redactIdentifiers = true)
            }

            return ExistingDefinitionResult.Resolved(
                RegistrationResult(stored.surveyId, stored.definitionHash)
            )
        }

        val mergedDefinition = stored.definition.mergeWith(incomingDefinition)
        val definitionDiff = diff(stored.definition, mergedDefinition)
        if (definitionDiff.changedFields.isNotEmpty()) {
            throwDefinitionConflict(stored.surveyId, definitionDiff)
        }

        if (definitionDiff.addedFields.isEmpty()) {
            return ExistingDefinitionResult.Resolved(
                RegistrationResult(stored.surveyId, stored.definitionHash)
            )
        }

        val mergedHash = mergedDefinition.computeHash()
        if (mergedHash == stored.definitionHash) {
            return ExistingDefinitionResult.Resolved(
                RegistrationResult(stored.surveyId, stored.definitionHash)
            )
        }

        val updated = updateDefinition(team, stored.surveyId, stored.definitionHash, mergedDefinition, mergedHash)

        return if (updated) {
            ExistingDefinitionResult.Resolved(
                RegistrationResult(stored.surveyId, mergedHash)
            )
        } else {
            ExistingDefinitionResult.Retry
        }
    }

    /**
     * Validate structural consistency of a definition before first registration.
     * Prevents a malformed first submission from permanently locking an invalid structure.
     */
    private fun validateDefinitionConsistency(definition: SurveyDefinition) {
        SurveyDefinitionValidator.validateDefinition(definition)
    }

    private fun throwDefinitionConflict(
        surveyId: String,
        definitionDiff: DefinitionDiff,
        redactIdentifiers: Boolean = false
    ): Nothing {
        throw ApiErrorException.ConflictException(
            "Survey definition conflict for surveyId=$surveyId: ${
                if (redactIdentifiers) definitionDiff.describeRedacted() else definitionDiff.describe()
            }"
        )
    }

    private sealed interface ExistingDefinitionResult {
        data class Resolved(val registrationResult: RegistrationResult) : ExistingDefinitionResult
        data object Retry : ExistingDefinitionResult
    }

    private companion object {
        const val MAX_DEFINITIONS_PER_TEAM = 500
        const val MAX_REGISTRATION_ATTEMPTS = 5
    }
}
