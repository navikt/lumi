package no.nav.lumi.config

import io.ktor.server.application.Application
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import no.nav.lumi.integrations.bigquery.GoogleMetadataCredentials
import no.nav.lumi.integrations.bigquery.RestBigQueryGateway
import no.nav.lumi.integrations.nais.NaisGraphQlClient
import no.nav.lumi.integrations.valkey.InMemoryTeamCache
import no.nav.lumi.repository.BigQueryExportRepository
import no.nav.lumi.service.BigQueryExportService
import no.nav.lumi.service.TeamProjectLookup
import org.slf4j.LoggerFactory
import java.time.Duration

private val bigQueryExportLog = LoggerFactory.getLogger("BigQueryExport")

/** One export service per process, shared by the routes and the scheduler. */
object BigQueryExportComponents {
    val service: BigQueryExportService by lazy { create(ServerEnv.current) }

    fun create(env: ServerEnv): BigQueryExportService {
        val config = env.bigQueryExport
        val gateway = config.jobProjectId?.takeIf { config.enabled }?.let { jobProjectId ->
            val client = RestBigQueryGateway.defaultHttpClient()
            RestBigQueryGateway(
                credentials = GoogleMetadataCredentials(client),
                jobProjectId = jobProjectId,
                location = config.location,
                client = client,
            )
        }
        val clusterName = env.nais.clusterName
        val naisClient = gateway?.let {
            NaisGraphQlClient.fromConfig(
                graphqlUrl = env.naisApi.graphqlUrl,
                tokenPath = env.naisApi.tokenPath,
                staticKey = env.naisApi.staticKey,
                isNaisEnvironment = env.nais.isNais,
                teamCache = InMemoryTeamCache(),
            )
        }
        val teamProjects = if (naisClient != null && clusterName != null) {
            TeamProjectLookup { team -> naisClient.getTeamGcpProjectIdResult(team, clusterName) }
        } else {
            null
        }
        return BigQueryExportService(
            env = config,
            repository = BigQueryExportRepository(),
            gateway = gateway,
            teamProjects = teamProjects,
            observability = BigQueryExportObservability(enabled = config.enabled),
        )
    }
}

/**
 * Starts the BigQuery export scheduler. Every replica polls, and the export lock in the database
 * makes sure only one of them exports at a time.
 */
fun Application.configureBigQueryExport(
    config: BigQueryExportEnv = ServerEnv.current.bigQueryExport,
    service: () -> BigQueryExportService = { BigQueryExportComponents.service },
    pollInterval: Duration = Duration.ofSeconds(30),
) {
    if (!ServerEnv.current.nais.isNais) {
        bigQueryExportLog.info("BigQuery export scheduler is disabled outside NAIS")
        return
    }
    if (!config.enabled) {
        bigQueryExportLog.info("BigQuery export scheduler is disabled by configuration")
        return
    }

    val exportService = service()
    launch {
        while (isActive) {
            try {
                withContext(Dispatchers.IO) { exportService.runDueExports() }
            } catch (cause: CancellationException) {
                throw cause
            } catch (cause: Exception) {
                bigQueryExportLog.error("BigQuery export scheduler run failed", cause)
            }
            delay(pollInterval.toMillis())
        }
    }
}
