package no.nav.lumi.config.auth

import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.slf4j.LoggerFactory

private val log = LoggerFactory.getLogger("TexasClient")

/**
 * Client for NAIS Texas sidecar - Token Exchange as a Service.
 * Uses the introspection endpoint to validate tokens.
 * 
 * @param introspectionEndpoint The Texas sidecar introspection URL (from ServerEnv)
 */
class TexasClient(
    private val introspectionEndpoint: String
) {
    companion object {
        private const val CONNECT_TIMEOUT_MS = 2_000L
        private const val REQUEST_TIMEOUT_MS = 5_000L
        private const val SOCKET_TIMEOUT_MS = 5_000L
    }

    private val client = HttpClient(CIO) {
        install(HttpTimeout) {
            connectTimeoutMillis = CONNECT_TIMEOUT_MS
            requestTimeoutMillis = REQUEST_TIMEOUT_MS
            socketTimeoutMillis = SOCKET_TIMEOUT_MS
        }
        install(ContentNegotiation) {
            json(Json {
                ignoreUnknownKeys = true
                isLenient = true
                encodeDefaults = true
            })
        }
    }

    /**
     * Introspect a token using the Texas sidecar.
     * Returns the introspection result with claims if valid, or null if invalid.
     */
    suspend fun introspect(token: String, identityProvider: String): TexasIntrospectionResult? {
        return try {
            // Introspection happens per request in NAIS; keep this at DEBUG to avoid log spam.
            log.debug("Introspecting token with Texas: $introspectionEndpoint")
            val response = client.post(introspectionEndpoint) {
                contentType(ContentType.Application.Json)
                setBody(TexasIntrospectionRequest(
                    identityProvider = identityProvider,
                    token = token
                ))
            }
            
            if (response.status != HttpStatusCode.OK) {
                // Avoid logging response bodies; they may contain claims/PII.
                log.warn("Texas introspection failed with status: ${response.status}")
                return null
            }

            val result = response.body<TexasIntrospectionResult>()
            
            if (!result.active) {
                // Avoid logging full claims payload.
                log.warn("Token validation failed - token is not active")
                return null
            }
            
            result
        } catch (e: Exception) {
            log.error("Failed to introspect token", e)
            null
        }
    }
    
    fun close() {
        client.close()
    }
}

@Serializable
data class TexasIntrospectionRequest(
    @SerialName("identity_provider")
    val identityProvider: String,
    @SerialName("token")
    val token: String
)

@Serializable
data class TexasIntrospectionResult(
    val active: Boolean,
    val sub: String? = null,
    val aud: String? = null,
    val iss: String? = null,
    val exp: Long? = null,
    val iat: Long? = null,
    val azp: String? = null,
    /** TokenX client id in format "cluster:namespace:app" */
    @SerialName("client_id")
    val clientId: String? = null,
    /** The calling application's name in format "cluster:namespace:app" */
    val azp_name: String? = null,
    /** NAV employee identifier */
    val NAVident: String? = null,
    /** User's display name */
    val name: String? = null,
    /** Often contains the user's email/UPN in Azure AD tokens */
    @SerialName("preferred_username")
    val preferredUsername: String? = null,
    /** Azure AD UPN (sometimes present) */
    val upn: String? = null,
    /** Azure AD email claim (sometimes present) */
    val email: String? = null,
    /** Azure AD unique_name claim (sometimes present) */
    @SerialName("unique_name")
    val uniqueName: String? = null,
    /** AD group UUIDs the user belongs to */
    val groups: List<String>? = null
)
