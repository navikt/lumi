import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import ExcelJS from "exceljs";
import {
  filterMockArchiveVisibility,
  mockFeedbackItems,
} from "~/mock/mockData";
import { applyFeedbackFilters } from "~/mock/utils/filters";
import { authMiddleware } from "~/server/middleware/auth";
import {
  type AuthContext,
  buildUrl,
  getHeaders,
  isMockMode,
  mockDelay,
} from "~/server/utils";
import { type ExportParams, ExportParamsSchema } from "~/types/schemas";
import { handleApiResponse } from "../fetchUtils";

/** Number of records matching the filters, before the export limit is applied. */
export const EXPORT_TOTAL_HEADER = "X-Lumi-Export-Total";
/** Number of records included in the exported file. */
export const EXPORT_COUNT_HEADER = "X-Lumi-Export-Count";

/** Maximum number of records in one export. Same as `ExportService.MAX_EXPORT_SIZE` in the API. */
export const MAX_EXPORT_SIZE = 10_000;

/** Byte order mark that makes Excel detect UTF-8 in CSV files (same as the API). */
const UTF8_BOM = "\uFEFF";

interface ExportCounts {
  /** Matching records. `null` when the API does not send the header. */
  total: number | null;
  /** Records in the file. `null` when the API does not send the header. */
  count: number | null;
}

export interface ExportResult extends ExportCounts {
  data: string;
  filename: string;
  contentType: string;
}

function toMockSearchParams(data: ExportParams): URLSearchParams {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      if (value.length > 0) {
        searchParams.set(key, value.join(","));
      }
      continue;
    }

    if (value) {
      searchParams.set(key, value);
    }
  }

  return searchParams;
}

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const raw = String(value);
  const str = isPotentialCsvFormula(raw) ? `'${raw}` : raw;
  if (/[\n\r",]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function isPotentialCsvFormula(value: string): boolean {
  const trimmed = value.trimStart();
  const first = trimmed[0];
  return first === "=" || first === "+" || first === "-" || first === "@";
}

export function getFirstRating(
  item: (typeof mockFeedbackItems)[number],
): number | null {
  const ratingAnswer = item.answers.find((a) => a.fieldType === "RATING");
  return ratingAnswer?.fieldType === "RATING"
    ? ratingAnswer.value.rating
    : null;
}

export function getFirstText(item: (typeof mockFeedbackItems)[number]): string {
  const textAnswer = item.answers.find((a) => a.fieldType === "TEXT");
  return textAnswer?.fieldType === "TEXT" ? textAnswer.value.text : "";
}

/** CSV and Excel columns, in the same order as `ExportService` in the API. */
const EXPORT_COLUMNS = [
  { csv: "id", excel: "ID", width: 38 },
  { csv: "submittedAt", excel: "Tidspunkt", width: 26 },
  { csv: "app", excel: "App", width: 16 },
  { csv: "surveyId", excel: "Survey", width: 24 },
  { csv: "rating", excel: "Vurdering", width: 11 },
  { csv: "feedback", excel: "Tilbakemelding", width: 60 },
  { csv: "sensitiveDataRedacted", excel: "Sensitiv data fjernet", width: 23 },
  { csv: "screenWidth", excel: "Skjermbredde", width: 14 },
  { csv: "screenHeight", excel: "Skjermhøyde", width: 13 },
] as const;

function toExportRow(
  item: (typeof mockFeedbackItems)[number],
  sensitiveDataRedacted: string,
): string[] {
  return [
    item.id,
    item.submittedAt,
    item.app ?? "",
    item.surveyId,
    String(getFirstRating(item) ?? ""),
    getFirstText(item),
    sensitiveDataRedacted,
    String(item.context?.screenWidth ?? ""),
    String(item.context?.screenHeight ?? ""),
  ];
}

export function toMockCsv(items: typeof mockFeedbackItems): string {
  const header = EXPORT_COLUMNS.map((column) => column.csv).join(",");
  const rows = items.map((item) =>
    toExportRow(item, String(item.sensitiveDataRedacted))
      .map(csvEscape)
      .join(","),
  );

  return `${UTF8_BOM}${[header, ...rows].map((line) => `${line}\n`).join("")}`;
}

export async function toMockExcelBase64(
  items: typeof mockFeedbackItems,
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Feedback");

  sheet.columns = EXPORT_COLUMNS.map((column) => ({
    header: column.excel,
    width: column.width,
  }));

  const sanitize = (v: string) => (isPotentialCsvFormula(v) ? `'${v}` : v);

  for (const item of items) {
    const redacted = item.sensitiveDataRedacted ? "Ja" : "Nei";
    sheet.addRow(toExportRow(item, redacted).map(sanitize));
  }

  const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
  return Buffer.from(buffer).toString("base64");
}

function parseCountHeader(value: string | null): number | null {
  const trimmed = value?.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) {
    return null;
  }
  return Number(trimmed);
}

