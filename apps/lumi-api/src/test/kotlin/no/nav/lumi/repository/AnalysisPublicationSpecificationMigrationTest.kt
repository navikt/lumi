package no.nav.lumi.repository

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import no.nav.lumi.PsqlContainer
import org.flywaydb.core.Flyway
import org.flywaydb.core.api.MigrationVersion
import org.testcontainers.containers.wait.strategy.HostPortWaitStrategy
import java.sql.Connection
import java.sql.DriverManager
import java.util.UUID

class AnalysisPublicationSpecificationMigrationTest : FunSpec({
    test("upgrades from V23 without invalidating immutable V1 release history") {
        PsqlContainer().apply {
            withDatabaseName("lumi_analysis_specification_migration_test")
            withUsername("test")
            withPassword("test")
            setWaitStrategy(HostPortWaitStrategy())
        }.use { container ->
            container.start()
            val dataSource = Triple(container.jdbcUrl, container.username, container.password)
            migrateAnalysisSpecification(dataSource, target = "23")

            DriverManager.getConnection(dataSource.first, dataSource.second, dataSource.third).use { connection ->
                connection.autoCommit = false
                insertReleaseFixture(connection, schemaVersion = 1)
                connection.commit()
            }

            migrateAnalysisSpecification(dataSource)

            DriverManager.getConnection(dataSource.first, dataSource.second, dataSource.third).use { connection ->
                connection.prepareStatement(
                    """
                    SELECT publication_specification ->> 'schemaVersion'
                    FROM analysis_control.analysis_product_releases
                    """.trimIndent(),
                ).use { statement ->
                    statement.executeQuery().use { result ->
                        result.next() shouldBe true
                        result.getString(1) shouldBe "1"
                        result.next() shouldBe false
                    }
                }
                connection.autoCommit = false
                insertReleaseFixture(connection, schemaVersion = 2)
                connection.commit()
            }
        }
    }
})

private fun migrateAnalysisSpecification(
    dataSource: Triple<String, String, String>,
    target: String? = null,
) {
    val configuration = Flyway.configure()
        .dataSource(dataSource.first, dataSource.second, dataSource.third)
        .locations("classpath:db/migration")
    if (target != null) {
        configuration.target(MigrationVersion.fromVersion(target))
    }
    configuration.load().migrate()
}

private fun insertReleaseFixture(connection: Connection, schemaVersion: Int) {
    val productId = UUID.randomUUID()
    val draftId = UUID.randomUUID()
    val sourceDocument = """{"schemaVersion":1}"""
    val sourceDocumentHash = "a".repeat(64)
    val baseSchemaDigest = "b".repeat(64)
    val catalogRevision = "catalog-v1:test"
    connection.prepareStatement(
        """
        INSERT INTO analysis_control.analysis_products (
            id, team, lifecycle_state, last_release_number,
            created_by, updated_by
        )
        VALUES (?, 'team-a', 'DRAFT', 0, 'A123456', 'A123456')
        """.trimIndent(),
    ).use { statement ->
        statement.setObject(1, productId)
        statement.executeUpdate() shouldBe 1
    }
    connection.prepareStatement(
        """
        INSERT INTO analysis_control.analysis_product_drafts (
            id, team, product_id, revision, document, document_hash,
            validated_revision, validated_catalog_revision,
            validated_base_schema_digest, validated_by, validated_at,
            created_by, updated_by
        )
        VALUES (
            ?, 'team-a', ?, 1, ?::jsonb, ?,
            1, ?, ?, 'A123456', clock_timestamp(),
            'A123456', 'A123456'
        )
        """.trimIndent(),
    ).use { statement ->
        statement.setObject(1, draftId)
        statement.setObject(2, productId)
        statement.setString(3, sourceDocument)
        statement.setString(4, sourceDocumentHash)
        statement.setString(5, catalogRevision)
        statement.setString(6, baseSchemaDigest)
        statement.executeUpdate() shouldBe 1
    }
    connection.prepareStatement(
        """
        INSERT INTO analysis_control.analysis_product_releases (
            id, team, product_id, release_number,
            source_draft_id, source_draft_revision,
            source_document, source_document_hash,
            publication_specification, publication_specification_digest,
            catalog_revision, base_schema_digest, published_by
        )
        VALUES (
            gen_random_uuid(), 'team-a', ?, 1,
            ?, 1,
            ?::jsonb, ?,
            ?::jsonb, ?,
            ?, ?, 'A123456'
        )
        """.trimIndent(),
    ).use { statement ->
        statement.setObject(1, productId)
        statement.setObject(2, draftId)
        statement.setString(3, sourceDocument)
        statement.setString(4, sourceDocumentHash)
        statement.setString(5, """{"schemaVersion":$schemaVersion}""")
        statement.setString(6, "c".repeat(64))
        statement.setString(7, catalogRevision)
        statement.setString(8, baseSchemaDigest)
        statement.executeUpdate() shouldBe 1
    }
}
