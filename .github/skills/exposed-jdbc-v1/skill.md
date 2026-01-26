---
name: exposed-jdbc-v1
description: Exposed 1.0.0 JDBC DSL patterns (imports, transactions, queries, raw SQL, and types)
---

# Exposed JDBC v1 Skill

Use these conventions when working with Exposed 1.0.0 (JDBC) in Kotlin services.

## Imports and module boundaries

- Use `org.jetbrains.exposed.v1.core.*` for core DSL types and expressions.
- Use `org.jetbrains.exposed.v1.jdbc.*` for JDBC-only functions (`selectAll`, `insert`, `update`, `deleteWhere`, `SchemaUtils`, `Database`).
- Use `org.jetbrains.exposed.v1.javatime.*` (or kotlin-datetime) for date/time columns.
- Avoid `SqlExpressionBuilder.run { ... }` patterns; import top-level ops from `v1.core`.

## Database connection

```kotlin
import org.jetbrains.exposed.v1.jdbc.Database

val db = Database.connect(dataSource)
```

Prefer a pooled `DataSource` (HikariCP) and store the `Database` instance for reuse. Avoid calling `Database.connect()` multiple times per DB.

## Transactions

```kotlin
import org.jetbrains.exposed.v1.jdbc.transactions.transaction

val rows = transaction(db) {
    Table.selectAll().where { Table.id eq id }.toList()
}
```

- Keep all Exposed operations inside `transaction {}`.
- Use `transaction(db)` when multiple databases are present or when explicitness helps.

## Suspend-friendly transactions

Prefer a shared suspend helper that uses Exposed v1 `suspendTransaction` and exposes a `Transaction` receiver:

```kotlin
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.jetbrains.exposed.v1.core.Transaction
import org.jetbrains.exposed.v1.jdbc.transactions.suspendTransaction

suspend fun <T> dbQuery(block: suspend Transaction.() -> T): T {
    return withContext(Dispatchers.IO) {
        suspendTransaction(DatabaseHolder.database) { block() }
    }
}
```

- Keep the DB work inside `dbQuery { ... }`.
- Move heavy CPU processing (JSON parsing, grouping, stemming) outside the transaction.
- Ensure `Database.connect(...)` is called once at startup and reused (e.g. via a `DatabaseHolder`).

## Raw SQL with parameters

Use `exec(...)` with typed parameters and a `ResultSet` mapper:

```kotlin
import org.jetbrains.exposed.v1.core.VarCharColumnType
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager

val sql = "SELECT name FROM users WHERE team = ?"
val transaction = TransactionManager.current()
transaction.exec(sql, listOf(VarCharColumnType() to team)) { rs ->
    val names = mutableListOf<String>()
    while (rs.next()) names += rs.getString("name")
    names
} ?: emptyList()
```

## Column types and UUIDs

- Use `javaUUID("id")` for `java.util.UUID` (avoids `kotlin.uuid.ExperimentalUuidApi`).
- Use `uuid("id")` only if you intentionally want `kotlin.uuid.Uuid`.

```kotlin
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.java.javaUUID

object ExampleTable : Table("example") {
    val id = javaUUID("id").autoGenerate()
}
```

## JSON/JSONB and custom types

Use custom `ColumnType` for PostgreSQL-specific types if needed, and keep it close to the table definition.
For JSONB, consider `exposed-json` if you want typed JSON with serializers.

## Schema changes

Use Flyway for production migrations. Avoid `SchemaUtils.create()` except in tests or temporary tooling.

### Concurrent index migrations

If a migration uses `CREATE INDEX CONCURRENTLY`, avoid running it as-is in tests (it can hang or fail under Testcontainers).
Use a Flyway placeholder so tests can disable the keyword:

```sql
CREATE INDEX ${concurrently} IF NOT EXISTS idx_name ON table_name (col);
```

```kotlin
Flyway.configure()
    .placeholders(mapOf("concurrently" to "CONCURRENTLY")) // prod
    .load()
    .migrate()
```

```kotlin
Flyway.configure()
    .placeholders(mapOf("concurrently" to "")) // tests
    .load()
    .migrate()
```

## Gotchas

- `DatabaseHolder.database` must be connected before any `dbQuery {}` calls; enforce this in app startup and tests.
- If tests reinitialize the datasource, clear or reconnect the cached `Database` instance to avoid stale connections.
