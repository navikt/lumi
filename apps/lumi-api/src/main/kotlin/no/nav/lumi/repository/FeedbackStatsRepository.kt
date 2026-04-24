package no.nav.lumi.repository

import kotlinx.serialization.json.*
import no.nav.lumi.domain.*
import no.nav.lumi.service.TextProcessor
import no.nav.lumi.service.text.BigramAccumulator
import no.nav.lumi.service.text.QuoteSelector
import no.nav.lumi.service.text.StemWordAccumulator
import org.jetbrains.exposed.v1.core.*
import org.jetbrains.exposed.v1.jdbc.*
import org.slf4j.LoggerFactory
import java.time.Duration
import java.time.Instant

class FeedbackStatsRepository {
    private val json = Json { ignoreUnknownKeys = true }
    private val log = LoggerFactory.getLogger(FeedbackStatsRepository::class.java)

    companion object {
        /** Minimum number of responses required to show aggregated statistics */
        const val MIN_AGGREGATION_THRESHOLD = 5
        
        /** Maximum source responses per word for blocker analysis */
        const val MAX_SOURCE_RESPONSES_BLOCKER = 5

        private const val MAX_PHRASES_BLOCKER = 30
        private const val MIN_PHRASE_OCCURRENCES = 2
    }

    data class FeedbackAnalyticsStats(
        val ratingByDate: Map<String, RatingByDateEntry> = emptyMap(),
        val byDevice: Map<String, DeviceStats> = emptyMap(),
        val byPathname: Map<String, PathnameStats> = emptyMap(),
        val lowestRatingPaths: Map<String, PathnameStats> = emptyMap(),
        val fieldStats: List<FieldStat> = emptyList(),
    )

    suspend fun getStats(query: StatsQuery): FeedbackStatsResult {
        return dbQuery {
            val totalQuery = FeedbackTable.selectAll()
            applyStatsFilters(totalQuery, query)
            val totalCount = totalQuery.count()
            
            // Check if we should mask data for privacy
            val shouldMask = totalCount in 1 until MIN_AGGREGATION_THRESHOLD
            
            val textQuery = FeedbackTable.selectAll()
            applyStatsFilters(textQuery, query)
            textQuery.andWhere {
                JsonbPathExists(
                    FeedbackTable.feedbackJson,
                    "$.answers[*] ? (@.value.type == \"text\" && @.value.text != \"\")"
                )
            }
            val countWithText = textQuery.count()
            
            val typeQuery = FeedbackTable.selectAll()
            applyStatsFilters(typeQuery, query)
            typeQuery.orderBy(FeedbackTable.opprettet to SortOrder.DESC).limit(1)
            val surveyType = typeQuery.firstOrNull()?.let { 
                 val jsonStr = it[FeedbackTable.feedbackJson]
                 val jsonObj = json.parseToJsonElement(jsonStr).jsonObject
                 jsonObj["surveyType"]?.jsonPrimitive?.content ?: "custom"
            }

            val ratingExpr = JsonbPathQueryFirstText(
                FeedbackTable.feedbackJson,
                "$.answers[*] ? (@.value.type == \"rating\").value.rating"
            )
            val ratingQuery = FeedbackTable.select(ratingExpr, FeedbackTable.id.count())
            applyStatsFilters(ratingQuery, query)
            ratingQuery.andWhere { ratingExpr.isNotNull() }
            val byRating = ratingQuery
                .groupBy(ratingExpr)
                .associate { row ->
                    row[ratingExpr] to row[FeedbackTable.id.count()].toInt()
                }

            val appQuery = FeedbackTable.select(FeedbackTable.app, FeedbackTable.id.count())
            applyStatsFilters(appQuery, query)
            appQuery.andWhere { FeedbackTable.app.isNotNull() }
            val byApp = appQuery
                .groupBy(FeedbackTable.app)
                .orderBy(FeedbackTable.id.count() to SortOrder.DESC)
                .limit(20)
                .associate { row -> 
                    row[FeedbackTable.app] to row[FeedbackTable.id.count()].toInt()
                }
            
            val dateExpr = DateDate(FeedbackTable.opprettet)
            val dateQuery = FeedbackTable.select(dateExpr, FeedbackTable.id.count())
            applyStatsFilters(dateQuery, query)
            dateQuery.andWhere { FeedbackTable.opprettet greaterEq Instant.now().minus(Duration.ofDays(30)) }
            val byDate = dateQuery
                 .groupBy(dateExpr)
                 .orderBy(dateExpr to SortOrder.ASC)
                 .associate { row ->
                     row[dateExpr].toString() to row[FeedbackTable.id.count()].toInt()
                 }
                 
            val surveyIdExpr = JsonExtract(FeedbackTable.feedbackJson, listOf("surveyId"))
            val fidQuery = FeedbackTable.select(surveyIdExpr, FeedbackTable.id.count())
            applyStatsFilters(fidQuery, query)
            fidQuery.andWhere { surveyIdExpr.isNotNull() }
            val bySurveyId = fidQuery
                 .groupBy(surveyIdExpr)
                 .orderBy(FeedbackTable.id.count() to SortOrder.DESC)
                 .limit(20)
                 .associate { row ->
                     row[surveyIdExpr] to row[FeedbackTable.id.count()].toInt()
                 }

            FeedbackStatsResult(
                totalCount = totalCount,
                countWithText = countWithText,
                surveyType = surveyType,
                byRating = byRating,
                byApp = byApp,
                byDate = byDate,
                bySurveyId = bySurveyId,
                masked = shouldMask,
                threshold = MIN_AGGREGATION_THRESHOLD
            )
        }
    }

