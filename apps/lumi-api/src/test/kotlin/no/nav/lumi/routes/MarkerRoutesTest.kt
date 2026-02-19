package no.nav.lumi.routes

import io.kotest.core.spec.style.FunSpec
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.shouldBe
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
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import no.nav.lumi.TestDatabase
import no.nav.lumi.createTestClient
import no.nav.lumi.insertTestRatingMarker
import no.nav.lumi.testModule
import java.sql.SQLException
import java.time.LocalDate

class MarkerRoutesTest : FunSpec({
    beforeSpec {
        TestDatabase.initialize()
    }

    beforeTest {
        TestDatabase.clearAllData()
    }

    test("GET /api/v1/intern/surveys/{surveyId}/markers requires authentication") {
        testApplication {
            application { testModule() }

            val response = client.get("/api/v1/intern/surveys/survey-1/markers?team=team-test")

            response.status shouldBe HttpStatusCode.Unauthorized
        }
    }

    test("POST + GET markers creates and lists marker for survey") {
        testApplication {
            application { testModule() }
            val surveyId = "survey-markers-create"

            val createResponse = createTestClient().post("/api/v1/intern/surveys/$surveyId/markers?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "markerDate": "2026-02-01",
                      "label": "Ny løsning",
                      "description": "Rullet ut ny versjon",
                      "color": "#1C64F2"
                    }
                    """.trimIndent()
                )
            }

            createResponse.status shouldBe HttpStatusCode.Created
            val created = Json.parseToJsonElement(createResponse.bodyAsText()).jsonObject
            created["surveyId"]?.jsonPrimitive?.content shouldBe surveyId
            created["label"]?.jsonPrimitive?.content shouldBe "Ny løsning"

            val listResponse = createTestClient().get("/api/v1/intern/surveys/$surveyId/markers?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            listResponse.status shouldBe HttpStatusCode.OK
            val list = Json.parseToJsonElement(listResponse.bodyAsText()).jsonArray
            list.size shouldBe 1
            list.first().jsonObject["label"]?.jsonPrimitive?.content shouldBe "Ny løsning"
        }
    }

    test("GET markers supports fromDate/toDate filtering") {
        testApplication {
            application { testModule() }
            val surveyId = "survey-markers-filter"

            insertTestRatingMarker(
                team = "team-test",
                surveyId = surveyId,
                markerDate = LocalDate.parse("2026-02-01"),
                label = "Utenfor",
            )
            insertTestRatingMarker(
                team = "team-test",
                surveyId = surveyId,
                markerDate = LocalDate.parse("2026-02-10"),
                label = "Innenfor",
            )

            val response = createTestClient().get(
                "/api/v1/intern/surveys/$surveyId/markers?team=team-test&fromDate=2026-02-05&toDate=2026-02-12"
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK
            val list = Json.parseToJsonElement(response.bodyAsText()).jsonArray
            list.size shouldBe 1
            list.first().jsonObject["label"]?.jsonPrimitive?.content shouldBe "Innenfor"
        }
    }

    test("PUT marker updates marker for survey and team") {
        testApplication {
            application { testModule() }
            val surveyId = "survey-markers-update"
            val markerId = insertTestRatingMarker(
                team = "team-test",
                surveyId = surveyId,
                markerDate = LocalDate.parse("2026-02-01"),
                label = "Før",
                color = "#1C64F2",
            )

            val updateResponse = createTestClient().put("/api/v1/intern/surveys/$surveyId/markers/$markerId?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "label": "Etter",
                      "color": "#00AAFF"
                    }
                    """.trimIndent()
                )
            }

            updateResponse.status shouldBe HttpStatusCode.OK
            val updated = Json.parseToJsonElement(updateResponse.bodyAsText()).jsonObject
            updated["label"]?.jsonPrimitive?.content shouldBe "Etter"
            updated["color"]?.jsonPrimitive?.content shouldBe "#00AAFF"
        }
    }

    test("PUT marker can clear description and color") {
        testApplication {
            application { testModule() }
            val surveyId = "survey-markers-clear-fields"
            val markerId = insertTestRatingMarker(
                team = "team-test",
                surveyId = surveyId,
                markerDate = LocalDate.parse("2026-02-01"),
                label = "Med felt",
                description = "Skal fjernes",
                color = "#1C64F2",
            )

            val updateResponse = createTestClient().put("/api/v1/intern/surveys/$surveyId/markers/$markerId?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "clearDescription": true,
                      "clearColor": true
                    }
                    """.trimIndent()
                )
            }

            updateResponse.status shouldBe HttpStatusCode.OK
            val updated = Json.parseToJsonElement(updateResponse.bodyAsText()).jsonObject
            updated["description"] shouldBe JsonNull
            updated["color"] shouldBe JsonNull
        }
    }

    test("PUT marker rejects conflicting clear and value fields") {
        testApplication {
            application { testModule() }
            val surveyId = "survey-markers-clear-conflict"
            val markerId = insertTestRatingMarker(
                team = "team-test",
                surveyId = surveyId,
                markerDate = LocalDate.parse("2026-02-01"),
                label = "Konflikt",
            )

            val updateResponse = createTestClient().put("/api/v1/intern/surveys/$surveyId/markers/$markerId?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "color": "#00AAFF",
                      "clearColor": true
                    }
                    """.trimIndent()
                )
            }

            updateResponse.status shouldBe HttpStatusCode.BadRequest
        }
    }

    test("DELETE marker removes marker for survey and team") {
        testApplication {
            application { testModule() }
            val surveyId = "survey-markers-delete"
            val markerId = insertTestRatingMarker(
                team = "team-test",
                surveyId = surveyId,
                markerDate = LocalDate.parse("2026-02-01"),
                label = "Slettes",
            )

            val deleteResponse = createTestClient().delete("/api/v1/intern/surveys/$surveyId/markers/$markerId?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            deleteResponse.status shouldBe HttpStatusCode.NoContent

            val listResponse = createTestClient().get("/api/v1/intern/surveys/$surveyId/markers?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }
            listResponse.status shouldBe HttpStatusCode.OK
            Json.parseToJsonElement(listResponse.bodyAsText()).jsonArray.size shouldBe 0
        }
    }

    test("POST markers enforces max 50 markers per team and survey") {
        testApplication {
            application { testModule() }
            val surveyId = "survey-markers-limit"

            repeat(50) { i ->
                insertTestRatingMarker(
                    team = "team-test",
                    surveyId = surveyId,
                    markerDate = LocalDate.parse("2026-01-01").plusDays(i.toLong()),
                    label = "Marker $i",
                )
            }

            val response = createTestClient().post("/api/v1/intern/surveys/$surveyId/markers?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "markerDate": "2026-03-01",
                      "label": "Skal feile",
                      "color": "#1C64F2"
                    }
                    """.trimIndent()
                )
            }

            response.status shouldBe HttpStatusCode.BadRequest
        }
    }

    test("DB trigger enforces hard max 50 markers per team and survey") {
        val surveyId = "survey-markers-db-limit"

        repeat(50) { i ->
            insertTestRatingMarker(
                team = "team-test",
                surveyId = surveyId,
                markerDate = LocalDate.parse("2026-01-01").plusDays(i.toLong()),
                label = "Marker $i",
            )
        }

        shouldThrow<SQLException> {
            insertTestRatingMarker(
                team = "team-test",
                surveyId = surveyId,
                markerDate = LocalDate.parse("2026-03-01"),
                label = "Skal feile i DB",
            )
        }
    }

    test("DELETE marker is team-scoped and does not remove another team's marker") {
        testApplication {
            application { testModule() }
            val surveyId = "survey-markers-team-scope"
            val markerId = insertTestRatingMarker(
                team = "another-team",
                surveyId = surveyId,
                markerDate = LocalDate.parse("2026-02-01"),
                label = "Skal ikke slettes",
            )

            val deleteResponse = createTestClient().delete("/api/v1/intern/surveys/$surveyId/markers/$markerId?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            deleteResponse.status shouldBe HttpStatusCode.NotFound

            val remainingRows = TestDatabase.dataSource.connection.use { conn ->
                conn.prepareStatement(
                    """
                    SELECT COUNT(*)
                    FROM rating_marker
                    WHERE id = ?::uuid
                    """.trimIndent()
                ).use { stmt ->
                    stmt.setString(1, markerId)
                    stmt.executeQuery().use { rs ->
                        rs.next()
                        rs.getInt(1)
                    }
                }
            }
            remainingRows shouldBe 1
        }
    }

    test("POST marker validates date format") {
        testApplication {
            application { testModule() }
            val surveyId = "survey-markers-date-validation"

            val response = createTestClient().post("/api/v1/intern/surveys/$surveyId/markers?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "markerDate": "01-02-2026",
                      "label": "Ugyldig dato",
                      "color": "#1C64F2"
                    }
                    """.trimIndent()
                )
            }

            response.status shouldBe HttpStatusCode.BadRequest
            val body = Json.parseToJsonElement(response.bodyAsText()).jsonObject
            body["status"]?.jsonPrimitive?.int shouldBe HttpStatusCode.BadRequest.value
        }
    }
})
