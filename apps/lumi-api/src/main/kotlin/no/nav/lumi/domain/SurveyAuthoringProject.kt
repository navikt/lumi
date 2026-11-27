package no.nav.lumi.domain

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

/** The component a survey is meant to be shown with. */
@Serializable
enum class SurveyDisplayMode(val storedValue: String) {
    /** The floating panel, `LumiSurveyDock`. */
    @SerialName("dock")
    DOCK("dock"),

    /** At the content the survey asks about, `LumiSurveyInline`. */
    @SerialName("inline")
    INLINE("inline"),
    ;

    companion object {
        fun fromStoredValue(value: String): SurveyDisplayMode =
            entries.firstOrNull { it.storedValue == value }
                ?: error("Unknown display mode in the database: $value")
    }
}

/**
 * How the author means the survey to be shown in the app. It is authoring
 * metadata beside the document: the document stays a SurveyDocumentV1, and the
 * developer still decides where the survey is placed.
 *
 * Neither field has a default, so a request that sends the object must send
 * both keys. `placementNote` is null when there is no note.
 */
@Serializable
data class SurveyAuthoringPresentation(
    val mode: SurveyDisplayMode,
    val placementNote: String?,
) {
    companion object {
        /** What every project had before the choice existed. */
        val FLOATING_PANEL = SurveyAuthoringPresentation(SurveyDisplayMode.DOCK, null)
    }
}

@Serializable
data class CreateSurveyAuthoringProjectRequest(
    val name: String,
    val surveyId: String,
    val document: JsonObject,
    /** Left out by older clients. The project then starts as the floating panel. */
    val presentation: SurveyAuthoringPresentation? = null,
)

@Serializable
data class UpdateSurveyAuthoringDraftRequest(
    val expectedVersion: Long,
    val name: String,
    val surveyId: String,
    val document: JsonObject,
    /**
     * Left out by older clients. The stored presentation is then kept, so
     * saving the questions from such a client does not turn an inline survey
     * back into the floating panel.
     */
    val presentation: SurveyAuthoringPresentation? = null,
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
    val presentation: SurveyAuthoringPresentation,
    val draftVersion: Long,
    val createdAt: String,
    val updatedAt: String,
)

/**
 * The newest frozen revision of a project, carried on the list so the
 * overview can open a shared survey on its stable version and tell
 * whether the draft has moved on since (draftVersion > revision's).
 */
@Serializable
data class SurveyAuthoringLatestRevision(
    val id: String,
    val revisionNumber: Long,
    val draftVersion: Long,
    val createdAt: String,
)

@Serializable
data class SurveyAuthoringProjectSummary(
    val id: String,
    val team: String,
    val name: String,
    val surveyId: String,
    val presentation: SurveyAuthoringPresentation,
    val draftVersion: Long,
    val createdAt: String,
    val updatedAt: String,
    val latestRevision: SurveyAuthoringLatestRevision? = null,
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
    /** The presentation as it was when the revision was shared. */
    val presentation: SurveyAuthoringPresentation,
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
    val presentation: SurveyAuthoringPresentation,
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
