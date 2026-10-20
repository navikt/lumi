package no.nav.lumi.service

import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.Json
import no.nav.lumi.config.BigQueryExportEnv
import no.nav.lumi.config.BigQueryExportObservability
import no.nav.lumi.domain.BIGQUERY_DATASET_ID_PATTERN
import no.nav.lumi.domain.BIGQUERY_EXPORT_TABLE_LABEL
import no.nav.lumi.domain.BIGQUERY_EXPORT_TABLE_LABEL_VALUE
import no.nav.lumi.domain.BIGQUERY_PROJECT_ID_PATTERN
import no.nav.lumi.domain.BIGQUERY_TEAM_LABEL
import no.nav.lumi.domain.BigQueryColumn
import no.nav.lumi.domain.BigQueryExportAvailability
import no.nav.lumi.domain.BigQueryExportDestination
import no.nav.lumi.domain.BigQueryExportDestinationDto
import no.nav.lumi.domain.BigQueryExportDestinationRequest
import no.nav.lumi.domain.BigQueryExportMapper
import no.nav.lumi.domain.BigQueryExportProblem
import no.nav.lumi.domain.BigQueryExportProblemCode
import no.nav.lumi.domain.BigQueryExportProblemDto
import no.nav.lumi.domain.BigQueryExportRowCounts
import no.nav.lumi.domain.BigQueryExportRunDto
import no.nav.lumi.domain.BigQueryExportRunState
import no.nav.lumi.domain.BigQueryExportRunStatus
import no.nav.lumi.domain.BigQueryExportSchedule
import no.nav.lumi.domain.BigQueryExportStatusResponse
import no.nav.lumi.domain.BigQueryExportStopResponse
import no.nav.lumi.domain.BigQueryExportTable
import no.nav.lumi.domain.BigQueryExportVerificationResponse
import no.nav.lumi.domain.FritekstExportRow
import no.nav.lumi.domain.InnsendingExportRow
import no.nav.lumi.domain.SvarExportRow
import no.nav.lumi.integrations.bigquery.BigQueryGateway
import no.nav.lumi.integrations.bigquery.BigQueryResult
import no.nav.lumi.integrations.bigquery.BigQueryTableRef
import no.nav.lumi.integrations.bigquery.BigQueryTableSpec
import no.nav.lumi.integrations.bigquery.BigQueryTableUpload
import no.nav.lumi.integrations.nais.NaisApiResult
import no.nav.lumi.repository.BigQueryExportRepository
import org.slf4j.LoggerFactory
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

/** Looks up the GCP project a team has in the environment Lumi runs in. */
fun interface TeamProjectLookup {
    suspend fun projectFor(team: String): NaisApiResult<String?>
}

sealed interface BigQueryExportSaveResult {
    data class Saved(val status: BigQueryExportStatusResponse) : BigQueryExportSaveResult
    data class Rejected(val verification: BigQueryExportVerificationResponse) : BigQueryExportSaveResult
}

sealed interface BigQueryExportCommandResult<out T> {
    data class Done<T>(val value: T) : BigQueryExportCommandResult<T>
    data object Unavailable : BigQueryExportCommandResult<Nothing>
    data object NotConfigured : BigQueryExportCommandResult<Nothing>
}

/**
 * Sets up, runs and stops BigQuery exports to datasets in the teams' own GCP projects (ADR 0007).
 *
 * Lumi writes with the role the team gave it on one dataset. It checks that the project is the
 * team's own and that the dataset carries the team's label before every write, and it only touches
 * tables that carry Lumi's own label.
 */
