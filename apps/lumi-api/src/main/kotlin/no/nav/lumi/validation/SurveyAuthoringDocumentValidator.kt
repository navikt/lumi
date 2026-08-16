package no.nav.lumi.validation

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.domain.FieldDefinition
import no.nav.lumi.domain.FieldType
import no.nav.lumi.domain.RatingVariant
import no.nav.lumi.domain.SurveyDefinition
import no.nav.lumi.domain.SurveyType
import java.security.MessageDigest

data class ValidatedSurveyAuthoringDocument(
    val documentHash: String,
    val definition: SurveyDefinition,
)

object SurveyAuthoringDocumentValidator {
    private val surveyTypes = mapOf(
        "rating" to SurveyType.RATING,
        "topTasks" to SurveyType.TOP_TASKS,
        "discovery" to SurveyType.DISCOVERY,
        "taskPriority" to SurveyType.TASK_PRIORITY,
        "custom" to SurveyType.CUSTOM,
    )
    private val ratingVariants = mapOf(
        "emoji" to RatingVariant.EMOJI,
        "thumbs" to RatingVariant.THUMBS,
        "stars" to RatingVariant.STARS,
        "nps" to RatingVariant.NPS,
    )
    private val conditionOperators = setOf("EQ", "NEQ", "GT", "LT", "CONTAINS", "EXISTS")

    /**
     * Validates the authoring document structure. With [releaseGate] the
     * semantic bar for immutable revisions applies too: prompts, option
     * labels and option values must be non-blank. Drafts stay lenient.
     */
    fun validate(
        document: JsonObject,
        surveyId: String,
        releaseGate: Boolean = false,
    ): ValidatedSurveyAuthoringDocument {
        requireInt(document, "authoringSchemaVersion", "Document")
            .takeIf { it == 1 }
            ?: invalid("Only authoringSchemaVersion 1 is supported")
        if (document.containsKey("questions")) {
            invalid("Version 1 survey documents use pages, not legacy questions")
        }

        val surveyTypeName = optionalString(document, "type", "Document") ?: "custom"
        val surveyType = surveyTypes[surveyTypeName]
            ?: invalid("Unsupported survey type '$surveyTypeName'")
        val pages = document["pages"] as? JsonArray
            ?: invalid("Survey document must contain pages")
        if (pages.isEmpty()) invalid("Survey document must have at least one page")

        val pageIds = mutableSetOf<String>()
        val questionIds = mutableSetOf<String>()
        val previousQuestionIds = mutableSetOf<String>()
        val fields = mutableListOf<FieldDefinition>()

        pages.forEachIndexed { pageIndex, pageElement ->
            val page = pageElement as? JsonObject
                ?: invalid("Page at index $pageIndex is not an object")
            val pageId = requireNonBlankString(page, "id", "Page at index $pageIndex")
            if (!pageIds.add(pageId)) invalid("Duplicate page id '$pageId'")
            optionalString(page, "title", "Page '$pageId'")
            optionalString(page, "description", "Page '$pageId'")
            val questions = page["questions"] as? JsonArray
                ?: invalid("Page '$pageId' must contain questions")
            if (questions.isEmpty()) invalid("Page '$pageId' must have at least one question")

            questions.forEachIndexed { questionIndex, questionElement ->
                val question = questionElement as? JsonObject
                    ?: invalid("Question at index $questionIndex on page '$pageId' is not an object")
                val questionId = requireNonBlankString(question, "id", "Question on page '$pageId'")
                if (!questionIds.add(questionId)) invalid("Duplicate question id '$questionId'")
                val prompt = requireString(question, "prompt", "Question '$questionId'")
                if (releaseGate && prompt.isBlank()) {
                    invalid("Question '$questionId' needs a prompt before it can be shared")
                }
                optionalString(question, "description", "Question '$questionId'")
                optionalString(question, "analyticsId", "Question '$questionId'")
                optionalBoolean(question, "required", "Question '$questionId'")
                if (question.containsKey("logic")) {
                    invalid("Question '$questionId' uses legacy logic")
                }
                question["visibleIf"]?.let {
                    validateVisibleIf(it, questionId, previousQuestionIds)
                }

                val type = requireString(question, "type", "Question '$questionId'")
                fields += when (type) {
                    "rating" -> validateRating(question, questionId)
                    "text" -> validateText(question, questionId)
                    "singleChoice" ->
                        validateChoice(question, questionId, FieldType.SINGLE_CHOICE, releaseGate)
                    "multiChoice" ->
                        validateChoice(question, questionId, FieldType.MULTI_CHOICE, releaseGate)
                    else -> invalid("Question '$questionId' has unsupported type '$type'")
                }
                previousQuestionIds += questionId
            }
        }

        val definition = SurveyDefinition(surveyId = surveyId, surveyType = surveyType, fields = fields)
        SurveyDefinitionValidator.validateDefinition(definition)
        return ValidatedSurveyAuthoringDocument(
            documentHash = sha256(canonicalJson(document)),
            definition = definition,
        )
    }

