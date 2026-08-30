package no.nav.lumi.repository

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.encodeToString
import no.nav.lumi.TestDatabase
import no.nav.lumi.domain.ANALYSIS_EXCLUDED_DATA_CATEGORIES_V1
import no.nav.lumi.domain.AnalysisContractJson
import no.nav.lumi.domain.AnalysisDefinitionFieldPinV1
import no.nav.lumi.domain.AnalysisDefinitionPinV1
import no.nav.lumi.domain.AnalysisFieldDependenciesV1
import no.nav.lumi.domain.AnalysisFieldPresence
import no.nav.lumi.domain.AnalysisFlowPinV1
import no.nav.lumi.domain.AnalysisProductDocumentV1
import no.nav.lumi.domain.AnalysisProductLifecycleState
import no.nav.lumi.domain.AnalysisProductRetention
import no.nav.lumi.domain.AnalysisProductSourceSelection
import no.nav.lumi.domain.AnalysisProductUseCase
import no.nav.lumi.domain.AnalysisPublicationResourceCompilerV2
import no.nav.lumi.domain.AnalysisPublicationSpecificationDigests
import no.nav.lumi.domain.AnalysisPublicationSpecificationV2
import no.nav.lumi.domain.AnalysisSourcePinV2
import no.nav.lumi.domain.FieldType
import no.nav.lumi.domain.RatingVariant
import no.nav.lumi.domain.SURVEY_FLOW_EVALUATOR_VERSION
import no.nav.lumi.domain.SurveyType
import java.sql.SQLException
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID

