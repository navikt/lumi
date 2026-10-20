package no.nav.lumi.domain

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.longOrNull
import no.nav.lumi.sensitive.SensitiveDataFilter
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/** One stored response, as read from `feedback` for the export. */
data class BigQueryExportSourceRow(
    val feedbackId: String,
    val receivedAt: Instant,
    val app: String,
    /** `feedback_json->>'surveyId'`, falling back to the `survey_id` column. */
    val surveyId: String?,
    val definitionHash: String?,
    val surveyArchived: Boolean,
    val feedbackJson: String,
)

/** How often a context tag key occurs in the export window, and with how many different values. */
data class ContextTagStats(val distinctValues: Long, val occurrences: Long) {
    /**
     * Tags are meant for segments with few values. A key with many values, or with fewer than five
     * responses per value on average, works as an identifier and is left out of the export. A new
     * key is left out until it has enough responses.
     */
    val isSegment: Boolean
        get() = distinctValues <= MAX_DISTINCT_VALUES && distinctValues * MIN_RESPONSES_PER_VALUE <= occurrences

    companion object {
        const val MAX_DISTINCT_VALUES = 50L
        const val MIN_RESPONSES_PER_VALUE = 5L
    }
}

data class BigQueryExportMappedSubmission(
    val innsending: InnsendingExportRow,
    val svar: List<SvarExportRow>,
    val fritekst: List<FritekstExportRow>,
)

/**
 * Turns stored responses into export rows.
 *
 * The parser reads the stored JSON defensively: a malformed answer is skipped, never guessed, and
 * never stops the export. Ratings follow the same rules as ingest. Text answers are redacted again
 * with today's patterns, as the dashboard does on read.
 *
 * Rows must be mapped newest first. The first label seen for a question or an option is then the
 * newest one, and every older row gets the same label. The dashboard also shows the newest label.
 *
 * IDs come from the widget payload like the labels, so they are masked with the same patterns. A
 * selected option is only exported when the question lists it. The receive time is cut to whole
 * minutes, which is enough for analysis and harder to match against other logs.
 *
 * Not thread-safe. Use one instance per export run.
 */
