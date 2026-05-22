import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  LumiSurveyQuestion,
  LumiSurveySubmission,
  LumiSurveyTransport,
} from "../types.js";
import { useLumiSurvey } from "../useLumiSurvey.js";

const SURVEY_ID = "v2-test-survey";

const mixedQuestions: LumiSurveyQuestion[] = [
  {
    id: "rating",
    type: "rating",
    prompt: "How satisfied?",
    required: true,
    variant: "stars",
  },
  {
    id: "comment",
    type: "text",
    prompt: "Any comments?",
    required: false,
    maxLength: 500,
  },
  {
    id: "category",
    type: "singleChoice",
    prompt: "Category?",
    required: false,
    options: [
      { value: "bug", label: "Bug" },
      { value: "feature", label: "Feature" },
    ],
  },
];

describe("v2 transport payload", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-01T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("produces schemaVersion 2 with definition and deduplicationKey", async () => {
    const submitMock = vi.fn(async (_: LumiSurveySubmission) => {});
    const transport: LumiSurveyTransport = { submit: submitMock };

    const { result } = renderHook(() =>
      useLumiSurvey({
        surveyId: SURVEY_ID,
        questions: mixedQuestions,
        transport,
      }),
    );

    await act(() => {
      result.current.setAnswer("rating", 4);
    });

    vi.setSystemTime(new Date("2024-06-01T10:02:00.000Z"));

    await act(async () => {
      await result.current.submit();
    });

    const payload = submitMock.mock.calls[0][0].transportPayload;
    expect(payload.schemaVersion).toBe(2);
    expect(payload.deduplicationKey).toMatch(/^[A-Za-z0-9._:-]+$/);
    expect(payload.deduplicationKey.length).toBeGreaterThanOrEqual(16);
    expect(payload.deduplicationKey.length).toBeLessThanOrEqual(128);
    expect(payload.definition).toBeDefined();
    expect(payload.definition.surveyType).toBe("rating");
  });

  it("definition.fields includes ALL questions, answers only includes answered ones", async () => {
    const submitMock = vi.fn(async (_: LumiSurveySubmission) => {});
    const transport: LumiSurveyTransport = { submit: submitMock };

    const { result } = renderHook(() =>
      useLumiSurvey({
        surveyId: SURVEY_ID,
        questions: mixedQuestions,
        transport,
      }),
    );

    // Only answer the rating question — leave comment and category unanswered
    await act(() => {
      result.current.setAnswer("rating", 3);
    });

    vi.setSystemTime(new Date("2024-06-01T10:02:00.000Z"));

    await act(async () => {
      await result.current.submit();
    });

    const payload = submitMock.mock.calls[0][0].transportPayload;

    // Definition has ALL 3 fields
    expect(payload.definition.fields).toHaveLength(3);
    expect(
      payload.definition.fields.map((f: { fieldId: string }) => f.fieldId),
    ).toEqual(["rating", "comment", "category"]);

    // Answers only has the 1 answered question
    expect(payload.answers).toHaveLength(1);
    expect(payload.answers[0].fieldId).toBe("rating");
  });

  it("deduplication key is stable on retry after transport error", async () => {
    const transportError = new Error("Network failure");
    let callCount = 0;
    const submitMock = vi.fn(async (_: LumiSurveySubmission) => {
      callCount++;
      if (callCount === 1) throw transportError;
    });
    const transport: LumiSurveyTransport = { submit: submitMock };

    const { result } = renderHook(() =>
      useLumiSurvey({
        surveyId: SURVEY_ID,
        questions: mixedQuestions,
        transport,
      }),
    );

    await act(() => {
      result.current.setAnswer("rating", 5);
    });

    vi.setSystemTime(new Date("2024-06-01T10:02:00.000Z"));

    // First submit — fails
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.status).toBe("error");

    // Second submit — succeeds, should use SAME key
    vi.setSystemTime(new Date("2024-06-01T10:03:00.000Z"));
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.status).toBe("success");

    const key1 = submitMock.mock.calls[0][0].transportPayload.deduplicationKey;
    const key2 = submitMock.mock.calls[1][0].transportPayload.deduplicationKey;
    expect(key1).toBe(key2);
  });

  it("deduplication key rotates after successful submit", async () => {
    const submitMock = vi.fn(async (_: LumiSurveySubmission) => {});
    const transport: LumiSurveyTransport = { submit: submitMock };

    const { result } = renderHook(() =>
      useLumiSurvey({
        surveyId: SURVEY_ID,
        questions: [{ id: "r", type: "rating", prompt: "Rate?" }],
        transport,
      }),
    );

    await act(() => {
      result.current.setAnswer("r", 5);
    });

    vi.setSystemTime(new Date("2024-06-01T10:02:00.000Z"));
    await act(async () => {
      await result.current.submit();
    });

    // Reset and submit again to get a new key
    await act(() => {
      result.current.reset();
    });

    await act(() => {
      result.current.setAnswer("r", 3);
    });

    vi.setSystemTime(new Date("2024-06-01T10:04:00.000Z"));
    await act(async () => {
      await result.current.submit();
    });

    const key1 = submitMock.mock.calls[0][0].transportPayload.deduplicationKey;
    const key2 = submitMock.mock.calls[1][0].transportPayload.deduplicationKey;
    expect(key1).not.toBe(key2);
  });

  it("deduplication key rotates on reset", async () => {
    const submitMock = vi.fn(async (_: LumiSurveySubmission) => {});
    const transport: LumiSurveyTransport = { submit: submitMock };

    const { result } = renderHook(() =>
      useLumiSurvey({
        surveyId: SURVEY_ID,
        questions: [{ id: "r", type: "rating", prompt: "Rate?" }],
        transport,
      }),
    );

    // Submit once
    await act(() => {
      result.current.setAnswer("r", 4);
    });
    vi.setSystemTime(new Date("2024-06-01T10:02:00.000Z"));
    await act(async () => {
      await result.current.submit();
    });
    const key1 = submitMock.mock.calls[0][0].transportPayload.deduplicationKey;

    // Reset
    await act(() => {
      result.current.reset();
    });

    // Submit again
    await act(() => {
      result.current.setAnswer("r", 2);
    });
    vi.setSystemTime(new Date("2024-06-01T10:05:00.000Z"));
    await act(async () => {
      await result.current.submit();
    });
    const key2 = submitMock.mock.calls[1][0].transportPayload.deduplicationKey;

    expect(key1).not.toBe(key2);
  });

  it("does not expose deduplicationKey in the public hook API", () => {
    const transport: LumiSurveyTransport = { submit: vi.fn() };

    const { result } = renderHook(() =>
      useLumiSurvey({
        surveyId: SURVEY_ID,
        questions: mixedQuestions,
        transport,
      }),
    );

    // Public API should only expose these keys
    const publicKeys = Object.keys(result.current);
    expect(publicKeys).toEqual([
      "answers",
      "status",
      "error",
      "setAnswer",
      "submit",
      "validate",
      "reset",
    ]);
  });

  it("includes top-level surveyType matching definition.surveyType", async () => {
    const submitMock = vi.fn(async (_: LumiSurveySubmission) => {});
    const transport: LumiSurveyTransport = { submit: submitMock };

    const { result } = renderHook(() =>
      useLumiSurvey({
        surveyId: SURVEY_ID,
        questions: mixedQuestions,
        transport,
      }),
    );

    await act(() => {
      result.current.setAnswer("rating", 4);
    });

    vi.setSystemTime(new Date("2024-06-01T10:02:00.000Z"));

    await act(async () => {
      await result.current.submit();
    });

    const payload = submitMock.mock.calls[0][0].transportPayload;
    expect(payload.surveyType).toBe("rating");
    expect(payload.surveyType).toBe(payload.definition.surveyType);
  });

  it("definition includes correct field metadata for rating and choice types", async () => {
    const submitMock = vi.fn(async (_: LumiSurveySubmission) => {});
    const transport: LumiSurveyTransport = { submit: submitMock };

    const { result } = renderHook(() =>
      useLumiSurvey({
        surveyId: SURVEY_ID,
        questions: mixedQuestions,
        transport,
      }),
    );

    await act(() => {
      result.current.setAnswer("rating", 5);
    });

    vi.setSystemTime(new Date("2024-06-01T10:02:00.000Z"));
    await act(async () => {
      await result.current.submit();
    });

    const definition = submitMock.mock.calls[0][0].transportPayload.definition;

    expect(definition.fields[0]).toEqual({
      fieldId: "rating",
      fieldType: "RATING",
      ratingVariant: "stars",
      ratingScale: 5,
    });

    expect(definition.fields[1]).toEqual({
      fieldId: "comment",
      fieldType: "TEXT",
    });

    expect(definition.fields[2]).toEqual({
      fieldId: "category",
      fieldType: "SINGLE_CHOICE",
      optionIds: ["bug", "feature"],
    });
  });
});
