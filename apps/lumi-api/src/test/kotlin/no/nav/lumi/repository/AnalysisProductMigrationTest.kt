package no.nav.lumi.repository

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import no.nav.lumi.TestDatabase
import java.sql.SQLException
import java.util.UUID
import java.util.concurrent.CountDownLatch

class AnalysisProductMigrationTest : FunSpec({
    beforeSpec { TestDatabase.initialize() }
    beforeTest { TestDatabase.clearAllData() }

    test("control plane is inaccessible to public and the legacy analysis role") {
        TestDatabase.dataSource.connection.use { connection ->
            connection.prepareStatement(
                "SELECT has_schema_privilege('esyfo-analyse', 'analysis_control', 'USAGE')",
            ).use { statement ->
                statement.executeQuery().use { result ->
                    result.next() shouldBe true
                    result.getBoolean(1) shouldBe false
                }
            }

            connection.prepareStatement(
                """
                    SELECT bool_and(
                        NOT has_table_privilege('esyfo-analyse', table_name, 'SELECT')
                    )
                    FROM unnest(ARRAY[
                        'analysis_control.analysis_products',
                        'analysis_control.analysis_product_drafts',
                        'analysis_control.analysis_product_releases',
                        'analysis_control.analysis_product_audit_events'
                    ]) AS table_name
                """.trimIndent(),
            ).use { statement ->
                statement.executeQuery().use { result ->
                    result.next() shouldBe true
                    result.getBoolean(1) shouldBe true
                }
            }

            connection.prepareStatement(
                """
                    SELECT NOT EXISTS (
                        SELECT 1
                        FROM pg_namespace AS n
                        CROSS JOIN LATERAL aclexplode(
                            COALESCE(n.nspacl, acldefault('n', n.nspowner))
                        ) AS acl
                        WHERE n.nspname = 'analysis_control'
                          AND acl.grantee = 0
                    )
                """.trimIndent(),
            ).use { statement ->
                statement.executeQuery().use { result ->
                    result.next() shouldBe true
                    result.getBoolean(1) shouldBe true
                }
            }

            connection.prepareStatement(
                """
                    SELECT NOT EXISTS (
                        SELECT 1
                        FROM pg_class AS c
                        JOIN pg_namespace AS n ON n.oid = c.relnamespace
                        CROSS JOIN LATERAL aclexplode(
                            COALESCE(c.relacl, acldefault('r', c.relowner))
                        ) AS acl
                        WHERE n.nspname = 'analysis_control'
                          AND c.relkind IN ('r', 'p')
                          AND acl.grantee = 0
                    )
                """.trimIndent(),
            ).use { statement ->
                statement.executeQuery().use { result ->
                    result.next() shouldBe true
                    result.getBoolean(1) shouldBe true
                }
            }
        }
    }

    test("database trigger enforces the ten product ceiling without repository help") {
        repeat(10) { insertProductOnly("team-a") }

        shouldThrow<SQLException> {
            insertProductOnly("team-a")
        }
        insertProductOnly("team-b")
    }

    test("database trigger serializes concurrent direct inserts at the product ceiling") {
        repeat(9) { insertProductOnly("team-a") }
        val ready = CountDownLatch(2)
        val start = CountDownLatch(1)

        val results = coroutineScope {
            List(2) {
                async(Dispatchers.IO) {
                    insertProductAtLimit("team-a", ready, start)
                }
            }.also {
                ready.await()
                start.countDown()
            }.awaitAll()
        }

        results.count(DirectInsertOutcome::succeeded) shouldBe 1
        results.single { !it.succeeded }.sqlState shouldBe "23514"
        countProducts("team-a") shouldBe 10
    }

    test("draft storage rejects missing schema version and partial validation evidence") {
        val emptyDocumentProduct = insertProductOnly("team-a")
        shouldThrow<SQLException> {
            insertDraft(
                productId = emptyDocumentProduct,
                document = "{}",
            )
        }

        val partialValidationProduct = insertProductOnly("team-a")
        shouldThrow<SQLException> {
            insertDraft(
                productId = partialValidationProduct,
                validatedRevision = 1,
                validatedCatalogRevision = "catalog-1",
                validatedBy = "A123456",
                hasValidatedAt = true,
            )
        }
    }

    test("release storage accepts only the exact validated draft provenance and next sequence") {
        val draft = insertValidatedDraft()
        val foreignDraft = insertValidatedDraft(team = draft.team)

        shouldThrow<SQLException> { insertRelease(draft, sourceDraftId = UUID.randomUUID()) }
        shouldThrow<SQLException> { insertRelease(draft, sourceDraftId = foreignDraft.draftId) }
        shouldThrow<SQLException> { insertRelease(draft, sourceDraftRevision = 2) }
        shouldThrow<SQLException> { insertRelease(draft, releaseNumber = 2) }
        shouldThrow<SQLException> {
            insertRelease(draft, sourceDocument = draft.document.replace("Kartlegging", "Changed"))
        }
        shouldThrow<SQLException> { insertRelease(draft, sourceDocumentHash = "d".repeat(64)) }
        shouldThrow<SQLException> { insertRelease(draft, catalogRevision = "catalog-2") }
        shouldThrow<SQLException> { insertRelease(draft, baseSchemaDigest = "d".repeat(64)) }
        shouldThrow<SQLException> { insertRelease(draft, publicationSpecification = "{}") }

        insertRelease(draft)
        executeUpdate(
            "DELETE FROM analysis_control.analysis_product_drafts WHERE id = ?",
            draft.draftId,
        ) shouldBe 1
    }

    test("audit storage rejects foreign references, mismatched digests and stale versions") {
        val draft = insertValidatedDraft()
        insertRelease(draft)
        val foreignDraft = insertValidatedDraft(team = draft.team)

        shouldThrow<SQLException> {
            insertAudit(
                draft = draft,
                eventType = "DRAFT_UPDATED",
                draftId = foreignDraft.draftId,
                draftRevision = 1,
                subjectDigest = foreignDraft.documentHash,
            )
        }
        shouldThrow<SQLException> {
            insertAudit(
                draft = draft,
                eventType = "RELEASE_DESIRED",
                releaseNumber = 2,
                subjectDigest = draft.publicationSpecificationDigest,
            )
        }
        shouldThrow<SQLException> {
            insertAudit(
                draft = draft,
                eventType = "RELEASE_DESIRED",
                releaseNumber = 1,
                subjectDigest = "d".repeat(64),
            )
        }
        shouldThrow<SQLException> {
            insertAudit(
                draft = draft,
                eventType = "DRAFT_UPDATED",
                productVersion = 2,
                draftId = draft.draftId,
                draftRevision = 1,
                subjectDigest = draft.documentHash,
            )
        }
    }

    test("release and audit history reject update delete and truncate") {
        val fixture = insertHistoryFixture()

        shouldThrow<SQLException> {
            executeUpdate(
                "UPDATE analysis_control.analysis_product_releases SET published_by = 'changed' WHERE id = ?",
                fixture.releaseId,
            )
        }
        shouldThrow<SQLException> {
            executeUpdate(
                "DELETE FROM analysis_control.analysis_product_releases WHERE id = ?",
                fixture.releaseId,
            )
        }
        shouldThrow<SQLException> {
            executeUpdate(
                "UPDATE analysis_control.analysis_product_audit_events SET actor_id = 'changed' WHERE id = ?",
                fixture.auditId,
            )
        }
        shouldThrow<SQLException> {
            executeUpdate(
                "DELETE FROM analysis_control.analysis_product_audit_events WHERE id = ?",
                fixture.auditId,
            )
        }
        shouldThrow<SQLException> {
            executeStatement("TRUNCATE TABLE analysis_control.analysis_product_releases")
        }
        shouldThrow<SQLException> {
            executeStatement("TRUNCATE TABLE analysis_control.analysis_product_audit_events")
        }
    }

    test("desired and active pointers cannot reference another product release") {
        val firstProductId = insertProductOnly(team = "team-a")
        val second = insertHistoryFixture(team = "team-a")

        shouldThrow<SQLException> {
            TestDatabase.dataSource.connection.use { connection ->
                connection.prepareStatement(
                    """
                        UPDATE analysis_control.analysis_products
                        SET last_release_number = 1, desired_release_number = 1
                        WHERE id = ?
                    """.trimIndent(),
                ).use { statement ->
                    statement.setObject(1, firstProductId)
                    statement.executeUpdate()
                }
                connection.commit()
            }
        }

        executeUpdate(
            """
                UPDATE analysis_control.analysis_products
                SET last_release_number = 1, desired_release_number = 1
                WHERE id = ?
            """.trimIndent(),
            second.productId,
        ) shouldBe 1
    }
})