export function readExportCounts(headers: Headers): ExportCounts {
  return {
    total: parseCountHeader(headers.get(EXPORT_TOTAL_HEADER)),
    count: parseCountHeader(headers.get(EXPORT_COUNT_HEADER)),
  };
}

function fileExtension(format: ExportParams["format"]): string {
  return format === "excel" ? "xlsx" : format;
}

/**
 * Converts the API response to the server function result.
 * Reads the body as raw bytes, so the CSV byte order mark reaches the downloaded file unchanged.
 */
export async function toExportResult(
  response: Response,
  format: ExportParams["format"],
  today: Date = new Date(),
): Promise<ExportResult> {
  const arrayBuffer = await response.arrayBuffer();
  const contentType =
    response.headers.get("Content-Type") || "application/octet-stream";
  const date = today.toISOString().split("T")[0];

  return {
    data: Buffer.from(arrayBuffer).toString("base64"),
    filename: `lumi-export-${date}.${fileExtension(format)}`,
    contentType,
    ...readExportCounts(response.headers),
  };
}

function transformToBackendParams(data: ExportParams) {
  const tag = data.tag
    ?.split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  // Canonicalize: phrase wins over query (same rule as useFeedback)
  const effectiveQuery = data.phrase ? undefined : data.query;

  return {
    format: data.format,
    team: data.team,
    includeArchived: data.includeArchived === "true" ? "true" : undefined,
    app: data.app,
    surveyId: data.surveyId,
    fromDate: data.fromDate,
    toDate: data.toDate,
    hasText: data.hasText === "true" ? "true" : undefined,
    lowRating: data.lowRating === "true" ? "true" : undefined,
    query: effectiveQuery,
    tag: tag && tag.length > 0 ? tag : undefined,
    deviceType: data.deviceType,
    theme: data.theme,
    task: data.task,
    segment: data.segment?.split(",").filter(Boolean),
    choice: data.choice?.length ? data.choice : undefined,
    rating: data.rating?.length ? data.rating : undefined,
    phrase: data.phrase,
  };
}

export { transformToBackendParams };

export const exportServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(ExportParamsSchema))
  .handler(async ({ data, context }): Promise<ExportResult> => {
    const { backendUrl, oboToken } = context as AuthContext;

    if (isMockMode()) {
      await mockDelay();

      const matching = applyFeedbackFilters(
        filterMockArchiveVisibility(
          mockFeedbackItems,
          data.includeArchived === "true",
        ),
        toMockSearchParams(data),
      );
      const filtered = matching.slice(0, MAX_EXPORT_SIZE);
      const counts = { total: matching.length, count: filtered.length };

      const filename = `lumi-export-mock.${fileExtension(data.format)}`;

      if (data.format === "json") {
        const json = JSON.stringify(filtered, null, 2);
        return {
          data: Buffer.from(json, "utf-8").toString("base64"),
          filename,
          contentType: "application/json",
          ...counts,
        };
      }

      if (data.format === "excel") {
        return {
          data: await toMockExcelBase64(filtered),
          filename,
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          ...counts,
        };
      }

      const csv = toMockCsv(filtered);
      return {
        data: Buffer.from(csv, "utf-8").toString("base64"),
        filename,
        contentType: "text/csv; charset=utf-8",
        ...counts,
      };
    }

    const backendParams = transformToBackendParams(data);
    const url = buildUrl(backendUrl, "/api/v1/intern/export", backendParams);
    const response = await fetch(url, {
      headers: getHeaders(oboToken),
    });

    await handleApiResponse(response);

    return toExportResult(response, data.format);
  });
