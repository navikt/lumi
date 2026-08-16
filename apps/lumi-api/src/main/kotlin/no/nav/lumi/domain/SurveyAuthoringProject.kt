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
