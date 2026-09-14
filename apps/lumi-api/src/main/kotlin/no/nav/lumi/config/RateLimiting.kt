package no.nav.lumi.config

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.plugins.ratelimit.*
import io.ktor.server.request.path
import io.ktor.server.routing.*
import io.ktor.util.*
import io.ktor.util.collections.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import no.nav.lumi.config.auth.AuthorizationAttributes
import no.nav.lumi.config.auth.CallerIdentityKey
import no.nav.lumi.config.auth.InternalSubmissionAuthenticatedKey
import no.nav.lumi.config.auth.UserRateLimitHashKey
import no.nav.lumi.config.auth.pseudonymizeIdentifier
import no.nav.lumi.config.exception.ApiErrorException
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
 * - Internal proxy submissions: PSK authentication runs before the named
 *   submission limit and sets [InternalSubmissionAuthenticatedKey]. The proxy
 *   remains keyed by its trusted socket peer because the forwarded caller
 *   identity is validated inside the handler.
 * - Analytics/export routes: `rateLimit` is nested inside `authenticate`, so
 *   [rateLimitKey] uses the validated `BrukerPrincipal` and a pseudonymized
 *   user identifier to separate dashboard users of the shared client.
 * - Rejected export authentication: Ktor does not execute an inner rate limiter
 *   when authentication rejects the call. [rateLimitRejectedExportAuthentication]
 *   therefore reserves a source-IP permit before auth. The permit is refunded
 *   only after client and team authorization have completed. Rejected requests
 *   keep the permit and receive 429 after 30 attempts per minute, even when
 *   every token value is different.
 * - Global guard: runs before route authentication, so it is keyed by the
 *   non-spoofable socket peer instead of caller-controlled forwarding headers.
 *   Internal health/metrics routes have zero request weight and can therefore
 *   never be blocked by exhausted traffic buckets.
 */

val SubmissionRateLimit = RateLimitName("submission")
val UserSubmissionRateLimit = RateLimitName("user-submission")
val AnalyticsRateLimit = RateLimitName("analytics")
val ExportRateLimit = RateLimitName("export")

private const val EXPORT_REQUESTS_PER_MINUTE = 30
private val RATE_LIMIT_REFILL_PERIOD = 1.minutes
private val defaultRateLimitSubmissionObservability = SubmissionObservability()

private val RejectedExportAuthenticationRateLimit = createRouteScopedPlugin(
    "RejectedExportAuthenticationRateLimit"
) {
    val buckets = ConcurrentMap<String, RejectedAuthenticationBucket>()
    val pluginApplication = application

    onCall { call ->
        val key = call.socketPeerAddress()
        val bucket = buckets.computeIfAbsent(key) {
            RejectedAuthenticationBucket(limit = EXPORT_REQUESTS_PER_MINUTE).also { created ->
                pluginApplication.launch {
                    delay(RATE_LIMIT_REFILL_PERIOD)
                    buckets.remove(key, created)
                }
            }
        }

        if (!bucket.reserve()) {
            throw ApiErrorException.TooManyRequestsException(
                "For mange avviste eksportkall. Prøv igjen senere."
            )
        }

        call.attributes.put(RejectedAuthenticationReservationKey, bucket)
    }
}

private val AuthorizedExportAuthenticationRefund = createRouteScopedPlugin(
    "AuthorizedExportAuthenticationRefund"
) {
    on(AuthenticationChecked) { call ->
        if (call.attributes.getOrNull(AuthorizationAttributes.AuthorizedPrincipalKey) != null) {
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

internal fun Route.refundRejectedExportAuthenticationAfterAuthorization() {
    install(AuthorizedExportAuthenticationRefund)
}

fun Application.configureRateLimiting(
    submissionObservability: SubmissionObservability = defaultRateLimitSubmissionObservability,
    globalRequestsPerMinute: Int = ServerEnv.current.rateLimit.globalRequestsPerSourcePerMinute,
    globalRequestKey: suspend (ApplicationCall) -> Any = { call -> call.socketPeerAddress() },
) {
    install(RateLimit) {
        register(SubmissionRateLimit) {
            rateLimiter(limit = 100, refillPeriod = RATE_LIMIT_REFILL_PERIOD)
            requestKey { call -> call.rateLimitKey() }
            modifyResponse { call, state ->
                recordRejectedSubmissionWhenExhausted(call, state, submissionObservability)
            }
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
            modifyResponse { call, state ->
                recordRejectedSubmissionWhenExhausted(call, state, submissionObservability)
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
            rateLimiter(limit = globalRequestsPerMinute, refillPeriod = RATE_LIMIT_REFILL_PERIOD)
            requestKey(globalRequestKey)
            requestWeight { call, _ ->
                if (call.request.path().startsWith("/internal/")) 0 else 1
            }
            // This guard runs before route authentication. Its 429 responses are
            // perimeter traffic, not authenticated submission outcomes.
        }
    }
}

private fun recordRejectedSubmissionWhenExhausted(
    call: ApplicationCall,
    state: RateLimiter.State,
    submissionObservability: SubmissionObservability
) {
    if (state !is RateLimiter.State.Exhausted) return

    val channel = when (call.request.path()) {
        "/api/tokenx/v1/feedback" -> SubmissionChannel.TOKENX
        "/api/azure/v1/feedback" -> SubmissionChannel.AZURE
        "/api/internal/v1/feedback" -> SubmissionChannel.INTERNAL_PROXY
        else -> return
    }
    // A matching path is caller-controlled. Require the channel's trusted auth
    // marker before treating a limiter response as a submission outcome.
    val isAuthenticated = when (channel) {
        SubmissionChannel.TOKENX,
        SubmissionChannel.AZURE -> call.attributes.getOrNull(CallerIdentityKey) != null

        SubmissionChannel.INTERNAL_PROXY ->
            call.attributes.getOrNull(InternalSubmissionAuthenticatedKey) != null
    }
    if (isAuthenticated) {
        submissionObservability.record(channel, SubmissionMetricOutcome.REJECTED)
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
        val clientKey = extractCallerIdentityFromPrincipal(principal)?.let { identity ->
            "${identity.team}:${identity.app}"
        } ?: principal.clientId?.takeIf { it.isNotBlank() }

        if (clientKey != null) {
            val userIdentifier = principal.navIdent?.takeIf { it.isNotBlank() }
                ?: principal.email?.takeIf { it.isNotBlank() }

            return if (userIdentifier != null) {
                "$clientKey:user:${pseudonymizeIdentifier(userIdentifier)}"
            } else {
                clientKey
            }
        }
    }

    return socketPeerAddress()
}

private fun io.ktor.server.application.ApplicationCall.socketPeerAddress(): String =
    request.local.remoteAddress
