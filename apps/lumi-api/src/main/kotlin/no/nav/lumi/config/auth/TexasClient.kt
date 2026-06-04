package no.nav.lumi.config.auth

import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.cio.*
import io.ktor.client.network.sockets.ConnectTimeoutException
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.HttpRequestTimeoutException
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.Tags
import io.micrometer.core.instrument.Timer
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import no.nav.lumi.config.appMicrometerRegistry
import org.slf4j.LoggerFactory
import java.net.ConnectException
import java.net.SocketException
import java.net.SocketTimeoutException
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
    private val clock: Clock = Clock.systemUTC(),
    private val client: HttpClient = defaultHttpClient(),
    private val meterRegistry: MeterRegistry = appMicrometerRegistry,
) {
    companion object {
        private const val CONNECT_TIMEOUT_MS = 250L
        private const val REQUEST_TIMEOUT_MS = 1_250L
        private const val SOCKET_TIMEOUT_MS = 1_250L
        private const val MAX_INTROSPECTION_ATTEMPTS = 2
        private const val MAX_CACHE_ENTRIES = 1_000
        private val CACHE_EXPIRY_SKEW: Duration = Duration.ofSeconds(60)
        private val DEFAULT_CACHE_TTL: Duration = Duration.ofMinutes(5)
        private val SLOW_INTROSPECTION_THRESHOLD: Duration = Duration.ofSeconds(1)

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

    private data class IntrospectionHttpMetricKey(
        val identityProvider: String,
        val status: String,
        val outcome: String,
    )

    private val cache = ConcurrentHashMap<String, CacheEntry>()
    private val inFlightRequests = ConcurrentHashMap<String, CompletableDeferred<TexasIntrospectionResult?>>()
    private val introspectionHttpTimers = ConcurrentHashMap<IntrospectionHttpMetricKey, Timer>()
    private val introspectionHttpCounters = ConcurrentHashMap<IntrospectionHttpMetricKey, Counter>()

    private val cacheHitCounter = Counter.builder("texas_introspection_cache_hits_total")
        .description("Number of Texas introspection cache hits")
        .register(meterRegistry)

    private val cacheMissCounter = Counter.builder("texas_introspection_cache_misses_total")
        .description("Number of Texas introspection cache misses")
        .register(meterRegistry)

    private val inFlightHitCounter = Counter.builder("texas_introspection_in_flight_hits_total")
        .description("Number of Texas introspection requests deduplicated by an in-flight request")
        .register(meterRegistry)

    private val errorCounter = Counter.builder("texas_introspection_errors_total")
        .description("Number of Texas introspection errors")
        .register(meterRegistry)

    private val introspectionTimer = Timer.builder("texas_introspection_duration_seconds")
        .description("Duration of Texas introspection HTTP requests")
        .register(meterRegistry)

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
        var finalStatusTag = "unknown"
        var finalOutcomeTag = "unknown"
        var finalExceptionTag = "none"
        try {
            repeat(MAX_INTROSPECTION_ATTEMPTS) { attemptIndex ->
                val attemptNumber = attemptIndex + 1
                val attemptStart = System.nanoTime()
                var attemptStatusTag = "unknown"
                var attemptOutcomeTag = "unknown"
                var attemptExceptionTag = "none"

                try {
                    // Introspection happens per request in NAIS; keep this at DEBUG to avoid log spam.
                    log.debug("Introspecting token with Texas: $introspectionEndpoint")
                    val response = client.post(introspectionEndpoint) {
                        contentType(ContentType.Application.Json)
                        setBody(TexasIntrospectionRequest(
                            identityProvider = identityProvider,
                            token = token
                        ))
                    }
                    attemptStatusTag = response.status.value.toString()

                    if (response.status != HttpStatusCode.OK) {
                        attemptOutcomeTag = "http_error"
                        finalStatusTag = attemptStatusTag
                        finalOutcomeTag = attemptOutcomeTag
                        // Avoid logging response bodies; they may contain claims/PII.
                        log.warn("Texas introspection failed with status: ${response.status}")
                        return null
                    }

                    val result = response.body<TexasIntrospectionResult>()

                    if (!result.active) {
                        attemptOutcomeTag = "inactive"
                        finalStatusTag = attemptStatusTag
                        finalOutcomeTag = attemptOutcomeTag
                        // Avoid logging full claims payload.
                        log.warn("Token validation failed - token is not active")
                        return null
                    }

                    attemptOutcomeTag = "active"
                    finalStatusTag = attemptStatusTag
                    finalOutcomeTag = attemptOutcomeTag
                    finalExceptionTag = "none"
                    return result
                } catch (e: CancellationException) {
                    attemptStatusTag = "cancelled"
                    attemptOutcomeTag = "cancelled"
                    attemptExceptionTag = e.javaClass.simpleName
                    finalStatusTag = attemptStatusTag
                    finalOutcomeTag = attemptOutcomeTag
                    finalExceptionTag = attemptExceptionTag
                    throw e
                } catch (e: Exception) {
                    attemptStatusTag = "exception"
                    attemptOutcomeTag = "exception"
                    attemptExceptionTag = e.javaClass.simpleName
                    finalStatusTag = attemptStatusTag
                    finalOutcomeTag = attemptOutcomeTag
                    finalExceptionTag = attemptExceptionTag

                    val shouldRetry =
                        attemptNumber < MAX_INTROSPECTION_ATTEMPTS && e.isTransientTransportFailure()
                    if (shouldRetry) {
                        log.warn(
                            "Transient Texas introspection failure on attempt {} of {}, retrying once: {}",
                            attemptNumber,
                            MAX_INTROSPECTION_ATTEMPTS,
                            attemptExceptionTag,
                        )
                    } else {
                        errorCounter.increment()
                        log.error("Failed to introspect token", e)
                        return null
                    }
                } finally {
                    recordIntrospectionHttpMetrics(
                        duration = Duration.ofNanos(System.nanoTime() - attemptStart),
                        identityProvider = identityProvider,
                        status = attemptStatusTag,
                        outcome = attemptOutcomeTag,
                    )
                }
            }
            return null
        } finally {
            val duration = Duration.ofNanos(System.nanoTime() - start)
            introspectionTimer.record(duration)
            if (duration >= SLOW_INTROSPECTION_THRESHOLD) {
                log.warn(
                    "Texas introspection was slow: durationMs={} identityProvider={} status={} outcome={} exception={}",
                    duration.toMillis(),
                    identityProvider,
                    finalStatusTag,
                    finalOutcomeTag,
                    finalExceptionTag,
                )
            }
        }
    }

    private fun recordIntrospectionHttpMetrics(
        duration: Duration,
        identityProvider: String,
        status: String,
        outcome: String,
    ) {
        val key = IntrospectionHttpMetricKey(
            identityProvider = identityProvider,
            status = status,
            outcome = outcome,
        )

        introspectionHttpTimers
            .computeIfAbsent(key) {
                Timer.builder("texas_introspection_http_duration_seconds")
                    .description("Duration of Texas introspection HTTP requests by provider, status, and outcome")
                    .tags(it.toTags())
                    .register(meterRegistry)
            }
            .record(duration)

        introspectionHttpCounters
            .computeIfAbsent(key) {
                Counter.builder("texas_introspection_http_requests_total")
                    .description("Number of Texas introspection HTTP requests by provider, status, and outcome")
                    .tags(it.toTags())
                    .register(meterRegistry)
            }
            .increment()
    }

    private fun IntrospectionHttpMetricKey.toTags(): Tags {
        return Tags.of(
            "identity_provider", identityProvider,
            "status", status,
            "outcome", outcome,
        )
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

    private fun Throwable.isTransientTransportFailure(): Boolean {
        return generateSequence(this) { it.cause }.any { cause ->
            cause is HttpRequestTimeoutException ||
                cause is ConnectTimeoutException ||
                cause is SocketTimeoutException ||
                cause is ConnectException ||
                cause.isConnectionResetLike()
        }
    }

    private fun Throwable.isConnectionResetLike(): Boolean {
        if (this !is SocketException) return false
        val message = message?.lowercase() ?: return false
        return message.contains("connection reset") ||
            message.contains("broken pipe") ||
            message.contains("socket closed")
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
