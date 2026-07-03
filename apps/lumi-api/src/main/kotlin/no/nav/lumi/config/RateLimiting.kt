package no.nav.lumi.config

import io.ktor.server.application.*
import io.ktor.server.plugins.ratelimit.*
import no.nav.lumi.config.auth.CallerIdentityKey
import no.nav.lumi.config.auth.UserRateLimitHashKey
import kotlin.time.Duration.Companion.minutes

/**
 * Rate limiting to prevent abuse.
 *
 * Keying semantics differ per route family because of *when* identity becomes
 * available relative to the RateLimit plugin.
 *
 * On Ktor 3.5.1 the RateLimit `requestKey` is evaluated before a Ktor
 * `BrukerPrincipal` from the standard `authenticate` flow is available. In this
 * version rejected nested `authenticate` calls also count toward the limit
 * (KTOR-9621) instead of bypassing it.
 *
 * - Submission routes: a route-scoped auth plugin
 *   (Token/Azure SubmissionAuthPlugin) sets [CallerIdentityKey] and
 *   [UserRateLimitHashKey] in its `onCall`, which runs before the RateLimit
 *   `requestKey`. These routes are therefore keyed per caller-app and, when a
 *   user hash is present, per hashed user.
 * - Analytics/export routes: authentication happens in the standard Ktor
 *   `authenticate` flow, so no principal is available when `requestKey` runs.
 *   These routes fall back to the caller's source IP (X-Forwarded-For on NAIS,
 *   otherwise the remote address). They are NOT keyed per validated user.
 *
 * The `getBrukerPrincipal()` branch in [rateLimitKey] is a defensive fallback
 * that only fires if a principal is already present when `requestKey` runs; it
 * does not fire for the normal Ktor `authenticate` flow.
 */

val SubmissionRateLimit = RateLimitName("submission")
val UserSubmissionRateLimit = RateLimitName("user-submission")
val AnalyticsRateLimit = RateLimitName("analytics")
val ExportRateLimit = RateLimitName("export")

fun Application.configureRateLimiting() {
    install(RateLimit) {
        register(SubmissionRateLimit) {
            rateLimiter(limit = 100, refillPeriod = 1.minutes)
            requestKey { call -> call.rateLimitKey() }
        }

        register(UserSubmissionRateLimit) {
            rateLimiter(limit = 15, refillPeriod = 1.minutes)
            requestKey { call ->
                call.attributes.getOrNull(UserRateLimitHashKey)
                    ?: call.rateLimitKey()
            }
            requestWeight { call, _ ->
                if (call.attributes.getOrNull(UserRateLimitHashKey) != null) 1 else 0
            }
        }
        
        register(AnalyticsRateLimit) {
            rateLimiter(limit = 300, refillPeriod = 1.minutes)
            requestKey { call -> call.rateLimitKey() }
        }

        register(ExportRateLimit) {
            rateLimiter(limit = 30, refillPeriod = 1.minutes)
            requestKey { call -> call.rateLimitKey() }
        }
        
        global {
            rateLimiter(limit = 1000, refillPeriod = 1.minutes)
        }
    }
}

private fun io.ktor.server.application.ApplicationCall.rateLimitKey(): String {
    // Submission routes set CallerIdentityKey in their route-scoped auth plugin's
    // onCall, which runs before this requestKey is evaluated.
    attributes.getOrNull(CallerIdentityKey)?.let { identity ->
        return "${identity.team}:${identity.app}"
    }

    // Defensive fallback: only fires if a BrukerPrincipal is already present when
    // this requestKey runs. For the normal Ktor authenticate flow the principal is
    // not yet set here, so analytics/export fall through to IP below.
    getBrukerPrincipal()?.let { principal ->
        extractCallerIdentityFromPrincipal(principal)?.let { identity ->
            return "${identity.team}:${identity.app}"
        }
        principal.clientId?.takeIf { it.isNotBlank() }?.let { return it }
    }

    val env = ServerEnv.current
    val forwardedFor = if (env.nais.isNais) {
        request.headers["X-Forwarded-For"]?.split(",")?.firstOrNull()?.trim()
    } else {
        null
    }

    return forwardedFor ?: request.local.remoteAddress
}
