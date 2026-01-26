package no.nav.lumi.repository

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import no.nav.lumi.config.DatabaseHolder
import org.jetbrains.exposed.v1.core.Transaction
import org.jetbrains.exposed.v1.jdbc.transactions.suspendTransaction

suspend fun <T> dbQuery(block: suspend Transaction.() -> T): T {
    return withContext(Dispatchers.IO) {
        suspendTransaction(DatabaseHolder.requireConnected()) { block() }
    }
}
