package no.nav.lumi.repository

import org.jetbrains.exposed.v1.core.BooleanColumnType
import org.jetbrains.exposed.v1.core.Column
import org.jetbrains.exposed.v1.core.ColumnType
import org.jetbrains.exposed.v1.core.Expression
import org.jetbrains.exposed.v1.core.Function
import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.QueryBuilder
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.VarCharColumnType
import org.jetbrains.exposed.v1.javatime.JavaLocalDateColumnType
import org.jetbrains.exposed.v1.javatime.timestamp
import org.postgresql.util.PGobject
import java.time.Instant
import java.time.LocalDate

object FeedbackTable : Table("feedback") {
    val id = varchar("id", 255)
    val opprettet = timestamp("opprettet")
    val feedbackJson = registerColumn<String>("feedback_json", JsonbColumnType())
    val team = varchar("team", 255)
    val app = varchar("app", 255)
    val surveyId = varchar("survey_id", 255).nullable()
    val definitionHash = varchar("definition_hash", 64).nullable()
    val deduplicationKeyHash = varchar("deduplication_key_hash", 64).nullable()

    override val primaryKey = PrimaryKey(id)
}

object FeedbackTagTable : Table("feedback_tag") {
    val feedbackId = varchar("feedback_id", 255).references(FeedbackTable.id)
    val tag = varchar("tag", 255)

    override val primaryKey = PrimaryKey(feedbackId, tag)
}

class JsonbColumnType : ColumnType<String>() {
    override fun sqlType(): String = "jsonb"

    override fun valueFromDB(value: Any): String = when (value) {
        is PGobject -> value.value ?: ""
        else -> value.toString()
    }

    override fun notNullValueToDB(value: String): Any {
        val pg = PGobject()
        pg.type = "jsonb"
        pg.value = value
        return pg
    }

    override fun nonNullValueToString(value: String): String = "'${value.replace("'", "''")}'"
}

class JsonExtract(val col: Column<*>, val path: List<String>) : Function<String>(VarCharColumnType()) {
    override fun toQueryBuilder(queryBuilder: QueryBuilder) {
        queryBuilder.append(col)
        queryBuilder.append("::jsonb")
        path.forEachIndexed { index, p ->
            val escaped = p.replace("'", "''")
            if (index == path.size - 1) {
                queryBuilder.append("->>'")
                queryBuilder.append(escaped)
                queryBuilder.append("'")
            } else {
                queryBuilder.append("->'")
                queryBuilder.append(escaped)
                queryBuilder.append("'")
            }
        }
    }
}

/**
 * PostgreSQL COALESCE(expr1, expr2, ...) helper for String expressions.
 */
class CoalesceString(vararg val expr: Expression<String>) : Function<String>(VarCharColumnType()) {
    override fun toQueryBuilder(queryBuilder: QueryBuilder) {
        queryBuilder.append("COALESCE(")
        expr.forEachIndexed { index, e ->
            if (index > 0) queryBuilder.append(", ")
            e.toQueryBuilder(queryBuilder)
        }
        queryBuilder.append(")")
    }
}

class DateDate(val expr: Expression<Instant>) : Function<LocalDate>(JavaLocalDateColumnType()) {
    override fun toQueryBuilder(queryBuilder: QueryBuilder) {
        queryBuilder.append("DATE(")
        expr.toQueryBuilder(queryBuilder)
        queryBuilder.append(")")
    }
}

/**
 * PostgreSQL jsonb_path_exists(col::jsonb, 'path') helper.
 *
 * Note: the JSONPath is intended to be a constant string (not user input).
 */
class JsonbPathExists(val col: Column<*>, val jsonPath: String) : Op<Boolean>() {
    override fun toQueryBuilder(queryBuilder: QueryBuilder) {
        queryBuilder.append("jsonb_path_exists(")
        queryBuilder.append(col)
        queryBuilder.append("::jsonb, '")
        queryBuilder.append(jsonPath.replace("'", "''"))
        queryBuilder.append("')")
    }
}

/**
 * PostgreSQL (jsonb_path_query_first(col::jsonb, 'path') #>> '{}') helper.
 * Returns a scalar JSON value as text, or null if not found.
 */
class JsonbPathQueryFirstText(val col: Column<*>, val jsonPath: String) : Function<String>(VarCharColumnType()) {
    override fun toQueryBuilder(queryBuilder: QueryBuilder) {
        queryBuilder.append("(")
        queryBuilder.append("jsonb_path_query_first(")
        queryBuilder.append(col)
        queryBuilder.append("::jsonb, '")
        queryBuilder.append(jsonPath.replace("'", "''"))
        queryBuilder.append("') #>> '{}')")
    }
}
