package no.nav.lumi.config

import io.ktor.server.application.*
import io.ktor.server.plugins.ratelimit.*
import no.nav.lumi.config.auth.CallerIdentityKey
import no.nav.lumi.config.auth.UserRateLimitHashKey
import kotlin.time.Duration.Companion.minutes

/**
 * Rate limiting to prevent abuse.
 * 
 * Uses validated caller identity when available.
 * Falls back to clientId from validated principal, then to IP address.
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
    // Submission routes set CallerIdentityKey after successful token introspection.
    attributes.getOrNull(CallerIdentityKey)?.let { identity ->
        return "${identity.team}:${identity.app}"
    }

    // Analytics routes authenticate with BrukerPrincipal from Texas introspection.
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
