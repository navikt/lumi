package no.nav.lumi.config

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.plugins.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import no.nav.lumi.config.exception.ApiError
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.config.exception.ErrorType
import no.nav.lumi.config.auth.CallerIdentityKey
import org.slf4j.LoggerFactory

private val statusPageLog = LoggerFactory.getLogger("StatusPages")
private val defaultDefinitionConflictObservability = DefinitionConflictObservability()

fun Application.configureStatusPages(
    definitionConflictObservability: DefinitionConflictObservability = defaultDefinitionConflictObservability
) {
    install(StatusPages) {
        exception<Throwable> { call, cause ->
            if (cause is ApiErrorException.DefinitionConflictException) {
                definitionConflictObservability.record(
                    conflict = cause,
                    path = call.request.path(),
                    app = call.attributes.getOrNull(CallerIdentityKey)?.app
                )
            } else {
                logException(call, cause)
            }
            val apiError = determineApiError(cause, call.request.path())
            call.respond(HttpStatusCode.fromValue(apiError.status), apiError)
        }
        
        status(HttpStatusCode.Forbidden) { call, status ->
            val path = call.request.path()
            statusPageLog.warn("StatusPages caught 403 Forbidden on $path - responding with ApiError")
            val apiError = ApiError.forbidden(status.description, path)
            call.respond(HttpStatusCode.Forbidden, apiError)
        }
        
        status(HttpStatusCode.Unauthorized) { call, status ->
            val path = call.request.path()
            statusPageLog.warn("StatusPages caught 401 Unauthorized on $path - responding with ApiError")
            val apiError = ApiError.unauthorized(status.description, path)
            call.respond(HttpStatusCode.Unauthorized, apiError)
        }
        
        status(HttpStatusCode.NotFound) { call, status ->
            val path = call.request.path()
            statusPageLog.info("StatusPages caught 404 NotFound on $path - responding with ApiError")
            val apiError = ApiError.notFound(status.description, path)
            call.respond(HttpStatusCode.NotFound, apiError)
        }
    }
}

private fun logException(call: ApplicationCall, cause: Throwable) {
    val logMessage = "Caught ${cause::class.simpleName} exception on ${call.request.path()}"
    when (cause) {
        is ApiErrorException -> statusPageLog.warn(logMessage, cause)
        else -> statusPageLog.error(logMessage, cause)
    }
}

/**
 * Determines the appropriate ApiError for a given exception.
 * Follows the esyfo-narmesteleder pattern of using ApiErrorException.toApiError().
 */
private fun determineApiError(cause: Throwable, path: String?): ApiError {
    return when (cause) {
        // ApiErrorException subclasses know how to convert themselves
        is ApiErrorException -> cause.toApiError(path)
        
        // Ktor built-in exceptions
        is BadRequestException -> handleBadRequestException(cause, path)
        is NotFoundException -> ApiError.notFound(cause.message ?: "Not found", path)
        
        // Standard library exceptions
        is IllegalArgumentException -> ApiError.badRequest(safeBadRequestMessage(cause.message), path)
        is IllegalStateException -> ApiError.badRequest(safeBadRequestMessage(cause.message), path)
        
        // Catch-all for unknown exceptions
        else -> ApiError.internalServerError(
            if (isDev()) cause.message ?: "Internal server error" else "Internal server error",
            path
        )
    }
}

/**
 * Handles BadRequestException with special care for missing required fields.
 */
private fun handleBadRequestException(cause: BadRequestException, path: String?): ApiError {
    val rootCause = cause.rootCause()
    val message = safeBadRequestMessage(rootCause.message ?: cause.message)
    return ApiError.badRequest(message, path)
}

private fun safeBadRequestMessage(message: String?): String {
    return if (isDev()) {
        message ?: "Bad request"
    } else {
        "Bad request"
    }
}

/**
 * Finds the root cause of an exception chain.
 * Prevents infinite loops by checking for self-referencing causes.
 */
fun Throwable.rootCause(): Throwable {
    var root: Throwable = this
    while (root.cause != null && root.cause != root) {
        root = root.cause!!
    }
    return root
}
