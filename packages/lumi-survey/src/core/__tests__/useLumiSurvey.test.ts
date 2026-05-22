import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  LumiSurveyAnswerValue,
  LumiSurveyEvents,
  LumiSurveyQuestion,
  LumiSurveySubmission,
  LumiSurveySubmitResult,
  LumiSurveyTransport,
} from "../types.js";
import { useLumiSurvey } from "../useLumiSurvey.js";

const _delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const requiredQuestions: LumiSurveyQuestion[] = [
  {
    id: "rating",
    type: "rating",
    prompt: "Hvor fornøyd er du?",
    required: true,
  },
  {
    id: "feedback",
    type: "text",
    prompt: "Hva kan vi forbedre?",
    required: true,
    maxLength: 500,
  },
  {
    id: "free-text",
    type: "text",
    prompt: "Andre kommentarer?",
    required: false,
    maxLength: 500,
  },
];

const optionalMainQuestionSurvey: LumiSurveyQuestion[] = [
  {
    id: "rating",
    type: "rating",
    prompt: "Hvor fornøyd er du?",
    required: true,
  },
  {
    id: "feedback",
    type: "text",
    prompt: "Hva kan vi forbedre?",
    required: false,
    maxLength: 500,
  },
];

const SURVEY_ID = "test-survey";

const INITIAL_TIME = new Date("2024-01-01T12:00:00.000Z");
const SUBMIT_TIME = new Date("2024-01-01T12:05:00.000Z");
const RESET_TIME = new Date("2024-01-01T12:07:00.000Z");
const POST_RESET_SUBMIT_TIME = new Date("2024-01-01T12:09:00.000Z");

function createEventSpies(): LumiSurveyEvents {
  return {
    onAnswer: vi.fn(),
    onValidationFailed: vi.fn(),
    onSubmitStart: vi.fn(),
    onSubmitSuccess: vi.fn(),
    onSubmitError: vi.fn(),
    onReset: vi.fn(),
  };
}