class BigQueryExportMapper(
    pseudonymKey: ByteArray,
    private val includeFreeText: Boolean,
    exportedAt: Instant,
    /** Context tag keys that may be exported. Null exports every key. */
    private val allowedTagKeys: Set<String>? = null,
    private val sensitiveDataFilter: SensitiveDataFilter = SensitiveDataFilter.DEFAULT,
) {
    private val mac: Mac = Mac.getInstance(HMAC_ALGORITHM).apply {
        init(SecretKeySpec(pseudonymKey.copyOf(), HMAC_ALGORITHM))
    }
    private val exportedAtText = formatBigQueryTimestamp(exportedAt)
    private val questionLabels = HashMap<FieldKey, String>()
    private val optionLabels = HashMap<OptionKey, String>()
    private var previousReceivedAt: Instant? = null

    var skippedSubmissions: Long = 0
        private set
    var skippedAnswers: Long = 0
        private set

    fun map(row: BigQueryExportSourceRow): BigQueryExportMappedSubmission? {
        previousReceivedAt?.let { previous ->
            check(!row.receivedAt.isAfter(previous)) { "Export rows must be mapped newest first" }
        }
        previousReceivedAt = row.receivedAt

        val surveyId = row.surveyId?.let(::cleanId)
        val root = parseObject(row.feedbackJson)
        if (surveyId == null || root == null) {
            skippedSubmissions += 1
            return null
        }

        val context = root["context"] as? JsonObject
        val submission = SubmissionFacts(
            innsendingId = pseudonym(row.feedbackId),
            receivedAt = formatBigQueryTimestamp(row.receivedAt.truncatedTo(ChronoUnit.MINUTES)),
            receivedDate = row.receivedAt.atZone(OSLO).toLocalDate().toString(),
            app = row.app,
            surveyId = surveyId,
            surveyType = root.string("surveyType")?.let(::normalizeSurveyType),
            archived = row.surveyArchived,
            deviceType = context?.string("deviceType")?.lowercase()?.takeIf { it in DEVICE_TYPES },
            kontekst = (context?.get("tags") as? JsonObject)?.let { kontekstJson(it, allowedTagKeys) },
            definitionHash = row.definitionHash?.takeIf { it.isNotBlank() },
        )

        val svar = mutableListOf<SvarExportRow>()
        val fritekst = mutableListOf<FritekstExportRow>()
        val seenFields = HashSet<String>()
        var answered = 0
        var hasText = false
        var textRedacted = root.boolean("sensitiveDataRedacted") == true
        val textAnswers = mutableListOf<Pair<FieldKey, String>>()

        for (element in root["answers"] as? JsonArray ?: JsonArray(emptyList())) {
            val answer = element as? JsonObject
            val fieldId = answer?.string("fieldId")?.let(::cleanId)
            if (answer == null || fieldId == null || !seenFields.add(fieldId)) {
                skippedAnswers += 1
                continue
            }
            val key = FieldKey(row.app, surveyId, fieldId)
            val question = answer["question"] as? JsonObject
            observeLabels(key, question)

            val value = answer["value"] as? JsonObject
            val parsed = value?.let { parseAnswer(answer.string("fieldType"), it) }
                ?.let { restrictToListedOptions(it, question) }
            if (parsed == null) {
                skippedAnswers += 1
                continue
            }
            answered += 1
            when (parsed) {
                is ParsedAnswer.Rating -> svar += submission.svar(key, questionLabel(key), "RATING").copy(
                    ratingVerdi = parsed.value,
                    ratingVariant = parsed.variant,
                    ratingSkala = parsed.scale,
                )
                is ParsedAnswer.Choice -> parsed.optionIds.forEach { optionId ->
                    val exportedId = cleanId(optionId) ?: return@forEach
                    svar += submission.svar(key, questionLabel(key), parsed.fieldType).copy(
                        valgId = exportedId,
                        valgTekst = optionLabels[OptionKey(key, optionId)] ?: exportedId,
                    )
                }
                is ParsedAnswer.Text -> {
                    hasText = true
                    if (includeFreeText) {
                        val redaction = sensitiveDataFilter.redact(parsed.text)
                        if (redaction.wasRedacted) textRedacted = true
                        textAnswers += key to redaction.redactedText
                    }
                }
                ParsedAnswer.Date -> Unit
            }
        }

        return BigQueryExportMappedSubmission(
            innsending = InnsendingExportRow(
                innsendingId = submission.innsendingId,
                innsendtTidspunkt = submission.receivedAt,
                innsendtDato = submission.receivedDate,
                app = submission.app,
                surveyId = submission.surveyId,
                surveyType = submission.surveyType,
                surveyArkivert = submission.archived,
                antallSvar = answered,
                harFritekst = hasText,
                varighetSekunder = root.long("timeToCompleteMs")?.takeIf { it > 0 }?.let { it / 1000 },
                enhetstype = submission.deviceType,
                kontekst = submission.kontekst,
                skjemaversjon = submission.definitionHash,
                oppdatertTidspunkt = exportedAtText,
            ),
            svar = svar,
            fritekst = textAnswers.map { (key, text) ->
                FritekstExportRow(
                    innsendingId = submission.innsendingId,
                    innsendtTidspunkt = submission.receivedAt,
                    innsendtDato = submission.receivedDate,
                    app = submission.app,
                    surveyId = submission.surveyId,
                    surveyType = submission.surveyType,
                    surveyArkivert = submission.archived,
                    sporsmalId = key.fieldId,
                    sporsmalTekst = questionLabel(key),
                    tekst = text,
                    maskert = textRedacted,
                    enhetstype = submission.deviceType,
                    kontekst = submission.kontekst,
                    skjemaversjon = submission.definitionHash,
                    oppdatertTidspunkt = exportedAtText,
                )
            },
        )
    }

    private fun SubmissionFacts.svar(key: FieldKey, label: String, fieldType: String) = SvarExportRow(
        innsendingId = innsendingId,
        innsendtTidspunkt = receivedAt,
        innsendtDato = receivedDate,
        app = app,
        surveyId = surveyId,
        surveyType = surveyType,
        surveyArkivert = archived,
        sporsmalId = key.fieldId,
        sporsmalTekst = label,
        sporsmalType = fieldType,
        enhetstype = deviceType,
        kontekst = kontekst,
        skjemaversjon = definitionHash,
        oppdatertTidspunkt = exportedAtText,
    )

    private fun observeLabels(key: FieldKey, question: JsonObject?) {
        if (question == null) return
        if (key !in questionLabels) {
            question.string("label")?.let(::cleanLabel)?.let { questionLabels[key] = it }
        }
        for (option in question["options"] as? JsonArray ?: return) {
            val optionObject = option as? JsonObject ?: continue
            val optionId = optionObject.string("id")?.takeIf { it.isNotBlank() } ?: continue
            val optionKey = OptionKey(key, optionId)
            if (optionKey !in optionLabels) {
                optionObject.string("label")?.let(::cleanLabel)?.let { optionLabels[optionKey] = it }
            }
        }
    }

    private fun questionLabel(key: FieldKey): String = questionLabels[key] ?: key.fieldId

    /** Keeps only selected options the question lists. Questions without a list are kept as sent. */
    private fun restrictToListedOptions(answer: ParsedAnswer, question: JsonObject?): ParsedAnswer? {
        if (answer !is ParsedAnswer.Choice) return answer
        val listed = (question?.get("options") as? JsonArray)
            ?.mapNotNull { (it as? JsonObject)?.string("id") }
            ?.toSet()
            ?: return answer
        return answer.optionIds.filter { it in listed }
            .takeIf { it.isNotEmpty() }
            ?.let { answer.copy(optionIds = it) }
    }

    /** IDs are free strings from the payload. Control characters go, and personal data is masked. */
    private fun cleanId(raw: String): String? {
        val cleaned = raw.filterNot { it.isISOControl() }.trim()
        if (cleaned.isEmpty()) return null
        return sensitiveDataFilter.redact(cleaned).redactedText.take(MAX_ID_LENGTH)
    }

    private fun cleanLabel(raw: String): String? {
        val withoutControlCharacters = raw.filterNot { it.isISOControl() && it != '\n' }.trim()
        if (withoutControlCharacters.isEmpty()) return null
        return sensitiveDataFilter.redact(withoutControlCharacters).redactedText.take(MAX_LABEL_LENGTH)
    }

    private fun pseudonym(feedbackId: String): String {
        val digest = mac.doFinal(feedbackId.toByteArray(Charsets.UTF_8))
        return digest.copyOf(PSEUDONYM_BYTES).joinToString("") { "%02x".format(it) }
    }

    private data class SubmissionFacts(
        val innsendingId: String,
        val receivedAt: String,
        val receivedDate: String,
        val app: String,
        val surveyId: String,
        val surveyType: String?,
        val archived: Boolean,
        val deviceType: String?,
        val kontekst: String?,
        val definitionHash: String?,
    )

    private data class FieldKey(val app: String, val surveyId: String, val fieldId: String)

    private data class OptionKey(val field: FieldKey, val optionId: String)

    private sealed interface ParsedAnswer {
        data class Rating(val value: Int, val variant: String?, val scale: Int?) : ParsedAnswer
        data class Choice(val fieldType: String, val optionIds: List<String>) : ParsedAnswer
        data class Text(val text: String) : ParsedAnswer
        data object Date : ParsedAnswer
    }

    private fun parseAnswer(fieldType: String?, value: JsonObject): ParsedAnswer? =
        when (value.string("type")) {
            "rating" -> if (fieldType == "RATING") parseRating(value) else null
            "singleChoice" -> if (fieldType == "SINGLE_CHOICE") {
                value.string("selectedOptionId")?.takeIf { it.isNotBlank() }
                    ?.let { ParsedAnswer.Choice("SINGLE_CHOICE", listOf(it)) }
            } else {
                null
            }
            "multiChoice" -> if (fieldType == "MULTI_CHOICE") {
                (value["selectedOptionIds"] as? JsonArray)
                    ?.mapNotNull { (it as? JsonPrimitive)?.takeIf { primitive -> primitive.isString }?.content }
                    ?.filter { it.isNotBlank() }
                    ?.distinct()
                    ?.takeIf { it.isNotEmpty() }
                    ?.let { ParsedAnswer.Choice("MULTI_CHOICE", it) }
            } else {
                null
            }
            "text" -> if (fieldType == "TEXT") {
                value.string("text")?.takeIf { it.isNotBlank() }?.let { ParsedAnswer.Text(it) }
            } else {
                null
            }
            "date" -> if (fieldType == "DATE" && value.string("date")?.isNotBlank() == true) ParsedAnswer.Date else null
            else -> null
        }

    private fun parseRating(value: JsonObject): ParsedAnswer.Rating? {
        val rating = (value["rating"] as? JsonPrimitive)?.takeUnless { it.isString }?.intOrNull ?: return null
        val rawVariant = value.string("ratingVariant") ?: return ParsedAnswer.Rating(rating, null, null)
        val variant = RATING_RANGES[rawVariant.lowercase()] ?: return null
        val scale = (value["ratingScale"] as? JsonPrimitive)?.intOrNull
        if (scale != null && scale != variant.scale) return null
        if (rating !in variant.range) return null
        return ParsedAnswer.Rating(rating, rawVariant.lowercase(), variant.scale)
    }

    private data class RatingRange(val scale: Int, val range: IntRange)

    companion object {
        const val PSEUDONYM_BYTES = 16
        private const val HMAC_ALGORITHM = "HmacSHA256"
        private const val MAX_LABEL_LENGTH = 1000
        private const val MAX_ID_LENGTH = 200
        private const val MAX_CONTEXT_TAGS = 20
        private val OSLO: ZoneId = ZoneId.of("Europe/Oslo")
        private val DEVICE_TYPES = setOf("mobile", "tablet", "desktop")
        private val SURVEY_TYPES = setOf("rating", "topTasks", "discovery", "taskPriority", "custom")
        private val RATING_RANGES = mapOf(
            "emoji" to RatingRange(scale = 5, range = 1..5),
            "stars" to RatingRange(scale = 5, range = 1..5),
            "thumbs" to RatingRange(scale = 2, range = 1..2),
            "nps" to RatingRange(scale = 11, range = 0..10),
        )
        private val TIMESTAMP_FORMAT: DateTimeFormatter =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSSSSS").withZone(ZoneOffset.UTC)
        private val parser = Json { ignoreUnknownKeys = true }
        private val compactJson = Json { prettyPrint = false }

        /** BigQuery accepts `YYYY-MM-DD HH:MM:SS.ffffff+00:00` in JSON loads. */
        fun formatBigQueryTimestamp(instant: Instant): String = TIMESTAMP_FORMAT.format(instant) + "+00:00"

        private fun normalizeSurveyType(raw: String): String = raw.takeIf { it in SURVEY_TYPES } ?: "custom"

        private fun parseObject(text: String): JsonObject? =
            runCatching { parser.parseToJsonElement(text) as? JsonObject }.getOrNull()

        private fun kontekstJson(tags: JsonObject, allowedKeys: Set<String>?): String? {
            val primitives = tags.entries
                .asSequence()
                .filter { (key, value) -> key.isNotBlank() && value is JsonPrimitive && value !is JsonNull }
                .filter { (key, _) -> allowedKeys == null || key in allowedKeys }
                .sortedBy { it.key }
                .take(MAX_CONTEXT_TAGS)
                .associate { (key, value) -> key to value }
            return primitives.takeIf { it.isNotEmpty() }?.let { compactJson.encodeToString(JsonObject.serializer(), JsonObject(it)) }
        }

        private fun JsonObject.string(key: String): String? =
            (this[key] as? JsonPrimitive)?.takeIf { it.isString }?.contentOrNull

        private fun JsonObject.long(key: String): Long? =
            (this[key] as? JsonPrimitive)?.takeUnless { it.isString }?.longOrNull

        private fun JsonObject.boolean(key: String): Boolean? =
            (this[key] as? JsonPrimitive)?.takeUnless { it.isString }?.booleanOrNull
    }
}
