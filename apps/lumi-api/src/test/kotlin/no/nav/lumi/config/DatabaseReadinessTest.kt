package no.nav.lumi.config

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import no.nav.lumi.TestDatabase
import java.io.PrintWriter
import java.sql.Connection
import java.sql.SQLException
import java.util.logging.Logger
import javax.sql.DataSource

/**
 * /internal/isReady must reflect real database reachability so NAIS pulls the pod
 * from the load balancer when the DB is down — not return a hardcoded "OK".
 */
class DatabaseReadinessTest : FunSpec({

    beforeSpec { TestDatabase.initialize() }

    test("isDatabaseReady should return true when the database is reachable") {
        isDatabaseReady(TestDatabase.dataSource) shouldBe true
    }

    test("isDatabaseReady should return false when the database is unreachable") {
        isDatabaseReady(UnreachableDataSource) shouldBe false
    }
})

/** A DataSource that always fails to connect, standing in for a down database. */
private object UnreachableDataSource : DataSource {
    override fun getConnection(): Connection = throw SQLException("database unreachable")
    override fun getConnection(username: String?, password: String?): Connection =
        throw SQLException("database unreachable")
    override fun getLogWriter(): PrintWriter? = null
    override fun setLogWriter(out: PrintWriter?) {}
    override fun setLoginTimeout(seconds: Int) {}
    override fun getLoginTimeout(): Int = 0
    override fun getParentLogger(): Logger = Logger.getGlobal()
    override fun <T : Any?> unwrap(iface: Class<T>?): T = throw SQLException("not a wrapper")
    override fun isWrapperFor(iface: Class<*>?): Boolean = false
}
