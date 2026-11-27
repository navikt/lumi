package no.nav.lumi.repository

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import no.nav.lumi.PsqlContainer
import org.flywaydb.core.Flyway
import org.flywaydb.core.api.MigrationVersion
import java.sql.Connection
import java.sql.DriverManager

private const val PROJECT_ID = "6f1f2a52-3c34-4c1e-9a67-2f2d8c0e5b11"
private const val DRAFT = """{"authoringSchemaVersion": 1, "type": "custom", "pages": [{"id": "side", "questions": []}]}"""
private const val SHARED = """{"authoringSchemaVersion": 1, "type": "rating", "pages": [{"id": "delt", "questions": []}]}"""

class SurveyAuthoringPresentationMigrationTest : FunSpec({
    val container = PsqlContainer()

    beforeSpec {
        container.start()
        waitForPostgres(container)
    }
    afterSpec { container.stop() }

    fun migrate(target: String? = null) {
        Flyway.configure()
            .dataSource(container.jdbcUrl, container.username, container.password)
            .locations("classpath:db/migration")
            .apply { if (target != null) target(MigrationVersion.fromVersion(target)) }
            .load()
            .migrate()
    }

    fun <T> connected(block: (Connection) -> T): T =
        DriverManager.getConnection(container.jdbcUrl, container.username, container.password).use(block)

    test("keeps a draft and a version shared before the display choice existed as the floating panel") {
        migrate("28")
        connected { connection ->
            connection.createStatement().use { statement ->
                statement.execute(
                    """
                    INSERT INTO survey_authoring_projects (
                        id, team, name, survey_id, draft, draft_version, created_by, updated_by
                    ) VALUES (
                        '$PROJECT_ID', 'team-a', 'Utkast', 'survey-a', '$DRAFT'::jsonb, 2, 'a', 'a'
                    )
                    """.trimIndent(),
                )
                statement.execute(
                    """
                    INSERT INTO survey_authoring_revisions (
                        project_id, revision_number, draft_version, name, survey_id,
                        document, document_hash, definition, definition_hash, created_by
                    ) VALUES (
                        '$PROJECT_ID', 1, 2, 'Utkast', 'survey-a',
                        '$SHARED'::jsonb, repeat('a', 64), '{}'::jsonb, repeat('b', 64), 'a'
                    )
                    """.trimIndent(),
                )
            }
        }

        migrate()

        connected { connection ->
            presentationOf(connection, "survey_authoring_projects", "id = '$PROJECT_ID'") shouldBe
                ("dock" to null)
            presentationOf(connection, "survey_authoring_revisions", "revision_number = 1") shouldBe
                ("dock" to null)

            // The author places the draft at the content. The version shared
            // before stays as it was shared.
            connection.createStatement().use { statement ->
                statement.executeUpdate(
                    """
                    UPDATE survey_authoring_projects
                    SET display_mode = 'inline', placement_note = 'Under listen', draft_version = 3
                    WHERE id = '$PROJECT_ID'
                    """.trimIndent(),
                ) shouldBe 1
            }
            presentationOf(connection, "survey_authoring_revisions", "revision_number = 1") shouldBe
                ("dock" to null)
            // The version keeps the document and the hashes it was shared with.
            connection.prepareStatement(
                """
                SELECT document = '$SHARED'::jsonb, document_hash, definition_hash
                FROM survey_authoring_revisions
                WHERE revision_number = 1
                """.trimIndent(),
            ).use { statement ->
                statement.executeQuery().use { result ->
                    result.next() shouldBe true
                    result.getBoolean(1) shouldBe true
                    result.getString("document_hash") shouldBe "a".repeat(64)
                    result.getString("definition_hash") shouldBe "b".repeat(64)
                }
            }
        }
    }
})

private fun presentationOf(connection: Connection, table: String, where: String): Pair<String, String?> =
    connection.prepareStatement("SELECT display_mode, placement_note FROM $table WHERE $where").use { statement ->
        statement.executeQuery().use { result ->
            result.next() shouldBe true
            val presentation = result.getString("display_mode") to result.getString("placement_note")
            result.next() shouldBe false
            presentation
        }
    }

private fun waitForPostgres(container: PsqlContainer) {
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
