package no.nav.lumi.config.auth

data class BrukerPrincipal(
    val navIdent: String?,
    val name: String?,
    val email: String?,
    val token: String,
    val clientId: String?,
    /** AD group UUIDs the user belongs to */
    val groups: List<String> = emptyList()
)

/**
 * Caller identity extracted from the calling application's identity claims.
 *
 * - AzureAD: typically `azp_name` ("cluster:namespace:app")
 * - TokenX: typically `client_id` ("cluster:namespace:app")
 *
 * Used for both analytics routes and submission routes.
 */
data class CallerIdentity(
    val team: String,
    val app: String,
    val navIdent: String?,
    val name: String?
)

/**
 * Parse a caller id in the common NAIS format "cluster:namespace:app".
 *
 * Returns null if the format is invalid.
 */
fun parseCallerIdentity(
    callerId: String,
    navIdent: String? = null,
    name: String? = null
): CallerIdentity? {
    val parts = callerId.split(":")
    if (parts.size < 3) return null
    val team = parts[parts.size - 2]
    val app = parts[parts.size - 1]
    if (team.isBlank() || app.isBlank()) return null
    return CallerIdentity(
        team = team,
        app = app,
        navIdent = navIdent,
        name = name
    )
}

