package no.nav.lumi.repository

import no.nav.lumi.domain.*
import no.nav.lumi.service.TextProcessor
import no.nav.lumi.service.text.StemWordAccumulator
import java.time.Instant
import java.time.OffsetDateTime

internal data class AnalyticsSnapshot(
    val ratingByDateRows: List<AvgCountRow>,
    val deviceRows: List<AvgCountRow>,
    val pathnameRows: List<AvgCountRow>,
    val fieldRecords: List<FeedbackDbRecord>
)

internal data class AvgCountRow(val key: String, val count: Int, val average: Double)

internal data class SurveyTypeRow(
    val surveyId: String,
    val surveyType: String?
)

internal fun buildFieldStats(records: List<FeedbackDto>): List<FieldStat> {
    if (records.isEmpty()) return emptyList()

    val totalFeedbackCount = records.size
    val answersByField = mutableMapOf<String, MutableList<Pair<FeedbackDto, Answer>>>()
    val recordPriority = compareBy<FeedbackDto> { it.answers.size }
        .thenBy { parseSubmittedAt(it.submittedAt) }
        .thenBy { it.id }

    // Preserve the survey question order as seen in submissions.
    // We use the most complete submission as the primary ordering source and break ties
    // explicitly on submittedAt and id. We then apply the same priority order in the
    // fallback pass so missing/optional fields do not depend on caller-provided record order.
    val fieldOrder = mutableMapOf<String, Int>()
    var nextOrderIndex = 0

    val representativeAnswers = records
        .maxWithOrNull(recordPriority)
        ?.answers
        .orEmpty()
    for (answer in representativeAnswers) {
        if (answer.fieldId !in fieldOrder) {
            fieldOrder[answer.fieldId] = nextOrderIndex++
        }
    }

    for (dto in records.sortedWith(recordPriority.reversed())) {
        for (answer in dto.answers) {
            answersByField.getOrPut(answer.fieldId) { mutableListOf() }.add(dto to answer)

            if (answer.fieldId !in fieldOrder) {
                fieldOrder[answer.fieldId] = nextOrderIndex++
            }
        }
    }

    val result = mutableListOf<FieldStat>()

    for ((fieldId, entries) in answersByField) {
        val first = entries.firstOrNull()?.second ?: continue
        val fieldType = first.fieldType
        val label = first.question.label.ifBlank { fieldId }

        when (fieldType) {
            FieldType.RATING -> {
                val distribution = mutableMapOf<String, Int>()
                var sum = 0
                var count = 0

                for ((_, answer) in entries) {
                    val rating = (answer.value as? AnswerValue.Rating)?.rating ?: continue
                    distribution[rating.toString()] = (distribution[rating.toString()] ?: 0) + 1
                    sum += rating
                    count += 1
                }

                if (count == 0) continue
                val average = sum.toDouble() / count

                result.add(
                    FieldStat(
                        fieldId = fieldId,
                        fieldType = fieldType,
                        label = label,
                        stats = FieldStats.Rating(average = average, distribution = distribution)
                    )
                )
            }

            FieldType.TEXT -> {
                val texts = mutableListOf<RecentTextResponse>()
                val wordAccumulators = mutableMapOf<String, StemWordAccumulator>()
                val bigramCounts = mutableMapOf<String, Int>()
                val bigramSurfaces = mutableMapOf<String, MutableMap<String, Int>>()
                var responseCount = 0

                for ((dto, answer) in entries) {
                    val text = (answer.value as? AnswerValue.Text)?.text?.trim().orEmpty()
                    if (text.isBlank()) continue

                    responseCount += 1
                    texts.add(RecentTextResponse(text = text, submittedAt = dto.submittedAt))

                    for (word in TextProcessor.extractWords(text)) {
                        val stem = TextProcessor.stemNorwegian(word)
                        val acc = wordAccumulators.getOrPut(stem) { StemWordAccumulator(stem) }
                        acc.addOccurrence(word)
                    }

                    val bigrams = TextProcessor.extractBigrams(text)

                    for (bigram in bigrams.map { it.stemKey }.toSet()) {
                        bigramCounts[bigram] = (bigramCounts[bigram] ?: 0) + 1
                    }

                    // Dedup surfaces per response to avoid bias from repeated phrases
                    for (bigram in bigrams.distinctBy { it.stemKey to it.surface }) {
                        val surfaces = bigramSurfaces.getOrPut(bigram.stemKey) { mutableMapOf() }
                        surfaces[bigram.surface] = (surfaces[bigram.surface] ?: 0) + 1
                    }
                }

                val responseRate = if (totalFeedbackCount > 0) {
                    responseCount.toDouble() / totalFeedbackCount
                } else {
                    0.0
                }

                val topKeywords = wordAccumulators.values
                    .sortedWith(compareByDescending<StemWordAccumulator> { it.totalCount }.thenBy { it.stem })
                    .take(10)
                    .map { acc -> KeywordCount(word = acc.getCanonicalForm(), count = acc.totalCount) }

                val topPhrases = bigramCounts.entries
                    .asSequence()
                    .filter { it.value >= 2 }
                    .sortedWith(compareByDescending<Map.Entry<String, Int>> { it.value }.thenBy { it.key })
                    .take(10)
                    .map { (stemKey, count) ->
                        val bestSurface = bigramSurfaces[stemKey]?.maxByOrNull { it.value }?.key ?: stemKey
                        TextPhrase(text = bestSurface, count = count)
                    }
                    .toList()

                val recentResponses = texts
                    .sortedByDescending { parseSubmittedAt(it.submittedAt) }
                    .take(5)

                result.add(
                    FieldStat(
                        fieldId = fieldId,
                        fieldType = fieldType,
                        label = label,
                        stats = FieldStats.Text(
                            responseCount = responseCount,
                            responseRate = responseRate,
                            topKeywords = topKeywords,
                            topPhrases = topPhrases,
                            recentResponses = recentResponses
                        )
                    )
                )
            }

            FieldType.SINGLE_CHOICE, FieldType.MULTI_CHOICE -> {
                val optionLabels = first.question.options.orEmpty().associate { it.id to it.label }
                val counts = mutableMapOf<String, Int>()
                var responseCount = 0

                for ((_, answer) in entries) {
                    when (val value = answer.value) {
                        is AnswerValue.SingleChoice -> {
                            responseCount += 1
                            counts[value.selectedOptionId] = (counts[value.selectedOptionId] ?: 0) + 1
                        }

                        is AnswerValue.MultiChoice -> {
                            if (value.selectedOptionIds.isNotEmpty()) {
                                responseCount += 1
                            }
                            for (id in value.selectedOptionIds.toSet()) {
                                counts[id] = (counts[id] ?: 0) + 1
                            }
                        }

                        else -> Unit
                    }
                }

                val totalSelections = counts.values.sum()
                if (responseCount == 0 || totalSelections == 0) continue
                val responseRate = if (totalFeedbackCount > 0) {
                    responseCount.toDouble() / totalFeedbackCount
                } else {
                    0.0
                }

                // Use survey options list as source of truth for order and completeness.
                // Options with 0 responses are included so the frontend shows the full picture.
                val surveyOptions = first.question.options.orEmpty()
                val distribution = linkedMapOf<String, ChoiceDistributionEntry>()

                for (opt in surveyOptions) {
                    val count = counts[opt.id] ?: 0
                    val percentage = if (responseCount > 0) {
                        kotlin.math.round((count.toDouble() / responseCount) * 100.0).toInt()
                    } else 0
                    distribution[opt.id] = ChoiceDistributionEntry(
                        label = opt.label,
                        count = count,
                        percentage = percentage
                    )
                }

                // Include any responses for option IDs not in the survey definition (legacy data)
                for ((optionId, count) in counts) {
                    if (optionId !in distribution) {
                        val percentage = kotlin.math.round((count.toDouble() / responseCount) * 100.0).toInt()
                        distribution[optionId] = ChoiceDistributionEntry(
                            label = optionLabels[optionId] ?: optionId,
                            count = count,
                            percentage = percentage
                        )
                    }
                }

                result.add(
                    FieldStat(
                        fieldId = fieldId,
                        fieldType = fieldType,
                        label = label,
                        stats = FieldStats.Choice(
                            responseCount = responseCount,
                            responseRate = responseRate,
                            totalSelections = totalSelections,
                            distribution = distribution
                        )
                    )
                )
            }

            else -> Unit
        }
    }

    return result.sortedWith(
        compareBy<FieldStat> { fieldOrder[it.fieldId] ?: Int.MAX_VALUE }
            .thenBy { it.fieldType.name }
            .thenBy { it.fieldId }
    )
}

internal fun parseSubmittedAt(value: String): Instant {
    return try {
        Instant.parse(value)
    } catch (_: Exception) {
        try {
            OffsetDateTime.parse(value).toInstant()
        } catch (_: Exception) {
            Instant.EPOCH
        }
    }
}
