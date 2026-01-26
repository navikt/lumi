package no.nav.lumi.routes

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.maps.shouldContainKey
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.testing.*
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import no.nav.lumi.TestDatabase
import no.nav.lumi.createTestClient
import no.nav.lumi.insertTestFeedback
import no.nav.lumi.testModule

class StatsRoutesTest : FunSpec({

    beforeSpec {
        TestDatabase.initialize()
    }

    beforeTest {
        TestDatabase.clearAllData()
    }

    test("GET /api/v1/intern/stats/dashboard requires authentication") {
        testApplication {
            application { testModule() }
            
            val response = client.get("/api/v1/intern/stats/dashboard")
            
            response.status shouldBe HttpStatusCode.Unauthorized
        }
    }

    test("GET /api/v1/intern/stats/dashboard returns statistics with auth") {
        testApplication {
            application { testModule() }
            
            // Insert test data
            insertTestFeedback(team = "flex", app = "spinnsyn", rating = 4)
            insertTestFeedback(team = "flex", app = "spinnsyn", rating = 5)
            
            val response = createTestClient().get("/api/v1/intern/stats/dashboard?team=flex") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }
            
            response.status shouldBe HttpStatusCode.OK
            val body = Json.parseToJsonElement(response.bodyAsText()).jsonObject
            body shouldContainKey "totalCount"
            body shouldContainKey "byRating"
        }
    }

    test("GET /api/v1/intern/stats/ratings returns rating distribution") {
        testApplication {
            application { testModule() }
            
            insertTestFeedback(team = "flex", rating = 3)
            insertTestFeedback(team = "flex", rating = 4)
            insertTestFeedback(team = "flex", rating = 5)
            
            val response = createTestClient().get("/api/v1/intern/stats/ratings?team=flex") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK
            val body = Json.parseToJsonElement(response.bodyAsText()).jsonObject
            body shouldContainKey "distribution"
            body shouldContainKey "average"
        }
    }

    test("GET /api/v1/intern/stats/timeline returns timeline data") {
        testApplication {
            application { testModule() }
            
            insertTestFeedback(team = "flex")
            
            val response = createTestClient().get("/api/v1/intern/stats/timeline?team=flex") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }
            
            response.status shouldBe HttpStatusCode.OK
            val body = Json.parseToJsonElement(response.bodyAsText()).jsonObject
            body shouldContainKey "data"
        }
    }
})
