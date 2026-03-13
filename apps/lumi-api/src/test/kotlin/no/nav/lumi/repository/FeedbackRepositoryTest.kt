package no.nav.lumi.repository

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import no.nav.lumi.TestDatabase
import no.nav.lumi.config.DatabaseHolder
import no.nav.lumi.domain.FieldType
import no.nav.lumi.domain.FeedbackQuery
import no.nav.lumi.domain.StatsQuery
import no.nav.lumi.insertTestFeedback
import no.nav.lumi.insertTestFeedbackWithJson
import no.nav.lumi.insertTestTheme
import java.sql.Timestamp
import java.time.Instant
import java.time.OffsetDateTime
import java.util.UUID

class FeedbackRepositoryTest : FunSpec({

    val repository = FeedbackRepository()

    beforeSpec {
        DatabaseHolder.initializeForTesting(TestDatabase.dataSource)
        TestDatabase.initialize()
    }

    beforeTest {
        TestDatabase.clearAllData()
    }

    context("findPaginated") {
        test("returns empty list when no feedback exists") {
            val (content, total, _) = repository.findPaginated(FeedbackQuery(team = "nonexistent"))
            
            content.shouldBeEmpty()
            total shouldBe 0
        }

        test("returns feedback filtered by team") {
            insertTestFeedback(team = "team-a", app = "app-1")
            insertTestFeedback(team = "team-b", app = "app-2")
            
            val (content, total, _) = repository.findPaginated(FeedbackQuery(team = "team-a"))
            
            content shouldHaveSize 1
            total shouldBe 1
        }

        test("returns feedback filtered by app") {
            insertTestFeedback(team = "flex", app = "spinnsyn")
            insertTestFeedback(team = "flex", app = "sykepengesoknad")
            
            val (content, _, _) = repository.findPaginated(FeedbackQuery(team = "flex", app = "spinnsyn"))
            
            content shouldHaveSize 1
            content.first().app shouldBe "spinnsyn"
        }

        test("paginates results correctly") {
            repeat(25) { i ->
                insertTestFeedback(
                    id = "feedback-$i",
                    team = "flex"
                )
            }
            
            val (page1, total, _) = repository.findPaginated(FeedbackQuery(team = "flex", page = 0, size = 10))
            val (page2, _, _) = repository.findPaginated(FeedbackQuery(team = "flex", page = 1, size = 10))
            val (page3, _, _) = repository.findPaginated(FeedbackQuery(team = "flex", page = 2, size = 10))
            
            total shouldBe 25
            page1 shouldHaveSize 10
            page2 shouldHaveSize 10
            page3 shouldHaveSize 5
        }

        test("filters by tags") {
            insertTestFeedback(id = "with-tag", team = "flex", tags = "important,bug")
            insertTestFeedback(id = "without-tag", team = "flex", tags = null)
            
            val (content, _, _) = repository.findPaginated(
                FeedbackQuery(team = "flex", tags = listOf("important"))
            )
            
            content shouldHaveSize 1
            content.first().id shouldBe "with-tag"
        }

        test("filters by task name (Top Tasks drill-down)") {
            val surveyId = "survey-task-filter"
            insertTestFeedbackWithJson(
                id = "task-match",
                team = "team-test",
                app = "app-test",
                feedbackJson = """
                    {
                        "schemaVersion": 1,
                        "surveyId": "$surveyId",
                        "surveyType": "topTasks",
                        "context": { "deviceType": "desktop" },
                        "answers": [
                            {
                                "fieldId": "task",
                                "fieldType": "SINGLE_CHOICE",
                                "question": {
                                    "label": "Hva skulle du gjoere?",
                                    "options": [
                                        { "id": "opt-1", "label": "Soknad" },
                                        { "id": "opt-2", "label": "Oppfolging" }
                                    ]
                                },
                                "value": { "type": "singleChoice", "selectedOptionId": "opt-1" }
                            }
                        ]
                    }
                """.trimIndent()
            )
            insertTestFeedbackWithJson(
                id = "task-no-match",
                team = "team-test",
                app = "app-test",
                feedbackJson = """
                    {
                        "schemaVersion": 1,
                        "surveyId": "$surveyId",
                        "surveyType": "topTasks",
                        "context": { "deviceType": "desktop" },
                        "answers": [
                            {
                                "fieldId": "task",
                                "fieldType": "SINGLE_CHOICE",
                                "question": {
                                    "label": "Hva skulle du gjoere?",
                                    "options": [
                                        { "id": "opt-1", "label": "Soknad" },
                                        { "id": "opt-2", "label": "Oppfolging" }
                                    ]
                                },
                                "value": { "type": "singleChoice", "selectedOptionId": "opt-2" }
                            }
                        ]
                    }
                """.trimIndent()
            )

            val (content, _, _) = repository.findPaginated(
                FeedbackQuery(team = "team-test", task = "Soknad")
            )

            content shouldHaveSize 1
            content.first().id shouldBe "task-match"
        }

        test("filters by theme id and uncategorized") {
            val themeId = insertTestTheme(
                team = "team-test",
                name = "Utbetaling",
                keywords = listOf("utbetaling"),
                priority = 1,
                analysisContext = "GENERAL_FEEDBACK"
            )

            insertTestFeedbackWithJson(
                id = "theme-match",
                team = "team-test",
                app = "app-test",
                feedbackJson = """
                    {
                        "schemaVersion": 1,
                        "surveyId": "survey-discovery",
                        "surveyType": "discovery",
                        "context": { "deviceType": "desktop" },
                        "answers": [
                            {
                                "fieldId": "task",
                                "fieldType": "TEXT",
                                "question": { "label": "Hva kom du for aa gjoere?" },
                                "value": { "type": "text", "text": "Venter paa utbetaling" }
                            }
                        ]
                    }
                """.trimIndent()
            )

            insertTestFeedbackWithJson(
                id = "theme-other",
                team = "team-test",
                app = "app-test",
                feedbackJson = """
                    {
                        "schemaVersion": 1,
                        "surveyId": "survey-discovery",
                        "surveyType": "discovery",
                        "context": { "deviceType": "desktop" },
                        "answers": [
                            {
                                "fieldId": "task",
                                "fieldType": "TEXT",
                                "question": { "label": "Hva kom du for aa gjoere?" },
                                "value": { "type": "text", "text": "Jeg trenger hjelp" }
                            }
                        ]
                    }
                """.trimIndent()
            )

            val (matched, _, _) = repository.findPaginated(
                FeedbackQuery(team = "team-test", theme = themeId)
            )
            matched shouldHaveSize 1
            matched.first().id shouldBe "theme-match"

            val (uncategorized, _, _) = repository.findPaginated(
                FeedbackQuery(team = "team-test", theme = "uncategorized")
            )
            uncategorized shouldHaveSize 1
            uncategorized.first().id shouldBe "theme-other"
        }

        test("filters by query with escaped like characters") {
            insertTestFeedback(id = "match", team = "team-test", text = "foo%bar")
            insertTestFeedback(id = "no-match", team = "team-test", text = "fooXbar")

            val (content, _, _) = repository.findPaginated(
                FeedbackQuery(team = "team-test", query = "foo%bar")
            )

            content shouldHaveSize 1
            content.first().id shouldBe "match"
        }

        test("filters by deviceType") {
            insertTestFeedbackWithJson(
                id = "mobile",
                team = "team-test",
                app = "app-test",
                feedbackJson = """
                    {
                        "surveyId": "survey-device",
                        "context": { "deviceType": "mobile" },
                        "answers": [
                            {"fieldId": "rating", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 4}},
                            {"fieldId": "text", "fieldType": "TEXT", "question": {"label": "Hvorfor?"}, "value": {"type": "text", "text": "Ok"}}
                        ]
                    }
                """.trimIndent()
            )
            insertTestFeedbackWithJson(
                id = "desktop",
                team = "team-test",
                app = "app-test",
                feedbackJson = """
                    {
                        "surveyId": "survey-device",
                        "context": { "deviceType": "desktop" },
                        "answers": [
                            {"fieldId": "rating", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 4}},
                            {"fieldId": "text", "fieldType": "TEXT", "question": {"label": "Hvorfor?"}, "value": {"type": "text", "text": "Ok"}}
                        ]
                    }
                """.trimIndent()
            )

            val (content, _, _) = repository.findPaginated(
                FeedbackQuery(team = "team-test", deviceType = "mobile")
            )

            content shouldHaveSize 1
            content.first().id shouldBe "mobile"
        }

        test("filters by date range") {
            insertTestFeedback(
                id = "in-range",
                team = "team-test",
                opprettet = OffsetDateTime.parse("2026-01-01T10:00:00Z")
            )
            insertTestFeedback(
                id = "out-range",
                team = "team-test",
                opprettet = OffsetDateTime.parse("2026-01-02T10:00:00Z")
            )
            insertTestFeedback(
                id = "before-range",
                team = "team-test",
                opprettet = OffsetDateTime.parse("2025-12-31T23:00:00Z")
            )

            val (content, _, _) = repository.findPaginated(
                FeedbackQuery(team = "team-test", fromDate = "2026-01-01", toDate = "2026-01-01")
            )

            content shouldHaveSize 2
            content.map { it.id }.toSet() shouldBe setOf("in-range", "before-range")
        }

        test("filters by lowRating") {
            insertTestFeedback(id = "low", team = "team-test", rating = 2)
            insertTestFeedback(id = "high", team = "team-test", rating = 4)

            val (content, _, _) = repository.findPaginated(
                FeedbackQuery(team = "team-test", lowRating = true)
            )

            content shouldHaveSize 1
            content.first().id shouldBe "low"
        }

        test("filters by ratingFieldId and ratingValue") {
            insertTestFeedbackWithJson(
                id = "rating-3",
                team = "team-test",
                app = "app-test",
                feedbackJson = """
                    {
                        "surveyId": "survey-rating",
                        "answers": [
                            {"fieldId": "rating_main", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 3}}
                        ]
                    }
                """.trimIndent()
            )
            insertTestFeedbackWithJson(
                id = "rating-1",
                team = "team-test",
                app = "app-test",
                feedbackJson = """
                    {
                        "surveyId": "survey-rating",
                        "answers": [
                            {"fieldId": "rating_main", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 1}}
                        ]
                    }
                """.trimIndent()
            )

            val (content, _, _) = repository.findPaginated(
                FeedbackQuery(team = "team-test", ratingFieldId = "rating_main", ratingValue = 1)
            )

            content shouldHaveSize 1
            content.first().id shouldBe "rating-1"
        }

        test("filters by segments") {
            insertTestFeedbackWithJson(
                id = "segment-match",
                team = "team-test",
                app = "app-test",
                feedbackJson = """
                    {
                        "surveyId": "survey-segment",
                        "context": { "tags": { "rolle": "bruker" } },
                        "answers": [
                            {"fieldId": "rating", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 4}}
                        ]
                    }
                """.trimIndent()
            )
            insertTestFeedbackWithJson(
                id = "segment-no-match",
                team = "team-test",
                app = "app-test",
                feedbackJson = """
                    {
                        "surveyId": "survey-segment",
                        "context": { "tags": { "rolle": "veileder" } },
                        "answers": [
                            {"fieldId": "rating", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 4}}
                        ]
                    }
                """.trimIndent()
            )

            val (content, _, _) = repository.findPaginated(
                FeedbackQuery(team = "team-test", segments = listOf("rolle" to "bruker"))
            )

            content shouldHaveSize 1
            content.first().id shouldBe "segment-match"
        }
    }

    context("findById") {
        test("returns feedback by id") {
            val id = UUID.randomUUID().toString()
            insertTestFeedback(id = id, team = "flex", text = "Test feedback text")
            
            val feedback = repository.findById(id, "flex")
            
            feedback.shouldNotBeNull()
            feedback.id shouldBe id
        }

        test("returns null for non-existent id") {
            val feedback = repository.findById("non-existent-id", "flex")
            
            feedback.shouldBeNull()
        }
    }

    context("findAllTags") {
        test("returns empty set when no tags exist") {
            insertTestFeedback(team = "flex", tags = null)
            
            val tags = repository.findAllTags("flex")
            
            tags.shouldBeEmpty()
        }

        test("returns unique tags from all feedback") {
            insertTestFeedback(id = "1", team = "flex", tags = "bug,feature")
            insertTestFeedback(id = "2", team = "flex", tags = "bug,improvement")
            insertTestFeedback(id = "3", team = "flex", tags = "feature")
            
            val tags = repository.findAllTags("flex")
            
            tags shouldHaveSize 3
            tags shouldContain "bug"
            tags shouldContain "feature"
            tags shouldContain "improvement"
        }
    }

    context("findDistinctApps") {
        test("returns apps for specific team") {
            insertTestFeedback(team = "flex", app = "spinnsyn")
            insertTestFeedback(team = "flex", app = "sykepengesoknad")
            insertTestFeedback(team = "arbeid", app = "pam-frontend")
            
            val flexApps = repository.findDistinctApps("flex")
            flexApps shouldHaveSize 2
            flexApps shouldContain "spinnsyn"
            flexApps shouldContain "sykepengesoknad"
            
            val arbeidApps = repository.findDistinctApps("arbeid")
            arbeidApps shouldHaveSize 1
            arbeidApps shouldContain "pam-frontend"
        }
    }

    context("findSurveysByApp") {
        test("groups and sorts surveyIds per app") {
            insertTestFeedback(team = "flex", app = "app-a", surveyId = "Z")
            insertTestFeedback(team = "flex", app = "app-a", surveyId = "A")
            insertTestFeedback(team = "flex", app = "app-b", surveyId = "B")
            insertTestFeedback(team = "flex", app = "app-b", surveyId = "B")

            val surveysByApp = repository.findSurveysByApp("flex")

            surveysByApp["app-a"] shouldBe listOf("A", "Z")
            surveysByApp["app-b"] shouldBe listOf("B")
        }
    }

    context("tags operations") {
        test("addTag adds tag to existing feedback") {
            val id = UUID.randomUUID().toString()
            insertTestFeedback(id = id, tags = "existing-tag")
            
            val result = repository.addTag(id, "team-test", "new-tag")
            
            result shouldBe true
            
            // Verify through findAllTags
            val allTags = repository.findAllTags("team-test")
            allTags shouldContain "new-tag"
            allTags shouldContain "existing-tag"
        }

        test("addTag normalizes and avoids duplicates") {
            val id = UUID.randomUUID().toString()
            insertTestFeedback(id = id, tags = null)

            val first = repository.addTag(id, "team-test", "  Bug ")
            val second = repository.addTag(id, "team-test", "bug")

            first shouldBe true
            second shouldBe true

            val feedback = repository.findById(id, "team-test").shouldNotBeNull()
            feedback.tags shouldHaveSize 1
            feedback.tags.first() shouldBe "bug"
        }

        test("addTag returns false for non-existent feedback") {
            val result = repository.addTag("non-existent", "team-test", "tag")
            
            result shouldBe false
        }

        test("removeTag removes tag from feedback") {
            val id = UUID.randomUUID().toString()
            insertTestFeedback(id = id, tags = "tag1,tag2")
            
            val result = repository.removeTag(id, "team-test", "tag1")
            
            result shouldBe true
        }

        test("removeTag only affects the targeted feedback") {
            val idA = UUID.randomUUID().toString()
            val idB = UUID.randomUUID().toString()
            insertTestFeedback(id = idA, tags = "shared")
            insertTestFeedback(id = idB, tags = "shared")

            val result = repository.removeTag(idA, "team-test", "shared")

            result shouldBe true

            val feedbackA = repository.findById(idA, "team-test").shouldNotBeNull()
            val feedbackB = repository.findById(idB, "team-test").shouldNotBeNull()
            feedbackA.tags.shouldBeEmpty()
            feedbackB.tags shouldContain "shared"
        }
    }

    context("updateJson") {
        test("updates feedback JSON") {
            val id = UUID.randomUUID().toString()
            insertTestFeedback(id = id, text = "Old text")
            
            val newJson = """{"surveyId": "test", "answers": []}"""
            val result = repository.updateJson(id, "team-test", newJson)
            
            result shouldBe true
            val feedback = repository.findById(id, "team-test")
            feedback.shouldNotBeNull()
        }
    }

        context("findContextTagsForSurvey") {
                fun insertTestFeedbackWithJson(
                        id: String = UUID.randomUUID().toString(),
                        team: String = "team-test",
                        app: String = "app-test",
                        feedbackJson: String,
                        opprettet: Timestamp = Timestamp.from(Instant.now()),
                ) {
                        TestDatabase.dataSource.connection.use { conn ->
                                conn.prepareStatement(
                                        """
                                        INSERT INTO feedback (id, opprettet, feedback_json, team, app)
                                        VALUES (?, ?, ?::jsonb, ?, ?)
                                        """.trimIndent()
                                ).use { stmt ->
                                        stmt.setString(1, id)
                                        stmt.setObject(2, opprettet)
                                        stmt.setString(3, feedbackJson)
                                        stmt.setString(4, team)
                                        stmt.setString(5, app)
                                        stmt.executeUpdate()
                                }
                                conn.commit()
                        }
                }

                test("honors segments/date/device/hasText/lowRating") {
                        val surveyId = "survey-ctx-filters-repo-1"
                        val tsInRange = Timestamp.from(Instant.parse("2026-01-01T12:00:00Z"))
                        val tsOutOfRange = Timestamp.from(Instant.parse("2026-01-02T12:00:00Z"))

                        insertTestFeedbackWithJson(
                                team = "team-test",
                                app = "app-test",
                                opprettet = tsInRange,
                                feedbackJson = """
                                        {
                                            "surveyId": "$surveyId",
                                            "context": {
                                                "deviceType": "mobile",
                                                "tags": {"abTest": "A"}
                                            },
                                            "answers": [
                                                {"fieldId": "rating", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 2}},
                                                {"fieldId": "text", "fieldType": "TEXT", "question": {"label": "Hvorfor?"}, "value": {"type": "text", "text": "Bra nok"}}
                                            ]
                                        }
                                """.trimIndent(),
                        )

                        // Wrong segment
                        insertTestFeedbackWithJson(
                                team = "team-test",
                                app = "app-test",
                                opprettet = tsInRange,
                                feedbackJson = """
                                        {
                                            "surveyId": "$surveyId",
                                            "context": {
                                                "deviceType": "mobile",
                                                "tags": {"abTest": "B"}
                                            },
                                            "answers": [
                                                {"fieldId": "rating", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 2}},
                                                {"fieldId": "text", "fieldType": "TEXT", "question": {"label": "Hvorfor?"}, "value": {"type": "text", "text": "Ulik segment"}}
                                            ]
                                        }
                                """.trimIndent(),
                        )

                        // Out of date range
                        insertTestFeedbackWithJson(
                                team = "team-test",
                                app = "app-test",
                                opprettet = tsOutOfRange,
                                feedbackJson = """
                                        {
                                            "surveyId": "$surveyId",
                                            "context": {
                                                "deviceType": "mobile",
                                                "tags": {"abTest": "A"}
                                            },
                                            "answers": [
                                                {"fieldId": "rating", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 2}},
                                                {"fieldId": "text", "fieldType": "TEXT", "question": {"label": "Hvorfor?"}, "value": {"type": "text", "text": "Utenfor"}}
                                            ]
                                        }
                                """.trimIndent(),
                        )

                        // Wrong device and no text
                        insertTestFeedbackWithJson(
                                team = "team-test",
                                app = "app-test",
                                opprettet = tsInRange,
                                feedbackJson = """
                                        {
                                            "surveyId": "$surveyId",
                                            "context": {
                                                "deviceType": "desktop",
                                                "tags": {"abTest": "A"}
                                            },
                                            "answers": [
                                                {"fieldId": "rating", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 2}},
                                                {"fieldId": "text", "fieldType": "TEXT", "question": {"label": "Hvorfor?"}, "value": {"type": "text", "text": ""}}
                                            ]
                                        }
                                """.trimIndent(),
                        )

                        val result = repository.findContextTagsForSurvey(
                                surveyId = surveyId,
                                team = "team-test",
                                segments = listOf("abTest" to "A"),
                                fromDate = "2026-01-01",
                                toDate = "2026-01-01",
                                deviceType = "mobile",
                                hasText = true,
                                lowRating = true,
                        )

                        result.keys shouldContain "abTest"
                        val values = result["abTest"].shouldNotBeNull()
                        values shouldHaveSize 1
                        values.first().value shouldBe "Ja"
                        values.first().count shouldBe 1
                }

                test("filters by task when task is set") {
                        val surveyId = "survey-ctx-task-1"
                        val tsInRange = Timestamp.from(Instant.parse("2026-01-01T12:00:00Z"))

                        insertTestFeedbackWithJson(
                                team = "team-test",
                                app = "app-test",
                                opprettet = tsInRange,
                                feedbackJson = """
                                        {
                                            "surveyId": "$surveyId",
                                            "context": {
                                                "deviceType": "mobile",
                                                "tags": {"k": "v"}
                                            },
                                            "answers": [
                                                {
                                                    "fieldId": "task",
                                                    "fieldType": "SINGLE_CHOICE",
                                                    "question": {
                                                        "label": "Hva skulle du gjoere?",
                                                        "options": [
                                                            { "id": "opt-1", "label": "Soknad" },
                                                            { "id": "opt-2", "label": "Oppfolging" }
                                                        ]
                                                    },
                                                    "value": { "type": "singleChoice", "selectedOptionId": "opt-1" }
                                                },
                                                {"fieldId": "rating", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 2}},
                                                {"fieldId": "text", "fieldType": "TEXT", "question": {"label": "Hvorfor?"}, "value": {"type": "text", "text": "Bra nok"}}
                                            ]
                                        }
                                """.trimIndent(),
                        )

                        insertTestFeedbackWithJson(
                                team = "team-test",
                                app = "app-test",
                                opprettet = tsInRange,
                                feedbackJson = """
                                        {
                                            "surveyId": "$surveyId",
                                            "context": {
                                                "deviceType": "desktop",
                                                "tags": {"k": "v"}
                                            },
                                            "answers": [
                                                {
                                                    "fieldId": "task",
                                                    "fieldType": "SINGLE_CHOICE",
                                                    "question": {
                                                        "label": "Hva skulle du gjoere?",
                                                        "options": [
                                                            { "id": "opt-1", "label": "Soknad" },
                                                            { "id": "opt-2", "label": "Oppfolging" }
                                                        ]
                                                    },
                                                    "value": { "type": "singleChoice", "selectedOptionId": "opt-1" }
                                                },
                                                {"fieldId": "rating", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 2}},
                                                {"fieldId": "text", "fieldType": "TEXT", "question": {"label": "Hvorfor?"}, "value": {"type": "text", "text": "Bra nok"}}
                                            ]
                                        }
                                """.trimIndent(),
                        )

                        insertTestFeedbackWithJson(
                                team = "team-test",
                                app = "app-test",
                                opprettet = tsInRange,
                                feedbackJson = """
                                        {
                                            "surveyId": "$surveyId",
                                            "context": {
                                                "deviceType": "mobile",
                                                "tags": {"k": "v"}
                                            },
                                            "answers": [
                                                {
                                                    "fieldId": "task",
                                                    "fieldType": "SINGLE_CHOICE",
                                                    "question": {
                                                        "label": "Hva skulle du gjoere?",
                                                        "options": [
                                                            { "id": "opt-1", "label": "Soknad" },
                                                            { "id": "opt-2", "label": "Oppfolging" }
                                                        ]
                                                    },
                                                    "value": { "type": "singleChoice", "selectedOptionId": "opt-2" }
                                                },
                                                {"fieldId": "rating", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 2}},
                                                {"fieldId": "text", "fieldType": "TEXT", "question": {"label": "Hvorfor?"}, "value": {"type": "text", "text": "Bra nok"}}
                                            ]
                                        }
                                """.trimIndent(),
                        )

                        val result = repository.findContextTagsForSurvey(
                                surveyId = surveyId,
                                team = "team-test",
                                task = "Soknad",
                                segments = listOf("k" to "v"),
                                deviceType = "mobile",
                                hasText = true,
                                lowRating = true,
                        )

                        result.keys shouldContain "k"
                        val values = result["k"].shouldNotBeNull()
                        values shouldHaveSize 1
                        values.first().value shouldBe "v"
                        values.first().count shouldBe 1
                }
        }


})