    suspend fun getAnalyticsStats(query: StatsQuery, includeFieldStats: Boolean): FeedbackAnalyticsStats {
        val snapshot = dbQuery {
            val ratingTextExpr = JsonbPathQueryFirstText(
                FeedbackTable.feedbackJson,
                "$.answers[*] ? (@.value.type == \"rating\").value.rating"
            )
            val ratingIntExpr = Cast(ratingTextExpr, IntegerColumnType())
            val ratingAvgExpr = ratingIntExpr.avg()
            val ratingCountExpr = FeedbackTable.id.count()

            val dateExpr = DateDate(FeedbackTable.opprettet)
            val dateQuery = FeedbackTable.select(dateExpr, ratingCountExpr, ratingAvgExpr)
            applyStatsFilters(dateQuery, query)
            dateQuery.andWhere { ratingTextExpr.isNotNull() }
            val ratingByDateRows = dateQuery
                .groupBy(dateExpr)
                .orderBy(dateExpr to SortOrder.ASC)
                .map { row ->
                    AvgCountRow(
                        key = row[dateExpr].toString(),
                        count = row[ratingCountExpr].toInt(),
                        average = row[ratingAvgExpr]?.toDouble() ?: 0.0
                    )
                }

            val deviceExpr = JsonExtract(FeedbackTable.feedbackJson, listOf("context", "deviceType"))
            val deviceQuery = FeedbackTable.select(deviceExpr, ratingCountExpr, ratingAvgExpr)
            applyStatsFilters(deviceQuery, query)
            deviceQuery.andWhere { ratingTextExpr.isNotNull() and deviceExpr.isNotNull() }
            val deviceRows = deviceQuery
                .groupBy(deviceExpr)
                .map { row ->
                    AvgCountRow(
                        key = row[deviceExpr],
                        count = row[ratingCountExpr].toInt(),
                        average = row[ratingAvgExpr]?.toDouble() ?: 0.0
                    )
                }

            val pathnameExpr = JsonExtract(FeedbackTable.feedbackJson, listOf("context", "pathname"))
            val pathnameQuery = FeedbackTable.select(pathnameExpr, ratingCountExpr, ratingAvgExpr)
            applyStatsFilters(pathnameQuery, query)
            pathnameQuery.andWhere { ratingTextExpr.isNotNull() and pathnameExpr.isNotNull() }
            val pathnameRows = pathnameQuery
                .groupBy(pathnameExpr)
                .map { row ->
                    AvgCountRow(
                        key = row[pathnameExpr],
                        count = row[ratingCountExpr].toInt(),
                        average = row[ratingAvgExpr]?.toDouble() ?: 0.0
                    )
                }

            val fieldRecords = if (includeFieldStats) {
                val fieldQuery = FeedbackTable.selectAll()
                applyStatsFilters(fieldQuery, query)
                fieldQuery.orderBy(
                    FeedbackTable.opprettet to SortOrder.DESC,
                    FeedbackTable.id to SortOrder.DESC
                )
                fieldQuery.map { it.toDbRecord() }
            } else {
                emptyList()
            }

            AnalyticsSnapshot(
                ratingByDateRows = ratingByDateRows,
                deviceRows = deviceRows,
                pathnameRows = pathnameRows,
                fieldRecords = fieldRecords
            )
        }

        val ratingByDate = snapshot.ratingByDateRows
            .filter { it.key.isNotBlank() }
            .associate { it.key to RatingByDateEntry(average = it.average, count = it.count) }

        val byDevice = snapshot.deviceRows
            .filter { it.key.isNotBlank() }
            .associate { row ->
                row.key.lowercase() to DeviceStats(count = row.count, averageRating = row.average)
            }

        val byPathname = snapshot.pathnameRows
            .filter { it.key.isNotBlank() }
            .associate { row ->
                row.key to PathnameStats(count = row.count, averageRating = row.average)
            }

        val lowestRatingPaths = byPathname.entries
            .filter { it.value.count >= MIN_AGGREGATION_THRESHOLD }
            .sortedWith(
                compareBy<Map.Entry<String, PathnameStats>> { it.value.averageRating }
                    .thenByDescending { it.value.count }
                    .thenBy { it.key }
            )
            .take(10)
            .associate { it.key to it.value }

        val fieldStats = if (includeFieldStats) {
            buildFieldStats(snapshot.fieldRecords.map { it.toDto() })
        } else {
            emptyList()
        }

        return FeedbackAnalyticsStats(
            ratingByDate = ratingByDate,
            byDevice = byDevice,
            byPathname = byPathname,
            lowestRatingPaths = lowestRatingPaths,
            fieldStats = fieldStats,
        )
    }

