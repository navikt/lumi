package no.nav.lumi.routes

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.put
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import no.nav.lumi.TestDatabase
import no.nav.lumi.createTestClient
import no.nav.lumi.insertTestFeedback
import no.nav.lumi.repository.SurveyMetadataRepository
import no.nav.lumi.testModule

class SurveyArchiveRoutesTest : FunSpec({
    beforeSpec {
        TestDatabase.initialize()
    }

    beforeTest {
        TestDatabase.clearAllData()
    }

    test("PUT archive requires authentication") {
        testApplication {
            application { testModule() }

            val response = client.put("/api/v1/intern/surveys/survey-1/archive?team=team-test")

            response.status shouldBe HttpStatusCode.Unauthorized
        }
    }

    test("PUT archive archives the survey with the authenticated user as archivedBy") {
        testApplication {
            application { testModule() }

            val response = createTestClient().put("/api/v1/intern/surveys/survey-1/archive?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK
            val body = Json.parseToJsonElement(response.bodyAsText()).jsonObject
            body["surveyId"]?.jsonPrimitive?.content shouldBe "survey-1"
            body["archivedAt"] shouldNotBe null
            body["archivedAt"] shouldNotBe JsonNull
            body["archivedBy"]?.jsonPrimitive?.content shouldBe "A123456"
        }
    }

    test("DELETE archive restores the survey and keeps the metadata row") {
        testApplication {
            application { testModule() }

            createTestClient().put("/api/v1/intern/surveys/survey-1/archive?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            val response = createTestClient().delete("/api/v1/intern/surveys/survey-1/archive?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.NoContent
            val states = SurveyMetadataRepository().findByTeam("team-test")
            states.size shouldBe 1
            states.single().archivedAt shouldBe null
        }
    }

    test("archive visibility updates cached statistics and can be explicitly included") {
        insertTestFeedback(id = "active", team = "team-test", surveyId = "survey-active")
        insertTestFeedback(id = "archived", team = "team-test", surveyId = "survey-archived")

        testApplication {
            application { testModule() }
            val authenticatedClient = createTestClient()

            suspend fun totalCount(includeArchived: Boolean = false): Int {
                val suffix = if (includeArchived) "&includeArchived=true" else ""
                val response = authenticatedClient.get(
                    "/api/v1/intern/stats/dashboard?team=team-test$suffix"
                ) {
                    header(HttpHeaders.Authorization, "Bearer test-token")
                }
                response.status shouldBe HttpStatusCode.OK
                return Json.parseToJsonElement(response.bodyAsText())
                    .jsonObject["totalCount"]?.jsonPrimitive?.content?.toInt() ?: -1
            }

            totalCount() shouldBe 2

            authenticatedClient.put(
                "/api/v1/intern/surveys/survey-archived/archive?team=team-test"
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }.status shouldBe HttpStatusCode.OK

            totalCount() shouldBe 1
            totalCount(includeArchived = true) shouldBe 2

            authenticatedClient.delete(
                "/api/v1/intern/surveys/survey-archived/archive?team=team-test"
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }.status shouldBe HttpStatusCode.NoContent

            totalCount() shouldBe 2
        }
    }

    test("DELETE archive on a never-archived survey is idempotent") {
        testApplication {
            application { testModule() }

            val response = createTestClient().delete("/api/v1/intern/surveys/never-archived/archive?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.NoContent
        }
    }

    test("PUT archive rejects a team the user is not authorized for") {
        testApplication {
            application { testModule() }

            val response = createTestClient().put("/api/v1/intern/surveys/survey-1/archive?team=team-unknown") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.Forbidden
            SurveyMetadataRepository().findByTeam("team-unknown") shouldBe emptyList()
        }
    }
})
