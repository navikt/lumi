package no.nav.lumi.config

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import io.ktor.server.application.*
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.config.exception.ErrorType
import org.flywaydb.core.Flyway
import org.jetbrains.exposed.v1.jdbc.Database
import org.slf4j.LoggerFactory
import java.sql.SQLException
import java.sql.SQLTransientConnectionException
import javax.sql.DataSource

private val log = LoggerFactory.getLogger("Database")

/**
 * Application-level database holder.
 * Initialized during application startup.
 *
 * Submissions use their own small pool, and readiness has a pool of one
 * connection. Heavy dashboard queries can then fill the main pool without
 * stopping submissions, and busy submissions cannot take the pod out of traffic.
 */
object DatabaseHolder {
    @Volatile
    private var _dataSource: DataSource? = null
    @Volatile
    private var _submissionDataSource: DataSource? = null
    @Volatile
    private var _readinessDataSource: DataSource? = null
    @Volatile
    private var _database: Database? = null
    @Volatile
    private var _submissionDatabase: Database? = null
    
    val dataSource: DataSource
        get() = _dataSource ?: throw IllegalStateException(
            "Database not initialized. Call configureDatabase() first."
        )

    val submissionDataSource: DataSource
        get() = _submissionDataSource ?: throw IllegalStateException(
            "Database not initialized. Call configureDatabase() first."
        )

    val readinessDataSource: DataSource
        get() = _readinessDataSource ?: throw IllegalStateException(
            "Database not initialized. Call configureDatabase() first."
        )

    val database: Database
        get() = _database ?: throw IllegalStateException(
            "Database not connected. Call connect() after initialization."
        )
    
    /**
     * Initialize for production use with ServerEnv configuration.
     */
    @Synchronized
    fun initialize(env: ServerEnv.DatabaseEnv) {
        if (_dataSource != null) {
            log.warn("Database already initialized, skipping")
            return
        }
        _dataSource = createDataSource(env, MAIN_POOL)
        _submissionDataSource = createDataSource(env, SUBMISSION_POOL)
        _readinessDataSource = createDataSource(env, READINESS_POOL)
        _database = null
        _submissionDatabase = null
        log.info("Database initialized with production configuration")
    }
    
    /**
     * Initialize for testing with a pre-configured DataSource, shared by all pools.
     */
    @Synchronized
    fun initializeForTesting(dataSource: DataSource) {
        if (_dataSource !== dataSource) {
            closeDataSources()
            _dataSource = dataSource
            _submissionDataSource = dataSource
            _readinessDataSource = dataSource
            _database = null
            _submissionDatabase = null
        }
        log.info("Database initialized with test configuration")
    }

    /**
     * Connects one Exposed Database per pool, also when tests share one DataSource.
     * Exposed only joins an outer transaction on the same Database, so tests then
     * see the same separate transactions as production. The main Database is
     * connected last and becomes Exposed's default.
     */
    @Synchronized
    fun connect() {
        if (_database != null) return
        _submissionDatabase = Database.connect(submissionDataSource)
        _database = Database.connect(dataSource)
    }

    fun requireConnected(): Database {
        return _database ?: throw IllegalStateException(
            "Database not connected. Call configureDatabase() or DatabaseHolder.connect() before dbQuery."
        )
    }

    fun requireSubmissionDatabase(): Database {
        return _submissionDatabase ?: throw IllegalStateException(
            "Database not connected. Call configureDatabase() or DatabaseHolder.connect() before submissionDbQuery."
        )
    }
    
    /**
     * Reset the database holder (for testing purposes only).
     */
    @Synchronized
    fun reset() {
        closeDataSources()
        _dataSource = null
        _submissionDataSource = null
        _readinessDataSource = null
        _database = null
        _submissionDatabase = null
    }

    private fun closeDataSources() {
        listOfNotNull(_dataSource, _submissionDataSource, _readinessDataSource)
            .distinctBy { System.identityHashCode(it) }
            .forEach { (it as? HikariDataSource)?.close() }
    }
}

/**
 * Ktor module extension to configure the database.
 * Uses ServerEnv for type-safe configuration.
 */
fun Application.configureDatabase() {
    val env = ServerEnv.current
    
    DatabaseHolder.initialize(env.database)
    
    runMigrations(DatabaseHolder.dataSource)
    
    DatabaseHolder.connect()
    
    log.info("Database configured successfully")
}

internal data class PoolSettings(
    val name: String,
    val maximumPoolSize: Int,
    val minimumIdle: Int,
    val connectionTimeoutMillis: Long,
)

