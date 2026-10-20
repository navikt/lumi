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
import io.micrometer.prometheusmetrics.PrometheusConfig
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry
import no.nav.lumi.TestDatabase
import no.nav.lumi.config.BigQueryExportEnv
import no.nav.lumi.config.BigQueryExportObservability
import no.nav.lumi.createTestClient
import no.nav.lumi.integrations.bigquery.FakeBigQueryGateway
import no.nav.lumi.integrations.nais.NaisApiResult
import no.nav.lumi.repository.BigQueryExportRepository
import no.nav.lumi.service.BigQueryExportService
import no.nav.lumi.service.TeamProjectLookup
import no.nav.lumi.testModule

class BigQueryExportRoutesTest : FunSpec({
    beforeSpec { TestDatabase.initialize() }
    beforeTest { TestDatabase.clearAllData() }

    val path = "/api/v1/intern/bigquery-export"
    val project = "team-test-prod-1234"

    fun availableService(gateway: FakeBigQueryGateway = FakeBigQueryGateway()) = BigQueryExportService(
        env = BigQueryExportEnv(enabled = true, jobProjectId = "team-esyfo-prod-bbe6"),
        repository = BigQueryExportRepository(dataSourceProvider = { TestDatabase.dataSource }),
        gateway = gateway,
        teamProjects = TeamProjectLookup { NaisApiResult.Success(project) },
        observability = BigQueryExportObservability(PrometheusMeterRegistry(PrometheusConfig.DEFAULT)),
    )

    fun body(projectId: String = project, datasetId: String = "lumi", extra: String = "") =
        """{"projectId":"$projectId","datasetId":"$datasetId","includeFreeText":false$extra}"""

    test("requires authentication and access to the team") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            client.get("$path?team=team-test").status shouldBe HttpStatusCode.Unauthorized
            client.get("$path?team=not-my-team") { header(HttpHeaders.Authorization, "Bearer token") }.status shouldBe
                HttpStatusCode.Forbidden
            client.delete("$path?team=not-my-team") { header(HttpHeaders.Authorization, "Bearer token") }.status shouldBe
                HttpStatusCode.Forbidden
        }
    }

    test("requires an explicit team instead of falling back to the first team") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            client.get(path) { header(HttpHeaders.Authorization, "Bearer token") }.status shouldBe HttpStatusCode.BadRequest
            client.put(path) {
                header(HttpHeaders.Authorization, "Bearer token")
                contentType(ContentType.Application.Json)
                setBody(body())
            }.status shouldBe HttpStatusCode.BadRequest
        }
    }

    test("reports an unavailable export where the environment has not enabled it") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            val status = client.get("$path?team=team-test") { header(HttpHeaders.Authorization, "Bearer token") }
            status.status shouldBe HttpStatusCode.OK
            status.bodyAsText() shouldContain "\"available\":false"

            client.put("$path?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer token")
                contentType(ContentType.Application.Json)
                setBody(body())
            }.status shouldBe HttpStatusCode.Conflict
        }
    }

    test("rejects malformed, unknown and oversized request bodies") {
        val service = availableService()
        testApplication {
            application { testModule(bigQueryExportService = { service }) }
            val client = createTestClient()

            suspend fun put(text: String) = client.put("$path?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer token")
                contentType(ContentType.Application.Json)
                setBody(text)
            }.status

            put(body(projectId = "Not_A_Project")) shouldBe HttpStatusCode.BadRequest
            put(body(datasetId = "lumi-data")) shouldBe HttpStatusCode.BadRequest
            put(body(extra = ""","team":"another-team"""")) shouldBe HttpStatusCode.BadRequest
            put("{not json") shouldBe HttpStatusCode.BadRequest
            put(body(extra = ""","x":"${"a".repeat(5000)}"""")) shouldBe HttpStatusCode.PayloadTooLarge
            // Free text is closed for teams Lumi has not opened it for.
            put("""{"projectId":"$project","datasetId":"lumi","includeFreeText":true}""") shouldBe HttpStatusCode.BadRequest
            client.get("$path?team=team-test") { header(HttpHeaders.Authorization, "Bearer token") }
                .bodyAsText() shouldContain "\"freeTextAvailable\":false"
        }
    }

    test("answers 422 with problems when the dataset is not ready, and saves when it is") {
        val gateway = FakeBigQueryGateway()
        val service = availableService(gateway)
        testApplication {
            application { testModule(bigQueryExportService = { service }) }
            val client = createTestClient()

            val rejected = client.put("$path?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer token")
                contentType(ContentType.Application.Json)
                setBody(body())
            }
            rejected.status shouldBe HttpStatusCode.UnprocessableEntity
            rejected.bodyAsText() shouldContain "DATASET_NOT_FOUND"

            gateway.addDataset(project, "lumi", mapOf("lumi-team" to "team-test"))
            val verified = client.post("$path/verify?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer token")
                contentType(ContentType.Application.Json)
                setBody("""{"projectId":"$project","datasetId":"lumi"}""")
            }
            verified.status shouldBe HttpStatusCode.OK
            verified.bodyAsText() shouldContain "\"ok\":true"

            val saved = client.put("$path?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer token")
                contentType(ContentType.Application.Json)
                setBody(body())
            }
            saved.status shouldBe HttpStatusCode.OK
            saved.bodyAsText() shouldContain "\"runState\":\"QUEUED\""
            saved.bodyAsText().contains("pseudonym") shouldBe false
        }
    }

    test("running or stopping an export that is not set up answers 404") {
        val service = availableService()
        testApplication {
            application { testModule(bigQueryExportService = { service }) }
            val client = createTestClient()

            client.post("$path/run?team=team-test") { header(HttpHeaders.Authorization, "Bearer token") }.status shouldBe
                HttpStatusCode.NotFound
            client.delete("$path?team=team-test") { header(HttpHeaders.Authorization, "Bearer token") }.status shouldBe
                HttpStatusCode.NotFound
        }
    }
})
