package no.nav.lumi.domain

import kotlinx.serialization.Serializable
import java.security.MessageDigest

@Serializable
data class FieldDefinition(
    val fieldId: String,
    val fieldType: FieldType,
    val ratingVariant: RatingVariant?,
    val ratingScale: Int?,
    val optionIds: List<String>?
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
                    optionIds = if (isChoiceType) answer.question.options?.map { it.id } else null
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

data class FieldChange(
    val fieldId: String,
    val change: String
)

data class DefinitionDiff(
    val addedFields: List<String>,
    val removedFields: List<String>,
    val changedFields: List<FieldChange>
) {
    fun describe(): String {
        val parts = buildList {
            if (addedFields.isNotEmpty()) add("addedFields=$addedFields")
            if (removedFields.isNotEmpty()) add("removedFields=$removedFields")
            if (changedFields.isNotEmpty()) {
                add(
                    "changedFields=${changedFields.map { "${it.fieldId}: ${it.change}" }}"
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
 * PARTIAL SUBMISSIONS: Only submitted answers are validated against the stored
 * definition. Not all defined fields need to be present in every submission.
 * However, the hash is computed from ALL submitted fields, so a submission with
 * fewer fields will produce a different hash and correctly trigger a 409 if
 * a definition with more fields is already stored.
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

        // Detect field reordering
        val commonIds = storedFieldsById.keys.intersect(incomingFieldsById.keys)
        val storedOrder = stored.fields.map { it.fieldId }.filter { it in commonIds }
        val incomingOrder = incoming.fields.map { it.fieldId }.filter { it in commonIds }
        if (storedOrder != incomingOrder) {
            add(FieldChange("_fieldOrder", "field order changed"))
        }

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
