package no.nav.lumi.domain

import kotlinx.serialization.Serializable
import java.security.MessageDigest

@Serializable
data class FieldDefinition(
    val fieldId: String,
    val fieldType: FieldType,
    val ratingVariant: RatingVariant?,
    val ratingScale: Int?,
    val optionIds: List<String>?,
    val maxSelections: Int? = null,
)

@Serializable
data class SurveyDefinition(
    val surveyId: String,
    val surveyType: SurveyType,
    val fields: List<FieldDefinition>
) {
    companion object {
        fun fromSubmission(submission: FeedbackSubmissionV1): SurveyDefinition {
            val fields = submission.answers.map { answer ->
                val isChoiceType = answer.fieldType in setOf(FieldType.SINGLE_CHOICE, FieldType.MULTI_CHOICE)
                FieldDefinition(
                    fieldId = answer.fieldId,
                    fieldType = answer.fieldType,
                    ratingVariant = (answer.value as? AnswerValue.Rating)?.ratingVariant,
                    ratingScale = (answer.value as? AnswerValue.Rating)?.ratingScale,
                    optionIds = if (isChoiceType) answer.question.options?.map { it.id } else null,
                    maxSelections = null,
                )
            }

            return SurveyDefinition(
                surveyId = submission.surveyId,
                surveyType = submission.surveyType,
                fields = fields
            )
        }
    }
}

fun FieldDefinition.isStructurallyEqualTo(other: FieldDefinition): Boolean {
    return fieldType == other.fieldType &&
        ratingVariant == other.ratingVariant &&
        ratingScale == other.ratingScale &&
        optionIds == other.optionIds &&
        maxSelections == other.maxSelections
}

fun SurveyDefinition.mergeWith(incoming: SurveyDefinition): SurveyDefinition {
    val storedFieldsById = fields.associateBy { it.fieldId }
    val incomingFieldsById = incoming.fields.associateBy { it.fieldId }

    val mergedFields = buildList {
        addAll(fields.map { storedField -> incomingFieldsById[storedField.fieldId] ?: storedField })
        addAll(incoming.fields.filterNot { it.fieldId in storedFieldsById })
    }

    return SurveyDefinition(
        surveyId = surveyId,
        surveyType = incoming.surveyType,
        fields = mergedFields
    )
}

/**
 * One-time enrichment for definitions stored before maxSelections was part of
 * the V2 contract. It only fills a missing limit when every previously known
 * structural property is unchanged; subsequent limit changes remain conflicts.
 */
fun SurveyDefinition.withMissingMaxSelectionsFrom(incoming: SurveyDefinition): SurveyDefinition {
    val incomingById = incoming.fields.associateBy { it.fieldId }
    var changed = false
    val enriched = fields.map { storedField ->
        val incomingField = incomingById[storedField.fieldId]
        if (
            storedField.maxSelections == null &&
            incomingField?.maxSelections != null &&
            storedField.fieldType == incomingField.fieldType &&
            storedField.ratingVariant == incomingField.ratingVariant &&
            storedField.ratingScale == incomingField.ratingScale &&
            storedField.optionIds == incomingField.optionIds
        ) {
            changed = true
            storedField.copy(maxSelections = incomingField.maxSelections)
        } else {
            storedField
        }
    }
    return if (changed) copy(fields = enriched) else this
}

data class FieldChange(
    val fieldId: String,
    val change: String
)

data class DefinitionDiff(
    val addedFields: List<String>,
    val removedFields: List<String>,
    val changedFields: List<FieldChange>
) {
    fun hasChanges(): Boolean = addedFields.isNotEmpty() || removedFields.isNotEmpty() || changedFields.isNotEmpty()

    fun describe(): String {
        return describeInternal(redactIdentifiers = false)
    }

    fun describeRedacted(): String {
        return describeInternal(redactIdentifiers = true)
    }

    private fun describeInternal(redactIdentifiers: Boolean): String {
        val fieldAliases = if (redactIdentifiers) {
            (addedFields + removedFields + changedFields.map { it.fieldId })
                .filterNot { it == "_surveyType" }
                .distinct()
                .sorted()
                .mapIndexed { index, fieldId -> fieldId to "field_${index + 1}" }
                .toMap()
        } else {
            emptyMap()
        }

        fun redactFieldId(fieldId: String): String = fieldAliases[fieldId] ?: fieldId

        fun redactChange(change: String): String {
            if (!redactIdentifiers) return change
            return change.replace(
                Regex("""optionIds (null|\[[^\]]*]) -> (null|\[[^\]]*])"""),
                "optionIds [REDACTED] -> [REDACTED]"
            )
        }

        val parts = buildList {
            if (addedFields.isNotEmpty()) add("addedFields=${addedFields.map(::redactFieldId)}")
            if (removedFields.isNotEmpty()) add("removedFields=${removedFields.map(::redactFieldId)}")
            if (changedFields.isNotEmpty()) {
                add(
                    "changedFields=${changedFields.map { "${redactFieldId(it.fieldId)}: ${redactChange(it.change)}" }}"
                )
            }
        }

        return if (parts.isEmpty()) {
            "no structural diff"
        } else {
            parts.joinToString(", ")
        }
    }
}