class AnalysisProductTransitionRepositoryTest : FunSpec({
    val repository = AnalysisProductRepository(
        Clock.fixed(Instant.parse("2026-08-30T12:00:00Z"), ZoneOffset.UTC),
    )

    beforeSpec { TestDatabase.initialize() }
    beforeTest { TestDatabase.clearAllData() }

    test("desires only the newest immutable V2 release and seals the change atomically") {
        val fixture = createProductWithRelease(repository)

        val changed = repository.desireRelease(
            team = fixture.team,
            productId = fixture.productId,
            expectedProductVersion = 1,
            releaseNumber = 1,
            principalIdentity = "A123456",
        ) as ChangeAnalysisProductStateResult.Changed

        changed.product.lifecycleState shouldBe AnalysisProductLifecycleState.DRAFT
        changed.product.desiredReleaseNumber shouldBe 1
        changed.product.rowVersion shouldBe 2
        changed.effectiveGeneration.planKind shouldBe EffectivePlanKind.NONE
        changed.effectiveGeneration.productRowVersion shouldBe 2
        repository.findAuditEvents(fixture.team, fixture.productId)!!.map { it.eventType.name } shouldBe
            listOf("PRODUCT_CREATED", "RELEASE_DESIRED")

        repository.desireRelease(
            team = fixture.team,
            productId = fixture.productId,
            expectedProductVersion = 2,
            releaseNumber = 1,
            principalIdentity = "A123456",
        ) shouldBe ChangeAnalysisProductStateResult.Unchanged(changed.product)
        countEffectiveGenerations(fixture.productId) shouldBe 1
    }

    test("activates a desired release and records the initial lifecycle change in the same audit event") {
        val fixture = createProductWithRelease(repository)
        repository.desireRelease(
            fixture.team,
            fixture.productId,
            expectedProductVersion = 1,
            releaseNumber = 1,
            principalIdentity = "A123456",
        )

        val changed = repository.activateDesiredRelease(
            team = fixture.team,
            productId = fixture.productId,
            expectedProductVersion = 2,
            principalIdentity = "reconciler:lumi-analysis",
        ) as ChangeAnalysisProductStateResult.Changed

        changed.product.lifecycleState shouldBe AnalysisProductLifecycleState.ENABLED
        changed.product.activeReleaseNumber shouldBe 1
        changed.product.desiredReleaseNumber shouldBe 1
        changed.effectiveGeneration.planKind shouldBe EffectivePlanKind.ENABLED
        val audit = repository.findAuditEvents(fixture.team, fixture.productId)!!.last()
        audit.eventType.name shouldBe "RELEASE_ACTIVATED"
        audit.releaseNumber shouldBe 1
        audit.previousState shouldBe AnalysisProductLifecycleState.DRAFT
        audit.nextState shouldBe AnalysisProductLifecycleState.ENABLED
    }

    test("pause freezes a database timestamp, resume clears it, and both keep purge scope sealed") {
        val fixture = createEnabledProduct(repository)

        val paused = repository.pause(
            fixture.team,
            fixture.productId,
            expectedProductVersion = 3,
            principalIdentity = "A123456",
        ) as ChangeAnalysisProductStateResult.Changed

        paused.product.lifecycleState shouldBe AnalysisProductLifecycleState.PAUSED
        paused.product.dataCutoffAt shouldBe paused.effectiveGeneration.dataCutoffAt.toString()
        paused.effectiveGeneration.planKind shouldBe EffectivePlanKind.PAUSED

        val resumed = repository.resume(
            fixture.team,
            fixture.productId,
            expectedProductVersion = 4,
            principalIdentity = "A123456",
        ) as ChangeAnalysisProductStateResult.Changed

        resumed.product.lifecycleState shouldBe AnalysisProductLifecycleState.ENABLED
        resumed.product.dataCutoffAt shouldBe null
        resumed.effectiveGeneration.planKind shouldBe EffectivePlanKind.ENABLED
        repository.findAuditEvents(fixture.team, fixture.productId)!!.takeLast(2).map {
            it.previousState to it.nextState
        } shouldBe listOf(
            AnalysisProductLifecycleState.ENABLED to AnalysisProductLifecycleState.PAUSED,
            AnalysisProductLifecycleState.PAUSED to AnalysisProductLifecycleState.ENABLED,
        )
    }

    test("moves a newer release through candidate and activation without allowing rollback") {
        val fixture = createEnabledProduct(repository)
        insertTransitionRelease(fixture.productId, fixture.team, schemaVersion = 2, releaseNumber = 2)

        val desired = repository.desireRelease(
            fixture.team,
            fixture.productId,
            expectedProductVersion = 3,
            releaseNumber = 2,
            principalIdentity = "A123456",
        ) as ChangeAnalysisProductStateResult.Changed
        desired.product.activeReleaseNumber shouldBe 1
        desired.product.desiredReleaseNumber shouldBe 2
        desired.effectiveGeneration.generation shouldBe 3

        val activated = repository.activateDesiredRelease(
            fixture.team,
            fixture.productId,
            expectedProductVersion = 4,
            principalIdentity = "reconciler:lumi-analysis",
        ) as ChangeAnalysisProductStateResult.Changed
        activated.product.activeReleaseNumber shouldBe 2
        activated.product.desiredReleaseNumber shouldBe 2
        activated.effectiveGeneration.generation shouldBe 4

        repository.desireRelease(
            fixture.team,
            fixture.productId,
            expectedProductVersion = 5,
            releaseNumber = 1,
            principalIdentity = "A123456",
        ) shouldBe ChangeAnalysisProductStateResult.Rejected(
            AnalysisProductTransitionRejection.RELEASE_NOT_FORWARD,
        )
    }

    test("offboarding is fail closed and cannot be resumed or assigned a release") {
        val fixture = createEnabledProduct(repository)

        val offboarding = repository.beginOffboarding(
            fixture.team,
            fixture.productId,
            expectedProductVersion = 3,
            principalIdentity = "A123456",
        ) as ChangeAnalysisProductStateResult.Changed

        offboarding.product.lifecycleState shouldBe AnalysisProductLifecycleState.OFFBOARDING
        offboarding.effectiveGeneration.planKind shouldBe EffectivePlanKind.OFFBOARDING

        repository.resume(
            fixture.team,
            fixture.productId,
            expectedProductVersion = 4,
            principalIdentity = "A123456",
        ) shouldBe ChangeAnalysisProductStateResult.Rejected(
            AnalysisProductTransitionRejection.INVALID_LIFECYCLE,
        )
        repository.desireRelease(
            fixture.team,
            fixture.productId,
            expectedProductVersion = 4,
            releaseNumber = 1,
            principalIdentity = "A123456",
        ) shouldBe ChangeAnalysisProductStateResult.Rejected(
            AnalysisProductTransitionRejection.INVALID_LIFECYCLE,
        )
    }

    test("rejects stale, foreign, missing, legacy, and backwards release transitions without leaking state") {
        val fixture = createProductWithRelease(repository)

        repository.desireRelease(
            team = "another-team",
            productId = fixture.productId,
            expectedProductVersion = 1,
            releaseNumber = 1,
            principalIdentity = "B123456",
        ) shouldBe ChangeAnalysisProductStateResult.NotFound
        repository.desireRelease(
            fixture.team,
            fixture.productId,
            expectedProductVersion = 99,
            releaseNumber = 1,
            principalIdentity = "A123456",
        ) shouldBe ChangeAnalysisProductStateResult.VersionConflict
        repository.desireRelease(
            fixture.team,
            fixture.productId,
            expectedProductVersion = 1,
            releaseNumber = 2,
            principalIdentity = "A123456",
        ) shouldBe ChangeAnalysisProductStateResult.Rejected(
            AnalysisProductTransitionRejection.RELEASE_UNAVAILABLE,
        )

        val legacy = createProductWithRelease(repository, team = "team-legacy", schemaVersion = 1)
        repository.desireRelease(
            legacy.team,
            legacy.productId,
            expectedProductVersion = 1,
            releaseNumber = 1,
            principalIdentity = "A123456",
        ) shouldBe ChangeAnalysisProductStateResult.Rejected(
            AnalysisProductTransitionRejection.RELEASE_NOT_V2,
        )
        countEffectiveGenerations(fixture.productId) shouldBe 0
        repository.findAuditEvents(fixture.team, fixture.productId)!! shouldHaveSize 1
    }

    test("only one concurrent command wins an expected product version") {
        val fixture = createEnabledProduct(repository)

        val results = coroutineScope {
            listOf("A123456", "A654321").map { actor ->
                async(Dispatchers.IO) {
                    repository.pause(
                        fixture.team,
                        fixture.productId,
                        expectedProductVersion = 3,
                        principalIdentity = actor,
                    )
                }
            }.awaitAll()
        }

        results.filterIsInstance<ChangeAnalysisProductStateResult.Changed>() shouldHaveSize 1
        results.filterIsInstance<ChangeAnalysisProductStateResult.VersionConflict>() shouldHaveSize 1
        countEffectiveGenerations(fixture.productId) shouldBe 3
    }

    test("audit or generation failure rolls the entire control transition back") {
        val fixture = createProductWithRelease(repository)
        installRejectingTrigger(
            table = "analysis_effective_plan_generations",
            trigger = "reject_generation_for_transition_test",
        )

        try {
            shouldThrow<SQLException> {
                repository.desireRelease(
                    fixture.team,
                    fixture.productId,
                    expectedProductVersion = 1,
                    releaseNumber = 1,
                    principalIdentity = "A123456",
                )
            }
        } finally {
            removeRejectingTrigger(
                table = "analysis_effective_plan_generations",
                trigger = "reject_generation_for_transition_test",
            )
        }

        val unchanged = repository.findById(fixture.team, fixture.productId)!!
        unchanged.rowVersion shouldBe 1
        unchanged.desiredReleaseNumber shouldBe null
        repository.findAuditEvents(fixture.team, fixture.productId)!! shouldHaveSize 1
        countEffectiveGenerations(fixture.productId) shouldBe 0
    }

    test("database rejects control writes that omit either semantic audit or effective generation") {
        val fixture = createProductWithRelease(repository)

        shouldThrow<SQLException> {
            commitDesiredControlDirectly(fixture, includeAudit = false)
        }.sqlState shouldBe "23514"
        shouldThrow<SQLException> {
            commitDesiredControlDirectly(fixture, includeAudit = true)
        }.sqlState shouldBe "40001"

        val unchanged = repository.findById(fixture.team, fixture.productId)!!
        unchanged.rowVersion shouldBe 1
        unchanged.desiredReleaseNumber shouldBe null
        repository.findAuditEvents(fixture.team, fixture.productId)!! shouldHaveSize 1
        countEffectiveGenerations(fixture.productId) shouldBe 0
    }

    test("database rejects release rollback and lifecycle reversal before audit or generation can be forged") {
        val fixture = createEnabledProduct(repository)
        insertTransitionRelease(fixture.productId, fixture.team, schemaVersion = 2, releaseNumber = 2)
        repository.desireRelease(
            fixture.team,
            fixture.productId,
            expectedProductVersion = 3,
            releaseNumber = 2,
            principalIdentity = "A123456",
        )
        repository.activateDesiredRelease(
            fixture.team,
            fixture.productId,
            expectedProductVersion = 4,
            principalIdentity = "reconciler:lumi-analysis",
        )

        shouldThrow<SQLException> {
            executeRejectedControlUpdate(fixture, "desired_release_number = 1")
        }.sqlState shouldBe "23514"
        shouldThrow<SQLException> {
            executeRejectedControlUpdate(fixture, "lifecycle_state = 'DRAFT'")
        }.sqlState shouldBe "23514"
    }
})