    suspend fun getTopTasksStats(query: StatsQuery): TopTasksResponse {
        val records = dbQuery {
            val dbQuery = FeedbackTable.selectAll()
            applyStatsFilters(dbQuery, query)
            dbQuery.andWhere { JsonExtract(FeedbackTable.feedbackJson, listOf("surveyType")) eq "topTasks" }
            dbQuery.map { it.toDbRecord() }
        }

        val dtos = records.map { it.toDto() }
        val filteredRecords = query.task?.let { taskFilter ->
            dtos.filter { feedback ->
                val taskAnswer = feedback.answers.find { a ->
                    a.fieldId in TopTasksFieldIds.task
                }
                if (taskAnswer != null && taskAnswer.fieldType == FieldType.SINGLE_CHOICE) {
                    val selectedId = (taskAnswer.value as? AnswerValue.SingleChoice)?.selectedOptionId
                    val option = taskAnswer.question.options?.find { it.id == selectedId }
                    option?.label == taskFilter
                } else {
                    false
                }
            }
        } ?: dtos

        return processTopTasks(filteredRecords)
    }

    suspend fun getSurveyTypeDistribution(query: StatsQuery): SurveyTypeDistribution {
        val distinctRows = dbQuery {
            val surveyIdExpr = JsonExtract(FeedbackTable.feedbackJson, listOf("surveyId"))
            val surveyTypeExpr = JsonExtract(FeedbackTable.feedbackJson, listOf("surveyType"))
            val dbQuery = FeedbackTable.select(surveyIdExpr, surveyTypeExpr)
            applyStatsFilters(dbQuery, query)
            dbQuery.andWhere { surveyIdExpr.isNotNull() }
            dbQuery.withDistinct()
            dbQuery.map { row ->
                SurveyTypeRow(
                    surveyId = row[surveyIdExpr],
                    surveyType = row[surveyTypeExpr]
                )
            }
        }

        val surveyTypeCounts = mutableMapOf<SurveyType, Int>()
        val seenSurveys = mutableMapOf<String, SurveyType>()

        for (row in distinctRows) {
            if (row.surveyId.isBlank()) continue
            if (seenSurveys.containsKey(row.surveyId)) continue
            val parsedType = row.surveyType?.let {
                try { SurveyType.valueOf(it.uppercase()) } catch (_: Exception) { SurveyType.CUSTOM }
            } ?: SurveyType.CUSTOM
            seenSurveys[row.surveyId] = parsedType
            surveyTypeCounts[parsedType] = (surveyTypeCounts[parsedType] ?: 0) + 1
        }

        val totalSurveys = seenSurveys.size
        val distribution = surveyTypeCounts.map { (type, count) ->
            val percentage = if (totalSurveys > 0) (count * 100 / totalSurveys) else 0
            SurveyTypeCount(type, count, percentage)
        }.sortedByDescending { it.count }

        return SurveyTypeDistribution(totalSurveys, distribution)
    }

