package no.nav.lumi.config

/**
 * Upper limits for the main pool and the submission pool in one pod. The
 * readiness pool always has one connection.
 *
 * The defaults fit prod. Dev runs on the smallest Cloud SQL instance, which
 * allows 25 connections in total, and sets lower values in nais/app/dev.yaml.
 */
data class DatabasePoolEnv(
    val mainPoolSize: Int,
    val submissionPoolSize: Int,
) {
    /** The most connections one pod can open, readiness included. */
    val connectionsPerPod: Int
        get() = mainPoolSize + submissionPoolSize + READINESS_POOL_SIZE

    companion object {
        const val READINESS_POOL_SIZE = 1
        const val DEFAULT_MAIN_POOL_SIZE = 8
        const val DEFAULT_SUBMISSION_POOL_SIZE = 4
        const val MAIN_POOL_SIZE_ENV = "LUMI_DB_MAIN_POOL_SIZE"
        const val SUBMISSION_POOL_SIZE_ENV = "LUMI_DB_SUBMISSION_POOL_SIZE"

        // Both pools keep two idle connections, so a smaller pool would only
        // shrink the idle count without saying so.
        private const val MINIMUM_POOL_SIZE = 2

        fun fromEnvironment(
            mainPoolSize: String? = System.getenv(MAIN_POOL_SIZE_ENV),
            submissionPoolSize: String? = System.getenv(SUBMISSION_POOL_SIZE_ENV),
        ): DatabasePoolEnv = DatabasePoolEnv(
            mainPoolSize = parse(MAIN_POOL_SIZE_ENV, mainPoolSize, DEFAULT_MAIN_POOL_SIZE),
            submissionPoolSize = parse(SUBMISSION_POOL_SIZE_ENV, submissionPoolSize, DEFAULT_SUBMISSION_POOL_SIZE),
        )

        fun default(): DatabasePoolEnv =
            DatabasePoolEnv(DEFAULT_MAIN_POOL_SIZE, DEFAULT_SUBMISSION_POOL_SIZE)

        private fun parse(name: String, value: String?, default: Int): Int {
            if (value == null) return default
            return value.toIntOrNull()?.takeIf { it >= MINIMUM_POOL_SIZE }
                ?: throw IllegalStateException("$name must be an integer of at least $MINIMUM_POOL_SIZE")
        }
    }
}
