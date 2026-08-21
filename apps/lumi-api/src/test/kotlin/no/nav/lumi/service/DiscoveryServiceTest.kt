package no.nav.lumi.service

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.doubles.shouldBeLessThan
import io.kotest.matchers.shouldBe
import no.nav.lumi.domain.*

class DiscoveryServiceTest : FunSpec({
    val service = DiscoveryService()


    context("processStats") {
        test("returns empty response for empty feedback list") {
            val result = service.processStats(emptyList(), emptyList())
            
            result.totalSubmissions shouldBe 0
            result.themes.shouldBeEmpty()
            result.recentResponses.shouldBeEmpty()
        }

        test("groups by theme correctly") {
            val themes = listOf(
                TextThemeDto("1", "team", "Sykepenger", listOf("sykepenger"), priority = 1, analysisContext = AnalysisContext.GENERAL_FEEDBACK),
                TextThemeDto("2", "team", "Utbetaling", listOf("utbetaling"), priority = 1, analysisContext = AnalysisContext.GENERAL_FEEDBACK)
            )
            val feedbacks = listOf(
                createDiscoveryFeedback("Sjekke sykepenger", "yes"),
                createDiscoveryFeedback("Sjekke sykepenger", "yes"),
                createDiscoveryFeedback("Sjekke utbetaling", "no")
            )
            
            val result = service.processStats(feedbacks, themes)
            
            val sykTheme = result.themes.find { it.theme == "Sykepenger" }
            sykTheme?.count shouldBe 2
            sykTheme?.successRate shouldBe 1.0
            
            val utbTheme = result.themes.find { it.theme == "Utbetaling" }
            utbTheme?.count shouldBe 1
            utbTheme?.successRate shouldBe 0.0
        }

        test("counts a response in every matching theme") {
            val themes = listOf(
                TextThemeDto("1", "team", "Søknad", listOf("søknad"), priority = 10, analysisContext = AnalysisContext.GENERAL_FEEDBACK),
                TextThemeDto("2", "team", "Utbetaling", listOf("utbetaling"), priority = 0, analysisContext = AnalysisContext.GENERAL_FEEDBACK),
            )

            val result = service.processStats(
                listOf(createDiscoveryFeedback("Sjekke utbetaling i søknaden", "yes")),
                themes,
            )

            result.themes.find { it.theme == "Søknad" }?.count shouldBe 1
            result.themes.find { it.theme == "Utbetaling" }?.count shouldBe 1
            result.themes.none { it.theme == "Annet" } shouldBe true
        }

        test("matches multi-word theme keywords") {
            val themes = listOf(
                TextThemeDto("1", "team", "Innlogging", listOf("logget ut"), priority = 0, analysisContext = AnalysisContext.GENERAL_FEEDBACK),
            )

            val result = service.processStats(
                listOf(createDiscoveryFeedback("Jeg ble logget ut av løsningen", "no")),
                themes,
            )

            result.themes.single().theme shouldBe "Innlogging"
        }

        test("calculates success rate with partial weighting") {
            val feedbacks = listOf(
                createDiscoveryFeedback("Nav status sjekk", "yes"),     // 1.0
                createDiscoveryFeedback("Nav status sjekk", "partial"), // 0.5
                createDiscoveryFeedback("Nav status sjekk", "no")       // 0.0
            )
            
            val result = service.processStats(feedbacks, emptyList())
            
            // All go to "Annet" since no themes defined
            val annetTheme = result.themes.find { it.theme == "Annet" }
            annetTheme?.count shouldBe 3
            // (1.0 + 0.5 + 0.0) / 3 = 0.5
            annetTheme?.successRate shouldBe 0.5
        }

        test("limits examples to MAX_EXAMPLES") {
            val feedbacks = (1..10).map { 
                createDiscoveryFeedback("Task text number $it", "yes") 
            }
            
            val result = service.processStats(feedbacks, emptyList())
            
            val annetTheme = result.themes.find { it.theme == "Annet" }
            annetTheme?.examples?.size shouldBe DiscoveryService.MAX_EXAMPLES
        }

        test("limits recent responses to MAX_RECENT_RESPONSES") {
            val feedbacks = (1..30).map { 
                createDiscoveryFeedback("Task $it", "yes") 
            }
            
            val result = service.processStats(feedbacks, emptyList())
            
            result.recentResponses shouldHaveSize DiscoveryService.MAX_RECENT_RESPONSES
        }

        context("bigram extraction in processStats") {
            test("extracts phrases from repeated bigrams") {
                val feedbacks = listOf(
                    createDiscoveryFeedback("vanskelig å svare på spørsmålene", "no"),
                    createDiscoveryFeedback("vanskelig å svare riktig", "partial"),
                    createDiscoveryFeedback("helt greit å bruke skjemaet", "yes"),
                )
                val result = service.processStats(feedbacks, emptyList())

                result.phrases.any { it.text.contains("vanskelig") && it.text.contains("svar") } shouldBe true
                result.phrases.first { it.text.contains("vanskelig") }.count shouldBe 2
            }

            test("bigrams with only 1 occurrence are excluded") {
                val feedbacks = listOf(
                    createDiscoveryFeedback("dårlig design overalt", "no"),
                    createDiscoveryFeedback("god brukeropplevelse ellers", "yes"),
                )
                val result = service.processStats(feedbacks, emptyList())
                result.phrases.shouldBeEmpty()
            }

            test("confidenceLevel reflects total submissions") {
                val fewFeedbacks = (1..10).map { createDiscoveryFeedback("tekst $it", "yes") }
                val result = service.processStats(fewFeedbacks, emptyList())
                result.confidenceLevel shouldBe ConfidenceLevel.LOW
            }

            test("extracts phrases and representative examples") {
                val feedbacks = listOf(
                    createDiscoveryFeedback("vanskelig å svare", "no"),
                    createDiscoveryFeedback("vanskelig å svare riktig", "partial"),
                )
                val result = service.processStats(feedbacks, emptyList())

                result.phrases.isNotEmpty() shouldBe true
            }
        }
    }
})

/**
 * Helper to create a discovery feedback DTO for testing
 */
private fun createDiscoveryFeedback(
    taskText: String,
    success: String = "yes",
    blocker: String? = null
): FeedbackDto {
    val answers = mutableListOf(
        Answer(
            fieldId = "task",
            fieldType = FieldType.TEXT,
            question = Question("Hva kom du for å gjøre?"),
            value = AnswerValue.Text(taskText)
        ),
        Answer(
            fieldId = "success",
            fieldType = FieldType.SINGLE_CHOICE,
            question = Question("Fikk du gjort det?", options = listOf(
                ChoiceOption("yes", "Ja"),
                ChoiceOption("partial", "Delvis"),
                ChoiceOption("no", "Nei")
            )),
            value = AnswerValue.SingleChoice(success)
        )
    )
    
    if (blocker != null) {
        answers.add(Answer(
            fieldId = "blocker",
            fieldType = FieldType.TEXT,
            question = Question("Hva hindret deg?"),
            value = AnswerValue.Text(blocker)
        ))
    }
    
    return FeedbackDto(
        id = java.util.UUID.randomUUID().toString(),
        submittedAt = java.time.OffsetDateTime.now().toString(),
        app = "test-app",
        surveyId = "survey-discovery",
        surveyType = SurveyType.DISCOVERY,
        answers = answers
    )
}
