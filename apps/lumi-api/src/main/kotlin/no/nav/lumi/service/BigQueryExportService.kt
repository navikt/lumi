package no.nav.lumi.service

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.Json
import no.nav.lumi.config.BigQueryExportEnv
import no.nav.lumi.config.BigQueryExportObservability
import no.nav.lumi.domain.BIGQUERY_DATASET_ID_PATTERN
import no.nav.lumi.domain.BIGQUERY_EXPORT_TABLE_LABEL
import no.nav.lumi.domain.BIGQUERY_EXPORT_TABLE_LABEL_VALUE
import no.nav.lumi.domain.BIGQUERY_MAX_TIME_TRAVEL_HOURS
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
import no.nav.lumi.integrations.bigquery.BigQueryDatasetInfo
import no.nav.lumi.integrations.bigquery.BigQueryGateway
import no.nav.lumi.integrations.bigquery.BigQueryJobState
import no.nav.lumi.integrations.bigquery.BigQueryResult
import no.nav.lumi.integrations.bigquery.BigQueryTableInfo
import no.nav.lumi.integrations.bigquery.BigQueryTableRef
import no.nav.lumi.integrations.bigquery.BigQueryTableSpec
import no.nav.lumi.integrations.bigquery.BigQueryTableUpload
import no.nav.lumi.integrations.bigquery.newBigQueryJobId
import no.nav.lumi.integrations.nais.NaisApiResult
import no.nav.lumi.repository.BigQueryExportLock
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

    /** The team has stopped the export, and Lumi is still removing the tables. */
    data object Stopping : BigQueryExportCommandResult<Nothing>
}

