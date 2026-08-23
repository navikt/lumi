package no.nav.lumi.routes

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.mockk.coEvery
import io.mockk.mockk
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
import no.nav.lumi.repository.FeedbackRepository
import no.nav.lumi.repository.SurveyMetadataRepository
import no.nav.lumi.testModule
import java.time.Duration
import java.time.OffsetDateTime

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
        bootstrapCacheKey("Team-Test", principal) shouldBe "team=team-test&user=a123456&responseVersion=2"
    }

    test("bootstrapCacheKey falls back to email when navIdent is missing") {
        val principal = BrukerPrincipal(
            navIdent = null,
            name = null,
            email = "Test.User@nav.no",
            clientId = null,
        )
        bootstrapCacheKey("team-test", principal) shouldBe "team=team-test&user=test.user@nav.no&responseVersion=2"
    }

    test("bootstrapCacheKey falls back to email when navIdent is blank") {
        val principal = BrukerPrincipal(
            navIdent = "  ",
            name = null,
            email = "Test.User@nav.no",
            clientId = null,
        )
        bootstrapCacheKey("team-test", principal) shouldBe "team=team-test&user=test.user@nav.no&responseVersion=2"
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

    test("explicit refresh bypasses cached bootstrap without evicting the shared value") {
        val bootstrapCache = InMemoryStringCache()

        testApplication {
            application { testModule(bootstrapCache = bootstrapCache) }
            val client = createTestClient()

            suspend fun fetchBootstrap(refresh: String? = null) = client.get(
                "/api/v1/intern/filters/bootstrap?team=team-test" +
                    refresh?.let { "&refresh=$it" }.orEmpty(),
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            insertTestFeedback(id = "cached-feedback", surveyId = "survey-cached")
            val initial = fetchBootstrap()
            initial.status shouldBe HttpStatusCode.OK
            Json.parseToJsonElement(initial.bodyAsText())
                .jsonObject["surveyMeta"]!!.jsonObject["survey-cached"] shouldNotBe null

            insertTestFeedback(id = "fresh-feedback", surveyId = "survey-fresh")
            val stillCached = fetchBootstrap(refresh = "false")
            stillCached.status shouldBe HttpStatusCode.OK
            Json.parseToJsonElement(stillCached.bodyAsText())
                .jsonObject["surveyMeta"]!!.jsonObject["survey-fresh"] shouldBe null

            val refreshed = fetchBootstrap(refresh = "true")
            refreshed.status shouldBe HttpStatusCode.OK
            refreshed.headers[HttpHeaders.CacheControl] shouldBe "private, no-store"
            Json.parseToJsonElement(refreshed.bodyAsText())
                .jsonObject["surveyMeta"]!!.jsonObject["survey-fresh"] shouldNotBe null

            val cachedAfterRefresh = fetchBootstrap()
            cachedAfterRefresh.status shouldBe HttpStatusCode.OK
            Json.parseToJsonElement(cachedAfterRefresh.bodyAsText())
                .jsonObject["surveyMeta"]!!.jsonObject["survey-fresh"] shouldBe null
        }
    }

    test("failed refresh preserves the previously cached bootstrap") {
        val bootstrapCache = InMemoryStringCache()
        val cache = VersionedBootstrapCache(bootstrapCache)
        val principal = BrukerPrincipal(
            navIdent = "A123456",
            name = "Test User",
            email = "test.user@nav.no",
            clientId = "dev-gcp:team-esyfo:lumi-dashboard",
        )
        cache.set(
            cache.lookup("team-test", principal),
            "{\"cached\":true}",
            Duration.ofMinutes(5),
        )
        val failingRepository = mockk<FeedbackRepository>()
        coEvery { failingRepository.findDistinctApps(any()) } throws
            RuntimeException("simulated repository failure")

        testApplication {
            application {
                testModule(
                    bootstrapCache = bootstrapCache,
                    filterFeedbackRepository = failingRepository,
                )
            }
            val client = createTestClient()

            val refresh = client.get(
                "/api/v1/intern/filters/bootstrap?team=team-test&refresh=true",
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }
            refresh.status shouldBe HttpStatusCode.InternalServerError

            val cached = client.get("/api/v1/intern/filters/bootstrap?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }
            cached.status shouldBe HttpStatusCode.OK
            cached.bodyAsText() shouldBe "{\"cached\":true}"
        }
    }

    test("bootstrap rejects an invalid refresh value") {
        testApplication {
            application { testModule() }

            val response = createTestClient().get(
                "/api/v1/intern/filters/bootstrap?team=team-test&refresh=invalid",
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.BadRequest
        }
    }

    test("bootstrap refresh has a dedicated rate limit without blocking ordinary reads") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            repeat(6) {
                val response = client.get(
                    "/api/v1/intern/filters/bootstrap?team=team-test&refresh=true",
                ) {
                    header(HttpHeaders.Authorization, "Bearer test-token")
                }
                response.status shouldBe HttpStatusCode.OK
            }

            val limited = client.get(
                "/api/v1/intern/filters/bootstrap?team=team-test&refresh=true",
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }
            limited.status shouldBe HttpStatusCode.TooManyRequests

            val ordinary = client.get("/api/v1/intern/filters/bootstrap?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }
            ordinary.status shouldBe HttpStatusCode.OK
        }
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

    test("bootstrap exposes lastSubmissionAt for every survey with feedback") {
        testApplication {
            application { testModule() }
            insertTestFeedback(surveyId = "survey-1")
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
            val surveyMeta = Json.parseToJsonElement(response.bodyAsText())
                .jsonObject["surveyMeta"]!!.jsonObject

            // Active survey with feedback gets an entry with recency but no archive state
            val activeEntry = surveyMeta["survey-1"]!!.jsonObject
            activeEntry["archivedAt"] shouldBe JsonNull
            activeEntry["lastSubmissionAt"] shouldNotBe JsonNull
            activeEntry["lastSubmissionAt"] shouldNotBe null

            // Archived survey keeps both fields
            val archivedEntry = surveyMeta["survey-archived"]!!.jsonObject
            archivedEntry["archivedAt"] shouldNotBe JsonNull
            archivedEntry["lastSubmissionAt"] shouldNotBe JsonNull
        }
    }

    test("bootstrap exposes app-specific submission bounds and consistent archive state") {
        testApplication {
            application { testModule() }
            val surveyId = "survey-across-apps"
            val first = OffsetDateTime.parse("2020-01-15T10:00:00+01:00")
            val middle = OffsetDateTime.parse("2021-06-10T12:00:00+02:00")
            val last = OffsetDateTime.parse("2022-09-20T14:00:00+02:00")

            insertTestFeedback(
                id = "first-app-a",
                app = "app-a",
                surveyId = surveyId,
                opprettet = first,
            )
            insertTestFeedback(
                id = "middle-app-b",
                app = "app-b",
                surveyId = surveyId,
                opprettet = middle,
            )
            insertTestFeedback(
                id = "last-app-b",
                app = "app-b",
                surveyId = surveyId,
                opprettet = last,
            )
            val archiveState = SurveyMetadataRepository().archive(
                team = "team-test",
                surveyId = surveyId,
                archivedBy = "A123456",
            )

            val response = createTestClient().get("/api/v1/intern/filters/bootstrap?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK
            val body = Json.parseToJsonElement(response.bodyAsText()).jsonObject
            val surveyMeta = body["surveyMeta"]!!.jsonObject[surveyId]!!.jsonObject
            val surveyMetaByApp = body["surveyMetaByApp"]!!.jsonObject
            val appAMeta = surveyMetaByApp["app-a"]!!.jsonObject[surveyId]!!.jsonObject
            val appBMeta = surveyMetaByApp["app-b"]!!.jsonObject[surveyId]!!.jsonObject

            surveyMeta["firstSubmissionAt"]?.jsonPrimitive?.content shouldBe first.toInstant().toString()
            surveyMeta["lastSubmissionAt"]?.jsonPrimitive?.content shouldBe last.toInstant().toString()
            surveyMeta["archivedAt"]?.jsonPrimitive?.content shouldBe archiveState.archivedAt
            appAMeta["firstSubmissionAt"]?.jsonPrimitive?.content shouldBe first.toInstant().toString()
            appAMeta["lastSubmissionAt"]?.jsonPrimitive?.content shouldBe first.toInstant().toString()
            appAMeta["archivedAt"]?.jsonPrimitive?.content shouldBe archiveState.archivedAt
            appBMeta["firstSubmissionAt"]?.jsonPrimitive?.content shouldBe middle.toInstant().toString()
            appBMeta["lastSubmissionAt"]?.jsonPrimitive?.content shouldBe last.toInstant().toString()
            appBMeta["archivedAt"]?.jsonPrimitive?.content shouldBe archiveState.archivedAt
            body["surveysByApp"]!!.jsonObject.keys shouldBe setOf("app-a", "app-b")
        }
    }

    test("bootstrap gives the badge its data: submission after archiving moves lastSubmissionAt past archivedAt") {
        testApplication {
            application { testModule() }
            insertTestFeedback(
                surveyId = "survey-zombie",
                opprettet = java.time.OffsetDateTime.now().minusDays(10),
            )

            createTestClient().put("/api/v1/intern/surveys/survey-zombie/archive?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }.status shouldBe HttpStatusCode.OK

            // New submission arrives after archiving (widget still deployed)
            insertTestFeedback(surveyId = "survey-zombie")

            val response = createTestClient().get("/api/v1/intern/filters/bootstrap?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }
            val entry = Json.parseToJsonElement(response.bodyAsText())
                .jsonObject["surveyMeta"]!!.jsonObject["survey-zombie"]!!.jsonObject

            val archivedAt = java.time.OffsetDateTime.parse(
                entry["archivedAt"]!!.jsonPrimitive.content,
            ).toInstant()
            val lastSubmissionAt = java.time.Instant.parse(
                entry["lastSubmissionAt"]!!.jsonPrimitive.content,
            )
            (lastSubmissionAt > archivedAt) shouldBe true
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
                .jsonObject["surveyMeta"]?.jsonObject?.get("survey-1")
                ?.jsonObject?.get("archivedAt") shouldBe JsonNull

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
