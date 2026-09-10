package no.nav.lumi.repository

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import no.nav.lumi.PsqlContainer
import org.flywaydb.core.Flyway
import org.flywaydb.core.api.MigrationVersion
import org.testcontainers.containers.wait.strategy.HostPortWaitStrategy
import java.sql.Connection
import java.sql.DriverManager
import java.util.UUID

class AnalysisProductTransitionMigrationTest : FunSpec({
    test("upgrades representative V25 control states and history to V26") {
        PsqlContainer().apply {
            withDatabaseName("lumi_analysis_transition_migration_test")
            withUsername("test")
            withPassword("test")
            setWaitStrategy(HostPortWaitStrategy())
        }.use { container ->
            container.start()
            val database = Triple(container.jdbcUrl, container.username, container.password)
            migrateAnalysisProductTransitions(database, target = "25")

            DriverManager.getConnection(database.first, database.second, database.third).use { connection ->
                connection.autoCommit = false
                val draftProduct = insertV25Product(connection, "DRAFT")
                insertV25CreatedAudit(connection, draftProduct)
                insertV25Generation(connection, draftProduct.productId, "DRAFT", "NONE")

                insertV25Product(connection, "ENABLED", withRelease = true)
                val offboarding = insertV25Product(connection, "OFFBOARDING")
                insertV25Generation(connection, offboarding.productId, "OFFBOARDING", "OFFBOARDING")
                connection.commit()
            }

            migrateAnalysisProductTransitions(database)

            DriverManager.getConnection(database.first, database.second, database.third).use { connection ->
                connection.prepareStatement(
                    """
                        SELECT lifecycle_state, count(*)
                        FROM analysis_control.analysis_products
                        GROUP BY lifecycle_state
                        ORDER BY lifecycle_state
                    """.trimIndent(),
                ).use { statement ->
                    statement.executeQuery().use { result ->
                        buildMap {
                            while (result.next()) put(result.getString(1), result.getInt(2))
                        } shouldBe mapOf("DRAFT" to 1, "ENABLED" to 1, "OFFBOARDING" to 1)
                    }
                }
                connection.prepareStatement(
                    "SELECT bool_and(created_transaction_id IS NOT NULL) " +
                        "FROM analysis_control.analysis_product_audit_events",
                ).use { statement ->
                    statement.executeQuery().use { result ->
                        result.next() shouldBe true
                        result.getBoolean(1) shouldBe true
                    }
                }
                connection.prepareStatement(
                    "SELECT to_regclass('analysis_control.analysis_product_snapshot_activations') IS NOT NULL",
                ).use { statement ->
                    statement.executeQuery().use { result ->
                        result.next() shouldBe true
                        result.getBoolean(1) shouldBe true
                    }
                }
            }
        }
    }

    test("rejects a pre-V26 paused product without a verified snapshot activation") {
        withV25TransitionDatabase("paused") { database ->
            DriverManager.getConnection(database.first, database.second, database.third).use { connection ->
                connection.autoCommit = false
                insertV25Product(connection, "PAUSED", withRelease = true)
                connection.commit()
            }

            val failure = shouldThrow<Exception> { migrateAnalysisProductTransitions(database) }
            failure.allMessages() shouldContain "pre-V26 paused analysis products require explicit cutoff remediation"
        }
    }

    test("rejects duplicate effective generations for one product version") {
        withV25TransitionDatabase("duplicate_generation") { database ->
            DriverManager.getConnection(database.first, database.second, database.third).use { connection ->
                connection.autoCommit = false
                val product = insertV25Product(connection, "DRAFT")
                insertV25Generation(connection, product.productId, "DRAFT", "NONE", generation = 1)
                insertV25Generation(connection, product.productId, "DRAFT", "NONE", generation = 2)
                connection.commit()
            }

            val failure = shouldThrow<Exception> { migrateAnalysisProductTransitions(database) }
            failure.allMessages() shouldContain "duplicate immutable effective generations"
        }
    }

    test("rejects a product release counter that disagrees with immutable history") {
        withV25TransitionDatabase("release_counter") { database ->
            DriverManager.getConnection(database.first, database.second, database.third).use { connection ->
                connection.autoCommit = false
                val product = insertV25Product(connection, "ENABLED", withRelease = true)
                connection.prepareStatement(
                    "UPDATE analysis_control.analysis_products SET last_release_number = 2 WHERE id = ?",
                ).use { statement ->
                    statement.setObject(1, product.productId)
                    statement.executeUpdate() shouldBe 1
                }
                connection.commit()
            }

            val failure = shouldThrow<Exception> { migrateAnalysisProductTransitions(database) }
            failure.allMessages() shouldContain "release counter does not match immutable release history"
        }
    }

    test("rejects a pre-V26 product with an invalid control shape") {
        withV25TransitionDatabase("invalid_shape") { database ->
            DriverManager.getConnection(database.first, database.second, database.third).use { connection ->
                connection.autoCommit = false
                insertV25Product(connection, "DRAFT", withRelease = true)
                connection.commit()
            }

            val failure = shouldThrow<Exception> { migrateAnalysisProductTransitions(database) }
            failure.allMessages() shouldContain "chk_analysis_product_control_shape"
        }
    }

    test("rejects a pre-V26 product whose desired release is older than its active release") {
        withV25TransitionDatabase("release_order") { database ->
            DriverManager.getConnection(database.first, database.second, database.third).use { connection ->
                connection.autoCommit = false
                val product = insertV25Product(connection, "ENABLED", withRelease = true)
                connection.prepareStatement(
                    """
                        INSERT INTO analysis_control.analysis_product_releases (
                            id, team, product_id, release_number,
                            source_draft_id, source_draft_revision,
                            source_document, source_document_hash,
                            publication_specification, publication_specification_digest,
                            catalog_revision, base_schema_digest, published_by
                        )
                        SELECT gen_random_uuid(), team, product_id, 2,
                               source_draft_id, source_draft_revision,
                               source_document, source_document_hash,
                               publication_specification, publication_specification_digest,
                               catalog_revision, base_schema_digest, published_by
                        FROM analysis_control.analysis_product_releases
                        WHERE product_id = ? AND release_number = 1
                    """.trimIndent(),
                ).use { statement ->
                    statement.setObject(1, product.productId)
                    statement.executeUpdate() shouldBe 1
                }
                connection.prepareStatement(
                    """
                        UPDATE analysis_control.analysis_products
                        SET last_release_number = 2,
                            desired_release_number = 1,
                            active_release_number = 2
                        WHERE id = ?
                    """.trimIndent(),
                ).use { statement ->
                    statement.setObject(1, product.productId)
                    statement.executeUpdate() shouldBe 1
                }
                connection.commit()
            }

            val failure = shouldThrow<Exception> { migrateAnalysisProductTransitions(database) }
            failure.allMessages() shouldContain "chk_analysis_product_release_order"
        }
    }
})

