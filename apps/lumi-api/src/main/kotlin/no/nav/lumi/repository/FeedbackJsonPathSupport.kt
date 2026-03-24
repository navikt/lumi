package no.nav.lumi.repository

import org.slf4j.Logger

internal const val MAX_CHOICE_VALUE_LENGTH = 200
internal const val MAX_FIELD_ID_LENGTH = 200

private val JSON_PATH_SPECIAL_CHARS = setOf('"', '\\', '$', '@', '?', '(', ')', ',')

internal data class ChoiceJsonPaths(
    val singleChoicePath: String,
    val multiChoicePath: String
)

internal fun validateJsonPathFieldId(
    fieldId: String?,
    fieldName: String,
    log: Logger
): String? {
    val normalizedFieldId = fieldId?.trim()?.takeIf { it.isNotBlank() } ?: return null
    if (normalizedFieldId.length > MAX_FIELD_ID_LENGTH) {
        log.warn("Rejected oversized JSONPath field id for {}: length {}", fieldName, normalizedFieldId.length)
        return null
    }
    val isSafeFieldId = normalizedFieldId.all { it.isLetterOrDigit() || it == '-' || it == '_' }
    if (!isSafeFieldId) {
        if (fieldName == "choiceFieldId") {
            log.warn("Rejected unsafe choiceFieldId")
        } else {
            log.warn("Rejected unsafe JSONPath field id for {}", fieldName)
        }
        return null
    }
    return normalizedFieldId
}

internal fun normalizeChoiceValue(choiceValue: String?): String? {
    return choiceValue
        ?.trim()
        ?.takeIf { it.isNotBlank() }
        ?.take(MAX_CHOICE_VALUE_LENGTH)
}

internal fun isSafeChoiceValue(choiceValue: String): Boolean {
    return choiceValue.none { it in JSON_PATH_SPECIAL_CHARS || it.code < 32 }
}

internal fun buildChoiceJsonPaths(
    choiceFieldId: String?,
    choiceValue: String?,
    log: Logger
): ChoiceJsonPaths? {
    val safeFieldId = validateJsonPathFieldId(choiceFieldId, "choiceFieldId", log) ?: return null
    val normalizedChoiceValue = normalizeChoiceValue(choiceValue) ?: return null
    if (!isSafeChoiceValue(normalizedChoiceValue)) {
        log.warn("Rejected unsafe JSONPath value for choiceValue")
        return null
    }

    val singleChoicePath =
        "$.answers[*] ? (@.fieldId == \"$safeFieldId\" && @.value.type == \"singleChoice\" && @.value.selectedOptionId == \"$normalizedChoiceValue\")"
    val multiChoicePath =
        "$.answers[*] ? (@.fieldId == \"$safeFieldId\" && @.value.type == \"multiChoice\" && exists(@.value.selectedOptionIds[*] ? (@ == \"$normalizedChoiceValue\")))"

    return ChoiceJsonPaths(singleChoicePath = singleChoicePath, multiChoicePath = multiChoicePath)
}
