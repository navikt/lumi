package no.nav.lumi.repository

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import no.nav.lumi.TestDatabase

class SurveyAuthoringProjectRepositoryTest : FunSpec({
    beforeSpec { TestDatabase.initialize() }
    beforeTest { TestDatabase.clearAllData() }

    test("project limit is enforced per team") {
        val repository = SurveyAuthoringProjectRepository()
        val document = buildJsonObject {
            put("authoringSchemaVersion", 1)
            put("pages", kotlinx.serialization.json.buildJsonArray {})
        }

        repository.create(
            team = "team-a",
            name = "First",
            surveyId = "survey-1",
            document = document,
            principalIdentity = "A123456",
            maxProjects = 1,
        )?.draftVersion shouldBe 1

        repository.create(
            team = "team-a",
            name = "Second",
            surveyId = "survey-2",
            document = document,
            principalIdentity = "A123456",
            maxProjects = 1,
        ) shouldBe null

        repository.create(
            team = "team-b",
            name = "Other team",
            surveyId = "survey-1",
            document = document,
            principalIdentity = "B123456",
            maxProjects = 1,
        )?.team shouldBe "team-b"
    }
})
