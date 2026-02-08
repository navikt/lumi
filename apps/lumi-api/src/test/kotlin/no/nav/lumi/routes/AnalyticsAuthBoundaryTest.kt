package no.nav.lumi.routes

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.testing.*
import no.nav.lumi.config.AZURE_REALM
import no.nav.lumi.config.auth.BrukerPrincipal
import no.nav.lumi.config.auth.ClientAuthorizationPlugin
import no.nav.lumi.config.auth.NaisTeamLookup
import no.nav.lumi.config.auth.TeamAuthorizationPlugin
import no.nav.lumi.config.configureSerialization
import no.nav.lumi.config.configureStatusPages
import no.nav.lumi.integrations.nais.NaisApiResult

private class FixedTeamLookup(
    private val teams: Set<String>,
) : NaisTeamLookup {
    override suspend fun getTeamSlugsForUserResult(email: String): NaisApiResult<Set<String>> =
        NaisApiResult.Success(teams)

    override suspend fun getTeamSlugsForViewerResult(): NaisApiResult<Set<String>> =
        NaisApiResult.Success(teams)
}

private fun Application.boundaryTestModule(
    allowedClientId: String,
    dashboardPath: String,
) {
    configureSerialization()
    configureStatusPages()

    install(Authentication) {
        bearer(AZURE_REALM) {
            authenticate { credential ->
                when (credential.token) {
                    "ok-client" -> BrukerPrincipal(
                        navIdent = "Z123456",
                        name = "Valid User",
                        email = "valid.user@nav.no",
                        clientId = allowedClientId,
                    )
                    "wrong-client" -> BrukerPrincipal(
                        navIdent = "Z654321",
                        name = "Wrong Client",
                        email = "wrong.client@nav.no",
                        clientId = "dev-gcp:team-other:other-dashboard",
                    )
                    else -> null
                }
            }
        }
    }

    routing {
        authenticate(AZURE_REALM) {
            install(ClientAuthorizationPlugin) {
                this.allowedClientId = allowedClientId
            }
            install(TeamAuthorizationPlugin) {
                naisTeamLookupProvider = {
                    FixedTeamLookup(teams = setOf("team-esyfo"))
                }
            }

            get(dashboardPath) {
                call.respond(HttpStatusCode.OK)
            }
        }
    }
}

class AnalyticsAuthBoundaryTest : FunSpec({
    val allowedClientId = "dev-gcp:team-esyfo:lumi-dashboard"
    val dashboardPath = "/api/v1/intern/stats/dashboard"

    test("returns 401 without authorization header") {
        testApplication {
            application {
                boundaryTestModule(allowedClientId, dashboardPath)
            }

            val response = client.get(dashboardPath)
            response.status shouldBe HttpStatusCode.Unauthorized
        }
    }

    test("returns 403 with wrong client id") {
        testApplication {
            application {
                boundaryTestModule(allowedClientId, dashboardPath)
            }

            val response = client.get(dashboardPath) {
                header(HttpHeaders.Authorization, "Bearer wrong-client")
            }

            response.status shouldBe HttpStatusCode.Forbidden
        }
    }

    test("returns 403 when requesting unauthorized team") {
        testApplication {
            application {
                boundaryTestModule(allowedClientId, dashboardPath)
            }

            val response = client.get("$dashboardPath?team=team-other") {
                header(HttpHeaders.Authorization, "Bearer ok-client")
            }

            response.status shouldBe HttpStatusCode.Forbidden
        }
    }

    test("returns 200 with valid auth and team access") {
        testApplication {
            application {
                boundaryTestModule(allowedClientId, dashboardPath)
            }

            val response = client.get("$dashboardPath?team=team-esyfo") {
                header(HttpHeaders.Authorization, "Bearer ok-client")
            }

            response.status shouldBe HttpStatusCode.OK
        }
    }

})
