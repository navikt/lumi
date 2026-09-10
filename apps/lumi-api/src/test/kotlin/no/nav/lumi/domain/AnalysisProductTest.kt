package no.nav.lumi.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import java.time.LocalDate

class AnalysisProductTest : FunSpec({
    val today = LocalDate.parse("2026-08-29")

    test("normalizes bounded draft metadata without accepting a team field") {
        val validated = AnalysisProductDocumentValidator.validate(
            AnalysisProductDocumentV1(
                name = "  Ukentlig kartlegging  ",
                purpose = "  Analyse av strukturerte svar  ",
                dataOwner = "  data-owner@nav.no  ",
                technicalOwner = "  tech-owner@nav.no  ",
                useCases = listOf(AnalysisProductUseCase.METABASE),
                retention = AnalysisProductRetention.DAYS_90,
                reviewDate = "2027-08-29",
                sources = listOf(
                    AnalysisProductSourceSelection(
                        app = "bro-frontend",
                        surveyId = "kartlegging",
                        fieldIds = listOf("opplevelse"),
                    ),
                ),
                dimensionKeys = listOf(" deviceType "),
            ),
            today,
        )

        validated.document.name shouldBe "Ukentlig kartlegging"
        validated.document.sources.single().app shouldBe "bro-frontend"
        validated.document.sources.single().fieldIds shouldBe listOf("opplevelse")
        validated.document.dimensionKeys shouldBe listOf("deviceType")
        validated.reviewDate shouldBe LocalDate.parse("2027-08-29")
    }

    test("requires review within the next twelve months") {
        shouldThrow<IllegalArgumentException> {
            AnalysisProductDocumentValidator.validate(validDocument(reviewDate = "2027-08-30"), today)
        }
        shouldThrow<IllegalArgumentException> {
            AnalysisProductDocumentValidator.validate(validDocument(reviewDate = "2026-08-28"), today)
        }
    }

    test("rejects duplicate source and field identities") {
        shouldThrow<IllegalArgumentException> {
            AnalysisProductDocumentValidator.validate(
                validDocument(
                    sources = listOf(
                        AnalysisProductSourceSelection("app-a", "survey-a", listOf("field-a", "field-a")),
                    ),
                ),
                today,
            )
        }

        shouldThrow<IllegalArgumentException> {
            AnalysisProductDocumentValidator.validate(
                validDocument(
                    sources = listOf(
                        AnalysisProductSourceSelection("app-a", "survey-a"),
                        AnalysisProductSourceSelection("app-a", "survey-a"),
                    ),
                ),
                today,
            )
        }
    }

    test("accepts bounded opaque source identifiers") {
        val validated = AnalysisProductDocumentValidator.validate(
            validDocument(
                sources = listOf(
                    AnalysisProductSourceSelection(
                        app = " app/flate ",
                        surveyId = "survey:2026",
                        fieldIds = listOf("mål-1"),
                    ),
                ),
            ),
            today,
        )

        validated.document.sources.single() shouldBe
            AnalysisProductSourceSelection(" app/flate ", "survey:2026", listOf("mål-1"))
    }
})

private fun validDocument(
    reviewDate: String = "2027-08-29",
    sources: List<AnalysisProductSourceSelection> = emptyList(),
) = AnalysisProductDocumentV1(
    name = "Kartlegging",
    purpose = "Analyse av strukturerte svar",
    dataOwner = "data-owner@nav.no",
    technicalOwner = "tech-owner@nav.no",
    useCases = listOf(AnalysisProductUseCase.METABASE),
    retention = AnalysisProductRetention.SOURCE_MAXIMUM,
    reviewDate = reviewDate,
    sources = sources,
)
