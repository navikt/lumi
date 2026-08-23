package no.nav.lumi.config

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.ktor.client.request.get
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.response.respond
import io.ktor.server.routing.get
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication

class GlobalRateLimitingTest : FunSpec({
    test("an exhausted global bucket never blocks internal health routes") {
        testApplication {
            application {
                configureRateLimiting(globalRequestsPerMinute = 2)
                routing {
                    get("/load") {
                        call.respond(HttpStatusCode.OK)
                    }
                    get("/internal/isAlive") {
                        call.respond(HttpStatusCode.OK)
                    }
                    get("/internal/isReady") {
                        call.respond(HttpStatusCode.OK)
                    }
                    get("/internal/prometheus") {
                        call.respond(HttpStatusCode.OK)
                    }
                }
            }

            repeat(2) {
                client.get("/load").status shouldBe HttpStatusCode.OK
            }
            client.get("/load").status shouldBe HttpStatusCode.TooManyRequests

            listOf(
                "/internal/isAlive",
                "/internal/isReady",
                "/internal/prometheus",
            ).forEach { path ->
                client.get(path).status shouldBe HttpStatusCode.OK
            }
        }
    }

    test("forwarded addresses cannot rotate the global bucket") {
        testApplication {
            application {
                configureRateLimiting(globalRequestsPerMinute = 2)
                routing {
                    get("/load") {
                        call.respond(HttpStatusCode.OK)
                    }
                }
            }

            listOf("192.0.2.10", "192.0.2.11").forEach { forwardedAddress ->
                client.get("/load") {
                    headers.append("X-Forwarded-For", forwardedAddress)
                }.status shouldBe HttpStatusCode.OK
            }
            client.get("/load") {
                headers.append("X-Forwarded-For", "192.0.2.12")
            }.status shouldBe HttpStatusCode.TooManyRequests
        }
    }

    test("global traffic buckets are isolated per trusted source key") {
        testApplication {
            application {
                configureRateLimiting(
                    globalRequestsPerMinute = 2,
                    globalRequestKey = { call ->
                        call.request.headers["X-Test-Source"] ?: "unknown"
                    },
                )
                routing {
                    get("/load") {
                        call.respond(HttpStatusCode.OK)
                    }
                }
            }

            repeat(2) {
                client.get("/load") {
                    headers.append("X-Test-Source", "source-a")
                }.status shouldBe HttpStatusCode.OK
            }
            client.get("/load") {
                headers.append("X-Test-Source", "source-a")
            }.status shouldBe HttpStatusCode.TooManyRequests

            client.get("/load") {
                headers.append("X-Test-Source", "source-b")
            }.status shouldBe HttpStatusCode.OK
        }
    }

})
