package no.nav.lumi.config.auth

import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.routing.*
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.integrations.nais.NaisApiResult
import no.nav.lumi.integrations.nais.NaisGraphQlClient
import org.slf4j.LoggerFactory

private val log = LoggerFactory.getLogger("no.nav.lumi.config.auth.TeamAuthorizationPlugin")

/**
 * Minimal abstraction so TeamAuthorizationPlugin can be tested without calling the real NAIS API.
 */
interface NaisTeamLookup {
    suspend fun getTeamSlugsForUserResult(email: String): NaisApiResult<Set<String>>
    suspend fun getTeamSlugsForViewerResult(): NaisApiResult<Set<String>>

    suspend fun getTeamSlugsForUser(email: String): Set<String> =
        getTeamSlugsForUserResult(email).getOrDefault(emptySet())

    suspend fun getTeamSlugsForViewer(): Set<String> =
        getTeamSlugsForViewerResult().getOrDefault(emptySet())
}

private class NaisGraphQlTeamLookup(private val client: NaisGraphQlClient) : NaisTeamLookup {
    override suspend fun getTeamSlugsForUserResult(email: String): NaisApiResult<Set<String>> =
        client.getTeamSlugsForUserResult(email)

    override suspend fun getTeamSlugsForViewerResult(): NaisApiResult<Set<String>> =
        client.getTeamSlugsForViewerResult()
}

class TeamAuthorizationConfig {
    /**
     * Provides a NAIS team lookup implementation (or null to disable NAIS lookup).
     * Defaults to env-based NAIS GraphQL client when configured.
     */
    var naisTeamLookupProvider: () -> NaisTeamLookup? = {
        NaisGraphQlClient.fromEnvOrNull()?.let { NaisGraphQlTeamLookup(it) }
    }
}

/**
 * Route-scoped plugin that enforces team authorization.
 * 
 * Usage:
 * ```
 * authenticate(AZURE_REALM) {
 *     install(TeamAuthorizationPlugin)
 *     
 *     get("/api/v1/intern/stats/dashboard") {
 *         val team = call.authorizedTeam  // Already validated
 *         // ... use team
 *     }
 * }
 * ```
 */
val TeamAuthorizationPlugin = createRouteScopedPlugin("TeamAuthorization", ::TeamAuthorizationConfig) {

    val naisLookup = pluginConfig.naisTeamLookupProvider()
    
    on(AuthenticationChecked) { call ->
        val principal = call.principal<BrukerPrincipal>()
        
        if (principal == null) {
            log.warn("TeamAuthorization: No principal found")
            throw ApiErrorException.UnauthorizedException("Not authenticated")
        }

        if (naisLookup == null) {
            log.error("TeamAuthorization: NAIS team lookup is not configured (missing NAIS_API_KEY/TEAMS_TOKEN and/or NAIS_API_GRAPHQL_URL/NAIS_API_ENDPOINT)")
            throw ApiErrorException.ServiceUnavailableException(
                errorMessage = "Team lookup via NAIS is not configured",
                details = "Missing NAIS configuration for team lookup.",
            )
        }

        val authorizedTeamsResult = resolveAuthorizedTeams(principal, naisLookup)

        val authorizedTeams = when (authorizedTeamsResult) {
            is NaisApiResult.Success -> authorizedTeamsResult.value
            is NaisApiResult.Error -> {
                // NAIS lookup failed (e.g. outage/timeout/401). Treat as temporary service problem.
                val msg = "TeamAuthorization: NAIS team lookup failed (${authorizedTeamsResult.message}) for ${pseudonymizeIdentifier(principal.navIdent)}"
                if (authorizedTeamsResult.message.contains("cached", ignoreCase = true)) {
                    log.debug(msg)
                } else {
                    log.warn(msg)
                }

                throw ApiErrorException.ServiceUnavailableException(
                    errorMessage = "Kunne ikke hente teamtilgang akkurat nå",
                    details = "Dette er ofte midlertidig (f.eks. NAIS API-nedetid). Prøv igjen om litt.",
                )
            }
        }

        if (authorizedTeams.isEmpty()) {
            log.warn("TeamAuthorization: User {} has no authorized teams", pseudonymizeIdentifier(principal.navIdent))
            throw ApiErrorException.ForbiddenException(
                errorMessage = "Du har ikke tilgang til noen team i Lumi",
                details = "For å få tilgang må teamet ditt onboardes.",
                helpUrl = "https://github.com/navikt/lumi#getting-access",
            )
        }
        
        // Get requested team from query parameter
        val requestedTeam = call.request.queryParameters["team"]
        
        // Validate requested team or use primary team
        val team = if (requestedTeam != null && requestedTeam in authorizedTeams) {
            requestedTeam
        } else if (requestedTeam != null && requestedTeam !in authorizedTeams) {
            log.warn("TeamAuthorization: User {} requested unauthorized team", pseudonymizeIdentifier(principal.navIdent))
            throw ApiErrorException.ForbiddenException(
                errorMessage = "Du har ikke tilgang til team: $requestedTeam",
            )
        } else {
            // Pick a stable team from the resolved set.
            authorizedTeams.sorted().first()
        }
        
        // Store in call attributes for route handlers
        call.attributes.put(AuthorizationAttributes.AuthorizedTeamKey, team)
        call.attributes.put(AuthorizationAttributes.AuthorizedTeamsKey, authorizedTeams)
        call.attributes.put(AuthorizationAttributes.AuthorizedPrincipalKey, principal)
    }
}

