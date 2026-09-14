package no.nav.lumi.repository

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.longs.shouldBeGreaterThan
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
import no.nav.lumi.domain.AnalysisDimensionRegistry
import no.nav.lumi.domain.AnalysisFieldDependenciesV1
import no.nav.lumi.domain.AnalysisFieldPresence
import no.nav.lumi.domain.AnalysisFlowDependencySource
import no.nav.lumi.domain.AnalysisFlowDependencyV1
import no.nav.lumi.domain.AnalysisFlowPinV1
import no.nav.lumi.domain.AnalysisProductLifecycleState
import no.nav.lumi.domain.AnalysisProductRetention
import no.nav.lumi.domain.AnalysisPublicationResourceCompilerV2
import no.nav.lumi.domain.AnalysisPublicationSpecificationDigests
import no.nav.lumi.domain.AnalysisPublicationSpecificationV2
import no.nav.lumi.domain.AnalysisSourcePinV2
import no.nav.lumi.domain.FieldType
import no.nav.lumi.domain.RatingVariant
import no.nav.lumi.domain.SURVEY_FLOW_EVALUATOR_VERSION
import no.nav.lumi.domain.SurveyType
import java.sql.SQLException
import java.time.Instant
import java.util.UUID

class AnalysisEffectivePlanRepositoryTest : FunSpec({
    beforeSpec { TestDatabase.initialize() }
    beforeTest { TestDatabase.clearAllData() }

    test("persists the resolver-owned effective scope as a sealed normalized generation") {
        val fixture = insertEffectivePlanFixture()

        val result = checkNotNull(fixture.initialGeneration)

        result.productId shouldBe fixture.productId
        result.generation shouldBe 1
        result.controlEpoch shouldBeGreaterThan 0
        result.planKind shouldBe EffectivePlanKind.ENABLED
        result.productRowVersion shouldBe 2

        readAtomCounts(result.id) shouldBe mapOf(
            "DEFINITION" to 1,
            "DEFINITION_FIELD" to 2,
            "DEPENDENCY" to 2,
            "DIMENSION" to 1,
            "FIELD" to 2,
            "FLOW" to 1,
            "OPTION" to 2,
            "SOURCE" to 1,
        )
        readSpecificationRoles(result.id) shouldBe listOf("MAINTAINED")

        val same = AnalysisEffectivePlanRepository().persistCurrent(fixture.team, fixture.productId)
            as PersistEffectivePlanResult.Unchanged
        same.generation shouldBe result
        countGenerations(fixture.productId) shouldBe 1
    }

    test("serializes concurrent reconcilers to one generation") {
        val fixture = insertEffectivePlanFixture(activate = false)

        val results = coroutineScope {
            List(2) {
                async(Dispatchers.IO) {
                    AnalysisEffectivePlanRepository().persistCurrent(fixture.team, fixture.productId)
                }
            }.awaitAll()
        }

        results.count { it is PersistEffectivePlanResult.Created } shouldBe 1
        results.count { it is PersistEffectivePlanResult.Unchanged } shouldBe 1
        countGenerations(fixture.productId) shouldBe 1
    }

    test("persists a desired release as a separate candidate without widening the maintained target") {
        val fixture = insertEffectivePlanFixture()
        val created = insertDesiredRelease(fixture)

        readSpecificationReleases(created.generation.id) shouldBe listOf(
            Triple("CANDIDATE", 2L, 2L),
            Triple("MAINTAINED", 1L, 2L),
        )
    }

    test("creates a new globally fenced generation when effective lifecycle semantics change") {
        val fixture = insertEffectivePlanFixture()
        val first = checkNotNull(fixture.initialGeneration)
        val cutoff = Instant.parse("2026-08-30T09:15:00.123456Z")
        val second = updateLifecycle(
            fixture.productId,
            lifecycle = AnalysisProductLifecycleState.PAUSED,
            dataCutoffAt = cutoff,
        )

        second.generation.generation shouldBe 2
        second.generation.controlEpoch shouldBeGreaterThan first.controlEpoch
        second.generation.planKind shouldBe EffectivePlanKind.PAUSED
        second.generation.dataCutoffAt shouldBe cutoff
    }

    test("fails closed for a referenced legacy release and never persists partial scope") {
        val fixture = insertEffectivePlanFixture(specificationVersion = 1, activate = false)

        shouldThrow<IllegalArgumentException> {
            activateFixtureInTransaction(fixture)
        }
        countGenerations(fixture.productId) shouldBe 0
    }

    test("does not reveal whether another team's product exists") {
        val fixture = insertEffectivePlanFixture(activate = false)

        AnalysisEffectivePlanRepository().persistCurrent("another-team", fixture.productId) shouldBe
            PersistEffectivePlanResult.NotFound
        countGenerations(fixture.productId) shouldBe 0
    }

    test("database seals generations and fences them to the locked control row") {
        val fixture = insertEffectivePlanFixture()
        val created = checkNotNull(fixture.initialGeneration)

        shouldThrow<SQLException> {
            executeUpdate(
                """
                    INSERT INTO analysis_control.analysis_effective_specs (
                        generation_id, role, team, product_id,
                        target_release_number, upper_allowlist_release_number,
                        lifecycle_mode, retention, submitted_hour_mode,
                        effective_specification_digest, effective_schema_digest, resources
                    ) VALUES (?, 'CANDIDATE', ?, ?, 1, 1, 'ACTIVE', 'DAYS_90', 'INCLUDED', ?, ?, '[]'::jsonb)
                """.trimIndent(),
                created.id,
                fixture.team,
                fixture.productId,
                "a".repeat(64),
                "b".repeat(64),
            )
        }.sqlState shouldBe "55000"

        shouldThrow<SQLException> {
            executeUpdate(
                "UPDATE analysis_control.analysis_effective_plan_generations SET plan_digest = ? WHERE id = ?",
                "f".repeat(64),
                created.id,
            )
        }.sqlState shouldBe "55000"
        shouldThrow<SQLException> {
            executeUpdate(
                "DELETE FROM analysis_control.analysis_effective_plan_generations WHERE id = ?",
                created.id,
            )
        }.sqlState shouldBe "55000"
        shouldThrow<SQLException> {
            executeUpdate(
                "UPDATE analysis_control.analysis_effective_specs SET retention = 'DAYS_30' WHERE generation_id = ?",
                created.id,
            )
        }.sqlState shouldBe "55000"
        shouldThrow<SQLException> {
            executeUpdate(
                "DELETE FROM analysis_control.analysis_effective_atoms WHERE generation_id = ?",
                created.id,
            )
        }.sqlState shouldBe "55000"
        shouldThrow<SQLException> {
            executeStatement("TRUNCATE TABLE analysis_control.analysis_effective_atoms")
        }.sqlState shouldBe "55000"
    }

    test("database rejects an incomplete generation at the transaction boundary") {
        val fixture = insertEffectivePlanFixture(activate = false)

        shouldThrow<SQLException> {
            commitActivationWithRawGeneration(fixture, generationProductVersion = 2)
        }.sqlState shouldBe "23514"
        countGenerations(fixture.productId) shouldBe 0
    }

    test("database rejects a generation fenced to a stale product version") {
        val fixture = insertEffectivePlanFixture(activate = false)

        shouldThrow<SQLException> {
            commitActivationWithRawGeneration(fixture, generationProductVersion = 1)
        }.sqlState shouldBe "40001"
        countGenerations(fixture.productId) shouldBe 0
    }

    test("control-plane history remains private from public and the legacy analysis role") {
        TestDatabase.dataSource.connection.use { connection ->
            connection.prepareStatement(
                """
                    SELECT bool_and(
                        NOT has_table_privilege('esyfo-analyse', table_name, 'SELECT')
                    )
                    FROM unnest(ARRAY[
                        'analysis_control.analysis_effective_plan_generations',
                        'analysis_control.analysis_effective_specs',
                        'analysis_control.analysis_effective_atoms'
                    ]) AS table_name
                """.trimIndent(),
            ).use { statement ->
                statement.executeQuery().use { result ->
                    result.next() shouldBe true
                    result.getBoolean(1) shouldBe true
                }
            }
        }
    }
})

