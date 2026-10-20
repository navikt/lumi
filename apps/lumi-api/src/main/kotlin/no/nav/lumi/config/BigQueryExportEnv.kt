package no.nav.lumi.config

/**
 * Configuration for BigQuery export to team-owned datasets (ADR 0007).
 *
 * The export is opt-in per environment. When enabled, Lumi runs BigQuery load jobs in its own
 * team project, so the project id must be known. Nais sets both `GCP_TEAM_PROJECT_ID` and
 * `GOOGLE_CLOUD_PROJECT` to the team project for every GCP workload.
 */
data class BigQueryExportEnv(
    val enabled: Boolean,
    /** GCP project where Lumi creates load jobs. Null when the export is disabled. */
    val jobProjectId: String?,
    /** Location for datasets and jobs. Nav keeps analysis data in europe-north1. */
    val location: String = DEFAULT_LOCATION,
    /** Teams that may use the export during a pilot. Null opens the export for every team. */
    val pilotTeams: Set<String>? = null,
    /**
     * Teams that may export free text. Null allows every team. Free text can hold names and health
     * data, so it stays closed for a team until its PVK covers free text in BigQuery.
     */
    val freeTextTeams: Set<String>? = emptySet(),
) {
    fun isOpenFor(team: String): Boolean = enabled && (pilotTeams == null || team in pilotTeams)

    fun allowsFreeText(team: String): Boolean = isOpenFor(team) && (freeTextTeams == null || team in freeTextTeams)

    companion object {
        private const val ENABLED_ENV = "LUMI_BIGQUERY_EXPORT_ENABLED"
        private const val PILOT_TEAMS_ENV = "LUMI_BIGQUERY_EXPORT_PILOT_TEAMS"
        private const val FREE_TEXT_TEAMS_ENV = "LUMI_BIGQUERY_EXPORT_FREE_TEXT_TEAMS"
        private const val ALL_TEAMS = "*"
        private const val TEAM_PROJECT_ENV = "GCP_TEAM_PROJECT_ID"
        private const val GOOGLE_PROJECT_ENV = "GOOGLE_CLOUD_PROJECT"
        const val DEFAULT_LOCATION = "europe-north1"

        fun fromEnvironment(
            enabledValue: String? = System.getenv(ENABLED_ENV),
            teamProjectValue: String? = System.getenv(TEAM_PROJECT_ENV),
            googleProjectValue: String? = System.getenv(GOOGLE_PROJECT_ENV),
            pilotTeamsValue: String? = System.getenv(PILOT_TEAMS_ENV),
            freeTextTeamsValue: String? = System.getenv(FREE_TEXT_TEAMS_ENV),
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
            val pilotTeams = teamList(pilotTeamsValue).takeIf { it.isNotEmpty() }
            // Unset means no team: free text is closed unless a team is listed, or "*" opens it for all.
            val freeTextTeams = teamList(freeTextTeamsValue).takeUnless { ALL_TEAMS in it }
            return BigQueryExportEnv(
                enabled = true,
                jobProjectId = projectId,
                pilotTeams = pilotTeams,
                freeTextTeams = freeTextTeams,
            )
        }

        private fun teamList(value: String?): Set<String> =
            value?.split(',')?.map { it.trim() }?.filter { it.isNotEmpty() }?.toSet().orEmpty()

        fun disabled(): BigQueryExportEnv = BigQueryExportEnv(enabled = false, jobProjectId = null)
    }
}
