package no.nav.lumi.repository

import no.nav.lumi.domain.MarkerDto
import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.greaterEq
import org.jetbrains.exposed.v1.core.lessEq
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.update
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID

class RatingMarkerRepository {
    suspend fun create(
        surveyId: String,
        markerDate: LocalDate,
        label: String,
        description: String?,
        color: String?,
        team: String,
        createdBy: String?,
    ): MarkerDto {
        return dbQuery {
            val id = UUID.randomUUID()
            val now = OffsetDateTime.now()

            RatingMarkerTable.insert {
                it[RatingMarkerTable.id] = id
                it[RatingMarkerTable.team] = team
                it[RatingMarkerTable.surveyId] = surveyId
                it[RatingMarkerTable.markerDate] = markerDate
                it[RatingMarkerTable.label] = label
                it[RatingMarkerTable.description] = description
                it[RatingMarkerTable.color] = color
                it[RatingMarkerTable.createdBy] = createdBy
                it[RatingMarkerTable.createdAt] = now
                it[RatingMarkerTable.updatedAt] = now
            }

            MarkerDto(
                id = id.toString(),
                team = team,
                surveyId = surveyId,
                markerDate = markerDate.toString(),
                label = label,
                description = description,
                color = color,
                createdBy = createdBy,
                createdAt = now.toString(),
                updatedAt = now.toString(),
            )
        }
    }

    suspend fun findBySurvey(
        surveyId: String,
        team: String,
        fromDate: LocalDate?,
        toDate: LocalDate?,
    ): List<MarkerDto> {
        return dbQuery {
            var condition: Op<Boolean> =
                (RatingMarkerTable.team eq team) and
                    (RatingMarkerTable.surveyId eq surveyId)
            fromDate?.let { from ->
                condition = condition and (RatingMarkerTable.markerDate greaterEq from)
            }
            toDate?.let { to ->
                condition = condition and (RatingMarkerTable.markerDate lessEq to)
            }

            RatingMarkerTable.selectAll()
                .where { condition }
                .orderBy(
                    RatingMarkerTable.markerDate to SortOrder.ASC,
                    RatingMarkerTable.createdAt to SortOrder.ASC,
                )
                .map { it.toDto() }
        }
    }

    suspend fun update(
        id: UUID,
        surveyId: String,
        team: String,
        markerDate: LocalDate?,
        label: String?,
        description: String?,
        color: String?,
        clearDescription: Boolean,
        clearColor: Boolean,
    ): MarkerDto? {
        return dbQuery {
            val updatedRows = RatingMarkerTable.update({
                (RatingMarkerTable.id eq id) and
                    (RatingMarkerTable.team eq team) and
                    (RatingMarkerTable.surveyId eq surveyId)
            }) { stmt ->
                markerDate?.let { stmt[RatingMarkerTable.markerDate] = it }
                label?.let { stmt[RatingMarkerTable.label] = it }
                if (clearDescription) {
                    stmt[RatingMarkerTable.description] = null
                } else {
                    description?.let { stmt[RatingMarkerTable.description] = it }
                }
                if (clearColor) {
                    stmt[RatingMarkerTable.color] = null
                } else {
                    color?.let { stmt[RatingMarkerTable.color] = it }
                }
                stmt[RatingMarkerTable.updatedAt] = OffsetDateTime.now()
            }

            if (updatedRows == 0) return@dbQuery null

            RatingMarkerTable.selectAll()
                .where { RatingMarkerTable.id eq id }
                .singleOrNull()
                ?.toDto()
        }
    }

    suspend fun delete(
        id: UUID,
        surveyId: String,
        team: String,
    ): Boolean {
        return dbQuery {
            RatingMarkerTable.deleteWhere {
                (RatingMarkerTable.id eq id) and
                    (RatingMarkerTable.team eq team) and
                    (RatingMarkerTable.surveyId eq surveyId)
            } > 0
        }
    }

    suspend fun deleteBySurvey(
        surveyId: String,
        team: String,
    ): Int {
        return dbQuery {
            RatingMarkerTable.deleteWhere {
                (RatingMarkerTable.team eq team) and
                    (RatingMarkerTable.surveyId eq surveyId)
            }
        }
    }

    suspend fun countBySurvey(
        surveyId: String,
        team: String,
    ): Int {
        return dbQuery {
            RatingMarkerTable.selectAll()
                .where {
                    (RatingMarkerTable.team eq team) and
                        (RatingMarkerTable.surveyId eq surveyId)
                }
                .count()
                .toInt()
        }
    }

    private fun ResultRow.toDto(): MarkerDto {
        return MarkerDto(
            id = this[RatingMarkerTable.id].toString(),
            team = this[RatingMarkerTable.team],
            surveyId = this[RatingMarkerTable.surveyId],
            markerDate = this[RatingMarkerTable.markerDate].toString(),
            label = this[RatingMarkerTable.label],
            description = this[RatingMarkerTable.description],
            color = this[RatingMarkerTable.color],
            createdBy = this[RatingMarkerTable.createdBy],
            createdAt = this[RatingMarkerTable.createdAt].toString(),
            updatedAt = this[RatingMarkerTable.updatedAt].toString(),
        )
    }
}
