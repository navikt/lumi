package no.nav.lumi.config

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.plugins.ratelimit.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.testing.*
import no.nav.lumi.config.auth.BrukerPrincipal
import no.nav.lumi.config.auth.CallerIdentity
import no.nav.lumi.config.auth.CallerIdentityKey
import no.nav.lumi.config.auth.ClientAuthorizationPlugin
import no.nav.lumi.config.auth.TeamAuthorizationPlugin
import no.nav.lumi.config.auth.UserRateLimitHashKey
import no.nav.lumi.config.exception.ApiErrorException

private val HeaderCallerIdentityPlugin = createRouteScopedPlugin("HeaderCallerIdentityPlugin") {
    onCall { call ->
        val caller = call.request.headers["X-Test-Caller"] ?: return@onCall
        val parts = caller.split(":", limit = 2)
        if (parts.size == 2) {
            call.attributes.put(
                CallerIdentityKey,
                CallerIdentity(
                    team = parts[0],
                    app = parts[1],
                    navIdent = null,
                    name = null,
                )
            )
        }
        val userHash = call.request.headers["X-Test-User-Hash"]
        if (userHash != null) {
            call.attributes.put(UserRateLimitHashKey, userHash)
        }
    }
}

/**
 * Mirrors the production submission auth plugins (Token/Azure SubmissionAuthPlugin):
 * a route-scoped plugin that rejects unauthenticated callers in `onCall`, i.e.
 * *before* the nested `rateLimit` block. Used to document that this rejection path
 * is NOT covered by the KTOR-9621 fix (which only affects nested Ktor `authenticate`).
 */
private val RejectingSubmissionAuthPlugin = createRouteScopedPlugin("RejectingSubmissionAuthPlugin") {
    onCall {
        throw ApiErrorException.UnauthorizedException("Authorization header required")
    }
}

