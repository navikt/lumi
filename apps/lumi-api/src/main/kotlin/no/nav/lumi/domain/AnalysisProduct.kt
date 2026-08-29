package no.nav.lumi.domain

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import java.time.LocalDate

const val ANALYSIS_PRODUCT_DOCUMENT_SCHEMA_VERSION = 1
const val MAX_ANALYSIS_PRODUCT_DOCUMENT_BYTES = 256 * 1024

/** Desired product lifecycle, deliberately separate from later delivery/platform status. */
@Serializable
enum class AnalysisProductLifecycleState {
    DRAFT,
    ENABLED,
    PAUSED,
    OFFBOARDING,
    DELETED,
}

@Serializable
enum class AnalysisProductUseCase {
    METABASE,
    DATA_STORY_NOTEBOOK,
}

@Serializable
enum class AnalysisProductRetention {
    SOURCE_MAXIMUM,
    DAYS_30,
    DAYS_90,
    DAYS_180,
}

@Serializable
data class AnalysisProductSourceSelection(
    val app: String,
    val surveyId: String,
    val fieldIds: List<String> = emptyList(),
)

/**
 * Mutable control-plane input. The type deliberately has no team property:
 * ownership is supplied by the already-authorized server context.
 *
 * Source ownership, field classifications and dimensions are validated by the
 * catalog/compiler slice. This foundation only validates bounded, structural
 * input before it can be persisted as a draft.
 */
@Serializable
data class AnalysisProductDocumentV1(
    val schemaVersion: Int = ANALYSIS_PRODUCT_DOCUMENT_SCHEMA_VERSION,
    val name: String,
    val purpose: String,
    val dataOwner: String,
    val technicalOwner: String,
    val processingReference: String? = null,
    val useCases: List<AnalysisProductUseCase>,
    val retention: AnalysisProductRetention,
    val reviewDate: String,
    val sources: List<AnalysisProductSourceSelection> = emptyList(),
    val dimensionKeys: List<String> = emptyList(),
    val includeSubmittedHour: Boolean = false,
)

data class ValidatedAnalysisProductDocument(
    val document: AnalysisProductDocumentV1,
    val reviewDate: LocalDate,
)

object AnalysisProductDocumentValidator {
    private val identifierPattern = Regex("^[A-Za-z0-9._-]+$")

    fun validate(
        raw: AnalysisProductDocumentV1,
        today: LocalDate,
    ): ValidatedAnalysisProductDocument {
        require(raw.schemaVersion == ANALYSIS_PRODUCT_DOCUMENT_SCHEMA_VERSION) {
            "Only analysis product document schema version 1 is supported"
        }

        val normalized = raw.copy(
            name = requiredText("name", raw.name, 120),
            purpose = requiredText("purpose", raw.purpose, 2_000),
            dataOwner = requiredText("dataOwner", raw.dataOwner, 255),
            technicalOwner = requiredText("technicalOwner", raw.technicalOwner, 255),
            processingReference = raw.processingReference?.trim()?.takeIf(String::isNotEmpty)?.also {
                require(it.length <= 500) { "processingReference must be at most 500 characters" }
            },
            useCases = raw.useCases.distinct(),
            sources = raw.sources.map(::normalizeSource),
            dimensionKeys = raw.dimensionKeys.map { normalizeIdentifier("dimension key", it, 100) }.distinct(),
        )

        require(normalized.useCases.isNotEmpty()) { "At least one analysis use case is required" }
        require(normalized.useCases.size == raw.useCases.size) { "Analysis use cases must be unique" }
        require(normalized.sources.size <= 100) { "At most 100 sources can be selected" }
        require(normalized.sources.map { it.app to it.surveyId }.distinct().size == normalized.sources.size) {
            "Each app and surveyId source must be unique"
        }
        require(normalized.dimensionKeys.size == raw.dimensionKeys.size) { "Dimension keys must be unique" }
        require(normalized.dimensionKeys.size <= 50) { "At most 50 dimensions can be selected" }

        val reviewDate = try {
            LocalDate.parse(normalized.reviewDate)
        } catch (_: Exception) {
            throw IllegalArgumentException("reviewDate must use ISO-8601 date format")
        }
        require(!reviewDate.isBefore(today)) { "reviewDate cannot be in the past" }
        require(!reviewDate.isAfter(today.plusMonths(12))) {
            "reviewDate must be at most 12 months in the future"
        }

        return ValidatedAnalysisProductDocument(normalized, reviewDate)
    }

