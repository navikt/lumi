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

class DatabaseUnavailableTest : FunSpec({
    test("a pool that cannot hand out a connection counts as unavailable") {
        SQLTransientConnectionException("lumi-api-pool - Connection is not available").isDatabaseUnavailable() shouldBe true
    }

    test("a statement cancelled by statement_timeout counts as unavailable, also when wrapped") {
        val cancelled = SQLException("canceling statement due to statement timeout", "57014")

        cancelled.isDatabaseUnavailable() shouldBe true
        RuntimeException(SQLException(cancelled)).isDatabaseUnavailable() shouldBe true
    }

    test("other errors do not count as unavailable") {
        SQLException("duplicate key value violates unique constraint", "23505").isDatabaseUnavailable() shouldBe false
        IllegalArgumentException("bad input").isDatabaseUnavailable() shouldBe false
    }

    test("an unavailable database outside dbQuery gives 503 with a message for the dashboard") {
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
            response.bodyAsText() shouldContain "Databasen svarer ikke akkurat nå"
        }
    }
})
