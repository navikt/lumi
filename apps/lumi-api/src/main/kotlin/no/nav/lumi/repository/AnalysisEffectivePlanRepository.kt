package no.nav.lumi.repository

import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import no.nav.lumi.domain.AnalysisCanonicalHash
import no.nav.lumi.domain.AnalysisContractJson
import no.nav.lumi.domain.AnalysisEffectivePublicationPlanResolver
import no.nav.lumi.domain.AnalysisProductLifecycleState
import no.nav.lumi.domain.AnalysisPublicationControlState
import no.nav.lumi.domain.AnalysisPublicationPlan
import no.nav.lumi.domain.AnalysisPublicationPlanDigests
import no.nav.lumi.domain.AnalysisPublicationReleaseV2
import no.nav.lumi.domain.AnalysisPublicationSpecificationV2
import no.nav.lumi.domain.EffectivePublicationSpecification
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet
import java.sql.Types
import java.time.Instant
import java.time.OffsetDateTime
import java.util.UUID

enum class EffectivePlanKind {
    NONE,
    ENABLED,
    PAUSED,
    OFFBOARDING,
}

data class EffectivePlanGeneration(
    val id: UUID,
    val team: String,
    val productId: UUID,
    val generation: Long,
    val controlEpoch: Long,
    val productRowVersion: Long,
    val planKind: EffectivePlanKind,
    val lifecycleState: AnalysisProductLifecycleState,
    val activeReleaseNumber: Long?,
    val desiredReleaseNumber: Long?,
    val dataCutoffAt: Instant?,
    val planDigest: String,
    val createdAt: Instant,
)

sealed interface PersistEffectivePlanResult {
    data class Created(val generation: EffectivePlanGeneration) : PersistEffectivePlanResult
    data class Unchanged(val generation: EffectivePlanGeneration) : PersistEffectivePlanResult
    data object NotFound : PersistEffectivePlanResult
}

/**
 * Persists the resolver-owned export scope for a locked product state.
 *
 * There is deliberately no API accepting a pre-resolved plan or caller-owned
 * scope. Product state and immutable V2 releases are read and verified inside
 * the same transaction that appends the sealed generation.
 */
class AnalysisEffectivePlanRepository {
    suspend fun persistCurrent(team: String, productId: UUID): PersistEffectivePlanResult {
        val normalizedTeam = team.trim().also {
            require(it.isNotEmpty()) { "team is required" }
            require(it.length <= 255) { "team must be at most 255 characters" }
        }

        return dbQuery {
            val connection = currentJdbcConnection()
            val product = lockProduct(connection, normalizedTeam, productId)
                ?: return@dbQuery PersistEffectivePlanResult.NotFound
            val state = product.toControlState()
            val plan = AnalysisEffectivePublicationPlanResolver.resolve(
                state = state,
                releases = readReferencedV2Releases(connection, state),
            )
            val planDigest = AnalysisPublicationPlanDigests.digest(state, plan)
            val latest = findLatest(connection, normalizedTeam, productId)
            if (latest?.planDigest == planDigest) {
                return@dbQuery PersistEffectivePlanResult.Unchanged(latest)
            }

            val generationNumber = (latest?.generation ?: 0) + 1
            val generation = insertGeneration(
                connection = connection,
                product = product,
                generation = generationNumber,
                planKind = plan.kind(),
                planDigest = planDigest,
            )
            plan.specifications().forEach { (role, specification) ->
                insertSpecification(connection, generation.id, role, specification)
                insertAtoms(connection, generation.id, role, specification)
            }
            PersistEffectivePlanResult.Created(generation)
        }
    }

