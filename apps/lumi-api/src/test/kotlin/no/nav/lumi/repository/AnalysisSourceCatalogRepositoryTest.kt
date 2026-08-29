package no.nav.lumi.repository

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import no.nav.lumi.TestDatabase
import no.nav.lumi.domain.AnalysisCatalogWarning
import no.nav.lumi.domain.AnalysisDefinitionStatus
import no.nav.lumi.domain.AnalysisFlowStatus

class AnalysisSourceCatalogRepositoryTest : FunSpec({
    val repository = AnalysisSourceCatalogRepository()
    val feedbackRepository = FeedbackRepository()

    beforeSpec { TestDatabase.initialize() }
    beforeTest { TestDatabase.clearAllData() }

    test("keeps catalog SQL scoped by team even when source identities are equal") {
        insertDefinition("team-a", "survey", "a".repeat(64), "field-a")
        insertDefinition("team-b", "survey", "b".repeat(64), "field-b")
        feedbackRepository.save(feedbackJson("survey", "secret label A"), "team-a", "same-app", "survey", "a".repeat(64))
        feedbackRepository.save(feedbackJson("survey", "secret label B"), "team-b", "same-app", "survey", "b".repeat(64))

        val teamA = repository.findCatalog("team-a")
        val serialized = no.nav.lumi.domain.AnalysisContractJson.encodeToString(
            no.nav.lumi.domain.AnalysisSourceCatalogV1.serializer(),
            teamA,
        )

        teamA.sources.single().fields.single().fieldId shouldBe "field-a"
        serialized.contains("field-b") shouldBe false
        serialized.contains("secret label A") shouldBe false
        serialized.contains("secret label B") shouldBe false
        serialized.contains("b".repeat(64)) shouldBe false
    }

    test("keeps the same survey ID in two apps as separate stable sources") {
        insertDefinition("team-a", "survey", "a".repeat(64), "field")
        feedbackRepository.save(feedbackJson("survey"), "team-a", "app-a", "survey", "a".repeat(64))
        feedbackRepository.save(feedbackJson("survey"), "team-a", "app-b", "survey", "a".repeat(64))

        val catalog = repository.findCatalog("team-a")

        catalog.sources.map { it.app to it.surveyId } shouldBe listOf(
            "app-a" to "survey",
            "app-b" to "survey",
        )
    }

    test("source identity survives deletion of the last feedback row") {
        insertDefinition("team-a", "survey", "a".repeat(64), "field")
        val created = feedbackRepository.save(
            feedbackJson("survey"),
            "team-a",
            "app-a",
            "survey",
            "a".repeat(64),
        )
        val id = (created as no.nav.lumi.domain.SaveResult.Created).id

        feedbackRepository.delete(id, "team-a") shouldBe true

        val source = repository.findCatalog("team-a").sources.single()
        source.app shouldBe "app-a"
        source.surveyId shouldBe "survey"
        source.observedDefinitionHashes shouldBe emptyList()
    }

    test("catalog revision ignores new rows with the same contract but changes for a new observed hash") {
        insertDefinition("team-a", "survey", "a".repeat(64), "field")
        feedbackRepository.save(feedbackJson("survey"), "team-a", "app-a", "survey", "a".repeat(64))
        val first = repository.findCatalog("team-a")

        feedbackRepository.save(feedbackJson("survey"), "team-a", "app-a", "survey", "a".repeat(64))
        val second = repository.findCatalog("team-a")

        feedbackRepository.save(feedbackJson("survey"), "team-a", "app-a", "survey", "c".repeat(64))
        val third = repository.findCatalog("team-a")

        second.catalogRevision shouldBe first.catalogRevision
        third.catalogRevision shouldNotBe first.catalogRevision
        third.sources.single().warnings shouldContain AnalysisCatalogWarning.HISTORICAL_DEFINITION_UNRESOLVED
    }

    test("reports untrusted structural and source mismatches without reconstructing flow") {
        insertDefinition("team-a", "survey-column", "a".repeat(64), "field", source = "auto")
        feedbackRepository.save(
            feedbackJson("survey-json"),
            "team-a",
            "app-a",
            "survey-column",
            null,
        )

        val source = repository.findCatalog("team-a").sources.single()

        source.definitionStatus shouldBe AnalysisDefinitionStatus.AUTO_DERIVED
        source.flowStatus shouldBe AnalysisFlowStatus.UNPINNED
        source.observedDefinitionHashes shouldBe listOf(null)
        source.warnings shouldContain AnalysisCatalogWarning.LEGACY_DEFINITION_OBSERVED
        source.warnings shouldContain AnalysisCatalogWarning.SOURCE_ID_MISMATCH
    }
})

private fun insertDefinition(
    team: String,
    surveyId: String,
    hash: String,
    fieldId: String,
    source: String = "api",
) {
    TestDatabase.dataSource.connection.use { connection ->
        connection.prepareStatement(
            """
            INSERT INTO survey_definitions (
                id, team, survey_id, definition_hash, definition, source,
                last_submission_at, definition_retention_at
            )
            VALUES (
                gen_random_uuid(), ?, ?, ?, ?::jsonb, ?,
                clock_timestamp(), clock_timestamp() + interval '18 months'
            )
            """.trimIndent(),
        ).use { statement ->
            statement.setString(1, team)
            statement.setString(2, surveyId)
            statement.setString(3, hash)
            statement.setString(
                4,
                """
                {
                  "surveyId": "$surveyId",
                  "surveyType": "custom",
                  "fields": [{
                    "fieldId": "$fieldId",
                    "fieldType": "RATING",
                    "ratingVariant": "nps",
                    "ratingScale": 11,
                    "optionIds": null,
                    "maxSelections": null
                  }]
                }
                """.trimIndent(),
            )
            statement.setString(5, source)
            statement.executeUpdate()
        }
        connection.commit()
    }
}

private fun feedbackJson(surveyId: String, label: String = "untrusted question label") =
    """
    {
      "schemaVersion": 2,
      "surveyId": "$surveyId",
      "surveyType": "custom",
      "submittedAt": "2026-08-29T12:00:00Z",
      "answers": [{
        "fieldId": "field",
        "fieldType": "RATING",
        "question": {"label": "$label"},
        "value": {"type": "rating", "rating": 0, "ratingVariant": "nps", "ratingScale": 11}
      }]
    }
    """.trimIndent()
