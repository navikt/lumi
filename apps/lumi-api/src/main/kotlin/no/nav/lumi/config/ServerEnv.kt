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
    val valkey: ValkeyEnv
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
    
    companion object {
        private val log = LoggerFactory.getLogger("ServerEnv")
        
        // Singleton instance (lazy-loaded)
        val current: ServerEnv by lazy { fromEnvironment() }
        
        /**
         * Load environment configuration.
         * Automatically detects NAIS vs local and loads appropriate config.
         */
        fun fromEnvironment(): ServerEnv {
            val nais = NaisEnv.fromEnvironment()
            
            return if (nais.isNais) {
                log.info("Running in NAIS cluster: ${nais.clusterName}")
                forProduction(nais)
            } else {
                log.info("Running in local development mode")
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
                valkey = ValkeyEnv.fromEnvironment()
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
                valkey = ValkeyEnv.forLocal()
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
                valkey = ValkeyEnv.forLocal()
            )
        }
    }
}
