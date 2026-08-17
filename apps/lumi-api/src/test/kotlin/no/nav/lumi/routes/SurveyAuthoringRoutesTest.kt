package no.nav.lumi.routes

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.ktor.client.request.delete
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

    test("deletes a project with its revisions, scoped to the team") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            val created = client.post("/api/v1/intern/authoring/projects?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody(createBody())
            }
            val projectId = Json.parseToJsonElement(created.bodyAsText())
                .jsonObject.getValue("id").jsonPrimitive.content

            val revision = client.post(
                "/api/v1/intern/authoring/projects/$projectId/revisions?team=team-test",
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody("""{ "expectedDraftVersion": 1 }""")
            }
            revision.status shouldBe HttpStatusCode.Created
            val revisionId = Json.parseToJsonElement(revision.bodyAsText())
                .jsonObject.getValue("id").jsonPrimitive.content

            // Another authorized team's scope must not be able to delete it.
            client.delete("/api/v1/intern/authoring/projects/$projectId?team=flex") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }.status shouldBe HttpStatusCode.NotFound

            client.delete("/api/v1/intern/authoring/projects/$projectId?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }.status shouldBe HttpStatusCode.NoContent

            client.get("/api/v1/intern/authoring/projects/$projectId?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }.status shouldBe HttpStatusCode.NotFound

            // The frozen revision follows the project (DB cascade).
            client.get("/api/v1/intern/authoring/revisions/$revisionId?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }.status shouldBe HttpStatusCode.NotFound

            // Deleting again is a plain 404, not an error.
            client.delete("/api/v1/intern/authoring/projects/$projectId?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }.status shouldBe HttpStatusCode.NotFound
        }
    }

    test("saving into a deleted project reports not found, never conflict") {
        // The delete can land between any existence check and the update —
        // the classification must be decided atomically with the update.
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

            client.delete("/api/v1/intern/authoring/projects/$projectId?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }.status shouldBe HttpStatusCode.NoContent

            val save = client.put(
                "/api/v1/intern/authoring/projects/$projectId/draft?team=team-test",
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody(updateBody(expectedVersion = 1, name = "Etter sletting"))
            }
            save.status shouldBe HttpStatusCode.NotFound
            save.bodyAsText() shouldContain "Survey project not found"
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

    test("creates immutable revisions and exposes the previous snapshot") {
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

            val firstRevision = client.post(
                "/api/v1/intern/authoring/projects/$projectId/revisions?team=team-test",
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody("""{"expectedDraftVersion":1}""")
            }
            firstRevision.status shouldBe HttpStatusCode.Created
            val firstJson = Json.parseToJsonElement(firstRevision.bodyAsText()).jsonObject
            val firstRevisionId = firstJson.getValue("id").jsonPrimitive.content
            val firstDefinitionHash = firstJson.getValue("definitionHash").jsonPrimitive.content
            firstJson.getValue("revisionNumber").jsonPrimitive.content shouldBe "1"
            firstJson.getValue("documentHash").jsonPrimitive.content.length shouldBe 64

            val updated = client.put(
                "/api/v1/intern/authoring/projects/$projectId/draft?team=team-test",
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody(updateBody(expectedVersion = 1, name = "Ny tekst"))
            }
            updated.status shouldBe HttpStatusCode.OK

            val secondRevision = client.post(
                "/api/v1/intern/authoring/projects/$projectId/revisions?team=team-test",
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody("""{"expectedDraftVersion":2}""")
            }
            secondRevision.status shouldBe HttpStatusCode.Created
            val secondJson = Json.parseToJsonElement(secondRevision.bodyAsText()).jsonObject
            val secondRevisionId = secondJson.getValue("id").jsonPrimitive.content
            secondJson.getValue("revisionNumber").jsonPrimitive.content shouldBe "2"
            secondJson.getValue("definitionHash").jsonPrimitive.content shouldBe firstDefinitionHash

            val listed = client.get(
                "/api/v1/intern/authoring/projects/$projectId/revisions?team=team-test",
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }
            listed.status shouldBe HttpStatusCode.OK
            val listedJson = Json.parseToJsonElement(listed.bodyAsText()).jsonArray
            listedJson.size shouldBe 2
            listedJson.first().jsonObject
                .getValue("id").jsonPrimitive.content shouldBe secondRevisionId

            val detail = client.get(
                "/api/v1/intern/authoring/revisions/$secondRevisionId?team=team-test",
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }
            detail.status shouldBe HttpStatusCode.OK
            val detailJson = Json.parseToJsonElement(detail.bodyAsText()).jsonObject
            detailJson.getValue("previousRevision").jsonObject
                .getValue("id").jsonPrimitive.content shouldBe firstRevisionId
            detailJson.getValue("revision").jsonObject
                .getValue("name").jsonPrimitive.content shouldBe "Ny tekst"

            val firstAfterDraftChange = client.get(
                "/api/v1/intern/authoring/revisions/$firstRevisionId?team=team-test",
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }
            firstAfterDraftChange.status shouldBe HttpStatusCode.OK
            Json.parseToJsonElement(firstAfterDraftChange.bodyAsText()).jsonObject
                .getValue("revision").jsonObject
                .getValue("name").jsonPrimitive.content shouldBe "Første utkast"
        }
    }

    test("revision creation rejects invalid drafts and stale versions") {
        testApplication {
            application { testModule() }
            val client = createTestClient()
            val created = client.post("/api/v1/intern/authoring/projects?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "name": "Påbegynt",
                      "surveyId": "invalid-draft",
                      "document": {"authoringSchemaVersion": 1, "pages": []}
                    }
                    """.trimIndent(),
                )
            }
            val projectId = Json.parseToJsonElement(created.bodyAsText()).jsonObject
                .getValue("id").jsonPrimitive.content

            val invalid = client.post(
                "/api/v1/intern/authoring/projects/$projectId/revisions?team=team-test",
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody("""{"expectedDraftVersion":1}""")
            }
            invalid.status shouldBe HttpStatusCode.BadRequest

            val stale = client.post(
                "/api/v1/intern/authoring/projects/$projectId/revisions?team=team-test",
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody("""{"expectedDraftVersion":2}""")
            }
            stale.status shouldBe HttpStatusCode.Conflict
        }
    }

    test("structural changes require a new survey id before a new revision") {
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
            client.post("/api/v1/intern/authoring/projects/$projectId/revisions?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody("""{"expectedDraftVersion":1}""")
            }.status shouldBe HttpStatusCode.Created

            client.put("/api/v1/intern/authoring/projects/$projectId/draft?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody(structuralUpdateBody(expectedVersion = 1, surveyId = "verksted-test"))
            }.status shouldBe HttpStatusCode.OK

            client.post("/api/v1/intern/authoring/projects/$projectId/revisions?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody("""{"expectedDraftVersion":2}""")
            }.status shouldBe HttpStatusCode.Conflict

            client.put("/api/v1/intern/authoring/projects/$projectId/draft?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody(structuralUpdateBody(expectedVersion = 2, surveyId = "verksted-test-v2"))
            }.status shouldBe HttpStatusCode.OK

            client.post("/api/v1/intern/authoring/projects/$projectId/revisions?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody("""{"expectedDraftVersion":3}""")
            }.status shouldBe HttpStatusCode.Created
        }
    }

    test("blank prompts may be drafted but never frozen into a revision") {
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

            client.put("/api/v1/intern/authoring/projects/$projectId/draft?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody(blankPromptUpdateBody(expectedVersion = 1))
            }.status shouldBe HttpStatusCode.OK

            val response = client.post(
                "/api/v1/intern/authoring/projects/$projectId/revisions?team=team-test",
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody("""{"expectedDraftVersion":2}""")
            }
            response.status shouldBe HttpStatusCode.BadRequest
            response.bodyAsText() shouldContain "needs a prompt before it can be shared"
        }
    }

    test("revision links are team scoped") {
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
            val revision = client.post(
                "/api/v1/intern/authoring/projects/$projectId/revisions?team=team-test",
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody("""{"expectedDraftVersion":1}""")
            }
            val revisionId = Json.parseToJsonElement(revision.bodyAsText()).jsonObject
                .getValue("id").jsonPrimitive.content

            client.get("/api/v1/intern/authoring/revisions/$revisionId?team=flex") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }.status shouldBe HttpStatusCode.NotFound
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

private fun blankPromptUpdateBody(expectedVersion: Long) = """
    {
      "expectedVersion": $expectedVersion,
      "name": "Uferdig utkast",
      "surveyId": "verksted-test",
      "document": {
        "authoringSchemaVersion": 1,
        "type": "rating",
        "pages": [{
          "id": "opplevelse",
          "questions": [{
            "id": "rating",
            "type": "rating",
            "prompt": "   ",
            "required": true
          }]
        }]
      }
    }
""".trimIndent()

private fun structuralUpdateBody(expectedVersion: Long, surveyId: String) = """
    {
      "expectedVersion": $expectedVersion,
      "name": "Endret struktur",
      "surveyId": "$surveyId",
      "document": {
        "authoringSchemaVersion": 1,
        "type": "rating",
        "pages": [{
          "id": "opplevelse",
          "questions": [{
            "id": "rating",
            "type": "text",
            "prompt": "Beskriv opplevelsen"
          }]
        }]
      }
    }
""".trimIndent()
