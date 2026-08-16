package no.nav.lumi.domain

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

@Serializable
data class CreateSurveyAuthoringProjectRequest(
    val name: String,
    val surveyId: String,
    val document: JsonObject,
)

@Serializable
data class UpdateSurveyAuthoringDraftRequest(
    val expectedVersion: Long,
    val name: String,
    val surveyId: String,
    val document: JsonObject,
)

@Serializable
data class CreateSurveyAuthoringRevisionRequest(
    val expectedDraftVersion: Long,
)

@Serializable
data class SurveyAuthoringProject(
    val id: String,
    val team: String,
    val name: String,
    val surveyId: String,
    val document: JsonObject,
    val draftVersion: Long,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
data class SurveyAuthoringProjectSummary(
    val id: String,
    val team: String,
    val name: String,
    val surveyId: String,
    val draftVersion: Long,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
data class SurveyAuthoringRevision(
    val id: String,
    val projectId: String,
    val revisionNumber: Long,
    val draftVersion: Long,
    val name: String,
    val surveyId: String,
    val document: JsonObject,
    val documentHash: String,
    val definitionHash: String,
    val createdBy: String,
    val createdAt: String,
)

@Serializable
data class SurveyAuthoringRevisionSummary(
    val id: String,
    val projectId: String,
    val revisionNumber: Long,
    val draftVersion: Long,
    val name: String,
    val surveyId: String,
    val documentHash: String,
    val definitionHash: String,
    val createdBy: String,
    val createdAt: String,
)

@Serializable
data class SurveyAuthoringRevisionDetail(
    val revision: SurveyAuthoringRevision,
    val previousRevision: SurveyAuthoringRevision? = null,
)
