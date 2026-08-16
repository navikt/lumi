package no.nav.lumi.routes

import io.ktor.http.HttpStatusCode
import io.ktor.http.HttpHeaders
import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.receiveChannel
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
import no.nav.lumi.domain.UpdateSurveyAuthoringDraftRequest
import no.nav.lumi.repository.SurveyAuthoringProjectRepository
import java.util.UUID

private val defaultSurveyAuthoringProjectRepository = SurveyAuthoringProjectRepository()
private const val MAX_PROJECT_NAME_LENGTH = 120
private const val MAX_SURVEY_ID_LENGTH = 200
private const val MAX_DRAFT_BYTES = 256 * 1024
private const val MAX_REQUEST_BYTES = MAX_DRAFT_BYTES + 16 * 1024
private const val MAX_PROJECTS_PER_TEAM = 100

fun Route.surveyAuthoringRoutes(
    repository: SurveyAuthoringProjectRepository = defaultSurveyAuthoringProjectRepository,
) {
    get<ApiV1Intern.Authoring.Projects> {
        call.respond(repository.findByTeam(call.authorizedTeam))
    }

    post<ApiV1Intern.Authoring.Projects> {
        val request = receiveAuthoringRequest<CreateSurveyAuthoringProjectRequest>(call)
        val validated = validateProjectInput(request.name, request.surveyId, request.document)
        val principalIdentity = stablePrincipalIdentity(call.authorizedPrincipal)
            ?: throw ApiErrorException.BadRequestException("Authenticated user needs a stable identity")

        val project = repository.create(
            team = call.authorizedTeam,
            name = validated.name,
            surveyId = validated.surveyId,
            document = request.document,
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

    put<ApiV1Intern.Authoring.Projects.Id.Draft> { params ->
        val request = receiveAuthoringRequest<UpdateSurveyAuthoringDraftRequest>(call)
        if (request.expectedVersion < 1) {
            throw ApiErrorException.BadRequestException("expectedVersion must be positive")
        }
        val validated = validateProjectInput(request.name, request.surveyId, request.document)
        val team = call.authorizedTeam
        val projectId = parseProjectId(params.parent.projectId)
        val principalIdentity = stablePrincipalIdentity(call.authorizedPrincipal)
            ?: throw ApiErrorException.BadRequestException("Authenticated user needs a stable identity")

        if (repository.findById(team, projectId) == null) {
            throw ApiErrorException.NotFoundException("Survey project not found")
        }

        val project = repository.updateDraft(
            team = team,
            id = projectId,
            expectedVersion = request.expectedVersion,
            name = validated.name,
            surveyId = validated.surveyId,
            document = request.document,
            principalIdentity = principalIdentity,
        ) ?: throw ApiErrorException.ConflictException(
            "Draft changed since it was loaded. Reload before saving again.",
        )

        call.respond(project)
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

private fun parseProjectId(value: String): UUID = try {
    UUID.fromString(value)
} catch (_: IllegalArgumentException) {
    throw ApiErrorException.BadRequestException("Invalid survey project ID")
}
