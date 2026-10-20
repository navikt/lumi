package no.nav.lumi.integrations.bigquery

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
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
    var invalidations = 0
    val credentials = object : GoogleCredentials {
        override suspend fun accessToken(): String = "test-token-$invalidations"
        override suspend fun serviceAccountEmail(): String = "lumi-api-team-esyfo-1@nais-prod.iam.gserviceaccount.com"
        override suspend fun invalidate() {
            invalidations += 1
        }
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
    val sessionUrl = "https://bigquery.googleapis.com/upload/bigquery/v2/projects/team-esyfo-prod-bbe6/jobs?uploadType=resumable&upload_id=1"

    beforeTest { invalidations = 0 }

    fun gateway(
        chunkSize: Int = RestBigQueryGateway.UPLOAD_CHUNK_GRANULARITY,
        jobTimeout: Duration = Duration.ofMinutes(10),
        handler: suspend MockRequestHandleScope.(HttpRequestData) -> HttpResponseData,
    ) = RestBigQueryGateway(
        credentials = credentials,
        jobProjectId = "team-esyfo-prod-bbe6",
        location = "europe-north1",
        client = HttpClient(MockEngine(handler)) { followRedirects = false },
        pollInterval = Duration.ZERO,
        jobTimeout = jobTimeout,
        chunkSize = chunkSize,
        retryDelay = Duration.ZERO,
    )

    fun jsonHeaders() = headersOf(HttpHeaders.ContentType, "application/json")

    fun bodyOf(request: HttpRequestData): JsonObject =
        json.parseToJsonElement((request.body as TextContent).text).jsonObject

    fun isSessionStart(request: HttpRequestData) =
        request.method == HttpMethod.Post && request.url.encodedPath.startsWith("/upload/")

    test("reads location, labels and time travel of a dataset with Lumi's token") {
        val requests = mutableListOf<HttpRequestData>()
        val result = gateway { request ->
            requests += request
            respond(
                """{"location":"europe-north1","labels":{"lumi-team":"teamsykefravr"},"maxTimeTravelHours":"48"}""",
                HttpStatusCode.OK,
                jsonHeaders(),
            )
        }.getDataset("teamsykefravr-prod-1234", "lumi")

        result shouldBe BigQueryResult.Success(BigQueryDatasetInfo("europe-north1", mapOf("lumi-team" to "teamsykefravr"), 48))
        requests.single().url.encodedPath shouldBe "/bigquery/v2/projects/teamsykefravr-prod-1234/datasets/lumi"
        requests.single().headers[HttpHeaders.Authorization] shouldBe "Bearer test-token-0"
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

    test("gets a new token once after 401") {
        val tokens = mutableListOf<String?>()
        val result = gateway { request ->
            tokens += request.headers[HttpHeaders.Authorization]
            if (tokens.size == 1) respond("{}", HttpStatusCode.Unauthorized, jsonHeaders()) else respond("{}", HttpStatusCode.OK, jsonHeaders())
        }.getTable(spec.ref)

        result.shouldBeInstanceOf<BigQueryResult.Success<*>>()
        tokens shouldContainExactly listOf("Bearer test-token-0", "Bearer test-token-1")
    }

    test("reports an unreadable success body as a failure instead of throwing") {
        gateway { respond("<html>", HttpStatusCode.OK) }.getTable(spec.ref).shouldBeInstanceOf<BigQueryResult.Failure>()
    }

    test("checks job access with a dry run in Lumi's project") {
        var body: JsonObject? = null
        gateway { request ->
            body = bodyOf(request)
            request.url.encodedPath shouldBe "/bigquery/v2/projects/team-esyfo-prod-bbe6/jobs"
            respond("""{"status":{"state":"DONE"}}""", HttpStatusCode.OK, jsonHeaders())
        }.checkJobAccess() shouldBe BigQueryResult.Success(Unit)
        body!!["configuration"]!!.jsonObject["dryRun"]!!.jsonPrimitive.content shouldBe "true"

        gateway {
            respond("""{"error":{"code":403,"errors":[{"reason":"accessDenied"}]}}""", HttpStatusCode.Forbidden, jsonHeaders())
        }.checkJobAccess() shouldBe BigQueryResult.JobDenied
    }

    test("lists tables and views with their labels") {
        val listed = gateway {
            respond(
                """{"tables":[
                    {"tableReference":{"tableId":"svar"},"type":"TABLE","labels":{"lumi-eksport":"v1"}},
                    {"tableReference":{"tableId":"svar_bro"},"type":"VIEW"}
                ]}""",
                HttpStatusCode.OK,
                jsonHeaders(),
            )
        }.listTables("teamsykefravr-prod-1234", "lumi")

        listed shouldBe BigQueryResult.Success(
            listOf(
                BigQueryTableListing("svar", "TABLE", mapOf("lumi-eksport" to "v1")),
                BigQueryTableListing("svar_bro", "VIEW", emptyMap()),
            ),
        )
        gateway { respond("{}", HttpStatusCode.OK, jsonHeaders()) }.listTables("p-roject1", "lumi") shouldBe
            BigQueryResult.Success(emptyList())
    }

    test("creates a table with schema, labels, description and expiry, and accepts one that exists") {
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

        gateway { respond("""{"error":{"code":409}}""", HttpStatusCode.Conflict, jsonHeaders()) }
            .createTable(spec, expiresAt) shouldBe BigQueryResult.Success(Unit)
    }

    test("empties a table with a TRUNCATE job in Lumi's project and waits for it") {
        val requests = mutableListOf<HttpRequestData>()
        val result = gateway { request ->
            requests += request
            if (request.method == HttpMethod.Post) {
                respond("""{"status":{"state":"RUNNING"}}""", HttpStatusCode.OK, jsonHeaders())
            } else {
                respond("""{"status":{"state":"DONE"}}""", HttpStatusCode.OK, jsonHeaders())
            }
        }.truncateTable(spec.ref, mapOf("lumi-team" to "teamsykefravr"))

        result shouldBe BigQueryResult.Success(Unit)
        val job = bodyOf(requests.first())
        job["configuration"]!!.jsonObject["query"]!!.jsonObject["query"]!!.jsonPrimitive.content shouldBe
            "TRUNCATE TABLE `teamsykefravr-prod-1234.lumi.svar`"
        job["jobReference"]!!.jsonObject["projectId"]!!.jsonPrimitive.content shouldBe "team-esyfo-prod-bbe6"
        requests.last().url.parameters["location"] shouldBe "europe-north1"

        shouldThrow<IllegalArgumentException> {
            gateway { respond("{}") }.truncateTable(BigQueryTableRef("p-roject1", "lumi`; DROP", "svar"), emptyMap())
        }
    }

    test("uploads in chunks into an existing table, finalizes with the total size and waits for the load job") {
        val requests = mutableListOf<Pair<HttpRequestData, ByteArray?>>()
        val upload = gateway { request ->
            val bytes = (request.body as? ByteArrayContent)?.bytes()
            requests += request to bytes
            when {
                isSessionStart(request) -> respond("", HttpStatusCode.OK, headersOf(HttpHeaders.Location, sessionUrl))
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
        load["createDisposition"]!!.jsonPrimitive.content shouldBe "CREATE_NEVER"
        load["sourceFormat"]!!.jsonPrimitive.content shouldBe "NEWLINE_DELIMITED_JSON"
        load["destinationTable"]!!.jsonObject["projectId"]!!.jsonPrimitive.content shouldBe "teamsykefravr-prod-1234"
        // A load job fails when description or labels differ from the existing table, so they are not sent.
        load.containsKey("destinationTableProperties") shouldBe false
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

    test("sends again the bytes Google did not keep") {
        val ranges = mutableListOf<String?>()
        val upload = gateway { request ->
            when {
                isSessionStart(request) -> respond("", HttpStatusCode.OK, headersOf(HttpHeaders.Location, sessionUrl))
                request.method == HttpMethod.Put && request.headers[HttpHeaders.ContentRange]!!.endsWith("/*") -> {
                    ranges += request.headers[HttpHeaders.ContentRange]
                    respond("", HttpStatusCode(308, "Resume Incomplete"), headersOf(HttpHeaders.Range, "bytes=0-10"))
                }
                request.method == HttpMethod.Put -> {
                    ranges += request.headers[HttpHeaders.ContentRange]
                    respond("""{"status":{"state":"DONE"},"statistics":{"load":{"outputRows":"1"}}}""", HttpStatusCode.OK, jsonHeaders())
                }
                else -> error("Unexpected request")
            }
        }.startUpload(spec, emptyMap())

        upload.writeLine("x".repeat(RestBigQueryGateway.UPLOAD_CHUNK_GRANULARITY))
        upload.finish() shouldBe BigQueryResult.Success(1L)

        val total = RestBigQueryGateway.UPLOAD_CHUNK_GRANULARITY + 1
        ranges shouldContainExactly listOf(
            "bytes 0-${RestBigQueryGateway.UPLOAD_CHUNK_GRANULARITY - 1}/*",
            "bytes 11-${total - 1}/$total",
        )
    }

    test("stops on an impossible persisted range instead of losing bytes") {
        val upload = gateway { request ->
            when {
                isSessionStart(request) -> respond("", HttpStatusCode.OK, headersOf(HttpHeaders.Location, sessionUrl))
                else -> respond("", HttpStatusCode(308, "Resume Incomplete"), headersOf(HttpHeaders.Range, "bytes=0-99999999"))
            }
        }.startUpload(spec, emptyMap())

        upload.writeLine("x".repeat(RestBigQueryGateway.UPLOAD_CHUNK_GRANULARITY))
        upload.finish().shouldBeInstanceOf<BigQueryResult.Failure>()
    }

    test("never sends the token to an upload session on another host") {
        val requests = mutableListOf<HttpRequestData>()
        val upload = gateway { request ->
            requests += request
            respond("", HttpStatusCode.OK, headersOf(HttpHeaders.Location, "https://evil.example/session"))
        }.startUpload(spec, emptyMap())

        upload.writeLine("""{"innsending_id":"a"}""")
        upload.finish().shouldBeInstanceOf<BigQueryResult.Failure>()
        requests shouldHaveSize 1
    }

    test("reports a failed load job by reason, without the message that can quote values") {
        val upload = gateway { request ->
            when {
                isSessionStart(request) -> respond("", HttpStatusCode.OK, headersOf(HttpHeaders.Location, sessionUrl))
                else -> respond(
                    """{"status":{"state":"DONE","errorResult":{"reason":"invalid","message":"bad row: hemmelig verdi"}}}""",
                    HttpStatusCode.OK,
                    jsonHeaders(),
                )
            }
        }.startUpload(spec, emptyMap())

        upload.writeLine("""{"innsending_id":"a"}""")
        val failure = upload.finish().shouldBeInstanceOf<BigQueryResult.Failure>()
        failure.message shouldContain "invalid"
        failure.message shouldNotContain "hemmelig"
    }

    test("maps a load job denied on the destination to access denied") {
        val upload = gateway { request ->
            when {
                isSessionStart(request) -> respond("", HttpStatusCode.OK, headersOf(HttpHeaders.Location, sessionUrl))
                else -> respond("""{"status":{"state":"DONE","errorResult":{"reason":"accessDenied"}}}""", HttpStatusCode.OK, jsonHeaders())
            }
        }.startUpload(spec, emptyMap())

        upload.writeLine("""{"innsending_id":"a"}""")
        upload.finish() shouldBe BigQueryResult.AccessDenied
    }

    test("reports access denied when the load job cannot be created, and retries a brief error first") {
        val denied = gateway {
            respond("""{"error":{"code":403,"errors":[{"reason":"accessDenied"}]}}""", HttpStatusCode.Forbidden, jsonHeaders())
        }.startUpload(spec, emptyMap())
        denied.writeLine("""{"innsending_id":"a"}""")
        denied.finish() shouldBe BigQueryResult.AccessDenied

        var sessionAttempts = 0
        val retried = gateway { request ->
            when {
                isSessionStart(request) -> {
                    sessionAttempts += 1
                    if (sessionAttempts == 1) {
                        respond("{}", HttpStatusCode.ServiceUnavailable, jsonHeaders())
                    } else {
                        respond("", HttpStatusCode.OK, headersOf(HttpHeaders.Location, sessionUrl))
                    }
                }
                else -> respond("""{"status":{"state":"DONE"},"statistics":{"load":{"outputRows":"1"}}}""", HttpStatusCode.OK, jsonHeaders())
            }
        }.startUpload(spec, emptyMap())
        retried.writeLine("""{"innsending_id":"a"}""")
        retried.finish() shouldBe BigQueryResult.Success(1L)
        sessionAttempts shouldBe 2
    }

    test("cancels a job that runs too long, so it cannot replace the table later") {
        val requests = mutableListOf<HttpRequestData>()
        val result = gateway(jobTimeout = Duration.ofSeconds(-1)) { request ->
            requests += request
            respond("""{"status":{"state":"RUNNING"}}""", HttpStatusCode.OK, jsonHeaders())
        }.truncateTable(spec.ref, emptyMap())

        result.shouldBeInstanceOf<BigQueryResult.Failure>()
        requests.last().url.encodedPath shouldContain "/cancel"
        requests.last().url.parameters["location"] shouldBe "europe-north1"
    }

    test("treats a deleted table as success and a missing one as not found") {
        gateway { respond("", HttpStatusCode.NoContent) }.deleteTable(spec.ref) shouldBe BigQueryResult.Success(Unit)
        gateway { respond("{}", HttpStatusCode.NotFound, jsonHeaders()) }.deleteTable(spec.ref) shouldBe BigQueryResult.NotFound
    }

    test("rejects chunk sizes Google cannot accept") {
        runCatching { gateway(chunkSize = 1000) { respond("") } }.isFailure shouldBe true
    }
})
