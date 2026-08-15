package no.nav.lumi.service

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import no.nav.lumi.domain.AnswerValue
import no.nav.lumi.domain.FeedbackDto
import no.nav.lumi.domain.FeedbackQuery
import no.nav.lumi.domain.FieldType
import no.nav.lumi.repository.FeedbackRepository
import org.apache.poi.xssf.usermodel.XSSFWorkbook
import java.io.ByteArrayOutputStream

/**
 * Service layer for exporting feedback data.
 * Supports CSV, JSON, and Excel formats.
 */
class ExportService(
    private val feedbackRepository: FeedbackRepository = FeedbackRepository()
) {
    private val json = Json { prettyPrint = true }

    /**
     * Get feedback data for export based on query.
     * Returns up to MAX_EXPORT_SIZE records.
     */
    suspend fun getFeedbackForExport(query: FeedbackQuery): List<FeedbackDto> {
        val exportQuery = query.copy(size = MAX_EXPORT_SIZE)
        val (content, _, _) = feedbackRepository.findPaginated(exportQuery)
        return content
    }

    /**
     * Export feedback list to CSV format.
     */
    fun exportToCsv(feedbacks: List<FeedbackDto>): String {
        return buildString {
            // Header
            appendLine(
                "id,submittedAt,app,surveyId,rating,feedback,sensitiveDataRedacted,screenWidth,screenHeight"
            )
            
            // Data rows
            feedbacks.forEach { feedback ->
                val rating = feedback.answers.firstOrNull { it.fieldType == FieldType.RATING }?.let {
                    (it.value as? AnswerValue.Rating)?.rating?.toString() ?: ""
                } ?: ""
                val feedbackText = feedback.answers.firstOrNull { it.fieldType == FieldType.TEXT }?.let {
                    (it.value as? AnswerValue.Text)?.text ?: ""
                } ?: ""

                val row = listOf(
                    feedback.id,
                    feedback.submittedAt,
                    feedback.app ?: "",
                    feedback.surveyId,
                    rating,
                    feedbackText,
                    feedback.sensitiveDataRedacted.toString(),
                    feedback.context?.screenWidth?.toString() ?: "",
                    feedback.context?.screenHeight?.toString() ?: "",
                ).joinToString(",") { it.escapeCsv() }

                appendLine(row)
            }
        }
    }

    /**
     * Export feedback list to JSON format.
     */
    fun exportToJson(feedbacks: List<FeedbackDto>): String {
        return json.encodeToString(feedbacks)
    }

    /**
     * Export feedback list to Excel (XLSX) format.
     * Returns the Excel file as a byte array.
     */
    fun exportToExcel(feedbacks: List<FeedbackDto>): ByteArray {
        val workbook = XSSFWorkbook()
        val sheet = workbook.createSheet("Feedback")
        
        // Header row
        val headerRow = sheet.createRow(0)
        val headers = listOf(
            "ID",
            "Tidspunkt",
            "App",
            "Survey",
            "Vurdering",
            "Tilbakemelding",
            "Sensitiv data fjernet",
            "Skjermbredde",
            "Skjermhøyde",
        )
        val maxColumnChars = headers.map { it.length }.toMutableList()
        headers.forEachIndexed { index, header ->
            headerRow.createCell(index).setCellValue(header)
        }
        
        // Data rows
        feedbacks.forEachIndexed { rowIndex, feedback ->
            val row = sheet.createRow(rowIndex + 1)
            val id = feedback.id
            val submittedAt = feedback.submittedAt
            val app = feedback.app ?: ""
            val surveyId = feedback.surveyId
            
            val rating = feedback.answers.firstOrNull { it.fieldType == FieldType.RATING }?.let {
                (it.value as? AnswerValue.Rating)?.rating?.toString() ?: ""
            } ?: ""
            
            val feedbackText = feedback.answers.firstOrNull { it.fieldType == FieldType.TEXT }?.let {
                (it.value as? AnswerValue.Text)?.text ?: ""
            } ?: ""

            val sensitiveDataRedacted = if (feedback.sensitiveDataRedacted) "Ja" else "Nei"
            val values = listOf(
                id,
                submittedAt,
                app,
                surveyId,
                rating,
                feedbackText,
                sensitiveDataRedacted,
                feedback.context?.screenWidth?.toString() ?: "",
                feedback.context?.screenHeight?.toString() ?: "",
            )

            values.forEachIndexed { columnIndex, value ->
                val safeValue = if (value.isPotentialCsvFormula()) "'$value" else value
                row.createCell(columnIndex).setCellValue(safeValue)
                if (safeValue.length > maxColumnChars[columnIndex]) {
                    maxColumnChars[columnIndex] = safeValue.length
                }
            }
        }

        // Avoid POI autoSizeColumn (uses AWT/font config and causes noisy warnings in distroless runtime).
        maxColumnChars.forEachIndexed { index, maxChars ->
            val paddedChars = (maxChars + 2).coerceAtMost(100)
            sheet.setColumnWidth(index, paddedChars * 256)
        }
        
        val outputStream = ByteArrayOutputStream()
        workbook.write(outputStream)
        workbook.close()
        
        return outputStream.toByteArray()
    }

    companion object {
        /** Maximum number of records to export */
        const val MAX_EXPORT_SIZE = 10000
    }
}

/**
 * Helper extension to escape CSV values properly.
 */
private fun String.escapeCsv(): String {
    val value = if (isPotentialCsvFormula()) "'$this" else this
    return if (value.contains(",") || value.contains("\"") || value.contains("\n") || value.contains("\r")) {
        "\"${value.replace("\"", "\"\"")}\""
    } else {
        value
    }
}

private fun String.isPotentialCsvFormula(): Boolean {
    val trimmed = trimStart { it == ' ' || it == '\t' }
    val first = trimmed.firstOrNull() ?: return false
    return first == '=' || first == '+' || first == '-' || first == '@'
}
