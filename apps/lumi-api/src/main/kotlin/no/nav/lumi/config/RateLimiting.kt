package no.nav.lumi.config

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.plugins.ratelimit.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.util.*
import io.ktor.util.collections.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import no.nav.lumi.config.auth.CallerIdentityKey
import no.nav.lumi.config.auth.UserRateLimitHashKey
import kotlin.time.Duration.Companion.minutes

/**
 * Rate limiting to prevent abuse.
 *
 * Keying semantics differ per route family because Ktor 3.5.2 executes
 * authentication and rate limiting according to their route nesting.
 *
 * - Submission routes: a route-scoped auth plugin
 *   (Token/Azure SubmissionAuthPlugin) sets [CallerIdentityKey] and
 *   [UserRateLimitHashKey] in its `onCall`, which runs before the RateLimit
 *   `requestKey`. These routes are therefore keyed per caller-app and, when a
 *   user hash is present, per hashed user.
 * - Analytics/export routes: `rateLimit` is nested inside `authenticate`, so
 *   [rateLimitKey] uses the validated `BrukerPrincipal` and separates callers.
 * - Rejected export authentication: Ktor does not execute an inner rate limiter
 *   when authentication rejects the call. [rateLimitRejectedExportAuthentication]
 *   therefore reserves a source-IP permit before auth and refunds it when a
 *   principal is established. Invalid credentials keep the permit and receive
 *   429 after 30 attempts per minute, even when every token value is different.
 */

val SubmissionRateLimit = RateLimitName("submission")
val UserSubmissionRateLimit = RateLimitName("user-submission")
val AnalyticsRateLimit = RateLimitName("analytics")
val ExportRateLimit = RateLimitName("export")

private const val EXPORT_REQUESTS_PER_MINUTE = 30
private val RATE_LIMIT_REFILL_PERIOD = 1.minutes

private val RejectedExportAuthenticationRateLimit = createRouteScopedPlugin(
    "RejectedExportAuthenticationRateLimit"
) {
    val buckets = ConcurrentMap<String, RejectedAuthenticationBucket>()
    val pluginApplication = application

    onCall { call ->
        val key = call.sourceAddress()
        val bucket = buckets.computeIfAbsent(key) {
            RejectedAuthenticationBucket(limit = EXPORT_REQUESTS_PER_MINUTE).also { created ->
                pluginApplication.launch {
                    delay(RATE_LIMIT_REFILL_PERIOD)
                    buckets.remove(key, created)
                }
            }
        }

        if (!bucket.reserve()) {
            call.respond(HttpStatusCode.TooManyRequests)
            return@onCall
        }

        call.attributes.put(RejectedAuthenticationReservationKey, bucket)
    }

    on(AuthenticationChecked) { call ->
        if (call.principal<Any>() != null) {
            call.attributes.getOrNull(RejectedAuthenticationReservationKey)?.release()
        }
    }
}

private val RejectedAuthenticationReservationKey =
    AttributeKey<RejectedAuthenticationBucket>("RejectedAuthenticationReservation")

private class RejectedAuthenticationBucket(private val limit: Int) {
    private var remaining = limit

    @Synchronized
    fun reserve(): Boolean {
        if (remaining == 0) return false
        remaining--
        return true
    }

    @Synchronized
    fun release() {
        if (remaining < limit) remaining++
    }
}

private object RejectedExportAuthenticationRateLimitSelector : RouteSelector() {
    override suspend fun evaluate(context: RoutingResolveContext, segmentIndex: Int) =
        RouteSelectorEvaluation.Transparent
}

internal fun Route.rateLimitRejectedExportAuthentication(build: Route.() -> Unit): Route =
    createChild(RejectedExportAuthenticationRateLimitSelector).apply {
        install(RejectedExportAuthenticationRateLimit)
        build()
    }

fun Application.configureRateLimiting() {
    install(RateLimit) {
        register(SubmissionRateLimit) {
            rateLimiter(limit = 100, refillPeriod = RATE_LIMIT_REFILL_PERIOD)
            requestKey { call -> call.rateLimitKey() }
        }

        register(UserSubmissionRateLimit) {
            rateLimiter(limit = 15, refillPeriod = RATE_LIMIT_REFILL_PERIOD)
            requestKey { call ->
                call.attributes.getOrNull(UserRateLimitHashKey)
                    ?: call.rateLimitKey()
            }
            requestWeight { call, _ ->
                if (call.attributes.getOrNull(UserRateLimitHashKey) != null) 1 else 0
            }
        }
        
        register(AnalyticsRateLimit) {
            rateLimiter(limit = 300, refillPeriod = RATE_LIMIT_REFILL_PERIOD)
            requestKey { call -> call.rateLimitKey() }
        }

        register(ExportRateLimit) {
            rateLimiter(limit = EXPORT_REQUESTS_PER_MINUTE, refillPeriod = RATE_LIMIT_REFILL_PERIOD)
            requestKey { call -> call.rateLimitKey() }
        }
        
        global {
            rateLimiter(limit = 1000, refillPeriod = RATE_LIMIT_REFILL_PERIOD)
        }
    }
}

private fun io.ktor.server.application.ApplicationCall.rateLimitKey(): String {
    // Submission routes set CallerIdentityKey in their route-scoped auth plugin's
    // onCall, which runs before this requestKey is evaluated.
    attributes.getOrNull(CallerIdentityKey)?.let { identity ->
        return "${identity.team}:${identity.app}"
    }

    // Ktor 3.5.2 makes the principal available when authenticate wraps rateLimit.
    getBrukerPrincipal()?.let { principal ->
        extractCallerIdentityFromPrincipal(principal)?.let { identity ->
            return "${identity.team}:${identity.app}"
        }
        principal.clientId?.takeIf { it.isNotBlank() }?.let { return it }
    }

    return sourceAddress()
}

private fun io.ktor.server.application.ApplicationCall.sourceAddress(): String {
    val forwardedFor = if (ServerEnv.current.nais.isNais) {
        request.headers["X-Forwarded-For"]?.split(",")?.firstOrNull()?.trim()
    } else {
        null
    }

    return forwardedFor ?: request.local.remoteAddress
}