    private fun validateRating(question: JsonObject, questionId: String): FieldDefinition {
        val variantName = optionalString(question, "variant", "Rating question '$questionId'") ?: "emoji"
        val variant = ratingVariants[variantName]
            ?: invalid("Rating question '$questionId' has unsupported variant '$variantName'")
        for (labelKey in listOf("lowLabel", "highLabel")) {
            optionalString(question, labelKey, "Rating question '$questionId'")
        }
        question["labels"]?.let { labelsElement ->
            val labels = labelsElement as? JsonArray
                ?: invalid("Rating question '$questionId' has invalid labels")
            labels.forEach { labelElement ->
                val label = labelElement as? JsonObject
                    ?: invalid("Rating question '$questionId' has invalid labels")
                requireFiniteNumber(label, "value", "Rating question '$questionId' label")
                requireString(label, "label", "Rating question '$questionId' label")
            }
        }
        return FieldDefinition(
            fieldId = questionId,
            fieldType = FieldType.RATING,
            ratingVariant = variant,
            ratingScale = RatingVariant.getScale(variant),
            optionIds = null,
        )
    }

    private fun validateText(question: JsonObject, questionId: String): FieldDefinition {
        for (key in listOf("maxLength", "minRows")) {
            question[key]?.let { value ->
                val number = (value as? JsonPrimitive)?.doubleOrNull
                if (number == null || !number.isFinite() || number <= 0) {
                    invalid("Text question '$questionId' has invalid $key")
                }
            }
        }
        for (key in listOf("placeholder", "autoComplete")) {
            optionalString(question, key, "Text question '$questionId'")
        }
        return FieldDefinition(questionId, FieldType.TEXT, null, null, null)
    }

    private fun validateChoice(
        question: JsonObject,
        questionId: String,
        fieldType: FieldType,
        releaseGate: Boolean = false,
    ): FieldDefinition {
        val options = question["options"] as? JsonArray
            ?: invalid("Choice question '$questionId' must have options")
        if (options.isEmpty()) invalid("Choice question '$questionId' must have at least one option")
        val optionIds = options.mapIndexed { index, optionElement ->
            val option = optionElement as? JsonObject
                ?: invalid("Option $index on question '$questionId' is not an object")
            val value = requireString(option, "value", "Option $index on question '$questionId'")
            val label = requireString(option, "label", "Option '$value' on question '$questionId'")
            if (releaseGate) {
                if (label.isBlank()) {
                    invalid("Option $index on question '$questionId' needs a label before it can be shared")
                }
                if (value.isBlank()) {
                    invalid("Option $index on question '$questionId' needs a value before it can be shared")
                }
            }
            optionalString(option, "description", "Option '$value' on question '$questionId'")
            value
        }
        if (optionIds.distinct().size != optionIds.size) {
            invalid("Choice question '$questionId' has duplicate option values")
        }
        optionalBoolean(question, "randomize", "Choice question '$questionId'")
        question["variant"]?.let {
            val variant = requireString(question, "variant", "Choice question '$questionId'")
            if (variant !in setOf("checkbox", "combobox")) {
                invalid("Choice question '$questionId' has unsupported variant '$variant'")
            }
        }
        question["maxSelections"]?.let {
            val maxSelections = (it as? JsonPrimitive)?.intOrNull
            if (maxSelections == null || maxSelections <= 0) {
                invalid("Choice question '$questionId' has invalid maxSelections")
            }
        }
        return FieldDefinition(questionId, fieldType, null, null, optionIds)
    }

