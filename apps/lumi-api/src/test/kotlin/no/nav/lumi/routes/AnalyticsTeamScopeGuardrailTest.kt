package no.nav.lumi.routes

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import no.nav.lumi.createTestClient
import no.nav.lumi.testModule

class AnalyticsTeamScopeGuardrailTest : FunSpec({
    val protectedEndpoints = listOf(
        "/api/v1/intern/feedback",
        "/api/v1/intern/feedback/tags",
        "/api/v1/intern/feedback/teams",
        "/api/v1/intern/surveys",
        "/api/v1/intern/surveys/demo/context-tags",
        "/api/v1/intern/surveys/demo/markers",
        "/api/v1/intern/stats/dashboard",
        "/api/v1/intern/stats/overview",
        "/api/v1/intern/stats/ratings",
        "/api/v1/intern/stats/timeline",
        "/api/v1/intern/stats/top-tasks",
        "/api/v1/intern/stats/blockers",
        "/api/v1/intern/stats/discovery",
        "/api/v1/intern/stats/task-priority",
        "/api/v1/intern/stats/survey-types",
        "/api/v1/intern/export",
    )

    test("all protected analytics endpoints reject unauthorized team with 403") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            protectedEndpoints.forEach { endpoint ->
                val response = client.get("$endpoint?team=unauthorized-team") {
                    header(HttpHeaders.Authorization, "Bearer test-token")
                }
                response.status shouldBe HttpStatusCode.Forbidden
            }
        }
    }

    test("representative analytics endpoints allow authorized team") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            listOf(
                "/api/v1/intern/feedback?team=team-test",
                "/api/v1/intern/stats/dashboard?team=team-test",
                "/api/v1/intern/export?team=team-test",
            ).forEach { endpoint ->
                val response = client.get(endpoint) {
                    header(HttpHeaders.Authorization, "Bearer test-token")
                }
                response.status shouldBe HttpStatusCode.OK
            }
        }
    }
})
