package no.nav.lumi.config

data class RateLimitEnv(
    val globalRequestsPerSourcePerMinute: Int,
) {
    companion object {
        private const val DEFAULT_GLOBAL_REQUESTS_PER_SOURCE_PER_MINUTE = 10_000
        private const val GLOBAL_REQUESTS_PER_SOURCE_PER_MINUTE_ENV =
            "LUMI_GLOBAL_REQUESTS_PER_SOURCE_PER_MINUTE"

        fun fromEnvironment(
            configuredValue: String? = System.getenv(GLOBAL_REQUESTS_PER_SOURCE_PER_MINUTE_ENV),
        ): RateLimitEnv {
            if (configuredValue == null) return default()

            val requestsPerMinute = configuredValue.toIntOrNull()?.takeIf { it > 0 }
                ?: throw IllegalStateException(
                    "$GLOBAL_REQUESTS_PER_SOURCE_PER_MINUTE_ENV must be a positive integer"
                )

            return RateLimitEnv(requestsPerMinute)
        }

        fun default(): RateLimitEnv =
            RateLimitEnv(DEFAULT_GLOBAL_REQUESTS_PER_SOURCE_PER_MINUTE)
    }
}