    private fun lockProduct(
        connection: Connection,
        team: String,
        productId: UUID,
    ): LockedProduct? = connection.prepareStatement(
        """
            SELECT team, id, row_version, lifecycle_state,
                   active_release_number, desired_release_number, data_cutoff_at
            FROM analysis_control.analysis_products
            WHERE team = ? AND id = ?
            FOR UPDATE
        """.trimIndent(),
    ).use { statement ->
        statement.setString(1, team)
        statement.setObject(2, productId)
        statement.executeQuery().use { result ->
            if (!result.next()) return@use null
            LockedProduct(
                team = result.getString("team"),
                productId = result.getObject("id", UUID::class.java),
                rowVersion = result.getLong("row_version"),
                lifecycleState = AnalysisProductLifecycleState.valueOf(result.getString("lifecycle_state")),
                activeReleaseNumber = result.nullableLong("active_release_number"),
                desiredReleaseNumber = result.nullableLong("desired_release_number"),
                dataCutoffAt = result.getObject("data_cutoff_at", OffsetDateTime::class.java)?.toInstant(),
            )
        }
    }

    private fun readReferencedV2Releases(
        connection: Connection,
        state: AnalysisPublicationControlState,
    ): List<AnalysisPublicationReleaseV2> = connection.prepareStatement(
        """
            SELECT release_number, publication_specification, publication_specification_digest
            FROM analysis_control.analysis_product_releases
            WHERE team = ? AND product_id = ?
              AND (release_number = ? OR release_number = ?)
              AND publication_specification ->> 'schemaVersion' = '2'
            ORDER BY release_number
        """.trimIndent(),
    ).use { statement ->
        statement.setString(1, state.team)
        statement.setObject(2, UUID.fromString(state.productId))
        statement.setNullableLong(3, state.activeReleaseNumber)
        statement.setNullableLong(4, state.desiredReleaseNumber)
        statement.executeQuery().use { result ->
            buildList {
                while (result.next()) {
                    add(
                        AnalysisPublicationReleaseV2(
                            releaseNumber = result.getLong("release_number"),
                            specification = AnalysisContractJson.decodeFromString<AnalysisPublicationSpecificationV2>(
                                result.getString("publication_specification"),
                            ),
                            specificationDigest = result.getString("publication_specification_digest"),
                        ),
                    )
                }
            }
        }
    }

    private fun findLatest(
        connection: Connection,
        team: String,
        productId: UUID,
    ): EffectivePlanGeneration? = connection.prepareStatement(
        """
            SELECT *
            FROM analysis_control.analysis_effective_plan_generations
            WHERE team = ? AND product_id = ?
            ORDER BY generation DESC
            LIMIT 1
        """.trimIndent(),
    ).use { statement ->
        statement.setString(1, team)
        statement.setObject(2, productId)
        statement.executeQuery().use { result -> if (result.next()) result.toGeneration() else null }
    }

    private fun insertGeneration(
        connection: Connection,
        product: LockedProduct,
        generation: Long,
        planKind: EffectivePlanKind,
        planDigest: String,
    ): EffectivePlanGeneration = connection.prepareStatement(
        """
            INSERT INTO analysis_control.analysis_effective_plan_generations (
                team, product_id, generation, product_row_version,
                plan_kind, lifecycle_state, active_release_number,
                desired_release_number, data_cutoff_at, plan_digest
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING *
        """.trimIndent(),
    ).use { statement ->
        statement.setString(1, product.team)
        statement.setObject(2, product.productId)
        statement.setLong(3, generation)
        statement.setLong(4, product.rowVersion)
        statement.setString(5, planKind.name)
        statement.setString(6, product.lifecycleState.name)
        statement.setNullableLong(7, product.activeReleaseNumber)
        statement.setNullableLong(8, product.desiredReleaseNumber)
        statement.setObject(9, product.dataCutoffAt?.atOffset(java.time.ZoneOffset.UTC))
        statement.setString(10, planDigest)
        statement.executeQuery().use { result ->
            check(result.next()) { "Effective generation insert returned no row" }
            result.toGeneration()
        }
    }