class BigQueryExportService(
    private val env: BigQueryExportEnv,
    private val repository: BigQueryExportRepository,
    private val gateway: BigQueryGateway?,
    private val teamProjects: TeamProjectLookup?,
    private val observability: BigQueryExportObservability,
    private val clock: Clock = Clock.systemUTC(),
    private val schedule: BigQueryExportSchedule = BigQueryExportSchedule(),
    private val retentionMonths: Int = FeedbackRetentionService.RESPONSE_RETENTION_MONTHS,
) {
    private val log = LoggerFactory.getLogger(BigQueryExportService::class.java)

    suspend fun status(team: String): BigQueryExportStatusResponse {
        val now = clock.instant()
        val destination = repository.find(team)
        val availability = when {
            !env.enabled || gateway == null -> BigQueryExportAvailability.DISABLED
            !env.isOpenFor(team) -> BigQueryExportAvailability.PILOT_ONLY
            else -> BigQueryExportAvailability.AVAILABLE
        }
        val available = availability == BigQueryExportAvailability.AVAILABLE
        return BigQueryExportStatusResponse(
            team = team,
            available = available,
            availability = availability,
            location = env.location,
            serviceAccount = gateway?.takeIf { available }?.serviceAccountEmail(),
            suggestedProjectId = if (available) teamProject(team) else null,
            destination = destination?.toDto(now),
        )
    }

    suspend fun verify(team: String, projectId: String, datasetId: String): BigQueryExportCommandResult<BigQueryExportVerificationResponse> {
        val gateway = gatewayFor(team) ?: return BigQueryExportCommandResult.Unavailable
        validateIds(projectId, datasetId)
        val problems = checkDestination(gateway, team, projectId, datasetId, exportedTables(includeFreeText = false), probeWrite = true)
        return BigQueryExportCommandResult.Done(problems.toResponse())
    }

    suspend fun save(
        team: String,
        actor: String,
        request: BigQueryExportDestinationRequest,
    ): BigQueryExportCommandResult<BigQueryExportSaveResult> {
        val gateway = gatewayFor(team) ?: return BigQueryExportCommandResult.Unavailable
        validateIds(request.projectId, request.datasetId)
        val problems = checkDestination(
            gateway, team, request.projectId, request.datasetId, exportedTables(request.includeFreeText), probeWrite = true,
        )
        if (problems.isNotEmpty()) {
            return BigQueryExportCommandResult.Done(BigQueryExportSaveResult.Rejected(problems.toResponse()))
        }

        val previous = repository.find(team)
        repository.upsert(
            team = team,
            projectId = request.projectId,
            datasetId = request.datasetId,
            includeFreeText = request.includeFreeText,
            actor = actor,
            now = clock.instant().truncatedTo(ChronoUnit.MICROS),
        )
        if (previous != null) {
            val movedDataset = previous.projectId != request.projectId || previous.datasetId != request.datasetId
            when {
                movedDataset -> removeLumiTables(gateway, previous.projectId, previous.datasetId, BigQueryExportTable.entries)
                previous.includeFreeText && !request.includeFreeText ->
                    removeLumiTables(gateway, previous.projectId, previous.datasetId, listOf(BigQueryExportTable.FRITEKST))
            }
        }
        log.info("BigQuery export destination saved for team {}", team)
        return BigQueryExportCommandResult.Done(BigQueryExportSaveResult.Saved(status(team)))
    }

    suspend fun requestRun(team: String): BigQueryExportCommandResult<BigQueryExportStatusResponse> {
        if (gatewayFor(team) == null) return BigQueryExportCommandResult.Unavailable
        if (!repository.requestRun(team, clock.instant().truncatedTo(ChronoUnit.MICROS))) {
            return BigQueryExportCommandResult.NotConfigured
        }
        return BigQueryExportCommandResult.Done(status(team))
    }

    suspend fun stop(team: String): BigQueryExportCommandResult<BigQueryExportStopResponse> {
        val destination = repository.find(team) ?: return BigQueryExportCommandResult.NotConfigured
        // Stopping is always allowed, also for a team that is no longer in the pilot.
        val tablesRemoved = enabledGateway()?.let { gateway ->
            removeLumiTables(gateway, destination.projectId, destination.datasetId, BigQueryExportTable.entries)
        } ?: false
        repository.delete(team)
        log.info("BigQuery export stopped for team {} (tablesRemoved={})", team, tablesRemoved)
        return BigQueryExportCommandResult.Done(BigQueryExportStopResponse(tablesRemoved = tablesRemoved))
    }

    /** Runs every due export once. Returns the number of runs, or null when another replica is exporting. */
    suspend fun runDueExports(): Int? {
        val gateway = enabledGateway() ?: return 0
        return repository.withExportLock {
            val now = clock.instant()
            val due = repository.findAll().filter { env.isOpenFor(it.team) && schedule.isDue(it, now) }
            due.forEach { destination -> runExport(gateway, destination) }
            due.size
        }
    }

    private suspend fun runExport(gateway: BigQueryGateway, destination: BigQueryExportDestination) {
        val startedAt = clock.instant().truncatedTo(ChronoUnit.MICROS)
        if (!repository.markStarted(destination.team, startedAt)) return

        val outcome = try {
            export(gateway, destination, startedAt)
        } catch (cause: CancellationException) {
            throw cause
        } catch (cause: Exception) {
            log.error("BigQuery export failed for team {}", destination.team, cause)
            ExportOutcome.Failed(BigQueryExportProblemCode.INTERNAL_ERROR)
        }
        val finishedAt = clock.instant().truncatedTo(ChronoUnit.MICROS)
        when (outcome) {
            is ExportOutcome.Succeeded -> {
                repository.markSucceeded(destination.team, startedAt, finishedAt, outcome.rows)
                observability.recordSucceeded(finishedAt, outcome.rows)
                log.info(
                    "BigQuery export finished for team {}: svar={}, innsendinger={}, fritekst={}",
                    destination.team, outcome.rows.svar, outcome.rows.innsendinger, outcome.rows.fritekst,
                )
            }
            is ExportOutcome.Failed -> {
                repository.markFailed(destination.team, startedAt, finishedAt, outcome.code)
                observability.recordFailed(outcome.code)
                log.warn("BigQuery export failed for team {}: {}", destination.team, outcome.code)
            }
        }
        cleanUpIfDestinationChanged(gateway, destination)
    }

    private suspend fun export(
        gateway: BigQueryGateway,
        destination: BigQueryExportDestination,
        startedAt: Instant,
    ): ExportOutcome {
        val tables = exportedTables(destination.includeFreeText)
        checkDestination(gateway, destination.team, destination.projectId, destination.datasetId, tables, probeWrite = false)
            .firstOrNull()?.let { return ExportOutcome.Failed(it.code) }

        val specs = tables.associateWith { tableSpec(destination, it) }
        val jobLabels = mapOf(BIGQUERY_TEAM_LABEL to destination.team, BIGQUERY_EXPORT_TABLE_LABEL to BIGQUERY_EXPORT_TABLE_LABEL_VALUE)
        val uploads = specs.mapValues { (_, spec) -> CountingUpload(gateway.startUpload(spec, jobLabels)) }
        val mapper = BigQueryExportMapper(destination.pseudonymKey, destination.includeFreeText, startedAt)

        repository.streamSourceRows(destination.team, retentionMonths) { row ->
            val mapped = mapper.map(row) ?: return@streamSourceRows
            uploads.getValue(BigQueryExportTable.INNSENDINGER).write(json.encodeToString(InnsendingExportRow.serializer(), mapped.innsending))
            mapped.svar.forEach { uploads.getValue(BigQueryExportTable.SVAR).write(json.encodeToString(SvarExportRow.serializer(), it)) }
            uploads[BigQueryExportTable.FRITEKST]?.let { upload ->
                mapped.fritekst.forEach { upload.write(json.encodeToString(FritekstExportRow.serializer(), it)) }
            }
        }
        if (mapper.skippedSubmissions > 0 || mapper.skippedAnswers > 0) {
            log.info(
                "BigQuery export for team {} skipped {} malformed submissions and {} malformed answers",
                destination.team, mapper.skippedSubmissions, mapper.skippedAnswers,
            )
        }

        val expiresAt = startedAt.plus(TABLE_LIFETIME)
        for ((table, upload) in uploads) {
            val spec = specs.getValue(table)
            val loaded = if (upload.rows == 0L) {
                replaceWithEmptyTable(gateway, spec, expiresAt)
            } else {
                upload.finish()
            }
            when (loaded) {
                is BigQueryResult.Success -> Unit
                BigQueryResult.AccessDenied -> return ExportOutcome.Failed(BigQueryExportProblemCode.TABLE_WRITE_DENIED)
                BigQueryResult.NotFound -> return ExportOutcome.Failed(BigQueryExportProblemCode.DATASET_NOT_FOUND)
                is BigQueryResult.Failure -> {
                    log.warn("BigQuery load for team {} table {} failed: {}", destination.team, table.tableId, loaded.message)
                    return ExportOutcome.Failed(BigQueryExportProblemCode.LOAD_FAILED)
                }
            }
            if (upload.rows > 0) {
                when (val metadata = gateway.updateTableMetadata(spec, expiresAt)) {
                    is BigQueryResult.Success -> Unit
                    else -> {
                        log.warn("BigQuery metadata update for team {} table {} failed: {}", destination.team, table.tableId, metadata)
                        return ExportOutcome.Failed(BigQueryExportProblemCode.LOAD_FAILED)
                    }
                }
            }
        }
        if (!destination.includeFreeText) {
            removeLumiTables(gateway, destination.projectId, destination.datasetId, listOf(BigQueryExportTable.FRITEKST))
        }
        return ExportOutcome.Succeeded(
            BigQueryExportRowCounts(
                svar = uploads.getValue(BigQueryExportTable.SVAR).rows,
                innsendinger = uploads.getValue(BigQueryExportTable.INNSENDINGER).rows,
                fritekst = uploads[BigQueryExportTable.FRITEKST]?.rows,
            ),
        )
    }

    private suspend fun replaceWithEmptyTable(
        gateway: BigQueryGateway,
        spec: BigQueryTableSpec,
        expiresAt: Instant,
    ): BigQueryResult<Unit> {
        when (val deleted = gateway.deleteTable(spec.ref)) {
            is BigQueryResult.Success, BigQueryResult.NotFound -> Unit
            else -> return deleted
        }
        return gateway.createTable(spec, expiresAt)
    }

    /**
     * Checks a destination before it is saved or written to. The write probe creates and deletes a
     * short-lived table, which is the only reliable way to see that Lumi can create tables.
     */
    private suspend fun checkDestination(
        gateway: BigQueryGateway,
        team: String,
        projectId: String,
        datasetId: String,
        tables: List<BigQueryExportTable>,
        probeWrite: Boolean,
    ): List<BigQueryExportProblem> {
        when (val expected = teamProjects?.projectFor(team)) {
            is NaisApiResult.Success -> if (expected.value != projectId) {
                return listOf(BigQueryExportProblem(BigQueryExportProblemCode.PROJECT_NOT_TEAM_PROJECT, expected.value))
            }
            is NaisApiResult.Error -> log.warn("Could not look up the GCP project for team {}; skipping project check", team)
            null -> Unit
        }

        val dataset = when (val result = gateway.getDataset(projectId, datasetId)) {
            is BigQueryResult.Success -> result.value
            BigQueryResult.NotFound -> return listOf(BigQueryExportProblem(BigQueryExportProblemCode.DATASET_NOT_FOUND))
            BigQueryResult.AccessDenied -> return listOf(BigQueryExportProblem(BigQueryExportProblemCode.DATASET_ACCESS_DENIED))
            is BigQueryResult.Failure -> return listOf(BigQueryExportProblem(BigQueryExportProblemCode.BIGQUERY_UNAVAILABLE))
        }
        val problems = mutableListOf<BigQueryExportProblem>()
        if (!dataset.location.equals(env.location, ignoreCase = true)) {
            problems += BigQueryExportProblem(BigQueryExportProblemCode.DATASET_WRONG_LOCATION, dataset.location)
        }
        when (val label = dataset.labels[BIGQUERY_TEAM_LABEL]) {
            null -> problems += BigQueryExportProblem(BigQueryExportProblemCode.DATASET_TEAM_LABEL_MISSING)
            team -> Unit
            else -> problems += BigQueryExportProblem(BigQueryExportProblemCode.DATASET_TEAM_LABEL_MISMATCH, label)
        }
        if (problems.isNotEmpty()) return problems

        for (table in tables) {
            when (val existing = gateway.getTable(BigQueryTableRef(projectId, datasetId, table.tableId))) {
                is BigQueryResult.Success -> if (!existing.value.isLumiTable()) {
                    problems += BigQueryExportProblem(BigQueryExportProblemCode.TABLE_NOT_CREATED_BY_LUMI, table.tableId)
                }
                BigQueryResult.NotFound -> Unit
                BigQueryResult.AccessDenied -> return listOf(BigQueryExportProblem(BigQueryExportProblemCode.DATASET_ACCESS_DENIED))
                is BigQueryResult.Failure -> return listOf(BigQueryExportProblem(BigQueryExportProblemCode.BIGQUERY_UNAVAILABLE))
            }
        }
        if (problems.isNotEmpty() || !probeWrite) return problems

        val probe = BigQueryTableSpec(
            ref = BigQueryTableRef(projectId, datasetId, "lumi_tilkoblingstest_${UUID.randomUUID().toString().take(8)}"),
            description = "Midlertidig tabell Lumi lager for å sjekke skrivetilgangen. Lumi sletter den med en gang.",
            columns = listOf(BigQueryColumn("ok", "BOOLEAN", false, "Ingen data.")),
            labels = mapOf(BIGQUERY_EXPORT_TABLE_LABEL to BIGQUERY_EXPORT_TABLE_LABEL_VALUE, BIGQUERY_TEAM_LABEL to team),
        )
        return when (val created = gateway.createTable(probe, clock.instant().plus(PROBE_LIFETIME))) {
            is BigQueryResult.Success -> {
                gateway.deleteTable(probe.ref)
                emptyList()
            }
            BigQueryResult.AccessDenied -> listOf(BigQueryExportProblem(BigQueryExportProblemCode.TABLE_WRITE_DENIED))
            BigQueryResult.NotFound -> listOf(BigQueryExportProblem(BigQueryExportProblemCode.DATASET_NOT_FOUND))
            is BigQueryResult.Failure -> {
                log.warn("BigQuery write probe for team {} failed: {}", team, created.message)
                listOf(BigQueryExportProblem(BigQueryExportProblemCode.BIGQUERY_UNAVAILABLE))
            }
        }
    }

    /** Deletes Lumi's own tables. Returns true when none of them are left. */
    private suspend fun removeLumiTables(
        gateway: BigQueryGateway,
        projectId: String,
        datasetId: String,
        tables: List<BigQueryExportTable>,
    ): Boolean = tables.all { table ->
        val ref = BigQueryTableRef(projectId, datasetId, table.tableId)
        when (val existing = gateway.getTable(ref)) {
            BigQueryResult.NotFound -> true
            is BigQueryResult.Success -> existing.value.isLumiTable() &&
                gateway.deleteTable(ref).let { it is BigQueryResult.Success || it == BigQueryResult.NotFound }
            else -> false
        }
    }

    /** If the team stopped or moved the export during a run, the tables from the run are removed. */
    private suspend fun cleanUpIfDestinationChanged(gateway: BigQueryGateway, written: BigQueryExportDestination) {
        val current = repository.find(written.team)
        if (current == null || current.projectId != written.projectId || current.datasetId != written.datasetId) {
            removeLumiTables(gateway, written.projectId, written.datasetId, BigQueryExportTable.entries)
        }
    }

    private suspend fun teamProject(team: String): String? =
        when (val result = teamProjects?.projectFor(team)) {
            is NaisApiResult.Success -> result.value
            else -> null
        }

    private fun enabledGateway(): BigQueryGateway? = gateway?.takeIf { env.enabled }

    private fun gatewayFor(team: String): BigQueryGateway? = gateway?.takeIf { env.isOpenFor(team) }

    private fun exportedTables(includeFreeText: Boolean): List<BigQueryExportTable> = buildList {
        add(BigQueryExportTable.SVAR)
        add(BigQueryExportTable.INNSENDINGER)
        if (includeFreeText) add(BigQueryExportTable.FRITEKST)
    }

    private fun tableSpec(destination: BigQueryExportDestination, table: BigQueryExportTable) = BigQueryTableSpec(
        ref = BigQueryTableRef(destination.projectId, destination.datasetId, table.tableId),
        description = table.description,
        columns = table.columns,
        labels = mapOf(
            BIGQUERY_EXPORT_TABLE_LABEL to BIGQUERY_EXPORT_TABLE_LABEL_VALUE,
            BIGQUERY_TEAM_LABEL to destination.team,
        ),
    )

    private fun BigQueryExportDestination.toDto(now: Instant) = BigQueryExportDestinationDto(
        projectId = projectId,
        datasetId = datasetId,
        includeFreeText = includeFreeText,
        createdAt = createdAt.toString(),
        updatedAt = updatedAt.toString(),
        runState = when {
            lastRunStatus == BigQueryExportRunStatus.RUNNING -> BigQueryExportRunState.RUNNING
            runRequestedAt != null -> BigQueryExportRunState.QUEUED
            else -> BigQueryExportRunState.IDLE
        },
        lastRun = lastRunStartedAt?.let { started ->
            lastRunStatus?.let { status ->
                BigQueryExportRunDto(
                    status = status,
                    startedAt = started.toString(),
                    finishedAt = lastRunFinishedAt?.toString(),
                    errorCode = lastRunErrorCode,
                )
            }
        },
        lastSuccessAt = lastSuccessAt?.toString(),
        lastSuccessRows = lastSuccessRows,
        nextScheduledRunAt = schedule.nextRunAt(this, now).toString(),
    )

    private fun List<BigQueryExportProblem>.toResponse() = BigQueryExportVerificationResponse(
        ok = isEmpty(),
        problems = map { BigQueryExportProblemDto(it.code, it.detail) },
    )

    private fun validateIds(projectId: String, datasetId: String) {
        require(BIGQUERY_PROJECT_ID_PATTERN.matches(projectId)) { "Invalid GCP project id" }
        require(BIGQUERY_DATASET_ID_PATTERN.matches(datasetId)) { "Invalid BigQuery dataset id" }
    }

    private fun no.nav.lumi.integrations.bigquery.BigQueryTableInfo.isLumiTable(): Boolean =
        labels[BIGQUERY_EXPORT_TABLE_LABEL] != null

    private sealed interface ExportOutcome {
        data class Succeeded(val rows: BigQueryExportRowCounts) : ExportOutcome
        data class Failed(val code: BigQueryExportProblemCode) : ExportOutcome
    }

    private class CountingUpload(private val upload: BigQueryTableUpload) {
        var rows = 0L
            private set

        suspend fun write(line: String) {
            upload.writeLine(line)
            rows += 1
        }

        suspend fun finish(): BigQueryResult<Unit> = when (val result = upload.finish()) {
            is BigQueryResult.Success -> if (result.value == rows) {
                BigQueryResult.Success(Unit)
            } else {
                BigQueryResult.Failure("BigQuery loaded ${result.value} of $rows rows")
            }
            BigQueryResult.AccessDenied -> BigQueryResult.AccessDenied
            BigQueryResult.NotFound -> BigQueryResult.NotFound
            is BigQueryResult.Failure -> result
        }
    }

    companion object {
        /** Tables expire unless a run renews them, so data disappears even if Lumi stops exporting. */
        val TABLE_LIFETIME: Duration = Duration.ofDays(7)
        private val PROBE_LIFETIME: Duration = Duration.ofHours(1)
        private val json = Json { explicitNulls = false }
    }
}