/**
 * Sets up, runs and stops BigQuery exports to datasets in the teams' own GCP projects (ADR 0007).
 *
 * Lumi writes with the role the team gave it on one dataset. Before every write it checks that the
 * project is the team's own and that the dataset carries the team's label, and it only touches
 * tables that carry Lumi's label and the team's label. When a check cannot be made, nothing is
 * written.
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
    private val runTimeout: Duration = Duration.ofMinutes(30),
) {
    private val log = LoggerFactory.getLogger(BigQueryExportService::class.java)

    suspend fun status(team: String): BigQueryExportStatusResponse {
        val now = clock.instant()
        val destination = repository.find(team)
        val availability = when {
            !env.enabled || gateway == null || teamProjects == null -> BigQueryExportAvailability.DISABLED
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
            freeTextAvailable = available && env.allowsFreeText(team),
            destination = destination?.toDto(now),
        )
    }

    suspend fun verify(team: String, projectId: String, datasetId: String): BigQueryExportCommandResult<BigQueryExportVerificationResponse> {
        val gateway = gatewayFor(team) ?: return BigQueryExportCommandResult.Unavailable
        validateIds(projectId, datasetId)
        val problems = checkNewDestination(gateway, team, projectId, datasetId, includeFreeText = false)
        return BigQueryExportCommandResult.Done(problems.toResponse())
    }

    suspend fun save(
        team: String,
        actor: String,
        request: BigQueryExportDestinationRequest,
    ): BigQueryExportCommandResult<BigQueryExportSaveResult> {
        val gateway = gatewayFor(team) ?: return BigQueryExportCommandResult.Unavailable
        validateIds(request.projectId, request.datasetId)
        require(!request.includeFreeText || env.allowsFreeText(team)) { "Free text is not available for the team" }
        val previous = repository.find(team)
        if (previous?.stopRequestedAt != null) return BigQueryExportCommandResult.Stopping
        // Keeping the dataset without adding free text writes nothing new, and the next run checks
        // the dataset anyway. Turning free text off must then work even if a check would fail.
        val sameDataset = previous != null &&
            previous.projectId == request.projectId &&
            previous.datasetId == request.datasetId
        val addsFreeText = request.includeFreeText && previous?.includeFreeText != true
        if (!sameDataset || addsFreeText) {
            val problems = checkNewDestination(gateway, team, request.projectId, request.datasetId, request.includeFreeText)
            if (problems.isNotEmpty()) {
                return BigQueryExportCommandResult.Done(BigQueryExportSaveResult.Rejected(problems.toResponse()))
            }
        }

        val saved = repository.upsert(
            team = team,
            projectId = request.projectId,
            datasetId = request.datasetId,
            includeFreeText = request.includeFreeText,
            actor = actor,
            now = clock.instant().truncatedTo(ChronoUnit.MICROS),
        )
        if (saved.stopRequestedAt != null) return BigQueryExportCommandResult.Stopping
        // A removal that fails here is retried by the run the upsert queued.
        if (previous != null) {
            val movedDataset = previous.projectId != request.projectId || previous.datasetId != request.datasetId
            when {
                movedDataset ->
                    removeLumiTables(gateway, team, previous.projectId, previous.datasetId, BigQueryExportTable.entries)
                previous.includeFreeText && !request.includeFreeText ->
                    removeLumiTables(gateway, team, previous.projectId, previous.datasetId, listOf(BigQueryExportTable.FRITEKST))
            }
        }
        log.info("BigQuery export destination saved for team {}", team)
        return BigQueryExportCommandResult.Done(BigQueryExportSaveResult.Saved(status(team)))
    }

    suspend fun requestRun(team: String): BigQueryExportCommandResult<BigQueryExportStatusResponse> {
        if (gatewayFor(team) == null) return BigQueryExportCommandResult.Unavailable
        if (!repository.requestRun(team, clock.instant().truncatedTo(ChronoUnit.MICROS))) {
            // The update skips an export that is being stopped.
            return if (repository.find(team) == null) BigQueryExportCommandResult.NotConfigured else BigQueryExportCommandResult.Stopping
        }
        return BigQueryExportCommandResult.Done(status(team))
    }

    /** Queues a run after responses were deleted, so the copy in BigQuery follows within minutes. */
    suspend fun requestRunAfterDeletion(team: String) {
        if (!env.isOpenFor(team)) return
        if (repository.requestRun(team, clock.instant().truncatedTo(ChronoUnit.MICROS))) {
            log.info("BigQuery export queued for team {} after responses were deleted", team)
        }
    }

    /**
     * Stops the export. No new run starts, and the settings stay until Lumi has removed its tables.
     * That happens under the export lock once every job Lumi started is done, so neither a running
     * export nor an old job can write the tables back after the stop. When the stop cannot finish
     * at once, for example during a run, the scheduler finishes it. Stopping is always allowed,
     * also for a team outside the pilot.
     */
    suspend fun stop(team: String): BigQueryExportCommandResult<BigQueryExportStopResponse> {
        repository.find(team) ?: return BigQueryExportCommandResult.NotConfigured
        val gateway = enabledGateway()
        if (gateway == null) {
            // Nothing runs without the export, and the tables expire on their own.
            repository.delete(team)
            log.info("BigQuery export stopped for team {} while the export is off", team)
            return BigQueryExportCommandResult.Done(BigQueryExportStopResponse(tablesRemoved = false))
        }
        if (!repository.markStopping(team, clock.instant().truncatedTo(ChronoUnit.MICROS))) {
            return BigQueryExportCommandResult.NotConfigured
        }
        val outcome = repository.withExportLock { finishStop(gateway, team) } ?: StopOutcome.NOT_FINISHED
        log.info("BigQuery export stop requested for team {}: {}", team, outcome)
        return BigQueryExportCommandResult.Done(
            BigQueryExportStopResponse(
                tablesRemoved = outcome == StopOutcome.TABLES_REMOVED,
                stopping = outcome == StopOutcome.NOT_FINISHED,
            ),
        )
    }

    /**
     * Finishes a stop. Call it only while holding the export lock, so no run is writing. Lumi waits
     * for the jobs it has started, then deletes its tables and the settings. When that cannot happen
     * yet, the stop stays, and the scheduler tries again later.
     */
    private suspend fun finishStop(gateway: BigQueryGateway, team: String): StopOutcome {
        val destination = repository.find(team) ?: return StopOutcome.NOT_FINISHED
        val requestedAt = destination.stopRequestedAt ?: return StopOutcome.NOT_FINISHED
        val now = clock.instant().truncatedTo(ChronoUnit.MICROS)
        val waitedLongEnough = !now.isBefore(requestedAt.plus(STOP_MAX_WAIT))
        for (jobId in destination.pendingJobIds) {
            val state = gateway.jobState(jobId)
            when {
                state == BigQueryResult.NotFound || (state as? BigQueryResult.Success)?.value == BigQueryJobState.DONE ->
                    repository.removePendingJob(team, jobId)
                waitedLongEnough -> log.warn("BigQuery export stop for team {} stops waiting for job {}: {}", team, jobId, state)
                else -> {
                    if (state is BigQueryResult.Success) gateway.cancelJob(jobId)
                    repository.markStopAttemptFailed(team, now)
                    log.info("BigQuery export stop for team {} waits for job {}: {}", team, jobId, state)
                    return StopOutcome.NOT_FINISHED
                }
            }
        }
        val removal = removeLumiTables(gateway, team, destination.projectId, destination.datasetId, BigQueryExportTable.entries)
        if (removal == TableRemoval.FAILED && !waitedLongEnough) {
            repository.markStopAttemptFailed(team, now)
            log.warn("BigQuery export stop for team {} could not remove the tables yet", team)
            return StopOutcome.NOT_FINISHED
        }
        repository.delete(team)
        log.info("BigQuery export stopped for team {}: {}", team, removal)
        return if (removal == TableRemoval.REMOVED) StopOutcome.TABLES_REMOVED else StopOutcome.TABLES_LEFT
    }

    /** Runs every due export once. Returns the number of runs, or null when another replica is exporting. */
    suspend fun runDueExports(): Int? {
        val gateway = enabledGateway() ?: return 0
        observability.recordPoll(clock.instant(), repository.findAll().filter { env.isOpenFor(it.team) && it.stopRequestedAt == null })
        return repository.withExportLock { lock ->
            val now = clock.instant()
            finishDueStops(gateway, now)
            failInterruptedRuns(now)
            val due = repository.findAll().filter { env.isOpenFor(it.team) && schedule.isDue(it, now) }
            due.forEach { destination ->
                try {
                    runExport(gateway, destination.team, lock)
                } catch (cause: CancellationException) {
                    throw cause
                } catch (cause: Exception) {
                    log.error("BigQuery export run for team {} could not be completed", destination.team, cause)
                }
            }
            due.size
        }
    }

    /** Finishes stops that could not finish when the team stopped, for example during a run. */
    private suspend fun finishDueStops(gateway: BigQueryGateway, now: Instant) {
        repository.findAll().filter { schedule.isStopDue(it, now) }.forEach { stopping ->
            try {
                finishStop(gateway, stopping.team)
            } catch (cause: CancellationException) {
                throw cause
            } catch (cause: Exception) {
                log.error("BigQuery export stop for team {} could not be finished", stopping.team, cause)
            }
        }
    }

    /**
     * A run that is still marked as running while this replica holds the lock was cut off, for
     * example when a pod stopped. It counts as a failure, so the backoff keeps a run that kills its
     * pod from being retried in a loop. A stopped export is left alone: the stop removes it.
     */
    private suspend fun failInterruptedRuns(now: Instant) {
        repository.findAll()
            .filter { it.lastRunStatus == BigQueryExportRunStatus.RUNNING && it.lastRunStartedAt != null && it.stopRequestedAt == null }
            .forEach { interrupted ->
                val finishedAt = now.truncatedTo(ChronoUnit.MICROS)
                if (repository.markFailed(interrupted.team, interrupted.lastRunStartedAt!!, finishedAt, BigQueryExportProblemCode.INTERNAL_ERROR)) {
                    observability.recordFailed(BigQueryExportProblemCode.INTERNAL_ERROR)
                    log.warn("BigQuery export for team {} was interrupted and is counted as failed", interrupted.team)
                }
            }
    }

    private suspend fun runExport(gateway: BigQueryGateway, team: String, lock: BigQueryExportLock) {
        val startedAt = clock.instant().truncatedTo(ChronoUnit.MICROS)
        // The row returned here has the settings as they are now, also if they changed since the poll.
        val destination = repository.markStarted(team, startedAt) ?: return

        val outcome = try {
            withTimeoutOrNull(runTimeout.toMillis()) { export(gateway, destination, startedAt, lock) }
                ?: ExportOutcome.Failed(BigQueryExportProblemCode.INTERNAL_ERROR).also {
                    log.warn("BigQuery export for team {} did not finish within {} minutes", team, runTimeout.toMinutes())
                }
        } catch (cause: CancellationException) {
            throw cause
        } catch (cause: Exception) {
            log.error("BigQuery export failed for team {}", team, cause)
            ExportOutcome.Failed(BigQueryExportProblemCode.INTERNAL_ERROR)
        }
        val finishedAt = clock.instant().truncatedTo(ChronoUnit.MICROS)
        when (outcome) {
            is ExportOutcome.Succeeded -> {
                repository.markSucceeded(team, startedAt, finishedAt, outcome.rows)
                observability.recordSucceeded(finishedAt, outcome.rows)
                log.info(
                    "BigQuery export finished for team {}: svar={}, innsendinger={}, fritekst={}",
                    team, outcome.rows.svar, outcome.rows.innsendinger, outcome.rows.fritekst,
                )
            }
            is ExportOutcome.Failed -> {
                repository.markFailed(team, startedAt, finishedAt, outcome.code)
                observability.recordFailed(outcome.code)
                log.warn("BigQuery export failed for team {}: {}", team, outcome.code)
            }
        }
        cleanUpIfDestinationChanged(gateway, destination)
    }

    private suspend fun export(
        gateway: BigQueryGateway,
        destination: BigQueryExportDestination,
        startedAt: Instant,
        lock: BigQueryExportLock,
    ): ExportOutcome {
        val team = destination.team
        val includeFreeText = destination.includeFreeText && env.allowsFreeText(team)
        val tables = exportedTables(includeFreeText)
        if (!includeFreeText) {
            freeTextRemovalProblem(gateway, team, destination)?.let { return ExportOutcome.Failed(it) }
        }
        checkExistingDestination(gateway, destination, tables).firstOrNull()?.let { return ExportOutcome.Failed(it.code) }
        earlierJobProblem(gateway, destination)?.let { return ExportOutcome.Failed(it) }

        val expiresAt = startedAt.plus(TABLE_LIFETIME)
        val specs = tables.associateWith { tableSpec(destination, it) }
        val jobLabels = mapOf(BIGQUERY_TEAM_LABEL to team, BIGQUERY_EXPORT_TABLE_LABEL to BIGQUERY_EXPORT_TABLE_LABEL_VALUE)

        // Missing tables are created first, so they carry labels and an expiry from the start. Load
        // jobs then only replace the rows, and access granted on the tables stays.
        val createdNow = mutableSetOf<BigQueryExportTable>()
        for ((table, spec) in specs) {
            when (val existing = gateway.getTable(spec.ref)) {
                is BigQueryResult.Success -> notLumiTable(existing.value, team)?.let { return ExportOutcome.Failed(it) }
                BigQueryResult.NotFound -> {
                    problemFor(gateway.createTable(spec, expiresAt), team, spec)?.let { return ExportOutcome.Failed(it) }
                    createdNow += table
                }
                else -> problemFor(existing, team, spec)?.let { return ExportOutcome.Failed(it) }
            }
        }

        val uploads = specs.mapValues { (_, spec) -> CountingUpload(gateway.startUpload(spec, jobLabels)) }
        val skipped = lock.readExportSnapshot(team, retentionMonths) { snapshot ->
            val mapper = BigQueryExportMapper(
                pseudonymKey = destination.pseudonymKey,
                includeFreeText = includeFreeText,
                exportedAt = startedAt,
            )
            snapshot.forEachRow { row ->
                val mapped = mapper.map(row) ?: return@forEachRow
                uploads.getValue(BigQueryExportTable.INNSENDINGER).write(json.encodeToString(InnsendingExportRow.serializer(), mapped.innsending))
                mapped.svar.forEach { uploads.getValue(BigQueryExportTable.SVAR).write(json.encodeToString(SvarExportRow.serializer(), it)) }
                uploads[BigQueryExportTable.FRITEKST]?.let { upload ->
                    mapped.fritekst.forEach { upload.write(json.encodeToString(FritekstExportRow.serializer(), it)) }
                }
            }
            Skipped(mapper.skippedSubmissions, mapper.skippedAnswers)
        }
        if (skipped.submissions > 0 || skipped.answers > 0) {
            log.info(
                "BigQuery export for team {} skipped {} malformed submissions and {} malformed answers",
                team, skipped.submissions, skipped.answers,
            )
        }

        // Tables are replaced one at a time, the most sensitive first, so a run that fails halfway
        // has already removed deleted free text.
        for ((table, upload) in uploads) {
            val spec = specs.getValue(table)
            // The table can have changed while Lumi read the responses. Lumi never writes to a table it did not create.
            when (val current = gateway.getTable(spec.ref)) {
                is BigQueryResult.Success -> notLumiTable(current.value, team)?.let { return ExportOutcome.Failed(it) }
                BigQueryResult.NotFound -> return ExportOutcome.Failed(BigQueryExportProblemCode.LOAD_FAILED)
                else -> problemFor(current, team, spec)?.let { return ExportOutcome.Failed(it) }
            }
            val loaded = when {
                upload.rows > 0 -> tracked(team, upload.jobId) { upload.finish() }
                table in createdNow -> BigQueryResult.Success(Unit)
                else -> newBigQueryJobId("truncate", table.tableId).let { jobId ->
                    tracked(team, jobId) { gateway.truncateTable(spec.ref, jobLabels, jobId) }
                }
            }
            problemFor(loaded, team, spec)?.let { return ExportOutcome.Failed(it) }
            problemFor(gateway.updateTableMetadata(spec, expiresAt), team, spec)?.let { return ExportOutcome.Failed(it) }
        }
        return ExportOutcome.Succeeded(
            BigQueryExportRowCounts(
                svar = uploads.getValue(BigQueryExportTable.SVAR).rows,
                innsendinger = uploads.getValue(BigQueryExportTable.INNSENDINGER).rows,
                fritekst = uploads[BigQueryExportTable.FRITEKST]?.rows,
            ),
        )
    }

    /**
     * Runs a job that can replace a table. Its id is stored first and only removed once Lumi has
     * seen the job finish. If the answer is lost or Lumi gives up, the next run finds the id and
     * waits for the job, so an old job cannot overwrite newer data or bring back deleted rows.
     */
    private suspend fun <T> tracked(team: String, jobId: String, job: suspend () -> BigQueryResult<T>): BigQueryResult<T> {
        if (!repository.addPendingJob(team, jobId)) {
            return BigQueryResult.Failure("The export for the team is gone, so job $jobId was not started")
        }
        return job().also { result -> if (result is BigQueryResult.Success) repository.removePendingJob(team, jobId) }
    }

    /**
     * Removes Lumi's `fritekst` table when free text is off or closed for the team. A removal that
     * fails, fails the run, so the status does not say the export is fine while free text remains.
     */
    private suspend fun freeTextRemovalProblem(
        gateway: BigQueryGateway,
        team: String,
        destination: BigQueryExportDestination,
    ): BigQueryExportProblemCode? {
        val ref = BigQueryTableRef(destination.projectId, destination.datasetId, BigQueryExportTable.FRITEKST.tableId)
        val removed = when (val existing = gateway.getTable(ref)) {
            is BigQueryResult.Success -> if (existing.value.isLumiTableFor(team)) gateway.deleteTable(ref) else return null
            BigQueryResult.NotFound -> return null
            BigQueryResult.AccessDenied -> return BigQueryExportProblemCode.DATASET_ACCESS_DENIED
            else -> existing
        }
        return when (removed) {
            is BigQueryResult.Success, BigQueryResult.NotFound -> null
            BigQueryResult.AccessDenied -> BigQueryExportProblemCode.TABLE_WRITE_DENIED
            else -> {
                log.warn("BigQuery export for team {} could not remove the fritekst table: {}", team, removed)
                BigQueryExportProblemCode.FREE_TEXT_NOT_REMOVED
            }
        }
    }

    /** Waits for jobs from earlier runs that Lumi did not see finish. Null when all are done. */
    private suspend fun earlierJobProblem(gateway: BigQueryGateway, destination: BigQueryExportDestination): BigQueryExportProblemCode? {
        for (jobId in destination.pendingJobIds) {
            when (val state = gateway.jobState(jobId)) {
                is BigQueryResult.Success -> if (state.value == BigQueryJobState.DONE) {
                    repository.removePendingJob(destination.team, jobId)
                } else {
                    log.warn("BigQuery export for team {} waits for job {}, which is {}", destination.team, jobId, state.value)
                    return BigQueryExportProblemCode.LOAD_FAILED
                }
                // BigQuery never started it, for example when the upload did not finish.
                BigQueryResult.NotFound -> repository.removePendingJob(destination.team, jobId)
                BigQueryResult.JobDenied, BigQueryResult.AccessDenied -> return BigQueryExportProblemCode.EXPORT_JOB_DENIED
                is BigQueryResult.Failure -> {
                    log.warn("BigQuery export for team {} could not look up job {}: {}", destination.team, jobId, state.message)
                    return BigQueryExportProblemCode.BIGQUERY_UNAVAILABLE
                }
            }
        }
        return null
    }

    private fun notLumiTable(table: BigQueryTableInfo, team: String): BigQueryExportProblemCode? =
        if (table.isLumiTableFor(team)) null else BigQueryExportProblemCode.TABLE_NOT_CREATED_BY_LUMI

    /** Maps a failed write to a problem code, and logs what the team cannot see. */
    private fun problemFor(result: BigQueryResult<*>, team: String, spec: BigQueryTableSpec): BigQueryExportProblemCode? =
        when (result) {
            is BigQueryResult.Success -> null
            BigQueryResult.AccessDenied -> BigQueryExportProblemCode.TABLE_WRITE_DENIED
            BigQueryResult.NotFound -> BigQueryExportProblemCode.DATASET_NOT_FOUND
            BigQueryResult.JobDenied -> BigQueryExportProblemCode.EXPORT_JOB_DENIED
            is BigQueryResult.Failure -> {
                log.warn("BigQuery write for team {} table {} failed: {}", team, spec.ref.tableId, result.message)
                BigQueryExportProblemCode.LOAD_FAILED
            }
        }

    /**
     * Checks a destination before it is saved. Besides the checks before every run, the dataset
     * must be used for Lumi only and accept a new table.
     */
    private suspend fun checkNewDestination(
        gateway: BigQueryGateway,
        team: String,
        projectId: String,
        datasetId: String,
        includeFreeText: Boolean,
    ): List<BigQueryExportProblem> {
        checkTeamProject(team, projectId)?.let { return listOf(it) }
        when (val jobAccess = gateway.checkJobAccess()) {
            is BigQueryResult.Success -> Unit
            BigQueryResult.JobDenied, BigQueryResult.AccessDenied, BigQueryResult.NotFound ->
                return listOf(BigQueryExportProblem(BigQueryExportProblemCode.EXPORT_JOB_DENIED))
            is BigQueryResult.Failure -> {
                log.warn("BigQuery job check for team {} failed: {}", team, jobAccess.message)
                return listOf(BigQueryExportProblem(BigQueryExportProblemCode.BIGQUERY_UNAVAILABLE))
            }
        }
        val dataset = when (val result = readDataset(gateway, team, projectId, datasetId)) {
            is DatasetCheck.Problem -> return listOf(result.problem)
            is DatasetCheck.Found -> result
        }
        datasetProblems(team, dataset).takeIf { it.isNotEmpty() }?.let { return it }

        // Lumi can write to every table in the dataset, so the dataset must hold Lumi's tables only.
        // Views are fine: teams share filtered views of Lumi's tables.
        when (val listed = gateway.listTables(projectId, datasetId)) {
            is BigQueryResult.Success -> {
                listed.value.tables
                    .firstOrNull { it.type != "VIEW" && !BigQueryTableInfo(it.labels).isLumiTableFor(team) }
                    ?.let { return listOf(BigQueryExportProblem(BigQueryExportProblemCode.DATASET_NOT_DEDICATED, it.tableId)) }
                if (!listed.value.complete) {
                    return listOf(BigQueryExportProblem(BigQueryExportProblemCode.DATASET_NOT_DEDICATED))
                }
            }
            BigQueryResult.AccessDenied, BigQueryResult.JobDenied ->
                return listOf(BigQueryExportProblem(BigQueryExportProblemCode.DATASET_ACCESS_DENIED))
            BigQueryResult.NotFound -> return listOf(BigQueryExportProblem(BigQueryExportProblemCode.DATASET_NOT_FOUND))
            is BigQueryResult.Failure -> {
                log.warn("BigQuery table listing for team {} failed: {}", team, listed.message)
                return listOf(BigQueryExportProblem(BigQueryExportProblemCode.BIGQUERY_UNAVAILABLE))
            }
        }
        tableProblems(gateway, team, projectId, datasetId, exportedTables(includeFreeText)).takeIf { it.isNotEmpty() }?.let { return it }
        return probeWrite(gateway, team, projectId, datasetId)
    }

    /** The checks before every run: project, dataset, label, location, time travel and Lumi's own tables. */
    private suspend fun checkExistingDestination(
        gateway: BigQueryGateway,
        destination: BigQueryExportDestination,
        tables: List<BigQueryExportTable>,
    ): List<BigQueryExportProblem> {
        val team = destination.team
        checkTeamProject(team, destination.projectId)?.let { return listOf(it) }
        if (gateway.checkJobAccess() is BigQueryResult.JobDenied) {
            return listOf(BigQueryExportProblem(BigQueryExportProblemCode.EXPORT_JOB_DENIED))
        }
        val dataset = when (val result = readDataset(gateway, team, destination.projectId, destination.datasetId)) {
            is DatasetCheck.Problem -> return listOf(result.problem)
            is DatasetCheck.Found -> result
        }
        datasetProblems(team, dataset).takeIf { it.isNotEmpty() }?.let { return it }
        return tableProblems(gateway, team, destination.projectId, destination.datasetId, tables)
    }

    /** Fails closed: without an answer from Nais, Lumi cannot know that the project is the team's own. */
    private suspend fun checkTeamProject(team: String, projectId: String): BigQueryExportProblem? {
        val lookup = teamProjects ?: return BigQueryExportProblem(BigQueryExportProblemCode.TEAM_PROJECT_UNKNOWN)
        return when (val expected = lookup.projectFor(team)) {
            is NaisApiResult.Success -> when (expected.value) {
                projectId -> null
                // No project for this environment points at Lumi's setup, such as the cluster name.
                null -> {
                    log.warn("Nais API has no GCP project for team {} in this environment", team)
                    BigQueryExportProblem(BigQueryExportProblemCode.TEAM_PROJECT_UNKNOWN)
                }
                else -> BigQueryExportProblem(BigQueryExportProblemCode.PROJECT_NOT_TEAM_PROJECT, expected.value)
            }
            is NaisApiResult.Error -> {
                log.warn("Could not look up the GCP project for team {}", team)
                BigQueryExportProblem(BigQueryExportProblemCode.TEAM_PROJECT_UNKNOWN)
            }
        }
    }

    private suspend fun readDataset(gateway: BigQueryGateway, team: String, projectId: String, datasetId: String): DatasetCheck =
        when (val result = gateway.getDataset(projectId, datasetId)) {
            is BigQueryResult.Success -> DatasetCheck.Found(result.value)
            BigQueryResult.NotFound -> DatasetCheck.Problem(BigQueryExportProblem(BigQueryExportProblemCode.DATASET_NOT_FOUND))
            BigQueryResult.AccessDenied, BigQueryResult.JobDenied ->
                DatasetCheck.Problem(BigQueryExportProblem(BigQueryExportProblemCode.DATASET_ACCESS_DENIED))
            is BigQueryResult.Failure -> {
                log.warn("BigQuery dataset lookup for team {} failed: {}", team, result.message)
                DatasetCheck.Problem(BigQueryExportProblem(BigQueryExportProblemCode.BIGQUERY_UNAVAILABLE))
            }
        }

    private fun datasetProblems(team: String, dataset: DatasetCheck.Found): List<BigQueryExportProblem> = buildList {
        val location = dataset.info.location
        if (!location.equals(env.location, ignoreCase = true)) {
            add(BigQueryExportProblem(BigQueryExportProblemCode.DATASET_WRONG_LOCATION, location))
        }
        when (val label = dataset.info.labels[BIGQUERY_TEAM_LABEL]) {
            null -> add(BigQueryExportProblem(BigQueryExportProblemCode.DATASET_TEAM_LABEL_MISSING))
            team -> Unit
            else -> add(BigQueryExportProblem(BigQueryExportProblemCode.DATASET_TEAM_LABEL_MISMATCH, label))
        }
        // The guide promises that deleted rows are gone from BigQuery 48 hours after a run.
        val timeTravelHours = dataset.info.maxTimeTravelHours ?: DEFAULT_TIME_TRAVEL_HOURS
        if (timeTravelHours > BIGQUERY_MAX_TIME_TRAVEL_HOURS) {
            add(BigQueryExportProblem(BigQueryExportProblemCode.DATASET_TIME_TRAVEL_TOO_LONG, timeTravelHours.toString()))
        }
    }

    /** Lumi only writes to tables that do not exist yet or that it created for this team. */
    private suspend fun tableProblems(
        gateway: BigQueryGateway,
        team: String,
        projectId: String,
        datasetId: String,
        tables: List<BigQueryExportTable>,
    ): List<BigQueryExportProblem> {
        val problems = mutableListOf<BigQueryExportProblem>()
        for (table in tables) {
            when (val existing = gateway.getTable(BigQueryTableRef(projectId, datasetId, table.tableId))) {
                is BigQueryResult.Success -> if (!existing.value.isLumiTableFor(team)) {
                    problems += BigQueryExportProblem(BigQueryExportProblemCode.TABLE_NOT_CREATED_BY_LUMI, table.tableId)
                }
                BigQueryResult.NotFound -> Unit
                BigQueryResult.AccessDenied, BigQueryResult.JobDenied ->
                    return listOf(BigQueryExportProblem(BigQueryExportProblemCode.DATASET_ACCESS_DENIED))
                is BigQueryResult.Failure -> {
                    log.warn("BigQuery table lookup for team {} failed: {}", team, existing.message)
                    return listOf(BigQueryExportProblem(BigQueryExportProblemCode.BIGQUERY_UNAVAILABLE))
                }
            }
        }
        return problems
    }

    /** Creates and deletes a short-lived table, the only reliable way to see that Lumi can create tables. */
    private suspend fun probeWrite(
        gateway: BigQueryGateway,
        team: String,
        projectId: String,
        datasetId: String,
    ): List<BigQueryExportProblem> {
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
            BigQueryResult.AccessDenied, BigQueryResult.JobDenied ->
                listOf(BigQueryExportProblem(BigQueryExportProblemCode.TABLE_WRITE_DENIED))
            BigQueryResult.NotFound -> listOf(BigQueryExportProblem(BigQueryExportProblemCode.DATASET_NOT_FOUND))
            is BigQueryResult.Failure -> {
                log.warn("BigQuery write probe for team {} failed: {}", team, created.message)
                listOf(BigQueryExportProblem(BigQueryExportProblemCode.BIGQUERY_UNAVAILABLE))
            }
        }
    }

    /**
     * Deletes Lumi's own tables for the team, and tries every table. Tables Lumi did not write for
     * the team are left alone.
     */
    private suspend fun removeLumiTables(
        gateway: BigQueryGateway,
        team: String,
        projectId: String,
        datasetId: String,
        tables: List<BigQueryExportTable>,
    ): TableRemoval {
        val results = tables.map { table ->
            val ref = BigQueryTableRef(projectId, datasetId, table.tableId)
            val removed = when (val existing = gateway.getTable(ref)) {
                is BigQueryResult.Success -> if (existing.value.isLumiTableFor(team)) gateway.deleteTable(ref) else existing
                else -> existing
            }
            when (removed) {
                is BigQueryResult.Success, BigQueryResult.NotFound -> TableRemoval.REMOVED
                BigQueryResult.AccessDenied, BigQueryResult.JobDenied -> TableRemoval.NO_ACCESS
                is BigQueryResult.Failure -> TableRemoval.FAILED
            }
        }
        return when {
            TableRemoval.FAILED in results -> TableRemoval.FAILED
            TableRemoval.NO_ACCESS in results -> TableRemoval.NO_ACCESS
            else -> TableRemoval.REMOVED
        }
    }

    /**
     * If the team moved the export or turned free text off during a run, the tables the run should
     * no longer have written are removed. If a removal fails, the tables expire, or the next run
     * removes `fritekst`. A stop is finished by [finishStop] once the run is over.
     */
    private suspend fun cleanUpIfDestinationChanged(gateway: BigQueryGateway, written: BigQueryExportDestination) {
        val current = repository.find(written.team)
        when {
            current?.stopRequestedAt != null -> Unit
            current == null || current.projectId != written.projectId || current.datasetId != written.datasetId ->
                removeLumiTables(gateway, written.team, written.projectId, written.datasetId, BigQueryExportTable.entries)
            written.includeFreeText && !current.includeFreeText ->
                removeLumiTables(gateway, written.team, written.projectId, written.datasetId, listOf(BigQueryExportTable.FRITEKST))
        }
    }

    private suspend fun teamProject(team: String): String? =
        when (val result = teamProjects?.projectFor(team)) {
            is NaisApiResult.Success -> result.value
            else -> null
        }

    private fun enabledGateway(): BigQueryGateway? = gateway?.takeIf { env.enabled && teamProjects != null }

    private fun gatewayFor(team: String): BigQueryGateway? = enabledGateway()?.takeIf { env.isOpenFor(team) }

    /** The order the tables are replaced in: the most sensitive first. */
    private fun exportedTables(includeFreeText: Boolean): List<BigQueryExportTable> = buildList {
        if (includeFreeText) add(BigQueryExportTable.FRITEKST)
        add(BigQueryExportTable.INNSENDINGER)
        add(BigQueryExportTable.SVAR)
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
        stopping = stopRequestedAt != null,
    )

    private fun List<BigQueryExportProblem>.toResponse() = BigQueryExportVerificationResponse(
        ok = isEmpty(),
        problems = map { BigQueryExportProblemDto(it.code, it.detail) },
    )

    private fun validateIds(projectId: String, datasetId: String) {
        require(BIGQUERY_PROJECT_ID_PATTERN.matches(projectId)) { "Invalid GCP project id" }
        require(BIGQUERY_DATASET_ID_PATTERN.matches(datasetId)) { "Invalid BigQuery dataset id" }
    }

    /** A table Lumi created for this team: it has Lumi's label and the team's label. */
    private fun BigQueryTableInfo.isLumiTableFor(team: String): Boolean =
        labels[BIGQUERY_EXPORT_TABLE_LABEL] != null && labels[BIGQUERY_TEAM_LABEL] == team

    /** NO_ACCESS: Lumi has lost access to some of the tables, which then expire on their own. */
    private enum class TableRemoval { REMOVED, NO_ACCESS, FAILED }

    private enum class StopOutcome { TABLES_REMOVED, TABLES_LEFT, NOT_FINISHED }

    private sealed interface DatasetCheck {
        data class Found(val info: BigQueryDatasetInfo) : DatasetCheck
        data class Problem(val problem: BigQueryExportProblem) : DatasetCheck
    }

    private data class Skipped(val submissions: Long, val answers: Long)

    private sealed interface ExportOutcome {
        data class Succeeded(val rows: BigQueryExportRowCounts) : ExportOutcome
        data class Failed(val code: BigQueryExportProblemCode) : ExportOutcome
    }

    private class CountingUpload(private val upload: BigQueryTableUpload) {
        val jobId: String get() = upload.jobId
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
            BigQueryResult.JobDenied -> BigQueryResult.JobDenied
            is BigQueryResult.Failure -> result
        }
    }

    companion object {
        /** Tables expire unless a run renews them, so data disappears even if Lumi stops exporting. */
        val TABLE_LIFETIME: Duration = Duration.ofDays(7)
        private val PROBE_LIFETIME: Duration = Duration.ofHours(1)

        /**
         * A stop that has waited this long finishes even if BigQuery does not answer. By then every
         * job Lumi started has ended: a run lasts at most half an hour, and BigQuery ends a job
         * within a day, queue and retries included. Tables Lumi could not delete expire on their
         * own, since no run renews them.
         */
        private val STOP_MAX_WAIT: Duration = Duration.ofHours(48)

        /** BigQuery keeps deleted rows for seven days when a dataset does not say otherwise. */
        private const val DEFAULT_TIME_TRAVEL_HOURS = 168
        private val json = Json { explicitNulls = false }
    }
}
