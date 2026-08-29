package no.nav.lumi.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import kotlinx.serialization.json.JsonPrimitive
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.validation.SurveyFlowValidator

class SurveyFlowDefinitionTest : FunSpec({
    val definition = SurveyDefinition(
        surveyId = "survey",
        surveyType = SurveyType.CUSTOM,
        fields = listOf(
            FieldDefinition("rating", FieldType.RATING, RatingVariant.NPS, 11, null),
            FieldDefinition("details", FieldType.TEXT, null, null, null),
        ),
    )

    test("hash is stable across condition order and equivalent number syntax") {
        val first = flow(
            listOf(
                SurveyFlowCondition(
                    SurveyFlowConditionSource.METADATA,
                    "deviceType",
                    SurveyFlowOperator.EQ,
                    JsonPrimitive("mobile"),
                ),
                SurveyFlowCondition(
                    SurveyFlowConditionSource.ANSWER,
                    "rating",
                    SurveyFlowOperator.LT,
                    JsonPrimitive(7),
                ),
            ),
        )
        val reordered = flow(
            listOf(
                SurveyFlowCondition(
                    SurveyFlowConditionSource.ANSWER,
                    "rating",
                    SurveyFlowOperator.LT,
                    JsonPrimitive(7.0),
                ),
                SurveyFlowCondition(
                    SurveyFlowConditionSource.METADATA,
                    "deviceType",
                    SurveyFlowOperator.EQ,
                    JsonPrimitive("mobile"),
                ),
            ),
        )

        SurveyFlowValidator.validate(first, definition)
        SurveyFlowValidator.validate(reordered, definition)
        first.computeHash() shouldBe reordered.computeHash()
    }

    test("hash changes when a predicate changes") {
        val first = flow(
            listOf(
                SurveyFlowCondition(
                    SurveyFlowConditionSource.ANSWER,
                    "rating",
                    SurveyFlowOperator.LT,
                    JsonPrimitive(7),
                ),
            ),
        )
        val changed = flow(
            listOf(
                SurveyFlowCondition(
                    SurveyFlowConditionSource.ANSWER,
                    "rating",
                    SurveyFlowOperator.LT,
                    JsonPrimitive(8),
                ),
            ),
        )

        (first.computeHash() == changed.computeHash()) shouldBe false
    }

    test("hash is order-independent when condition components contain NUL") {
        val firstCondition = SurveyFlowCondition(
            SurveyFlowConditionSource.METADATA,
            "x",
            SurveyFlowOperator.EQ,
            JsonPrimitive("a\u0000NEQ\u0000STRING\u0000b"),
        )
        val secondCondition = SurveyFlowCondition(
            SurveyFlowConditionSource.METADATA,
            "x\u0000EQ\u0000STRING\u0000a",
            SurveyFlowOperator.NEQ,
            JsonPrimitive("b"),
        )

        flow(listOf(firstCondition, secondCondition)).computeHash() shouldBe
            flow(listOf(secondCondition, firstCondition)).computeHash()
    }

    test("hash has a stable golden value for the persisted v1 identity") {
        val golden = SurveyFlowDefinitionV1(
            schemaVersion = 1,
            evaluatorVersion = SURVEY_FLOW_EVALUATOR_VERSION,
            fields = listOf(
                SurveyFlowFieldDefinition("q_rating"),
                SurveyFlowFieldDefinition(
                    "q_choice",
                    SurveyVisibleIfDefinition(
                        SurveyFlowCombinator.ANY,
                        listOf(
                            SurveyFlowCondition(
                                SurveyFlowConditionSource.METADATA,
                                "segment",
                                SurveyFlowOperator.EQ,
                                JsonPrimitive("blå"),
                            ),
                            SurveyFlowCondition(
                                SurveyFlowConditionSource.METADATA,
                                "other",
                                SurveyFlowOperator.EXISTS,
                            ),
                            SurveyFlowCondition(
                                SurveyFlowConditionSource.ANSWER,
                                "q_rating",
                                SurveyFlowOperator.LT,
                                JsonPrimitive(7.0),
                            ),
                            SurveyFlowCondition(
                                SurveyFlowConditionSource.METADATA,
                                "flag",
                                SurveyFlowOperator.EQ,
                                JsonPrimitive(true),
                            ),
                        ),
                    ),
                ),
            ),
        )

        golden.computeHash() shouldBe "dacdee83ce50bc6533433f055c2311d3fd38e8e0f5edd5171e639db72ff56541"
    }

    test("validator rejects forward answer dependencies") {
        val invalid = SurveyFlowDefinitionV1(
            schemaVersion = 1,
            evaluatorVersion = SURVEY_FLOW_EVALUATOR_VERSION,
            fields = listOf(
                SurveyFlowFieldDefinition(
                    fieldId = "rating",
                    visibleIf = SurveyVisibleIfDefinition(
                        combinator = SurveyFlowCombinator.ALL,
                        conditions = listOf(
                            SurveyFlowCondition(
                                SurveyFlowConditionSource.ANSWER,
                                "details",
                                SurveyFlowOperator.EXISTS,
                            ),
                        ),
                    ),
                ),
                SurveyFlowFieldDefinition("details"),
            ),
        )

        shouldThrow<ApiErrorException.BadRequestException> {
            SurveyFlowValidator.validate(invalid, definition)
        }
    }

    test("validator rejects operators that cannot match the referenced field") {
        val invalid = flow(
            listOf(
                SurveyFlowCondition(
                    SurveyFlowConditionSource.ANSWER,
                    "rating",
                    SurveyFlowOperator.CONTAINS,
                    JsonPrimitive("7"),
                ),
            ),
        )

        shouldThrow<ApiErrorException.BadRequestException> {
            SurveyFlowValidator.validate(invalid, definition)
        }
    }

    test("validator rejects values outside the referenced field and metadata domains") {
        val invalidRating = flow(
            listOf(
                SurveyFlowCondition(
                    SurveyFlowConditionSource.ANSWER,
                    "rating",
                    SurveyFlowOperator.LT,
                    JsonPrimitive("7"),
                ),
            ),
        )
        val invalidMetadata = flow(
            listOf(
                SurveyFlowCondition(
                    SurveyFlowConditionSource.METADATA,
                    "deviceType",
                    SurveyFlowOperator.GT,
                    JsonPrimitive(7),
                ),
            ),
        )
        val oversizedPredicate = flow(
            listOf(
                SurveyFlowCondition(
                    SurveyFlowConditionSource.METADATA,
                    "customSegment",
                    SurveyFlowOperator.EQ,
                    JsonPrimitive("x".repeat(2_049)),
                ),
            ),
        )

        shouldThrow<ApiErrorException.BadRequestException> {
            SurveyFlowValidator.validate(invalidRating, definition)
        }
        shouldThrow<ApiErrorException.BadRequestException> {
            SurveyFlowValidator.validate(invalidMetadata, definition)
        }
        shouldThrow<ApiErrorException.BadRequestException> {
            SurveyFlowValidator.validate(oversizedPredicate, definition)
        }
    }
})

private fun flow(conditions: List<SurveyFlowCondition>) = SurveyFlowDefinitionV1(
    schemaVersion = 1,
    evaluatorVersion = SURVEY_FLOW_EVALUATOR_VERSION,
    fields = listOf(
        SurveyFlowFieldDefinition("rating"),
        SurveyFlowFieldDefinition(
            fieldId = "details",
            visibleIf = SurveyVisibleIfDefinition(
                combinator = SurveyFlowCombinator.ANY,
                conditions = conditions,
            ),
        ),
    ),
)
