package no.nav.lumi.integrations.bigquery

import java.time.Instant

/** In-memory BigQuery for export tests. Tables are keyed by `project.dataset.table`. */
class FakeBigQueryGateway(
    var serviceAccount: String? = "lumi-api-team-esyfo-1@nais-test.iam.gserviceaccount.com",
) : BigQueryGateway {
    data class Table(
        val labels: Map<String, String>,
        val lines: List<String> = emptyList(),
        val expiresAt: Instant? = null,
        val description: String? = null,
    )

    val datasets = mutableMapOf<String, BigQueryResult<BigQueryDatasetInfo>>()
    val tables = mutableMapOf<String, Table>()
    val deleted = mutableListOf<String>()
    var createTableOverride: BigQueryResult<Unit>? = null
    var loadOverride: BigQueryResult<Long>? = null

    fun addDataset(projectId: String, datasetId: String, labels: Map<String, String>, location: String = "europe-north1") {
        datasets["$projectId.$datasetId"] = BigQueryResult.Success(BigQueryDatasetInfo(location, labels))
    }

    fun lines(projectId: String, datasetId: String, tableId: String): List<String> =
        tables.getValue("$projectId.$datasetId.$tableId").lines

    override suspend fun serviceAccountEmail(): String? = serviceAccount

    override suspend fun getDataset(projectId: String, datasetId: String): BigQueryResult<BigQueryDatasetInfo> =
        datasets["$projectId.$datasetId"] ?: BigQueryResult.NotFound

    override suspend fun getTable(ref: BigQueryTableRef): BigQueryResult<BigQueryTableInfo> =
        tables[ref.toString()]?.let { BigQueryResult.Success(BigQueryTableInfo(it.labels)) } ?: BigQueryResult.NotFound

    override suspend fun createTable(spec: BigQueryTableSpec, expiresAt: Instant): BigQueryResult<Unit> {
        createTableOverride?.let { return it }
        if (spec.ref.toString() in tables) return BigQueryResult.Failure("Already exists")
        tables[spec.ref.toString()] = Table(spec.labels, expiresAt = expiresAt, description = spec.description)
        return BigQueryResult.Success(Unit)
    }

    override suspend fun deleteTable(ref: BigQueryTableRef): BigQueryResult<Unit> {
        val removed = tables.remove(ref.toString()) ?: return BigQueryResult.NotFound
        deleted += ref.toString()
        check(removed.labels.isNotEmpty()) { "Tables without labels must never be deleted" }
        return BigQueryResult.Success(Unit)
    }

    override suspend fun updateTableMetadata(spec: BigQueryTableSpec, expiresAt: Instant): BigQueryResult<Unit> {
        val table = tables[spec.ref.toString()] ?: return BigQueryResult.NotFound
        tables[spec.ref.toString()] = table.copy(labels = spec.labels, expiresAt = expiresAt, description = spec.description)
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
                tables[spec.ref.toString()] = Table(spec.labels, written.toList(), description = spec.description)
                return BigQueryResult.Success(written.size.toLong())
            }
        }
}
