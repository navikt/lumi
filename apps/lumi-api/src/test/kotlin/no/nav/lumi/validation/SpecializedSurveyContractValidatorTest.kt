package no.nav.lumi.validation

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.domain.Answer
import no.nav.lumi.domain.AnswerValue
import no.nav.lumi.domain.ChoiceOption
import no.nav.lumi.domain.FieldType
import no.nav.lumi.domain.Question
import no.nav.lumi.domain.SubmissionFieldDefinitionPayload
import no.nav.lumi.domain.SurveyType

class SpecializedSurveyContractValidatorTest : FunSpec({
    val outcomeOptions = listOf(
        ChoiceOption("yes", "Ja"),
        ChoiceOption("partial", "Delvis"),
        ChoiceOption("no", "Nei")
    )

    fun textAnswer(id: String) = Answer(
        fieldId = id,
        fieldType = FieldType.TEXT,
        question = Question("Oppgave"),
        value = AnswerValue.Text("Søke")
    )

    fun choiceAnswer(id: String, options: List<ChoiceOption> = outcomeOptions) = Answer(
        fieldId = id,
        fieldType = FieldType.SINGLE_CHOICE,
        question = Question("Valg", options = options),
        value = AnswerValue.SingleChoice(options.first().id)
    )

    fun multiChoiceAnswer(id: String) = Answer(
        fieldId = id,
        fieldType = FieldType.MULTI_CHOICE,
        question = Question(
            "Prioriter",
            options = listOf(ChoiceOption("apply", "Søke"))
        ),
        value = AnswerValue.MultiChoice(listOf("apply"))
    )

    test("accepts the canonical contracts for every specialized survey type") {
        SpecializedSurveyContractValidator.validateAnswers(
            SurveyType.DISCOVERY,
            listOf(textAnswer("task"), choiceAnswer("success"))
        )
        SpecializedSurveyContractValidator.validateAnswers(
            SurveyType.TOP_TASKS,
            listOf(choiceAnswer("task", listOf(ChoiceOption("apply", "Søke"))), choiceAnswer("success"))
        )
        SpecializedSurveyContractValidator.validateAnswers(
            SurveyType.TASK_PRIORITY,
            listOf(multiChoiceAnswer("priority")),
            definitionValidated = true,
        )
    }

    test("accepts the field IDs emitted by deprecated 2.0.1 builders") {
        SpecializedSurveyContractValidator.validateAnswers(
            SurveyType.DISCOVERY,
            listOf(textAnswer("discoveredTask"), choiceAnswer("taskSuccess"))
        )
        SpecializedSurveyContractValidator.validateAnswers(
            SurveyType.TOP_TASKS,
            listOf(choiceAnswer("task", listOf(ChoiceOption("apply", "Søke"))), choiceAnswer("taskSuccess"))
        )
        SpecializedSurveyContractValidator.validateAnswers(
            SurveyType.TASK_PRIORITY,
            listOf(multiChoiceAnswer("priorities"))
        )
    }

    test("canonical task priority answers require a schema v2 definition") {
        val error = shouldThrow<ApiErrorException.BadRequestException> {
            SpecializedSurveyContractValidator.validateAnswers(
                SurveyType.TASK_PRIORITY,
                listOf(multiChoiceAnswer("priority"))
            )
        }
        error.message shouldBe
            "Invalid taskPriority survey contract: canonical field 'priority' requires schemaVersion 2 with a validated definition"
    }

    test("rejects a specialized definition with the wrong field type") {
        val error = shouldThrow<ApiErrorException.BadRequestException> {
            SpecializedSurveyContractValidator.validateDefinition(
                SurveyType.DISCOVERY,
                listOf(
                    SubmissionFieldDefinitionPayload("task", FieldType.SINGLE_CHOICE),
                    SubmissionFieldDefinitionPayload(
                        "success",
                        FieldType.SINGLE_CHOICE,
                        optionIds = listOf("yes", "partial", "no")
                    )
                )
            )
        }

        error.message shouldBe
            "Invalid discovery survey contract: definition.fields field 'task' must be TEXT"
    }

    test("canonical task priority definitions require two options and maxSelections") {
        val missingMax = shouldThrow<ApiErrorException.BadRequestException> {
            SpecializedSurveyContractValidator.validateDefinition(
                SurveyType.TASK_PRIORITY,
                listOf(
                    SubmissionFieldDefinitionPayload(
                        "priority",
                        FieldType.MULTI_CHOICE,
                        optionIds = listOf("apply", "status")
                    )
                )
            )
        }
        missingMax.message shouldBe
            "Invalid taskPriority survey contract: definition.fields field 'priority' maxSelections must be between 1 and the number of task options"

        val oneOption = shouldThrow<ApiErrorException.BadRequestException> {
            SpecializedSurveyContractValidator.validateDefinition(
                SurveyType.TASK_PRIORITY,
                listOf(
                    SubmissionFieldDefinitionPayload(
                        "priority",
                        FieldType.MULTI_CHOICE,
                        optionIds = listOf("apply"),
                        maxSelections = 1,
                    )
                )
            )
        }
        oneOption.message shouldBe
            "Invalid taskPriority survey contract: definition.fields field 'priority' must have at least two task options"

        SpecializedSurveyContractValidator.validateDefinition(
            SurveyType.TASK_PRIORITY,
            listOf(
                SubmissionFieldDefinitionPayload(
                    "priorities",
                    FieldType.MULTI_CHOICE,
                    optionIds = listOf("apply")
                )
            )
        )
    }

    test("rejects canonical and legacy aliases in the same submission") {
        val error = shouldThrow<ApiErrorException.BadRequestException> {
            SpecializedSurveyContractValidator.validateAnswers(
                SurveyType.DISCOVERY,
                listOf(
                    textAnswer("task"),
                    textAnswer("discoveredTask"),
                    choiceAnswer("success")
                )
            )
        }
        error.message shouldBe
            "Invalid discovery survey contract: answers must not include both 'task' and legacy alias 'discoveredTask'"
    }

    test("rejects success fields that analytics cannot classify") {
        val error = shouldThrow<ApiErrorException.BadRequestException> {
            SpecializedSurveyContractValidator.validateAnswers(
                SurveyType.TOP_TASKS,
                listOf(
                    choiceAnswer("task", listOf(ChoiceOption("apply", "Søke"))),
                    choiceAnswer("success", listOf(ChoiceOption("done", "Ferdig")))
                )
            )
        }

        error.message shouldBe
            "Invalid topTasks survey contract: answers field 'success' must have exactly options yes, partial and no"
    }

    test("rejects extra success outcomes and a blocker with the wrong type") {
        val extraOutcomeError = shouldThrow<ApiErrorException.BadRequestException> {
            SpecializedSurveyContractValidator.validateAnswers(
                SurveyType.TOP_TASKS,
                listOf(
                    choiceAnswer("task", listOf(ChoiceOption("apply", "Søke"))),
                    choiceAnswer(
                        "success",
                        outcomeOptions + ChoiceOption("unknown", "Vet ikke")
                    )
                )
            )
        }
        extraOutcomeError.message shouldBe
            "Invalid topTasks survey contract: answers field 'success' must have exactly options yes, partial and no"

        val blockerTypeError = shouldThrow<ApiErrorException.BadRequestException> {
            SpecializedSurveyContractValidator.validateAnswers(
                SurveyType.DISCOVERY,
                listOf(
                    textAnswer("task"),
                    choiceAnswer("success"),
                    choiceAnswer("blocker")
                )
            )
        }
        blockerTypeError.message shouldBe
            "Invalid discovery survey contract: answers field 'blocker' must be TEXT"
    }

    test("rejects an answer value that does not match its declared field") {
        val invalidSuccess = Answer(
            fieldId = "success",
            fieldType = FieldType.SINGLE_CHOICE,
            question = Question("Fikk du gjort det?", options = outcomeOptions),
            value = AnswerValue.Text("yes")
        )

        val error = shouldThrow<ApiErrorException.BadRequestException> {
            SpecializedSurveyContractValidator.validateAnswers(
                SurveyType.DISCOVERY,
                listOf(textAnswer("task"), invalidSuccess)
            )
        }
        error.message shouldBe
            "Invalid discovery survey contract: answers field 'success' value must match SINGLE_CHOICE"
    }

    test("does not impose specialized fields on rating or custom surveys") {
        SpecializedSurveyContractValidator.validateAnswers(
            SurveyType.RATING,
            listOf(textAnswer("anything"))
        )
        SpecializedSurveyContractValidator.validateDefinition(
            SurveyType.CUSTOM,
            listOf(SubmissionFieldDefinitionPayload("anything", FieldType.TEXT))
        )
    }
})