    suspend fun getTaskPriorityStats(query: StatsQuery): TaskPriorityResponse {
        val records = dbQuery {
            val dbQuery = FeedbackTable.selectAll()
            applyStatsFilters(dbQuery, query)
            dbQuery.andWhere { JsonExtract(FeedbackTable.feedbackJson, listOf("surveyType")) eq "taskPriority" }
            dbQuery.map { it.toDbRecord() }
        }

        val dtos = records.map { it.toDto() }
            .filter { it.surveyType == SurveyType.TASK_PRIORITY }

        val voteCounts = mutableMapOf<String, Int>()
        val taskLabels = mutableMapOf<String, String>()

        for (feedback in dtos) {
            val priorityAnswer = feedback.answers.find { a ->
                a.fieldId == "priority" && a.fieldType == FieldType.MULTI_CHOICE
            } ?: continue

            val selectedIds = (priorityAnswer.value as? AnswerValue.MultiChoice)?.selectedOptionIds.orEmpty()
            if (selectedIds.isEmpty()) continue

            priorityAnswer.question.options?.forEach { opt ->
                taskLabels.putIfAbsent(opt.id, opt.label)
            }

            for (taskId in selectedIds) {
                voteCounts[taskId] = (voteCounts[taskId] ?: 0) + 1
            }
        }

        val tasks = voteCounts.entries
            .sortedByDescending { it.value }
            .map { (taskId, votes) ->
                TaskVote(
                    task = taskLabels[taskId] ?: taskId,
                    votes = votes,
                    percentage = 0
                )
            }

        val totalVotes = tasks.sumOf { it.votes }
        val tasksWithPercentages = if (totalVotes > 0) {
            tasks.map { it.copy(percentage = kotlin.math.round((it.votes.toDouble() / totalVotes) * 100.0).toInt()) }
        } else tasks

        var cumulative = 0
        var longNeckCutoff = 0
        for (i in tasksWithPercentages.indices) {
            cumulative += tasksWithPercentages[i].percentage
            if (cumulative >= 80) {
                longNeckCutoff = i + 1
                break
            }
        }
        if (longNeckCutoff == 0) {
            longNeckCutoff = tasksWithPercentages.size
        }

        val cumulativePercentageAt5 = tasksWithPercentages
            .take(5)
            .sumOf { it.percentage }

        return TaskPriorityResponse(
            totalSubmissions = dtos.size,
            tasks = tasksWithPercentages,
            longNeckCutoff = longNeckCutoff,
            cumulativePercentageAt5 = cumulativePercentageAt5,
        )
    }

