package no.nav.lumi.routes

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import no.nav.lumi.TestDatabase
import no.nav.lumi.createTestClient
import no.nav.lumi.domain.AnalysisContractPreviewStatus
import no.nav.lumi.domain.AnalysisCompilationIssueCode
import no.nav.lumi.domain.FieldDefinition
import no.nav.lumi.domain.FieldType
import no.nav.lumi.domain.AnalysisProductContractPreviewV2
import no.nav.lumi.domain.AnalysisProductDocumentV1
import no.nav.lumi.domain.AnalysisProductRetention
import no.nav.lumi.domain.AnalysisProductSourceSelection
import no.nav.lumi.domain.AnalysisProductUseCase
import no.nav.lumi.domain.AnalysisSourceCatalogV1
import no.nav.lumi.domain.RatingVariant
import no.nav.lumi.domain.SurveyDefinition
import no.nav.lumi.domain.SurveyType
import no.nav.lumi.domain.computeHash
import no.nav.lumi.repository.AnalysisProductRepository
import no.nav.lumi.repository.FeedbackRepository
import no.nav.lumi.repository.SurveyDefinitionRepository
import no.nav.lumi.testModule
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset

class AnalysisProductRoutesTest : FunSpec({
    beforeSpec { TestDatabase.initialize() }
    beforeTest { TestDatabase.clearAllData() }

    test("catalog requires authentication and derives team only from authorization") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            client.get("/api/v1/intern/analysis-products/catalog?team=team-test").status shouldBe
                HttpStatusCode.Unauthorized

            client.get("/api/v1/intern/analysis-products/catalog?team=not-authorized") {
                header(HttpHeaders.Authorization, "Bearer token")
            }.status shouldBe HttpStatusCode.Forbidden

            val response = client.get("/api/v1/intern/analysis-products/catalog?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer token")
            }
            response.status shouldBe HttpStatusCode.OK
            response.body<AnalysisSourceCatalogV1>().team shouldBe "team-test"
        }
    }

    test("preview returns the same not found response for a foreign and random product") {
        val foreign = createProduct("flex")

        testApplication {
            application { testModule() }
            val client = createTestClient()

            val foreignResponse = client.get(
                "/api/v1/intern/analysis-products/${foreign.id}/preview?team=team-test",
            ) {
                header(HttpHeaders.Authorization, "Bearer token")
            }
            val randomResponse = client.get(
                "/api/v1/intern/analysis-products/00000000-0000-0000-0000-000000000099/preview?team=team-test",
            ) {
                header(HttpHeaders.Authorization, "Bearer token")
            }

            foreignResponse.status shouldBe HttpStatusCode.NotFound
            randomResponse.status shouldBe HttpStatusCode.NotFound
            foreignResponse.body<String>() shouldBe randomResponse.body<String>()
        }
    }

    test("preview is synthetic and blocked while flow provenance is missing") {
        registerSource("team-test")
        val product = createProduct("team-test")

        testApplication {
            application { testModule() }
            val response = createTestClient().get(
                "/api/v1/intern/analysis-products/${product.id}/preview?team=team-test",
            ) {
                header(HttpHeaders.Authorization, "Bearer token")
            }

            response.status shouldBe HttpStatusCode.OK
            val preview = response.body<AnalysisProductContractPreviewV2>()
            preview.status shouldBe AnalysisContractPreviewStatus.BLOCKED
            preview.issues.map { it.code } shouldBe listOf(AnalysisCompilationIssueCode.FLOW_NOT_PINNED)
            preview.aggregatePreviewAvailable shouldBe false
            preview.publicationSpecification shouldBe null
        }
    }
})

private suspend fun createProduct(team: String) =
    (AnalysisProductRepository(
        Clock.fixed(Instant.parse("2026-08-29T12:00:00Z"), ZoneOffset.UTC),
    ).create(
        team = team,
        document = AnalysisProductDocumentV1(
            name = "Analysis",
            purpose = "Safe analysis",
            dataOwner = "A123456",
            technicalOwner = "A123456",
            useCases = listOf(AnalysisProductUseCase.METABASE),
            retention = AnalysisProductRetention.SOURCE_MAXIMUM,
            reviewDate = "2027-08-29",
            sources = listOf(AnalysisProductSourceSelection("app", "survey", listOf("field"))),
        ),
        principalIdentity = "A123456",
    ) as no.nav.lumi.repository.CreateAnalysisProductResult.Created).product

private suspend fun registerSource(team: String) {
    val definition = SurveyDefinition(
        surveyId = "survey",
        surveyType = SurveyType.CUSTOM,
        fields = listOf(
            FieldDefinition(
                fieldId = "field",
                fieldType = FieldType.RATING,
                ratingVariant = RatingVariant.NPS,
                ratingScale = 11,
                optionIds = null,
            ),
        ),
    )
    val hash = definition.computeHash()
    SurveyDefinitionRepository().insertApiDefinitionIfUnderLimit(team, definition, hash, 500)
    FeedbackRepository().save(
        feedbackJson = """
            {
              "schemaVersion": 2,
              "surveyId": "survey",
              "surveyType": "custom",
              "answers": []
            }
        """.trimIndent(),
        team = team,
        app = "app",
        surveyId = "survey",
        definitionHash = hash,
    )
}