private data class TransitionFixture(
    val team: String,
    val productId: UUID,
)

private suspend fun createProductWithRelease(
    repository: AnalysisProductRepository,
    team: String = "team-a",
    schemaVersion: Int = 2,
): TransitionFixture {
    val product = (repository.create(team, transitionDocument(), "A123456") as CreateAnalysisProductResult.Created).product
    val productId = UUID.fromString(product.id)
    insertTransitionRelease(productId, team, schemaVersion)
    return TransitionFixture(team, productId)
}

private suspend fun createEnabledProduct(repository: AnalysisProductRepository): TransitionFixture =
    createProductWithRelease(repository).also { fixture ->
        repository.desireRelease(
            fixture.team,
            fixture.productId,
            expectedProductVersion = 1,
            releaseNumber = 1,
            principalIdentity = "A123456",
        )
        repository.activateDesiredRelease(
            fixture.team,
            fixture.productId,
            expectedProductVersion = 2,
            principalIdentity = "reconciler:lumi-analysis",
        )
    }

private fun transitionDocument() = AnalysisProductDocumentV1(
    name = "Arbeidsmiljø",
    purpose = "Analyse av strukturerte svar",
    dataOwner = "data-owner@nav.no",
    technicalOwner = "tech-owner@nav.no",
    useCases = listOf(AnalysisProductUseCase.METABASE),
    retention = AnalysisProductRetention.DAYS_90,
    reviewDate = "2027-08-29",
    sources = listOf(AnalysisProductSourceSelection("survey-app", "work-environment", listOf("score"))),
)

