package no.nav.lumi.repository

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import no.nav.lumi.PsqlContainer
import org.flywaydb.core.Flyway
import org.flywaydb.core.api.MigrationVersion
import org.testcontainers.containers.wait.strategy.HostPortWaitStrategy
import java.nio.file.Files
import java.nio.file.Path
import java.sql.DriverManager
import java.sql.Timestamp
import java.time.Instant
import java.time.ZoneOffset

class SurveyRetentionMigrationTest : FunSpec({
    test("keeps the feedback scan out of the trigger migration") {
        val triggerMigration = Files.readString(
            Path.of("src/main/resources/db/migration/V16__survey_retention_activity.sql")
        )
        val backfillMigration = Files.readString(
            Path.of("src/main/resources/db/migration/V17__backfill_survey_retention_activity.sql")
        )

        triggerMigration shouldNotContain "FROM feedback"
        backfillMigration shouldContain "FROM feedback"
    }

    test("installs the rolling writer trigger before backfilling activity") {
        PsqlContainer().apply {
            withDatabaseName("lumi_retention_migration_test")
            withUsername("test")
            withPassword("test")
            setWaitStrategy(HostPortWaitStrategy())
        }.use { container ->
            container.start()
            val dataSource = Triple(container.jdbcUrl, container.username, container.password)

            migrate(dataSource, target = "15")

            // Future dates keep the exact retention assertions independent of
            // the migration's three-month warning floor.
            val historicalActivity = Instant.parse("2089-02-01T12:00:00Z")
            val rollingDeployActivity = Instant.parse("2090-03-01T12:00:00Z")
            val definitionWithoutFeedbackCreatedAt = Instant.parse("2090-04-01T12:00:00Z")

            DriverManager.getConnection(dataSource.first, dataSource.second, dataSource.third).use { connection ->
                connection.autoCommit = false
                insertDefinition(connection, "survey-with-feedback", Instant.parse("2089-01-01T12:00:00Z"), "a")
                insertDefinition(connection, "survey-without-feedback", definitionWithoutFeedbackCreatedAt, "b")
                insertFeedback(connection, "historical", "survey-with-feedback", historicalActivity)
                connection.commit()
            }

            migrate(dataSource, target = "16")

            // Simulates an old application instance writing after V16 has committed
            // but before the backfill migration starts.
            DriverManager.getConnection(dataSource.first, dataSource.second, dataSource.third).use { connection ->
                connection.autoCommit = false
                insertFeedback(connection, "rolling", "survey-with-feedback", rollingDeployActivity)
                connection.commit()
            }

            migrate(dataSource)

            DriverManager.getConnection(dataSource.first, dataSource.second, dataSource.third).use { connection ->
                connection.prepareStatement(
                    """
                        SELECT survey_id, last_submission_at, definition_retention_at
                        FROM survey_definitions
                        ORDER BY survey_id
                    """.trimIndent()
                ).use { statement ->
                    statement.executeQuery().use { result ->
                        result.next() shouldBe true
                        result.getString("survey_id") shouldBe "survey-with-feedback"
                        result.getTimestamp("last_submission_at").toInstant() shouldBe rollingDeployActivity
                        result.getTimestamp("definition_retention_at").toInstant() shouldBe
                            rollingDeployActivity.atZone(ZoneOffset.UTC).plusMonths(18).toInstant()

                        result.next() shouldBe true
                        result.getString("survey_id") shouldBe "survey-without-feedback"
                        result.getTimestamp("last_submission_at").toInstant() shouldBe definitionWithoutFeedbackCreatedAt
                        result.getTimestamp("definition_retention_at").toInstant() shouldBe
                            definitionWithoutFeedbackCreatedAt.atZone(ZoneOffset.UTC).plusMonths(18).toInstant()

                        result.next() shouldBe false
                    }
                }
            }
        }
    }
})

private fun migrate(dataSource: Triple<String, String, String>, target: String? = null) {
    val configuration = Flyway.configure()
        .dataSource(dataSource.first, dataSource.second, dataSource.third)
        .locations("classpath:db/migration")
    if (target != null) {
        configuration.target(MigrationVersion.fromVersion(target))
    }
    configuration.load().migrate()
}

private fun insertDefinition(
    connection: java.sql.Connection,
    surveyId: String,
    createdAt: Instant,
    hashCharacter: String,
) {
    connection.prepareStatement(
        """
            INSERT INTO survey_definitions (
                team, survey_id, definition_hash, definition, created_at, updated_at
            )
            VALUES ('team-a', ?, ?, ?::jsonb, ?, ?)
        """.trimIndent()
    ).use { statement ->
        statement.setString(1, surveyId)
        statement.setString(2, hashCharacter.repeat(64))
        statement.setString(3, """{"surveyId":"$surveyId","surveyType":"rating","fields":[]}""")
        statement.setTimestamp(4, Timestamp.from(createdAt))
        statement.setTimestamp(5, Timestamp.from(createdAt))
        statement.executeUpdate()
    }
}

private fun insertFeedback(
    connection: java.sql.Connection,
    id: String,
    surveyId: String,
    createdAt: Instant,
) {
    connection.prepareStatement(
        """
            INSERT INTO feedback (id, opprettet, feedback_json, team, app, survey_id)
            VALUES (?, ?, ?::jsonb, 'team-a', 'app-a', ?)
        """.trimIndent()
    ).use { statement ->
        statement.setString(1, id)
        statement.setTimestamp(2, Timestamp.from(createdAt))
        statement.setString(3, """{"surveyId":"$surveyId"}""")
        statement.setString(4, surveyId)
        statement.executeUpdate()
    }
}