private data class HistoryFixture(
    val productId: UUID,
    val releaseId: UUID,
    val auditId: UUID,
)

private data class DirectInsertOutcome(
    val succeeded: Boolean,
    val sqlState: String? = null,
)

private data class DraftFixture(
    val team: String,
    val productId: UUID,
    val draftId: UUID,
    val document: String,
    val documentHash: String = "a".repeat(64),
    val catalogRevision: String = "catalog-1",
    val baseSchemaDigest: String = "b".repeat(64),
    val publicationSpecification: String =
        """{"schemaVersion": 1, "pinnedDefinitionVersion": 7}""",
    val publicationSpecificationDigest: String = "c".repeat(64),
)

private fun insertProductOnly(team: String): UUID {
    val productId = UUID.randomUUID()
    TestDatabase.dataSource.connection.use { connection ->
        connection.prepareStatement(
            """
                INSERT INTO analysis_control.analysis_products (
                    id, team, created_by, updated_by
                ) VALUES (?, ?, 'A123456', 'A123456')
            """.trimIndent(),
        ).use { statement ->
            statement.setObject(1, productId)
            statement.setString(2, team)
            statement.executeUpdate()
        }
        connection.commit()
    }
    return productId
}

private fun insertProductAtLimit(
    team: String,
    ready: CountDownLatch,
    start: CountDownLatch,
): DirectInsertOutcome = TestDatabase.dataSource.connection.use { connection ->
    ready.countDown()
    start.await()
    try {
        connection.prepareStatement(
            """
                INSERT INTO analysis_control.analysis_products (
                    id, team, created_by, updated_by
                ) VALUES (?, ?, 'A123456', 'A123456')
            """.trimIndent(),
        ).use { statement ->
            statement.setObject(1, UUID.randomUUID())
            statement.setString(2, team)
            statement.executeUpdate()
        }
        connection.commit()
        DirectInsertOutcome(succeeded = true)
    } catch (error: SQLException) {
        connection.rollback()
        DirectInsertOutcome(succeeded = false, sqlState = error.sqlState)
    }
}