// Dashboard, Surveyverksted, analysis, Flyway and the retention job. A short
// connectionTimeout fails a request quickly instead of letting it queue for 30 s
// when the pool is full.
internal val MAIN_POOL = PoolSettings(
    name = "lumi-api-pool",
    maximumPoolSize = 8,
    minimumIdle = 2,
    connectionTimeoutMillis = 5_000,
)

// Submissions and readiness only. Submission transactions are short, so four
// connections per pod leave plenty of headroom.
internal val SUBMISSION_POOL = PoolSettings(
    name = "lumi-api-submission-pool",
    maximumPoolSize = 4,
    minimumIdle = 2,
    connectionTimeoutMillis = 3_000,
)

// Readiness only. The NAIS readiness probe times out after one second, so the
// probe must never queue behind submissions for a connection.
internal val READINESS_POOL = PoolSettings(
    name = "lumi-api-readiness-pool",
    maximumPoolSize = 1,
    minimumIdle = 1,
    connectionTimeoutMillis = 500,
)

/**
 * Create a HikariCP DataSource from environment configuration.
 */
internal fun createDataSource(config: ServerEnv.DatabaseEnv, pool: PoolSettings): HikariDataSource {
    val hikariConfig = HikariConfig().apply {
        jdbcUrl = config.getConnectionUrl()
        username = config.username
        password = config.password
        maximumPoolSize = pool.maximumPoolSize
        minimumIdle = pool.minimumIdle
        idleTimeout = 30000
        connectionTimeout = pool.connectionTimeoutMillis
        maxLifetime = 1800000
        isAutoCommit = false
        transactionIsolation = "TRANSACTION_READ_COMMITTED"
        poolName = pool.name
        
        // Validation
        connectionTestQuery = "SELECT 1"
        validationTimeout = minOf(2_000L, pool.connectionTimeoutMillis)
    }
    
    return HikariDataSource(hikariConfig)
}

/**
 * Readiness probe helper: true if a valid connection can be obtained from the pool.
 * Backs GET /internal/isReady so NAIS pulls the pod from the load balancer when the
 * database is unreachable. Flyway has already run by the time the server serves
 * requests, so a live connection is a sufficient readiness signal. The route uses
 * its own pool, so busy dashboard queries or submissions do not take the pod out
 * of traffic.
 */
fun isDatabaseReady(dataSource: DataSource): Boolean =
    try {
        dataSource.connection.use { it.isValid(1) }
    } catch (e: Exception) {
        log.warn("Readiness check failed: database not reachable", e)
        false
    }

private const val PG_QUERY_CANCELED = "57014"

/**
 * True when the database could not serve the request in time: the pool could not
 * hand out a connection within connectionTimeout (all busy, or the database is
 * unreachable), or PostgreSQL cancelled a statement that exceeded
 * statement_timeout.
 */
internal fun Throwable.isDatabaseUnavailable(): Boolean =
    generateSequence(this) { current -> current.cause?.takeIf { it !== current } }
        .any { it is SQLTransientConnectionException || (it is SQLException && it.sqlState == PG_QUERY_CANCELED) }

// The dashboard does not retry DATABASE_UNAVAILABLE automatically, since a new
// attempt would run the same heavy query against a busy database.
internal fun databaseUnavailableException(cause: Throwable? = null) = ApiErrorException.ServiceUnavailableException(
    errorMessage = "Databasen svarer ikke akkurat nå",
    details = "Dette er som regel midlertidig. Prøv igjen om litt.",
    cause = cause,
    type = ErrorType.DATABASE_UNAVAILABLE,
)

/**
 * Run Flyway database migrations.
 */
fun runMigrations(dataSource: DataSource) {
    log.info("Running database migrations...")
    
    try {
        val flyway = Flyway.configure()
            .dataSource(dataSource)
            .locations("classpath:db/migration")
            .baselineOnMigrate(true)
            .load()
        
        val info = flyway.info()
        log.info("Flyway info - Current version: ${info.current()?.version ?: "NONE"}")
        log.info("Flyway info - Pending migrations: ${info.pending().size}")
        
        info.pending().forEach { pending ->
            log.info("  Pending: ${pending.version} - ${pending.description}")
        }
        
        val result = flyway.migrate()
        
        log.info("Database migrations completed!")
        log.info("  Migrations executed: ${result.migrationsExecuted}")
        log.info("  Target schema version: ${result.targetSchemaVersion ?: "NONE"}")
        
        // Verify table exists
        dataSource.connection.use { conn ->
            val rs = conn.metaData.getTables(null, null, "feedback", null)
            if (rs.next()) {
                log.info("✓ Verified 'feedback' table exists in database")
            } else {
                log.error("✗ ERROR: 'feedback' table does NOT exist after migration!")
            }
        }
    } catch (e: Exception) {
        log.error("Failed to run database migrations", e)
        throw e
    }
}
