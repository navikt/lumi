package no.nav.lumi.repository

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldNotContain
import kotlinx.serialization.json.JsonPrimitive
import no.nav.lumi.TestDatabase
import no.nav.lumi.createdId
import no.nav.lumi.domain.AnalysisCatalogWarning
import no.nav.lumi.domain.AnalysisFlowStatus
import no.nav.lumi.domain.AnalysisFlowDependencySource
import no.nav.lumi.domain.Answer
import no.nav.lumi.domain.AnswerValue
import no.nav.lumi.domain.FeedbackSubmissionV1
import no.nav.lumi.domain.FieldDefinition
import no.nav.lumi.domain.FieldType
import no.nav.lumi.domain.Question
import no.nav.lumi.domain.RatingVariant
import no.nav.lumi.domain.SURVEY_FLOW_EVALUATOR_VERSION
import no.nav.lumi.domain.SurveyDefinition
import no.nav.lumi.domain.SurveyFlowCombinator
import no.nav.lumi.domain.SurveyFlowCondition
import no.nav.lumi.domain.SurveyFlowConditionSource
import no.nav.lumi.domain.SurveyFlowDefinitionV1
import no.nav.lumi.domain.SurveyFlowFieldDefinition
import no.nav.lumi.domain.SurveyFlowOperator
import no.nav.lumi.domain.SurveyType
import no.nav.lumi.domain.SurveyVisibleIfDefinition
import no.nav.lumi.service.SubmissionService

