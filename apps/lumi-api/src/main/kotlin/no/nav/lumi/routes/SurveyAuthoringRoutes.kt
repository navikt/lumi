package no.nav.lumi.routes

import io.ktor.http.HttpStatusCode
import io.ktor.http.HttpHeaders
import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.receiveChannel
import io.ktor.server.resources.delete
import io.ktor.server.resources.get
import io.ktor.server.resources.post
import io.ktor.server.resources.put
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.utils.io.core.readText
import io.ktor.utils.io.readRemaining
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.intOrNull
import no.nav.lumi.config.auth.authorizedPrincipal
import no.nav.lumi.config.auth.authorizedTeam
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.domain.CreateSurveyAuthoringProjectRequest
import no.nav.lumi.domain.CreateSurveyAuthoringRevisionRequest
import no.nav.lumi.domain.SurveyAuthoringPresentation
import no.nav.lumi.domain.SurveyDisplayMode
import no.nav.lumi.domain.UpdateSurveyAuthoringDraftRequest
import no.nav.lumi.repository.CreateSurveyAuthoringRevisionResult
import no.nav.lumi.repository.SurveyAuthoringProjectRepository
import no.nav.lumi.repository.SurveyAuthoringRevisionRepository
import java.util.UUID

private val defaultSurveyAuthoringProjectRepository = SurveyAuthoringProjectRepository()
private val defaultSurveyAuthoringRevisionRepository = SurveyAuthoringRevisionRepository()
private const val MAX_PROJECT_NAME_LENGTH = 120
private const val MAX_SURVEY_ID_LENGTH = 200
private const val MAX_PLACEMENT_NOTE_LENGTH = 200
private const val MAX_DRAFT_BYTES = 256 * 1024
private const val MAX_REQUEST_BYTES = MAX_DRAFT_BYTES + 16 * 1024
private const val MAX_PROJECTS_PER_TEAM = 100
private const val MAX_REVISIONS_PER_PROJECT = 500L

