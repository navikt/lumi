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
import io.ktor.http.Url
import io.ktor.http.content.ByteArrayContent
import io.ktor.http.content.TextContent
import io.ktor.http.encodeURLPathPart
import io.ktor.http.isSuccess
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
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
import java.util.UUID

/** Outcome of a BigQuery call, reduced to what the export needs to decide. */
sealed interface BigQueryResult<out T> {
    data class Success<T>(val value: T) : BigQueryResult<T>
    data object NotFound : BigQueryResult<Nothing>
    data object AccessDenied : BigQueryResult<Nothing>

    /** Lumi may not run jobs in its own project, for example because `roles/bigquery.jobUser` is missing. */
    data object JobDenied : BigQueryResult<Nothing>

    /** Any other error. The message has status codes and reasons, never data from the rows. */
    data class Failure(val message: String) : BigQueryResult<Nothing>
}

data class BigQueryDatasetInfo(
    val location: String?,
    val labels: Map<String, String>,
    /** Null when the dataset uses BigQuery's default, which is 168 hours. */
    val maxTimeTravelHours: Int?,
)

data class BigQueryTableInfo(
    val labels: Map<String, String>,
)

data class BigQueryTableListing(
    val tableId: String,
    /** TABLE, VIEW, MATERIALIZED_VIEW, EXTERNAL or SNAPSHOT. */
    val type: String,
    val labels: Map<String, String>,
)

