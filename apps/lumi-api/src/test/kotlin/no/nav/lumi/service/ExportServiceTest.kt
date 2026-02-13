package no.nav.lumi.service

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldEndWith
import io.kotest.matchers.string.shouldStartWith
import no.nav.lumi.domain.*

class ExportServiceTest : FunSpec({

    val service = ExportService()

    test("exportToCsv generates correct header") {
        val csv = service.exportToCsv(emptyList())
        csv.shouldStartWith("id,submittedAt,app,surveyId,rating,feedback,sensitiveDataRedacted")
    }

    test("exportToCsv includes feedback data") {
        val feedbacks = listOf(
            FeedbackDto(
                id = "test-id-123",
                submittedAt = "2024-01-15T10:00:00Z",
                app = "test-app",
                surveyId = "survey-1",
                answers = listOf(
                    Answer(
                        fieldId = "rating",
                        fieldType = FieldType.RATING,
                        question = Question(label = "Rating"),
                        value = AnswerValue.Rating(4)
                    ),
                    Answer(
                        fieldId = "feedback",
                        fieldType = FieldType.TEXT,
                        question = Question(label = "Feedback"),
                        value = AnswerValue.Text("Great service!")
                    )
                ),
                sensitiveDataRedacted = false
            )
        )

        val csv = service.exportToCsv(feedbacks)

        csv.shouldContain("test-id-123")
        csv.shouldContain("test-app")
        csv.shouldContain(",4,")
        csv.shouldContain("Great service!")
    }

    test("exportToCsv escapes commas in text") {
        val feedbacks = listOf(
            FeedbackDto(
                id = "test-id",
                submittedAt = "2024-01-15T10:00:00Z",
                app = "app",
                surveyId = "survey",
                answers = listOf(
                    Answer(
                        fieldId = "feedback",
                        fieldType = FieldType.TEXT,
                        question = Question(label = "Feedback"),
                        value = AnswerValue.Text("Hello, world")
                    )
                ),
                sensitiveDataRedacted = false
            )
        )

        val csv = service.exportToCsv(feedbacks)
        csv.shouldContain("\"Hello, world\"")
    }

    test("exportToCsv prefixes potential formulas in text") {
        val feedbacks = listOf(
            FeedbackDto(
                id = "test-id",
                submittedAt = "2024-01-15T10:00:00Z",
                app = "app",
                surveyId = "survey",
                answers = listOf(
                    Answer(
                        fieldId = "feedback",
                        fieldType = FieldType.TEXT,
                        question = Question(label = "Feedback"),
                        value = AnswerValue.Text("=1+1")
                    )
                ),
                sensitiveDataRedacted = false
            )
        )

        val csv = service.exportToCsv(feedbacks)
        csv.shouldContain("'=1+1")
    }

    test("exportToCsv prefixes potential formulas even with leading whitespace") {
        val feedbacks = listOf(
            FeedbackDto(
                id = "test-id",
                submittedAt = "2024-01-15T10:00:00Z",
                app = "app",
                surveyId = "survey",
                answers = listOf(
                    Answer(
                        fieldId = "feedback",
                        fieldType = FieldType.TEXT,
                        question = Question(label = "Feedback"),
                        value = AnswerValue.Text(" =1+1")
                    )
                ),
                sensitiveDataRedacted = false
            )
        )

        val csv = service.exportToCsv(feedbacks)
        csv.shouldContain("' =1+1")
    }

    test("exportToJson returns valid JSON") {
        val feedbacks = listOf(
            FeedbackDto(
                id = "test-id",
                submittedAt = "2024-01-15T10:00:00Z",
                app = "app",
                surveyId = "survey",
                answers = emptyList(),
                sensitiveDataRedacted = false
            )
        )

        val json = service.exportToJson(feedbacks)

        json.shouldStartWith("[")
        json.shouldEndWith("]")
        json.shouldContain("test-id")
    }

    test("exportToExcel returns non-empty byte array") {
        val feedbacks = listOf(
            FeedbackDto(
                id = "test-id",
                submittedAt = "2024-01-15T10:00:00Z",
                app = "app",
                surveyId = "survey",
                answers = emptyList(),
                sensitiveDataRedacted = false
            )
        )

        val bytes = service.exportToExcel(feedbacks)
        (bytes.isNotEmpty()) shouldBe true
        bytes[0] shouldBe 0x50.toByte()
        bytes[1] shouldBe 0x4B.toByte()
    }

    test("exportToExcel prefixes potential formulas in cell values") {
        val feedbacks = listOf(
            FeedbackDto(
                id = "test-id",
                submittedAt = "2024-01-15T10:00:00Z",
                app = "app",
                surveyId = "survey",
                answers = listOf(
                    Answer(
                        fieldId = "feedback",
                        fieldType = FieldType.TEXT,
                        question = Question(label = "Feedback"),
                        value = AnswerValue.Text("=cmd|' /C calc'!A0")
                    )
                ),
                sensitiveDataRedacted = false
            )
        )

        val bytes = service.exportToExcel(feedbacks)
        val workbook = org.apache.poi.xssf.usermodel.XSSFWorkbook(java.io.ByteArrayInputStream(bytes))
        val sheet = workbook.getSheetAt(0)
        val feedbackCell = sheet.getRow(1).getCell(5).stringCellValue
        feedbackCell shouldBe "'=cmd|' /C calc'!A0"
        workbook.close()
    }
})
