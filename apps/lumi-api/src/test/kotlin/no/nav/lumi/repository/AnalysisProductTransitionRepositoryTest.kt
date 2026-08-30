package no.nav.lumi.repository

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.assertions.nondeterministic.eventually
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
import kotlin.time.Duration.Companion.seconds

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

    test("pause freezes the latest verified snapshot and keeps purge scope sealed") {
        val fixture = createEnabledProduct(repository)

        val paused = repository.pause(
            fixture.team,
            fixture.productId,
            expectedProductVersion = 3,
            principalIdentity = "A123456",
        ) as ChangeAnalysisProductStateResult.Changed

        paused.product.lifecycleState shouldBe AnalysisProductLifecycleState.PAUSED
        java.time.OffsetDateTime.parse(paused.product.dataCutoffAt).toInstant() shouldBe ACTIVE_SNAPSHOT_AT
        java.time.OffsetDateTime.parse(paused.product.dataCutoffAt).toInstant() shouldBe
            paused.effectiveGeneration.dataCutoffAt
        paused.effectiveGeneration.planKind shouldBe EffectivePlanKind.PAUSED
        repository.findAuditEvents(fixture.team, fixture.productId)!!.last().let {
            (it.previousState to it.nextState) shouldBe
                (AnalysisProductLifecycleState.ENABLED to AnalysisProductLifecycleState.PAUSED)
        }
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

    test("offboarding is fail closed and cannot be assigned a release") {
        val fixture = createEnabledProduct(repository)

        val offboarding = repository.beginOffboarding(
            fixture.team,
            fixture.productId,
            expectedProductVersion = 3,
            principalIdentity = "A123456",
        ) as ChangeAnalysisProductStateResult.Changed

        offboarding.product.lifecycleState shouldBe AnalysisProductLifecycleState.OFFBOARDING
        offboarding.effectiveGeneration.planKind shouldBe EffectivePlanKind.OFFBOARDING

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

    test("pause fails closed until a verified active snapshot exists") {
        val fixture = createEnabledProduct(repository, withSnapshotActivation = false)

        repository.pause(
            fixture.team,
            fixture.productId,
            expectedProductVersion = 3,
            principalIdentity = "A123456",
        ) shouldBe ChangeAnalysisProductStateResult.Rejected(
            AnalysisProductTransitionRejection.NO_ACTIVE_SNAPSHOT,
        )
        repository.findById(fixture.team, fixture.productId)!!.lifecycleState shouldBe
            AnalysisProductLifecycleState.ENABLED
    }

    test("database rejects rollback of product and release counters") {
        val fixture = createEnabledProduct(repository)
        insertTransitionRelease(fixture.productId, fixture.team, schemaVersion = 2, releaseNumber = 2)

        shouldThrow<SQLException> {
            executeRejectedProductUpdate(fixture, "row_version = 2")
        }.sqlState shouldBe "23514"
        shouldThrow<SQLException> {
            executeRejectedControlUpdate(fixture, "last_release_number = 1")
        }.sqlState shouldBe "23514"
    }

    test("immutable release and product release counter must commit together") {
        val fixture = createEnabledProduct(repository)

        shouldThrow<SQLException> {
            insertTransitionRelease(
                fixture.productId,
                fixture.team,
                schemaVersion = 2,
                releaseNumber = 2,
                updateReleaseCounter = false,
            )
        }.sqlState shouldBe "23514"
        repository.findReleases(fixture.team, fixture.productId)!! shouldHaveSize 1
    }

    test("database rejects future or regressing snapshot activations") {
        val fixture = createEnabledProduct(repository, withSnapshotActivation = false)

        insertSnapshotActivation(fixture, ACTIVE_SNAPSHOT_AT)
        shouldThrow<SQLException> {
            insertSnapshotActivation(fixture, Instant.parse("2999-01-01T00:00:00Z"))
        }.sqlState shouldBe "23514"
        shouldThrow<SQLException> {
            insertSnapshotActivation(fixture, ACTIVE_SNAPSHOT_AT.minusSeconds(1))
        }.sqlState shouldBe "23514"
    }

    test("database binds a snapshot activation to the current enabled effective generation") {
        val fixture = createEnabledProduct(repository, withSnapshotActivation = false)

        shouldThrow<SQLException> {
            insertSnapshotActivation(fixture, ACTIVE_SNAPSHOT_AT, controlEpochDelta = 1)
        }.sqlState shouldBe "23514"
        insertSnapshotActivation(fixture, ACTIVE_SNAPSHOT_AT)

        insertTransitionRelease(fixture.productId, fixture.team, schemaVersion = 2, releaseNumber = 2)
        repository.desireRelease(
            fixture.team,
            fixture.productId,
            expectedProductVersion = 3,
            releaseNumber = 2,
            principalIdentity = "A123456",
        )
        shouldThrow<SQLException> {
            insertSnapshotActivation(
                fixture,
                ACTIVE_SNAPSHOT_AT.plusSeconds(1),
                useLatestGeneration = false,
            )
        }.sqlState shouldBe "23514"
    }

    test("editing a draft does not stale the unchanged active effective generation") {
        val fixture = createEnabledProduct(repository, withSnapshotActivation = false)
        val product = checkNotNull(repository.findById(fixture.team, fixture.productId))
        val draft = checkNotNull(product.draft)

        repository.updateDraft(
            team = fixture.team,
            productId = fixture.productId,
            draftId = UUID.fromString(draft.id),
            expectedRevision = draft.revision,
            document = transitionDocument().copy(purpose = "Videre arbeid i utkastet"),
            principalIdentity = "A123456",
        ).let { check(it is UpdateAnalysisProductDraftResult.Updated) }

        insertSnapshotActivation(fixture, ACTIVE_SNAPSHOT_AT)
        repository.pause(
            fixture.team,
            fixture.productId,
            expectedProductVersion = 4,
            principalIdentity = "A123456",
        ).let { paused ->
            check(paused is ChangeAnalysisProductStateResult.Changed)
            java.time.OffsetDateTime.parse(paused.product.dataCutoffAt).toInstant() shouldBe ACTIVE_SNAPSHOT_AT
        }
    }

    test("snapshot activation history is immutable and stops when the product pauses") {
        val fixture = createEnabledProduct(repository)
        repository.pause(
            fixture.team,
            fixture.productId,
            expectedProductVersion = 3,
            principalIdentity = "A123456",
        )

        shouldThrow<SQLException> {
            insertSnapshotActivation(fixture, ACTIVE_SNAPSHOT_AT.plusSeconds(1))
        }.sqlState shouldBe "23514"
        shouldThrow<SQLException> {
            mutateSnapshotActivation("UPDATE", fixture)
        }.sqlState shouldBe "55000"
        shouldThrow<SQLException> {
            mutateSnapshotActivation("DELETE", fixture)
        }.sqlState shouldBe "55000"
        shouldThrow<SQLException> {
            mutateSnapshotActivation("TRUNCATE", fixture)
        }.sqlState shouldBe "55000"
    }

    test("a concurrent pause waits for an in-flight snapshot activation and freezes its source boundary") {
        val fixture = createEnabledProduct(repository, withSnapshotActivation = false)
        val concurrentSnapshotAt = ACTIVE_SNAPSHOT_AT.plusSeconds(30)

        TestDatabase.dataSource.connection.use { activationConnection ->
            activationConnection.autoCommit = false
            val activationBackendPid = activationConnection.createStatement().use { statement ->
                statement.executeQuery("SELECT pg_backend_pid()").use { result ->
                    check(result.next())
                    result.getInt(1)
                }
            }
            insertSnapshotActivationRow(activationConnection, fixture, concurrentSnapshotAt)

            coroutineScope {
                val pause = async(Dispatchers.IO) {
                    repository.pause(
                        fixture.team,
                        fixture.productId,
                        expectedProductVersion = 3,
                        principalIdentity = "A123456",
                    )
                }
                waitUntilDatabaseSessionIsBlockedBy(activationBackendPid)
                activationConnection.commit()

                val paused = pause.await() as ChangeAnalysisProductStateResult.Changed
                java.time.OffsetDateTime.parse(paused.product.dataCutoffAt).toInstant() shouldBe
                    concurrentSnapshotAt
            }
        }
    }

    test("a snapshot activation waiting behind pause is rejected after pause commits") {
        val fixture = createEnabledProduct(repository)

        TestDatabase.dataSource.connection.use { pauseConnection ->
            pauseConnection.autoCommit = false
            val pauseBackendPid = pauseConnection.createStatement().use { statement ->
                statement.executeQuery("SELECT pg_backend_pid()").use { result ->
                    check(result.next())
                    result.getInt(1)
                }
            }
            pauseProductInTransaction(pauseConnection, fixture)

            coroutineScope {
                val activation = async(Dispatchers.IO) {
                    runCatching {
                        insertSnapshotActivation(fixture, ACTIVE_SNAPSHOT_AT.plusSeconds(60))
                    }
                }
                waitUntilDatabaseSessionIsBlockedBy(pauseBackendPid)
                pauseConnection.commit()

                val failure = activation.await().exceptionOrNull() as SQLException
                failure.sqlState shouldBe "23514"
            }
        }
        repository.findById(fixture.team, fixture.productId)!!.lifecycleState shouldBe
            AnalysisProductLifecycleState.PAUSED
    }

    test("database does not allow paused products to resume without a revalidation transition") {
        val fixture = createEnabledProduct(repository)
        repository.pause(
            fixture.team,
            fixture.productId,
            expectedProductVersion = 3,
            principalIdentity = "A123456",
        )

        shouldThrow<SQLException> {
            executeRejectedControlUpdate(fixture, "lifecycle_state = 'ENABLED', data_cutoff_at = NULL")
        }.sqlState shouldBe "23514"
    }

    test("database binds transition audit state and actor exactly") {
        val pauseFixture = createEnabledProduct(repository)
        installAuditRewriteTrigger("actor")
        try {
            shouldThrow<SQLException> {
                repository.pause(
                    pauseFixture.team,
                    pauseFixture.productId,
                    expectedProductVersion = 3,
                    principalIdentity = "A123456",
                )
            }.sqlState shouldBe "23514"
        } finally {
            removeAuditRewriteTrigger()
        }
        repository.findById(pauseFixture.team, pauseFixture.productId)!!.lifecycleState shouldBe
            AnalysisProductLifecycleState.ENABLED

        val activationFixture = createEnabledProduct(repository, team = "team-b")
        insertTransitionRelease(activationFixture.productId, activationFixture.team, schemaVersion = 2, releaseNumber = 2)
        repository.desireRelease(
            activationFixture.team,
            activationFixture.productId,
            expectedProductVersion = 3,
            releaseNumber = 2,
            principalIdentity = "A123456",
        )
        installAuditRewriteTrigger("state")
        try {
            shouldThrow<SQLException> {
                repository.activateDesiredRelease(
                    activationFixture.team,
                    activationFixture.productId,
                    expectedProductVersion = 4,
                    principalIdentity = "A123456",
                )
            }.sqlState shouldBe "23514"
        } finally {
            removeAuditRewriteTrigger()
        }
        repository.findById(activationFixture.team, activationFixture.productId)!!.activeReleaseNumber shouldBe 1
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

private suspend fun createEnabledProduct(
    repository: AnalysisProductRepository,
    withSnapshotActivation: Boolean = true,
    team: String = "team-a",
): TransitionFixture =
    createProductWithRelease(repository, team = team).also { fixture ->
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
        if (withSnapshotActivation) insertSnapshotActivation(fixture, ACTIVE_SNAPSHOT_AT)
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
    updateReleaseCounter: Boolean = true,
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
        if (updateReleaseCounter) {
            connection.prepareStatement(
                "UPDATE analysis_control.analysis_products SET last_release_number = ? WHERE team = ? AND id = ?",
            ).use { statement ->
                statement.setLong(1, releaseNumber)
                statement.setString(2, team)
                statement.setObject(3, productId)
                statement.executeUpdate() shouldBe 1
            }
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
    check(
        assignment in setOf(
            "desired_release_number = 1",
            "lifecycle_state = 'DRAFT'",
            "lifecycle_state = 'ENABLED', data_cutoff_at = NULL",
            "last_release_number = 1",
        ),
    )
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

private fun executeRejectedProductUpdate(fixture: TransitionFixture, assignment: String) {
    check(assignment == "row_version = 2")
    TestDatabase.dataSource.connection.use { connection ->
        try {
            connection.prepareStatement(
                "UPDATE analysis_control.analysis_products SET $assignment WHERE team = ? AND id = ?",
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

private fun insertSnapshotActivation(
    fixture: TransitionFixture,
    sourceSnapshotAt: Instant,
    controlEpochDelta: Long = 0,
    useLatestGeneration: Boolean = true,
) {
    val generationOrder = if (useLatestGeneration) "DESC" else "ASC"
    TestDatabase.dataSource.connection.use { connection ->
        try {
            insertSnapshotActivationRow(
                connection,
                fixture,
                sourceSnapshotAt,
                controlEpochDelta,
                generationOrder,
            )
            connection.commit()
        } catch (error: SQLException) {
            connection.rollback()
            throw error
        }
    }
}

private fun insertSnapshotActivationRow(
    connection: java.sql.Connection,
    fixture: TransitionFixture,
    sourceSnapshotAt: Instant,
    controlEpochDelta: Long = 0,
    generationOrder: String = "DESC",
) {
    check(generationOrder in setOf("ASC", "DESC"))
    connection.prepareStatement(
        """
            INSERT INTO analysis_control.analysis_product_snapshot_activations (
                team, product_id, product_snapshot_id,
                effective_generation_id, control_epoch, release_number,
                source_snapshot_at
            )
            SELECT ?, ?, ?, generation.id, generation.control_epoch + ?,
                   generation.active_release_number, ?
            FROM analysis_control.analysis_effective_plan_generations AS generation
            WHERE generation.team = ?
              AND generation.product_id = ?
              AND generation.plan_kind = 'ENABLED'
            ORDER BY generation.generation $generationOrder
            LIMIT 1
        """.trimIndent(),
    ).use { statement ->
        statement.setString(1, fixture.team)
        statement.setObject(2, fixture.productId)
        statement.setString(3, "snapshot-${UUID.randomUUID()}")
        statement.setLong(4, controlEpochDelta)
        statement.setObject(5, sourceSnapshotAt.atOffset(ZoneOffset.UTC))
        statement.setString(6, fixture.team)
        statement.setObject(7, fixture.productId)
        statement.executeUpdate() shouldBe 1
    }
}

private fun pauseProductInTransaction(connection: java.sql.Connection, fixture: TransitionFixture) {
    val productVersion = connection.prepareStatement(
        """
            UPDATE analysis_control.analysis_products
            SET lifecycle_state = 'PAUSED',
                data_cutoff_at = ?,
                row_version = row_version + 1,
                updated_by = 'A123456',
                updated_at = clock_timestamp()
            WHERE team = ? AND id = ?
            RETURNING row_version
        """.trimIndent(),
    ).use { statement ->
        statement.setObject(1, ACTIVE_SNAPSHOT_AT.atOffset(ZoneOffset.UTC))
        statement.setString(2, fixture.team)
        statement.setObject(3, fixture.productId)
        statement.executeQuery().use { result ->
            check(result.next())
            result.getLong(1)
        }
    }
    connection.prepareStatement(
        """
            INSERT INTO analysis_control.analysis_product_audit_events (
                id, team, product_id, event_number, event_type, actor_id,
                product_version, previous_state, next_state
            ) VALUES (
                gen_random_uuid(), ?, ?, ?, 'LIFECYCLE_CHANGED', 'A123456',
                ?, 'ENABLED', 'PAUSED'
            )
        """.trimIndent(),
    ).use { statement ->
        statement.setString(1, fixture.team)
        statement.setObject(2, fixture.productId)
        statement.setLong(3, productVersion)
        statement.setLong(4, productVersion)
        statement.executeUpdate() shouldBe 1
    }
    AnalysisEffectivePlanRepository().persistCurrent(connection, fixture.team, fixture.productId).let {
        check(it is PersistEffectivePlanResult.Created)
    }
}

private suspend fun waitUntilDatabaseSessionIsBlockedBy(blockingPid: Int) {
    eventually(10.seconds) {
        val blocked = TestDatabase.dataSource.connection.use { connection ->
            connection.prepareStatement(
                """
                    SELECT EXISTS (
                        SELECT 1
                        FROM pg_stat_activity
                        WHERE ? = ANY(pg_blocking_pids(pid))
                    )
                """.trimIndent(),
            ).use { statement ->
                statement.setInt(1, blockingPid)
                statement.executeQuery().use { result ->
                    check(result.next())
                    result.getBoolean(1)
                }
            }
        }
        blocked shouldBe true
    }
}

private fun mutateSnapshotActivation(operation: String, fixture: TransitionFixture) {
    check(operation in setOf("UPDATE", "DELETE", "TRUNCATE"))
    TestDatabase.dataSource.connection.use { connection ->
        try {
            val sql = when (operation) {
                "UPDATE" ->
                    "UPDATE analysis_control.analysis_product_snapshot_activations " +
                        "SET source_snapshot_at = source_snapshot_at + interval '1 second' " +
                        "WHERE team = ? AND product_id = ?"

                "DELETE" ->
                    "DELETE FROM analysis_control.analysis_product_snapshot_activations " +
                        "WHERE team = ? AND product_id = ?"

                else -> "TRUNCATE analysis_control.analysis_product_snapshot_activations"
            }
            connection.prepareStatement(sql).use { statement ->
                if (operation != "TRUNCATE") {
                    statement.setString(1, fixture.team)
                    statement.setObject(2, fixture.productId)
                }
                statement.executeUpdate()
            }
            connection.commit()
        } catch (error: SQLException) {
            connection.rollback()
            throw error
        }
    }
}

private val ACTIVE_SNAPSHOT_AT = Instant.parse("2026-08-29T23:45:00Z")

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

private fun installAuditRewriteTrigger(mode: String) {
    check(mode in setOf("actor", "state"))
    val mutation = when (mode) {
        "actor" -> "NEW.actor_id := 'forged-actor';"
        else -> "NEW.previous_state := 'DRAFT'; NEW.next_state := 'ENABLED';"
    }
    TestDatabase.dataSource.connection.use { connection ->
        connection.createStatement().use { statement ->
            statement.execute(
                """
                    CREATE FUNCTION analysis_control.rewrite_transition_audit_for_test()
                    RETURNS TRIGGER
                    LANGUAGE plpgsql
                    AS ${'$'}${'$'}
                    BEGIN
                        $mutation
                        RETURN NEW;
                    END;
                    ${'$'}${'$'}
                """.trimIndent(),
            )
            statement.execute(
                """
                    CREATE TRIGGER rewrite_transition_audit_for_test
                    BEFORE INSERT ON analysis_control.analysis_product_audit_events
                    FOR EACH ROW EXECUTE FUNCTION analysis_control.rewrite_transition_audit_for_test()
                """.trimIndent(),
            )
        }
        connection.commit()
    }
}

private fun removeAuditRewriteTrigger() {
    TestDatabase.dataSource.connection.use { connection ->
        connection.createStatement().use { statement ->
            statement.execute(
                "DROP TRIGGER IF EXISTS rewrite_transition_audit_for_test " +
                    "ON analysis_control.analysis_product_audit_events",
            )
            statement.execute("DROP FUNCTION IF EXISTS analysis_control.rewrite_transition_audit_for_test()")
        }
        connection.commit()
    }
}
