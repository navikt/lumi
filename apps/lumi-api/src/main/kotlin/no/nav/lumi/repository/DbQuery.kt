package no.nav.lumi.repository

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import no.nav.lumi.config.DatabaseHolder
import no.nav.lumi.config.databaseBusyException
import no.nav.lumi.config.isDatabaseBusy
import org.jetbrains.exposed.v1.core.Transaction
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import org.jetbrains.exposed.v1.jdbc.transactions.suspendTransaction
import java.sql.SQLException
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds

// PostgreSQL cancels a statement that runs longer than this. The timeout counts
// per statement and also covers time spent waiting for locks.
internal val MAIN_STATEMENT_TIMEOUT = 15.seconds
internal val SUBMISSION_STATEMENT_TIMEOUT = 3.seconds

/**
 * Runs a transaction on the main pool, used by the dashboard, Surveyverksted and
 * analysis.
 */
suspend fun <T> dbQuery(block: suspend Transaction.() -> T): T =
    transactionWithStatementTimeout(DatabaseHolder.requireConnected(), MAIN_STATEMENT_TIMEOUT, block)

/**
 * Runs a transaction on the submission pool. Only the submission path uses it,
 * so slow dashboard queries cannot hold every connection while answers wait.
 */
suspend fun <T> submissionDbQuery(block: suspend Transaction.() -> T): T =
    transactionWithStatementTimeout(DatabaseHolder.requireSubmissionDatabase(), SUBMISSION_STATEMENT_TIMEOUT, block)

private suspend fun <T> transactionWithStatementTimeout(
    database: Database,
    statementTimeout: Duration,
    block: suspend Transaction.() -> T,
): T {
    return withContext(Dispatchers.IO) {
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
                if (exception.isDatabaseBusy()) throw databaseBusyException(exception)
                throw exception
            }
        }
    }
}
