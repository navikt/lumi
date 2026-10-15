package no.nav.lumi.config

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import no.nav.lumi.config.auth.BrukerPrincipal
import no.nav.lumi.config.auth.CallerIdentity
import no.nav.lumi.config.auth.parseCallerIdentity
import no.nav.lumi.config.auth.pseudonymizeIdentifier
import no.nav.lumi.config.auth.TexasClient
import no.nav.lumi.config.auth.TexasUnavailableException
import no.nav.lumi.config.exception.ApiErrorException
import org.slf4j.LoggerFactory

private val logger = LoggerFactory.getLogger("Auth")

const val AZURE_REALM = "azure"

// Texas client instance (lazy initialized)
private val texasClient by lazy { 
    val endpoint = ServerEnv.current.nais.tokenIntrospectionEndpoint
        ?: "http://localhost:8080/introspect"
    TexasClient(introspectionEndpoint = endpoint)
}

fun Application.configureAuth() {
    val env = ServerEnv.current
    val authEnabled = env.nais.isNais
    
    if (authEnabled) {
        logger.info("Authentication enabled using NAIS Texas sidecar")
        
        install(Authentication) {
            texasBearer(texasClient)
        }
    } else {
        logger.warn("Authentication is DISABLED - running in local/test mode")
        install(Authentication) {
            bearer(AZURE_REALM) {
                realm = "lumi-api-test"
                authenticate { tokenCredential ->
                    if (tokenCredential.token.isNotBlank()) {
                        // Return a mock principal for local development
                        BrukerPrincipal(
                            navIdent = "Z999999",
                            name = "Lokal Utvikler",
                            email = "lokal.utvikler@nav.no",
                            clientId = env.auth.dashboardClientId,
                            groups = emptyList(),
                        )
                    } else null
                }
            }
        }
    }
}

/**
 * Bearer realm for dashboard calls, validated by the NAIS Texas sidecar.
 * A rejected token gives 401. Texas being unavailable gives 503, so the
 * dashboard can retry instead of treating the user as logged out.
 */
internal fun AuthenticationConfig.texasBearer(texasClient: TexasClient) {
    bearer(AZURE_REALM) {
        realm = "lumi-api"
        authenticate { tokenCredential ->
            validateTokenWithTexas(texasClient, tokenCredential.token)
        }
    }
}

/**
 * Validate token using NAIS Texas sidecar introspection endpoint.
 */
private suspend fun validateTokenWithTexas(texasClient: TexasClient, token: String): BrukerPrincipal? {
    val result = try {
        texasClient.introspect(token, identityProvider = "entra_id")
    } catch (e: TexasUnavailableException) {
        // No cause: StatusPages logs the cause chain, and the reason is already logged by TexasClient.
        throw ApiErrorException.ServiceUnavailableException(
            errorMessage = "Kunne ikke kontrollere innloggingen akkurat nå",
            details = "Dette er som regel midlertidig. Prøv igjen om litt.",
        )
    }

    if (result == null) {
        logger.warn("Token validation failed - introspection returned null")
        return null
    }

    val groups = result.groups ?: emptyList()
    logger.debug("Authenticated user {} with {} groups", pseudonymizeIdentifier(result.NAVident), groups.size)

    val email = result.preferredUsername
        ?: result.upn
        ?: result.email
        ?: result.uniqueName

    return BrukerPrincipal(
        navIdent = result.NAVident,
        name = result.name,
        email = email,
        clientId = result.azp_name,
        groups = groups
    )
}

/**
 * Extension to extract BrukerPrincipal from the authentication context.
 * Call this in authenticated routes to get the current user.
 */
fun ApplicationCall.getBrukerPrincipal(): BrukerPrincipal? {
    return principal<BrukerPrincipal>()
}

/**
 * Get the allowed client ID for the Lumi dashboard.
 * Format: "cluster:namespace:app" e.g. "dev-gcp:team-esyfo:lumi-dashboard"
 */
fun getDashboardClientId(): String = ServerEnv.current.auth.dashboardClientId

fun getClusterName(): String = ServerEnv.current.nais.clusterName ?: "dev-gcp"

fun isProdEnv(): Boolean = ServerEnv.current.nais.isProd

fun isDev(): Boolean = ServerEnv.current.nais.isLocal

/**
 * Extract caller identity from the principal's clientId (azp_name claim).
 * The clientId format is "cluster:namespace:app", e.g. "dev-gcp:team-esyfo:lumi-dashboard"
 * 
 * NOTE: Always use this function instead of decoding JWT tokens directly.
 * The principal has already been validated by the Texas sidecar.
 */
fun extractCallerIdentityFromPrincipal(principal: BrukerPrincipal): CallerIdentity? {
    return try {
        val callerId = principal.clientId ?: return null
        parseCallerIdentity(
            callerId = callerId,
            navIdent = principal.navIdent,
            name = principal.name,
        )
    } catch (e: Exception) {
        logger.error("Failed to extract caller identity from principal", e)
        null
    }
}