fun Route.surveyAuthoringRoutes(
    repository: SurveyAuthoringProjectRepository = defaultSurveyAuthoringProjectRepository,
    revisionRepository: SurveyAuthoringRevisionRepository = defaultSurveyAuthoringRevisionRepository,
) {
    get<ApiV1Intern.Authoring.Projects> {
        call.respond(repository.findByTeam(call.authorizedTeam))
    }

    post<ApiV1Intern.Authoring.Projects> {
        val request = receiveAuthoringRequest<CreateSurveyAuthoringProjectRequest>(call)
        val validated = validateProjectInput(request.name, request.surveyId, request.document)
        val presentation = request.presentation?.let(::validatePresentation)
            ?: SurveyAuthoringPresentation.FLOATING_PANEL
        val principalIdentity = stablePrincipalIdentity(call.authorizedPrincipal)
            ?: throw ApiErrorException.BadRequestException("Authenticated user needs a stable identity")

        val project = repository.create(
            team = call.authorizedTeam,
            name = validated.name,
            surveyId = validated.surveyId,
            document = request.document,
            presentation = presentation,
            principalIdentity = principalIdentity,
            maxProjects = MAX_PROJECTS_PER_TEAM,
        ) ?: throw ApiErrorException.TooManyRequestsException(
            "Team has reached the limit of $MAX_PROJECTS_PER_TEAM survey drafts",
        )
        call.respond(HttpStatusCode.Created, project)
    }

    get<ApiV1Intern.Authoring.Projects.Id> { params ->
        val project = repository.findById(
            team = call.authorizedTeam,
            id = parseProjectId(params.projectId),
        ) ?: throw ApiErrorException.NotFoundException("Survey project not found")

        call.respond(project)
    }

    delete<ApiV1Intern.Authoring.Projects.Id> { params ->
        val removed = repository.deleteById(
            team = call.authorizedTeam,
            id = parseProjectId(params.projectId),
        )
        if (!removed) throw ApiErrorException.NotFoundException("Survey project not found")
        call.respond(HttpStatusCode.NoContent)
    }

    put<ApiV1Intern.Authoring.Projects.Id.Draft> { params ->
        val request = receiveAuthoringRequest<UpdateSurveyAuthoringDraftRequest>(call)
        if (request.expectedVersion < 1) {
            throw ApiErrorException.BadRequestException("expectedVersion must be positive")
        }
        val validated = validateProjectInput(request.name, request.surveyId, request.document)
        val presentation = request.presentation?.let(::validatePresentation)
        val team = call.authorizedTeam
        val projectId = parseProjectId(params.parent.projectId)
        val principalIdentity = stablePrincipalIdentity(call.authorizedPrincipal)
            ?: throw ApiErrorException.BadRequestException("Authenticated user needs a stable identity")

        val project = when (
            val result = repository.updateDraft(
                team = team,
                id = projectId,
                expectedVersion = request.expectedVersion,
                name = validated.name,
                surveyId = validated.surveyId,
                document = request.document,
                presentation = presentation,
                principalIdentity = principalIdentity,
            )
        ) {
            is SurveyAuthoringProjectRepository.DraftUpdateResult.Updated -> result.project
            SurveyAuthoringProjectRepository.DraftUpdateResult.NotFound ->
                throw ApiErrorException.NotFoundException("Survey project not found")
            SurveyAuthoringProjectRepository.DraftUpdateResult.VersionConflict ->
                throw ApiErrorException.ConflictException(
                    "Draft changed since it was loaded. Reload before saving again.",
                )
        }

        call.respond(project)
    }

    get<ApiV1Intern.Authoring.Projects.Id.ProjectRevisions> { params ->
        val revisions = revisionRepository.findByProject(
            team = call.authorizedTeam,
            projectId = parseProjectId(params.parent.projectId),
        ) ?: throw ApiErrorException.NotFoundException("Survey project not found")
        call.respond(revisions)
    }

    post<ApiV1Intern.Authoring.Projects.Id.ProjectRevisions> { params ->
        val request = receiveAuthoringRequest<CreateSurveyAuthoringRevisionRequest>(call)
        if (request.expectedDraftVersion < 1) {
            throw ApiErrorException.BadRequestException("expectedDraftVersion must be positive")
        }
        val principalIdentity = stablePrincipalIdentity(call.authorizedPrincipal)
            ?: throw ApiErrorException.BadRequestException("Authenticated user needs a stable identity")

        when (
            val result = revisionRepository.createFromDraft(
                team = call.authorizedTeam,
                projectId = parseProjectId(params.parent.projectId),
                expectedDraftVersion = request.expectedDraftVersion,
                principalIdentity = principalIdentity,
                maxRevisions = MAX_REVISIONS_PER_PROJECT,
            )
        ) {
            is CreateSurveyAuthoringRevisionResult.Created ->
                call.respond(HttpStatusCode.Created, result.revision)
            is CreateSurveyAuthoringRevisionResult.Unchanged ->
                call.respond(HttpStatusCode.OK, result.revision)
            CreateSurveyAuthoringRevisionResult.NotFound ->
                throw ApiErrorException.NotFoundException("Survey project not found")
            CreateSurveyAuthoringRevisionResult.DraftChanged ->
                throw ApiErrorException.ConflictException(
                    "Draft changed since it was validated. Wait for save and try again.",
                )
            CreateSurveyAuthoringRevisionResult.LimitReached ->
                throw ApiErrorException.TooManyRequestsException(
                    "Survey project has reached the limit of $MAX_REVISIONS_PER_PROJECT revisions",
                )
        }
    }

    get<ApiV1Intern.Authoring.Revisions.Id> { params ->
        val detail = revisionRepository.findDetailById(
            team = call.authorizedTeam,
            revisionId = parseRevisionId(params.revisionId),
        ) ?: throw ApiErrorException.NotFoundException("Survey revision not found")
        call.respond(detail)
    }
}

private data class ValidatedProjectInput(val name: String, val surveyId: String)

private val authoringJson = Json {
    ignoreUnknownKeys = true
    isLenient = false
    encodeDefaults = true
}

