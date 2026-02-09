package no.nav.lumi.config.auth

import io.ktor.util.AttributeKey

/**
 * Shared attribute keys for authorization context stored on ApplicationCall.
 *
 * Ktor attribute keys use reference equality, so they must be shared from one place.
 */
object AuthorizationAttributes {
    val AuthorizedTeamKey = AttributeKey<String>("authorizedTeam")
    val AuthorizedTeamsKey = AttributeKey<Set<String>>("authorizedTeams")
    val AuthorizedPrincipalKey = AttributeKey<BrukerPrincipal>("authorizedPrincipal")
}
