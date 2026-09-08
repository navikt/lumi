import type {
  FeedbackDto,
  QuestionTrendInterval,
  QuestionTrendResponse,
} from "~/types/api";
import { applyFeedbackFilters } from "./utils/filters";

// The response contract retains the threshold, but no non-empty bucket is hidden.
const PRIVACY_THRESHOLD = 1;
const OSLO_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Oslo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function osloCalendarDate(instant: string): string {
  const parts = OSLO_DATE_FORMAT.formatToParts(new Date(instant));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function isoWeekStart(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  const daysSinceMonday = (value.getUTCDay() + 6) % 7;
  value.setUTCDate(value.getUTCDate() - daysSinceMonday);
  return value.toISOString().slice(0, 10);
}

function bucketStart(
  submittedAt: string,
  interval: QuestionTrendInterval,
): string {
  const date = osloCalendarDate(submittedAt);
  if (interval === "month") return `${date.slice(0, 7)}-01`;
  if (interval === "week") return isoWeekStart(date);
  return date;
}

export function calculateQuestionTrend(
  items: FeedbackDto[],
  params: URLSearchParams,
  fieldId: string,
  interval: QuestionTrendInterval,
): QuestionTrendResponse | null {
  const matchingAnswers = applyFeedbackFilters(items, params)
    .flatMap((item) =>
      item.answers
        .filter((answer) => answer.fieldId === fieldId)
        .map((answer) => ({ item, answer })),
    )
    .filter(({ answer }) =>
      ["RATING", "SINGLE_CHOICE", "MULTI_CHOICE"].includes(answer.fieldType),
    );

  const catalogParams = new URLSearchParams();
  for (const key of ["surveyId", "app"]) {
    const value = params.get(key);
    if (value) catalogParams.set(key, value);
  }
  const catalogAnswers = applyFeedbackFilters(items, catalogParams).flatMap(
    (item) =>
      item.answers
        .filter(
          (answer) =>
            answer.fieldId === fieldId &&
            ["RATING", "SINGLE_CHOICE", "MULTI_CHOICE"].includes(
              answer.fieldType,
            ),
        )
        .map((answer) => ({ item, answer })),
  );
  if (catalogAnswers.length === 0) return null;

  const fieldTypes = new Set(
    catalogAnswers.map(({ answer }) => answer.fieldType),
  );
  if (fieldTypes.size !== 1) {
    throw new Error("A question trend cannot combine different field types");
  }

  const latest = [...catalogAnswers].sort((a, b) =>
    b.item.submittedAt.localeCompare(a.item.submittedAt),
  )[0];
  if (!latest) return null;

  const fieldType = latest.answer
    .fieldType as QuestionTrendResponse["fieldType"];
  const ratingAnswers = matchingAnswers
    .map(({ answer }) => answer.value)
    .filter((value) => value.type === "rating");
  const ratingContracts = new Set(
    ratingAnswers.map(
      (value) => `${value.ratingVariant ?? ""}:${value.ratingScale ?? ""}`,
    ),
  );
  const ratingMetadata = ratingAnswers.length
    ? ratingAnswers[0]
    : latest.answer.value.type === "rating"
      ? latest.answer.value
      : undefined;
  const options = new Map<string, string>();
  for (const { answer } of [...catalogAnswers].sort((a, b) =>
    b.item.submittedAt.localeCompare(a.item.submittedAt),
  )) {
    for (const option of answer.question.options ?? []) {
      if (!options.has(option.id)) options.set(option.id, option.label);
    }
  }
  const buckets = new Map<
    string,
    {
      ratings: number[];
      respondents: Set<string>;
      choices: Map<string, Set<string>>;
    }
  >();

  for (const { item, answer } of matchingAnswers) {
    const startDate = bucketStart(item.submittedAt, interval);
    const bucket = buckets.get(startDate) ?? {
      ratings: [],
      respondents: new Set<string>(),
      choices: new Map<string, Set<string>>(),
    };

    if (answer.fieldType === "RATING" && answer.value.type === "rating") {
      if (Number.isFinite(answer.value.rating)) {
        bucket.ratings.push(answer.value.rating);
        bucket.respondents.add(item.id);
      }
    } else if (
      answer.fieldType === "SINGLE_CHOICE" &&
      answer.value.type === "singleChoice" &&
      answer.value.selectedOptionId
    ) {
      bucket.respondents.add(item.id);
      const selected = answer.value.selectedOptionId;
      const respondents = bucket.choices.get(selected) ?? new Set<string>();
      respondents.add(item.id);
      bucket.choices.set(selected, respondents);
    } else if (
      answer.fieldType === "MULTI_CHOICE" &&
      answer.value.type === "multiChoice"
    ) {
      const selected = new Set(answer.value.selectedOptionIds.filter(Boolean));
      if (selected.size > 0) bucket.respondents.add(item.id);
      for (const optionId of selected) {
        const respondents = bucket.choices.get(optionId) ?? new Set<string>();
        respondents.add(item.id);
        bucket.choices.set(optionId, respondents);
      }
    }

    for (const option of answer.question.options ?? []) {
      if (!options.has(option.id)) options.set(option.id, option.label);
    }
    buckets.set(startDate, bucket);
  }

  for (const bucket of buckets.values()) {
    for (const optionId of bucket.choices.keys()) {
      if (!options.has(optionId)) options.set(optionId, optionId);
    }
  }

  return {
    fieldId,
    fieldType,
    label: latest.answer.question.label || fieldId,
    ratingVariant:
      ratingContracts.size > 1 ? null : ratingMetadata?.ratingVariant,
    ratingScale: ratingContracts.size > 1 ? null : ratingMetadata?.ratingScale,
    interval,
    privacyThreshold: PRIVACY_THRESHOLD,
    options: [...options].map(([id, label]) => ({ id, label })),
    buckets: [...buckets]
      .sort(([left], [right]) => left.localeCompare(right))
      .flatMap(([startDate, bucket]) => {
        const responseCount =
          fieldType === "RATING"
            ? bucket.ratings.length
            : bucket.respondents.size;
        if (responseCount === 0) return [];

        const masked = responseCount < PRIVACY_THRESHOLD;
        return [
          {
            startDate,
            masked,
            responseCount: masked ? undefined : responseCount,
            average:
              masked || fieldType !== "RATING"
                ? undefined
                : bucket.ratings.reduce((sum, value) => sum + value, 0) /
                  responseCount,
            ratingDistribution:
              masked || fieldType !== "RATING"
                ? {}
                : bucket.ratings.reduce<Record<string, number>>(
                    (counts, rating) => {
                      counts[rating] = (counts[rating] ?? 0) + 1;
                      return counts;
                    },
                    {},
                  ),
            distribution:
              masked || fieldType === "RATING"
                ? {}
                : Object.fromEntries(
                    [...options.keys()].map((optionId) => {
                      const count = bucket.choices.get(optionId)?.size ?? 0;
                      return [
                        optionId,
                        {
                          count,
                          percentage:
                            Math.round((count * 1_000) / responseCount) / 10,
                        },
                      ];
                    }),
                  ),
          },
        ];
      }),
  };
}