private data class V25ProductFixture(
    val productId: UUID,
    val draftId: UUID,
    val documentHash: String,
)

private fun migrateAnalysisProductTransitions(
    database: Triple<String, String, String>,
    target: String? = null,
) {
    val configuration = Flyway.configure()
        .dataSource(database.first, database.second, database.third)
        .locations("classpath:db/migration")
    if (target != null) configuration.target(MigrationVersion.fromVersion(target))
    configuration.load().migrate()
}

private fun withV25TransitionDatabase(
    suffix: String,
    block: (Triple<String, String, String>) -> Unit,
) {
    PsqlContainer().apply {
        withDatabaseName("lumi_analysis_transition_$suffix")
        withUsername("test")
        withPassword("test")
        setWaitStrategy(HostPortWaitStrategy())
    }.use { container ->
        container.start()
        val database = Triple(container.jdbcUrl, container.username, container.password)
        migrateAnalysisProductTransitions(database, target = "25")
        block(database)
    }
}

private fun Throwable.allMessages(): String = generateSequence(this) { it.cause }
    .mapNotNull { it.message }
    .joinToString("\n")

private fun insertV25Product(
    connection: Connection,
    lifecycle: String,
    withRelease: Boolean = false,
): V25ProductFixture {
    val productId = UUID.randomUUID()
    val draftId = UUID.randomUUID()
    val document = """
        {
          "schemaVersion": 1,
          "name": "Migration fixture",
          "purpose": "Upgrade verification",
          "dataOwner": "owner@nav.no",
          "technicalOwner": "tech@nav.no",
          "useCases": ["METABASE"],
          "retention": "DAYS_90",
          "reviewDate": "2027-08-29",
          "sources": []
        }
    """.trimIndent()
    val documentHash = "a".repeat(64)
    val catalogRevision = "catalog-v2"
    val schemaDigest = "b".repeat(64)

    connection.prepareStatement(
        """
            INSERT INTO analysis_control.analysis_products (id, team, created_by, updated_by)
            VALUES (?, 'migration-team', 'A123456', 'A123456')
        """.trimIndent(),
    ).use { statement ->
        statement.setObject(1, productId)
        statement.executeUpdate() shouldBe 1
    }
    connection.prepareStatement(
        """
            INSERT INTO analysis_control.analysis_product_drafts (
                id, team, product_id, document, document_hash,
                validated_revision, validated_catalog_revision,
                validated_base_schema_digest, validated_by, validated_at,
                created_by, updated_by
            ) VALUES (
                ?, 'migration-team', ?, ?::jsonb, ?,
                1, ?, ?, 'A123456', clock_timestamp(),
                'A123456', 'A123456'
            )
        """.trimIndent(),
    ).use { statement ->
        statement.setObject(1, draftId)
        statement.setObject(2, productId)
        statement.setString(3, document)
        statement.setString(4, documentHash)
        statement.setString(5, catalogRevision)
        statement.setString(6, schemaDigest)
        statement.executeUpdate() shouldBe 1
    }

    if (withRelease) {
        connection.prepareStatement(
            """
                INSERT INTO analysis_control.analysis_product_releases (
                    id, team, product_id, release_number,
                    source_draft_id, source_draft_revision,
                    source_document, source_document_hash,
                    publication_specification, publication_specification_digest,
                    catalog_revision, base_schema_digest, published_by
                ) VALUES (
                    gen_random_uuid(), 'migration-team', ?, 1,
                    ?, 1, ?::jsonb, ?, '{"schemaVersion":2}'::jsonb, ?,
                    ?, ?, 'A123456'
                )
            """.trimIndent(),
        ).use { statement ->
            statement.setObject(1, productId)
            statement.setObject(2, draftId)
            statement.setString(3, document)
            statement.setString(4, documentHash)
            statement.setString(5, "c".repeat(64))
            statement.setString(6, catalogRevision)
            statement.setString(7, schemaDigest)
            statement.executeUpdate() shouldBe 1
        }
    }

    connection.prepareStatement(
        """
            UPDATE analysis_control.analysis_products
            SET lifecycle_state = ?,
                last_release_number = ?,
                desired_release_number = ?,
                active_release_number = ?,
                data_cutoff_at = ?::timestamptz
            WHERE team = 'migration-team' AND id = ?
        """.trimIndent(),
    ).use { statement ->
        val releaseNumber = 1L.takeIf { withRelease }
        statement.setString(1, lifecycle)
        statement.setLong(2, releaseNumber ?: 0)
        statement.setObject(3, releaseNumber)
        statement.setObject(4, releaseNumber)
        statement.setString(5, "2026-08-29T12:00:00Z".takeIf { lifecycle == "PAUSED" })
        statement.setObject(6, productId)
        statement.executeUpdate() shouldBe 1
    }
    return V25ProductFixture(productId, draftId, documentHash)
}

