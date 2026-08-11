package no.nav.lumi.routes

import io.ktor.http.*
import io.ktor.server.resources.get
import io.ktor.server.response.*
import io.ktor.server.routing.*
import no.nav.lumi.config.auth.authorizedTeam
import no.nav.lumi.domain.ExportFormat
import no.nav.lumi.domain.FeedbackQuery
import no.nav.lumi.domain.FILTER_ALL
import no.nav.lumi.service.ExportService

private val defaultExportService = ExportService()

/**
 * Routes for exporting feedback data.
 * Delegates export logic to ExportService.
 */
fun Route.exportRoutes(exportService: ExportService = defaultExportService) {
    // Export feedback data
    get<ApiV1Intern.Export> { params ->
        val team = call.authorizedTeam
        val tags = parseTags(params.tag)
        val segments = parseSegments(params.segment)
        validateDateRange(fromDate = params.fromDate, toDate = params.toDate)
        
        val format = try { 
            ExportFormat.valueOf(params.format.uppercase()) 
        } catch (e: Exception) { 
            ExportFormat.CSV 
        }

        val query = FeedbackQuery(
            team = team,
            includeArchived = params.includeArchived ?: false,
            app = params.app?.takeIf { it != FILTER_ALL },
            page = 0,
            size = ExportService.MAX_EXPORT_SIZE,
            hasText = params.hasText ?: false,
            lowRating = params.lowRating ?: false,
            tags = tags,
            query = parseSearchQuery(params.query),
            fromDate = params.fromDate,
            toDate = params.toDate,
            surveyId = params.surveyId,
            deviceType = params.deviceType?.takeIf { it.isNotBlank() },
            theme = params.theme,
            task = params.task,
            segments = segments,
            choiceFilters = parseChoiceFilters(params.choice, params.choiceFieldId, params.choiceValue),
            ratingFilters = parseRatingFilters(params.rating, params.ratingFieldId, params.ratingValue),
            phraseFilter = parsePhraseFilter(params.phrase),
        )
        
        val feedbacks = exportService.getFeedbackForExport(query)
        
        when (format) {
            ExportFormat.CSV -> {
                val csv = exportService.exportToCsv(feedbacks)
                call.response.header(
                    HttpHeaders.ContentDisposition,
                    ContentDisposition.Attachment.withParameter(
                        ContentDisposition.Parameters.FileName, 
                        "lumi-export.csv"
                    ).toString()
                )
                call.respondText(csv, ContentType.Text.CSV)
            }
            ExportFormat.JSON -> {
                val json = exportService.exportToJson(feedbacks)
                call.response.header(
                    HttpHeaders.ContentDisposition,
                    ContentDisposition.Attachment.withParameter(
                        ContentDisposition.Parameters.FileName, 
                        "lumi-export.json"
                    ).toString()
                )
                call.respondText(json, ContentType.Application.Json)
            }
            ExportFormat.EXCEL -> {
                val bytes = exportService.exportToExcel(feedbacks)
                call.response.header(
                    HttpHeaders.ContentDisposition,
                    ContentDisposition.Attachment.withParameter(
                        ContentDisposition.Parameters.FileName, 
                        "lumi-export.xlsx"
                    ).toString()
                )
                call.respondBytes(bytes, ContentType.Application.Xlsx)
            }
        }
    }
}
