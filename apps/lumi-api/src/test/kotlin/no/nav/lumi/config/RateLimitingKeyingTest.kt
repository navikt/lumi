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

    test("export rate limit uses validated principal clientId as key") {
        testApplication {
            application {
                configureRateLimiting()
                install(Authentication) {
                    bearer(AZURE_REALM) {
                        authenticate { credential ->
                            val clientId = when (credential.token) {
                                "client-a" -> "dev-gcp:team-esyfo:app-a"
                                "client-b" -> "dev-gcp:team-esyfo:app-b"
                                else -> null
                            } ?: return@authenticate null

                            BrukerPrincipal(
                                navIdent = "Z123456",
                                name = "Rate Limit Test",
                                email = "rate.limit.test@nav.no",
                                clientId = clientId,
                            )
                        }
                    }
                }

                routing {
                    authenticate(AZURE_REALM) {
                        rateLimit(ExportRateLimit) {
                            get("/export-test") {
                                call.respond(HttpStatusCode.OK)
                            }
                        }
                    }
                }
            }

            repeat(30) {
                val response = client.get("/export-test") {
                    header(HttpHeaders.Authorization, "Bearer client-a")
                }
                response.status shouldBe HttpStatusCode.OK
            }

            val blockedResponse = client.get("/export-test") {
                header(HttpHeaders.Authorization, "Bearer client-a")
            }
            blockedResponse.status shouldBe HttpStatusCode.TooManyRequests

            val otherClientResponse = client.get("/export-test") {
                header(HttpHeaders.Authorization, "Bearer client-b")
            }
            otherClientResponse.status shouldBe HttpStatusCode.OK
        }
    }
})
