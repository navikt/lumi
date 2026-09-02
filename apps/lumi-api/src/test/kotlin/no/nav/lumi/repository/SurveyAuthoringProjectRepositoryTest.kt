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
    test("the team list carries each project's newest revision") {
        val repository = SurveyAuthoringProjectRepository()
        val revisions = SurveyAuthoringRevisionRepository()
        val document = buildJsonObject {
            put("authoringSchemaVersion", 1)
            put("type", "custom")
            put("pages", kotlinx.serialization.json.buildJsonArray {
                add(buildJsonObject {
                    put("id", "side-1")
                    put("questions", kotlinx.serialization.json.buildJsonArray {
                        add(buildJsonObject {
                            put("id", "sporsmal")
                            put("type", "text")
                            put("prompt", "Hva vil du fortelle oss?")
                        })
                    })
                })
            })
        }

        val shared = repository.create(
            team = "team-a", name = "Delt", surveyId = "delt-v1", document = document,
            principalIdentity = "A123456", maxProjects = 10,
        )!!
        val draftOnly = repository.create(
            team = "team-a", name = "Bare utkast", surveyId = "utkast-v1", document = document,
            principalIdentity = "A123456", maxProjects = 10,
        )!!
        // Two revisions: the list must expose the newest, not the first.
        revisions.createFromDraft("team-a", java.util.UUID.fromString(shared.id), 1, "A123456", 10)
        repository.updateDraft(
            team = "team-a", id = java.util.UUID.fromString(shared.id), expectedVersion = 1,
            name = "Delt", surveyId = "delt-v1", document = document, principalIdentity = "A123456",
        )
        revisions.createFromDraft("team-a", java.util.UUID.fromString(shared.id), 2, "A123456", 10)

        val byId = repository.findByTeam("team-a").associateBy { it.id }
        byId.getValue(draftOnly.id).latestRevision shouldBe null
        val latest = byId.getValue(shared.id).latestRevision!!
        latest.revisionNumber shouldBe 2
        latest.draftVersion shouldBe 2
        // Team scoping: another team never sees the project at all.
        repository.findByTeam("team-b").isEmpty() shouldBe true
    }
})