    private fun insertSpecification(
        connection: Connection,
        generationId: UUID,
        role: EffectiveSpecRole,
        specification: EffectivePublicationSpecification,
    ) {
        connection.prepareStatement(
            """
                INSERT INTO analysis_control.analysis_effective_specs (
                    generation_id, role, team, product_id,
                    target_release_number, upper_allowlist_release_number,
                    lifecycle_mode, retention, data_cutoff_at, submitted_hour_mode,
                    effective_specification_digest, effective_schema_digest, resources
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)
            """.trimIndent(),
        ).use { statement ->
            statement.setObject(1, generationId)
            statement.setString(2, role.name)
            statement.setString(3, specification.team)
            statement.setObject(4, UUID.fromString(specification.productId))
            statement.setLong(5, specification.targetRelease)
            statement.setLong(6, specification.upperAllowlistRelease)
            statement.setString(7, specification.lifecycleMode.name)
            statement.setString(8, specification.retention.name)
            statement.setObject(9, specification.dataCutoffAt?.atOffset(java.time.ZoneOffset.UTC))
            statement.setString(10, specification.submittedHourMode.name)
            statement.setString(11, specification.effectiveSpecificationDigest)
            statement.setString(12, specification.effectiveSchemaDigest)
            statement.setString(13, AnalysisContractJson.encodeToString(specification.resources))
            check(statement.executeUpdate() == 1) { "Effective specification insert failed" }
        }
    }

