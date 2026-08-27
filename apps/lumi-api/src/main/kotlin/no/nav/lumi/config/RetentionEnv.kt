package no.nav.lumi.config

data class RetentionEnv(
    val enabled: Boolean,
) {
    companion object {
        private const val ENABLED_ENV = "LUMI_RETENTION_ENABLED"

        fun fromEnvironment(
            configuredValue: String? = System.getenv(ENABLED_ENV),
        ): RetentionEnv = RetentionEnv(
            enabled = when (configuredValue?.lowercase()) {
                null, "false" -> false
                "true" -> true
                else -> throw IllegalStateException("$ENABLED_ENV must be 'true' or 'false'")
            },
        )

        fun disabled(): RetentionEnv = RetentionEnv(enabled = false)
    }
}
