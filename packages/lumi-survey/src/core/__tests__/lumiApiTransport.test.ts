import { describe, expect, it, vi } from "vitest";

import type { FeedbackSubmissionV1 } from "@navikt/lumi-types";
import {
  createLumiApiTransport,
  submitFeedbackToLumiApi,
} from "../lumiApiTransport";
import type { LumiSurveyTransportPayload } from "../types";
import type { TransportAnswer } from "../types";

function makeValidSubmission(
  overrides?: Partial<FeedbackSubmissionV1>,
): FeedbackSubmissionV1 {
  return {
    schemaVersion: 1,
    surveyId: "survey-1",
    surveyType: "rating",
    submittedAt: "2026-01-14T12:00:00.000Z",
    startedAt: "2026-01-14T11:59:00.000Z",
    timeToCompleteMs: 60_000,
    context: {
      url: "https://example.test/path",
      pathname: "/path",
      deviceType: "desktop",
      viewport: { width: 1200, height: 800 },
      userAgent: "unit-test",
      tags: { rolle: "arbeidsgiver", harSykmelding: true, alder: 42 },
      debug: { sessionId: "abc" },
    },
    answers: [
      {
        fieldId: "rating",
        fieldType: "RATING",
        question: { label: "Hvor fornøyd er du?" },
        value: {
          type: "rating",
          rating: 5,
          ratingVariant: "emoji",
          ratingScale: 5,
        },
      },
    ],
    ...overrides,
  };
}

function makeValidTransportPayload(): LumiSurveyTransportPayload {
  const submission = makeValidSubmission({
    startedAt: undefined,
    context: undefined,
  });

  const answers: TransportAnswer[] = [
    {
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
    },
  ];

  // The transport payload is a strict subset of the submission contract.
  return {
    schemaVersion: 1,
    surveyId: submission.surveyId,
    surveyType: submission.surveyType,
    submittedAt: submission.submittedAt,
    startedAt: "2026-01-14T11:59:00.000Z",
    timeToCompleteMs: submission.timeToCompleteMs ?? undefined,
    answers,
  };
}

describe("lumiApiTransport", () => {
  it("submits a valid schemaVersion=1 payload and parses id", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      statusText: "Created",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ id: "123" }),
    });

    const result = await submitFeedbackToLumiApi(makeValidSubmission(), {
      endpoint: "https://api.test/api/v1/feedback",
      fetchFn,
      headers: { authorization: "Bearer test" },
    });

    expect(result.id).toBe("123");
    expect(fetchFn).toHaveBeenCalledTimes(1);

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.test/api/v1/feedback");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).authorization).toBe(
      "Bearer test",
    );
  });

  it("createLumiApiTransport submits submission.transportPayload", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      statusText: "Created",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ id: "abc" }),
    });

    const transport = createLumiApiTransport({
      endpoint: "https://api.test/api/v1/feedback",
      fetchFn,
    });

    await transport.submit({
      surveyId: "survey-1",
      answers: { rating: 5 },
      startedAt: "2026-01-14T11:59:00.000Z",
      submittedAt: "2026-01-14T12:00:00.000Z",
      transportPayload: makeValidTransportPayload(),
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
