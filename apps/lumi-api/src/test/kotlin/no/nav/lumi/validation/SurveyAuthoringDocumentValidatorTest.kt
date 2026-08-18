package no.nav.lumi.validation

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.domain.FieldType
import no.nav.lumi.domain.computeHash

class SurveyAuthoringDocumentValidatorTest : FunSpec({
    test("validates the full V1 question surface and derives the analytics definition") {
        val validated = SurveyAuthoringDocumentValidator.validate(validDocument(), "survey-v1")

        validated.documentHash.length shouldBe 64
        validated.definition.surveyId shouldBe "survey-v1"
        validated.definition.fields.map { it.fieldType } shouldContainExactly listOf(
            FieldType.RATING,
            FieldType.SINGLE_CHOICE,
            FieldType.MULTI_CHOICE,
            FieldType.TEXT,
        )
        validated.definition.fields[1].optionIds shouldContainExactly listOf("yes", "no")
    }

    test("text changes alter document hash without altering definition hash") {
        val original = SurveyAuthoringDocumentValidator.validate(validDocument(), "survey-v1")
        val changed = SurveyAuthoringDocumentValidator.validate(
            validDocument().let { document ->
                Json.parseToJsonElement(
                    document.toString().replace("Hvordan gikk det?", "Hvordan var opplevelsen?"),
                ).jsonObject
            },
            "survey-v1",
        )

        (changed.documentHash == original.documentHash) shouldBe false
        changed.definition.computeHash() shouldBe original.definition.computeHash()
    }

    test("document hash is independent of object key order") {
        val original = SurveyAuthoringDocumentValidator.validate(validDocument(), "survey-v1")
        val reordered = Json.parseToJsonElement(
            """
            {
              "pages": ${validDocument().getValue("pages")},
              "type": "rating",
              "authoringSchemaVersion": 1
            }
            """.trimIndent(),
        ).jsonObject

        SurveyAuthoringDocumentValidator.validate(reordered, "survey-v1").documentHash shouldBe
            original.documentHash
    }

    test("rejects forward visibleIf references") {
        val invalid = Json.parseToJsonElement(
            """
            {
              "authoringSchemaVersion": 1,
              "pages": [{
                "id": "page",
                "questions": [
                  {
                    "id": "first",
                    "type": "text",
                    "prompt": "First",
                    "visibleIf": {"questionId": "later", "operator": "EXISTS"}
                  },
                  {"id": "later", "type": "text", "prompt": "Later"}
                ]
              }]
            }
            """.trimIndent(),
        ).jsonObject

        shouldThrow<ApiErrorException.BadRequestException> {
            SurveyAuthoringDocumentValidator.validate(invalid, "survey-v1")
        }.errorMessage shouldBe "Question 'first' visibleIf may only reference an earlier question"
    }

    test("rejects malformed variant-specific fields") {
        val invalid = Json.parseToJsonElement(
            """
            {
              "authoringSchemaVersion": 1,
              "pages": [{
                "id": "page",
                "questions": [{
                  "id": "rating",
                  "type": "rating",
                  "prompt": "Rating",
                  "lowLabel": {}
                }]
              }]
            }
            """.trimIndent(),
        ).jsonObject

        shouldThrow<ApiErrorException.BadRequestException> {
            SurveyAuthoringDocumentValidator.validate(invalid, "survey-v1")
        }.errorMessage shouldBe "Rating question 'rating' has a non-string lowLabel"
    }

    test("release gate rejects blank prompts that drafts may keep") {
        val blankPrompt = Json.parseToJsonElement(
            """
            {
              "authoringSchemaVersion": 1,
              "pages": [{
                "id": "page",
                "questions": [{
                  "id": "rating",
                  "type": "rating",
                  "prompt": "   "
                }]
              }]
            }
            """.trimIndent(),
        ).jsonObject

        SurveyAuthoringDocumentValidator.validate(blankPrompt, "survey-v1")

        shouldThrow<ApiErrorException.BadRequestException> {
            SurveyAuthoringDocumentValidator.validate(blankPrompt, "survey-v1", releaseGate = true)
        }.errorMessage shouldBe "Question 'rating' needs a prompt before it can be shared"
    }

    test("release gate rejects blank option labels and values") {
        fun choiceDocument(label: String, value: String): JsonObject = Json.parseToJsonElement(
            """
            {
              "authoringSchemaVersion": 1,
              "pages": [{
                "id": "page",
                "questions": [{
                  "id": "choice",
                  "type": "singleChoice",
                  "prompt": "Velg",
                  "options": [
                    { "value": "$value", "label": "$label" },
                    { "value": "annet", "label": "Annet" }
                  ]
                }]
              }]
            }
            """.trimIndent(),
        ).jsonObject

        SurveyAuthoringDocumentValidator.validate(choiceDocument(" ", "ok"), "survey-v1")

        shouldThrow<ApiErrorException.BadRequestException> {
            SurveyAuthoringDocumentValidator.validate(
                choiceDocument(" ", "ok"),
                "survey-v1",
                releaseGate = true,
            )
        }.errorMessage shouldBe "Option 0 on question 'choice' needs a label before it can be shared"

        shouldThrow<ApiErrorException.BadRequestException> {
            SurveyAuthoringDocumentValidator.validate(
                choiceDocument("Ok", " "),
                "survey-v1",
                releaseGate = true,
            )
        }.errorMessage shouldBe "Option 0 on question 'choice' needs a value before it can be shared"
    }

    test("release gate rejects condition operators that cannot match the referenced type") {
        val document = conditionDocument(
            referencedType = "multiChoice",
            condition = """{ "questionId": "ref", "operator": "EQ", "value": "en" }""",
        )

        SurveyAuthoringDocumentValidator.validate(document, "survey-v1")

        shouldThrow<ApiErrorException.BadRequestException> {
            SurveyAuthoringDocumentValidator.validate(document, "survey-v1", releaseGate = true)
        }.errorMessage shouldBe
            "Question 'gated' visibleIf uses operator 'EQ' that does not fit question 'ref'"
    }

    test("release gate rejects condition values outside the referenced domain") {
        val ratingOutOfScale = conditionDocument(
            referencedType = "rating",
            condition = """{ "questionId": "ref", "operator": "EQ", "value": 99 }""",
        )
        shouldThrow<ApiErrorException.BadRequestException> {
            SurveyAuthoringDocumentValidator.validate(ratingOutOfScale, "survey-v1", releaseGate = true)
        }.errorMessage shouldBe
            "Question 'gated' visibleIf has a value outside question 'ref' scale"

        val unknownOption = conditionDocument(
            referencedType = "singleChoice",
            condition = """{ "questionId": "ref", "operator": "EQ", "value": "finnes-ikke" }""",
        )
        shouldThrow<ApiErrorException.BadRequestException> {
            SurveyAuthoringDocumentValidator.validate(unknownOption, "survey-v1", releaseGate = true)
        }.errorMessage shouldBe
            "Question 'gated' visibleIf has a value outside question 'ref' options"
    }

    test("release gate requires string values against text references") {
        val numericAgainstText = conditionDocument(
            referencedType = "text",
            condition = """{ "questionId": "ref", "operator": "EQ", "value": 3 }""",
        )
        SurveyAuthoringDocumentValidator.validate(numericAgainstText, "survey-v1")
        shouldThrow<ApiErrorException.BadRequestException> {
            SurveyAuthoringDocumentValidator.validate(numericAgainstText, "survey-v1", releaseGate = true)
        }.errorMessage shouldBe
            "Question 'gated' visibleIf needs a string value for text question 'ref'"

        val stringAgainstText = conditionDocument(
            referencedType = "text",
            condition = """{ "questionId": "ref", "operator": "EQ", "value": "3" }""",
        )
        SurveyAuthoringDocumentValidator.validate(stringAgainstText, "survey-v1", releaseGate = true)
    }

    test("release gate rejects contradictory condition targets") {
        // Runtime discriminates on `field` alone, so a stray key/questionId
        // is ignored there — but it reads as the other target to a human.
        // Drafts stay lenient; freezing the ambiguity is refused.
        val answerWithKey = conditionDocument(
            referencedType = "rating",
            condition = """{ "field": "ANSWER", "questionId": "ref", "key": "ekstra", "operator": "EXISTS" }""",
        )
        SurveyAuthoringDocumentValidator.validate(answerWithKey, "survey-v1")
        shouldThrow<ApiErrorException.BadRequestException> {
            SurveyAuthoringDocumentValidator.validate(answerWithKey, "survey-v1", releaseGate = true)
        }.errorMessage shouldBe
            "Question 'gated' ANSWER visibleIf must not carry a metadata key"

        val metadataWithQuestionId = conditionDocument(
            referencedType = "rating",
            condition = """{ "field": "METADATA", "key": "flow", "questionId": "ref", "operator": "EXISTS" }""",
        )
        SurveyAuthoringDocumentValidator.validate(metadataWithQuestionId, "survey-v1")
        shouldThrow<ApiErrorException.BadRequestException> {
            SurveyAuthoringDocumentValidator.validate(metadataWithQuestionId, "survey-v1", releaseGate = true)
        }.errorMessage shouldBe
            "Question 'gated' METADATA visibleIf must not reference a question"
    }

    test("release gate rejects blank string values against text references") {
        // Blank text answers are stripped from runtime answer state, so a
        // blank value makes EQ unmatchable, NEQ true before any answer and
        // CONTAINS a match-everything condition.
        listOf("", "   ").forEach { blank ->
            val document = conditionDocument(
                referencedType = "text",
                condition = """{ "questionId": "ref", "operator": "CONTAINS", "value": "$blank" }""",
            )
            SurveyAuthoringDocumentValidator.validate(document, "survey-v1")
            shouldThrow<ApiErrorException.BadRequestException> {
                SurveyAuthoringDocumentValidator.validate(document, "survey-v1", releaseGate = true)
            }.errorMessage shouldBe
                "Question 'gated' visibleIf needs a non-blank string value for text question 'ref'"
        }
    }

    test("release gate accepts semantically valid conditions") {
        val contains = conditionDocument(
            referencedType = "multiChoice",
            condition = """{ "questionId": "ref", "operator": "CONTAINS", "value": "en" }""",
        )
        SurveyAuthoringDocumentValidator.validate(contains, "survey-v1", releaseGate = true)

        val ratingEq = conditionDocument(
            referencedType = "rating",
            condition = """{ "questionId": "ref", "operator": "EQ", "value": 3 }""",
        )
        SurveyAuthoringDocumentValidator.validate(ratingEq, "survey-v1", releaseGate = true)
    }
    test("intro and success screens are draft-lenient but release-gated on title") {
        fun withScreens(introTitle: String, successTitle: String): JsonObject {
            val base = validDocument().toMutableMap()
            base["intro"] = Json.parseToJsonElement(
                """{ "title": "$introTitle", "body": "To korte sporsmal.", "startLabel": "Kom i gang" }""",
            )
            base["success"] = Json.parseToJsonElement(
                """{ "title": "$successTitle", "body": "Svaret er sendt." }""",
            )
            return JsonObject(base)
        }

        // Drafts accept blank titles; the release gate does not.
        SurveyAuthoringDocumentValidator.validate(withScreens("", ""), "survey-v1")
        SurveyAuthoringDocumentValidator.validate(withScreens("Velkommen", "Takk!"), "survey-v1", releaseGate = true)

        shouldThrow<ApiErrorException.BadRequestException> {
            SurveyAuthoringDocumentValidator.validate(withScreens("  ", "Takk!"), "survey-v1", releaseGate = true)
        }.errorMessage shouldBe
            "Document intro needs a non-blank title before a revision can be created"
        shouldThrow<ApiErrorException.BadRequestException> {
            SurveyAuthoringDocumentValidator.validate(withScreens("Velkommen", ""), "survey-v1", releaseGate = true)
        }.errorMessage shouldBe
            "Document success needs a non-blank title before a revision can be created"

        // Malformed shapes are rejected already in drafts.
        val nonStringTitle = JsonObject(
            validDocument().toMutableMap().also {
                it["intro"] = Json.parseToJsonElement("""{ "title": 42 }""")
            },
        )
        shouldThrow<ApiErrorException.BadRequestException> {
            SurveyAuthoringDocumentValidator.validate(nonStringTitle, "survey-v1")
        }.errorMessage shouldBe "Document intro needs a string title"
    }
})

