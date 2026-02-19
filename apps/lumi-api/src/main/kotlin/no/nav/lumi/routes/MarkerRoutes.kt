package no.nav.lumi.routes

import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.resources.delete
import io.ktor.server.resources.get
import io.ktor.server.resources.post
import io.ktor.server.resources.put
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import no.nav.lumi.config.auth.authorizedPrincipal
import no.nav.lumi.config.auth.authorizedTeam
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.domain.CreateMarkerRequest
import no.nav.lumi.domain.UpdateMarkerRequest
import no.nav.lumi.repository.RatingMarkerRepository
import java.sql.SQLException
import java.util.UUID

private val defaultMarkerRepository = RatingMarkerRepository()
private val hexColorRegex = Regex("^#[0-9A-Fa-f]{6}$")
private const val MAX_MARKERS_PER_SURVEY = 50
private const val MAX_LABEL_LENGTH = 80
private const val MAX_DESCRIPTION_LENGTH = 500

fun Route.markerRoutes(
    markerRepository: RatingMarkerRepository = defaultMarkerRepository,
) {
    get<ApiV1Intern.Surveys.Id.Markers> { params ->
        val team = call.authorizedTeam
        validateDateRange(fromDate = params.fromDate, toDate = params.toDate)

        val fromDate = parseDateOrThrow("fromDate", params.fromDate)
        val toDate = parseDateOrThrow("toDate", params.toDate)

        val markers = markerRepository.findBySurvey(
            surveyId = params.parent.surveyId,
            team = team,
            fromDate = fromDate,
            toDate = toDate,
        )
        call.respond(markers)
    }

    post<ApiV1Intern.Surveys.Id.Markers> { params ->
        val team = call.authorizedTeam
        val request = call.receive<CreateMarkerRequest>()

        val markerDate = parseDateOrThrow("markerDate", request.markerDate)
            ?: throw ApiErrorException.BadRequestException("Invalid markerDate: expected YYYY-MM-DD")
        val label = request.label.trim()
        val description = request.description?.trim()
        val color = request.color?.trim()

        validateLabel(label)
        validateDescription(description)
        validateColor(color)

        if (markerRepository.countBySurvey(params.parent.surveyId, team) >= MAX_MARKERS_PER_SURVEY) {
            throw ApiErrorException.BadRequestException("Maximum number of markers ($MAX_MARKERS_PER_SURVEY) reached for survey")
        }

        val createdBy = call.authorizedPrincipal.navIdent ?: call.authorizedPrincipal.email
        val marker = try {
            markerRepository.create(
                surveyId = params.parent.surveyId,
                markerDate = markerDate,
                label = label,
                description = description,
                color = color,
                team = team,
                createdBy = createdBy,
            )
        } catch (exception: SQLException) {
            if (exception.sqlState == "23514") {
                throw ApiErrorException.BadRequestException(
                    "Maximum number of markers ($MAX_MARKERS_PER_SURVEY) reached for survey",
                )
            }
            throw exception
        }
        call.respond(HttpStatusCode.Created, marker)
    }

    put<ApiV1Intern.Surveys.Id.Markers.Id> { params ->
        val team = call.authorizedTeam
        val markerId = parseUuidOrThrow(params.id, "marker ID")
        val request = call.receive<UpdateMarkerRequest>()
        val clearDescription = request.clearDescription == true
        val clearColor = request.clearColor == true

        if (request.markerDate == null &&
            request.label == null &&
            request.description == null &&
            request.color == null &&
            !clearDescription &&
            !clearColor
        ) {
            throw ApiErrorException.BadRequestException("At least one field must be provided for update")
        }

        if (request.description != null && clearDescription) {
            throw ApiErrorException.BadRequestException("description cannot be set when clearDescription is true")
        }
        if (request.color != null && clearColor) {
            throw ApiErrorException.BadRequestException("color cannot be set when clearColor is true")
        }

        val markerDate = request.markerDate?.let {
            parseDateOrThrow("markerDate", it)
                ?: throw ApiErrorException.BadRequestException("Invalid markerDate: expected YYYY-MM-DD")
        }
        val label = request.label?.trim()
        val description = request.description?.trim()
        val color = request.color?.trim()

        label?.let { validateLabel(it) }
        if (!clearDescription) {
            validateDescription(description)
        }
        if (!clearColor) {
            validateColor(color)
        }

        val updated = markerRepository.update(
            id = markerId,
            surveyId = params.parent.parent.surveyId,
            team = team,
            markerDate = markerDate,
            label = label,
            description = description,
            color = color,
            clearDescription = clearDescription,
            clearColor = clearColor,
        )

        if (updated == null) {
            call.respond(HttpStatusCode.NotFound)
        } else {
            call.respond(updated)
        }
    }

    delete<ApiV1Intern.Surveys.Id.Markers.Id> { params ->
        val team = call.authorizedTeam
        val markerId = parseUuidOrThrow(params.id, "marker ID")

        val deleted = markerRepository.delete(
            id = markerId,
            surveyId = params.parent.parent.surveyId,
            team = team,
        )

        if (deleted) {
            call.respond(HttpStatusCode.NoContent)
        } else {
            call.respond(HttpStatusCode.NotFound)
        }
    }
}

private fun parseUuidOrThrow(value: String, fieldName: String): UUID {
    return try {
        UUID.fromString(value)
    } catch (_: Exception) {
        throw ApiErrorException.BadRequestException("Invalid $fieldName")
    }
}

private fun validateLabel(label: String) {
    if (label.isBlank()) {
        throw ApiErrorException.BadRequestException("Label is required")
    }
    if (label.length > MAX_LABEL_LENGTH) {
        throw ApiErrorException.BadRequestException("Label must be at most $MAX_LABEL_LENGTH characters")
    }
}

private fun validateDescription(description: String?) {
    if (description != null && description.length > MAX_DESCRIPTION_LENGTH) {
        throw ApiErrorException.BadRequestException("Description must be at most $MAX_DESCRIPTION_LENGTH characters")
    }
}

private fun validateColor(color: String?) {
    if (color != null && !hexColorRegex.matches(color)) {
        throw ApiErrorException.BadRequestException("Invalid color: expected #RRGGBB")
    }
}
