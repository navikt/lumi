package no.nav.lumi.repository

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.domain.*
import no.nav.lumi.sensitive.SensitiveDataFilter
import no.nav.lumi.service.TextProcessor
import org.jetbrains.exposed.v1.core.*
import org.jetbrains.exposed.v1.jdbc.*
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import org.slf4j.LoggerFactory
import java.time.Instant
import java.util.*
import kotlin.math.ceil

class FeedbackRepository(
    private val themeRepository: TextThemeRepository = TextThemeRepository(),
    private val contextTagsRepository: FeedbackContextTagsRepository = FeedbackContextTagsRepository()
) {
    private val log = LoggerFactory.getLogger(FeedbackRepository::class.java)
    private val json = Json { ignoreUnknownKeys = true }
    private val sensitiveDataFilter = SensitiveDataFilter.DEFAULT

    suspend fun findById(id: String, team: String): FeedbackDto? {
        return dbQuery {
            FeedbackTable.selectAll().where { (FeedbackTable.id eq id) and (FeedbackTable.team eq team) }
                .singleOrNull()
                ?.toDbRecord()
                ?.let { record ->
                    val tags = findTagsByFeedbackId(record.id)
                    record.toDto(tags)
                }
        }
    }
    
    suspend fun findRawById(id: String, team: String): FeedbackDbRecord? {
        return dbQuery {
            FeedbackTable.selectAll().where { (FeedbackTable.id eq id) and (FeedbackTable.team eq team) }
                .singleOrNull()
                ?.toDbRecord()
        }
    }

    suspend fun findIdByDeduplicationKeyHash(team: String, surveyId: String, deduplicationKeyHash: String): String? {
        return dbQuery {
            findIdByDeduplicationKeyHashInCurrentTransaction(team, surveyId, deduplicationKeyHash)
        }
    }

    suspend fun <T> withScopedDeduplicationLock(
        team: String,
        surveyId: String,
        deduplicationKeyHash: String,
        block: suspend () -> T
    ): T {
        return dbQuery {
            val conn = TransactionManager.current().connection.connection as java.sql.Connection
            conn.prepareStatement("SELECT pg_advisory_xact_lock(hashtext(?), hashtext(?))").use { stmt ->
                stmt.setString(1, "$team:$surveyId")
                stmt.setString(2, deduplicationKeyHash)
                stmt.execute()
            }

            block()
        }
    }

    suspend fun save(
        feedbackJson: String,
        team: String,
        app: String,
        surveyId: String? = null,
        definitionHash: String? = null,
        deduplicationKeyHash: String? = null
    ): SaveResult {
        return dbQuery {
            saveInCurrentTransaction(feedbackJson, team, app, surveyId, definitionHash, deduplicationKeyHash)
        }
    }

    internal fun findIdByDeduplicationKeyHashInCurrentTransaction(
        team: String,
        surveyId: String,
        deduplicationKeyHash: String
    ): String? {
        return FeedbackTable.select(FeedbackTable.id)
            .where {
                (FeedbackTable.team eq team) and
                    (FeedbackTable.surveyId eq surveyId) and
                    (FeedbackTable.deduplicationKeyHash eq deduplicationKeyHash)
            }
            .singleOrNull()
            ?.get(FeedbackTable.id)
    }

    internal fun saveInCurrentTransaction(
        feedbackJson: String,
        team: String,
        app: String,
        surveyId: String? = null,
        definitionHash: String? = null,
        deduplicationKeyHash: String? = null
    ): SaveResult {
        val id = UUID.randomUUID().toString()

        return if (surveyId != null && deduplicationKeyHash != null) {
            val inserted = FeedbackTable.insertIgnore {
                it[FeedbackTable.id] = id
                it[FeedbackTable.opprettet] = Instant.now()
                it[FeedbackTable.feedbackJson] = feedbackJson
                it[FeedbackTable.team] = team
                it[FeedbackTable.app] = app
                it[FeedbackTable.surveyId] = surveyId
                it[FeedbackTable.definitionHash] = definitionHash
                it[FeedbackTable.deduplicationKeyHash] = deduplicationKeyHash
            }.insertedCount > 0

            if (inserted) {
                SaveResult.Created(id)
            } else {
                val existingId = findIdByDeduplicationKeyHashInCurrentTransaction(team, surveyId, deduplicationKeyHash)
                    ?: throw ApiErrorException.InternalServerErrorException(
                        "Duplicate deduplication key detected but existing feedback row was not found"
                    )

                SaveResult.Duplicate(existingId)
            }
        } else {
            FeedbackTable.insert {
                it[FeedbackTable.id] = id
                it[FeedbackTable.opprettet] = Instant.now()
                it[FeedbackTable.feedbackJson] = feedbackJson
                it[FeedbackTable.team] = team
                it[FeedbackTable.app] = app
                it[FeedbackTable.surveyId] = surveyId
                it[FeedbackTable.definitionHash] = definitionHash
                it[FeedbackTable.deduplicationKeyHash] = deduplicationKeyHash
            }

            SaveResult.Created(id)
        }
    }

    suspend fun updateJson(id: String, team: String, feedbackJson: String): Boolean {
        return dbQuery {
            FeedbackTable.update({ (FeedbackTable.id eq id) and (FeedbackTable.team eq team) }) {
                it[FeedbackTable.feedbackJson] = feedbackJson
            } > 0
        }
    }

    /**
     * Permanently delete a feedback item from the database.
     * Returns true if the item was deleted, false if not found.
     */
    suspend fun delete(id: String, team: String): Boolean {
        return dbQuery {
            FeedbackTable.deleteWhere { (FeedbackTable.id eq id) and (FeedbackTable.team eq team) } > 0
        }
    }

    /**
     * Permanently delete all feedback items for a given surveyId and team.
     *
     * Note: surveyId is stored inside feedback_json, so we filter using JSON extraction.
     * Returns number of deleted rows.
     */
    suspend fun deleteSurvey(surveyId: String, team: String): Int {
        return dbQuery {
            FeedbackTable.deleteWhere {
                (JsonExtract(FeedbackTable.feedbackJson, listOf("surveyId")) eq surveyId) and
                    (FeedbackTable.team eq team)
            }
        }
    }

    /**
     * Atomically deletes markers and feedback for a survey within one transaction.
     * Returns number of deleted feedback rows.
     */
    suspend fun deleteSurveyWithMarkers(surveyId: String, team: String): Int {
        return dbQuery {
            RatingMarkerTable.deleteWhere {
                (RatingMarkerTable.team eq team) and
                    (RatingMarkerTable.surveyId eq surveyId)
            }

            FeedbackTable.deleteWhere {
                (JsonExtract(FeedbackTable.feedbackJson, listOf("surveyId")) eq surveyId) and
                    (FeedbackTable.team eq team)
            }
        }
    }

    suspend fun addTag(id: String, team: String, tag: String): Boolean {
        return dbQuery {
            val normalized = normalizeTag(tag) ?: return@dbQuery false
            val exists = FeedbackTable.select(FeedbackTable.id)
                .where { (FeedbackTable.id eq id) and (FeedbackTable.team eq team) }
                .any()
            if (!exists) return@dbQuery false

            val alreadyTagged = FeedbackTagTable.select(FeedbackTagTable.tag)
                .where { (FeedbackTagTable.feedbackId eq id) and (FeedbackTagTable.tag eq normalized) }
                .any()

            if (!alreadyTagged) {
                FeedbackTagTable.insert {
                    it[feedbackId] = id
                    it[this.tag] = normalized
                }
            }

            true
        }
    }
    
    suspend fun removeTag(id: String, team: String, tag: String): Boolean {
        return dbQuery {
            val normalized = normalizeTag(tag) ?: return@dbQuery false
            val exists = FeedbackTable.select(FeedbackTable.id)
                .where { (FeedbackTable.id eq id) and (FeedbackTable.team eq team) }
                .any()
            if (!exists) return@dbQuery false

            FeedbackTagTable.deleteWhere {
                (FeedbackTagTable.feedbackId eq id) and (FeedbackTagTable.tag eq normalized)
            }
            true
        }
    }

    suspend fun findPaginated(query: FeedbackQuery): Triple<List<FeedbackDto>, Long, Int> {
        val themeFilter = query.theme?.trim()?.takeIf { it.isNotBlank() }
        val themes = if (themeFilter != null) {
            themeRepository.findByTeam(query.team, AnalysisContext.GENERAL_FEEDBACK)
        } else {
            emptyList()
        }
        val phraseFilter = query.phraseFilter
        val needsInMemoryFiltering =
            !query.task.isNullOrBlank() || !query.theme.isNullOrBlank() || phraseFilter != null

        if (phraseFilter != null && query.task.isNullOrBlank() && query.theme.isNullOrBlank()) {
            return findPaginatedByPhrase(query, phraseFilter)
        }

        if (!needsInMemoryFiltering) {
            val snapshot = dbQuery {
                val dbQuery = FeedbackTable.selectAll()
                dbQuery.andWhere { FeedbackTable.team eq query.team }
                query.app?.let { app ->
                    if (app != FILTER_ALL) {
                        dbQuery.andWhere { FeedbackTable.app eq app }
                    }
                }
                applyCommonFilters(dbQuery, query, log)

                val total = dbQuery.count()
                val totalPages = if (query.size > 0) ceil(total.toDouble() / query.size).toInt() else 0
                val page = query.page ?: (totalPages - 1).coerceAtLeast(0)
                val offset = (page * query.size).toLong()

                val records = dbQuery
                    .orderBy(FeedbackTable.opprettet to SortOrder.DESC)
                    .limit(query.size).offset(offset)
                    .map { it.toDbRecord() }

                val tagsById = findTagsByFeedbackIds(records.map { it.id })
                PaginatedSnapshot(records, tagsById, total, page)
            }

            val dtos = snapshot.records.map { record ->
                record.toDto(snapshot.tagsById[record.id].orEmpty())
            }
            return Triple(dtos, snapshot.total, snapshot.page)
        }

        val snapshot = dbQuery {
            val dbQuery = FeedbackTable.selectAll()
            dbQuery.andWhere { FeedbackTable.team eq query.team }
            query.app?.let { app ->
                if (app != FILTER_ALL) {
                    dbQuery.andWhere { FeedbackTable.app eq app }
                }
            }
            applyCommonFilters(dbQuery, query, log)

            val records = dbQuery
                .orderBy(FeedbackTable.opprettet to SortOrder.DESC)
                .map { it.toDbRecord() }

            val tagsById = findTagsByFeedbackIds(records.map { it.id })
            RecordsSnapshot(records, tagsById)
        }

        val dtos = snapshot.records.map { record ->
            record.toDto(snapshot.tagsById[record.id].orEmpty())
        }

        val taskFilter = query.task?.trim()?.takeIf { it.isNotBlank() }
        val phraseMatcher = phraseFilter?.let { it.fieldId to buildPhraseStemKey(it.surface) }

        val filtered = dtos.filter { feedback ->
            matchesTaskFilter(feedback, taskFilter) &&
                matchesThemeFilter(feedback, themeFilter, themes) &&
                (phraseMatcher == null || matchesPhraseFilter(feedback, phraseMatcher.first, phraseMatcher.second))
        }

        val total = filtered.size.toLong()
        val totalPages = if (query.size > 0) ceil(total.toDouble() / query.size).toInt() else 0
        val page = query.page ?: (totalPages - 1).coerceAtLeast(0)
        val offset = (page * query.size)

        val pageContent = if (query.size > 0) {
            filtered.drop(offset).take(query.size)
        } else {
            filtered
        }

        return Triple(pageContent, total, page)
    }

    private suspend fun findPaginatedByPhrase(
        query: FeedbackQuery,
        phraseFilter: PhraseFilter
    ): Triple<List<FeedbackDto>, Long, Int> {
        val expectedStemKey = buildPhraseStemKey(phraseFilter.surface)

        val records = dbQuery {
            val dbQuery = FeedbackTable.selectAll()
            dbQuery.andWhere { FeedbackTable.team eq query.team }
            query.app?.let { app ->
                if (app != FILTER_ALL) {
                    dbQuery.andWhere { FeedbackTable.app eq app }
                }
            }
            applyCommonFilters(dbQuery, query, log)

            dbQuery
                .orderBy(FeedbackTable.opprettet to SortOrder.DESC)
                .map { it.toDbRecord() }
        }

        val matchingRecords = records.filter { recordMatchesPhraseFilter(it, phraseFilter.fieldId, expectedStemKey) }
        val total = matchingRecords.size.toLong()
        val totalPages = if (query.size > 0) ceil(total.toDouble() / query.size).toInt() else 0
        val page = query.page ?: (totalPages - 1).coerceAtLeast(0)
        val offset = page * query.size
        val pageRecords = if (query.size > 0) {
            matchingRecords.drop(offset).take(query.size)
        } else {
            matchingRecords
        }
        val tagsById = dbQuery { findTagsByFeedbackIds(pageRecords.map { it.id }) }

        val dtos = pageRecords.map { record ->
            record.toDto(tagsById[record.id].orEmpty())
        }
        return Triple(dtos, total, page)
    }

    private fun recordMatchesPhraseFilter(record: FeedbackDbRecord, fieldId: String, expectedStemKey: String): Boolean {
        val answers = try {
            val jsonObj = json.parseToJsonElement(record.feedbackJson).jsonObject
            jsonObj["answers"] as? JsonArray
        } catch (e: Exception) {
            log.debug("Failed to parse feedback JSON for phrase filter id=${record.id}", e)
            null
        } ?: return false

        return answers.any { answerElement ->
            val answerObj = answerElement.asJsonObjectOrNull() ?: return@any false
            if (answerObj.stringValue("fieldId") != fieldId) return@any false
            if (answerObj.stringValue("fieldType") != FieldType.TEXT.name) return@any false

            val valueObj = answerObj["value"].asJsonObjectOrNull() ?: return@any false
            if (valueObj.stringValue("type") != "text") return@any false

            val text = valueObj.stringValue("text")?.trim().orEmpty()
            if (text.isBlank()) return@any false

            val redactedText = sensitiveDataFilter.redact(text).redactedText
            TextProcessor.extractBigrams(redactedText).any { it.stemKey == expectedStemKey }
        }
    }

    private fun kotlinx.serialization.json.JsonElement?.asJsonObjectOrNull(): JsonObject? =
        runCatching { this?.jsonObject }.getOrNull()

    private fun JsonObject.stringValue(key: String): String? =
        runCatching { this[key]?.jsonPrimitive?.contentOrNull }.getOrNull()

    /**
     * Find all tags for a specific team.
     * Used by filter bootstrap endpoint.
     */
    suspend fun findAllTags(team: String): Set<String> {
        return dbQuery {
            FeedbackTagTable
                .innerJoin(FeedbackTable)
                .select(FeedbackTagTable.tag)
                .where { FeedbackTable.team eq team }
                .withDistinct()
                .mapNotNull { it[FeedbackTagTable.tag] }
                .toSet()
        }
    }

    suspend fun findDistinctApps(team: String): List<String> {
        return dbQuery {
            FeedbackTable.select(FeedbackTable.app)
                .where { (FeedbackTable.team eq team) and FeedbackTable.app.isNotNull() }
                .withDistinct()
                .mapNotNull { it[FeedbackTable.app] }
        }
    }

    /**
     * Find all surveys (surveyIds) grouped by app for a specific team.
     * Used by filter bootstrap endpoint and survey list.
     */
    suspend fun findLastSubmissionBySurvey(team: String): Map<String, String> {
        return contextTagsRepository.findLastSubmissionBySurvey(team)
    }

    suspend fun findSurveysByApp(team: String): Map<String, List<String>> {
        return contextTagsRepository.findSurveysByApp(team)
    }
    
    suspend fun findMetadataKeysForSurvey(surveyId: String, team: String): Map<String, Set<String>> {
        return contextTagsRepository.findMetadataKeysForSurvey(surveyId, team)
    }

    suspend fun findContextTagsForSurvey(
        surveyId: String,
        team: String,
        task: String? = null,
        segments: List<Pair<String, String>> = emptyList(),
        fromDate: String? = null,
        toDate: String? = null,
        deviceType: String? = null,
        hasText: Boolean = false,
        lowRating: Boolean = false,
    ): Map<String, List<MetadataValueWithCount>> {
        return contextTagsRepository.findContextTagsForSurvey(
            surveyId = surveyId,
            team = team,
            task = task,
            segments = segments,
            fromDate = fromDate,
            toDate = toDate,
            deviceType = deviceType,
            hasText = hasText,
            lowRating = lowRating
        )
    }

}