private fun conditionDocument(referencedType: String, condition: String): JsonObject {
    val referenced = when (referencedType) {
        "rating" -> """{ "id": "ref", "type": "rating", "prompt": "Vurder" }"""
        "singleChoice", "multiChoice" -> """{
            "id": "ref",
            "type": "$referencedType",
            "prompt": "Velg",
            "options": [
                { "value": "en", "label": "En" },
                { "value": "to", "label": "To" }
            ]
        }"""
        else -> """{ "id": "ref", "type": "text", "prompt": "Skriv" }"""
    }
    return Json.parseToJsonElement(
        """
        {
          "authoringSchemaVersion": 1,
          "pages": [{
            "id": "page",
            "questions": [
              $referenced,
              {
                "id": "gated",
                "type": "text",
                "prompt": "Utdyp",
                "visibleIf": $condition
              }
            ]
          }]
        }
        """.trimIndent(),
    ).jsonObject
}

private fun validDocument(): JsonObject = Json.parseToJsonElement(
    """
    {
      "authoringSchemaVersion": 1,
      "type": "rating",
      "pages": [
        {
          "id": "rating-page",
          "title": "Opplevelsen",
          "questions": [
            {
              "id": "rating",
              "type": "rating",
              "prompt": "Hvordan gikk det?",
              "variant": "nps",
              "lowLabel": "Dårlig",
              "highLabel": "Bra",
              "labels": [{"value": 0, "label": "Ikke sannsynlig"}]
            },
            {
              "id": "choice",
              "type": "singleChoice",
              "prompt": "Vil du svare?",
              "options": [
                {"value": "yes", "label": "Ja"},
                {"value": "no", "label": "Nei"}
              ],
              "visibleIf": {"questionId": "rating", "operator": "GT", "value": 3}
            },
            {
              "id": "topics",
              "type": "multiChoice",
              "prompt": "Tema",
              "options": [
                {"value": "speed", "label": "Fart"},
                {"value": "content", "label": "Innhold"}
              ],
              "variant": "combobox",
              "maxSelections": 2,
              "randomize": false
            },
            {
              "id": "comment",
              "type": "text",
              "prompt": "Kommentar",
              "maxLength": 1000,
              "minRows": 4,
              "visibleIf": {"field": "METADATA", "key": "country", "operator": "EXISTS"}
            }
          ]
        }
      ]
    }
    """.trimIndent(),
).jsonObject
