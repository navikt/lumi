package no.nav.lumi.repository

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import no.nav.lumi.TestDatabase
import no.nav.lumi.domain.AnalysisProductAuditEventType
import no.nav.lumi.domain.AnalysisProductDocumentV1
import no.nav.lumi.domain.AnalysisProductRetention
import no.nav.lumi.domain.AnalysisProductSourceSelection
import no.nav.lumi.domain.AnalysisProductUseCase
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID

class AnalysisProductRepositoryTest : FunSpec({
    val repository = AnalysisProductRepository(
        Clock.fixed(Instant.parse("2026-08-29T12:00:00Z"), ZoneOffset.UTC),
    )

    beforeSpec { TestDatabase.initialize() }
    beforeTest { TestDatabase.clearAllData() }

    test("creates product draft and audit atomically and scopes every read to team") {
        val product = repository.createProduct(team = "team-a")
        repository.createProduct(team = "team-b")

        product.team shouldBe "team-a"
        product.rowVersion shouldBe 1
        product.draft?.revision shouldBe 1
        product.draft?.createdBy shouldBe "A123456"

        repository.findByTeam("team-a").map { it.id } shouldBe listOf(product.id)
        repository.findById("team-b", UUID.fromString(product.id)) shouldBe null
        repository.findAuditEvents("team-b", UUID.fromString(product.id)) shouldBe null
        repository.findReleases("team-b", UUID.fromString(product.id)) shouldBe null

        val audit = repository.findAuditEvents("team-a", UUID.fromString(product.id))!!.single()
        audit.eventType shouldBe AnalysisProductAuditEventType.PRODUCT_CREATED
        audit.draftId shouldBe product.draft?.id
        audit.subjectDigest shouldBe product.draft?.documentHash
    }

    test("draft update uses draft identity and optimistic revision") {
        val product = repository.createProduct()
        val productId = UUID.fromString(product.id)
        val draftId = UUID.fromString(product.draft!!.id)
        markDraftValidatedForTest(productId)

        val updated = repository.updateDraft(
            team = "team-a",
            productId = productId,
            draftId = draftId,
            expectedRevision = 1,
            document = validDocument(name = "Updated"),
            principalIdentity = "A654321",
        ) as UpdateAnalysisProductDraftResult.Updated

        updated.product.rowVersion shouldBe 2
        updated.product.draft?.revision shouldBe 2
        updated.product.draft?.document?.name shouldBe "Updated"
        updated.product.draft?.updatedBy shouldBe "A654321"
        updated.product.draft?.validation shouldBe null

        repository.updateDraft(
            team = "team-a",
            productId = productId,
            draftId = draftId,
            expectedRevision = 1,
            document = validDocument(name = "Stale"),
            principalIdentity = "A111111",
        ) shouldBe UpdateAnalysisProductDraftResult.VersionConflict

        repository.updateDraft(
            team = "team-b",
            productId = productId,
            draftId = draftId,
            expectedRevision = 2,
            document = validDocument(name = "Foreign"),
            principalIdentity = "B111111",
        ) shouldBe UpdateAnalysisProductDraftResult.NotFound

        repository.findAuditEvents("team-a", productId)!!.map { it.eventType } shouldBe listOf(
            AnalysisProductAuditEventType.PRODUCT_CREATED,
            AnalysisProductAuditEventType.DRAFT_UPDATED,
        )
    }

    test("reads immutable releases only inside the owning team") {
        val product = repository.createProduct()
        val productId = UUID.fromString(product.id)
        val releaseId = insertReleaseForTest(productId)

        val release = repository.findReleases("team-a", productId)!!.single()
        release.id shouldBe releaseId.toString()
        release.productId shouldBe product.id
        release.releaseNumber shouldBe 1
        release.sourceDraftId shouldBe product.draft?.id
        release.sourceDocument.name shouldBe "Kartlegging"
        release.publicationSpecification["schemaVersion"]?.toString() shouldBe "1"
        release.publicationSpecification["pinnedDefinitionVersion"]?.toString() shouldBe "7"
        release.publicationSpecificationDigest shouldBe "c".repeat(64)

        repository.findReleases("team-b", productId) shouldBe null
        repository.findReleases("team-a", UUID.randomUUID()) shouldBe null
    }

    test("exactly one concurrent draft update wins") {
        val product = repository.createProduct()
        val productId = UUID.fromString(product.id)
        val draftId = UUID.fromString(product.draft!!.id)

        val results = coroutineScope {
            listOf("First", "Second").map { name ->
                async(Dispatchers.IO) {
                    repository.updateDraft(
                        team = "team-a",
                        productId = productId,
                        draftId = draftId,
                        expectedRevision = 1,
                        document = validDocument(name = name),
                        principalIdentity = "A123456",
                    )
                }
            }.awaitAll()
        }

        results.filterIsInstance<UpdateAnalysisProductDraftResult.Updated>() shouldHaveSize 1
        results.filterIsInstance<UpdateAnalysisProductDraftResult.VersionConflict>() shouldHaveSize 1
        repository.findById("team-a", productId)?.rowVersion shouldBe 2
        repository.findAuditEvents("team-a", productId)!! shouldHaveSize 2
    }

    test("concurrent creation cannot exceed ten non-deleted products per team") {
        repeat(9) { index -> repository.createProduct(name = "Product $index") }

        val results = coroutineScope {
            listOf("Tenth A", "Tenth B").map { name ->
                async(Dispatchers.IO) {
                    repository.create(
                        team = "team-a",
                        document = validDocument(name = name),
                        principalIdentity = "A123456",
                    )
                }
            }.awaitAll()
        }

        results.filterIsInstance<CreateAnalysisProductResult.Created>() shouldHaveSize 1
        results.filterIsInstance<CreateAnalysisProductResult.LimitReached>() shouldHaveSize 1
        repository.findByTeam("team-a") shouldHaveSize 10

        val otherTeamResult = repository.create(
            team = "team-b",
            document = validDocument(name = "Other team"),
            principalIdentity = "B123456",
        )
        (otherTeamResult is CreateAnalysisProductResult.Created) shouldBe true
    }

    test("audit failure rolls draft and aggregate version back") {
        val product = repository.createProduct()
        val productId = UUID.fromString(product.id)
        val draftId = UUID.fromString(product.draft!!.id)
        installRejectingAuditTrigger("DRAFT_UPDATED")

        try {
            shouldThrow<Exception> {
                repository.updateDraft(
                    team = "team-a",
                    productId = productId,
                    draftId = draftId,
                    expectedRevision = 1,
                    document = validDocument(name = "Must roll back"),
                    principalIdentity = "A123456",
                )
            }
        } finally {
            removeRejectingAuditTrigger()
        }

        val unchanged = repository.findById("team-a", productId)!!
        unchanged.rowVersion shouldBe 1
        unchanged.draft?.revision shouldBe 1
        unchanged.draft?.document?.name shouldBe "Kartlegging"
        repository.findAuditEvents("team-a", productId)!! shouldHaveSize 1
    }

    test("audit failure rolls product creation and its draft back") {
        installRejectingAuditTrigger("PRODUCT_CREATED")

        try {
            shouldThrow<Exception> {
                repository.create(
                    team = "team-a",
                    document = validDocument(),
                    principalIdentity = "A123456",
                )
            }
        } finally {
            removeRejectingAuditTrigger()
        }

        repository.findByTeam("team-a") shouldHaveSize 0
    }
})

