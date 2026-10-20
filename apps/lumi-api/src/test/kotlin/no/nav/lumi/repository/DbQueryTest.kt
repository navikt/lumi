package no.nav.lumi.repository

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.Dispatchers
import no.nav.lumi.TestDatabase
import no.nav.lumi.config.DatabaseHolder
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.config.exception.ErrorType
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.JdbcTransaction
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.sql.Connection

class DbQueryTest : FunSpec({
    beforeSpec {
        DatabaseHolder.initializeForTesting(TestDatabase.dataSource)
        TestDatabase.initialize()
    }

    test("the main pool and the submission pool set their own statement_timeout") {
        dbQuery { currentConnection().statementTimeout() } shouldBe "15s"
        submissionDbQuery { currentConnection().statementTimeout() } shouldBe "3s"
    }

    test("statement_timeout ends with the transaction") {
        repeat(5) { dbQuery { currentConnection().statementTimeout() } }

        // The test pool has three connections. Holding all of them checks every
        // connection dbQuery may have used.
        val connections = List(3) { TestDatabase.dataSource.connection }
        try {
            connections.map { it.statementTimeout() } shouldBe List(3) { "0" }
        } finally {
            connections.forEach { it.close() }
        }
    }

    test("a statement over the timeout gives 503 and is not retried") {
        var attempts = 0

        val exception = shouldThrow<ApiErrorException.ServiceUnavailableException> {
            submissionDbQuery {
                attempts++
                (this as JdbcTransaction).exec("SELECT pg_sleep(5)")
            }
        }

        attempts shouldBe 1
        exception.errorMessage shouldBe "Databasen svarer ikke akkurat nå"
        exception.type shouldBe ErrorType.DATABASE_UNAVAILABLE
    }

    test("a pool without a free connection gives 503") {
        val testPool = TestDatabase.dataSource as HikariDataSource
        HikariDataSource(
            HikariConfig().apply {
                jdbcUrl = testPool.jdbcUrl
                username = testPool.username
                password = testPool.password
                maximumPoolSize = 1
                connectionTimeout = 250
                isAutoCommit = false
                poolName = "lumi-test-single-connection-pool"
            }
        ).use { singleConnectionPool ->
            val database = Database.connect(singleConnectionPool)
            try {
                singleConnectionPool.connection.use {
                    shouldThrow<ApiErrorException.ServiceUnavailableException> {
                        transactionWithStatementTimeout(
                            database,
                            SUBMISSION_STATEMENT_TIMEOUT,
                            Dispatchers.IO,
                        ) { }
                    }
                }
            } finally {
                TransactionManager.closeAndUnregister(database)
            }
        }
    }

    test("a transaction on one pool cannot open a transaction on the other pool") {
        shouldThrow<ApiErrorException.InternalServerErrorException> {
            submissionDbQuery { dbQuery { } }
        }
        shouldThrow<ApiErrorException.InternalServerErrorException> {
            dbQuery { submissionDbQuery { } }
        }
    }
})

private fun currentConnection(): Connection =
    TransactionManager.current().connection.connection as Connection

private fun Connection.statementTimeout(): String =
    createStatement().use { statement ->
        statement.executeQuery("SHOW statement_timeout").use { resultSet ->
            resultSet.next()
            resultSet.getString(1)
        }
    }
