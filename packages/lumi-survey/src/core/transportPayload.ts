import { buildDefinitionBlock } from "./definitionBlock.js";
import type {
  ChoiceOption,
  LumiSurveyAnswerValue,
  LumiSurveyContext,
  LumiSurveyQuestion,
  LumiSurveyTransportPayload,
  RatingQuestion,
  RatingVariant,
  SurveyType,
  TransportAnswer,
} from "./types";
import { RATING_SCALES } from "./types";

/**
 * Infers the survey type from the question structure.
 * This ensures analytics always gets a valid surveyType even if not explicitly set.
 */
export function inferSurveyType(questions: LumiSurveyQuestion[]): SurveyType {
  // Check for Discovery pattern: has "discoveredTask" text field
  const hasDiscoveredTask = questions.some(
    (q) => q.id === "discoveredTask" && q.type === "text",
  );
  if (hasDiscoveredTask) return "discovery";

  // Check for TopTasks pattern: has "task" single choice + "taskSuccess"
  const hasTask = questions.some(
    (q) => q.id === "task" && q.type === "singleChoice",
  );
  const hasTaskSuccess = questions.some(
    (q) => q.id === "taskSuccess" && q.type === "singleChoice",
  );
  if (hasTask && hasTaskSuccess) return "topTasks";

  // Check for TaskPriority pattern: has "priorities" multi choice
  const hasPriorities = questions.some(
    (q) => q.id === "priorities" && q.type === "multiChoice",
  );
  if (hasPriorities) return "taskPriority";

  // Check for Rating pattern: has a rating question
  const hasRating = questions.some((q) => q.type === "rating");
  if (hasRating) return "rating";

  // Default fallback
  return "custom";
}

export function buildTransportPayload(
  surveyId: string,
  answers: Record<string, LumiSurveyAnswerValue>,
  questions: LumiSurveyQuestion[],
  deduplicationKey: string,
  surveyType?: SurveyType,
  context?: LumiSurveyContext,
  startedAt?: string,
  submittedAt?: string,
): LumiSurveyTransportPayload {
  if (!submittedAt) {
    throw new Error("Lumi: submittedAt is required to build transport payload");
  }

  // Add survey type - use provided or infer from questions
  const resolvedSurveyType = surveyType ?? inferSurveyType(questions);

  const definition = buildDefinitionBlock(questions, resolvedSurveyType);

  const payload: LumiSurveyTransportPayload = {
    schemaVersion: 2,
    surveyId,
    surveyType: resolvedSurveyType,
    submittedAt,
    startedAt,
    deduplicationKey,
    definition,
    context,
    answers: [],
  };

  // Calculate and add time to complete if both timestamps are available
  if (startedAt) {
    const startTime = new Date(startedAt).getTime();
    const endTime = new Date(submittedAt).getTime();
    const timeToCompleteMs = endTime - startTime;

    // Only add if it's a reasonable value (between 1 second and 30 minutes)
    if (timeToCompleteMs > 1000 && timeToCompleteMs < 1800000) {
      payload.timeToCompleteMs = timeToCompleteMs;
    }
  }

  // Add structured answers array (rich metadata for analytics)
  // Only includes actually answered questions
  const answersList: TransportAnswer[] = [];

  for (const question of questions) {
    const value = answers[question.id];
    // Skip if unanswered
    if (value === undefined || value === null || value === "") continue;

    let fieldType: TransportAnswer["fieldType"] = "TEXT";
    let answerValue: TransportAnswer["value"] = {
      type: "text",
      text: String(value),
    };

    // Use proper type narrowing based on question.type
    switch (question.type) {
      case "rating": {
        fieldType = "RATING";
        // Get variant from question config, defaulting to emoji
        const ratingQ = question as RatingQuestion;
        const variant: RatingVariant = ratingQ.variant ?? "emoji";
        const scale = RATING_SCALES[variant];
        answerValue = {
          type: "rating",
          rating: Number(value),
          ratingVariant: variant,
          ratingScale: scale,
        };
        break;
      }
      case "multiChoice":
        fieldType = "MULTI_CHOICE";
        answerValue = {
          type: "multiChoice",
          selectedOptionIds: Array.isArray(value) ? value : [String(value)],
        };
        break;
      case "singleChoice":
        fieldType = "SINGLE_CHOICE";
        answerValue = { type: "singleChoice", selectedOptionId: String(value) };
        break;
      default:
        fieldType = "TEXT";
        answerValue = { type: "text", text: String(value) };
        break;
    }

    // Extract options if they exist on the question (for choice types)
    const options =
      "options" in question && question.options
        ? question.options.map((opt: ChoiceOption) => ({
            id: opt.value,
            label: opt.label,
          }))
        : undefined;

    answersList.push({
      fieldId: question.id,
      fieldType: fieldType,
      question: {
        label: question.prompt,
        ...(question.description ? { description: question.description } : {}),
        ...(options ? { options } : {}),
      },
      value: answerValue,
    });
  }

  payload.answers = answersList;

  return payload;
}
