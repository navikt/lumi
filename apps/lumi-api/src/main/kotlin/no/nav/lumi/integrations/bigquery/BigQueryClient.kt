package no.nav.lumi.integrations.bigquery

import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.ByteArrayContent
import io.ktor.http.content.TextContent
import io.ktor.http.encodeURLPathPart
import io.ktor.http.isSuccess
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import no.nav.lumi.domain.BigQueryColumn
import org.slf4j.LoggerFactory
import java.io.ByteArrayOutputStream
import java.time.Clock
import java.time.Duration
import java.time.Instant

/** Outcome of a BigQuery call, reduced to what the export needs to decide. */
sealed interface BigQueryResult<out T> {
    data class Success<T>(val value: T) : BigQueryResult<T>
    data object NotFound : BigQueryResult<Nothing>
    data object AccessDenied : BigQueryResult<Nothing>
    data class Failure(val message: String) : BigQueryResult<Nothing>
}

data class BigQueryDatasetInfo(
    val location: String?,
    val labels: Map<String, String>,
)

data class BigQueryTableInfo(
    val labels: Map<String, String>,
)

data class BigQueryTableRef(
    val projectId: String,
    val datasetId: String,
    val tableId: String,
) {
    override fun toString(): String = "$projectId.$datasetId.$tableId"
}

data class BigQueryTableSpec(
    val ref: BigQueryTableRef,
    val description: String,
    val columns: List<BigQueryColumn>,
    val labels: Map<String, String>,
)

/** Streams newline-delimited JSON into one BigQuery load job. */
interface BigQueryTableUpload {
    suspend fun writeLine(line: String)

    /** Uploads the rest, waits for the load job and returns the number of rows BigQuery loaded. */
    suspend fun finish(): BigQueryResult<Long>
}

interface BigQueryGateway {
    suspend fun serviceAccountEmail(): String?
    suspend fun getDataset(projectId: String, datasetId: String): BigQueryResult<BigQueryDatasetInfo>
    suspend fun getTable(ref: BigQueryTableRef): BigQueryResult<BigQueryTableInfo>

    /** Creates an empty table. Used for the write probe and for tables without rows. */
    suspend fun createTable(spec: BigQueryTableSpec, expiresAt: Instant): BigQueryResult<Unit>
    suspend fun deleteTable(ref: BigQueryTableRef): BigQueryResult<Unit>

    /** Sets expiry, description, labels and column descriptions after a load. */
    suspend fun updateTableMetadata(spec: BigQueryTableSpec, expiresAt: Instant): BigQueryResult<Unit>

    /**
     * Starts a load job that replaces the table content when it completes. A failed or abandoned
     * upload leaves the table unchanged.
     */
    fun startUpload(spec: BigQueryTableSpec, jobLabels: Map<String, String>): BigQueryTableUpload
}

/**
 * Minimal BigQuery REST client for the export. It uses Ktor, as the rest of the API does, instead of
 * the Google client library, which pulls in gRPC, Arrow and the Storage API that the export never uses.
 */