private suspend fun resolveAuthorizedTeams(
    principal: BrukerPrincipal,
    naisLookup: NaisTeamLookup
): NaisApiResult<Set<String>> {
    val email = principal.email

    val teamsByEmailResult: NaisApiResult<Set<String>> = if (!email.isNullOrBlank()) {
        naisLookup.getTeamSlugsForUserResult(email)
    } else {
        // Some tokens may not include email; try viewer query instead.
        log.debug("User {} has no email claim, falling back to NAIS viewer lookup", pseudonymizeIdentifier(principal.navIdent))
        naisLookup.getTeamSlugsForViewerResult()
    }

    val resolvedTeamsResult: NaisApiResult<Set<String>> = when (teamsByEmailResult) {
        is NaisApiResult.Success -> {
            if (teamsByEmailResult.value.isNotEmpty()) {
                log.debug(
                    "Resolved teams from NAIS API (by email) for {} (count={})",
                    pseudonymizeIdentifier(principal.navIdent),
                    teamsByEmailResult.value.size
                )
                teamsByEmailResult
            } else {
                // Matches NAIS Console behavior: `me { ... on User { teams { ... }}}`.
                // Depending on NAIS API auth configuration, `me` might not be a User.
                val viewerTeamsResult = naisLookup.getTeamSlugsForViewerResult()
                if (viewerTeamsResult is NaisApiResult.Success && viewerTeamsResult.value.isNotEmpty()) {
                    log.debug(
                        "Resolved teams from NAIS API (viewer query) for {} (count={})",
                        pseudonymizeIdentifier(principal.navIdent),
                        viewerTeamsResult.value.size
                    )
                }
                viewerTeamsResult
            }
        }
        is NaisApiResult.Error -> teamsByEmailResult
    }

    return resolvedTeamsResult
}

/**
 * Get the authorized team for this request.
 * Only available after TeamAuthorizationPlugin has run.
 */
val ApplicationCall.authorizedTeam: String
    get() = attributes[AuthorizationAttributes.AuthorizedTeamKey]

/**
 * Get all teams the user is authorized for.
 * Only available after TeamAuthorizationPlugin has run.
 */
val ApplicationCall.authorizedTeams: Set<String>
    get() = attributes[AuthorizationAttributes.AuthorizedTeamsKey]

/**
 * Get the authenticated principal.
 * Only available after TeamAuthorizationPlugin has run.
 */
val ApplicationCall.authorizedPrincipal: BrukerPrincipal
    get() = attributes[AuthorizationAttributes.AuthorizedPrincipalKey]
