package no.nav.lumi.repository

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import no.nav.lumi.TestDatabase
import no.nav.lumi.domain.*
import no.nav.lumi.service.AnalysisProductPreviewService
import no.nav.lumi.service.SubmissionService
import java.nio.file.Files
import java.nio.file.Path
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.util.UUID

class AnalysisFlatProjectionReleaseTest : FunSpec({
    beforeSpec { TestDatabase.initialize() }
    beforeTest { TestDatabase.clearAllData() }

    test("stored immutable release produces consistent synthetic tables without activating delivery") {
        val team = "team-test"
        val definition = SurveyDefinition("synthetic-survey", SurveyType.CUSTOM, listOf(
            FieldDefinition("score", FieldType.RATING, RatingVariant.NPS, 11, null),
            FieldDefinition("channels", FieldType.MULTI_CHOICE, null, null, listOf("web", "phone"), 2),
        ))
        val flow = SurveyFlowDefinitionV1(1, SURVEY_FLOW_EVALUATOR_VERSION,
            definition.fields.map { SurveyFlowFieldDefinition(it.fieldId) })
        val submission = FeedbackSubmissionV1(schemaVersion = 2, surveyId = definition.surveyId, surveyType = definition.surveyType,
            submittedAt = "2026-09-01T12:00:00Z", answers = listOf(
                Answer("score", FieldType.RATING, Question("Client label canary"), AnswerValue.Rating(5, RatingVariant.NPS, 11)),
            ))
        SubmissionService().submit(AnalysisContractJson.encodeToString(submission), team, "synthetic-app", submission, definition, flow)
        val document = AnalysisProductDocumentV1(name = "Synthetic flat rehearsal", purpose = "Verify the release-to-table contract",
            dataOwner = "A123456", technicalOwner = "A123456", useCases = listOf(AnalysisProductUseCase.METABASE),
            retention = AnalysisProductRetention.DAYS_90, reviewDate = LocalDate.now(ZoneOffset.UTC).plusMonths(6).toString(),
            sources = listOf(AnalysisProductSourceSelection("synthetic-app", definition.surveyId, listOf("score", "channels"))))
        val repository = AnalysisProductRepository()
        val product = (repository.create(team, document, "A123456") as CreateAnalysisProductResult.Created).product
        val id = UUID.fromString(product.id)
        val preview = AnalysisProductPreviewService().preview(team, id)!!
        preview.status shouldBe AnalysisContractPreviewStatus.READY
        val confirmation = PublishAnalysisProductReleaseRequest(preview.draftId, preview.draftRevision, preview.documentHash,
            preview.catalogRevision, checkNotNull(preview.publicationSpecificationDigest))
        repository.publishRelease(team, id, confirmation, "A123456") as PublishAnalysisProductReleaseResult.Published
        val stored = repository.findReleases(team, id)!!.single()
        val specification = AnalysisContractJson.decodeFromJsonElement<AnalysisPublicationSpecificationV2>(stored.publicationSpecification)
        stored.publicationSpecificationDigest shouldBe preview.publicationSpecificationDigest

        // Only the local resolver input is enabled; the persisted product stays DRAFT.
        val scope = (AnalysisEffectivePublicationPlanResolver.resolve(
            AnalysisPublicationControlState(product.id, team, AnalysisProductLifecycleState.ENABLED, 1, null, null),
            listOf(AnalysisPublicationReleaseV2(1, specification, stored.publicationSpecificationDigest)),
        ) as AnalysisPublicationPlan.Enabled).maintainedTarget
        val facts = listOf(
            mapOf("score" to AnalysisStructuredValue.Rating(0), "channels" to AnalysisStructuredValue.Choices(listOf("web", "phone"))),
            mapOf("score" to AnalysisStructuredValue.Rating(10), "channels" to AnalysisStructuredValue.Choices(emptyList())),
            emptyMap(),
        ).mapIndexed { index, answers ->
            AnalysisProjectionSubmission("private-synthetic-ref-$index", team, "synthetic-app", definition.surveyId,
                Instant.parse("2026-09-01T12:00:00Z").plusSeconds(index.toLong()), definition.computeHash(), flow.computeHash(), answers)
        }
        // Fixed fake keys make the report inspectable; no production key algorithm is supplied.
        val fakeKeys = object : AnalysisProjectionKeys {
            override fun responseKey(productId: String, snapshotRowRef: String) = "synthetic-response-${facts.indexOfFirst { it.snapshotRowRef == snapshotRowRef }}"
            override fun answerKey(productId: String, snapshotRowRef: String, fieldId: String) = "${responseKey(productId, snapshotRowRef)}-$fieldId"
        }
        val context = AnalysisProjectionContext("synthetic-candidate", Instant.parse("2026-09-09T12:00:00Z"), Instant.parse("2026-01-01T00:00:00Z"))
        val candidate = AnalysisFlatProjector().project(scope, context, facts, listOf(AnalysisProjectionContract(team, "synthetic-app", definition, flow)), fakeKeys)
        val wide = candidate.tables.single { it.schema.kind == AnalysisResourceKind.WIDE }
        val long = candidate.tables.single { it.schema.kind == AnalysisResourceKind.LONG }
        val catalog = candidate.tables.single { it.schema.kind == AnalysisResourceKind.FIELD_CATALOG }
        wide.schema shouldBe preview.resources.single { it.kind == AnalysisResourceKind.WIDE }.copy(syntheticRows = emptyList())
        wide.rows.size shouldBe 3
        long.rows.size shouldBe 5
        catalog.rows.size shouldBe 4
        val wideRatings = wide.rows.mapNotNull { it[AnalysisPhysicalNames.fieldColumn("score", "rating")]?.jsonPrimitive?.intOrNull }
        val longRatings = long.rows.mapNotNull { it["rating_value"]?.jsonPrimitive?.intOrNull }
        wideRatings shouldBe listOf(0, 10)
        wideRatings.average() shouldBe longRatings.average()
        wideRatings.average() shouldBe 5.0
        long.rows.map { it["response_key"] }.toSet() shouldBe wide.rows.take(2).map { it["response_key"] }.toSet()
        candidate.tables.flatMap { it.rows }.toString().contains("canary") shouldBe false
        candidate.tables.flatMap { it.rows }.toString().contains("private-synthetic-ref") shouldBe false
        val unchanged = repository.findById(team, id)!!
        unchanged.lifecycleState shouldBe AnalysisProductLifecycleState.DRAFT
        unchanged.activeReleaseNumber shouldBe null
        unchanged.desiredReleaseNumber shouldBe null
        repository.findAuditEvents(team, id)!!.map { it.eventType } shouldBe listOf(
            AnalysisProductAuditEventType.PRODUCT_CREATED, AnalysisProductAuditEventType.DRAFT_VALIDATED, AnalysisProductAuditEventType.RELEASE_PUBLISHED)

        // Disposable build report, never an export artifact or publication manifest.
        val report = buildJsonObject {
            put("synthetic", true)
            put("activated", false)
            put("description", "Local candidate from a stored release. No source transport or production keys.")
            put("specificationDigest", stored.publicationSpecificationDigest)
            putJsonArray("tables") {
                candidate.tables.forEach { table -> add(buildJsonObject {
                    put("schema", AnalysisContractJson.encodeToJsonElement(table.schema))
                    put("rows", JsonArray(table.rows))
                }) }
            }
            putJsonObject("checks") {
                put("responseCount", wide.rows.size)
                put("answeredRatingCount", wideRatings.size)
                put("meanRating", wideRatings.average())
                put("wideLongConsistent", true)
            }
        }
        val reportDirectory = Path.of("build", "reports", "analysis-projection")
        Files.createDirectories(reportDirectory)
        Files.writeString(reportDirectory.resolve("candidate.json"), projectionReportJson.encodeToString(report))
    }
})

private val projectionReportJson = Json { prettyPrint = true }
