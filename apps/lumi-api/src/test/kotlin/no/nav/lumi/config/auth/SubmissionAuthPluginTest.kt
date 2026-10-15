package no.nav.lumi.config.auth

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.ktor.client.engine.mock.respondError
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.post
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.install
import io.ktor.server.response.respondText
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import no.nav.lumi.config.configureSerialization
import no.nav.lumi.config.configureStatusPages
import java.net.ConnectException

class SubmissionAuthPluginTest : FunSpec({
    fun submitWith(texasClient: TexasClient): Pair<HttpStatusCode, String> {
        var result: Pair<HttpStatusCode, String>? = null
        testApplication {
            application {
                configureSerialization()
                configureStatusPages()
                routing {
                    route("/api/tokenx") {
                        install(TokenXSubmissionAuthPlugin) {
                            localMockIdentityEnabled = false
                            texasClientProvider = { texasClient }
                        }
                        post("/v1/feedback") {
                            call.respondText(call.getCallerIdentity().app)
                        }
                    }
                }
            }

            val response = client.post("/api/tokenx/v1/feedback") {
                bearerAuth("token-from-app")
            }
            result = response.status to response.bodyAsText()
        }
        return result!!
    }

    test("accepts an active token") {
        val (status, body) = submitWith(
            mockTexasClient {
                texasJson("""{"active": true, "client_id": "dev-gcp:team-esyfo:ditt-sykefravaer", "sub": "user"}""")
            },
        )

        status shouldBe HttpStatusCode.OK
        body shouldBe "ditt-sykefravaer"
    }

    test("returns 401 when Texas rejects the token") {
        val (status, _) = submitWith(mockTexasClient { texasJson("""{"active": false}""") })

        status shouldBe HttpStatusCode.Unauthorized
    }

    test("returns 401 when Texas answers with a 4xx status") {
        val (status, _) = submitWith(mockTexasClient { respondError(HttpStatusCode.BadRequest) })

        status shouldBe HttpStatusCode.Unauthorized
    }

    test("returns 503 when Texas answers with a 5xx status") {
        val meterRegistry = SimpleMeterRegistry()
        val (status, body) = submitWith(
            mockTexasClient(meterRegistry) { respondError(HttpStatusCode.InternalServerError) },
        )

        status shouldBe HttpStatusCode.ServiceUnavailable
        body shouldContain "Retry the request"
        meterRegistry.get("texas_introspection_errors_total").counter().count() shouldBe 1.0
    }

    test("returns 503 when Texas gives an answer that cannot be read") {
        val (status, _) = submitWith(mockTexasClient { texasJson("""{"active":"ja"}""") })

        status shouldBe HttpStatusCode.ServiceUnavailable
    }

    test("returns 503 when Texas cannot be reached") {
        val meterRegistry = SimpleMeterRegistry()
        val (status, _) = submitWith(
            mockTexasClient(meterRegistry) { throw ConnectException("Connection refused") },
        )

        status shouldBe HttpStatusCode.ServiceUnavailable
        meterRegistry.get("texas_introspection_errors_total").counter().count() shouldBe 1.0
    }
})