private data class EffectivePlanFixture(
    val team: String,
    val productId: UUID,
    val releaseDigest: String,
    val initialGeneration: EffectivePlanGeneration?,
)

private fun insertEffectivePlanFixture(
    specificationVersion: Int = 2,
    activate: Boolean = true,
): EffectivePlanFixture {
    val team = "team-a"
    val productId = UUID.randomUUID()
    val draftId = UUID.randomUUID()
    val specification = effectivePlanSpecification(productId, team)
    val specificationJson = if (specificationVersion == 2) {
        AnalysisContractJson.encodeToString(specification)
    } else {
        """{"schemaVersion":1}"""
    }
    val specificationDigest = if (specificationVersion == 2) {
        AnalysisPublicationSpecificationDigests.specification(specification)
    } else {
        "c".repeat(64)
    }
    val sourceDocument = """{"schemaVersion":1}"""
    val sourceDocumentHash = "a".repeat(64)

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
                    ?, ?, ?, ?::jsonb, ?,
                    1, ?, ?, 'A123456', clock_timestamp(),
                    'A123456', 'A123456'
                )
            """.trimIndent(),
        ).use { statement ->
            statement.setObject(1, draftId)
            statement.setString(2, team)
            statement.setObject(3, productId)
            statement.setString(4, sourceDocument)
            statement.setString(5, sourceDocumentHash)
            statement.setString(6, specification.catalogRevision)
            statement.setString(7, specification.baseSchemaDigest)
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
                    gen_random_uuid(), ?, ?, 1,
                    ?, 1,
                    ?::jsonb, ?,
                    ?::jsonb, ?,
                    ?, ?, 'A123456'
                )
            """.trimIndent(),
        ).use { statement ->
            statement.setString(1, team)
            statement.setObject(2, productId)
            statement.setObject(3, draftId)
            statement.setString(4, sourceDocument)
            statement.setString(5, sourceDocumentHash)
            statement.setString(6, specificationJson)
            statement.setString(7, specificationDigest)
            statement.setString(8, specification.catalogRevision)
            statement.setString(9, specification.baseSchemaDigest)
            statement.executeUpdate() shouldBe 1
        }
        connection.prepareStatement(
            "UPDATE analysis_control.analysis_products SET last_release_number = 1 WHERE id = ? AND team = ?",
        ).use { statement ->
            statement.setObject(1, productId)
            statement.setString(2, team)
            statement.executeUpdate() shouldBe 1
        }
        val initialGeneration = if (activate) {
            activateFixtureControl(connection, team, productId)
            insertFixtureAudit(
                connection = connection,
                fixture = EffectivePlanFixture(team, productId, specificationDigest, null),
                productVersion = 2,
                eventType = "RELEASE_ACTIVATED",
                releaseNumber = 1,
                previousState = "DRAFT",
                nextState = "ENABLED",
            )
            val persisted = AnalysisEffectivePlanRepository().persistCurrent(connection, team, productId)
                as PersistEffectivePlanResult.Created
            persisted.generation
        } else {
            null
        }
        connection.commit()
        return EffectivePlanFixture(team, productId, specificationDigest, initialGeneration)
    }
}