private suspend inline fun <reified T> receiveAuthoringRequest(call: ApplicationCall): T {
    val contentLength = call.request.headers[HttpHeaders.ContentLength]?.toLongOrNull()
    if (contentLength != null && contentLength > MAX_REQUEST_BYTES) {
        throw ApiErrorException.PayloadTooLargeException(
            "Survey draft request must be at most $MAX_REQUEST_BYTES bytes",
        )
    }

    val packet = call.receiveChannel().readRemaining(MAX_REQUEST_BYTES.toLong() + 1)
    val text = packet.readText()
    if (text.toByteArray(Charsets.UTF_8).size > MAX_REQUEST_BYTES) {
        throw ApiErrorException.PayloadTooLargeException(
            "Survey draft request must be at most $MAX_REQUEST_BYTES bytes",
        )
    }

    return try {
        authoringJson.decodeFromString<T>(text)
    } catch (_: SerializationException) {
        throw ApiErrorException.BadRequestException("Invalid survey draft request")
    }
}

private fun validateProjectInput(
    rawName: String,
    rawSurveyId: String,
    document: JsonObject,
): ValidatedProjectInput {
    val name = rawName.trim()
    val surveyId = rawSurveyId.trim()

    if (name.isEmpty() || name.length > MAX_PROJECT_NAME_LENGTH) {
        throw ApiErrorException.BadRequestException(
            "name must contain 1-$MAX_PROJECT_NAME_LENGTH characters",
        )
    }
    if (surveyId.isEmpty() || surveyId.length > MAX_SURVEY_ID_LENGTH) {
        throw ApiErrorException.BadRequestException(
            "surveyId must contain 1-$MAX_SURVEY_ID_LENGTH characters",
        )
    }
    if (document.toString().toByteArray(Charsets.UTF_8).size > MAX_DRAFT_BYTES) {
        throw ApiErrorException.PayloadTooLargeException(
            "Survey draft must be at most $MAX_DRAFT_BYTES bytes",
        )
    }
    if ((document["authoringSchemaVersion"] as? JsonPrimitive)?.intOrNull != 1) {
        throw ApiErrorException.BadRequestException(
            "Only authoringSchemaVersion 1 is supported",
        )
    }

    return ValidatedProjectInput(name, surveyId)
}

/**
 * A note is one short line of text. It is stored trimmed, and a blank note is
 * stored as no note. It describes a place at the content, so the floating
 * panel is stored without one.
 */
private fun validatePresentation(presentation: SurveyAuthoringPresentation): SurveyAuthoringPresentation {
    val note = presentation.placementNote?.trim { it.isTrimmedLikeJavaScript() }.orEmpty()
    // Counted in characters, as the column is. An emoji is two `Char`s.
    if (note.codePointCount(0, note.length) > MAX_PLACEMENT_NOTE_LENGTH) {
        throw ApiErrorException.BadRequestException(
            "placementNote must contain at most $MAX_PLACEMENT_NOTE_LENGTH characters",
        )
    }
    // U+2028 and U+2029 break a line without being control characters.
    if (note.any { it.isISOControl() || it == '\u2028' || it == '\u2029' }) {
        throw ApiErrorException.BadRequestException(
            "placementNote must be a single line of text",
        )
    }
    // JSON can carry half of a UTF-16 surrogate pair, which is no character.
    // PostgreSQL would get a question mark in its place.
    if (!Charsets.UTF_8.newEncoder().canEncode(note)) {
        throw ApiErrorException.BadRequestException(
            "placementNote must be valid Unicode text",
        )
    }
    val kept = note.takeIf { it.isNotEmpty() && presentation.mode == SurveyDisplayMode.INLINE }
    return presentation.copy(placementNote = kept)
}

/**
 * What JavaScript's `trim()` removes, which the dashboard uses on the note.
 * Kotlin's own `trim()` also removes control characters such as U+001C, which
 * the dashboard rejects, and keeps U+FEFF, which the dashboard removes.
 */
private fun Char.isTrimmedLikeJavaScript(): Boolean =
    this in "\t\n\u000B\u000C\r\u2028\u2029\uFEFF" ||
        Character.getType(this) == Character.SPACE_SEPARATOR.toInt()

private fun parseProjectId(value: String): UUID = try {
    UUID.fromString(value)
} catch (_: IllegalArgumentException) {
    throw ApiErrorException.BadRequestException("Invalid survey project ID")
}

private fun parseRevisionId(value: String): UUID = try {
    UUID.fromString(value)
} catch (_: IllegalArgumentException) {
    throw ApiErrorException.BadRequestException("Invalid survey revision ID")
}