class AnalysisSourceContractIngestTest : FunSpec({
    val submissionService = SubmissionService()
    val feedbackRepository = FeedbackRepository()
    val catalogRepository = AnalysisSourceCatalogRepository()

    beforeSpec { TestDatabase.initialize() }
    beforeTest { TestDatabase.clearAllData() }

    test("persists an app-scoped immutable flow contract and pins the catalog source") {
        val result = submissionService.submit(
            feedbackJson = payload("key-1234567890123456", includeFlow = true, threshold = 7),
            team = "team-a",
            app = "app-a",
            submission = submission("key-1234567890123456"),
            definition = definition(),
            flow = flow(7),
        )

        val flowHash = result.flowHash!!
        val raw = feedbackRepository.findRawById(result.saveResult.createdId(), "team-a")!!
        raw.feedbackJson shouldNotContain "\"definition\""
        raw.feedbackJson shouldNotContain "\"flow\""

        TestDatabase.dataSource.connection.use { connection ->
            connection.prepareStatement(
                "SELECT flow_hash FROM feedback WHERE id = ?",
            ).use { statement ->
                statement.setString(1, result.saveResult.createdId())
                statement.executeQuery().use { rows ->
                    rows.next() shouldBe true
                    rows.getString(1) shouldBe flowHash
                }
            }
            connection.prepareStatement(
                """
                SELECT count(*)
                FROM analysis_control.analysis_source_contracts
                WHERE team = 'team-a' AND app = 'app-a' AND survey_id = 'survey'
                """.trimIndent(),
            ).use { statement ->
                statement.executeQuery().use { rows ->
                    rows.next() shouldBe true
                    rows.getInt(1) shouldBe 1
                }
            }
            connection.commit()
        }

        val source = catalogRepository.findCatalog("team-a").sources.single()
        source.flowStatus shouldBe AnalysisFlowStatus.PINNED
        source.flowHash shouldBe flowHash
        source.flowHashes shouldBe listOf(flowHash)
        source.observedFlowHashes shouldBe listOf(flowHash)
        source.fields.single { it.fieldId == "details" }.flowDependencies.single().let { dependency ->
            dependency.source shouldBe AnalysisFlowDependencySource.ANSWER
            dependency.key shouldBe "rating"
        }
    }

    test("keeps unpinned history visible as a warning after future rows become pinned") {
        submissionService.submit(
            feedbackJson = payload("legacy-12345678901234", includeFlow = false),
            team = "team-a",
            app = "app-a",
            submission = submission("legacy-12345678901234"),
            definition = definition(),
        )
        val pinned = submissionService.submit(
            feedbackJson = payload("pinned-12345678901234", includeFlow = true, threshold = 7),
            team = "team-a",
            app = "app-a",
            submission = submission("pinned-12345678901234"),
            definition = definition(),
            flow = flow(7),
        )

        val source = catalogRepository.findCatalog("team-a").sources.single()
        source.flowStatus shouldBe AnalysisFlowStatus.PINNED
        source.flowHashes shouldBe listOf(pinned.flowHash!!)
        source.observedFlowHashes shouldBe listOf(null, pinned.flowHash)
        source.warnings shouldContain AnalysisCatalogWarning.LEGACY_FLOW_OBSERVED
    }

    test("regresses the source to unpinned when the latest submission has no flow") {
        val pinned = submissionService.submit(
            feedbackJson = payload("pinned-12345678901234", includeFlow = true, threshold = 7),
            team = "team-a",
            app = "app-a",
            submission = submission("pinned-12345678901234"),
            definition = definition(),
            flow = flow(7),
        )
        val pinnedCatalog = catalogRepository.findCatalog("team-a")

        submissionService.submit(
            feedbackJson = payload("legacy-12345678901234", includeFlow = false),
            team = "team-a",
            app = "app-a",
            submission = submission("legacy-12345678901234"),
            definition = definition(),
        )

        val regressedCatalog = catalogRepository.findCatalog("team-a")
        val source = regressedCatalog.sources.single()
        source.flowStatus shouldBe AnalysisFlowStatus.UNPINNED
        source.flowHash shouldBe null
        source.flowHashes shouldBe listOf(pinned.flowHash!!)
        source.observedFlowHashes shouldBe listOf(null, pinned.flowHash)
        (pinnedCatalog.catalogRevision == regressedCatalog.catalogRevision) shouldBe false
    }

    test("pins every observed known flow revision without overwriting history") {
        val first = submissionService.submit(
            payload("first-123456789012345", includeFlow = true, threshold = 7),
            "team-a",
            "app-a",
            submission("first-123456789012345"),
            definition(),
            flow(7),
        )
        val second = submissionService.submit(
            payload("second-12345678901234", includeFlow = true, threshold = 8),
            "team-a",
            "app-a",
            submission("second-12345678901234"),
            definition(),
            flow(8),
        )

        val source = catalogRepository.findCatalog("team-a").sources.single()
        source.flowStatus shouldBe AnalysisFlowStatus.PINNED
        source.flowHashes shouldBe listOf(first.flowHash!!, second.flowHash!!).sorted()
        source.observedFlowHashes shouldBe source.flowHashes
    }

    test("bounds immutable revisions and keeps overflow feedback unpinned") {
        var overflowFlowHash: String? = "not-run"
        repeat(AnalysisSourceContractRepository.MAX_FLOW_REVISIONS_PER_SOURCE_DEFINITION + 1) { index ->
            val deduplicationKey = "quota-${index.toString().padStart(20, '0')}"
            val value = "segment-$index"
            overflowFlowHash = submissionService.submit(
                feedbackJson = metadataPayload(deduplicationKey, value),
                team = "team-a",
                app = "app-a",
                submission = submission(deduplicationKey),
                definition = definition(),
                flow = metadataFlow(value),
            ).flowHash
        }

        overflowFlowHash shouldBe null
        val source = catalogRepository.findCatalog("team-a").sources.single()
        source.flowStatus shouldBe AnalysisFlowStatus.UNPINNED
        source.flowHashes.size shouldBe
            AnalysisSourceContractRepository.MAX_FLOW_REVISIONS_PER_SOURCE_DEFINITION

        TestDatabase.dataSource.connection.use { connection ->
            connection.prepareStatement(
                "SELECT count(*) FROM analysis_control.analysis_source_contracts",
            ).use { statement ->
                statement.executeQuery().use { rows ->
                    rows.next() shouldBe true
                    rows.getInt(1) shouldBe
                        AnalysisSourceContractRepository.MAX_FLOW_REVISIONS_PER_SOURCE_DEFINITION
                }
            }
            connection.commit()
        }
    }

    test("keeps an oversized normalized flow contract unpinned") {
        val deduplicationKey = "oversized-1234567890123"
        val result = submissionService.submit(
            feedbackJson = payload(deduplicationKey, includeFlow = true),
            team = "team-a",
            app = "app-a",
            submission = submission(deduplicationKey),
            definition = definition(),
            flow = oversizedFlow(),
        )

        result.flowHash shouldBe null
        catalogRepository.findCatalog("team-a").sources.single().flowStatus shouldBe
            AnalysisFlowStatus.UNPINNED

        TestDatabase.dataSource.connection.use { connection ->
            connection.prepareStatement(
                "SELECT count(*) FROM analysis_control.analysis_source_contracts",
            ).use { statement ->
                statement.executeQuery().use { rows ->
                    rows.next() shouldBe true
                    rows.getInt(1) shouldBe 0
                }
            }
            connection.commit()
        }
    }

    test("removes materialized observations when retained feedback is deleted") {
        val created = submissionService.submit(
            payload("delete-12345678901234", includeFlow = true, threshold = 7),
            "team-a",
            "app-a",
            submission("delete-12345678901234"),
            definition(),
            flow(7),
        )

        feedbackRepository.delete(created.saveResult.createdId(), "team-a") shouldBe true

        val source = catalogRepository.findCatalog("team-a").sources.single()
        source.flowStatus shouldBe AnalysisFlowStatus.UNPINNED
        source.flowHash shouldBe null
        source.flowHashes shouldBe emptyList()
        source.observedFlowHashes shouldBe emptyList()

        TestDatabase.dataSource.connection.use { connection ->
            connection.prepareStatement(
                "SELECT count(*) FROM analysis_control.analysis_source_contracts",
            ).use { statement ->
                statement.executeQuery().use { rows ->
                    rows.next() shouldBe true
                    rows.getInt(1) shouldBe 0
                }
            }
            connection.commit()
        }
    }

    test("retains a contract until its final referenced feedback row is deleted") {
        val first = submissionService.submit(
            payload("first-123456789012345", includeFlow = true, threshold = 7),
            "team-a",
            "app-a",
            submission("first-123456789012345"),
            definition(),
            flow(7),
        )
        val second = submissionService.submit(
            payload("second-12345678901234", includeFlow = true, threshold = 7),
            "team-a",
            "app-a",
            submission("second-12345678901234"),
            definition(),
            flow(7),
        )

        feedbackRepository.delete(second.saveResult.createdId(), "team-a") shouldBe true
        catalogRepository.findCatalog("team-a").sources.single().flowHash shouldBe first.flowHash

        feedbackRepository.delete(first.saveResult.createdId(), "team-a") shouldBe true
        catalogRepository.findCatalog("team-a").sources.single().flowHash shouldBe null
    }
})