private fun effectivePlanSpecification(productId: UUID, team: String): AnalysisPublicationSpecificationV2 {
    val scoreField = AnalysisDefinitionFieldPinV1(
        fieldId = "score",
        presence = AnalysisFieldPresence.PRESENT,
        fieldType = FieldType.RATING,
        ratingVariant = RatingVariant.NPS,
        ratingScale = 11,
    )
    val segmentField = AnalysisDefinitionFieldPinV1(
        fieldId = "segment",
        presence = AnalysisFieldPresence.PRESENT,
        fieldType = FieldType.SINGLE_CHOICE,
        availableOptionIds = listOf("private", "business"),
    )
    val source = AnalysisSourcePinV2(
        app = "survey-app",
        surveyId = "work-environment",
        surveyType = SurveyType.CUSTOM,
        selectedFieldIds = listOf(scoreField.fieldId, segmentField.fieldId),
        definitions = listOf(
            AnalysisDefinitionPinV1(
                definitionHash = "d".repeat(64),
                fields = listOf(scoreField, segmentField),
                flows = listOf(
                    AnalysisFlowPinV1(
                        flowHash = "f".repeat(64),
                        evaluatorVersion = SURVEY_FLOW_EVALUATOR_VERSION,
                        dependenciesByField = listOf(
                            AnalysisFieldDependenciesV1(
                                scoreField.fieldId,
                                listOf(
                                    AnalysisFlowDependencyV1(
                                        AnalysisFlowDependencySource.ANSWER,
                                        segmentField.fieldId,
                                    ),
                                    AnalysisFlowDependencyV1(
                                        AnalysisFlowDependencySource.METADATA,
                                        "deviceType",
                                    ),
                                ),
                            ),
                            AnalysisFieldDependenciesV1(segmentField.fieldId, emptyList()),
                        ),
                    ),
                ),
            ),
        ),
    )
    val dimensions = listOf(AnalysisDimensionRegistry.snapshot().dimensions.single())
    val resources = AnalysisPublicationResourceCompilerV2.compile(
        sources = listOf(source),
        dimensions = dimensions,
        includeSubmittedHour = true,
    )
    return AnalysisPublicationSpecificationV2(
        productId = productId.toString(),
        team = team,
        retention = AnalysisProductRetention.DAYS_90,
        includeSubmittedHour = true,
        catalogRevision = "catalog-v2",
        sources = listOf(source),
        dimensions = dimensions,
        resources = resources,
        excludedDataCategories = ANALYSIS_EXCLUDED_DATA_CATEGORIES_V1,
        baseSchemaDigest = AnalysisPublicationSpecificationDigests.schema(resources),
    )
}