data class BigQueryTableList(
    val tables: List<BigQueryTableListing>,
    /** False when the dataset has more tables than one page holds. */
    val complete: Boolean,
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

    /** Checks that Lumi may run jobs in its own project. Uses a dry run, which costs nothing. */
    suspend fun checkJobAccess(): BigQueryResult<Unit>
    suspend fun getDataset(projectId: String, datasetId: String): BigQueryResult<BigQueryDatasetInfo>

    /** Lists up to the first thousand tables and views in a dataset. */
    suspend fun listTables(projectId: String, datasetId: String): BigQueryResult<BigQueryTableList>
    suspend fun getTable(ref: BigQueryTableRef): BigQueryResult<BigQueryTableInfo>

    /** Creates an empty table that expires at [expiresAt]. A table that already exists counts as created. */
    suspend fun createTable(spec: BigQueryTableSpec, expiresAt: Instant): BigQueryResult<Unit>
    suspend fun deleteTable(ref: BigQueryTableRef): BigQueryResult<Unit>

    /** Removes every row, but keeps the table, its metadata and the access granted on it. */
    suspend fun truncateTable(ref: BigQueryTableRef, jobLabels: Map<String, String>): BigQueryResult<Unit>

    /** Sets expiry, description, labels and column descriptions. Other labels on the table are kept. */
    suspend fun updateTableMetadata(spec: BigQueryTableSpec, expiresAt: Instant): BigQueryResult<Unit>

    /**
     * Starts a load job that replaces the content of an existing table when it completes. A failed or
     * abandoned upload leaves the table unchanged. The table must exist, so its metadata and access
     * stay as they are.
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

    private val uploadHost = Url(uploadBaseUrl).host
    private val uploadProtocol = Url(uploadBaseUrl).protocol

    override suspend fun serviceAccountEmail(): String? = credentials.serviceAccountEmail()

    override suspend fun checkJobAccess(): BigQueryResult<Unit> {
        val result = call({
            client.post(jobsUrl()) {
                authorize()
                setBody(
                    jsonContent(
                        buildJsonObject {
                            putJsonObject("jobReference") {
                                put("projectId", jobProjectId)
                                put("location", location)
                            }
                            putJsonObject("configuration") {
                                put("dryRun", true)
                                putJsonObject("query") {
                                    put("query", "SELECT 1")
                                    put("useLegacySql", false)
                                }
                            }
                        },
                    ),
                )
            }
        }) { }
        return when (result) {
            BigQueryResult.AccessDenied, BigQueryResult.NotFound -> BigQueryResult.JobDenied
            else -> result
        }
    }

    override suspend fun getDataset(projectId: String, datasetId: String): BigQueryResult<BigQueryDatasetInfo> =
        call({ client.get(datasetUrl(projectId, datasetId)) { authorize() } }) { body ->
            BigQueryDatasetInfo(
                location = body.string("location"),
                labels = body.labels(),
                maxTimeTravelHours = body.string("maxTimeTravelHours")?.toIntOrNull(),
            )
        }

    override suspend fun listTables(projectId: String, datasetId: String): BigQueryResult<BigQueryTableList> =
        call({
            client.get("${datasetUrl(projectId, datasetId)}/tables") {
                authorize()
                url.parameters.append("maxResults", MAX_LISTED_TABLES.toString())
            }
        }) { body ->
            BigQueryTableList(
                tables = (body["tables"] as? JsonArray).orEmpty().mapNotNull { element ->
                    val table = element as? JsonObject ?: return@mapNotNull null
                    val tableId = (table["tableReference"] as? JsonObject)?.string("tableId") ?: return@mapNotNull null
                    BigQueryTableListing(tableId = tableId, type = table.string("type") ?: "TABLE", labels = table.labels())
                },
                complete = body.string("nextPageToken") == null,
            )
        }

    override suspend fun getTable(ref: BigQueryTableRef): BigQueryResult<BigQueryTableInfo> =
        call({ client.get(tableUrl(ref)) { authorize() } }) { body ->
            BigQueryTableInfo(labels = body.labels())
        }

    override suspend fun createTable(spec: BigQueryTableSpec, expiresAt: Instant): BigQueryResult<Unit> =
        call(
            {
                client.post("${datasetUrl(spec.ref.projectId, spec.ref.datasetId)}/tables") {
                    authorize()
                    setBody(jsonContent(tableResource(spec, expiresAt, includeReference = true)))
                }
            },
            // A retry after a lost response finds the table the first attempt created.
            conflictIsSuccess = true,
        ) { }

    override suspend fun deleteTable(ref: BigQueryTableRef): BigQueryResult<Unit> =
        call({ client.delete(tableUrl(ref)) { authorize() } }, parseBody = false) { }

    override suspend fun truncateTable(ref: BigQueryTableRef, jobLabels: Map<String, String>): BigQueryResult<Unit> {
        require(listOf(ref.projectId, ref.datasetId, ref.tableId).all(SAFE_IDENTIFIER::matches)) {
            "Unsafe BigQuery identifier"
        }
        val jobId = newJobId("truncate", ref.tableId)
        // A retry after a lost response finds the job the first attempt created; Lumi then waits for it.
        val inserted = call(conflictIsSuccess = true, request = {
            client.post(jobsUrl()) {
                authorize()
                setBody(
                    jsonContent(
                        buildJsonObject {
                            putJsonObject("jobReference") {
                                put("projectId", jobProjectId)
                                put("jobId", jobId)
                                put("location", location)
                            }
                            putJsonObject("configuration") {
                                putJsonObject("labels") { jobLabels.forEach { (key, value) -> put(key, value) } }
                                putJsonObject("query") {
                                    put("query", "TRUNCATE TABLE `${ref.projectId}.${ref.datasetId}.${ref.tableId}`")
                                    put("useLegacySql", false)
                                }
                            }
                        },
                    ),
                )
            }
        }) { it }
        return when (inserted) {
            is BigQueryResult.Success -> when (val done = waitForJob(jobId, inserted.value)) {
                is BigQueryResult.Success -> BigQueryResult.Success(Unit)
                BigQueryResult.AccessDenied -> BigQueryResult.AccessDenied
                BigQueryResult.NotFound -> BigQueryResult.NotFound
                BigQueryResult.JobDenied -> BigQueryResult.JobDenied
                is BigQueryResult.Failure -> done
            }
            BigQueryResult.AccessDenied -> BigQueryResult.AccessDenied
            BigQueryResult.NotFound -> BigQueryResult.NotFound
            BigQueryResult.JobDenied -> BigQueryResult.JobDenied
            is BigQueryResult.Failure -> inserted
        }
    }

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
        private val jobId = newJobId("export", spec.ref.tableId)
        private val buffer = UploadBuffer()
        private var sessionUrl: String? = null
        private var uploadedBytes = 0L
        private var stalledChunks = 0
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
            if (job == null) return BigQueryResult.Failure("BigQuery returned no job after upload")
            return when (val done = waitForJob(jobId, job)) {
                is BigQueryResult.Success -> BigQueryResult.Success(
                    ((done.value["statistics"] as? JsonObject)?.get("load") as? JsonObject)
                        ?.string("outputRows")?.toLongOrNull() ?: 0L,
                )
                BigQueryResult.AccessDenied -> BigQueryResult.AccessDenied
                BigQueryResult.NotFound -> BigQueryResult.NotFound
                BigQueryResult.JobDenied -> BigQueryResult.JobDenied
                is BigQueryResult.Failure -> done
            }
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
            val length = if (final) buffer.size() else chunkSize
            val chunk = buffer.take(length)
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
                // Google may keep fewer bytes than were sent. The rest is sent again with the next chunk.
                val persisted = response.headers[HttpHeaders.Range]
                    ?.substringAfter("bytes=0-", missingDelimiterValue = "")
                    ?.toLongOrNull()
                    ?.plus(1)
                    ?: 0L
                if (persisted < uploadedBytes || persisted > total) {
                    throw BigQueryCallException(BigQueryResult.Failure("BigQuery persisted an unexpected byte range"))
                }
                val accepted = (persisted - uploadedBytes).toInt()
                stalledChunks = if (accepted == 0) stalledChunks + 1 else 0
                if (stalledChunks > MAX_RETRIES) {
                    throw BigQueryCallException(BigQueryResult.Failure("BigQuery stopped accepting the upload"))
                }
                uploadedBytes = persisted
                buffer.drop(accepted)
                return null
            }
            if (!response.status.isSuccess()) throw BigQueryCallException(response.failure().result)
            uploadedBytes = total
            buffer.reset()
            return parseObject(response.bodyAsText())
                ?: throw BigQueryCallException(BigQueryResult.Failure("BigQuery returned an unexpected body"))
        }

        /** Starts the upload session. Safe to retry, because the job only exists once the upload ends. */
        private suspend fun openSession(): String {
            var attempt = 0
            while (true) {
                attempt += 1
                val response = client.post("$uploadBaseUrl/projects/${jobProjectId.path()}/jobs?uploadType=resumable") {
                    authorize()
                    header("X-Upload-Content-Type", ContentType.Application.OctetStream.toString())
                    setBody(jsonContent(loadJob(spec, jobId, jobLabels)))
                }
                if (!response.status.isSuccess()) {
                    val failure = response.failure()
                    if (failure.retryable && attempt <= MAX_RETRIES) {
                        delay(retryDelay.toMillis() * attempt)
                        continue
                    }
                    throw BigQueryCallException(failure.result)
                }
                val location = response.headers[HttpHeaders.Location]
                    ?: throw BigQueryCallException(BigQueryResult.Failure("BigQuery returned no upload session"))
                // The session URL gets Lumi's token, so it must point to Google's upload host over HTTPS.
                val sessionUrl = runCatching { Url(location) }.getOrNull()
                if (sessionUrl?.host != uploadHost || sessionUrl.protocol != uploadProtocol) {
                    throw BigQueryCallException(BigQueryResult.Failure("BigQuery returned an upload session on another host"))
                }
                return location
            }
        }
    }

    /**
     * Polls a job until it is done. A job that runs past [jobTimeout] is cancelled, so it cannot replace
     * a table after the run has been marked as failed.
     */
    private suspend fun waitForJob(jobId: String, initial: JsonObject): BigQueryResult<JsonObject> = try {
        pollJob(jobId, initial)
    } catch (cause: CancellationException) {
        // The run was stopped, for example by its deadline. The job must not replace a table later.
        withContext(NonCancellable) { cancelJob(jobId) }
        throw cause
    }

    private suspend fun pollJob(jobId: String, initial: JsonObject): BigQueryResult<JsonObject> {
        val deadline = Instant.now(clock).plus(jobTimeout)
        var job = initial
        while (true) {
            val status = job["status"] as? JsonObject
            if (status?.string("state") == "DONE") {
                val error = status["errorResult"] as? JsonObject ?: return BigQueryResult.Success(job)
                return when (val reason = error.string("reason")) {
                    "accessDenied" -> BigQueryResult.AccessDenied
                    "notFound" -> BigQueryResult.NotFound
                    // The message can quote values from the rows, so only the reason and the job are kept.
                    else -> BigQueryResult.Failure("Job $jobId failed: ${reason ?: "unknown"}")
                }
            }
            if (Instant.now(clock).isAfter(deadline)) {
                cancelJob(jobId)
                return BigQueryResult.Failure("Job $jobId did not finish within ${jobTimeout.toMinutes()} minutes")
            }
            delay(pollInterval.toMillis())
            job = when (
                val next = call({
                    client.get("${jobsUrl()}/${jobId.path()}") {
                        authorize()
                        url.parameters.append("location", location)
                    }
                }) { it }
            ) {
                is BigQueryResult.Success -> next.value
                is BigQueryResult.Failure -> return next
                BigQueryResult.AccessDenied, BigQueryResult.JobDenied -> return BigQueryResult.JobDenied
                BigQueryResult.NotFound -> return BigQueryResult.Failure("Job $jobId disappeared")
            }
        }
    }

    private suspend fun cancelJob(jobId: String) {
        val cancelled = call({
            client.post("${jobsUrl()}/${jobId.path()}/cancel") {
                authorize()
                url.parameters.append("location", location)
            }
        }) { }
        if (cancelled !is BigQueryResult.Success) log.warn("Could not cancel BigQuery job {}: {}", jobId, cancelled)
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
                    // Lumi creates the table first, with expiry and labels. Description and labels are
                    // not sent here: a load job fails when they differ from the existing table.
                    put("createDisposition", "CREATE_NEVER")
                    put("maxBadRecords", 0)
                    put("ignoreUnknownValues", false)
                    put("schema", schema(spec.columns))
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
     * Runs a call with up to two retries on throttling and server errors, and one retry with a new
     * token after 401. Not used for chunk uploads: a failed upload fails the run, and the next run
     * starts a new load job.
     */
    private suspend fun <T> call(
        request: suspend () -> HttpResponse,
        parseBody: Boolean = true,
        conflictIsSuccess: Boolean = false,
        transform: (JsonObject) -> T,
    ): BigQueryResult<T> {
        var attempt = 0
        var refreshedToken = false
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
            if (response.status == HttpStatusCode.Unauthorized && !refreshedToken) {
                refreshedToken = true
                credentials.invalidate()
                continue
            }
            if (conflictIsSuccess && response.status == HttpStatusCode.Conflict) {
                return BigQueryResult.Success(transform(JsonObject(emptyMap())))
            }
            if (response.status.isSuccess()) {
                if (!parseBody) return BigQueryResult.Success(transform(JsonObject(emptyMap())))
                val body = parseObject(response.bodyAsText().ifBlank { "{}" })
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
            val error = parseObject(bodyAsText())?.get("error") as? JsonObject
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

    private fun jobsUrl(): String = "$apiBaseUrl/projects/${jobProjectId.path()}/jobs"

    private fun datasetUrl(projectId: String, datasetId: String): String =
        "$apiBaseUrl/projects/${projectId.path()}/datasets/${datasetId.path()}"

    private fun tableUrl(ref: BigQueryTableRef): String =
        "${datasetUrl(ref.projectId, ref.datasetId)}/tables/${ref.tableId.path()}"

    private class BigQueryCallException(val result: BigQueryResult<Nothing>) : RuntimeException()

    /** A byte buffer that hands out chunks without copying the whole buffer first. */
    private class UploadBuffer : ByteArrayOutputStream() {
        fun take(length: Int): ByteArray = buf.copyOfRange(0, length)

        fun drop(length: Int) {
            System.arraycopy(buf, length, buf, 0, count - length)
            count -= length
        }
    }

    companion object {
        private val log = LoggerFactory.getLogger(RestBigQueryGateway::class.java)
        const val API_BASE_URL = "https://bigquery.googleapis.com/bigquery/v2"
        const val UPLOAD_BASE_URL = "https://bigquery.googleapis.com/upload/bigquery/v2"
        const val UPLOAD_CHUNK_GRANULARITY = 256 * 1024
        const val DEFAULT_CHUNK_SIZE = 32 * UPLOAD_CHUNK_GRANULARITY
        private const val RESUME_INCOMPLETE = 308
        private const val MAX_RETRIES = 2
        private const val MAX_LISTED_TABLES = 1000
        private const val USER_AGENT = "lumi-api"
        private const val NEWLINE = '\n'.code
        private val THROTTLING_REASONS = setOf("rateLimitExceeded", "quotaExceeded", "backendError")
        private val SAFE_IDENTIFIER = Regex("^[A-Za-z0-9_-]{1,1024}$")
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

        private fun newJobId(kind: String, tableId: String): String =
            "lumi_${kind}_${tableId}_${UUID.randomUUID().toString().replace("-", "")}"

        private fun parseObject(text: String): JsonObject? =
            runCatching { json.parseToJsonElement(text) as? JsonObject }.getOrNull()

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
