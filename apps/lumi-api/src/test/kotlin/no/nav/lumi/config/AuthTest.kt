package no.nav.lumi.config

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.ktor.client.engine.mock.respondError
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.install
import io.ktor.server.auth.Authentication
import io.ktor.server.auth.authenticate
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import no.nav.lumi.CapturedLogs
import no.nav.lumi.config.auth.TexasClient
import no.nav.lumi.config.auth.mockTexasClient
import no.nav.lumi.config.auth.texasJson
import java.net.SocketTimeoutException

class AuthTest : FunSpec({
    fun callDashboardRouteWith(texasClient: TexasClient): Pair<HttpStatusCode, String> {
        var result: Pair<HttpStatusCode, String>? = null
        testApplication {
            application {
                configureSerialization()
                configureStatusPages()
                install(Authentication) {
                    texasBearer(texasClient)
                }
                routing {
                    authenticate(AZURE_REALM) {
                        get("/api/v1/intern/test") {
                            call.respondText(call.getBrukerPrincipal()?.navIdent.orEmpty())
                        }
                    }
                }
            }

            val response = client.get("/api/v1/intern/test") {
                bearerAuth("token-from-dashboard")
            }
            result = response.status to response.bodyAsText()
        }
        return result!!
    }

    test("accepts an active token") {
        val (status, body) = callDashboardRouteWith(
            mockTexasClient {
                texasJson("""{"active": true, "NAVident": "Z123456", "azp_name": "dev-gcp:team-esyfo:lumi-dashboard"}""")
            },
        )

        status shouldBe HttpStatusCode.OK
        body shouldBe "Z123456"
    }

    test("returns 401 when Texas rejects the token") {
        val (status, _) = callDashboardRouteWith(mockTexasClient { texasJson("""{"active": false}""") })

        status shouldBe HttpStatusCode.Unauthorized
    }

    test("returns 503 when Texas answers with a 5xx status") {
        val (status, body) = callDashboardRouteWith(
            mockTexasClient { respondError(HttpStatusCode.ServiceUnavailable) },
        )

        status shouldBe HttpStatusCode.ServiceUnavailable
        body shouldContain "Kunne ikke kontrollere innloggingen"
    }

    test("returns 503 when Texas gives an answer that cannot be read, without logging it") {
        val loggers = listOf("TexasClient", "StatusPages").map(::CapturedLogs)
        try {
            val (status, body) = callDashboardRouteWith(
                mockTexasClient { texasJson("""{"active":"ja","NAVident":"Z123456","email":"kari@nav.no"}""") },
            )

            status shouldBe HttpStatusCode.ServiceUnavailable
            body shouldNotContain "Z123456"
            val messages = loggers.flatMap { it.messages }
            messages.isNotEmpty() shouldBe true
            messages.forEach { message ->
                message shouldNotContain "Z123456"
                message shouldNotContain "kari@nav.no"
            }
            loggers.flatMap { it.throwableTexts }.forEach { text ->
                text shouldNotContain "Z123456"
                text shouldNotContain "kari@nav.no"
            }
        } finally {
            loggers.forEach { it.close() }
        }
    }

    test("returns 503 when Texas times out") {
        val (status, _) = callDashboardRouteWith(
            mockTexasClient { throw SocketTimeoutException("read timed out") },
        )

        status shouldBe HttpStatusCode.ServiceUnavailable
    }
})