    suspend fun getBlockerStats(query: StatsQuery, themes: List<TextThemeDto>): BlockerStatsResponse {
        val records = dbQuery {
            val dbQuery = FeedbackTable.selectAll()
            applyStatsFilters(dbQuery, query)
            dbQuery.andWhere { JsonExtract(FeedbackTable.feedbackJson, listOf("surveyType")) eq "topTasks" }
            dbQuery.map { it.toDbRecord() }
        }

        val dtos = records.map { it.toDto() }

        val blockerResponses = mutableListOf<RecentBlockerResponse>()
        val bigramAccumulators = mutableMapOf<String, BigramAccumulator>()
        val quoteCandidates = mutableListOf<Pair<String, String>>()

        for (feedback in dtos) {
            val blockerAnswer = feedback.answers.find { a ->
                a.fieldId in TopTasksFieldIds.blocker
            }
            val blockerText = (blockerAnswer?.value as? AnswerValue.Text)?.text?.trim().orEmpty()
            if (blockerText.isBlank()) continue

            val taskAnswer = feedback.answers.find { a ->
                a.fieldId in TopTasksFieldIds.task
            }

            val taskLabel = when {
                taskAnswer != null && taskAnswer.fieldType == FieldType.SINGLE_CHOICE -> {
                    val selectedId = (taskAnswer.value as? AnswerValue.SingleChoice)?.selectedOptionId
                    val option = taskAnswer.question.options?.find { it.id == selectedId }
                    option?.label ?: "Ukjent oppgave"
                }
                else -> "Ukjent oppgave"
            }

            if (query.task != null && taskLabel != query.task) continue

            blockerResponses.add(
                RecentBlockerResponse(
                    blocker = blockerText,
                    task = taskLabel,
                    submittedAt = feedback.submittedAt
                )
            )

            // Track bigrams and quote candidates for this blocker text
            TextProcessor.extractBigrams(blockerText).forEach { bg ->
                val acc = bigramAccumulators.getOrPut(bg.stemKey) { BigramAccumulator(bg.stemKey) }
                acc.addOccurrence(bg.surface, feedback.id)
            }
            quoteCandidates.add(blockerText to feedback.submittedAt)
        }

        val wordAccumulators = mutableMapOf<String, StemWordAccumulator>()
        for (response in blockerResponses) {
            val seenStemsInResponse = mutableSetOf<String>()
            TextProcessor.extractStemmedWords(response.blocker).forEach { (surface, stem) ->
                val acc = wordAccumulators.getOrPut(stem) { StemWordAccumulator(stem) }
                acc.addOccurrence(surface)

                if (!seenStemsInResponse.contains(stem) && acc.sourceResponses.size < MAX_SOURCE_RESPONSES_BLOCKER) {
                    if (!acc.usedTexts.contains(response.blocker)) {
                        acc.sourceResponses.add(SourceResponse(text = response.blocker, submittedAt = response.submittedAt))
                        acc.usedTexts.add(response.blocker)
                    }
                    seenStemsInResponse.add(stem)
                }
            }
        }

        val wordFrequency = wordAccumulators.values
            .sortedByDescending { it.totalCount }
            .take(30)
            .map { it.toWordFrequencyEntry() }

        val phrases = bigramAccumulators.values
            .filter { it.totalCount >= MIN_PHRASE_OCCURRENCES }
            .sortedByDescending { it.totalCount }
            .take(MAX_PHRASES_BLOCKER)
            .map { it.toPhraseEntry(maxSourceIds = MAX_SOURCE_RESPONSES_BLOCKER) }

        val quotes = QuoteSelector.selectQuotes(quoteCandidates, seed = blockerResponses.size.toLong())
        val confidence = QuoteSelector.confidenceLevel(blockerResponses.size)

        val themeAccumulators = themes.map { theme ->
            ThemeAccumulator(
                theme = theme.name,
                themeId = theme.id,
                color = theme.color,
            )
        }.toMutableList()

        val annetThemeId = "blocker-annet"
        themeAccumulators.add(
            ThemeAccumulator(
                theme = "Annet",
                themeId = annetThemeId,
                color = "var(--ax-text-neutral-subtle)",
            )
        )

        for (response in blockerResponses) {
            val blockerWordStems = TextProcessor.tokenize(response.blocker).map { TextProcessor.stemNorwegian(it) }
            var matchedAny = false

            for (acc in themeAccumulators) {
                if (acc.themeId == annetThemeId) continue

                val theme = themes.find { it.id == acc.themeId } ?: continue
                val keywordStems = theme.keywords.map { TextProcessor.stemNorwegian(it.lowercase()) }
                if (keywordStems.any { it in blockerWordStems }) {
                    acc.count++
                    if (acc.examples.size < 3 && acc.usedExamples.add(response.blocker)) {
                        acc.examples.add(response.blocker)
                    }
                    matchedAny = true
                }
            }

            if (!matchedAny) {
                val annet = themeAccumulators.find { it.themeId == annetThemeId }
                if (annet != null) {
                    annet.count++
                    if (annet.examples.size < 3 && annet.usedExamples.add(response.blocker)) {
                        annet.examples.add(response.blocker)
                    }
                }
            }
        }

        val themeResults = themeAccumulators
            .filter { it.count > 0 }
            .sortedByDescending { it.count }
            .map { it.toResult() }

        val recentBlockers = blockerResponses
            .sortedByDescending { parseSubmittedAt(it.submittedAt) }
            .take(10)

        return BlockerStatsResponse(
            totalBlockers = blockerResponses.size,
            wordFrequency = wordFrequency,
            themes = themeResults,
            recentBlockers = recentBlockers,
            phrases = phrases,
            quotes = quotes,
            confidenceLevel = confidence,
        )
    }

    
    private fun applyStatsFilters(query: Query, criteria: StatsQuery) {
        query.andWhere { FeedbackTable.team eq criteria.team }
        criteria.app?.let { query.andWhere { FeedbackTable.app eq it } }
        
        // Survey ID filter
        criteria.surveyId?.let { surveyId ->
            query.andWhere { JsonExtract(FeedbackTable.feedbackJson, listOf("surveyId")) eq surveyId }
        }
        
        // Date range filter - convert YYYY-MM-DD to UTC Instants (Europe/Oslo)
        criteria.fromDate?.let { fromDate ->
            try {
                val localDate = java.time.LocalDate.parse(fromDate)
                val startOfDay = localDate.atStartOfDay(java.time.ZoneId.of("Europe/Oslo")).toInstant()
                query.andWhere { FeedbackTable.opprettet greaterEq startOfDay }
            } catch (e: Exception) {
                // If parsing fails, try as instant (backward compatibility)
                try {
                    query.andWhere { FeedbackTable.opprettet greaterEq Instant.parse(fromDate) }
                } catch (_: Exception) { }
            }
        }
        
        criteria.toDate?.let { toDate ->
            try {
                val localDate = java.time.LocalDate.parse(toDate)
                // Inclusive date filter: < start of next day in Europe/Oslo
                val nextDayStart = localDate.plusDays(1)
                    .atStartOfDay(java.time.ZoneId.of("Europe/Oslo"))
                    .toInstant()
                query.andWhere { FeedbackTable.opprettet less nextDayStart }
            } catch (e: Exception) {
                // If parsing fails, try as instant (backward compatibility)
                try {
                    query.andWhere { FeedbackTable.opprettet lessEq Instant.parse(toDate) }
                } catch (_: Exception) { }
            }
        }
        
        // Device type filter
        criteria.deviceType?.let { device ->
            query.andWhere { JsonExtract(FeedbackTable.feedbackJson, listOf("context", "deviceType")) eq device }
        }

        // Segment filter (context.tags)
        criteria.segments.forEach { (key, value) ->
            val safeKey = key.trim()
            val safeValue = value.trim()
            if (safeKey.isBlank() || safeValue.isBlank()) return@forEach
            query.andWhere {
                JsonExtract(FeedbackTable.feedbackJson, listOf("context", "tags", safeKey)) eq safeValue
            }
        }

        // Filter by specific rating answers (multi-value)
        criteria.ratingFilters.forEach { (fieldId, ratingVal) ->
            val safeFieldId = validateJsonPathFieldId(fieldId, "ratingFieldId", log)
            if (safeFieldId != null) {
                val ratingTextForField = JsonbPathQueryFirstText(
                    FeedbackTable.feedbackJson,
                    "$.answers[*] ? (@.fieldId == \"$safeFieldId\" && @.value.type == \"rating\").value.rating"
                )
                val ratingExpr = Cast(ratingTextForField, IntegerColumnType())
                query.andWhere { ratingExpr eq ratingVal }
            }
        }

        // Filter by specific choice answers (multi-value)
        criteria.choiceFilters.forEach { (fieldId, value) ->
            val choiceJsonPaths = buildChoiceJsonPaths(fieldId, value, log)
            if (choiceJsonPaths != null) {
                query.andWhere {
                    JsonbPathExists(FeedbackTable.feedbackJson, choiceJsonPaths.singleChoicePath) or
                        JsonbPathExists(FeedbackTable.feedbackJson, choiceJsonPaths.multiChoicePath)
                }
            }
        }
    }


}
