import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  csvEscape,
  EXPORT_COUNT_HEADER,
  EXPORT_TOTAL_HEADER,
  readExportCounts,
  toExportResult,
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

  it("toMockCsv mirrors the API columns and starts with a byte order mark", () => {
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
          value: { type: "text", text: "Hei, blåbær" },
        },
      ],
    });

    const csv = toMockCsv([item] as unknown as FeedbackDto[]);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    const lines = csv.slice(1).split("\n");
    expect(lines[0]).toBe(
      "id,submittedAt,app,surveyId,rating,feedback,sensitiveDataRedacted,screenWidth,screenHeight",
    );
    expect(lines[1]).toBe(
      'id-1,2026-01-01T12:00:00Z,app-1,survey-1,1,"Hei, blåbær",false,1170,2532',
    );
    expect(lines).toEqual([lines[0], lines[1], ""]);
  });

  it("toMockExcelBase64 mirrors the API columns", async () => {
    const item = makeFeedback({ sensitiveDataRedacted: true });
    const base64 = await toMockExcelBase64([item] as unknown as FeedbackDto[]);

    const buf = Buffer.from(base64, "base64");
    expect(buf.subarray(0, 2).toString("utf-8")).toBe("PK");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buf as unknown as ArrayBuffer);
    const sheet = workbook.getWorksheet("Feedback");
    expect(sheet?.getRow(1).values).toEqual([
      undefined,
      "ID",
      "Tidspunkt",
      "App",
      "Survey",
      "Vurdering",
      "Tilbakemelding",
      "Sensitiv data fjernet",
      "Skjermbredde",
      "Skjermhøyde",
    ]);
    expect(sheet?.getRow(2).getCell(7).value).toBe("Ja");
  });

  it("readExportCounts parses the count headers", () => {
    const headers = new Headers({
      [EXPORT_TOTAL_HEADER]: "12345",
      [EXPORT_COUNT_HEADER]: "10000",
    });

    expect(readExportCounts(headers)).toEqual({ total: 12345, count: 10000 });
  });

  it("readExportCounts returns null for missing or invalid headers", () => {
    expect(readExportCounts(new Headers())).toEqual({
      total: null,
      count: null,
    });
    expect(
      readExportCounts(
        new Headers({
          [EXPORT_TOTAL_HEADER]: "-1",
          [EXPORT_COUNT_HEADER]: "mange",
        }),
      ),
    ).toEqual({ total: null, count: null });
  });

  it("toExportResult passes the CSV bytes on unchanged, including the byte order mark", async () => {
    const body = new Uint8Array([
      0xef,
      0xbb,
      0xbf,
      ...new TextEncoder().encode("id,feedback\nx,blåbær\n"),
    ]);
    const response = new Response(body, {
      headers: {
        "Content-Type": "text/csv; charset=UTF-8",
        [EXPORT_TOTAL_HEADER]: "12345",
        [EXPORT_COUNT_HEADER]: "10000",
      },
    });

    const result = await toExportResult(
      response,
      "csv",
      new Date("2026-10-14T08:00:00Z"),
    );

    expect(new Uint8Array(Buffer.from(result.data, "base64"))).toEqual(body);
    expect(result).toMatchObject({
      filename: "lumi-export-2026-10-14.csv",
      contentType: "text/csv; charset=UTF-8",
      total: 12345,
      count: 10000,
    });
  });

  it("toExportResult uses .xlsx for Excel and tolerates missing count headers", async () => {
    const response = new Response(new Uint8Array([0x50, 0x4b]), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });

    const result = await toExportResult(
      response,
      "excel",
      new Date("2026-10-14T08:00:00Z"),
    );

    expect(result.filename).toBe("lumi-export-2026-10-14.xlsx");
    expect(result.total).toBeNull();
    expect(result.count).toBeNull();
  });
});