private fun countProducts(team: String): Int = TestDatabase.dataSource.connection.use { connection ->
    connection.prepareStatement(
        "SELECT count(*) FROM analysis_control.analysis_products WHERE team = ?",
    ).use { statement ->
        statement.setString(1, team)
        statement.executeQuery().use { result ->
            result.next()
            result.getInt(1)
        }
    }
}

@Suppress("LongParameterList")
private fun insertDraft(
    productId: UUID,
    team: String = "team-a",
    draftId: UUID = UUID.randomUUID(),
    document: String = validDocumentJson(),
    documentHash: String = "a".repeat(64),
    validatedRevision: Long? = null,
    validatedCatalogRevision: String? = null,
    validatedBaseSchemaDigest: String? = null,
    validatedBy: String? = null,
    hasValidatedAt: Boolean = false,
) {
    TestDatabase.dataSource.connection.use { connection ->
        connection.prepareStatement(
            """
                INSERT INTO analysis_control.analysis_product_drafts (
                    id, team, product_id, document, document_hash,
                    validated_revision, validated_catalog_revision,
                    validated_base_schema_digest, validated_by, validated_at,
                    created_by, updated_by
                ) VALUES (?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?,
                          CASE WHEN ? THEN clock_timestamp() END, 'A123456', 'A123456')
            """.trimIndent(),
        ).use { statement ->
            statement.setObject(1, draftId)
            statement.setString(2, team)
            statement.setObject(3, productId)
            statement.setString(4, document)
            statement.setString(5, documentHash)
            statement.setObject(6, validatedRevision)
            statement.setString(7, validatedCatalogRevision)
            statement.setString(8, validatedBaseSchemaDigest)
            statement.setString(9, validatedBy)
            statement.setBoolean(10, hasValidatedAt)
            statement.executeUpdate()
        }
        connection.commit()
    }
}

private fun insertValidatedDraft(
    team: String = "team-a",
    productId: UUID = insertProductOnly(team),
): DraftFixture {
    val fixture = DraftFixture(
        team = team,
        productId = productId,
        draftId = UUID.randomUUID(),
        document = validDocumentJson(),
    )
    insertDraft(
        productId = fixture.productId,
        team = fixture.team,
        draftId = fixture.draftId,
        document = fixture.document,
        documentHash = fixture.documentHash,
        validatedRevision = 1,
        validatedCatalogRevision = fixture.catalogRevision,
        validatedBaseSchemaDigest = fixture.baseSchemaDigest,
        validatedBy = "A123456",
        hasValidatedAt = true,
    )
    return fixture
}

