package no.nav.lumi.routes

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import no.nav.lumi.TestDatabase
import no.nav.lumi.createTestClient
import no.nav.lumi.testModule

class SurveyAuthoringRoutesTest : FunSpec({
    beforeSpec { TestDatabase.initialize() }
    beforeTest { TestDatabase.clearAllData() }

    test("authoring projects require authentication") {
        testApplication {
            application { testModule() }

            client.get("/api/v1/intern/authoring/projects?team=team-test").status shouldBe
                HttpStatusCode.Unauthorized
        }
    }

    test("create, list and reopen a team-scoped draft") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            val created = client.post("/api/v1/intern/authoring/projects?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody(createBody())
            }

            created.status shouldBe HttpStatusCode.Created
            val createdJson = Json.parseToJsonElement(created.bodyAsText()).jsonObject
            val projectId = createdJson.getValue("id").jsonPrimitive.content
            createdJson.getValue("team").jsonPrimitive.content shouldBe "team-test"
            createdJson.getValue("name").jsonPrimitive.content shouldBe "Første utkast"
            createdJson.getValue("draftVersion").jsonPrimitive.content shouldBe "1"

            val listed = client.get("/api/v1/intern/authoring/projects?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }
            listed.status shouldBe HttpStatusCode.OK
            Json.parseToJsonElement(listed.bodyAsText()).jsonArray.single()
                .jsonObject.getValue("id").jsonPrimitive.content shouldBe projectId

            val reopened = client.get(
                "/api/v1/intern/authoring/projects/$projectId?team=team-test",
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }
            reopened.status shouldBe HttpStatusCode.OK
            Json.parseToJsonElement(reopened.bodyAsText()).jsonObject
                .getValue("document").jsonObject
                .getValue("authoringSchemaVersion").jsonPrimitive.content shouldBe "1"
        }
    }

    test("draft update uses optimistic versioning") {
        testApplication {
            application { testModule() }
            val client = createTestClient()
            val created = client.post("/api/v1/intern/authoring/projects?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody(createBody())
            }
            val projectId = Json.parseToJsonElement(created.bodyAsText()).jsonObject
                .getValue("id").jsonPrimitive.content

            val firstUpdate = client.put(
                "/api/v1/intern/authoring/projects/$projectId/draft?team=team-test",
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody(updateBody(expectedVersion = 1, name = "Finjustert"))
            }
            firstUpdate.status shouldBe HttpStatusCode.OK
            Json.parseToJsonElement(firstUpdate.bodyAsText()).jsonObject
                .getValue("draftVersion").jsonPrimitive.content shouldBe "2"

            val staleUpdate = client.put(
                "/api/v1/intern/authoring/projects/$projectId/draft?team=team-test",
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody(updateBody(expectedVersion = 1, name = "Overskriver"))
            }
            staleUpdate.status shouldBe HttpStatusCode.Conflict
        }
    }

    test("projects cannot be read through another team scope") {
        testApplication {
            application { testModule() }
            val client = createTestClient()
            val created = client.post("/api/v1/intern/authoring/projects?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody(createBody())
            }
            val projectId = Json.parseToJsonElement(created.bodyAsText()).jsonObject
                .getValue("id").jsonPrimitive.content

            val response = client.get(
                "/api/v1/intern/authoring/projects/$projectId?team=flex",
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.NotFound
        }
    }

    test("drafts reject unsupported schema versions") {
        testApplication {
            application { testModule() }

            val response = createTestClient().post(
                "/api/v1/intern/authoring/projects?team=team-test",
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "name": "Ugyldig",
                      "surveyId": "ugyldig",
                      "document": {"authoringSchemaVersion": 2, "pages": []}
                    }
                    """.trimIndent(),
                )
            }

            response.status shouldBe HttpStatusCode.BadRequest
        }
    }

    test("drafts reject malformed schema versions without an internal error") {
        testApplication {
            application { testModule() }

            val response = createTestClient().post(
                "/api/v1/intern/authoring/projects?team=team-test",
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "name": "Ugyldig",
                      "surveyId": "ugyldig",
                      "document": {"authoringSchemaVersion": {}, "pages": []}
                    }
                    """.trimIndent(),
                )
            }

            response.status shouldBe HttpStatusCode.BadRequest
        }
    }

    test("draft requests reject oversized bodies before deserialization") {
        testApplication {
            application { testModule() }

            val response = createTestClient().post(
                "/api/v1/intern/authoring/projects?team=team-test",
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody("x".repeat(300_000))
            }

            response.status shouldBe HttpStatusCode.PayloadTooLarge
        }
    }
})

private fun createBody() = """
    {
      "name": " Første utkast ",
      "surveyId": " verksted-test ",
      "document": {
        "authoringSchemaVersion": 1,
        "type": "rating",
        "pages": [{
          "id": "opplevelse",
          "title": "Fortell om opplevelsen",
          "questions": [{
            "id": "rating",
            "type": "rating",
            "prompt": "Hvordan gikk det?",
            "required": true
          }]
        }]
      }
    }
""".trimIndent()

private fun updateBody(expectedVersion: Long, name: String) = """
    {
      "expectedVersion": $expectedVersion,
      "name": "$name",
      "surveyId": "verksted-test",
      "document": {
        "authoringSchemaVersion": 1,
        "type": "rating",
        "pages": [{
          "id": "opplevelse",
          "questions": [{
            "id": "rating",
            "type": "rating",
            "prompt": "Hvordan gikk det?"
          }]
        }]
      }
    }
""".trimIndent()
