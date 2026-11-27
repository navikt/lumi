package no.nav.lumi.repository

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import no.nav.lumi.TestDatabase
import no.nav.lumi.domain.SurveyAuthoringPresentation
import no.nav.lumi.domain.SurveyDisplayMode

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
            presentation = SurveyAuthoringPresentation.FLOATING_PANEL,
            principalIdentity = "A123456",
            maxProjects = 1,
        )?.draftVersion shouldBe 1

        repository.create(
            team = "team-a",
            name = "Second",
            surveyId = "survey-2",
            document = document,
            presentation = SurveyAuthoringPresentation.FLOATING_PANEL,
            principalIdentity = "A123456",
            maxProjects = 1,
        ) shouldBe null

        repository.create(
            team = "team-b",
            name = "Other team",
            surveyId = "survey-1",
            document = document,
            presentation = SurveyAuthoringPresentation.FLOATING_PANEL,
            principalIdentity = "B123456",
            maxProjects = 1,
        )?.team shouldBe "team-b"
    }
    test("a project stored before the presentation columns existed is the floating panel") {
        val repository = SurveyAuthoringProjectRepository()
        // The row names no presentation column, as every row did before the
        // migration: the column defaults decide.
        val id = TestDatabase.dataSource.connection.use { connection ->
            val inserted = connection.prepareStatement(
                """
                    INSERT INTO survey_authoring_projects
                        (team, name, survey_id, draft, created_by, updated_by)
                    VALUES ('team-a', 'Eldre utkast', 'eldre-v1',
                        '{"authoringSchemaVersion": 1, "pages": []}'::jsonb, 'A123456', 'A123456')
                    RETURNING id
                """.trimIndent(),
            ).use { statement ->
                statement.executeQuery().use { result ->
                    result.next()
                    result.getObject("id", java.util.UUID::class.java)
                }
            }
            connection.commit()
            inserted
        }

        repository.findById("team-a", id)!!.presentation shouldBe
            SurveyAuthoringPresentation(SurveyDisplayMode.DOCK, null)
    }

    test("the database accepts only the two display modes and no blank placement note") {
        val repository = SurveyAuthoringProjectRepository()
        val document = buildJsonObject {
            put("authoringSchemaVersion", 1)
            put("pages", kotlinx.serialization.json.buildJsonArray {})
        }
        val project = repository.create(
            team = "team-a",
            name = "Utkast",
            surveyId = "utkast-v1",
            document = document,
            presentation = SurveyAuthoringPresentation(SurveyDisplayMode.INLINE, "Under resultatlisten"),
            principalIdentity = "A123456",
            maxProjects = 10,
        )!!
        project.presentation shouldBe
            SurveyAuthoringPresentation(SurveyDisplayMode.INLINE, "Under resultatlisten")

        fun update(assignment: String): String? = TestDatabase.dataSource.connection.use { connection ->
            try {
                connection.prepareStatement(
                    "UPDATE survey_authoring_projects SET $assignment WHERE id = ?::uuid",
                ).use { statement ->
                    statement.setString(1, project.id)
                    statement.executeUpdate()
                }
                connection.commit()
                null
            } catch (exception: java.sql.SQLException) {
                connection.rollback()
                exception.message
            }
        }

        update("display_mode = 'popup'")!!.contains("chk_survey_authoring_display_mode") shouldBe true
        update("placement_note = '   '")!!.contains("chk_survey_authoring_placement_note") shouldBe true
        update("placement_note = NULL") shouldBe null
    }

    test("a revision shared by an API from before the presentation columns gets the project's choice") {
        val repository = SurveyAuthoringProjectRepository()
        val document = buildJsonObject {
            put("authoringSchemaVersion", 1)
            put("pages", kotlinx.serialization.json.buildJsonArray {})
        }
        val project = repository.create(
            team = "team-a", name = "Ved innholdet", surveyId = "inline-v1", document = document,
            presentation = SurveyAuthoringPresentation(SurveyDisplayMode.INLINE, "Under resultatlisten"),
            principalIdentity = "A123456", maxProjects = 10,
        )!!

        // An instance from before V29 can run beside the new one during a
        // rollout, or alone after a rollback. Its insert names none of the
        // presentation columns. `explicit` is what the API from V29 on adds.
        fun share(revisionNumber: Long, draftVersion: Long, explicit: String = ""): Any =
            TestDatabase.dataSource.connection.use { connection ->
                val columns = if (explicit.isEmpty()) "" else ", display_mode, placement_note"
                try {
                    val id = connection.prepareStatement(
                        """
                            INSERT INTO survey_authoring_revisions
                                (project_id, revision_number, draft_version, name, survey_id, document,
                                 document_hash, definition, definition_hash, created_by$columns)
                            VALUES (?::uuid, ?, ?, 'Ved innholdet', 'inline-v1',
                                '{"authoringSchemaVersion": 1, "pages": []}'::jsonb,
                                repeat('a', 64), '{}'::jsonb, repeat('b', 64), 'A123456'$explicit)
                            RETURNING id
                        """.trimIndent(),
                    ).use { statement ->
                        statement.setString(1, project.id)
                        statement.setLong(2, revisionNumber)
                        statement.setLong(3, draftVersion)
                        statement.executeQuery().use { result ->
                            result.next()
                            result.getString("id")
                        }
                    }
                    connection.commit()
                    id
                } catch (exception: java.sql.SQLException) {
                    connection.rollback()
                    exception
                }
            }

        fun presentationOf(revisionId: Any): Pair<String, String?> =
            TestDatabase.dataSource.connection.use { connection ->
                connection.prepareStatement(
                    "SELECT display_mode, placement_note FROM survey_authoring_revisions WHERE id = ?::uuid",
                ).use { statement ->
                    statement.setString(1, revisionId as String)
                    statement.executeQuery().use { result ->
                        result.next()
                        result.getString("display_mode") to result.getString("placement_note")
                    }
                }
            }

        // The old insert copies the choice from the project, not 'dock'.
        presentationOf(share(revisionNumber = 1, draftVersion = 1)) shouldBe
            ("inline" to "Under resultatlisten")

        // A draft saved in the meantime has another version, and its choice
        // may not belong to the document that was shared.
        val changed = share(revisionNumber = 2, draftVersion = 2) as java.sql.SQLException
        changed.sqlState shouldBe "40001"

        // Values the insert sets itself are kept.
        presentationOf(share(revisionNumber = 2, draftVersion = 1, explicit = ", 'dock', NULL")) shouldBe
            ("dock" to null)
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
            presentation = SurveyAuthoringPresentation.FLOATING_PANEL,
            principalIdentity = "A123456", maxProjects = 10,
        )!!
        val draftOnly = repository.create(
            team = "team-a", name = "Bare utkast", surveyId = "utkast-v1", document = document,
            presentation = SurveyAuthoringPresentation.FLOATING_PANEL,
            principalIdentity = "A123456", maxProjects = 10,
        )!!
        // Two revisions: the list must expose the newest, not the first.
        revisions.createFromDraft("team-a", java.util.UUID.fromString(shared.id), 1, "A123456", 10)
        repository.updateDraft(
            team = "team-a", id = java.util.UUID.fromString(shared.id), expectedVersion = 1,
            name = "Delt", surveyId = "delt-v1", document = document,
            presentation = null, principalIdentity = "A123456",
        )
        revisions.createFromDraft("team-a", java.util.UUID.fromString(shared.id), 2, "A123456", 10)

        // A third project with a single revision: the global ordering by
        // revision number must still pick each project's own newest row.
        val once = repository.create(
            team = "team-a", name = "Delt en gang", surveyId = "en-gang-v1", document = document,
            presentation = SurveyAuthoringPresentation.FLOATING_PANEL,
            principalIdentity = "A123456", maxProjects = 10,
        )!!
        revisions.createFromDraft("team-a", java.util.UUID.fromString(once.id), 1, "A123456", 10)

        val byId = repository.findByTeam("team-a").associateBy { it.id }
        byId.getValue(draftOnly.id).latestRevision shouldBe null
        val latest = byId.getValue(shared.id).latestRevision!!
        latest.revisionNumber shouldBe 2
        latest.draftVersion shouldBe 2
        byId.getValue(once.id).latestRevision!!.revisionNumber shouldBe 1
        // Team scoping: another team never sees the project at all.
        repository.findByTeam("team-b").isEmpty() shouldBe true
    }
})
