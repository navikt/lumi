package no.nav.lumi.routes

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.server.testing.testApplication
import no.nav.lumi.TestDatabase
import no.nav.lumi.createTestClient
import no.nav.lumi.domain.RedactFeedbackInput
import no.nav.lumi.domain.TextRedactionRange
import no.nav.lumi.domain.textRedactionHash
import no.nav.lumi.insertTestFeedback
import no.nav.lumi.repository.FeedbackRepository
import no.nav.lumi.testModule
import java.util.UUID

class FeedbackRedactionRoutesTest : FunSpec({
    beforeSpec { TestDatabase.initialize() }
    beforeTest { TestDatabase.clearAllData() }

    val text = "Bra skjema. Mvh Ola Nordmann"
    val input = RedactFeedbackInput(
        "feedback", textRedactionHash(text),
        listOf(TextRedactionRange(text.indexOf("Ola"), text.length)),
    )

    test("masking requires login, explicit team and membership") {
        testApplication {
            application { testModule() }
            val id = UUID.randomUUID().toString()
            insertTestFeedback(id = id, text = text)
            client.post("/api/v1/intern/feedback/$id/redact?team=team-test").status shouldBe HttpStatusCode.Unauthorized
            val authenticated = createTestClient()
            authenticated.post("/api/v1/intern/feedback/$id/redact") {
                bearerAuth("test-token"); contentType(ContentType.Application.Json); setBody(input)
            }.status shouldBe HttpStatusCode.BadRequest
            authenticated.post("/api/v1/intern/feedback/$id/redact?team=another-team") {
                bearerAuth("test-token"); contentType(ContentType.Application.Json); setBody(input)
            }.status shouldBe HttpStatusCode.Forbidden
        }
    }

    test("a response outside the selected authorized team is not found") {
        testApplication {
            application { testModule() }
            val id = UUID.randomUUID().toString()
            insertTestFeedback(id = id, team = "flex", text = text)
            createTestClient().post("/api/v1/intern/feedback/$id/redact?team=team-test") {
                bearerAuth("test-token"); contentType(ContentType.Application.Json); setBody(input)
            }.status shouldBe HttpStatusCode.NotFound
            FeedbackRepository().findRawById(id, "flex")!!.feedbackJson.contains("Ola Nordmann") shouldBe true
        }
    }

    test("an authorized mask succeeds once and a stale second request gets 409") {
        testApplication {
            application { testModule() }
            val id = UUID.randomUUID().toString()
            insertTestFeedback(id = id, text = text)
            val authenticated = createTestClient()
            suspend fun mask() = authenticated.post("/api/v1/intern/feedback/$id/redact?team=team-test") {
                bearerAuth("test-token"); contentType(ContentType.Application.Json); setBody(input)
            }
            mask().status shouldBe HttpStatusCode.NoContent
            mask().status shouldBe HttpStatusCode.Conflict
            FeedbackRepository().findRawById(id, "team-test")!!.feedbackJson.contains("Ola Nordmann") shouldBe false
        }
    }
})