private suspend fun AnalysisProductRepository.createProduct(
    team: String = "team-a",
    name: String = "Kartlegging",
) = (create(team, validDocument(name), "A123456") as CreateAnalysisProductResult.Created).product

private fun validDocument(name: String = "Kartlegging") = AnalysisProductDocumentV1(
    name = name,
    purpose = "Analyse av strukturerte svar",
    dataOwner = "data-owner@nav.no",
    technicalOwner = "tech-owner@nav.no",
    useCases = listOf(AnalysisProductUseCase.METABASE),
    retention = AnalysisProductRetention.SOURCE_MAXIMUM,
    reviewDate = "2027-08-29",
    sources = listOf(
        AnalysisProductSourceSelection("app-a", "survey-a", listOf("field-a")),
    ),
)

private fun markDraftValidatedForTest(productId: UUID) {
    TestDatabase.dataSource.connection.use { connection ->
        connection.prepareStatement(
            """
                UPDATE analysis_control.analysis_product_drafts
                SET validated_revision = revision,
                    validated_catalog_revision = 'catalog-1',
                    validated_base_schema_digest = ?,
                    validated_by = 'A123456',
                    validated_at = clock_timestamp()
                WHERE product_id = ?
            """.trimIndent(),
        ).use { statement ->
            statement.setString(1, "b".repeat(64))
            statement.setObject(2, productId)
            statement.executeUpdate() shouldBe 1
        }
        connection.commit()
    }
}

