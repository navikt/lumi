package no.nav.lumi.config

import org.slf4j.LoggerFactory

/**
 * Type-safe environment configuration for the application.
 * 
 * All environment variables are validated at startup - the application
 * will fail fast if required variables are missing in production.
 * 
 * Local development uses explicit defaults via [forLocal].
 */
data class ServerEnv(
    val database: DatabaseEnv,
    val nais: NaisEnv,
    val auth: AuthEnv,
    val valkey: ValkeyEnv,
    val naisApi: NaisApiEnv,
    val rateLimit: RateLimitEnv,
    val retention: RetentionEnv,
) {
    /**
     * Database connection configuration.
     * NAIS provides these with envVarPrefix: DB
     */
    data class DatabaseEnv(
        /** Complete JDBC URL with SSL certificates (NAIS-provided) */
        val jdbcUrl: String?,
        val host: String,
        val port: Int,
        val database: String,
        val username: String,
        val password: String
    ) {
        /**
         * Returns the JDBC URL to use for database connection.
         * Prefers NAIS-provided URL (includes SSL certs), falls back to constructed URL.
         */
        fun getConnectionUrl(): String {
            return jdbcUrl ?: "jdbc:postgresql://$host:$port/$database"
        }
        
        companion object {
            /**
             * Load from NAIS environment variables.
             * Requires DB_USERNAME and DB_PASSWORD to be set.
             */
            fun fromNais(): DatabaseEnv {
                return DatabaseEnv(
                    jdbcUrl = requireEnv("DB_JDBC_URL"),
                    host = requireEnv("DB_HOST"),
                    port = requireEnv("DB_PORT").toInt(),
                    database = requireEnv("DB_DATABASE"),
                    username = requireEnv("DB_USERNAME"),
                    password = requireEnv("DB_PASSWORD")
                )
            }
            
            /**
             * Configuration for local development with Docker Compose or local Postgres.
             *
             * Reads standard DB_* env vars (same names as NAIS) so the API can run
             * inside docker-compose pointing at the `postgres` service, while plain
             * `./gradlew run` on the host falls back to localhost defaults.
             */
            fun forLocal(
                host: String = System.getenv("DB_HOST") ?: "localhost",
                port: Int = System.getenv("DB_PORT")?.let {
                    it.toIntOrNull()
                        ?: throw IllegalStateException("DB_PORT is set but not a valid integer: '$it'")
                } ?: 5432,
                database: String = System.getenv("DB_DATABASE") ?: "lumi",
                username: String = System.getenv("DB_USERNAME") ?: "lumi",
                password: String = System.getenv("DB_PASSWORD") ?: "lumi"
            ) = DatabaseEnv(
                jdbcUrl = null,
                host = host,
                port = port,
                database = database,
                username = username,
                password = password
            )
            
            private fun requireEnv(name: String): String =
                System.getenv(name) ?: throw IllegalStateException("Required env var $name is not set")
        }
    }
    
    /**
     * NAIS platform environment configuration.
     */
    data class NaisEnv(
        /** Current cluster: dev-gcp, prod-gcp, or null for local */
        val clusterName: String?,
        /** Token introspection endpoint for Texas sidecar */
        val tokenIntrospectionEndpoint: String?
    ) {
        val isLocal: Boolean get() = clusterName == null
        val isDev: Boolean get() = clusterName == "dev-gcp"
        val isProd: Boolean get() = clusterName == "prod-gcp"
        val isNais: Boolean get() = clusterName != null
        
        companion object {
            fun fromEnvironment() = NaisEnv(
                clusterName = System.getenv("NAIS_CLUSTER_NAME"),
                tokenIntrospectionEndpoint = System.getenv("NAIS_TOKEN_INTROSPECTION_ENDPOINT")
            )
            
            fun forLocal() = NaisEnv(
                clusterName = null,
                tokenIntrospectionEndpoint = null
            )
        }
    }
    
    /**
     * Authentication configuration.
     */
    data class AuthEnv(
        /** Allowed client ID for Lumi dashboard (frontend) */
        val dashboardClientId: String,
    ) {
        companion object {
            fun fromEnvironment(clusterName: String?) = AuthEnv(
                dashboardClientId =
                    System.getenv("LUMI_DASHBOARD_CLIENT_ID")
                        ?: "${clusterName ?: "dev-gcp"}:team-esyfo:lumi-dashboard",
            )
            
            fun forLocal() = AuthEnv(
                dashboardClientId = "dev-gcp:team-esyfo:lumi-dashboard",
            )
        }
    }

    /**
     * NAIS Console API integration (team-authorization lookups).
     *
     * Env reading lives here so [no.nav.lumi.integrations.nais.NaisGraphQlClient] receives its
     * configuration injected instead of calling `System.getenv` itself. Note: the workload-bound
     * token is referenced by *path* (re-read on every call by the client to honor NAIS's in-place
     * rotation), never as the resolved token string — reading it once here would break rotation.
     */
    data class NaisApiEnv(
        /** GraphQL endpoint, e.g. https://console.nav.cloud.nais.io/graphql */
        val graphqlUrl: String?,
        /** Path to the workload-bound, auto-rotated token file (NAIS, preferred). */
        val tokenPath: String?,
        /** Static API key — only honored outside NAIS for local development (e.g. `nais api proxy`). */
        val staticKey: String?,
    ) {
        companion object {
            fun fromEnvironment() = NaisApiEnv(
                // Support both our naming and the convention used by e.g. appsec-notifiers.
                graphqlUrl = envOrNull("NAIS_API_GRAPHQL_URL") ?: envOrNull("NAIS_API_ENDPOINT"),
                tokenPath = envOrNull("NAIS_SERVICE_ACCOUNT_TOKEN_PATH"),
                staticKey = envOrNull("NAIS_API_KEY"),
            )

            /**
             * Local development reads the same env vars (e.g. `nais api proxy` sets NAIS_API_KEY);
             * there is no localhost default for the Console API.
             */
            fun forLocal() = fromEnvironment()

            private fun envOrNull(name: String): String? =
                System.getenv(name)?.trim()?.takeIf { it.isNotBlank() }
        }
    }

    companion object {
        private val log = LoggerFactory.getLogger("ServerEnv")

        // Singleton instance (lazy-loaded)
        val current: ServerEnv by lazy { fromEnvironment() }

        /**
         * Fail-closed guard for the submission-auth bypass. Running outside NAIS
         * (no NAIS_CLUSTER_NAME) disables submission auth entirely, so it must be
         * an explicit opt-in via LUMI_LOCAL_AUTH_BYPASS rather than a silent default.
         */
        internal fun requireValidLocalAuthPolicy(clusterName: String?, localAuthBypass: Boolean) {
            if (clusterName == null && !localAuthBypass) {
                throw IllegalStateException(
                    "Refusing to start: NAIS_CLUSTER_NAME is absent and LUMI_LOCAL_AUTH_BYPASS " +
                        "is not 'true'. In this mode submission auth is fully disabled and any " +
                        "request is accepted. Set LUMI_LOCAL_AUTH_BYPASS=true for local " +
                        "development, or run on NAIS where NAIS_CLUSTER_NAME is always set."
                )
            }
        }
        
        /**
         * Load environment configuration.
         * Automatically detects NAIS vs local and loads appropriate config.
         */
        fun fromEnvironment(): ServerEnv {
            val nais = NaisEnv.fromEnvironment()
            val localAuthBypass = System.getenv("LUMI_LOCAL_AUTH_BYPASS").toBoolean()
            requireValidLocalAuthPolicy(nais.clusterName, localAuthBypass)

            return if (nais.isNais) {
                log.info("Running in NAIS cluster: ${nais.clusterName}")
                forProduction(nais)
            } else {
                log.warn(
                    "Running in LOCAL mode via LUMI_LOCAL_AUTH_BYPASS — submission auth is " +
                        "DISABLED and any request is accepted. Never expose this outside local dev."
                )
                forLocal()
            }
        }
        
        /**
         * Production configuration - requires all environment variables.
         */
        private fun forProduction(nais: NaisEnv): ServerEnv {
            log.info("Loading production database configuration from NAIS env vars")
            return ServerEnv(
                database = DatabaseEnv.fromNais(),
                nais = nais,
                auth = AuthEnv.fromEnvironment(nais.clusterName),
                valkey = ValkeyEnv.fromEnvironment(),
                naisApi = NaisApiEnv.fromEnvironment(),
                rateLimit = RateLimitEnv.fromEnvironment(),
                retention = RetentionEnv.fromEnvironment(),
            )
        }
        
        /**
         * Local development configuration with sensible defaults.
         * Expects local Postgres (Docker Compose or native).
         */
        fun forLocal(): ServerEnv {
            log.info("Using local development defaults")
            return ServerEnv(
                database = DatabaseEnv.forLocal(),
                nais = NaisEnv.forLocal(),
                auth = AuthEnv.forLocal(),
                valkey = ValkeyEnv.forLocal(),
                naisApi = NaisApiEnv.forLocal(),
                rateLimit = RateLimitEnv.fromEnvironment(),
                retention = RetentionEnv.disabled(),
            )
        }
        
        /**
         * Create a test configuration with custom database settings.
         */
        fun forTesting(
            jdbcUrl: String,
            username: String = "test",
            password: String = "test"
        ): ServerEnv {
            return ServerEnv(
                database = DatabaseEnv(
                    jdbcUrl = jdbcUrl,
                    host = "localhost",
                    port = 5432,
                    database = "test",
                    username = username,
                    password = password
                ),
                nais = NaisEnv.forLocal(),
                auth = AuthEnv.forLocal(),
                valkey = ValkeyEnv.forLocal(),
                naisApi = NaisApiEnv(graphqlUrl = null, tokenPath = null, staticKey = null),
                rateLimit = RateLimitEnv.default(),
                retention = RetentionEnv.disabled(),
            )
        }
    }
}