private fun definition() = SurveyDefinition(
    surveyId = "survey",
    surveyType = SurveyType.CUSTOM,
    fields = listOf(
        FieldDefinition("rating", FieldType.RATING, RatingVariant.NPS, 11, null),
        FieldDefinition("details", FieldType.TEXT, null, null, null),
    ),
)

private fun flow(threshold: Int) = SurveyFlowDefinitionV1(
    schemaVersion = 1,
    evaluatorVersion = SURVEY_FLOW_EVALUATOR_VERSION,
    fields = listOf(
        SurveyFlowFieldDefinition("rating"),
        SurveyFlowFieldDefinition(
            "details",
            SurveyVisibleIfDefinition(
                SurveyFlowCombinator.ALL,
                listOf(
                    SurveyFlowCondition(
                        SurveyFlowConditionSource.ANSWER,
                        "rating",
                        SurveyFlowOperator.LT,
                        JsonPrimitive(threshold),
                    ),
                ),
            ),
        ),
    ),
)

private fun metadataFlow(value: String) = SurveyFlowDefinitionV1(
    schemaVersion = 1,
    evaluatorVersion = SURVEY_FLOW_EVALUATOR_VERSION,
    fields = listOf(
        SurveyFlowFieldDefinition("rating"),
        SurveyFlowFieldDefinition(
            "details",
            SurveyVisibleIfDefinition(
                SurveyFlowCombinator.ALL,
                listOf(
                    SurveyFlowCondition(
                        SurveyFlowConditionSource.METADATA,
                        "customSegment",
                        SurveyFlowOperator.EQ,
                        JsonPrimitive(value),
                    ),
                ),
            ),
        ),
    ),
)

