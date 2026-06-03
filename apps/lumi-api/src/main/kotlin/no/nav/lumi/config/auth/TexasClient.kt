package no.nav.lumi.config.auth

import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.Timer
import kotlinx.coroutines.CompletableDeferred
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import no.nav.lumi.config.appMicrometerRegistry
import org.slf4j.LoggerFactory
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.Base64
import java.util.concurrent.ConcurrentHashMap

private val log = LoggerFactory.getLogger("TexasClient")

/**
 * Client for NAIS Texas sidecar - Token Exchange as a Service.
 * Uses the introspection endpoint to validate tokens.
 * 
 * @param introspectionEndpoint The Texas sidecar introspection URL (from ServerEnv)
 */
class TexasClient(
    private val introspectionEndpoint: String,
    private val tokenExchangeEndpoint: String? = null,
    private val clock: Clock = Clock.systemUTC(),
    private val client: HttpClient = defaultHttpClient()
) {
    companion object {
        private const val CONNECT_TIMEOUT_MS = 2_000L
        private const val REQUEST_TIMEOUT_MS = 5_000L
        private const val SOCKET_TIMEOUT_MS = 5_000L
        private const val MAX_CACHE_ENTRIES = 1_000
        private val CACHE_EXPIRY_SKEW: Duration = Duration.ofSeconds(60)
        private val DEFAULT_CACHE_TTL: Duration = Duration.ofMinutes(5)

        private fun defaultHttpClient(): HttpClient {
            return HttpClient(CIO) {
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
        }
    }

    private data class CacheEntry(
        val result: TexasIntrospectionResult,
        val expiresAt: Instant,
    )

    private val cache = ConcurrentHashMap<String, CacheEntry>()
    private val inFlightRequests = ConcurrentHashMap<String, CompletableDeferred<TexasIntrospectionResult?>>()

    private val cacheHitCounter = Counter.builder("texas_introspection_cache_hits_total")
        .description("Number of Texas introspection cache hits")
        .register(appMicrometerRegistry)

    private val cacheMissCounter = Counter.builder("texas_introspection_cache_misses_total")
        .description("Number of Texas introspection cache misses")
        .register(appMicrometerRegistry)

    private val inFlightHitCounter = Counter.builder("texas_introspection_in_flight_hits_total")
        .description("Number of Texas introspection requests deduplicated by an in-flight request")
        .register(appMicrometerRegistry)

    private val errorCounter = Counter.builder("texas_introspection_errors_total")
        .description("Number of Texas introspection errors")
        .register(appMicrometerRegistry)

    private val introspectionTimer = Timer.builder("texas_introspection_duration_seconds")
        .description("Duration of Texas introspection HTTP requests")
        .register(appMicrometerRegistry)

    private val tokenExchangeErrorCounter = Counter.builder("texas_token_exchange_errors_total")
        .description("Number of Texas token exchange errors")
        .register(appMicrometerRegistry)

    private val tokenExchangeTimer = Timer.builder("texas_token_exchange_duration_seconds")
        .description("Duration of Texas token exchange HTTP requests")
        .register(appMicrometerRegistry)

    /**
     * Introspect a token using the Texas sidecar.
     * Returns the introspection result with claims if valid, or null if invalid.
     */
    suspend fun introspect(token: String, identityProvider: String): TexasIntrospectionResult? {
        val cacheKey = cacheKey(token, identityProvider)
        cachedResult(cacheKey)?.let { result ->
            cacheHitCounter.increment()
            return result
        }

        val deferred = CompletableDeferred<TexasIntrospectionResult?>()
        val inFlight = inFlightRequests.putIfAbsent(cacheKey, deferred)
        if (inFlight != null) {
            inFlightHitCounter.increment()
            return inFlight.await()
        }

        cacheMissCounter.increment()

        return try {
            val result = requestIntrospection(token, identityProvider)
            if (result != null) {
                cacheResult(cacheKey, result)
            }
            deferred.complete(result)
            result
        } catch (e: Throwable) {
            deferred.completeExceptionally(e)
            throw e
        } finally {
            inFlightRequests.remove(cacheKey, deferred)
        }
    }

    private suspend fun requestIntrospection(token: String, identityProvider: String): TexasIntrospectionResult? {
        val start = System.nanoTime()
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
            errorCounter.increment()
            log.error("Failed to introspect token", e)
            null
        } finally {
            introspectionTimer.record(Duration.ofNanos(System.nanoTime() - start))
        }
    }

    /**
     * Exchange an inbound user token for an on-behalf-of token targeting another API.
     *
     * Texas handles token caching; this method intentionally does not add a second
     * application cache around exchange results.
     */
    suspend fun exchangeToken(
        userToken: String,
        identityProvider: String,
        target: String,
        skipCache: Boolean = false
    ): TexasTokenExchangeResult? {
        val endpoint = tokenExchangeEndpoint
        if (endpoint.isNullOrBlank()) {
            log.warn("Texas token exchange endpoint is not configured")
            return null
        }

        val start = System.nanoTime()
        return try {
            val response = client.post(endpoint) {
                contentType(ContentType.Application.Json)
                setBody(
                    TexasTokenExchangeRequest(
                        identityProvider = identityProvider,
                        target = target,
                        userToken = userToken,
                        skipCache = skipCache.takeIf { it }
                    )
                )
            }

            if (response.status != HttpStatusCode.OK) {
                log.warn("Texas token exchange failed with status: ${response.status}")
                return null
            }

            response.body<TexasTokenExchangeResult>()
        } catch (e: Exception) {
            tokenExchangeErrorCounter.increment()
            log.error("Failed to exchange token with Texas", e)
            null
        } finally {
            tokenExchangeTimer.record(Duration.ofNanos(System.nanoTime() - start))
        }
    }

    private fun cachedResult(cacheKey: String): TexasIntrospectionResult? {
        val entry = cache[cacheKey] ?: return null
        if (entry.expiresAt.isAfter(clock.instant())) {
            return entry.result
        }
        cache.remove(cacheKey, entry)
        return null
    }

    private fun cacheResult(cacheKey: String, result: TexasIntrospectionResult) {
        val expiresAt = cacheExpiresAt(result) ?: return
        pruneCache()
        cache[cacheKey] = CacheEntry(result, expiresAt)
    }

    private fun cacheExpiresAt(result: TexasIntrospectionResult): Instant? {
        val now = clock.instant()
        val maxExpiresAt = now.plus(DEFAULT_CACHE_TTL)
        val tokenExpiresAt = result.exp
            ?.let { Instant.ofEpochSecond(it).minus(CACHE_EXPIRY_SKEW) }
            ?: maxExpiresAt
        val expiresAt = minOf(tokenExpiresAt, maxExpiresAt)
        return expiresAt.takeIf { it.isAfter(now) }
    }

    private fun pruneCache() {
        val now = clock.instant()
        cache.entries.removeIf { !it.value.expiresAt.isAfter(now) }
        if (cache.size < MAX_CACHE_ENTRIES) return

        val keysToRemove = cache.keys().asSequence()
            .take(cache.size - MAX_CACHE_ENTRIES + 1)
            .toList()
        keysToRemove.forEach { cache.remove(it) }
    }

    private fun cacheKey(token: String, identityProvider: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest("$identityProvider\u0000$token".toByteArray(StandardCharsets.UTF_8))
        return Base64.getUrlEncoder().withoutPadding().encodeToString(digest)
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
data class TexasTokenExchangeRequest(
    @SerialName("identity_provider")
    val identityProvider: String,
    val target: String,
    @SerialName("user_token")
    val userToken: String,
    @SerialName("skip_cache")
    val skipCache: Boolean? = null
)

@Serializable
data class TexasTokenExchangeResult(
    @SerialName("access_token")
    val accessToken: String,
    @SerialName("expires_in")
    val expiresIn: Long? = null,
    @SerialName("token_type")
    val tokenType: String? = null
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
