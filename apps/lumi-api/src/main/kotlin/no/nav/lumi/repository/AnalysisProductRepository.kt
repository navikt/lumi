package no.nav.lumi.repository

import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import no.nav.lumi.domain.AnalysisProduct
import no.nav.lumi.domain.AnalysisProductAuditEvent
import no.nav.lumi.domain.AnalysisProductAuditEventType
import no.nav.lumi.domain.AnalysisProductDocumentV1
import no.nav.lumi.domain.AnalysisProductDocumentValidator
import no.nav.lumi.domain.AnalysisProductDraft
import no.nav.lumi.domain.AnalysisProductDraftValidation
import no.nav.lumi.domain.AnalysisProductLifecycleState
import no.nav.lumi.domain.AnalysisProductRelease
import no.nav.lumi.domain.MAX_ANALYSIS_PRODUCT_DOCUMENT_BYTES
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.security.MessageDigest
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet
import java.sql.Types
import java.time.Clock
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID

sealed interface CreateAnalysisProductResult {
    data class Created(val product: AnalysisProduct) : CreateAnalysisProductResult
    data object LimitReached : CreateAnalysisProductResult
}

sealed interface UpdateAnalysisProductDraftResult {
    data class Updated(val product: AnalysisProduct) : UpdateAnalysisProductDraftResult
    data object NotFound : UpdateAnalysisProductDraftResult
    data object VersionConflict : UpdateAnalysisProductDraftResult
}

/**
 * Team-scoped persistence for the analysis-product control plane.
 *
 * There is intentionally no release write method in this slice. A release may
 * only be created after the catalog/compiler slice can produce a
 * server-validated draft revision, catalog revision and schema digest in one
 * transaction.
 */