class RateLimitingKeyingTest : FunSpec({
    test("submission rate limit uses separate buckets per caller identity") {
        testApplication {
            application {
                configureRateLimiting()
                routing {
                    route("/submission-test") {
                        install(HeaderCallerIdentityPlugin)
                        rateLimit(SubmissionRateLimit) {
                            get {
                                call.respond(HttpStatusCode.OK)
                            }
                        }
                    }
                }
            }

            repeat(100) {
                val response = client.get("/submission-test") {
                    header("X-Test-Caller", "team-esyfo:app-a")
                }
                response.status shouldBe HttpStatusCode.OK
            }

            val blockedResponse = client.get("/submission-test") {
                header("X-Test-Caller", "team-esyfo:app-a")
            }
            blockedResponse.status shouldBe HttpStatusCode.TooManyRequests

            val otherCallerResponse = client.get("/submission-test") {
                header("X-Test-Caller", "team-esyfo:app-b")
            }
            otherCallerResponse.status shouldBe HttpStatusCode.OK
        }
    }

    test("export rate limit uses separate buckets per authorized user in the same client") {
        testApplication {
            application {
                configureSerialization()
                configureStatusPages()
                configureRateLimiting()
                install(Authentication) {
                    bearer(AZURE_REALM) {
                        authenticate { credential ->
                            val navIdent = when (credential.token) {
                                "user-a" -> "Z111111"
                                "user-b" -> "Z222222"
                                else -> null
                            } ?: return@authenticate null

                            BrukerPrincipal(
                                navIdent = navIdent,
                                name = "Rate Limit Test",
                                email = "rate.limit.test@nav.no",
                                clientId = "dev-gcp:team-esyfo:lumi-dashboard",
                            )
                        }
                    }
                }

                routing {
                    rateLimitRejectedExportAuthentication {
                        authenticate(AZURE_REALM) {
                            install(ClientAuthorizationPlugin) {
                                allowedClientId = "dev-gcp:team-esyfo:lumi-dashboard"
                            }
                            install(TeamAuthorizationPlugin) {
                                naisTeamLookupProvider = { null }
                            }
                            refundRejectedExportAuthenticationAfterAuthorization()
                            rateLimit(ExportRateLimit) {
                                get("/export-test") {
                                    call.respond(HttpStatusCode.OK)
                                }
                            }
                        }
                    }
                }
            }

            repeat(30) {
                val response = client.get("/export-test") {
                    header(HttpHeaders.Authorization, "Bearer user-a")
                }
                response.status shouldBe HttpStatusCode.OK
            }

            val blockedResponse = client.get("/export-test") {
                header(HttpHeaders.Authorization, "Bearer user-a")
            }
            blockedResponse.status shouldBe HttpStatusCode.TooManyRequests

            // A different validated user of the same dashboard client has a separate bucket.
            val otherUserResponse = client.get("/export-test") {
                header(HttpHeaders.Authorization, "Bearer user-b")
            }
            otherUserResponse.status shouldBe HttpStatusCode.OK
        }
    }

    test("analytics rate limit uses separate buckets per validated user in the same client") {
        testApplication {
            application {
                configureRateLimiting()
                install(Authentication) {
                    bearer(AZURE_REALM) {
                        authenticate { credential ->
                            val navIdent = when (credential.token) {
                                "user-a" -> "Z111111"
                                "user-b" -> "Z222222"
                                else -> null
                            } ?: return@authenticate null

                            BrukerPrincipal(
                                navIdent = navIdent,
                                name = "Rate Limit Test",
                                email = "rate.limit.test@nav.no",
                                clientId = "dev-gcp:team-esyfo:lumi-dashboard",
                            )
                        }
                    }
                }

                routing {
                    authenticate(AZURE_REALM) {
                        install(ClientAuthorizationPlugin) {
                            allowedClientId = "dev-gcp:team-esyfo:lumi-dashboard"
                        }
                        install(TeamAuthorizationPlugin) {
                            naisTeamLookupProvider = { null }
                        }
                        rateLimit(AnalyticsRateLimit) {
                            get("/analytics-test") {
                                call.respond(HttpStatusCode.OK)
                            }
                        }
                    }
                }
            }

            repeat(300) {
                val response = client.get("/analytics-test") {
                    header(HttpHeaders.Authorization, "Bearer user-a")
                }
                response.status shouldBe HttpStatusCode.OK
            }

            val blockedResponse = client.get("/analytics-test") {
                header(HttpHeaders.Authorization, "Bearer user-a")
            }
            blockedResponse.status shouldBe HttpStatusCode.TooManyRequests

            val otherUserResponse = client.get("/analytics-test") {
                header(HttpHeaders.Authorization, "Bearer user-b")
            }
            otherUserResponse.status shouldBe HttpStatusCode.OK
        }
    }

    test("rejected export authentication remains source-IP limited under Ktor 3.5.2") {
        // Ktor 3.5.2 deliberately skips a rateLimit nested inside rejected
        // authentication. The outer failed-auth guard keeps invalid, rotating
        // tokens in one source-IP bucket without charging validated callers.
        testApplication {
            application {
                configureSerialization()
                configureStatusPages()
                configureRateLimiting()
                install(Authentication) {
                    bearer(AZURE_REALM) {
                        authenticate {
                            // Every token is rejected in this test.
                            null
                        }
                    }
                }

                routing {
                    rateLimitRejectedExportAuthentication {
                        authenticate(AZURE_REALM) {
                            rateLimit(ExportRateLimit) {
                                get("/export-reject-test") {
                                    call.respond(HttpStatusCode.OK)
                                }
                            }
                        }
                    }
                }
            }

            // First 30 rejected calls pass the (not-yet-exhausted) rate limit but fail
            // auth -> 401. Each still consumes a rate-limit token.
            repeat(30) {
                val response = client.get("/export-reject-test") {
                    header(HttpHeaders.Authorization, "Bearer invalid-$it")
                }
                response.status shouldBe HttpStatusCode.Unauthorized
            }

            // 31st rejected call is blocked by the rate limit instead of bypassing it.
            val blockedResponse = client.get("/export-reject-test") {
                header(HttpHeaders.Authorization, "Bearer invalid-final")
            }
            blockedResponse.status shouldBe HttpStatusCode.TooManyRequests
        }
    }

    test("client-unauthorized export calls remain source-IP limited") {
        testApplication {
            application {
                configureSerialization()
                configureStatusPages()
                configureRateLimiting()
                install(Authentication) {
                    bearer(AZURE_REALM) {
                        authenticate { credential ->
                            BrukerPrincipal(
                                navIdent = "Z${credential.token.hashCode()}",
                                name = "Unauthorized Rate Limit Test",
                                email = "unauthorized.rate.limit.test@nav.no",
                                clientId = "dev-gcp:unauthorized:rotating-client-${credential.token}",
                            )
                        }
                    }
                }

                routing {
                    rateLimitRejectedExportAuthentication {
                        authenticate(AZURE_REALM) {
                            install(ClientAuthorizationPlugin) {
                                allowedClientId = "dev-gcp:team-esyfo:lumi-dashboard"
                            }
                            install(TeamAuthorizationPlugin) {
                                naisTeamLookupProvider = { null }
                            }
                            refundRejectedExportAuthenticationAfterAuthorization()
                            rateLimit(ExportRateLimit) {
                                get("/export-unauthorized-test") {
                                    call.respond(HttpStatusCode.OK)
                                }
                            }
                        }
                    }
                }
            }

            repeat(30) {
                val response = client.get("/export-unauthorized-test") {
                    header(HttpHeaders.Authorization, "Bearer valid-but-unauthorized-$it")
                }
                response.status shouldBe HttpStatusCode.Forbidden
            }

            val blockedResponse = client.get("/export-unauthorized-test") {
                header(HttpHeaders.Authorization, "Bearer valid-but-unauthorized-final")
            }
            blockedResponse.status shouldBe HttpStatusCode.TooManyRequests
        }
    }

    test("team-unauthorized export calls remain source-IP limited") {
        testApplication {
            application {
                configureSerialization()
                configureStatusPages()
                configureRateLimiting()
                install(Authentication) {
                    bearer(AZURE_REALM) {
                        authenticate { credential ->
                            BrukerPrincipal(
                                navIdent = "Z${credential.token.hashCode()}",
                                name = "Team Unauthorized Rate Limit Test",
                                email = "team.unauthorized.rate.limit.test@nav.no",
                                clientId = "dev-gcp:team-esyfo:lumi-dashboard",
                            )
                        }
                    }
                }

                routing {
                    rateLimitRejectedExportAuthentication {
                        authenticate(AZURE_REALM) {
                            install(ClientAuthorizationPlugin) {
                                allowedClientId = "dev-gcp:team-esyfo:lumi-dashboard"
                            }
                            install(TeamAuthorizationPlugin) {
                                naisTeamLookupProvider = { null }
                            }
                            refundRejectedExportAuthenticationAfterAuthorization()
                            rateLimit(ExportRateLimit) {
                                get("/export-team-unauthorized-test") {
                                    call.respond(HttpStatusCode.OK)
                                }
                            }
                        }
                    }
                }
            }

            repeat(30) {
                val response = client.get("/export-team-unauthorized-test?team=not-authorized") {
                    header(HttpHeaders.Authorization, "Bearer valid-but-team-unauthorized-$it")
                }
                response.status shouldBe HttpStatusCode.Forbidden
            }

            val blockedResponse = client.get("/export-team-unauthorized-test?team=not-authorized") {
                header(HttpHeaders.Authorization, "Bearer valid-but-team-unauthorized-final")
            }
            blockedResponse.status shouldBe HttpStatusCode.TooManyRequests
        }
    }

    test("submission auth plugin that rejects before nested rateLimit is not covered by KTOR-9621") {
        // The submission auth plugins reject in a route-scoped `onCall` that runs
        // before the nested `rateLimit`. KTOR-9621 only fixes nested Ktor
        // `authenticate`, so these rejections are NOT rate-limited: the auth error
        // is returned and no rate-limit token is consumed. This test documents that
        // actual behavior; the DoS surface for unauthenticated submission spam is
        // instead bounded by the global rate limit.
        testApplication {
            application {
                configureSerialization()
                configureStatusPages()
                configureRateLimiting()
                routing {
                    route("/submission-reject-test") {
                        install(RejectingSubmissionAuthPlugin)
                        rateLimit(SubmissionRateLimit) {
                            get {
                                call.respond(HttpStatusCode.OK)
                            }
                        }
                    }
                }
            }

            // The route-scoped auth plugin throws before the nested rateLimit ever runs,
            // so far more than the submission limit (100/min) can be rejected without a
            // single 429: these rejections are NOT counted by SubmissionRateLimit.
            val statuses = (1..150).map { client.get("/submission-reject-test").status }
            statuses.all { it == HttpStatusCode.Unauthorized } shouldBe true
        }
    }

    test("user submission rate limit uses separate buckets per user within same app") {
        testApplication {
            application {
                configureRateLimiting()
                routing {
                    route("/user-rate-test") {
                        install(HeaderCallerIdentityPlugin)
                        rateLimit(SubmissionRateLimit) {
                            rateLimit(UserSubmissionRateLimit) {
                                get {
                                    call.respond(HttpStatusCode.OK)
                                }
                            }
                        }
                    }
                }
            }

            // User A: exhaust 15 requests
            repeat(15) {
                val response = client.get("/user-rate-test") {
                    header("X-Test-Caller", "team-esyfo:app-a")
                    header("X-Test-User-Hash", "user:team-esyfo:app-a:hash-user-a")
                }
                response.status shouldBe HttpStatusCode.OK
            }

            // User A: 16th request should be blocked
            val blockedResponse = client.get("/user-rate-test") {
                header("X-Test-Caller", "team-esyfo:app-a")
                header("X-Test-User-Hash", "user:team-esyfo:app-a:hash-user-a")
            }
            blockedResponse.status shouldBe HttpStatusCode.TooManyRequests

            // User B (same app): should still be allowed
            val userBResponse = client.get("/user-rate-test") {
                header("X-Test-Caller", "team-esyfo:app-a")
                header("X-Test-User-Hash", "user:team-esyfo:app-a:hash-user-b")
            }
            userBResponse.status shouldBe HttpStatusCode.OK
        }
    }

    test("user rate limit does not throttle M2M requests without user hash") {
        testApplication {
            application {
                configureRateLimiting()
                routing {
                    route("/user-rate-m2m-test") {
                        install(HeaderCallerIdentityPlugin)
                        rateLimit(SubmissionRateLimit) {
                            rateLimit(UserSubmissionRateLimit) {
                                get {
                                    call.respond(HttpStatusCode.OK)
                                }
                            }
                        }
                    }
                }
            }

            // Without X-Test-User-Hash (M2M), requests should not be throttled
            // by UserSubmissionRateLimit (15/min). They are only limited by
            // the outer SubmissionRateLimit (100/min).
            repeat(20) {
                val response = client.get("/user-rate-m2m-test") {
                    header("X-Test-Caller", "team-esyfo:app-a")
                }
                response.status shouldBe HttpStatusCode.OK
            }
        }
    }

    test("app-level submission rate limit caps total requests across users") {
        testApplication {
            application {
                configureRateLimiting()
                routing {
                    route("/app-level-cap-test") {
                        install(HeaderCallerIdentityPlugin)
                        rateLimit(SubmissionRateLimit) {
                            rateLimit(UserSubmissionRateLimit) {
                                get {
                                    call.respond(HttpStatusCode.OK)
                                }
                            }
                        }
                    }
                }
            }

            // Send 100 requests from different users within the same app.
            // Each user stays well under 15/min, but the app total hits 100.
            repeat(100) { i ->
                val response = client.get("/app-level-cap-test") {
                    header("X-Test-Caller", "team-esyfo:app-a")
                    header("X-Test-User-Hash", "user:team-esyfo:app-a:hash-user-$i")
                }
                response.status shouldBe HttpStatusCode.OK
            }

            // 101st request should be blocked by the outer SubmissionRateLimit
            val blockedResponse = client.get("/app-level-cap-test") {
                header("X-Test-Caller", "team-esyfo:app-a")
                header("X-Test-User-Hash", "user:team-esyfo:app-a:hash-user-new")
            }
            blockedResponse.status shouldBe HttpStatusCode.TooManyRequests
        }
    }
})
