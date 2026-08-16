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
})

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
