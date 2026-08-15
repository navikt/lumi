import { describe, expect, it } from "vitest";

import {
  csvEscape,
  toMockCsv,
  toMockExcelBase64,
  transformToBackendParams,
} from "~/server/actions/export";
import type { FeedbackDto } from "~/types/api";

function makeFeedback(partial: Partial<FeedbackDto> = {}): FeedbackDto {
  return {
    id: partial.id ?? "id-1",
    submittedAt: partial.submittedAt ?? "2026-01-01T12:00:00Z",
    app: partial.app ?? "app-1",
    surveyId: partial.surveyId ?? "survey-1",
    surveyType: partial.surveyType ?? "rating",
    context: partial.context ?? {
      deviceType: "mobile",
      viewportWidth: 390,
      viewportHeight: 844,
      screenWidth: 1170,
      screenHeight: 2532,
      url: "https://example.test/foo",
      pathname: "/foo",
    },
    metadata: partial.metadata ?? { abTest: "A" },
    answers: partial.answers ?? [
      {
        fieldId: "rating",
        fieldType: "RATING",
        question: { label: "Hvordan?" },
        value: { type: "rating", rating: 2 },
      },
      {
        fieldId: "text",
        fieldType: "TEXT",
        question: { label: "Hvorfor?" },
        value: { type: "text", text: 'Hei, "verden"\nNy linje' },
      },
    ],
    tags: partial.tags ?? ["bug", "feature"],
    sensitiveDataRedacted: partial.sensitiveDataRedacted ?? false,
  };
}

describe("export helpers", () => {
  it("csvEscape quotes values with commas/quotes/newlines", () => {
    expect(csvEscape("plain")).toBe("plain");
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('a"b')).toBe('"a""b"');
    expect(csvEscape("a\n b")).toBe('"a\n b"');
  });

  it("csvEscape prefixes potential formulas", () => {
    expect(csvEscape("=1+1")).toBe("'=1+1");
    expect(csvEscape("+SUM(A1:A2)")).toBe("'+SUM(A1:A2)");
    expect(csvEscape("-2+3")).toBe("'-2+3");
    expect(csvEscape("@calc")).toBe("'@calc");
  });

  it("csvEscape prefixes formulas even with leading whitespace", () => {
    expect(csvEscape(" =1+1")).toBe("' =1+1");
    expect(csvEscape("\t=1+1")).toBe("'\t=1+1");
  });

  it("transformToBackendParams trims and normalizes filters", () => {
    const params = transformToBackendParams({
      format: "csv",
      includeArchived: "true",
      tag: "  a, b , ,  ",
      hasText: "true",
      lowRating: "false",
      segment: "k:v,,x:y",
      deviceType: "mobile",
      theme: "theme-1",
      task: "Soknad",
      choice: ["task_choice:opt-1"],
      rating: ["rating:2"],
    });

    expect(params.tag).toEqual(["a", "b"]);
    expect(params.includeArchived).toBe("true");
    expect(params.hasText).toBe("true");
    expect(params.lowRating).toBeUndefined();
    expect(params.segment).toEqual(["k:v", "x:y"]);
    expect(params.deviceType).toBe("mobile");
    expect(params.theme).toBe("theme-1");
    expect(params.task).toBe("Soknad");
    expect(params.choice).toEqual(["task_choice:opt-1"]);
    expect(params.rating).toEqual(["rating:2"]);
  });

  it("toMockCsv creates a CSV with header + 1 row", () => {
    const item = makeFeedback({
      answers: [
        {
          fieldId: "rating",
          fieldType: "RATING",
          question: { label: "Hvordan?" },
          value: { type: "rating", rating: 1 },
        },
        {
          fieldId: "text",
          fieldType: "TEXT",
          question: { label: "Hvorfor?" },
          value: { type: "text", text: "Hei, verden" },
        },
      ],
    });

    const csv = toMockCsv([item] as unknown as FeedbackDto[]);
    const lines = csv.split("\n");

    expect(lines[0]).toContain("submittedAt,id,app,surveyId");
    expect(lines[0]).toContain("metadata,screenWidth,screenHeight");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("2026-01-01T12:00:00Z");
    expect(lines[1]).toContain('"Hei, verden"');
    expect(lines[1]).toContain("1170,2532");
  });

  it("toMockExcelBase64 returns an .xlsx payload (ZIP magic bytes)", async () => {
    const item = makeFeedback();
    const base64 = await toMockExcelBase64([item] as unknown as FeedbackDto[]);

    const buf = Buffer.from(base64, "base64");
    expect(buf.length).toBeGreaterThan(100);
    expect(buf.subarray(0, 2).toString("utf-8")).toBe("PK");
  });
});