    private fun validateVisibleIf(
        element: JsonElement,
        questionId: String,
        previousQuestionIds: Set<String>,
    ) {
        val condition = element as? JsonObject
            ?: invalid("Question '$questionId' has an invalid visibleIf")
        val groupKeys = listOf("any", "all").filter(condition::containsKey)
        if (groupKeys.size > 1) invalid("Question '$questionId' visibleIf must use exactly one group")
        if (groupKeys.isEmpty()) {
            validateConditionLeaf(condition, questionId, previousQuestionIds)
            return
        }
        val conditions = condition[groupKeys.single()] as? JsonArray
            ?: invalid("Question '$questionId' visibleIf group must be a list")
        if (conditions.isEmpty()) invalid("Question '$questionId' visibleIf group cannot be empty")
        conditions.forEach { leafElement ->
            val leaf = leafElement as? JsonObject
                ?: invalid("Question '$questionId' has an invalid visibleIf condition")
            if (leaf.containsKey("any") || leaf.containsKey("all")) {
                invalid("Question '$questionId' has a nested visibleIf group")
            }
            validateConditionLeaf(leaf, questionId, previousQuestionIds)
        }
    }

    private fun validateConditionLeaf(
        leaf: JsonObject,
        questionId: String,
        previousQuestionIds: Set<String>,
    ) {
        val field = optionalString(leaf, "field", "Question '$questionId' visibleIf") ?: "ANSWER"
        if (field !in setOf("ANSWER", "METADATA")) {
            invalid("Question '$questionId' has unsupported visibleIf field '$field'")
        }
        val operator = requireString(leaf, "operator", "Question '$questionId' visibleIf")
        if (operator !in conditionOperators) {
            invalid("Question '$questionId' has unsupported visibleIf operator '$operator'")
        }
        if (operator == "EXISTS") {
            if (leaf.containsKey("value")) invalid("Question '$questionId' EXISTS visibleIf must not have a value")
        } else {
            val value = leaf["value"] ?: invalid("Question '$questionId' $operator visibleIf needs a value")
            if (value !is JsonPrimitive || value is JsonNull || (!value.isString && value.booleanOrNull == null && value.doubleOrNull == null)) {
                invalid("Question '$questionId' $operator visibleIf has an invalid value")
            }
        }
        if (field == "METADATA") {
            requireNonBlankString(leaf, "key", "Question '$questionId' METADATA visibleIf")
        } else {
            val referencedId = requireNonBlankString(leaf, "questionId", "Question '$questionId' ANSWER visibleIf")
            if (referencedId !in previousQuestionIds) {
                invalid("Question '$questionId' visibleIf may only reference an earlier question")
            }
        }
    }

    private fun requireString(value: JsonObject, key: String, context: String): String {
        return optionalString(value, key, context) ?: invalid("$context needs a string $key")
    }

    private fun requireNonBlankString(value: JsonObject, key: String, context: String): String {
        val result = requireString(value, key, context)
        if (result.isBlank()) invalid("$context needs a non-blank $key")
        return result
    }

    private fun optionalString(value: JsonObject, key: String, context: String): String? {
        val element = value[key] ?: return null
        val primitive = element as? JsonPrimitive
            ?: invalid("$context has a non-string $key")
        return primitive.contentOrNull?.takeIf { primitive.isString }
            ?: invalid("$context has a non-string $key")
    }

    private fun optionalBoolean(value: JsonObject, key: String, context: String): Boolean? {
        val element = value[key] ?: return null
        return (element as? JsonPrimitive)?.booleanOrNull
            ?: invalid("$context has a non-boolean $key")
    }

    private fun requireInt(value: JsonObject, key: String, context: String): Int {
        return (value[key] as? JsonPrimitive)?.intOrNull
            ?: invalid("$context needs an integer $key")
    }

    private fun requireFiniteNumber(value: JsonObject, key: String, context: String): Double {
        val number = (value[key] as? JsonPrimitive)?.doubleOrNull
            ?: invalid("$context needs a number $key")
        if (!number.isFinite()) invalid("$context has an invalid $key")
        return number
    }

    private fun canonicalJson(element: JsonElement): String = when (element) {
        is JsonObject -> element.entries.sortedBy { it.key }.joinToString(
            prefix = "{",
            postfix = "}",
            separator = ",",
        ) { (key, value) -> "${JsonPrimitive(key)}:${canonicalJson(value)}" }
        is JsonArray -> element.joinToString(prefix = "[", postfix = "]", separator = ",", transform = ::canonicalJson)
        else -> element.toString()
    }

    private fun sha256(value: String): String = MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) }

    private fun invalid(message: String): Nothing = throw ApiErrorException.BadRequestException(message)
}