/**
 * Compute a structural SHA-256 hash over the survey definition.
 *
 * HASH STABILITY CONTRACT: The canonical JSON format used for hashing must NEVER change
 * once deployed to production. Any change invalidates all stored hashes and breaks
 * immutability enforcement. All enums use Kotlin .name (e.g. "RATING", "SINGLE_CHOICE",
 * "EMOJI") for consistency and predictability.
 *
 * FIELD ORDER: Fields are sorted by fieldId in the canonical JSON, making the hash
 * order-insensitive. This is intentional — submission field order is a client concern,
 * not a structural property. The diff() function still reports reordering as context
 * when a real structural conflict exists, but pure reordering alone is accepted.
 *
 * SURVEY ID: surveyId is intentionally excluded from the hash. The hash is a structural
 * fingerprint scoped by the (team, surveyId) lookup key. Two surveys with identical
 * structure produce the same hash — this is by design.
 *
 * PARTIAL SUBMISSIONS: Widget v1 may send only answered questions. Missing fields
 * are therefore treated as "unknown so far", not as structural removals. When a
 * later submission adds new non-overlapping fields, the stored definition is
 * widened by union. Structural changes to already-known fields still conflict.
 */
fun SurveyDefinition.computeHash(): String {
    val canonicalJson = toCanonicalJson()
    val digest = MessageDigest.getInstance("SHA-256").digest(canonicalJson.toByteArray(Charsets.UTF_8))
    return digest.joinToString("") { "%02x".format(it) }
}

fun diff(stored: SurveyDefinition, incoming: SurveyDefinition): DefinitionDiff {
    val addedFields = incoming.fields.map { it.fieldId } - stored.fields.map { it.fieldId }.toSet()
    val removedFields = stored.fields.map { it.fieldId } - incoming.fields.map { it.fieldId }.toSet()

    val storedFieldsById = stored.fields.associateBy { it.fieldId }
    val incomingFieldsById = incoming.fields.associateBy { it.fieldId }

    val changedFields = buildList {
        if (stored.surveyType != incoming.surveyType) {
            add(FieldChange("_surveyType", "${stored.surveyType} -> ${incoming.surveyType}"))
        }

        val commonIds = storedFieldsById.keys.intersect(incomingFieldsById.keys)
        for (fieldId in commonIds.sorted()) {
            val storedField = storedFieldsById.getValue(fieldId)
            val incomingField = incomingFieldsById.getValue(fieldId)

            val changes = buildList {
                if (storedField.fieldType != incomingField.fieldType) {
                    add("fieldType ${storedField.fieldType} -> ${incomingField.fieldType}")
                }
                if (storedField.ratingVariant != incomingField.ratingVariant) {
                    add("ratingVariant ${storedField.ratingVariant} -> ${incomingField.ratingVariant}")
                }
                if (storedField.ratingScale != incomingField.ratingScale) {
                    add("ratingScale ${storedField.ratingScale} -> ${incomingField.ratingScale}")
                }
                if (storedField.optionIds != incomingField.optionIds) {
                    add("optionIds ${storedField.optionIds} -> ${incomingField.optionIds}")
                }
                if (storedField.maxSelections != incomingField.maxSelections) {
                    add("maxSelections ${storedField.maxSelections} -> ${incomingField.maxSelections}")
                }
            }

            if (changes.isNotEmpty()) {
                add(FieldChange(fieldId, changes.joinToString(", ")))
            }
        }
    }

    return DefinitionDiff(
        addedFields = addedFields,
        removedFields = removedFields,
        changedFields = changedFields
    )
}

private fun SurveyDefinition.toCanonicalJson(): String {
    val sortedFields = fields.sortedBy { it.fieldId }
    return buildString {
        append("{\"surveyType\":")
        append(jsonString(surveyType.name))
        append(",\"fields\":[")
        sortedFields.forEachIndexed { index, field ->
            if (index > 0) append(",")
            append("{\"fieldId\":")
            append(jsonString(field.fieldId))
            append(",\"fieldType\":")
            append(jsonString(field.fieldType.name))
            append(",\"ratingVariant\":")
            appendJsonStringOrNull(field.ratingVariant?.name)
            append(",\"ratingScale\":")
            append(field.ratingScale ?: "null")
            append(",\"optionIds\":")
            if (field.optionIds == null) {
                append("null")
            } else {
                append("[")
                field.optionIds.forEachIndexed { optionIndex, optionId ->
                    if (optionIndex > 0) append(",")
                    append(jsonString(optionId))
                }
                append("]")
            }
            if (field.maxSelections != null) {
                append(",\"maxSelections\":")
                append(field.maxSelections)
            }
            append("}")
        }
        append("]}")
    }
}

private fun StringBuilder.appendJsonStringOrNull(value: String?) {
    if (value == null) append("null") else append(jsonString(value))
}

private fun jsonString(value: String): String {
    return buildString {
        append('"')
        value.forEach { char ->
            when (char) {
                '\\' -> append("\\\\")
                '"' -> append("\\\"")
                '\b' -> append("\\b")
                '\u000C' -> append("\\f")
                '\n' -> append("\\n")
                '\r' -> append("\\r")
                '\t' -> append("\\t")
                else -> {
                    if (char.code < 0x20) {
                        append("\\u%04x".format(char.code))
                    } else {
                        append(char)
                    }
                }
            }
        }
        append('"')
    }
}