private fun insertV25CreatedAudit(connection: Connection, fixture: V25ProductFixture) {
    connection.prepareStatement(
        """
            INSERT INTO analysis_control.analysis_product_audit_events (
                id, team, product_id, event_number, event_type, actor_id,
                product_version, draft_id, draft_revision, subject_digest, next_state
            ) VALUES (
                gen_random_uuid(), 'migration-team', ?, 1, 'PRODUCT_CREATED', 'A123456',
                1, ?, 1, ?, 'DRAFT'
            )
        """.trimIndent(),
    ).use { statement ->
        statement.setObject(1, fixture.productId)
        statement.setObject(2, fixture.draftId)
        statement.setString(3, fixture.documentHash)
        statement.executeUpdate() shouldBe 1
    }
}

private fun insertV25Generation(
    connection: Connection,
    productId: UUID,
    lifecycle: String,
    planKind: String,
    generation: Long = 1,
    productRowVersion: Long = 1,
) {
    connection.prepareStatement(
        """
            INSERT INTO analysis_control.analysis_effective_plan_generations (
                id, team, product_id, generation, product_row_version,
                plan_kind, lifecycle_state, plan_digest
            ) VALUES (
                gen_random_uuid(), 'migration-team', ?, ?, ?, ?, ?, ?
            )
        """.trimIndent(),
    ).use { statement ->
        statement.setObject(1, productId)
        statement.setLong(2, generation)
        statement.setLong(3, productRowVersion)
        statement.setString(4, planKind)
        statement.setString(5, lifecycle)
        statement.setString(6, "d".repeat(64))
        statement.executeUpdate() shouldBe 1
    }
}