@Suppress("LongParameterList")
private fun insertRelease(
    draft: DraftFixture,
    releaseNumber: Long = 1,
    sourceDraftId: UUID = draft.draftId,
    sourceDraftRevision: Long = 1,
    sourceDocument: String = draft.document,
    sourceDocumentHash: String = draft.documentHash,
    publicationSpecification: String = draft.publicationSpecification,
    publicationSpecificationDigest: String = draft.publicationSpecificationDigest,
    catalogRevision: String = draft.catalogRevision,
    baseSchemaDigest: String = draft.baseSchemaDigest,
): UUID {
    val releaseId = UUID.randomUUID()
    TestDatabase.dataSource.connection.use { connection ->
        connection.prepareStatement(
            """
                INSERT INTO analysis_control.analysis_product_releases (
                    id, team, product_id, release_number, source_draft_id,
                    source_draft_revision, source_document, source_document_hash,
                    publication_specification, publication_specification_digest,
                    catalog_revision, base_schema_digest, published_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?::jsonb, ?, ?, ?, 'A123456')
            """.trimIndent(),
        ).use { statement ->
            statement.setObject(1, releaseId)
            statement.setString(2, draft.team)
            statement.setObject(3, draft.productId)
            statement.setLong(4, releaseNumber)
            statement.setObject(5, sourceDraftId)
            statement.setLong(6, sourceDraftRevision)
            statement.setString(7, sourceDocument)
            statement.setString(8, sourceDocumentHash)
            statement.setString(9, publicationSpecification)
            statement.setString(10, publicationSpecificationDigest)
            statement.setString(11, catalogRevision)
            statement.setString(12, baseSchemaDigest)
            statement.executeUpdate()
        }
        connection.prepareStatement(
            """
                UPDATE analysis_control.analysis_products
                SET last_release_number = ?
                WHERE team = ? AND id = ?
            """.trimIndent(),
        ).use { statement ->
            statement.setLong(1, releaseNumber)
            statement.setString(2, draft.team)
            statement.setObject(3, draft.productId)
            statement.executeUpdate()
        }
        connection.commit()
    }
    return releaseId
}

@Suppress("LongParameterList")
private fun insertAudit(
    draft: DraftFixture,
    eventType: String,
    productVersion: Long = 1,
    draftId: UUID? = null,
    draftRevision: Long? = null,
    releaseNumber: Long? = null,
    subjectDigest: String? = null,
): UUID {
    val auditId = UUID.randomUUID()
    TestDatabase.dataSource.connection.use { connection ->
        connection.prepareStatement(
            """
                INSERT INTO analysis_control.analysis_product_audit_events (
                    id, team, product_id, event_number, event_type, actor_id,
                    product_version, draft_id, draft_revision, release_number, subject_digest
                ) VALUES (?, ?, ?, ?, ?, 'A123456', ?, ?, ?, ?, ?)
            """.trimIndent(),
        ).use { statement ->
            statement.setObject(1, auditId)
            statement.setString(2, draft.team)
            statement.setObject(3, draft.productId)
            statement.setLong(4, productVersion)
            statement.setString(5, eventType)
            statement.setLong(6, productVersion)
            statement.setObject(7, draftId)
            statement.setObject(8, draftRevision)
            statement.setObject(9, releaseNumber)
            statement.setString(10, subjectDigest)
            statement.executeUpdate()
        }
        connection.commit()
    }
    return auditId
}

private fun insertHistoryFixture(team: String = "team-a"): HistoryFixture {
    val draft = insertValidatedDraft(team)
    val releaseId = insertRelease(draft)
    val auditId = insertAudit(
        draft = draft,
        eventType = "RELEASE_PUBLISHED",
        releaseNumber = 1,
        subjectDigest = draft.publicationSpecificationDigest,
    )
    return HistoryFixture(draft.productId, releaseId, auditId)
}

private fun executeUpdate(sql: String, id: UUID): Int = TestDatabase.dataSource.connection.use { connection ->
    connection.prepareStatement(sql).use { statement ->
        statement.setObject(1, id)
        val updated = statement.executeUpdate()
        connection.commit()
        updated
    }
}

private fun executeStatement(sql: String) {
    TestDatabase.dataSource.connection.use { connection ->
        connection.createStatement().use { statement -> statement.execute(sql) }
        connection.commit()
    }
}

private fun validDocumentJson() = """
    {
      "schemaVersion": 1,
      "name": "Kartlegging",
      "purpose": "Analyse av strukturerte svar",
      "dataOwner": "data-owner@nav.no",
      "technicalOwner": "tech-owner@nav.no",
      "useCases": ["METABASE"],
      "retention": "SOURCE_MAXIMUM",
      "reviewDate": "2027-08-29"
    }
""".trimIndent()
