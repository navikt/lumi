package no.nav.lumi.domain

import kotlinx.serialization.Serializable

@Serializable
data class CreateMarkerRequest(
    val markerDate: String, // YYYY-MM-DD
    val label: String,
    val description: String? = null,
    val color: String? = null,
)

@Serializable
data class UpdateMarkerRequest(
    val markerDate: String? = null, // YYYY-MM-DD
    val label: String? = null,
    val description: String? = null,
    val color: String? = null,
    val clearDescription: Boolean? = null,
    val clearColor: Boolean? = null,
)

@Serializable
data class MarkerDto(
    val id: String,
    val team: String,
    val surveyId: String,
    val markerDate: String, // YYYY-MM-DD
    val label: String,
    val description: String?,
    val color: String?,
    val createdBy: String?,
    val createdAt: String, // ISO-8601
    val updatedAt: String, // ISO-8601
)
