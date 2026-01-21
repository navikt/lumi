package no.nav.lumi.config

/**
 * Centralized Valkey/Redis configuration.
 *
 * NAIS Valkey exposes env vars on the form `VALKEY_URI_<instance>` (and legacy `REDIS_*`).
 * For Lumi we currently use the instance name `lumi-cache` -> `LUMI_CACHE`.
 */
data class ValkeyEnv(
    val uri: String?,
    val username: String?,
    val password: String?,
) {
    val isConfigured: Boolean get() = !uri.isNullOrBlank()

    companion object {
        fun fromEnvironment(): ValkeyEnv {
            val uri = System.getenv("VALKEY_URI_LUMI_CACHE")
                ?: System.getenv("REDIS_URI_LUMI_CACHE")

            val username = System.getenv("VALKEY_USERNAME_LUMI_CACHE")
                ?: System.getenv("REDIS_USERNAME_LUMI_CACHE")

            val password = System.getenv("VALKEY_PASSWORD_LUMI_CACHE")
                ?: System.getenv("REDIS_PASSWORD_LUMI_CACHE")

            return ValkeyEnv(
                uri = uri,
                username = username,
                password = password,
            )
        }

        fun forLocal(): ValkeyEnv = fromEnvironment()
    }
}