class AnalysisProductRepository(
    private val clock: Clock = Clock.systemUTC(),
) {
    private val json = Json {
        encodeDefaults = true
        ignoreUnknownKeys = true
    }

    suspend fun create(
        team: String,
        document: AnalysisProductDocumentV1,
        principalIdentity: String,
    ): CreateAnalysisProductResult {
        val normalizedTeam = requiredValue("team", team, 255)
        val actor = requiredValue("principalIdentity", principalIdentity, 320)
        val storedDocument = prepareDocument(document)

        return dbQuery {
            val connection = currentJdbcConnection()
            lockTeamProductLimit(connection, normalizedTeam)
            if (countNonDeletedProducts(connection, normalizedTeam) >= MAX_PRODUCTS_PER_TEAM) {
                return@dbQuery CreateAnalysisProductResult.LimitReached
            }

            val productId = UUID.randomUUID()
            val draftId = UUID.randomUUID()
            connection.prepareStatement(
                """
                    INSERT INTO analysis_control.analysis_products (
                        id, team, created_by, updated_by
                    )
                    VALUES (?, ?, ?, ?)
                """.trimIndent(),
            ).use { statement ->
                statement.setObject(1, productId)
                statement.setString(2, normalizedTeam)
                statement.setString(3, actor)
                statement.setString(4, actor)
                statement.executeUpdate()
            }

            connection.prepareStatement(
                """
                    INSERT INTO analysis_control.analysis_product_drafts (
                        id, team, product_id, document, document_hash, created_by, updated_by
                    )
                    VALUES (?, ?, ?, ?::jsonb, ?, ?, ?)
                """.trimIndent(),
            ).use { statement ->
                statement.setObject(1, draftId)
                statement.setString(2, normalizedTeam)
                statement.setObject(3, productId)
                statement.setString(4, storedDocument.json)
                statement.setString(5, storedDocument.hash)
                statement.setString(6, actor)
                statement.setString(7, actor)
                statement.executeUpdate()
            }

            insertAuditEvent(
                connection = connection,
                team = normalizedTeam,
                productId = productId,
                eventNumber = 1,
                eventType = AnalysisProductAuditEventType.PRODUCT_CREATED,
                actor = actor,
                productVersion = 1,
                draftId = draftId,
                draftRevision = 1,
                subjectDigest = storedDocument.hash,
                nextState = AnalysisProductLifecycleState.DRAFT,
            )

            CreateAnalysisProductResult.Created(
                checkNotNull(findByIdInCurrentTransaction(connection, normalizedTeam, productId)),
            )
        }
    }

    suspend fun findByTeam(team: String): List<AnalysisProduct> {
        val normalizedTeam = requiredValue("team", team, 255)
        return dbQuery {
            val connection = currentJdbcConnection()
            connection.prepareStatement("$PRODUCT_WITH_DRAFT_SELECT WHERE p.team = ? ORDER BY p.updated_at DESC").use {
                statement ->
                statement.setString(1, normalizedTeam)
                statement.executeQuery().use { result ->
                    buildList {
                        while (result.next()) add(result.toProduct())
                    }
                }
            }
        }
    }

    suspend fun findById(team: String, productId: UUID): AnalysisProduct? {
        val normalizedTeam = requiredValue("team", team, 255)
        return dbQuery {
            findByIdInCurrentTransaction(currentJdbcConnection(), normalizedTeam, productId)
        }
    }

    suspend fun updateDraft(
        team: String,
        productId: UUID,
        draftId: UUID,
        expectedRevision: Long,
        document: AnalysisProductDocumentV1,
        principalIdentity: String,
    ): UpdateAnalysisProductDraftResult {
        require(expectedRevision > 0) { "expectedRevision must be positive" }
        val normalizedTeam = requiredValue("team", team, 255)
        val actor = requiredValue("principalIdentity", principalIdentity, 320)
        val storedDocument = prepareDocument(document)

        return dbQuery {
            val connection = currentJdbcConnection()
            val nextRevision = connection.prepareStatement(
                """
                    UPDATE analysis_control.analysis_product_drafts AS d
                    SET revision = d.revision + 1,
                        document = ?::jsonb,
                        document_hash = ?,
                        validated_revision = NULL,
                        validated_catalog_revision = NULL,
                        validated_base_schema_digest = NULL,
                        validated_by = NULL,
                        validated_at = NULL,
                        updated_by = ?,
                        updated_at = clock_timestamp()
                    FROM analysis_control.analysis_products AS p
                    WHERE d.product_id = p.id
                      AND d.team = p.team
                      AND p.team = ?
                      AND p.id = ?
                      AND d.id = ?
                      AND d.revision = ?
                    RETURNING d.revision
                """.trimIndent(),
            ).use { statement ->
                statement.setString(1, storedDocument.json)
                statement.setString(2, storedDocument.hash)
                statement.setString(3, actor)
                statement.setString(4, normalizedTeam)
                statement.setObject(5, productId)
                statement.setObject(6, draftId)
                statement.setLong(7, expectedRevision)
                statement.executeQuery().use { result -> if (result.next()) result.getLong("revision") else null }
            }

            if (nextRevision == null) {
                return@dbQuery classifyDraftMiss(
                    connection = connection,
                    team = normalizedTeam,
                    productId = productId,
                    draftId = draftId,
                )
            }

            val productVersion = connection.prepareStatement(
                """
                    UPDATE analysis_control.analysis_products
                    SET row_version = row_version + 1,
                        updated_by = ?,
                        updated_at = clock_timestamp()
                    WHERE team = ? AND id = ?
                    RETURNING row_version
                """.trimIndent(),
            ).use { statement ->
                statement.setString(1, actor)
                statement.setString(2, normalizedTeam)
                statement.setObject(3, productId)
                statement.executeQuery().use { result ->
                    check(result.next()) { "Analysis product disappeared while updating its draft" }
                    result.getLong("row_version")
                }
            }

            insertAuditEvent(
                connection = connection,
                team = normalizedTeam,
                productId = productId,
                eventNumber = productVersion,
                eventType = AnalysisProductAuditEventType.DRAFT_UPDATED,
                actor = actor,
                productVersion = productVersion,
                draftId = draftId,
                draftRevision = nextRevision,
                subjectDigest = storedDocument.hash,
            )

            UpdateAnalysisProductDraftResult.Updated(
                checkNotNull(findByIdInCurrentTransaction(connection, normalizedTeam, productId)),
            )
        }
    }

    suspend fun findReleases(team: String, productId: UUID): List<AnalysisProductRelease>? {
        val normalizedTeam = requiredValue("team", team, 255)
        return dbQuery {
            val connection = currentJdbcConnection()
            if (!productExists(connection, normalizedTeam, productId)) return@dbQuery null

            connection.prepareStatement(
                """
                    SELECT r.*
                    FROM analysis_control.analysis_product_releases AS r
                    WHERE r.team = ? AND r.product_id = ?
                    ORDER BY r.release_number DESC
                """.trimIndent(),
            ).use { statement ->
                statement.setString(1, normalizedTeam)
                statement.setObject(2, productId)
                statement.executeQuery().use { result ->
                    buildList {
                        while (result.next()) add(result.toRelease())
                    }
                }
            }
        }
    }

    suspend fun findAuditEvents(team: String, productId: UUID): List<AnalysisProductAuditEvent>? {
        val normalizedTeam = requiredValue("team", team, 255)
        return dbQuery {
            val connection = currentJdbcConnection()
            if (!productExists(connection, normalizedTeam, productId)) return@dbQuery null

            connection.prepareStatement(
                """
                    SELECT a.*
                    FROM analysis_control.analysis_product_audit_events AS a
                    WHERE a.team = ? AND a.product_id = ?
                    ORDER BY a.event_number ASC
                """.trimIndent(),
            ).use { statement ->
                statement.setString(1, normalizedTeam)
                statement.setObject(2, productId)
                statement.executeQuery().use { result ->
                    buildList {
                        while (result.next()) add(result.toAuditEvent())
                    }
                }
            }
        }
    }

    private fun prepareDocument(document: AnalysisProductDocumentV1): StoredDocument {
        val validated = AnalysisProductDocumentValidator.validate(document, LocalDate.now(clock))
        val encoded = json.encodeToString(validated.document)
        require(encoded.toByteArray(Charsets.UTF_8).size <= MAX_ANALYSIS_PRODUCT_DOCUMENT_BYTES) {
            "Analysis product document must be at most $MAX_ANALYSIS_PRODUCT_DOCUMENT_BYTES bytes"
        }
        return StoredDocument(encoded, sha256(encoded))
    }

    private fun classifyDraftMiss(
        connection: Connection,
        team: String,
        productId: UUID,
        draftId: UUID,
    ): UpdateAnalysisProductDraftResult {
        connection.prepareStatement(
            """
                SELECT d.revision
                FROM analysis_control.analysis_products AS p
                JOIN analysis_control.analysis_product_drafts AS d
                  ON d.team = p.team AND d.product_id = p.id
                WHERE p.team = ? AND p.id = ? AND d.id = ?
            """.trimIndent(),
        ).use { statement ->
            statement.setString(1, team)
            statement.setObject(2, productId)
            statement.setObject(3, draftId)
            statement.executeQuery().use { result ->
                return if (result.next()) {
                    UpdateAnalysisProductDraftResult.VersionConflict
                } else {
                    UpdateAnalysisProductDraftResult.NotFound
                }
            }
        }
    }

    private fun findByIdInCurrentTransaction(
        connection: Connection,
        team: String,
        productId: UUID,
    ): AnalysisProduct? = connection.prepareStatement(
        "$PRODUCT_WITH_DRAFT_SELECT WHERE p.team = ? AND p.id = ?",
    ).use { statement ->
        statement.setString(1, team)
        statement.setObject(2, productId)
        statement.executeQuery().use { result -> if (result.next()) result.toProduct() else null }
    }

    private fun productExists(connection: Connection, team: String, productId: UUID): Boolean =
        connection.prepareStatement(
            "SELECT 1 FROM analysis_control.analysis_products WHERE team = ? AND id = ?",
        ).use { statement ->
            statement.setString(1, team)
            statement.setObject(2, productId)
            statement.executeQuery().use { it.next() }
        }

    private fun insertAuditEvent(
        connection: Connection,
        team: String,
        productId: UUID,
        eventNumber: Long,
        eventType: AnalysisProductAuditEventType,
        actor: String,
        productVersion: Long,
        draftId: UUID? = null,
        draftRevision: Long? = null,
        releaseNumber: Long? = null,
        subjectDigest: String? = null,
        previousState: AnalysisProductLifecycleState? = null,
        nextState: AnalysisProductLifecycleState? = null,
    ) {
        connection.prepareStatement(
            """
                INSERT INTO analysis_control.analysis_product_audit_events (
                    id, team, product_id, event_number, event_type, actor_id,
                    product_version, draft_id, draft_revision, release_number,
                    subject_digest, previous_state, next_state
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """.trimIndent(),
        ).use { statement ->
            statement.setObject(1, UUID.randomUUID())
            statement.setString(2, team)
            statement.setObject(3, productId)
            statement.setLong(4, eventNumber)
            statement.setString(5, eventType.name)
            statement.setString(6, actor)
            statement.setLong(7, productVersion)
            statement.setObject(8, draftId)
            statement.setNullableLong(9, draftRevision)
            statement.setNullableLong(10, releaseNumber)
            statement.setString(11, subjectDigest)
            statement.setString(12, previousState?.name)
            statement.setString(13, nextState?.name)
            statement.executeUpdate()
        }
    }

    private fun ResultSet.toProduct(): AnalysisProduct {
        val draftId = getObject("draft_id", UUID::class.java)
        return AnalysisProduct(
            id = getObject("product_id", UUID::class.java).toString(),
            team = getString("product_team"),
            lifecycleState = AnalysisProductLifecycleState.valueOf(getString("lifecycle_state")),
            rowVersion = getLong("row_version"),
            lastReleaseNumber = getLong("last_release_number"),
            desiredReleaseNumber = nullableLong("desired_release_number"),
            activeReleaseNumber = nullableLong("active_release_number"),
            dataCutoffAt = getObject("data_cutoff_at", OffsetDateTime::class.java)?.toString(),
            draft = draftId?.let {
                val validatedRevision = nullableLong("validated_revision")
                AnalysisProductDraft(
                    id = it.toString(),
                    revision = getLong("draft_revision"),
                    baseReleaseNumber = nullableLong("base_release_number"),
                    document = json.decodeFromString(getString("draft_document")),
                    documentHash = getString("draft_document_hash"),
                    validation = validatedRevision?.let { revision ->
                        AnalysisProductDraftValidation(
                            revision = revision,
                            catalogRevision = getString("validated_catalog_revision"),
                            baseSchemaDigest = getString("validated_base_schema_digest"),
                            validatedBy = getString("validated_by"),
                            validatedAt = getObject("validated_at", OffsetDateTime::class.java).toString(),
                        )
                    },
                    createdBy = getString("draft_created_by"),
                    updatedBy = getString("draft_updated_by"),
                    createdAt = getObject("draft_created_at", OffsetDateTime::class.java).toString(),
                    updatedAt = getObject("draft_updated_at", OffsetDateTime::class.java).toString(),
                )
            },
            createdBy = getString("product_created_by"),
            updatedBy = getString("product_updated_by"),
            createdAt = getObject("product_created_at", OffsetDateTime::class.java).toString(),
            updatedAt = getObject("product_updated_at", OffsetDateTime::class.java).toString(),
        )
    }

    private fun ResultSet.toRelease() = AnalysisProductRelease(
        id = getObject("id", UUID::class.java).toString(),
        productId = getObject("product_id", UUID::class.java).toString(),
        releaseNumber = getLong("release_number"),
        sourceDraftId = getObject("source_draft_id", UUID::class.java).toString(),
        sourceDraftRevision = getLong("source_draft_revision"),
        sourceDocument = json.decodeFromString(getString("source_document")),
        sourceDocumentHash = getString("source_document_hash"),
        publicationSpecification = json.parseToJsonElement(getString("publication_specification")).jsonObject,
        publicationSpecificationDigest = getString("publication_specification_digest"),
        catalogRevision = getString("catalog_revision"),
        baseSchemaDigest = getString("base_schema_digest"),
        publishedBy = getString("published_by"),
        publishedAt = getObject("published_at", OffsetDateTime::class.java).toString(),
    )

    private fun ResultSet.toAuditEvent() = AnalysisProductAuditEvent(
        id = getObject("id", UUID::class.java).toString(),
        productId = getObject("product_id", UUID::class.java).toString(),
        eventNumber = getLong("event_number"),
        eventType = AnalysisProductAuditEventType.valueOf(getString("event_type")),
        actorId = getString("actor_id"),
        productVersion = getLong("product_version"),
        draftId = getObject("draft_id", UUID::class.java)?.toString(),
        draftRevision = nullableLong("draft_revision"),
        releaseNumber = nullableLong("release_number"),
        subjectDigest = getString("subject_digest"),
        previousState = getString("previous_state")?.let(AnalysisProductLifecycleState::valueOf),
        nextState = getString("next_state")?.let(AnalysisProductLifecycleState::valueOf),
        occurredAt = getObject("occurred_at", OffsetDateTime::class.java).toString(),
    )

    private fun currentJdbcConnection(): Connection =
        TransactionManager.current().connection.connection as Connection

    private fun lockTeamProductLimit(connection: Connection, team: String) {
        connection.prepareStatement(
            "SELECT pg_advisory_xact_lock(hashtextextended(?, 0))",
        ).use { statement ->
            statement.setString(1, "analysis-product-limit:$team")
            statement.execute()
        }
    }

    private fun countNonDeletedProducts(connection: Connection, team: String): Int =
        connection.prepareStatement(
            """
                SELECT count(*)
                FROM analysis_control.analysis_products
                WHERE team = ? AND lifecycle_state <> 'DELETED'
            """.trimIndent(),
        ).use { statement ->
            statement.setString(1, team)
            statement.executeQuery().use { result ->
                check(result.next())
                result.getInt(1)
            }
        }

    private fun ResultSet.nullableLong(column: String): Long? = getLong(column).let {
        if (wasNull()) null else it
    }

    private fun PreparedStatement.setNullableLong(index: Int, value: Long?) {
        if (value == null) setNull(index, Types.BIGINT) else setLong(index, value)
    }

    private data class StoredDocument(val json: String, val hash: String)

    private companion object {
        const val MAX_PRODUCTS_PER_TEAM = 10

        val PRODUCT_WITH_DRAFT_SELECT = """
            SELECT
                p.id AS product_id,
                p.team AS product_team,
                p.lifecycle_state,
                p.row_version,
                p.last_release_number,
                p.desired_release_number,
                p.active_release_number,
                p.data_cutoff_at,
                p.created_by AS product_created_by,
                p.updated_by AS product_updated_by,
                p.created_at AS product_created_at,
                p.updated_at AS product_updated_at,
                d.id AS draft_id,
                d.revision AS draft_revision,
                d.base_release_number,
                d.document AS draft_document,
                d.document_hash AS draft_document_hash,
                d.validated_revision,
                d.validated_catalog_revision,
                d.validated_base_schema_digest,
                d.validated_by,
                d.validated_at,
                d.created_by AS draft_created_by,
                d.updated_by AS draft_updated_by,
                d.created_at AS draft_created_at,
                d.updated_at AS draft_updated_at
            FROM analysis_control.analysis_products AS p
            LEFT JOIN analysis_control.analysis_product_drafts AS d
              ON d.team = p.team AND d.product_id = p.id
        """.trimIndent()

        fun requiredValue(name: String, raw: String, maxLength: Int): String = raw.trim().also {
            require(it.isNotEmpty()) { "$name is required" }
            require(it.length <= maxLength) { "$name must be at most $maxLength characters" }
        }

        fun sha256(value: String): String = MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
    }
}