private fun insertTransitionRelease(
    productId: UUID,
    team: String,
    schemaVersion: Int,
    releaseNumber: Long = 1,
) {
    val specification = transitionSpecification(productId, team)
    val specificationJson = if (schemaVersion == 2) {
        AnalysisContractJson.encodeToString(specification)
    } else {
        """{"schemaVersion":1}"""
    }
    val specificationDigest = if (schemaVersion == 2) {
        AnalysisPublicationSpecificationDigests.specification(specification)
    } else {
        "c".repeat(64)
    }

    TestDatabase.dataSource.connection.use { connection ->
        val draft = connection.prepareStatement(
            "SELECT id, revision, document, document_hash FROM analysis_control.analysis_product_drafts " +
                "WHERE team = ? AND product_id = ?",
        ).use { statement ->
            statement.setString(1, team)
            statement.setObject(2, productId)
            statement.executeQuery().use { result ->
                check(result.next())
                DraftReleaseSource(
                    id = result.getObject("id", UUID::class.java),
                    revision = result.getLong("revision"),
                    document = result.getString("document"),
                    documentHash = result.getString("document_hash"),
                )
            }
        }
        if (releaseNumber > 1) {
            connection.prepareStatement(
                """
                    UPDATE analysis_control.analysis_product_drafts
                    SET revision = ?,
                        validated_revision = NULL,
                        validated_catalog_revision = NULL,
                        validated_base_schema_digest = NULL,
                        validated_by = NULL,
                        validated_at = NULL,
                        updated_at = clock_timestamp()
                    WHERE team = ? AND product_id = ?
                """.trimIndent(),
            ).use { statement ->
                statement.setLong(1, releaseNumber)
                statement.setString(2, team)
                statement.setObject(3, productId)
                statement.executeUpdate() shouldBe 1
            }
        }
        connection.prepareStatement(
            """
                UPDATE analysis_control.analysis_product_drafts
                SET validated_revision = revision,
                    validated_catalog_revision = ?,
                    validated_base_schema_digest = ?,
                    validated_by = 'A123456',
                    validated_at = clock_timestamp()
                WHERE team = ? AND product_id = ?
            """.trimIndent(),
        ).use { statement ->
            statement.setString(1, specification.catalogRevision)
            statement.setString(2, specification.baseSchemaDigest)
            statement.setString(3, team)
            statement.setObject(4, productId)
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
                ) VALUES (
                    gen_random_uuid(), ?, ?, ?, ?, ?, ?::jsonb, ?, ?::jsonb, ?, ?, ?, 'A123456'
                )
            """.trimIndent(),
        ).use { statement ->
            statement.setString(1, team)
            statement.setObject(2, productId)
            statement.setLong(3, releaseNumber)
            statement.setObject(4, draft.id)
            statement.setLong(5, releaseNumber)
            statement.setString(6, draft.document)
            statement.setString(7, draft.documentHash)
            statement.setString(8, specificationJson)
            statement.setString(9, specificationDigest)
            statement.setString(10, specification.catalogRevision)
            statement.setString(11, specification.baseSchemaDigest)
            statement.executeUpdate() shouldBe 1
        }
        connection.prepareStatement(
            "UPDATE analysis_control.analysis_products SET last_release_number = ? WHERE team = ? AND id = ?",
        ).use { statement ->
            statement.setLong(1, releaseNumber)
            statement.setString(2, team)
            statement.setObject(3, productId)
            statement.executeUpdate() shouldBe 1
        }
        connection.commit()
    }
}

private data class DraftReleaseSource(
    val id: UUID,
    val revision: Long,
    val document: String,
    val documentHash: String,
)

private fun transitionSpecification(productId: UUID, team: String): AnalysisPublicationSpecificationV2 {
    val field = AnalysisDefinitionFieldPinV1(
        fieldId = "score",
        presence = AnalysisFieldPresence.PRESENT,
        fieldType = FieldType.RATING,
        ratingVariant = RatingVariant.NPS,
        ratingScale = 11,
    )
    val source = AnalysisSourcePinV2(
        app = "survey-app",
        surveyId = "work-environment",
        surveyType = SurveyType.CUSTOM,
        selectedFieldIds = listOf(field.fieldId),
        definitions = listOf(
            AnalysisDefinitionPinV1(
                definitionHash = "d".repeat(64),
                fields = listOf(field),
                flows = listOf(
                    AnalysisFlowPinV1(
                        flowHash = "f".repeat(64),
                        evaluatorVersion = SURVEY_FLOW_EVALUATOR_VERSION,
                        dependenciesByField = listOf(
                            AnalysisFieldDependenciesV1(fieldId = field.fieldId, dependencies = emptyList()),
                        ),
                    ),
                ),
            ),
        ),
    )
    val resources = AnalysisPublicationResourceCompilerV2.compile(
        sources = listOf(source),
        dimensions = emptyList(),
        includeSubmittedHour = false,
    )
    return AnalysisPublicationSpecificationV2(
        productId = productId.toString(),
        team = team,
        retention = AnalysisProductRetention.DAYS_90,
        includeSubmittedHour = false,
        catalogRevision = "catalog-v2",
        sources = listOf(source),
        dimensions = emptyList(),
        resources = resources,
        excludedDataCategories = ANALYSIS_EXCLUDED_DATA_CATEGORIES_V1,
        baseSchemaDigest = AnalysisPublicationSpecificationDigests.schema(resources),
    )
}

private fun countEffectiveGenerations(productId: UUID): Int =
    TestDatabase.dataSource.connection.use { connection ->
        connection.prepareStatement(
            "SELECT count(*) FROM analysis_control.analysis_effective_plan_generations WHERE product_id = ?",
        ).use { statement ->
            statement.setObject(1, productId)
            statement.executeQuery().use { result ->
                result.next()
                result.getInt(1)
            }
        }
    }

private fun commitDesiredControlDirectly(fixture: TransitionFixture, includeAudit: Boolean) {
    TestDatabase.dataSource.connection.use { connection ->
        try {
            connection.prepareStatement(
                """
                    UPDATE analysis_control.analysis_products
                    SET desired_release_number = 1, row_version = row_version + 1
                    WHERE team = ? AND id = ?
                """.trimIndent(),
            ).use { statement ->
                statement.setString(1, fixture.team)
                statement.setObject(2, fixture.productId)
                statement.executeUpdate() shouldBe 1
            }
            if (includeAudit) {
                connection.prepareStatement(
                    """
                        INSERT INTO analysis_control.analysis_product_audit_events (
                            id, team, product_id, event_number, event_type, actor_id,
                            product_version, release_number, subject_digest
                        )
                        SELECT gen_random_uuid(), ?, ?, 2, 'RELEASE_DESIRED', 'A123456',
                               2, release_number, publication_specification_digest
                        FROM analysis_control.analysis_product_releases
                        WHERE team = ? AND product_id = ? AND release_number = 1
                    """.trimIndent(),
                ).use { statement ->
                    statement.setString(1, fixture.team)
                    statement.setObject(2, fixture.productId)
                    statement.setString(3, fixture.team)
                    statement.setObject(4, fixture.productId)
                    statement.executeUpdate() shouldBe 1
                }
            }
            connection.commit()
        } catch (error: SQLException) {
            connection.rollback()
            throw error
        }
    }
}

private fun executeRejectedControlUpdate(fixture: TransitionFixture, assignment: String) {
    check(assignment in setOf("desired_release_number = 1", "lifecycle_state = 'DRAFT'"))
    TestDatabase.dataSource.connection.use { connection ->
        try {
            connection.prepareStatement(
                """
                    UPDATE analysis_control.analysis_products
                    SET $assignment, row_version = row_version + 1
                    WHERE team = ? AND id = ?
                """.trimIndent(),
            ).use { statement ->
                statement.setString(1, fixture.team)
                statement.setObject(2, fixture.productId)
                statement.executeUpdate()
            }
            connection.commit()
        } catch (error: SQLException) {
            connection.rollback()
            throw error
        }
    }
}

private fun installRejectingTrigger(table: String, trigger: String) {
    TestDatabase.dataSource.connection.use { connection ->
        connection.createStatement().use { statement ->
            statement.execute(
                """
                    CREATE FUNCTION analysis_control.reject_transition_for_test()
                    RETURNS TRIGGER
                    LANGUAGE plpgsql
                    AS ${'$'}${'$'}
                    BEGIN
                        RAISE EXCEPTION 'reject transition for test';
                    END;
                    ${'$'}${'$'}
                """.trimIndent(),
            )
            statement.execute(
                "CREATE TRIGGER $trigger BEFORE INSERT ON analysis_control.$table " +
                    "FOR EACH ROW EXECUTE FUNCTION analysis_control.reject_transition_for_test()",
            )
        }
        connection.commit()
    }
}

private fun removeRejectingTrigger(table: String, trigger: String) {
    TestDatabase.dataSource.connection.use { connection ->
        connection.createStatement().use { statement ->
            statement.execute("DROP TRIGGER IF EXISTS $trigger ON analysis_control.$table")
            statement.execute("DROP FUNCTION IF EXISTS analysis_control.reject_transition_for_test()")
        }
        connection.commit()
    }
}
