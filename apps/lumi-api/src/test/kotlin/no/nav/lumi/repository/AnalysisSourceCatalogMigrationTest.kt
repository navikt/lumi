package no.nav.lumi.repository

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import no.nav.lumi.PsqlContainer
import org.flywaydb.core.Flyway
import org.flywaydb.core.api.MigrationVersion
import java.sql.DriverManager
import java.sql.Types
import java.time.OffsetDateTime

class AnalysisSourceCatalogMigrationTest : FunSpec({
    val container = PsqlContainer()

    beforeSpec {
        container.start()
        waitForDatabase(container)
    }
    afterSpec { container.stop() }

    test("captures rolling writers before backfill and keeps the table closed") {
        val beforeCatalog = Flyway.configure()
            .dataSource(container.jdbcUrl, container.username, container.password)
            .locations("classpath:db/migration")
            .target(MigrationVersion.fromVersion("19"))
            .load()
        beforeCatalog.migrate()

        DriverManager.getConnection(container.jdbcUrl, container.username, container.password).use { connection ->
            insertFeedback(connection, "feedback-backfill", "2026-08-01T10:00:00Z", "app-a", "survey-a", "survey-a")
            insertFeedback(connection, "feedback-json-fallback", "2026-08-01T11:00:00Z", "app-json", null, "survey-json")
            insertFeedback(
                connection,
                "feedback-padded-invalid",
                "2026-08-01T11:30:00Z",
                "app-padded",
                null,
                "survey-padding" + " ".repeat(250),
            )
        }

        Flyway.configure()
            .dataSource(container.jdbcUrl, container.username, container.password)
            .locations("classpath:db/migration")
            .target(MigrationVersion.fromVersion("20"))
            .load()
            .migrate()

        DriverManager.getConnection(container.jdbcUrl, container.username, container.password).use { connection ->
            insertFeedback(connection, "feedback-rolling", "2026-08-01T12:00:00Z", "app-b", "survey-a", "survey-a")

            connection.prepareStatement(
                """
                SELECT COUNT(*)
                FROM analysis_control.analysis_sources
                WHERE team = 'team-a' AND app = 'app-b' AND survey_id = 'survey-a'
                """.trimIndent(),
            ).use { statement ->
                statement.executeQuery().use { result ->
                    result.next() shouldBe true
                    result.getInt(1) shouldBe 1
                }
            }

            connection.autoCommit = false
            insertFeedback(connection, "feedback-rollback", "2026-08-01T13:00:00Z", "app-rollback", "survey-a", "survey-a")
            connection.rollback()
        }

        Flyway.configure()
            .dataSource(container.jdbcUrl, container.username, container.password)
            .locations("classpath:db/migration")
            .load()
            .migrate()

        DriverManager.getConnection(container.jdbcUrl, container.username, container.password).use { connection ->
            connection.prepareStatement(
                """
                SELECT team, app, survey_id, first_submission_at, last_submission_at
                FROM analysis_control.analysis_sources
                ORDER BY app
                """.trimIndent(),
            ).use { statement ->
                statement.executeQuery().use { result ->
                    result.next() shouldBe true
                    result.getString("team") shouldBe "team-a"
                    result.getString("app") shouldBe "app-a"
                    result.getString("survey_id") shouldBe "survey-a"
                    result.getObject("first_submission_at") shouldBe result.getObject("last_submission_at")

                    result.next() shouldBe true
                    result.getString("app") shouldBe "app-b"
                    result.getString("survey_id") shouldBe "survey-a"

                    result.next() shouldBe true
                    result.getString("app") shouldBe "app-json"
                    result.getString("survey_id") shouldBe "survey-json"
                    result.next() shouldBe false
                }
            }

            connection.prepareStatement(
                "SELECT has_table_privilege('esyfo-analyse', 'analysis_control.analysis_sources', 'SELECT')",
            ).use { statement ->
                statement.executeQuery().use { result ->
                    result.next() shouldBe true
                    result.getBoolean(1) shouldBe false
                }
            }
        }
    }
})

private fun insertFeedback(
    connection: java.sql.Connection,
    id: String,
    submittedAt: String,
    app: String,
    surveyIdColumn: String?,
    surveyIdJson: String,
) {
    connection.prepareStatement(
        """
        INSERT INTO feedback (
            id, opprettet, feedback_json, team, app, survey_id, definition_hash
        )
        VALUES (?, ?, ?::jsonb, ?, ?, ?, ?)
        """.trimIndent(),
    ).use { statement ->
        statement.setString(1, id)
        statement.setObject(2, OffsetDateTime.parse(submittedAt))
        statement.setString(3, """{"surveyId":"$surveyIdJson","surveyType":"custom","answers":[]}""")
        statement.setString(4, "team-a")
        statement.setString(5, app)
        if (surveyIdColumn == null) statement.setNull(6, Types.VARCHAR) else statement.setString(6, surveyIdColumn)
        statement.setString(7, "a".repeat(64))
        statement.executeUpdate()
    }
}

private fun waitForDatabase(container: PsqlContainer) {
    var lastFailure: Exception? = null
    repeat(30) {
        try {
            DriverManager.getConnection(container.jdbcUrl, container.username, container.password).use { }
            return
        } catch (failure: Exception) {
            lastFailure = failure
            Thread.sleep(100)
        }
    }
    throw checkNotNull(lastFailure)
}
