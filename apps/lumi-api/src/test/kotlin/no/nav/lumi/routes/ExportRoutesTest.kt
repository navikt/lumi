package no.nav.lumi.routes

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.testing.*
import no.nav.lumi.TestDatabase
import no.nav.lumi.createTestClient
import no.nav.lumi.insertTestFeedback
import no.nav.lumi.testModule

class ExportRoutesTest : FunSpec({

    beforeSpec {
        TestDatabase.initialize()
    }

    beforeTest {
        TestDatabase.clearAllData()
    }

    test("GET /api/v1/intern/export requires authentication") {
        testApplication {
            application { testModule() }
            
            val response = client.get("/api/v1/intern/export")
            
            response.status shouldBe HttpStatusCode.Unauthorized
        }
    }

    test("GET /api/v1/intern/export returns CSV by default") {
        testApplication {
            application { testModule() }
            
            insertTestFeedback(team = "flex", app = "spinnsyn", text = "Great app!")
            
            val response = createTestClient().get("/api/v1/intern/export?team=flex") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }
            
            response.status shouldBe HttpStatusCode.OK
            response.contentType()?.match(ContentType.Text.CSV) shouldBe true
            response.bodyAsText() shouldContain "id,submittedAt"
        }
    }

    test("GET /api/v1/intern/export?format=JSON returns JSON") {
        testApplication {
            application { testModule() }
            
            insertTestFeedback(team = "flex", text = "Nice feature")
            
            val response = createTestClient().get("/api/v1/intern/export?team=flex&format=JSON") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }
            
            response.status shouldBe HttpStatusCode.OK
            response.contentType()?.match(ContentType.Application.Json) shouldBe true
        }
    }

    test("GET /api/v1/intern/export?format=EXCEL returns Excel file") {
        testApplication {
            application { testModule() }
            
            insertTestFeedback(team = "flex")
            
            val response = createTestClient().get("/api/v1/intern/export?team=flex&format=EXCEL") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }
            
            response.status shouldBe HttpStatusCode.OK
            response.headers[HttpHeaders.ContentType] shouldContain "application/vnd.openxmlformats-officedocument"
        }
    }

    test("GET /api/v1/intern/export supports ratingFieldId/ratingValue filter") {
        testApplication {
            application { testModule() }

            insertTestFeedback(team = "flex", rating = 2, text = "rating-two")
            insertTestFeedback(team = "flex", rating = 4, text = "rating-four")

            val response = createTestClient().get(
                "/api/v1/intern/export?team=flex&ratingFieldId=svar&ratingValue=2"
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK
            val body = response.bodyAsText()
            body shouldContain "rating-two"
            body.contains("rating-four") shouldBe false
        }
    }

    test("GET /api/v1/intern/export rejects invalid date format") {
        testApplication {
            application { testModule() }

            val response = createTestClient().get("/api/v1/intern/export?team=flex&fromDate=bad-date") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.BadRequest
        }
    }

    test("GET /api/v1/intern/export rejects invalid segment format") {
        testApplication {
            application { testModule() }

            val response = createTestClient().get("/api/v1/intern/export?team=flex&segment=invalid-segment") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.BadRequest
        }
    }

    test("GET /api/v1/intern/export rejects too long query") {
        testApplication {
            application { testModule() }

            val longQuery = "x".repeat(201)
            val response = createTestClient().get("/api/v1/intern/export?team=flex&query=$longQuery") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.BadRequest
        }
    }
})