class RestBigQueryGateway(
    private val credentials: GoogleCredentials,
    private val jobProjectId: String,
    private val location: String,
    private val client: HttpClient = defaultHttpClient(),
    private val clock: Clock = Clock.systemUTC(),
    private val apiBaseUrl: String = API_BASE_URL,
    private val uploadBaseUrl: String = UPLOAD_BASE_URL,
    private val pollInterval: Duration = Duration.ofSeconds(1),
    private val jobTimeout: Duration = Duration.ofMinutes(10),
    private val chunkSize: Int = DEFAULT_CHUNK_SIZE,
    private val retryDelay: Duration = Duration.ofSeconds(1),
) : BigQueryGateway {
    init {
        require(chunkSize > 0 && chunkSize % UPLOAD_CHUNK_GRANULARITY == 0) {
            "chunkSize must be a positive multiple of $UPLOAD_CHUNK_GRANULARITY bytes"
        }
    }

    override suspend fun serviceAccountEmail(): String? = credentials.serviceAccountEmail()

    override suspend fun getDataset(projectId: String, datasetId: String): BigQueryResult<BigQueryDatasetInfo> =
        call({ client.get(datasetUrl(projectId, datasetId)) { authorize() } }) { body ->
            BigQueryDatasetInfo(
                location = body.string("location"),
                labels = body.labels(),
            )
        }

    override suspend fun getTable(ref: BigQueryTableRef): BigQueryResult<BigQueryTableInfo> =
        call({ client.get(tableUrl(ref)) { authorize() } }) { body ->
            BigQueryTableInfo(labels = body.labels())
        }

    override suspend fun createTable(spec: BigQueryTableSpec, expiresAt: Instant): BigQueryResult<Unit> =
        call({
            client.post("${datasetUrl(spec.ref.projectId, spec.ref.datasetId)}/tables") {
                authorize()
                setBody(jsonContent(tableResource(spec, expiresAt, includeReference = true)))
            }
        }) { }

    override suspend fun deleteTable(ref: BigQueryTableRef): BigQueryResult<Unit> =
        call({ client.delete(tableUrl(ref)) { authorize() } }, parseBody = false) { }

    override suspend fun updateTableMetadata(spec: BigQueryTableSpec, expiresAt: Instant): BigQueryResult<Unit> =
        call({
            client.patch(tableUrl(spec.ref)) {
                authorize()
                setBody(jsonContent(tableResource(spec, expiresAt, includeReference = false)))
            }
        }) { }

    override fun startUpload(spec: BigQueryTableSpec, jobLabels: Map<String, String>): BigQueryTableUpload =
        ResumableLoadUpload(spec, jobLabels)

    private inner class ResumableLoadUpload(
        private val spec: BigQueryTableSpec,
        private val jobLabels: Map<String, String>,
    ) : BigQueryTableUpload {
        private val jobId = "lumi_export_${spec.ref.tableId}_${java.util.UUID.randomUUID().toString().replace("-", "")}"
        private val buffer = ByteArrayOutputStream()
        private var sessionUrl: String? = null
        private var uploadedBytes = 0L
        private var finished = false

        /** The first failure. Later lines are dropped, and [finish] reports the failure. */
        private var failure: BigQueryResult<Nothing>? = null

        override suspend fun writeLine(line: String) {
            check(!finished) { "Upload is already finished" }
            if (failure != null) return
            buffer.write(line.toByteArray(Charsets.UTF_8))
            buffer.write(NEWLINE)
            while (failure == null && buffer.size() >= chunkSize) {
                guarded { uploadChunk(final = false) }
            }
        }

        override suspend fun finish(): BigQueryResult<Long> {
            check(!finished) { "Upload is already finished" }
            finished = true
            failure?.let { return it }
            val job = guarded { uploadChunk(final = true) }
            failure?.let { return it }
            return job?.let { waitForJob(it) } ?: BigQueryResult.Failure("BigQuery returned no job after upload")
        }

        private suspend fun <T> guarded(block: suspend () -> T): T? = try {
            block()
        } catch (cause: BigQueryCallException) {
            failure = cause.result
            buffer.reset()
            null
        } catch (cause: CancellationException) {
            throw cause
        } catch (cause: Exception) {
            log.warn("BigQuery upload failed: {}", cause.javaClass.simpleName)
            failure = BigQueryResult.Failure("BigQuery upload failed: ${cause.javaClass.simpleName}")
            buffer.reset()
            null
        }

        /** Uploads one chunk. Intermediate chunks are exact multiples of the upload granularity. */
        private suspend fun uploadChunk(final: Boolean): JsonObject? {
            val url = sessionUrl ?: openSession().also { sessionUrl = it }
            val bytes = buffer.toByteArray()
            val length = if (final) bytes.size else chunkSize
            val chunk = bytes.copyOfRange(0, length)
            val total = uploadedBytes + length
            val range = when {
                length == 0 -> "bytes */$total"
                final -> "bytes $uploadedBytes-${total - 1}/$total"
                else -> "bytes $uploadedBytes-${total - 1}/*"
            }
            val response = client.put(url) {
                authorize()
                header(HttpHeaders.ContentRange, range)
                setBody(ByteArrayContent(chunk, ContentType.Application.OctetStream))
            }
            if (!final) {
                if (response.status.value != RESUME_INCOMPLETE) throw BigQueryCallException(response.failure().result)
                val persisted = response.headers[HttpHeaders.Range]
                    ?.substringAfter("bytes=0-", missingDelimiterValue = "")
                    ?.toLongOrNull()
                if (persisted != total - 1) {
                    throw BigQueryCallException(BigQueryResult.Failure("BigQuery persisted an unexpected byte range"))
                }
                uploadedBytes = total
                buffer.reset()
                buffer.write(bytes, length, bytes.size - length)
                return null
            }
            if (!response.status.isSuccess()) throw BigQueryCallException(response.failure().result)
            uploadedBytes = total
            buffer.reset()
            return json.parseToJsonElement(response.bodyAsText()) as? JsonObject
        }

        private suspend fun openSession(): String {
            val response = client.post("$uploadBaseUrl/projects/${jobProjectId.path()}/jobs?uploadType=resumable") {
                authorize()
                header("X-Upload-Content-Type", ContentType.Application.OctetStream.toString())
                setBody(jsonContent(loadJob(spec, jobId, jobLabels)))
            }
            if (!response.status.isSuccess()) throw BigQueryCallException(response.failure().result)
            return response.headers[HttpHeaders.Location]
                ?: throw BigQueryCallException(BigQueryResult.Failure("BigQuery returned no upload session"))
        }

        private suspend fun waitForJob(initial: JsonObject): BigQueryResult<Long> {
            val deadline = Instant.now(clock).plus(jobTimeout)
            var job = initial
            while (true) {
                val status = job["status"] as? JsonObject
                if (status?.string("state") == "DONE") {
                    val error = status["errorResult"] as? JsonObject
                    if (error != null) {
                        return BigQueryResult.Failure(
                            "Load job failed: ${error.string("reason") ?: "unknown"}: ${error.string("message") ?: ""}",
                        )
                    }
                    val statistics = (job["statistics"] as? JsonObject)?.get("load") as? JsonObject
                    return BigQueryResult.Success(statistics?.string("outputRows")?.toLongOrNull() ?: 0L)
                }
                if (Instant.now(clock).isAfter(deadline)) {
                    return BigQueryResult.Failure("Load job did not finish within ${jobTimeout.toMinutes()} minutes")
                }
                delay(pollInterval.toMillis())
                job = when (
                    val next = call({
                        client.get("$apiBaseUrl/projects/${jobProjectId.path()}/jobs/${jobId.path()}") {
                            authorize()
                            url.parameters.append("location", location)
                        }
                    }) { it }
                ) {
                    is BigQueryResult.Success -> next.value
                    is BigQueryResult.Failure -> return next
                    BigQueryResult.AccessDenied -> return BigQueryResult.AccessDenied
                    BigQueryResult.NotFound -> return BigQueryResult.Failure("Load job disappeared")
                }
            }
        }
    }

    private fun loadJob(spec: BigQueryTableSpec, jobId: String, jobLabels: Map<String, String>): JsonObject =
        buildJsonObject {
            putJsonObject("jobReference") {
                put("projectId", jobProjectId)
                put("jobId", jobId)
                put("location", location)
            }
            putJsonObject("configuration") {
                putJsonObject("labels") { jobLabels.forEach { (key, value) -> put(key, value) } }
                putJsonObject("load") {
                    putJsonObject("destinationTable") {
                        put("projectId", spec.ref.projectId)
                        put("datasetId", spec.ref.datasetId)
                        put("tableId", spec.ref.tableId)
                    }
                    put("sourceFormat", "NEWLINE_DELIMITED_JSON")
                    put("writeDisposition", "WRITE_TRUNCATE")
                    put("createDisposition", "CREATE_IF_NEEDED")
                    put("maxBadRecords", 0)
                    put("ignoreUnknownValues", false)
                    put("schema", schema(spec.columns))
                    putJsonObject("destinationTableProperties") {
                        put("description", spec.description)
                        putJsonObject("labels") { spec.labels.forEach { (key, value) -> put(key, value) } }
                    }
                }
            }
        }

    private fun tableResource(spec: BigQueryTableSpec, expiresAt: Instant, includeReference: Boolean): JsonObject =
        buildJsonObject {
            if (includeReference) {
                putJsonObject("tableReference") {
                    put("projectId", spec.ref.projectId)
                    put("datasetId", spec.ref.datasetId)
                    put("tableId", spec.ref.tableId)
                }
            }
            put("description", spec.description)
            put("expirationTime", expiresAt.toEpochMilli().toString())
            putJsonObject("labels") { spec.labels.forEach { (key, value) -> put(key, value) } }
            put("schema", schema(spec.columns))
        }

    private fun schema(columns: List<BigQueryColumn>): JsonObject = buildJsonObject {
        putJsonArray("fields") {
            columns.forEach { column ->
                add(
                    buildJsonObject {
                        put("name", column.name)
                        put("type", column.type)
                        put("mode", if (column.required) "REQUIRED" else "NULLABLE")
                        put("description", column.description)
                    },
                )
            }
        }
    }

    private suspend fun HttpRequestBuilder.authorize() {
        header(HttpHeaders.Authorization, "Bearer ${credentials.accessToken()}")
        header(HttpHeaders.UserAgent, USER_AGENT)
    }

    /**
     * Runs a call with up to two retries on throttling and server errors. Not used for chunk
     * uploads: a failed upload fails the run, and the next run starts a new load job.
     */
    private suspend fun <T> call(
        request: suspend () -> HttpResponse,
        parseBody: Boolean = true,
        transform: (JsonObject) -> T,
    ): BigQueryResult<T> {
        var attempt = 0
        while (true) {
            attempt += 1
            val response = try {
                request()
            } catch (cause: CancellationException) {
                throw cause
            } catch (cause: Exception) {
                if (attempt <= MAX_RETRIES) {
                    delay(retryDelay.toMillis() * attempt)
                    continue
                }
                log.warn("BigQuery call failed: {}", cause.javaClass.simpleName)
                return BigQueryResult.Failure("BigQuery call failed: ${cause.javaClass.simpleName}")
            }
            if (response.status.isSuccess()) {
                if (!parseBody) return BigQueryResult.Success(transform(JsonObject(emptyMap())))
                val body = json.parseToJsonElement(response.bodyAsText().ifBlank { "{}" }) as? JsonObject
                    ?: return BigQueryResult.Failure("BigQuery returned an unexpected body")
                return BigQueryResult.Success(transform(body))
            }
            val failure = response.failure()
            if (failure.retryable && attempt <= MAX_RETRIES) {
                delay(retryDelay.toMillis() * attempt)
                continue
            }
            return failure.result
        }
    }

    private data class CallFailure(val result: BigQueryResult<Nothing>, val retryable: Boolean)

    /** Reads the error body once and classifies it. */
    private suspend fun HttpResponse.failure(): CallFailure {
        val reason = runCatching {
            val error = (json.parseToJsonElement(bodyAsText()) as? JsonObject)?.get("error") as? JsonObject
            ((error?.get("errors") as? JsonArray)?.firstOrNull() as? JsonObject)?.string("reason")
        }.getOrNull()
        val throttled = reason in THROTTLING_REASONS
        val result = when {
            status == HttpStatusCode.NotFound -> BigQueryResult.NotFound
            status == HttpStatusCode.Forbidden && !throttled -> BigQueryResult.AccessDenied
            else -> BigQueryResult.Failure("BigQuery returned ${status.value}${reason?.let { " ($it)" } ?: ""}")
        }
        val retryable = status == HttpStatusCode.TooManyRequests || status.value >= 500 || throttled
        return CallFailure(result, retryable)
    }

    private fun datasetUrl(projectId: String, datasetId: String): String =
        "$apiBaseUrl/projects/${projectId.path()}/datasets/${datasetId.path()}"

    private fun tableUrl(ref: BigQueryTableRef): String =
        "${datasetUrl(ref.projectId, ref.datasetId)}/tables/${ref.tableId.path()}"

    private class BigQueryCallException(val result: BigQueryResult<Nothing>) : RuntimeException()

    companion object {
        private val log = LoggerFactory.getLogger(RestBigQueryGateway::class.java)
        const val API_BASE_URL = "https://bigquery.googleapis.com/bigquery/v2"
        const val UPLOAD_BASE_URL = "https://bigquery.googleapis.com/upload/bigquery/v2"
        const val UPLOAD_CHUNK_GRANULARITY = 256 * 1024
        const val DEFAULT_CHUNK_SIZE = 32 * UPLOAD_CHUNK_GRANULARITY
        private const val RESUME_INCOMPLETE = 308
        private const val MAX_RETRIES = 2
        private const val USER_AGENT = "lumi-api"
        private const val NEWLINE = '\n'.code
        private val THROTTLING_REASONS = setOf("rateLimitExceeded", "quotaExceeded", "backendError")
        private val json = Json { ignoreUnknownKeys = true }

        fun defaultHttpClient(): HttpClient = HttpClient(CIO) {
            // 308 means "resume incomplete" in Google's upload protocol, not a redirect.
            followRedirects = false
            install(HttpTimeout) {
                connectTimeoutMillis = 5_000
                requestTimeoutMillis = 120_000
                socketTimeoutMillis = 60_000
            }
        }

        private fun jsonContent(body: JsonObject): TextContent =
            TextContent(json.encodeToString(JsonObject.serializer(), body), ContentType.Application.Json)

        private fun String.path(): String = encodeURLPathPart()

        private fun JsonObject.string(key: String): String? = (this[key] as? JsonPrimitive)?.contentOrNull

        private fun JsonObject.labels(): Map<String, String> =
            (this["labels"] as? JsonObject)
                ?.mapNotNull { (key, value) -> (value as? JsonPrimitive)?.contentOrNull?.let { key to it } }
                ?.toMap()
                ?: emptyMap()
    }
}