private fun oversizedFlow() = SurveyFlowDefinitionV1(
    schemaVersion = 1,
    evaluatorVersion = SURVEY_FLOW_EVALUATOR_VERSION,
    fields = listOf(
        SurveyFlowFieldDefinition("rating"),
        SurveyFlowFieldDefinition(
            "details",
            SurveyVisibleIfDefinition(
                SurveyFlowCombinator.ALL,
                List(50) { index ->
                    SurveyFlowCondition(
                        SurveyFlowConditionSource.METADATA,
                        "customSegment$index",
                        SurveyFlowOperator.EQ,
                        JsonPrimitive(index.toString().padStart(2, '0') + "x".repeat(2_046)),
                    )
                },
            ),
        ),
    ),
)

private fun submission(deduplicationKey: String) = FeedbackSubmissionV1(
    schemaVersion = 2,
    surveyId = "survey",
    surveyType = SurveyType.CUSTOM,
    submittedAt = "2026-08-29T12:00:00Z",
    deduplicationKey = deduplicationKey,
    answers = listOf(
        Answer(
            fieldId = "rating",
            fieldType = FieldType.RATING,
            question = Question("Rating"),
            value = AnswerValue.Rating(5, RatingVariant.NPS, 11),
        ),
    ),
)

private fun payload(deduplicationKey: String, includeFlow: Boolean, threshold: Int = 7): String = """
    {
      "schemaVersion": 2,
      "surveyId": "survey",
      "surveyType": "custom",
      "submittedAt": "2026-08-29T12:00:00Z",
      "deduplicationKey": "$deduplicationKey",
      "definition": {
        "surveyType": "custom",
        "fields": [
          {"fieldId": "rating", "fieldType": "RATING", "ratingVariant": "nps", "ratingScale": 11},
          {"fieldId": "details", "fieldType": "TEXT"}
        ]
      },
      ${if (includeFlow) """
      "flow": {
        "schemaVersion": 1,
        "evaluatorVersion": "visible-if-v1",
        "fields": [
          {"fieldId": "rating"},
          {
            "fieldId": "details",
            "visibleIf": {
              "combinator": "ALL",
              "conditions": [
                {"source": "ANSWER", "key": "rating", "operator": "LT", "value": $threshold}
              ]
            }
          }
        ]
      },
      """ else ""}
      "answers": [
        {
          "fieldId": "rating",
          "fieldType": "RATING",
          "question": {"label": "Rating"},
          "value": {"type": "rating", "rating": 5, "ratingVariant": "nps", "ratingScale": 11}
        }
      ]
    }
""".trimIndent()

private fun metadataPayload(deduplicationKey: String, value: String): String = """
    {
      "schemaVersion": 2,
      "surveyId": "survey",
      "surveyType": "custom",
      "submittedAt": "2026-08-29T12:00:00Z",
      "deduplicationKey": "$deduplicationKey",
      "definition": {
        "surveyType": "custom",
        "fields": [
          {"fieldId": "rating", "fieldType": "RATING", "ratingVariant": "nps", "ratingScale": 11},
          {"fieldId": "details", "fieldType": "TEXT"}
        ]
      },
      "flow": {
        "schemaVersion": 1,
        "evaluatorVersion": "visible-if-v1",
        "fields": [
          {"fieldId": "rating"},
          {
            "fieldId": "details",
            "visibleIf": {
              "combinator": "ALL",
              "conditions": [
                {"source": "METADATA", "key": "customSegment", "operator": "EQ", "value": "$value"}
              ]
            }
          }
        ]
      },
      "answers": [
        {
          "fieldId": "rating",
          "fieldType": "RATING",
          "question": {"label": "Rating"},
          "value": {"type": "rating", "rating": 5, "ratingVariant": "nps", "ratingScale": 11}
        }
      ]
    }
""".trimIndent()