    private fun insertAtoms(
        connection: Connection,
        generationId: UUID,
        role: EffectiveSpecRole,
        specification: EffectivePublicationSpecification,
    ) {
        val atoms = buildList {
            specification.sources.forEach { source ->
                add(
                    EffectiveAtom(
                        kind = "SOURCE",
                        identity = listOf(source.app, source.surveyId),
                        app = source.app,
                        surveyId = source.surveyId,
                        surveyType = source.surveyType.name,
                        membershipAllowed = source.membershipAllowed,
                    ),
                )
                source.fields.forEach { field ->
                    add(
                        EffectiveAtom(
                            kind = "FIELD",
                            identity = listOf(source.app, source.surveyId, field.fieldId),
                            app = source.app,
                            surveyId = source.surveyId,
                            fieldId = field.fieldId,
                            fieldMode = field.mode.name,
                        ),
                    )
                }
                source.definitions.forEach { definition ->
                    add(
                        EffectiveAtom(
                            kind = "DEFINITION",
                            identity = listOf(source.app, source.surveyId, definition.definitionHash),
                            app = source.app,
                            surveyId = source.surveyId,
                            definitionHash = definition.definitionHash,
                        ),
                    )
                    definition.fields.forEach { field ->
                        add(
                            EffectiveAtom(
                                kind = "DEFINITION_FIELD",
                                identity = listOf(
                                    source.app,
                                    source.surveyId,
                                    definition.definitionHash,
                                    field.fieldId,
                                ),
                                app = source.app,
                                surveyId = source.surveyId,
                                definitionHash = definition.definitionHash,
                                fieldId = field.fieldId,
                                fieldPresence = field.presence.name,
                                fieldType = field.fieldType?.name,
                                ratingVariant = field.ratingVariant?.name,
                                ratingScale = field.ratingScale,
                                maxSelections = field.maxSelections,
                            ),
                        )
                        field.availableOptionIds.forEach { optionId ->
                            add(
                                EffectiveAtom(
                                    kind = "OPTION",
                                    identity = listOf(
                                        source.app,
                                        source.surveyId,
                                        definition.definitionHash,
                                        field.fieldId,
                                        optionId,
                                    ),
                                    app = source.app,
                                    surveyId = source.surveyId,
                                    definitionHash = definition.definitionHash,
                                    fieldId = field.fieldId,
                                    optionId = optionId,
                                ),
                            )
                        }
                    }
                    definition.flows.forEach { flow ->
                        add(
                            EffectiveAtom(
                                kind = "FLOW",
                                identity = listOf(
                                    source.app,
                                    source.surveyId,
                                    definition.definitionHash,
                                    flow.flowHash,
                                ),
                                app = source.app,
                                surveyId = source.surveyId,
                                definitionHash = definition.definitionHash,
                                flowHash = flow.flowHash,
                                evaluatorVersion = flow.evaluatorVersion,
                            ),
                        )
                        flow.dependenciesByField.forEach { fieldDependencies ->
                            fieldDependencies.dependencies.forEach { dependency ->
                                add(
                                    EffectiveAtom(
                                        kind = "DEPENDENCY",
                                        identity = listOf(
                                            source.app,
                                            source.surveyId,
                                            definition.definitionHash,
                                            flow.flowHash,
                                            fieldDependencies.fieldId,
                                            dependency.source.name,
                                            dependency.key,
                                        ),
                                        app = source.app,
                                        surveyId = source.surveyId,
                                        definitionHash = definition.definitionHash,
                                        fieldId = fieldDependencies.fieldId,
                                        flowHash = flow.flowHash,
                                        dependencySource = dependency.source.name,
                                        dependencyKey = dependency.key,
                                    ),
                                )
                            }
                        }
                    }
                }
            }
            specification.dimensions.forEach { dimension ->
                add(
                    EffectiveAtom(
                        kind = "DIMENSION",
                        identity = listOf(dimension.definition.key),
                        dimensionKey = dimension.definition.key,
                        dimensionMode = dimension.mode.name,
                        dimensionOutputId = dimension.definition.outputId,
                        dimensionType = dimension.definition.type.name,
                        dimensionDefinition = AnalysisContractJson.encodeToString(dimension.definition),
                    ),
                )
            }
        }

        connection.prepareStatement(INSERT_ATOM_SQL).use { statement ->
            atoms.forEach { atom ->
                statement.setObject(1, generationId)
                statement.setString(2, role.name)
                statement.setString(3, atom.kind)
                statement.setString(
                    4,
                    AnalysisCanonicalHash.digest(
                        "analysis-effective-atom-v1",
                        listOf(role.name, atom.kind) + atom.identity,
                    ),
                )
                statement.setNullableString(5, atom.app)
                statement.setNullableString(6, atom.surveyId)
                statement.setNullableString(7, atom.surveyType)
                statement.setNullableBoolean(8, atom.membershipAllowed)
                statement.setNullableString(9, atom.fieldId)
                statement.setNullableString(10, atom.fieldMode)
                statement.setNullableString(11, atom.definitionHash)
                statement.setNullableString(12, atom.fieldPresence)
                statement.setNullableString(13, atom.fieldType)
                statement.setNullableString(14, atom.ratingVariant)
                statement.setNullableInt(15, atom.ratingScale)
                statement.setNullableInt(16, atom.maxSelections)
                statement.setNullableString(17, atom.optionId)
                statement.setNullableString(18, atom.flowHash)
                statement.setNullableString(19, atom.evaluatorVersion)
                statement.setNullableString(20, atom.dependencySource)
                statement.setNullableString(21, atom.dependencyKey)
                statement.setNullableString(22, atom.dimensionKey)
                statement.setNullableString(23, atom.dimensionMode)
                statement.setNullableString(24, atom.dimensionOutputId)
                statement.setNullableString(25, atom.dimensionType)
                statement.setNullableString(26, atom.dimensionDefinition)
                statement.addBatch()
            }
            if (atoms.isNotEmpty()) statement.executeBatch()
        }
    }

    private fun ResultSet.toGeneration() = EffectivePlanGeneration(
        id = getObject("id", UUID::class.java),
        team = getString("team"),
        productId = getObject("product_id", UUID::class.java),
        generation = getLong("generation"),
        controlEpoch = getLong("control_epoch"),
        productRowVersion = getLong("product_row_version"),
        planKind = EffectivePlanKind.valueOf(getString("plan_kind")),
        lifecycleState = AnalysisProductLifecycleState.valueOf(getString("lifecycle_state")),
        activeReleaseNumber = nullableLong("active_release_number"),
        desiredReleaseNumber = nullableLong("desired_release_number"),
        dataCutoffAt = getObject("data_cutoff_at", OffsetDateTime::class.java)?.toInstant(),
        planDigest = getString("plan_digest"),
        createdAt = getObject("created_at", OffsetDateTime::class.java).toInstant(),
    )

    private fun currentJdbcConnection(): Connection =
        TransactionManager.current().connection.connection as Connection
}

