package no.nav.lumi.config.auth

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.util.AttributeKey
import no.nav.lumi.config.ServerEnv
import no.nav.lumi.config.exception.ApiErrorException
import org.slf4j.LoggerFactory

/**
 * Attribute key for storing a hashed per-user rate limit key.
 * The value is a SHA-256 hash of the user's unique identifier,
 * never the raw identifier itself.
 */
val UserRateLimitHashKey = AttributeKey<String>("UserRateLimitHash")

private val log = LoggerFactory.getLogger("SubmissionAuthPlugin")

/**
 * Authentication plugins for submission routes.
 *
 * Submission is intentionally split by issuer to avoid guessing:
 * - TokenX (end-user apps)
 * - AzureAD (internal tools)
 *
 * Submission routes must not store end-user identifiers.
 */
class SubmissionAuthPluginConfig

private fun createSubmissionAuthPlugin(
    pluginName: String,
    identityProvider: String,
    endpointHint: String,
    callerIdentityClaim: String,
    extractCallerId: (TexasIntrospectionResult) -> String?,
    extractUserKey: (TexasIntrospectionResult) -> String?
) = createRouteScopedPlugin(
    name = pluginName,
    createConfiguration = ::SubmissionAuthPluginConfig,
) {
    val env = ServerEnv.current
    val isNais = env.nais.isNais
    
    val texasClient = if (isNais && env.nais.tokenIntrospectionEndpoint != null) {
        TexasClient(env.nais.tokenIntrospectionEndpoint)
    } else {
        null
    }
    
    onCall { call ->
        if (!isNais) {
            // Local dev/tests - create mock identity
            log.warn("$pluginName: Running in local mode, using mock identity")
            call.attributes.put(
                CallerIdentityKey,
                CallerIdentity(
                    team = "local-dev",
                    app = "local-app",
                    navIdent = null,
                    name = null
                )
            )
            call.attributes.put(UserRateLimitHashKey, "user:local-dev:local-app:mock")
            return@onCall
        }
        
        val authHeader = call.request.header(HttpHeaders.Authorization)
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            log.warn("$pluginName: Missing or invalid Authorization header")
            throw ApiErrorException.UnauthorizedException(
                "Authorization header required (Bearer token). Expected issuer=$identityProvider. Use $endpointHint"
            )
        }
        
        val token = authHeader.removePrefix("Bearer ")

        val client = texasClient
            ?: run {
                log.error("$pluginName: Missing Texas introspection config in NAIS")
                throw ApiErrorException.InternalServerErrorException(
                    "Token introspection is not configured (missing NAIS_TOKEN_INTROSPECTION_ENDPOINT)"
                )
            }

        val introspectionResult = client.introspect(token, identityProvider = identityProvider)
        
        if (introspectionResult == null || !introspectionResult.active) {
            log.warn("$pluginName: Token validation failed")
            throw ApiErrorException.UnauthorizedException(
                "Invalid or expired token for issuer=$identityProvider. Ensure you call $endpointHint"
            )
        }

        val callerId = extractCallerId(introspectionResult)
        if (callerId.isNullOrBlank()) {
            log.error("$pluginName: Missing caller identity claim in token (claim=$callerIdentityClaim)")
            throw ApiErrorException.UnauthorizedException(
                "Missing caller identity in token (claim=$callerIdentityClaim)"
            )
        }

        val identity = parseCallerIdentity(
            callerId = callerId,
            // Submission routes should not store raw user identifiers.
            // A hashed per-user key is stored separately for rate limiting only.
            navIdent = null,
            name = null
        )
            ?: run {
                log.error("$pluginName: Invalid caller identity format: $callerId")
                throw ApiErrorException.UnauthorizedException("Invalid caller identity format")
            }

        log.info("$pluginName: Authenticated submission from team=${identity.team} app=${identity.app}")
        call.attributes.put(CallerIdentityKey, identity)

        val userKey = extractUserKey(introspectionResult)
        if (userKey != null) {
            val hash = sha256Hex(userKey)
            call.attributes.put(UserRateLimitHashKey, "user:${identity.team}:${identity.app}:$hash")
        }
    }
}

val TokenXSubmissionAuthPlugin = createSubmissionAuthPlugin(
    pluginName = "TokenXSubmissionAuthPlugin",
    identityProvider = "tokenx",
    endpointHint = "/api/tokenx/v1/feedback",
    callerIdentityClaim = "client_id",
    extractCallerId = { it.clientId },
    extractUserKey = { it.sub }
)

val AzureSubmissionAuthPlugin = createSubmissionAuthPlugin(
    pluginName = "AzureSubmissionAuthPlugin",
    identityProvider = "azuread",
    endpointHint = "/api/azure/v1/feedback",
    callerIdentityClaim = "azp_name",
    extractCallerId = { it.azp_name },
    extractUserKey = { it.sub }
)

/**
 * Attribute key for storing caller identity in request.
 */
val CallerIdentityKey = io.ktor.util.AttributeKey<CallerIdentity>("CallerIdentity")

/**
 * Extension to get caller identity from the request.
 * Throws if not authenticated.
 */
fun ApplicationCall.getCallerIdentity(): CallerIdentity {
    return attributes.getOrNull(CallerIdentityKey)
        ?: throw ApiErrorException.UnauthorizedException("Caller identity not found - authentication required")
}

