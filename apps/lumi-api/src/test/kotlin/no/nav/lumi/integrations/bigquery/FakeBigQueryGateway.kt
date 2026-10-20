package no.nav.lumi.integrations.bigquery

import java.time.Instant

/**
 * In-memory BigQuery for export tests. Tables are keyed by `project.dataset.table`.
 *
 * It behaves like BigQuery where the export depends on it: a load job needs an existing table and
 * keeps its metadata and access, `tables.patch` merges labels, and only deleting a table removes
 * the access granted on it.
 */
class FakeBigQueryGateway(
    var serviceAccount: String? = "lumi-api-team-esyfo-1@nais-test.iam.gserviceaccount.com",
) : BigQueryGateway {
    data class Table(
        val labels: Map<String, String>,
        val lines: List<String> = emptyList(),
        val expiresAt: Instant? = null,
        val description: String? = null,
        val type: String = "TABLE",
        /** Access granted on the table, for example by Datamarkedsplassen. */
        val grants: Set<String> = emptySet(),
    )

    val datasets = mutableMapOf<String, BigQueryResult<BigQueryDatasetInfo>>()
    val tables = mutableMapOf<String, Table>()
    val deleted = mutableListOf<String>()
    val truncated = mutableListOf<String>()
    var jobAccess: BigQueryResult<Unit> = BigQueryResult.Success(Unit)
    var createTableOverride: BigQueryResult<Unit>? = null
    var loadOverride: BigQueryResult<Long>? = null

    fun addDataset(
        projectId: String,
        datasetId: String,
        labels: Map<String, String>,
        location: String = "europe-north1",
        maxTimeTravelHours: Int? = 48,
    ) {
        datasets["$projectId.$datasetId"] = BigQueryResult.Success(BigQueryDatasetInfo(location, labels, maxTimeTravelHours))
    }

    fun lines(projectId: String, datasetId: String, tableId: String): List<String> =
        tables.getValue("$projectId.$datasetId.$tableId").lines

    fun grant(projectId: String, datasetId: String, tableId: String, member: String) {
        val key = "$projectId.$datasetId.$tableId"
        tables[key] = tables.getValue(key).let { it.copy(grants = it.grants + member) }
    }

    override suspend fun serviceAccountEmail(): String? = serviceAccount

    override suspend fun checkJobAccess(): BigQueryResult<Unit> = jobAccess

    override suspend fun getDataset(projectId: String, datasetId: String): BigQueryResult<BigQueryDatasetInfo> =
        datasets["$projectId.$datasetId"] ?: BigQueryResult.NotFound

    override suspend fun listTables(projectId: String, datasetId: String): BigQueryResult<BigQueryTableList> {
        if (datasets["$projectId.$datasetId"] == null) return BigQueryResult.NotFound
        val prefix = "$projectId.$datasetId."
        return BigQueryResult.Success(
            BigQueryTableList(
                tables = tables.filterKeys { it.startsWith(prefix) }.map { (key, table) ->
                    BigQueryTableListing(key.removePrefix(prefix), table.type, table.labels)
                },
                complete = true,
            ),
        )
    }

    override suspend fun getTable(ref: BigQueryTableRef): BigQueryResult<BigQueryTableInfo> =
        tables[ref.toString()]?.let { BigQueryResult.Success(BigQueryTableInfo(it.labels)) } ?: BigQueryResult.NotFound

    override suspend fun createTable(spec: BigQueryTableSpec, expiresAt: Instant): BigQueryResult<Unit> {
        createTableOverride?.let { return it }
        if (spec.ref.toString() in tables) return BigQueryResult.Success(Unit)
        tables[spec.ref.toString()] = Table(spec.labels, expiresAt = expiresAt, description = spec.description)
        return BigQueryResult.Success(Unit)
    }

    override suspend fun deleteTable(ref: BigQueryTableRef): BigQueryResult<Unit> {
        val removed = tables.remove(ref.toString()) ?: return BigQueryResult.NotFound
        deleted += ref.toString()
        check(removed.labels.isNotEmpty()) { "Tables without labels must never be deleted" }
        return BigQueryResult.Success(Unit)
    }

    override suspend fun truncateTable(ref: BigQueryTableRef, jobLabels: Map<String, String>): BigQueryResult<Unit> {
        if (jobAccess !is BigQueryResult.Success) return BigQueryResult.JobDenied
        val table = tables[ref.toString()] ?: return BigQueryResult.NotFound
        tables[ref.toString()] = table.copy(lines = emptyList())
        truncated += ref.toString()
        return BigQueryResult.Success(Unit)
    }

    override suspend fun updateTableMetadata(spec: BigQueryTableSpec, expiresAt: Instant): BigQueryResult<Unit> {
        val table = tables[spec.ref.toString()] ?: return BigQueryResult.NotFound
        tables[spec.ref.toString()] = table.copy(
            labels = table.labels + spec.labels,
            expiresAt = expiresAt,
            description = spec.description,
        )
        return BigQueryResult.Success(Unit)
    }

    override fun startUpload(spec: BigQueryTableSpec, jobLabels: Map<String, String>): BigQueryTableUpload =
        object : BigQueryTableUpload {
            private val written = mutableListOf<String>()

            override suspend fun writeLine(line: String) {
                written += line
            }

            override suspend fun finish(): BigQueryResult<Long> {
                loadOverride?.let { return it }
                if (jobAccess !is BigQueryResult.Success) return BigQueryResult.JobDenied
                // CREATE_NEVER: the export creates the table first. WRITE_TRUNCATE keeps metadata and access.
                val table = tables[spec.ref.toString()] ?: return BigQueryResult.NotFound
                tables[spec.ref.toString()] = table.copy(lines = written.toList())
                return BigQueryResult.Success(written.size.toLong())
            }
        }
}
