package no.nav.lumi.integrations.bigquery

import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsText
import io.ktor.http.isSuccess
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.longOrNull
import java.time.Clock
import java.time.Duration
import java.time.Instant

/** Credentials for calling Google APIs as Lumi's own service account. */
interface GoogleCredentials {
    /** A bearer token for Google APIs. Throws when no token can be obtained. */
    suspend fun accessToken(): String

    /** The email of the service account teams grant access to, or null when unknown. */
    suspend fun serviceAccountEmail(): String?
}

/**
 * Reads credentials from the GKE metadata server. Nais binds every workload to a Google service
 * account with workload identity, and `metadata.google.internal` is open for every workload.
 */
class GoogleMetadataCredentials(
    private val client: HttpClient,
    private val clock: Clock = Clock.systemUTC(),
    private val baseUrl: String = DEFAULT_BASE_URL,
) : GoogleCredentials {
    private val mutex = Mutex()
    private var cachedToken: CachedToken? = null
    private var cachedEmail: String? = null

    override suspend fun accessToken(): String = mutex.withLock {
        cachedToken?.takeIf { it.expiresAt.isAfter(Instant.now(clock).plus(REFRESH_MARGIN)) }?.let {
            return@withLock it.value
        }
        val response = client.get("$baseUrl/instance/service-accounts/default/token") {
            header(METADATA_FLAVOR_HEADER, METADATA_FLAVOR)
        }
        check(response.status.isSuccess()) { "Metadata server returned ${response.status.value} for token" }
        val body = json.parseToJsonElement(response.bodyAsText()) as? JsonObject
        val token = (body?.get("access_token") as? JsonPrimitive)?.contentOrNull
            ?: error("Metadata server returned no access token")
        val expiresIn = (body["expires_in"] as? JsonPrimitive)?.longOrNull ?: DEFAULT_TOKEN_LIFETIME_SECONDS
        cachedToken = CachedToken(token, Instant.now(clock).plusSeconds(expiresIn))
        token
    }

    override suspend fun serviceAccountEmail(): String? = mutex.withLock {
        cachedEmail?.let { return@withLock it }
        val email = runCatching {
            val response = client.get("$baseUrl/instance/service-accounts/default/email") {
                header(METADATA_FLAVOR_HEADER, METADATA_FLAVOR)
            }
            if (response.status.isSuccess()) response.bodyAsText().trim().takeIf { it.contains('@') } else null
        }.getOrNull()
        cachedEmail = email
        email
    }

    private data class CachedToken(val value: String, val expiresAt: Instant)

    companion object {
        const val DEFAULT_BASE_URL = "http://metadata.google.internal/computeMetadata/v1"
        private const val METADATA_FLAVOR_HEADER = "Metadata-Flavor"
        private const val METADATA_FLAVOR = "Google"
        private const val DEFAULT_TOKEN_LIFETIME_SECONDS = 300L
        private val REFRESH_MARGIN: Duration = Duration.ofMinutes(1)
        private val json = Json { ignoreUnknownKeys = true }
    }
}