private fun insertDesiredRelease(fixture: EffectivePlanFixture): PersistEffectivePlanResult.Created {
    val specification = effectivePlanSpecification(fixture.productId, fixture.team)
    val specificationJson = AnalysisContractJson.encodeToString(specification)
    val specificationDigest = AnalysisPublicationSpecificationDigests.specification(specification)
    val sourceDocument = """{"schemaVersion":1}"""
    val sourceDocumentHash = "a".repeat(64)

    TestDatabase.dataSource.connection.use { connection ->
        val draftId = connection.prepareStatement(
            "SELECT id FROM analysis_control.analysis_product_drafts WHERE product_id = ?",
        ).use { statement ->
            statement.setObject(1, fixture.productId)
            statement.executeQuery().use { result ->
                check(result.next())
                result.getObject(1, UUID::class.java)
            }
        }
        connection.prepareStatement(
            """
                UPDATE analysis_control.analysis_product_drafts
                SET revision = 2, validated_revision = 2, updated_at = clock_timestamp()
                WHERE id = ?
            """.trimIndent(),
        ).use { statement ->
            statement.setObject(1, draftId)
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
                    gen_random_uuid(), ?, ?, 2,
                    ?, 2,
                    ?::jsonb, ?,
                    ?::jsonb, ?,
                    ?, ?, 'A123456'
                )
            """.trimIndent(),
        ).use { statement ->
            statement.setString(1, fixture.team)
            statement.setObject(2, fixture.productId)
            statement.setObject(3, draftId)
            statement.setString(4, sourceDocument)
            statement.setString(5, sourceDocumentHash)
            statement.setString(6, specificationJson)
            statement.setString(7, specificationDigest)
            statement.setString(8, specification.catalogRevision)
            statement.setString(9, specification.baseSchemaDigest)
            statement.executeUpdate() shouldBe 1
        }
        connection.prepareStatement(
            """
                UPDATE analysis_control.analysis_products
                SET row_version = 3, last_release_number = 2, desired_release_number = 2
                WHERE id = ? AND team = ?
            """.trimIndent(),
        ).use { statement ->
            statement.setObject(1, fixture.productId)
            statement.setString(2, fixture.team)
            statement.executeUpdate() shouldBe 1
        }
        insertFixtureAudit(
            connection = connection,
            fixture = fixture,
            productVersion = 3,
            eventType = "RELEASE_DESIRED",
            releaseNumber = 2,
            subjectDigest = specificationDigest,
        )
        val persisted = AnalysisEffectivePlanRepository().persistCurrent(
            connection,
            fixture.team,
            fixture.productId,
        ) as PersistEffectivePlanResult.Created
        connection.commit()
        return persisted
    }
}

private fun updateLifecycle(
    productId: UUID,
    lifecycle: AnalysisProductLifecycleState,
    dataCutoffAt: Instant?,
): PersistEffectivePlanResult.Created {
    TestDatabase.dataSource.connection.use { connection ->
        val current = connection.prepareStatement(
            "SELECT team, row_version, lifecycle_state FROM analysis_control.analysis_products WHERE id = ?",
        ).use { statement ->
            statement.setObject(1, productId)
            statement.executeQuery().use { result ->
                check(result.next())
                Triple(
                    result.getString("team"),
                    result.getLong("row_version"),
                    AnalysisProductLifecycleState.valueOf(result.getString("lifecycle_state")),
                )
            }
        }
        if (lifecycle == AnalysisProductLifecycleState.PAUSED) {
            connection.prepareStatement(
                """
                    INSERT INTO analysis_control.analysis_product_snapshot_activations (
                        team, product_id, product_snapshot_id,
                        effective_generation_id, control_epoch, release_number,
                        source_snapshot_at
                    )
                    SELECT ?, ?, ?, generation.id, generation.control_epoch,
                           generation.active_release_number, ?
                    FROM analysis_control.analysis_effective_plan_generations AS generation
                    WHERE generation.team = ? AND generation.product_id = ?
                      AND generation.plan_kind = 'ENABLED'
                    ORDER BY generation.generation DESC
                    LIMIT 1
                """.trimIndent(),
            ).use { statement ->
                statement.setString(1, current.first)
                statement.setObject(2, productId)
                statement.setString(3, "snapshot-${UUID.randomUUID()}")
                statement.setObject(4, checkNotNull(dataCutoffAt).atOffset(java.time.ZoneOffset.UTC))
                statement.setString(5, current.first)
                statement.setObject(6, productId)
                statement.executeUpdate() shouldBe 1
            }
        }
        connection.prepareStatement(
            """
                UPDATE analysis_control.analysis_products
                SET lifecycle_state = ?, row_version = row_version + 1, data_cutoff_at = ?
                WHERE id = ?
            """.trimIndent(),
        ).use { statement ->
            statement.setString(1, lifecycle.name)
            statement.setObject(2, dataCutoffAt?.atOffset(java.time.ZoneOffset.UTC))
            statement.setObject(3, productId)
            statement.executeUpdate() shouldBe 1
        }
        val fixture = EffectivePlanFixture(current.first, productId, releaseDigest = "", initialGeneration = null)
        insertFixtureAudit(
            connection = connection,
            fixture = fixture,
            productVersion = current.second + 1,
            eventType = "LIFECYCLE_CHANGED",
            previousState = current.third.name,
            nextState = lifecycle.name,
        )
        val persisted = AnalysisEffectivePlanRepository().persistCurrent(connection, current.first, productId)
            as PersistEffectivePlanResult.Created
        connection.commit()
        return persisted
    }
}

private fun activateFixtureInTransaction(fixture: EffectivePlanFixture) {
    TestDatabase.dataSource.connection.use { connection ->
        try {
            activateFixtureControl(connection, fixture.team, fixture.productId)
            insertFixtureAudit(
                connection = connection,
                fixture = fixture,
                productVersion = 2,
                eventType = "RELEASE_ACTIVATED",
                releaseNumber = 1,
                previousState = "DRAFT",
                nextState = "ENABLED",
            )
            AnalysisEffectivePlanRepository().persistCurrent(connection, fixture.team, fixture.productId)
            connection.commit()
        } catch (error: Exception) {
            connection.rollback()
            throw error
        }
    }
}

private fun commitActivationWithRawGeneration(
    fixture: EffectivePlanFixture,
    generationProductVersion: Long,
) {
    TestDatabase.dataSource.connection.use { connection ->
        try {
            activateFixtureControl(connection, fixture.team, fixture.productId)
            insertFixtureAudit(
                connection = connection,
                fixture = fixture,
                productVersion = 2,
                eventType = "RELEASE_ACTIVATED",
                releaseNumber = 1,
                previousState = "DRAFT",
                nextState = "ENABLED",
            )
            connection.prepareStatement(
                """
                    INSERT INTO analysis_control.analysis_effective_plan_generations (
                        team, product_id, generation, product_row_version,
                        plan_kind, lifecycle_state, active_release_number,
                        desired_release_number, plan_digest
                    ) VALUES (?, ?, 1, ?, 'ENABLED', 'ENABLED', 1, 1, ?)
                """.trimIndent(),
            ).use { statement ->
                statement.setString(1, fixture.team)
                statement.setObject(2, fixture.productId)
                statement.setLong(3, generationProductVersion)
                statement.setString(4, "a".repeat(64))
                statement.executeUpdate() shouldBe 1
            }
            connection.commit()
        } catch (error: SQLException) {
            connection.rollback()
            throw error
        }
    }
}

private fun activateFixtureControl(connection: java.sql.Connection, team: String, productId: UUID) {
    connection.prepareStatement(
        """
            UPDATE analysis_control.analysis_products
            SET lifecycle_state = 'ENABLED',
                row_version = 2,
                desired_release_number = 1,
                active_release_number = 1,
                updated_at = clock_timestamp()
            WHERE id = ? AND team = ?
        """.trimIndent(),
    ).use { statement ->
        statement.setObject(1, productId)
        statement.setString(2, team)
        statement.executeUpdate() shouldBe 1
    }
}

private fun insertFixtureAudit(
    connection: java.sql.Connection,
    fixture: EffectivePlanFixture,
    productVersion: Long,
    eventType: String,
    releaseNumber: Long? = null,
    subjectDigest: String = fixture.releaseDigest,
    previousState: String? = null,
    nextState: String? = null,
) {
    connection.prepareStatement(
        """
            INSERT INTO analysis_control.analysis_product_audit_events (
                id, team, product_id, event_number, event_type, actor_id,
                product_version, release_number, subject_digest, previous_state, next_state
            ) VALUES (gen_random_uuid(), ?, ?, ?, ?, 'A123456', ?, ?, ?, ?, ?)
        """.trimIndent(),
    ).use { statement ->
        statement.setString(1, fixture.team)
        statement.setObject(2, fixture.productId)
        statement.setLong(3, productVersion)
        statement.setString(4, eventType)
        statement.setLong(5, productVersion)
        statement.setObject(6, releaseNumber)
        statement.setString(7, subjectDigest.takeIf { releaseNumber != null })
        statement.setString(8, previousState)
        statement.setString(9, nextState)
        statement.executeUpdate() shouldBe 1
    }
}

private fun readAtomCounts(generationId: UUID): Map<String, Int> =
    TestDatabase.dataSource.connection.use { connection ->
        connection.prepareStatement(
            """
                SELECT atom_kind, count(*)
                FROM analysis_control.analysis_effective_atoms
                WHERE generation_id = ?
                GROUP BY atom_kind
                ORDER BY atom_kind
            """.trimIndent(),
        ).use { statement ->
            statement.setObject(1, generationId)
            statement.executeQuery().use { result ->
                buildMap {
                    while (result.next()) put(result.getString(1), result.getInt(2))
                }
            }
        }
    }

private fun readSpecificationRoles(generationId: UUID): List<String> =
    TestDatabase.dataSource.connection.use { connection ->
        connection.prepareStatement(
            """
                SELECT role
                FROM analysis_control.analysis_effective_specs
                WHERE generation_id = ?
                ORDER BY role
            """.trimIndent(),
        ).use { statement ->
            statement.setObject(1, generationId)
            statement.executeQuery().use { result ->
                buildList { while (result.next()) add(result.getString(1)) }
            }
        }
    }

private fun readSpecificationReleases(generationId: UUID): List<Triple<String, Long, Long>> =
    TestDatabase.dataSource.connection.use { connection ->
        connection.prepareStatement(
            """
                SELECT role, target_release_number, upper_allowlist_release_number
                FROM analysis_control.analysis_effective_specs
                WHERE generation_id = ?
                ORDER BY role
            """.trimIndent(),
        ).use { statement ->
            statement.setObject(1, generationId)
            statement.executeQuery().use { result ->
                buildList {
                    while (result.next()) {
                        add(Triple(result.getString(1), result.getLong(2), result.getLong(3)))
                    }
                }
            }
        }
    }

private fun countGenerations(productId: UUID): Int =
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

private fun executeUpdate(sql: String, vararg values: Any): Int =
    TestDatabase.dataSource.connection.use { connection ->
        try {
            connection.prepareStatement(sql).use { statement ->
                values.forEachIndexed { index, value -> statement.setObject(index + 1, value) }
                statement.executeUpdate().also { connection.commit() }
            }
        } catch (exception: SQLException) {
            connection.rollback()
            throw exception
        }
    }

private fun executeStatement(sql: String) {
    TestDatabase.dataSource.connection.use { connection ->
        try {
            connection.createStatement().use { it.execute(sql) }
            connection.commit()
        } catch (exception: SQLException) {
            connection.rollback()
            throw exception
        }
    }
}