private fun insertReleaseForTest(productId: UUID): UUID {
    val releaseId = UUID.randomUUID()
    markDraftValidatedForTest(productId)
    TestDatabase.dataSource.connection.use { connection ->
        connection.prepareStatement(
            """
                INSERT INTO analysis_control.analysis_product_releases (
                    id, team, product_id, release_number, source_draft_id,
                    source_draft_revision, source_document, source_document_hash,
                    publication_specification, publication_specification_digest,
                    catalog_revision, base_schema_digest, published_by
                )
                SELECT ?, team, product_id, 1, id, revision, document, document_hash,
                       '{"schemaVersion": 1, "pinnedDefinitionVersion": 7}'::jsonb,
                       ?, 'catalog-1', ?, 'A123456'
                FROM analysis_control.analysis_product_drafts
                WHERE product_id = ?
            """.trimIndent(),
        ).use { statement ->
            statement.setObject(1, releaseId)
            statement.setString(2, "c".repeat(64))
            statement.setString(3, "b".repeat(64))
            statement.setObject(4, productId)
            statement.executeUpdate() shouldBe 1
        }
        connection.prepareStatement(
            """
                UPDATE analysis_control.analysis_products
                SET last_release_number = 1
                WHERE id = ?
            """.trimIndent(),
        ).use { statement ->
            statement.setObject(1, productId)
            statement.executeUpdate() shouldBe 1
        }
        connection.commit()
    }
    return releaseId
}

private fun installRejectingAuditTrigger(eventType: String) {
    TestDatabase.dataSource.connection.use { connection ->
        connection.createStatement().use { statement ->
            statement.execute(
                """
                    CREATE FUNCTION analysis_control.reject_audit_for_test()
                    RETURNS TRIGGER
                    LANGUAGE plpgsql
                    AS ${'$'}${'$'}
                    BEGIN
                        IF NEW.event_type = TG_ARGV[0] THEN
                            RAISE EXCEPTION 'reject audit for test';
                        END IF;
                        RETURN NEW;
                    END;
                    ${'$'}${'$'}
                """.trimIndent(),
            )
            statement.execute(
                """
                    CREATE TRIGGER trg_reject_audit_for_test
                    BEFORE INSERT ON analysis_control.analysis_product_audit_events
                    FOR EACH ROW
                    EXECUTE FUNCTION analysis_control.reject_audit_for_test('$eventType')
                """.trimIndent(),
            )
        }
        connection.commit()
    }
}

private fun removeRejectingAuditTrigger() {
    TestDatabase.dataSource.connection.use { connection ->
        connection.createStatement().use { statement ->
            statement.execute(
                "DROP TRIGGER IF EXISTS trg_reject_audit_for_test " +
                    "ON analysis_control.analysis_product_audit_events",
            )
            statement.execute("DROP FUNCTION IF EXISTS analysis_control.reject_audit_for_test()")
        }
        connection.commit()
    }
}
