package no.nav.lumi.config.auth

import io.ktor.server.application.*
import no.nav.lumi.config.getBrukerPrincipal
import no.nav.lumi.config.exception.ApiErrorException

/**
 * Extension to get the authorized team for this call.
 * This team is resolved and validated by TeamAuthorizationPlugin.
 * 
 * Throws ForbiddenException if no team is authorized.
 */
val ApplicationCall.authorizedTeamSafe: String
    get() = attributes.getOrNull(AuthorizationAttributes.AuthorizedTeamKey)
        ?: throw ApiErrorException.ForbiddenException("Access denied: No authorized team found for this request")

/**
 * Extension to get all teams the user is authorized for.
 * Returns empty set if authorization context is not available.
 */
val ApplicationCall.authorizedTeamsSafe: Set<String>
    get() = attributes.getOrNull(AuthorizationAttributes.AuthorizedTeamsKey) ?: emptySet()

/**
 * Extension to get the validated principal.
 */
val ApplicationCall.brukerPrincipalSafe: BrukerPrincipal
    get() = this.getBrukerPrincipal() 
        ?: throw ApiErrorException.UnauthorizedException("Authentication required")

/**
 * Extension to get the validated caller identity for submission routes.
 */
val ApplicationCall.callerIdentitySafe: CallerIdentity
    get() = this.getCallerIdentity()