describe("useLumiSurvey", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(INITIAL_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns validation error when required answers are missing", async () => {
    const submitMock = vi.fn(async (payload: LumiSurveySubmission) => {
      void payload;
    });
    const transport: LumiSurveyTransport = {
      submit: submitMock,
    };

    const { result } = renderHook(() =>
      useLumiSurvey({
        surveyId: SURVEY_ID,
        questions: requiredQuestions,
        transport,
      }),
    );

    let submission: LumiSurveySubmitResult | undefined;
    await act(async () => {
      submission = await result.current.submit();
    });
    expect(submission).toBeDefined();
    if (!submission) {
      throw new Error("Submission result expected");
    }

    expect(submission.ok).toBe(false);
    if (!submission.ok) {
      expect(submission.error.type).toBe("validation");
      if (submission.error.type === "validation") {
        expect(submission.error.missing).toEqual(["rating", "feedback"]);
      }
    }

    expect(submitMock).not.toHaveBeenCalled();
    expect(result.current.status).toBe("error");
  });

  it("allows submissions when the main question is optional", async () => {
    const submitMock = vi.fn(async (payload: LumiSurveySubmission) => {
      void payload;
    });
    const transport: LumiSurveyTransport = {
      submit: submitMock,
    };

    const { result } = renderHook(() =>
      useLumiSurvey({
        surveyId: SURVEY_ID,
        questions: optionalMainQuestionSurvey,
        transport,
      }),
    );

    await act(() => {
      result.current.setAnswer("rating", 5);
    });

    let submission: LumiSurveySubmitResult | undefined;
    await act(async () => {
      submission = await result.current.submit();
    });

    expect(submission).toBeDefined();
    if (!submission) {
      throw new Error("Submission result expected");
    }

    expect(submission.ok).toBe(true);
    if (!submission.ok) {
      throw new Error("Expected submission to succeed");
    }

    expect(submitMock).toHaveBeenCalledTimes(1);
    const payload = submitMock.mock.calls[0][0];

    expect(payload.answers).toEqual({ rating: 5 });
    expect(payload.surveyId).toBe(SURVEY_ID);
    expect(payload.transportPayload).toMatchObject({
      schemaVersion: 2,
      surveyId: SURVEY_ID,
      definition: {
        surveyType: "rating",
      },
    });
    expect(payload.transportPayload.deduplicationKey).toMatch(
      /^[A-Za-z0-9._:-]+$/,
    );
    expect(payload.transportPayload).not.toHaveProperty("rating");
    expect(payload.transportPayload).not.toHaveProperty("feedback");
    expect(payload.transportPayload.answers).toHaveLength(1);
    expect(payload.transportPayload.answers[0]).toMatchObject({
      fieldId: "rating",
      fieldType: "RATING",
      question: {
        label: "Hvor fornøyd er du?",
      },
      value: {
        type: "rating",
        rating: 5,
        ratingVariant: "emoji",
        ratingScale: 5,
      },
    });

    expect(result.current.status).toBe("success");
    expect(result.current.error).toBeNull();
  });

  it("includes surveyType in the submission payload", async () => {
    const submitMock = vi.fn(async (payload: LumiSurveySubmission) => {
      void payload;
    });
    const transport: LumiSurveyTransport = {
      submit: submitMock,
    };

    const { result } = renderHook(() =>
      useLumiSurvey({
        surveyId: SURVEY_ID,
        questions: requiredQuestions,
        transport,
        surveyType: "topTasks",
      }),
    );

    await act(() => {
      result.current.setAnswer("rating", 5);
      result.current.setAnswer("feedback", "Good");
    });

    await act(async () => {
      await result.current.submit();
    });

    const payload = submitMock.mock.calls[0][0];
    expect(payload.transportPayload.definition.surveyType).toBe("topTasks");
  });

  it("submits answers when validation passes", async () => {
    const submitMock = vi.fn(async (payload: LumiSurveySubmission) => {
      void payload;
    });
    const transport: LumiSurveyTransport = {
      submit: submitMock,
    };

    const { result } = renderHook(() =>
      useLumiSurvey({
        surveyId: SURVEY_ID,
        questions: requiredQuestions,
        transport,
      }),
    );

    await act(() => {
      result.current.setAnswer("rating", 4);
      result.current.setAnswer("feedback", "Alt fungerer fint");
      result.current.setAnswer("free-text", "Alt fungerer fint");
    });

    vi.setSystemTime(SUBMIT_TIME);

    let submission: LumiSurveySubmitResult | undefined;
    await act(async () => {
      submission = await result.current.submit();
    });

    expect(submitMock).toHaveBeenCalledTimes(1);
    const payload = submitMock.mock.calls[0][0];

    expect(payload.surveyId).toBe(SURVEY_ID);
    expect(payload.answers).toEqual({
      rating: 4,
      feedback: "Alt fungerer fint",
      "free-text": "Alt fungerer fint",
    });
    expect(payload.transportPayload).toMatchObject({
      schemaVersion: 2,
      surveyId: SURVEY_ID,
    });
    expect(payload.transportPayload.deduplicationKey).toMatch(
      /^[A-Za-z0-9._:-]+$/,
    );
    expect(payload.transportPayload).not.toHaveProperty("rating");
    expect(payload.transportPayload).not.toHaveProperty("feedback");
    expect(payload.transportPayload).not.toHaveProperty("free-text");
    expect(payload.transportPayload.definition.surveyType).toBe("rating");
    expect(payload.transportPayload.answers).toHaveLength(3);
    expect(payload.transportPayload.answers[0]).toMatchObject({
      fieldId: "rating",
      fieldType: "RATING",
      question: { label: "Hvor fornøyd er du?" },
      value: {
        type: "rating",
        rating: 4,
        ratingVariant: "emoji",
        ratingScale: 5,
      },
    });
    expect(payload.transportPayload.answers[1]).toMatchObject({
      fieldId: "feedback",
      fieldType: "TEXT",
      question: { label: "Hva kan vi forbedre?" },
      value: { type: "text", text: "Alt fungerer fint" },
    });
    expect(payload.transportPayload.answers[2]).toMatchObject({
      fieldId: "free-text",
      fieldType: "TEXT",
      question: { label: "Andre kommentarer?" },
      value: { type: "text", text: "Alt fungerer fint" },
    });
    expect(payload.startedAt).toBe(INITIAL_TIME.toISOString());
    expect(payload.submittedAt).toBe(SUBMIT_TIME.toISOString());

    expect(submission).toBeDefined();
    if (!submission) {
      throw new Error("Submission result expected");
    }

    expect(submission.ok).toBe(true);
    if (submission.ok) {
      expect(submission.submission).toEqual(payload);
    }

    expect(result.current.status).toBe("success");
    expect(result.current.error).toBeNull();
  });

  it("surfaces transport failures and triggers error callbacks", async () => {
    const transportError = new Error("Transport failed");
    const transport: LumiSurveyTransport = {
      submit: vi.fn().mockRejectedValue(transportError),
    };
    const events = createEventSpies();

    const { result } = renderHook(() =>
      useLumiSurvey({
        surveyId: SURVEY_ID,
        questions: requiredQuestions,
        transport,
        events,
      }),
    );

    await act(() => {
      result.current.setAnswer("rating", 3);
      result.current.setAnswer("feedback", "Hei");
    });

    vi.setSystemTime(SUBMIT_TIME);

    let submission: LumiSurveySubmitResult | undefined;
    await act(async () => {
      submission = await result.current.submit();
    });

    expect(submission).toBeDefined();
    if (!submission) {
      throw new Error("Submission expected");
    }

    expect(submission.ok).toBe(false);
    if (!submission.ok) {
      expect(submission.error.type).toBe("transport");
      if (submission.error.type === "transport") {
        expect(submission.error.cause).toBe(transportError);
      }
    }

    expect(result.current.status).toBe("error");
    expect(result.current.error?.type).toBe("transport");

    expect(transport.submit).toHaveBeenCalledTimes(1);
    expect(events.onSubmitStart).toHaveBeenCalledTimes(1);
    expect(events.onSubmitError).toHaveBeenCalledWith(transportError);
    expect(events.onSubmitSuccess).not.toHaveBeenCalled();
    expect(events.onValidationFailed).not.toHaveBeenCalled();
    expect(events.onAnswer).toHaveBeenCalledWith("rating", 3);
    expect(events.onAnswer).toHaveBeenCalledWith("feedback", "Hei");
  });

  it("resets answers to the initial snapshot and refreshes startedAt", async () => {
    const submitMock = vi.fn(async (payload: LumiSurveySubmission) => {
      void payload;
    });
    const transport: LumiSurveyTransport = {
      submit: submitMock,
    };
    const events = createEventSpies();

    const initialAnswers: Record<string, LumiSurveyAnswerValue> = {
      rating: 2,
      feedback: "Initial",
    };

    const { result } = renderHook(() =>
      useLumiSurvey({
        surveyId: SURVEY_ID,
        questions: requiredQuestions,
        transport,
        events,
        initialAnswers,
      }),
    );

    expect(result.current.answers).toEqual({ rating: 2, feedback: "Initial" });

    await act(() => {
      result.current.setAnswer("rating", 5);
      result.current.setAnswer("feedback", "Updated");
      result.current.setAnswer("free-text", "Notes");
    });

    vi.setSystemTime(RESET_TIME);

    await act(() => {
      result.current.reset();
    });

    expect(result.current.answers).toEqual({ rating: 2, feedback: "Initial" });
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(events.onReset).toHaveBeenCalledTimes(1);

    vi.setSystemTime(POST_RESET_SUBMIT_TIME);

    await act(() => {
      result.current.setAnswer("rating", 4);
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(submitMock).toHaveBeenCalledTimes(1);
    const call = submitMock.mock.calls[0][0];
    expect(call.startedAt).toBe(RESET_TIME.toISOString());
    expect(call.submittedAt).toBe(POST_RESET_SUBMIT_TIME.toISOString());
    expect(call.answers.rating).toBe(4);
    expect(call.answers.feedback).toBe("Initial");
  });

  it("drops empty answer values instead of storing blanks", () => {
    const transport: LumiSurveyTransport = {
      submit: vi.fn(),
    };

    const { result } = renderHook(() =>
      useLumiSurvey({
        surveyId: SURVEY_ID,
        questions: requiredQuestions,
        transport,
      }),
    );

    act(() => {
      result.current.setAnswer("feedback", "some text");
    });
    expect(result.current.answers.feedback).toBe("some text");

    act(() => {
      result.current.setAnswer("feedback", "   ");
    });

    expect(result.current.answers).not.toHaveProperty("feedback");
  });

  it("submit validates only the provided question subset (branching)", async () => {
    const submitMock = vi.fn(async (payload: LumiSurveySubmission) => {
      void payload;
    });
    const transport: LumiSurveyTransport = {
      submit: submitMock,
    };

    // Survey where Q2 (feedback) is required but would be skipped via branching
    const { result } = renderHook(() =>
      useLumiSurvey({
        surveyId: SURVEY_ID,
        questions: requiredQuestions,
        transport,
      }),
    );

    // Only answer the rating question
    await act(() => {
      result.current.setAnswer("rating", 4);
    });

    // Without override: should fail because "feedback" is required but unanswered
    let submission: LumiSurveySubmitResult | undefined;
    await act(async () => {
      submission = await result.current.submit();
    });
    expect(submission?.ok).toBe(false);

    // With override: pass only the rating question as the visited subset
    const visitedQuestions = [requiredQuestions[0]]; // only rating
    await act(async () => {
      submission = await result.current.submit(visitedQuestions);
    });

    expect(submission?.ok).toBe(true);
    expect(submitMock).toHaveBeenCalledTimes(1);
  });

  it("validate accepts optional question subset", () => {
    const transport: LumiSurveyTransport = {
      submit: vi.fn(),
    };

    const { result } = renderHook(() =>
      useLumiSurvey({
        surveyId: SURVEY_ID,
        questions: requiredQuestions,
        transport,
      }),
    );

    act(() => {
      result.current.setAnswer("rating", 3);
    });

    // Without override: should include "feedback" as missing
    expect(result.current.validate()).toEqual(["feedback"]);

    // With override: only check rating (which is answered)
    expect(result.current.validate([requiredQuestions[0]])).toEqual([]);
  });
});
