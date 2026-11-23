package no.nav.lumi.config.auth

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.ktor.client.engine.mock.respondError
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.install
import io.ktor.server.response.respondText
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import no.nav.lumi.config.SubmissionObservability
import io.mockk.coEvery
import io.mockk.mockk
import no.nav.lumi.domain.SaveResult
import no.nav.lumi.routes.submissionRoutes
import no.nav.lumi.service.SubmissionOutcome
import no.nav.lumi.service.SubmissionService
import no.nav.lumi.config.configureRateLimiting
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

    fun submitToAzure(
        texasClient: TexasClient,
        requests: Int = 1,
        meterRegistry: MeterRegistry = SimpleMeterRegistry(),
    ): List<Pair<HttpStatusCode, String>> {
        val results = mutableListOf<Pair<HttpStatusCode, String>>()
        val service = mockk<SubmissionService>()
        coEvery { service.submit(any(), "teamsykefravr", "syfomodiaperson", any(), any(), any()) } returns
            SubmissionOutcome(SaveResult.Created("test-receipt"))
        val observability = SubmissionObservability(meterRegistry)
        testApplication {
            application {
                configureSerialization()
                configureStatusPages()
                configureRateLimiting(submissionObservability = observability)
                routing {
                    submissionRoutes(submissionService = service, submissionObservability = observability) {
                        localMockIdentityEnabled = false
                        texasClientProvider = { texasClient }
                    }
                }
            }

            repeat(requests) {
                val response = client.post("/api/azure/v1/feedback") {
                    setBody("""
                        {
                          "schemaVersion": 1, "surveyId": "auth-test", "surveyType": "rating",
                          "submittedAt": "2026-11-19T10:00:00Z",
                          "answers": [{
                            "fieldId": "rating", "fieldType": "RATING", "question": {"label": "Test"},
                            "value": {"type": "rating", "rating": 4, "ratingVariant": "emoji", "ratingScale": 5}
                          }]
                        }
                    """.trimIndent())
                    bearerAuth("token-from-app")
                }
                results += response.status to response.bodyAsText()
            }
        }
        return results
    }

    fun onBehalfOfToken(roles: String? = null) = """
        {
          "active": true,
          "azp_name": "dev-gcp:teamsykefravr:syfomodiaperson",
          "sub": "user-object-id",
          "scp": "defaultaccess",
          "NAVident": "Z999999"
          ${roles?.let { ""","roles": $it""" } ?: ""}
        }
    """.trimIndent()

    fun appToken(roles: String?, identityType: String = "\"app\"") = """
        {
          "active": true,
          "azp_name": "dev-gcp:teamsykefravr:syfomodiaperson",
          "sub": "app-object-id",
          "oid": "app-object-id",
          "idtyp": $identityType
          ${roles?.let { ""","roles": $it""" } ?: ""}
        }
    """.trimIndent()

    test("limits an Entra ID on-behalf-of token per user") {
        val results = submitToAzure(mockTexasClient { texasJson(onBehalfOfToken()) }, requests = 16)

        results.take(15).map { it.first }.distinct() shouldBe listOf(HttpStatusCode.Created)
        results.first().second shouldContain "test-receipt"
        results.last().first shouldBe HttpStatusCode.TooManyRequests
    }

    test("does not apply the per-user limit to an Entra ID app token") {
        val results = submitToAzure(
            mockTexasClient { texasJson(appToken(roles = """["access_as_application"]""")) },
            requests = 16,
        )

        results.map { it.first }.distinct() shouldBe listOf(HttpStatusCode.Created)
        results.first().second shouldContain "test-receipt"
    }

    test("limits an Entra ID app token per calling application") {
        val meterRegistry = SimpleMeterRegistry()
        val results = submitToAzure(
            mockTexasClient { texasJson(appToken(roles = """["access_as_application"]""")) },
            requests = 101,
            meterRegistry = meterRegistry,
        )

        results.take(100).map { it.first }.distinct() shouldBe listOf(HttpStatusCode.Created)
        results.last().first shouldBe HttpStatusCode.TooManyRequests
        meterRegistry.get(SubmissionObservability.METRIC_NAME)
            .tags("channel", "azure", "outcome", "rejected")
            .counter().count() shouldBe 1.0
    }

    test("returns 403 for an Entra ID app token without roles") {
        val meterRegistry = SimpleMeterRegistry()
        val (status, body) = submitToAzure(
            mockTexasClient { texasJson(appToken(roles = null)) },
            meterRegistry = meterRegistry,
        ).single()

        status shouldBe HttpStatusCode.Forbidden
        body shouldContain "access_as_application"
        meterRegistry.get(SubmissionObservability.METRIC_NAME)
            .tags("channel", "azure", "outcome", "rejected")
            .counter().count() shouldBe 1.0
    }

    test("returns 403 for an Entra ID app token with only other roles") {
        val (status, _) = submitToAzure(
            mockTexasClient { texasJson(appToken(roles = """["custom-role"]""")) },
        ).single()

        status shouldBe HttpStatusCode.Forbidden
    }

    test("returns 403 for an Entra ID app token with an empty role list") {
        val (status, _) = submitToAzure(mockTexasClient { texasJson(appToken(roles = "[]")) }).single()

        status shouldBe HttpStatusCode.Forbidden
    }

    test("accepts an Entra ID app token that has the default role among other roles") {
        val (status, _) = submitToAzure(
            mockTexasClient { texasJson(appToken(roles = """["custom-role", "access_as_application"]""")) },
        ).single()

        status shouldBe HttpStatusCode.Created
    }

    test("ignores Entra-specific claim shapes on TokenX submissions") {
        val (status, _) = submitWith(mockTexasClient {
            texasJson("""{"active":true,"client_id":"dev-gcp:team:app","sub":"user","idtyp":{},"roles":"custom"}""")
        })
        status shouldBe HttpStatusCode.OK
    }

    test("ignores roles on an on-behalf-of token") {
        val claims = onBehalfOfToken(roles = "\"custom\"")
        submitToAzure(mockTexasClient { texasJson(claims) }).single().first shouldBe HttpStatusCode.Created
    }

    test("denies an app token with malformed roles") {
        val (status, _) = submitToAzure(mockTexasClient {
            texasJson(appToken(roles = "\"access_as_application\""))
        }).single()
        status shouldBe HttpStatusCode.Forbidden
    }

    test("denies an Entra submission with a malformed identity type") {
        val claims = appToken(null, identityType = """["app"]""")
        submitToAzure(mockTexasClient { texasJson(claims) }).single().first shouldBe HttpStatusCode.Forbidden
    }
})
