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
import no.nav.lumi.config.auth.BrukerPrincipal
import no.nav.lumi.createTestClient
import no.nav.lumi.insertTestFeedback
import no.nav.lumi.integrations.valkey.InMemoryStringCache
import no.nav.lumi.repository.SurveyMetadataRepository
import no.nav.lumi.testModule
import java.time.Duration

class FilterRoutesTest : FunSpec({
    beforeSpec {
        TestDatabase.initialize()
    }

    test("bootstrapCacheKey uses navIdent as user identity") {
        val principal = BrukerPrincipal(
            navIdent = "A123456",
            name = null,
            email = "test@nav.no",
            clientId = null,
        )
        bootstrapCacheKey("Team-Test", principal) shouldBe "team=team-test&user=a123456"
    }

    test("bootstrapCacheKey falls back to email when navIdent is missing") {
        val principal = BrukerPrincipal(
            navIdent = null,
            name = null,
            email = "Test.User@nav.no",
            clientId = null,
        )
        bootstrapCacheKey("team-test", principal) shouldBe "team=team-test&user=test.user@nav.no"
    }

    test("bootstrapCacheKey falls back to email when navIdent is blank") {
        val principal = BrukerPrincipal(
            navIdent = "  ",
            name = null,
            email = "Test.User@nav.no",
            clientId = null,
        )
        bootstrapCacheKey("team-test", principal) shouldBe "team=team-test&user=test.user@nav.no"
    }

    test("bootstrapCacheKey returns null when navIdent and email are blank") {
        val principal = BrukerPrincipal(
            navIdent = "",
            name = "Uten Identitet",
            email = "  ",
            clientId = "dev-gcp:team:app",
        )
        bootstrapCacheKey("team-test", principal) shouldBe null
    }

    test("bootstrapCacheKey returns null when the principal has no stable user identity") {
        val principal = BrukerPrincipal(
            navIdent = null,
            name = "Uten Identitet",
            email = null,
            clientId = "dev-gcp:team:app",
        )
        bootstrapCacheKey("team-test", principal) shouldBe null
    }

    test("versioned bootstrap cache ignores a stale write after invalidation") {
        val cache = VersionedBootstrapCache(InMemoryStringCache())
        val principal = BrukerPrincipal(
            navIdent = "A123456",
            name = null,
            email = "test@nav.no",
            clientId = null,
        )
        val staleLookup = cache.lookup("team-test", principal)

        cache.invalidate("team-test")
        cache.set(staleLookup, "stale", Duration.ofMinutes(5))

        cache.lookup("team-test", principal).value shouldBe null
    }

    beforeTest {
        TestDatabase.clearAllData()
    }

    test("bootstrap exposes archive state per survey in surveyMeta") {
        testApplication {
            application { testModule() }
            insertTestFeedback(surveyId = "survey-active")
            insertTestFeedback(surveyId = "survey-archived")
            SurveyMetadataRepository().archive(
                team = "team-test",
                surveyId = "survey-archived",
                archivedBy = "A123456",
            )

            val response = createTestClient().get("/api/v1/intern/filters/bootstrap?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK
            val body = Json.parseToJsonElement(response.bodyAsText()).jsonObject
            val surveyMeta = body["surveyMeta"]?.jsonObject
            surveyMeta shouldNotBe null

            val archivedEntry = surveyMeta!!["survey-archived"]?.jsonObject
            archivedEntry shouldNotBe null
            archivedEntry!!["archivedAt"] shouldNotBe JsonNull

            // A survey without metadata must not be reported as archived
            val activeEntry = surveyMeta["survey-active"]
            (activeEntry == null || activeEntry.jsonObject["archivedAt"] == JsonNull) shouldBe true
        }
    }

    test("archiving a survey is visible in bootstrap without waiting for cache TTL") {
        testApplication {
            application { testModule() }
            insertTestFeedback(surveyId = "survey-1")

            // Populate the bootstrap cache
            val first = createTestClient().get("/api/v1/intern/filters/bootstrap?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }
            first.status shouldBe HttpStatusCode.OK
            Json.parseToJsonElement(first.bodyAsText())
                .jsonObject["surveyMeta"]?.jsonObject?.get("survey-1") shouldBe null

            createTestClient().put("/api/v1/intern/surveys/survey-1/archive?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }.status shouldBe HttpStatusCode.OK

            val second = createTestClient().get("/api/v1/intern/filters/bootstrap?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }
            second.status shouldBe HttpStatusCode.OK
            val entry = Json.parseToJsonElement(second.bodyAsText())
                .jsonObject["surveyMeta"]?.jsonObject?.get("survey-1")?.jsonObject
            entry shouldNotBe null
            entry!!["archivedAt"] shouldNotBe JsonNull
            entry["archivedAt"]?.jsonPrimitive?.content shouldNotBe null
        }
    }

    test("restoring a survey is visible in bootstrap without waiting for cache TTL") {
        testApplication {
            application { testModule() }
            insertTestFeedback(surveyId = "survey-1")

            createTestClient().put("/api/v1/intern/surveys/survey-1/archive?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }.status shouldBe HttpStatusCode.OK

            // Populate the cache with the archived state
            createTestClient().get("/api/v1/intern/filters/bootstrap?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }.status shouldBe HttpStatusCode.OK

            createTestClient().delete("/api/v1/intern/surveys/survey-1/archive?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }.status shouldBe HttpStatusCode.NoContent

            val response = createTestClient().get("/api/v1/intern/filters/bootstrap?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }
            val entry = Json.parseToJsonElement(response.bodyAsText())
                .jsonObject["surveyMeta"]?.jsonObject?.get("survey-1")?.jsonObject
            entry shouldNotBe null
            entry!!["archivedAt"] shouldBe JsonNull
        }
    }
})
