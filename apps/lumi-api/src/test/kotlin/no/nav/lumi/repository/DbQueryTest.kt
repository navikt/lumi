package no.nav.lumi.repository

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import no.nav.lumi.TestDatabase
import no.nav.lumi.config.DatabaseHolder
import no.nav.lumi.config.exception.ApiErrorException
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
        exception.errorMessage shouldBe "Databasen er travel akkurat nå"
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