private enum class EffectiveSpecRole {
    MAINTAINED,
    CANDIDATE,
}

private data class LockedProduct(
    val team: String,
    val productId: UUID,
    val rowVersion: Long,
    val lifecycleState: AnalysisProductLifecycleState,
    val activeReleaseNumber: Long?,
    val desiredReleaseNumber: Long?,
    val dataCutoffAt: Instant?,
) {
    fun toControlState() = AnalysisPublicationControlState(
        productId = productId.toString(),
        team = team,
        lifecycleState = lifecycleState,
        activeReleaseNumber = activeReleaseNumber,
        desiredReleaseNumber = desiredReleaseNumber,
        dataCutoffAt = dataCutoffAt,
    )
}

private data class EffectiveAtom(
    val kind: String,
    val identity: List<String>,
    val app: String? = null,
    val surveyId: String? = null,
    val surveyType: String? = null,
    val membershipAllowed: Boolean? = null,
    val fieldId: String? = null,
    val fieldMode: String? = null,
    val definitionHash: String? = null,
    val fieldPresence: String? = null,
    val fieldType: String? = null,
    val ratingVariant: String? = null,
    val ratingScale: Int? = null,
    val maxSelections: Int? = null,
    val optionId: String? = null,
    val flowHash: String? = null,
    val evaluatorVersion: String? = null,
    val dependencySource: String? = null,
    val dependencyKey: String? = null,
    val dimensionKey: String? = null,
    val dimensionMode: String? = null,
    val dimensionOutputId: String? = null,
    val dimensionType: String? = null,
    val dimensionDefinition: String? = null,
)

private fun AnalysisPublicationPlan.kind(): EffectivePlanKind = when (this) {
    is AnalysisPublicationPlan.Enabled -> EffectivePlanKind.ENABLED
    is AnalysisPublicationPlan.Paused -> EffectivePlanKind.PAUSED
    is AnalysisPublicationPlan.Offboarding -> EffectivePlanKind.OFFBOARDING
    AnalysisPublicationPlan.None -> EffectivePlanKind.NONE
}

private fun AnalysisPublicationPlan.specifications(): List<Pair<EffectiveSpecRole, EffectivePublicationSpecification>> =
    when (this) {
        is AnalysisPublicationPlan.Enabled -> buildList {
            add(EffectiveSpecRole.MAINTAINED to maintainedTarget)
            candidate?.let { add(EffectiveSpecRole.CANDIDATE to it) }
        }

        is AnalysisPublicationPlan.Paused -> listOf(EffectiveSpecRole.MAINTAINED to maintainedTarget)
        is AnalysisPublicationPlan.Offboarding, AnalysisPublicationPlan.None -> emptyList()
    }

private fun ResultSet.nullableLong(column: String): Long? = getLong(column).let {
    if (wasNull()) null else it
}

private fun PreparedStatement.setNullableLong(index: Int, value: Long?) {
    if (value == null) setNull(index, Types.BIGINT) else setLong(index, value)
}

private fun PreparedStatement.setNullableString(index: Int, value: String?) {
    if (value == null) setNull(index, Types.VARCHAR) else setString(index, value)
}

private fun PreparedStatement.setNullableBoolean(index: Int, value: Boolean?) {
    if (value == null) setNull(index, Types.BOOLEAN) else setBoolean(index, value)
}

private fun PreparedStatement.setNullableInt(index: Int, value: Int?) {
    if (value == null) setNull(index, Types.INTEGER) else setInt(index, value)
}

private const val INSERT_ATOM_SQL = """
    INSERT INTO analysis_control.analysis_effective_atoms (
        generation_id, spec_role, atom_kind, atom_key,
        app, survey_id, survey_type, membership_allowed,
        field_id, field_mode, definition_hash, field_presence,
        field_type, rating_variant, rating_scale, max_selections,
        option_id, flow_hash, evaluator_version,
        dependency_source, dependency_key,
        dimension_key, dimension_mode, dimension_output_id,
        dimension_type, dimension_definition
    ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb
    )
"""