    private fun normalizeSource(source: AnalysisProductSourceSelection): AnalysisProductSourceSelection {
        val fieldIds = source.fieldIds.map { normalizeOpaqueIdentifier("fieldId", it, 200) }.distinct()
        require(fieldIds.size == source.fieldIds.size) { "fieldIds must be unique within a source" }
        require(fieldIds.size <= 500) { "At most 500 fields can be selected per source" }
        return source.copy(
            app = normalizeOpaqueIdentifier("app", source.app, 255),
            surveyId = normalizeOpaqueIdentifier("surveyId", source.surveyId, 255),
            fieldIds = fieldIds,
        )
    }

    private fun requiredText(name: String, value: String, maxLength: Int): String = value.trim().also {
        require(it.isNotEmpty()) { "$name is required" }
        require(it.length <= maxLength) { "$name must be at most $maxLength characters" }
    }

    private fun normalizeIdentifier(name: String, value: String, maxLength: Int): String = value.trim().also {
        require(it.isNotEmpty()) { "$name is required" }
        require(it.length <= maxLength) { "$name must be at most $maxLength characters" }
        require(identifierPattern.matches(it)) { "$name contains unsupported characters" }
    }

    private fun normalizeOpaqueIdentifier(name: String, value: String, maxLength: Int): String = value.also {
        require(it.isNotBlank()) { "$name is required" }
        require(it.length <= maxLength) { "$name must be at most $maxLength characters" }
    }
}

@Serializable
data class AnalysisProductDraft(
    val id: String,
    val revision: Long,
    val baseReleaseNumber: Long?,
    val document: AnalysisProductDocumentV1,
    val documentHash: String,
    val validation: AnalysisProductDraftValidation?,
    val createdBy: String,
    val updatedBy: String,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
data class AnalysisProductDraftValidation(
    val revision: Long,
    val catalogRevision: String,
    val baseSchemaDigest: String,
    val validatedBy: String,
    val validatedAt: String,
)

@Serializable
data class AnalysisProduct(
    val id: String,
    val team: String,
    val lifecycleState: AnalysisProductLifecycleState,
    val rowVersion: Long,
    val lastReleaseNumber: Long,
    val desiredReleaseNumber: Long?,
    val activeReleaseNumber: Long?,
    val dataCutoffAt: String?,
    val draft: AnalysisProductDraft?,
    val createdBy: String,
    val updatedBy: String,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
data class AnalysisProductRelease(
    val id: String,
    val productId: String,
    val releaseNumber: Long,
    val sourceDraftId: String,
    val sourceDraftRevision: Long,
    val sourceDocument: AnalysisProductDocumentV1,
    val sourceDocumentHash: String,
    val publicationSpecification: JsonObject,
    val publicationSpecificationDigest: String,
    val catalogRevision: String,
    val baseSchemaDigest: String,
    val publishedBy: String,
    val publishedAt: String,
)

@Serializable
enum class AnalysisProductAuditEventType {
    PRODUCT_CREATED,
    DRAFT_UPDATED,
    DRAFT_VALIDATED,
    RELEASE_PUBLISHED,
    RELEASE_DESIRED,
    RELEASE_ACTIVATED,
    LIFECYCLE_CHANGED,
}

@Serializable
data class AnalysisProductAuditEvent(
    val id: String,
    val productId: String,
    val eventNumber: Long,
    val eventType: AnalysisProductAuditEventType,
    val actorId: String,
    val productVersion: Long,
    val draftId: String?,
    val draftRevision: Long?,
    val releaseNumber: Long?,
    val subjectDigest: String?,
    val previousState: AnalysisProductLifecycleState?,
    val nextState: AnalysisProductLifecycleState?,
    val occurredAt: String,
)
