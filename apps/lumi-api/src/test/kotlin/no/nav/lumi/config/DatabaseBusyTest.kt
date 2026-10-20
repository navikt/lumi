package no.nav.lumi.config

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.routing.*
import io.ktor.server.testing.*
import java.sql.SQLException
import java.sql.SQLTransientConnectionException

class DatabaseBusyTest : FunSpec({
    test("a full pool counts as a busy database") {
        SQLTransientConnectionException("lumi-api-pool - Connection is not available").isDatabaseBusy() shouldBe true
    }

    test("a statement cancelled by statement_timeout counts as busy, also when wrapped") {
        val cancelled = SQLException("canceling statement due to statement timeout", "57014")

        cancelled.isDatabaseBusy() shouldBe true
        RuntimeException(SQLException(cancelled)).isDatabaseBusy() shouldBe true
    }

    test("other errors do not count as busy") {
        SQLException("duplicate key value violates unique constraint", "23505").isDatabaseBusy() shouldBe false
        IllegalArgumentException("bad input").isDatabaseBusy() shouldBe false
    }

    test("a busy database outside dbQuery gives 503 with a message for the dashboard") {
        testApplication {
            application {
                configureSerialization()
                configureStatusPages()
                routing {
                    get("/busy") {
                        throw SQLTransientConnectionException("lumi-api-pool - Connection is not available")
                    }
                }
            }

            val response = client.get("/busy")

            response.status shouldBe HttpStatusCode.ServiceUnavailable
            response.bodyAsText() shouldContain "Databasen er travel akkurat nå"
        }
    }
})
