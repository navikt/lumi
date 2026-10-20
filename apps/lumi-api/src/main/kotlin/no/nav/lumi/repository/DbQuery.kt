package no.nav.lumi.repository

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import no.nav.lumi.config.DatabaseHolder
import no.nav.lumi.config.databaseUnavailableException
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.config.isDatabaseUnavailable
import org.jetbrains.exposed.v1.core.Transaction
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import org.jetbrains.exposed.v1.jdbc.transactions.suspendTransaction
import java.sql.SQLException
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds

// PostgreSQL cancels a statement that runs longer than this. The timeout counts
// per statement, not per transaction, and also covers time spent waiting for locks.
internal val MAIN_STATEMENT_TIMEOUT = 15.seconds
internal val SUBMISSION_STATEMENT_TIMEOUT = 3.seconds

// JDBC calls block a thread. Submissions get their own view of Dispatchers.IO, so
// dashboard calls waiting for the main pool cannot use up the threads. Views of
// Dispatchers.IO do not count against its 64-thread limit.
private val submissionDispatcher = Dispatchers.IO.limitedParallelism(16)

/**
 * Runs a transaction on the main pool, used by the dashboard, Surveyverksted and
 * analysis.
 */
suspend fun <T> dbQuery(block: suspend Transaction.() -> T): T =
    transactionWithStatementTimeout(
        DatabaseHolder.requireConnected(),
        MAIN_STATEMENT_TIMEOUT,
        Dispatchers.IO,
        block,
    )

/**
 * Runs a transaction on the submission pool. Only the submission path uses it,
 * so slow dashboard queries cannot hold every connection while answers wait.
 */
suspend fun <T> submissionDbQuery(block: suspend Transaction.() -> T): T =
    transactionWithStatementTimeout(
        DatabaseHolder.requireSubmissionDatabase(),
        SUBMISSION_STATEMENT_TIMEOUT,
        submissionDispatcher,
        block,
    )

internal suspend fun <T> transactionWithStatementTimeout(
    database: Database,
    statementTimeout: Duration,
    dispatcher: CoroutineDispatcher,
    block: suspend Transaction.() -> T,
): T {
    // Exposed joins an outer transaction only on the same Database. On another
    // pool it would open a separate transaction that commits on its own and
    // can wait for locks the outer transaction holds.
    val outer = TransactionManager.currentOrNull()
    if (outer != null && outer.db !== database) {
        throw ApiErrorException.InternalServerErrorException(
            "A transaction on one database pool must not open a transaction on another pool"
        )
    }

    return withContext(dispatcher) {
        suspendTransaction(database) {
            try {
                // SET LOCAL ends with the transaction, so the setting never leaks
                // to the next user of the pooled connection.
                val conn = TransactionManager.current().connection.connection as java.sql.Connection
                conn.createStatement().use { statement ->
                    statement.execute("SET LOCAL statement_timeout = ${statementTimeout.inWholeMilliseconds}")
                }
                block()
            } catch (exception: SQLException) {
                // Exposed retries a transaction on any SQLException. A cancelled
                // heavy query must not run again, and a full pool will not be
                // free a moment later, so answer 503 instead of retrying.
                if (exception.isDatabaseUnavailable()) throw databaseUnavailableException(exception)
                throw exception
            }
        }
    }
}
