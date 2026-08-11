package no.nav.lumi.repository

import no.nav.lumi.domain.*
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.greaterEq
import org.jetbrains.exposed.v1.core.less
import org.jetbrains.exposed.v1.core.lessEq
import org.jetbrains.exposed.v1.jdbc.andWhere
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.time.Instant

/**
 * Repository for Discovery survey data access.
 * Handles database queries for discovery feedback data.
 */
class DiscoveryStatsRepository {

    /**
     * Fetch all discovery survey feedback for the given query parameters.
     * Returns FeedbackDto list for further processing by the service layer.
     */
    suspend fun getDiscoveryFeedback(query: StatsQuery): List<FeedbackDto> {
        val records = dbQuery {
            val dbQuery = FeedbackTable.selectAll()
            dbQuery.andWhere { FeedbackTable.team eq query.team }
            if (!query.includeArchived) {
                dbQuery.andWhere { SurveyIsNotArchived() }
            }
            dbQuery.andWhere { 
                JsonExtract(FeedbackTable.feedbackJson, listOf("surveyType")) eq "discovery" 
            }
            
            query.surveyId?.let { surveyId ->
                dbQuery.andWhere { JsonExtract(FeedbackTable.feedbackJson, listOf("surveyId")) eq surveyId }
            }
            
            // Date range filter - convert YYYY-MM-DD to UTC Instants (Europe/Oslo)
            query.fromDate?.let { fromDate ->
                try {
                    val localDate = java.time.LocalDate.parse(fromDate)
                    val startOfDay = localDate.atStartOfDay(java.time.ZoneId.of("Europe/Oslo")).toInstant()
                    dbQuery.andWhere { FeedbackTable.opprettet greaterEq startOfDay }
                } catch (e: Exception) {
                    try { dbQuery.andWhere { FeedbackTable.opprettet greaterEq Instant.parse(fromDate) } } catch (_: Exception) { }
                }
            }
            query.toDate?.let { toDate ->
                try {
                    val localDate = java.time.LocalDate.parse(toDate)
                    // Inclusive date filter: < start of next day in Europe/Oslo
                    val nextDayStart = localDate.plusDays(1)
                        .atStartOfDay(java.time.ZoneId.of("Europe/Oslo"))
                        .toInstant()
                    dbQuery.andWhere { FeedbackTable.opprettet less nextDayStart }
                } catch (e: Exception) {
                    try { dbQuery.andWhere { FeedbackTable.opprettet lessEq Instant.parse(toDate) } } catch (_: Exception) { }
                }
            }
            query.deviceType?.let { device ->
                dbQuery.andWhere { JsonExtract(FeedbackTable.feedbackJson, listOf("context", "deviceType")) eq device }
            }
            
            dbQuery
                .orderBy(FeedbackTable.opprettet to SortOrder.DESC)
                .map { it.toDbRecord() }
        }

        return records.map { it.toDto() }
    }
}
