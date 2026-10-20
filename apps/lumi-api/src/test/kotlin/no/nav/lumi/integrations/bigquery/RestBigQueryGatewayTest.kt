package no.nav.lumi.integrations.bigquery

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.MockRequestHandleScope
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpRequestData
import io.ktor.client.request.HttpResponseData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.ByteArrayContent
import io.ktor.http.content.TextContent
import io.ktor.http.headersOf
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import no.nav.lumi.domain.BigQueryColumn
import java.time.Duration
import java.time.Instant

class RestBigQueryGatewayTest : FunSpec({
    val credentials = object : GoogleCredentials {
        override suspend fun accessToken(): String = "test-token"
        override suspend fun serviceAccountEmail(): String = "lumi-api-team-esyfo-1@nais-prod.iam.gserviceaccount.com"
    }
    val spec = BigQueryTableSpec(
        ref = BigQueryTableRef("teamsykefravr-prod-1234", "lumi", "svar"),
        description = "Svar fra Lumi",
        columns = listOf(
            BigQueryColumn("innsending_id", "STRING", true, "ID"),
            BigQueryColumn("rating_verdi", "INTEGER", false, "Verdi"),
        ),
        labels = mapOf("lumi-eksport" to "v1", "lumi-team" to "teamsykefravr"),
    )
    val json = Json { ignoreUnknownKeys = true }

    fun gateway(chunkSize: Int = RestBigQueryGateway.UPLOAD_CHUNK_GRANULARITY, handler: suspend MockRequestHandleScope.(HttpRequestData) -> HttpResponseData) =
        RestBigQueryGateway(
            credentials = credentials,
            jobProjectId = "team-esyfo-prod-bbe6",
            location = "europe-north1",
            client = HttpClient(MockEngine(handler)) { followRedirects = false },
            pollInterval = Duration.ZERO,
            chunkSize = chunkSize,
            retryDelay = Duration.ZERO,
        )

    fun jsonHeaders() = headersOf(HttpHeaders.ContentType, "application/json")

    fun bodyOf(request: HttpRequestData): JsonObject =
        json.parseToJsonElement((request.body as TextContent).text).jsonObject

    test("reads location and labels of a dataset with Lumi's token") {
        val requests = mutableListOf<HttpRequestData>()
        val result = gateway { request ->
            requests += request
            respond("""{"location":"europe-north1","labels":{"lumi-team":"teamsykefravr"}}""", HttpStatusCode.OK, jsonHeaders())
        }.getDataset("teamsykefravr-prod-1234", "lumi")

        result shouldBe BigQueryResult.Success(BigQueryDatasetInfo("europe-north1", mapOf("lumi-team" to "teamsykefravr")))
        requests.single().url.encodedPath shouldBe "/bigquery/v2/projects/teamsykefravr-prod-1234/datasets/lumi"
        requests.single().headers[HttpHeaders.Authorization] shouldBe "Bearer test-token"
    }

    test("maps not found and access denied, and retries throttling before giving up") {
        gateway { respond("{}", HttpStatusCode.NotFound, jsonHeaders()) }.getDataset("p-roject1", "lumi") shouldBe BigQueryResult.NotFound

        gateway {
            respond("""{"error":{"code":403,"errors":[{"reason":"accessDenied"}]}}""", HttpStatusCode.Forbidden, jsonHeaders())
        }.getDataset("p-roject1", "lumi") shouldBe BigQueryResult.AccessDenied

        var attempts = 0
        gateway {
            attempts += 1
            respond("""{"error":{"code":403,"errors":[{"reason":"rateLimitExceeded"}]}}""", HttpStatusCode.Forbidden, jsonHeaders())
        }.getDataset("p-roject1", "lumi").shouldBeInstanceOf<BigQueryResult.Failure>()
        attempts shouldBe 3
    }

    test("retries a server error and then succeeds") {
        var attempts = 0
        val result = gateway {
            attempts += 1
            if (attempts == 1) {
                respond("{}", HttpStatusCode.ServiceUnavailable, jsonHeaders())
            } else {
                respond("""{"labels":{"lumi-eksport":"v1"}}""", HttpStatusCode.OK, jsonHeaders())
            }
        }.getTable(spec.ref)

        result shouldBe BigQueryResult.Success(BigQueryTableInfo(mapOf("lumi-eksport" to "v1")))
        attempts shouldBe 2
    }

    test("creates a table with schema, labels, description and expiry") {
        var body: JsonObject? = null
        val expiresAt = Instant.parse("2026-10-27T02:00:00Z")
        gateway { request ->
            body = bodyOf(request)
            request.method shouldBe HttpMethod.Post
            request.url.encodedPath shouldBe "/bigquery/v2/projects/teamsykefravr-prod-1234/datasets/lumi/tables"
            respond("{}", HttpStatusCode.OK, jsonHeaders())
        }.createTable(spec, expiresAt) shouldBe BigQueryResult.Success(Unit)

        val created = body!!
        created["tableReference"]!!.jsonObject["tableId"]!!.jsonPrimitive.content shouldBe "svar"
        created["expirationTime"]!!.jsonPrimitive.content shouldBe expiresAt.toEpochMilli().toString()
        created["labels"]!!.jsonObject["lumi-team"]!!.jsonPrimitive.content shouldBe "teamsykefravr"
        val fields = created["schema"]!!.jsonObject["fields"]!!.jsonArray.map { it.jsonObject }
        fields.map { it["name"]!!.jsonPrimitive.content } shouldContainExactly listOf("innsending_id", "rating_verdi")
        fields.map { it["mode"]!!.jsonPrimitive.content } shouldContainExactly listOf("REQUIRED", "NULLABLE")
    }

    test("uploads in chunks, finalizes with the total size and waits for the load job") {
        val requests = mutableListOf<Pair<HttpRequestData, ByteArray?>>()
        val upload = gateway { request ->
            val bytes = (request.body as? ByteArrayContent)?.bytes()
            requests += request to bytes
            when {
                request.method == HttpMethod.Post && request.url.encodedPath.startsWith("/upload/") ->
                    respond("", HttpStatusCode.OK, headersOf(HttpHeaders.Location, "https://upload.example/session/1"))
                request.method == HttpMethod.Put && request.headers[HttpHeaders.ContentRange]!!.endsWith("/*") -> {
                    val end = request.headers[HttpHeaders.ContentRange]!!.substringAfter("-").substringBefore("/")
                    respond("", HttpStatusCode(308, "Resume Incomplete"), headersOf(HttpHeaders.Range, "bytes=0-$end"))
                }
                request.method == HttpMethod.Put ->
                    respond("""{"status":{"state":"RUNNING"}}""", HttpStatusCode.OK, jsonHeaders())
                else ->
                    respond("""{"status":{"state":"DONE"},"statistics":{"load":{"outputRows":"2"}}}""", HttpStatusCode.OK, jsonHeaders())
            }
        }.startUpload(spec, mapOf("lumi-team" to "teamsykefravr"))

        val longLine = "x".repeat(RestBigQueryGateway.UPLOAD_CHUNK_GRANULARITY)
        upload.writeLine(longLine)
        upload.writeLine("""{"innsending_id":"a"}""")
        upload.finish() shouldBe BigQueryResult.Success(2L)

        val session = requests.first()
        val job = json.parseToJsonElement((session.first.body as TextContent).text).jsonObject
        val load = job["configuration"]!!.jsonObject["load"]!!.jsonObject
        load["writeDisposition"]!!.jsonPrimitive.content shouldBe "WRITE_TRUNCATE"
        load["sourceFormat"]!!.jsonPrimitive.content shouldBe "NEWLINE_DELIMITED_JSON"
        load["destinationTable"]!!.jsonObject["projectId"]!!.jsonPrimitive.content shouldBe "teamsykefravr-prod-1234"
        job["jobReference"]!!.jsonObject["projectId"]!!.jsonPrimitive.content shouldBe "team-esyfo-prod-bbe6"
        job["jobReference"]!!.jsonObject["location"]!!.jsonPrimitive.content shouldBe "europe-north1"

        val puts = requests.filter { it.first.method == HttpMethod.Put }
        val total = RestBigQueryGateway.UPLOAD_CHUNK_GRANULARITY + 1 + """{"innsending_id":"a"}""".length + 1
        puts.map { it.first.headers[HttpHeaders.ContentRange] } shouldContainExactly listOf(
            "bytes 0-${RestBigQueryGateway.UPLOAD_CHUNK_GRANULARITY - 1}/*",
            "bytes ${RestBigQueryGateway.UPLOAD_CHUNK_GRANULARITY}-${total - 1}/$total",
        )
        puts.first().second!!.size shouldBe RestBigQueryGateway.UPLOAD_CHUNK_GRANULARITY
        requests.last().first.url.parameters["location"] shouldBe "europe-north1"
    }

    test("reports a failed load job") {
        val upload = gateway { request ->
            when (request.method) {
                HttpMethod.Post -> respond("", HttpStatusCode.OK, headersOf(HttpHeaders.Location, "https://upload.example/session/2"))
                else -> respond(
                    """{"status":{"state":"DONE","errorResult":{"reason":"invalid","message":"bad row"}}}""",
                    HttpStatusCode.OK,
                    jsonHeaders(),
                )
            }
        }.startUpload(spec, emptyMap())

        upload.writeLine("""{"innsending_id":"a"}""")
        upload.finish().shouldBeInstanceOf<BigQueryResult.Failure>()
    }

    test("stops on an unexpected persisted range instead of losing bytes") {
        val upload = gateway { request ->
            when (request.method) {
                HttpMethod.Post -> respond("", HttpStatusCode.OK, headersOf(HttpHeaders.Location, "https://upload.example/session/3"))
                else -> respond("", HttpStatusCode(308, "Resume Incomplete"), headersOf(HttpHeaders.Range, "bytes=0-10"))
            }
        }.startUpload(spec, emptyMap())

        upload.writeLine("x".repeat(RestBigQueryGateway.UPLOAD_CHUNK_GRANULARITY))
        upload.finish().shouldBeInstanceOf<BigQueryResult.Failure>()
    }

    test("reports access denied when the load job cannot be created") {
        val upload = gateway {
            respond("""{"error":{"code":403,"errors":[{"reason":"accessDenied"}]}}""", HttpStatusCode.Forbidden, jsonHeaders())
        }.startUpload(spec, emptyMap())

        upload.writeLine("""{"innsending_id":"a"}""")
        upload.finish() shouldBe BigQueryResult.AccessDenied
    }

    test("treats a deleted table as success and a missing one as not found") {
        gateway { respond("", HttpStatusCode.NoContent) }.deleteTable(spec.ref) shouldBe BigQueryResult.Success(Unit)
        gateway { respond("{}", HttpStatusCode.NotFound, jsonHeaders()) }.deleteTable(spec.ref) shouldBe BigQueryResult.NotFound
    }

    test("rejects chunk sizes Google cannot accept") {
        runCatching { gateway(chunkSize = 1000) { respond("") } }.isFailure shouldBe true
    }
})
