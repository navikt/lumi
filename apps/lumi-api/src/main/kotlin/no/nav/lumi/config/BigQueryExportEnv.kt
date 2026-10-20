package no.nav.lumi.config

/**
 * Configuration for BigQuery export to team-owned datasets (ADR 0007).
 *
 * The export is opt-in per environment. When enabled, Lumi runs BigQuery load jobs in its own
 * team project, so the project id must be known. Nais sets `GOOGLE_CLOUD_PROJECT` for every
 * workload, and `GCP_TEAM_PROJECT_ID` for workloads that use BigQuery.
 */
data class BigQueryExportEnv(
    val enabled: Boolean,
    /** GCP project where Lumi creates load jobs. Null when the export is disabled. */
    val jobProjectId: String?,
    /** Location for datasets and jobs. Nav keeps analysis data in europe-north1. */
    val location: String = DEFAULT_LOCATION,
    /** Teams that may use the export during a pilot. Null opens the export for every team. */
    val pilotTeams: Set<String>? = null,
) {
    fun isOpenFor(team: String): Boolean = enabled && (pilotTeams == null || team in pilotTeams)

    companion object {
        private const val ENABLED_ENV = "LUMI_BIGQUERY_EXPORT_ENABLED"
        private const val PILOT_TEAMS_ENV = "LUMI_BIGQUERY_EXPORT_PILOT_TEAMS"
        private const val TEAM_PROJECT_ENV = "GCP_TEAM_PROJECT_ID"
        private const val GOOGLE_PROJECT_ENV = "GOOGLE_CLOUD_PROJECT"
        const val DEFAULT_LOCATION = "europe-north1"

        fun fromEnvironment(
            enabledValue: String? = System.getenv(ENABLED_ENV),
            teamProjectValue: String? = System.getenv(TEAM_PROJECT_ENV),
            googleProjectValue: String? = System.getenv(GOOGLE_PROJECT_ENV),
            pilotTeamsValue: String? = System.getenv(PILOT_TEAMS_ENV),
        ): BigQueryExportEnv {
            val enabled = when (enabledValue?.lowercase()) {
                null, "false" -> false
                "true" -> true
                else -> throw IllegalStateException("$ENABLED_ENV must be 'true' or 'false'")
            }
            if (!enabled) return disabled()

            val projectId = listOf(teamProjectValue, googleProjectValue)
                .firstNotNullOfOrNull { value -> value?.trim()?.takeIf { it.isNotEmpty() } }
                ?: throw IllegalStateException(
                    "$ENABLED_ENV is true, but neither $TEAM_PROJECT_ENV nor $GOOGLE_PROJECT_ENV is set",
                )
            val pilotTeams = pilotTeamsValue
                ?.split(',')
                ?.map { it.trim() }
                ?.filter { it.isNotEmpty() }
                ?.toSet()
                ?.takeIf { it.isNotEmpty() }
            return BigQueryExportEnv(enabled = true, jobProjectId = projectId, pilotTeams = pilotTeams)
        }

        fun disabled(): BigQueryExportEnv = BigQueryExportEnv(enabled = false, jobProjectId = null)
    }
}
