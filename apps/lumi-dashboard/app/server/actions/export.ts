import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import ExcelJS from "exceljs";
import { mockFeedbackItems } from "~/mock/mockData";
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

interface ExportResult {
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

export function toMockCsv(items: typeof mockFeedbackItems): string {
  const header = [
    "submittedAt",
    "id",
    "app",
    "surveyId",
    "deviceType",
    "rating",
    "text",
    "tags",
    "url",
    "pathname",
    "metadata",
  ].join(",");

  const rows = items.map((item) => {
    const rating = getFirstRating(item);
    const text = getFirstText(item);
    const tags = item.tags?.join("|") ?? "";
    const url = item.context?.url ?? "";
    const pathname = item.context?.pathname ?? "";
    const metadata = item.metadata ? JSON.stringify(item.metadata) : "";

    return [
      csvEscape(item.submittedAt),
      csvEscape(item.id),
      csvEscape(item.app ?? ""),
      csvEscape(item.surveyId),
      csvEscape(item.context?.deviceType ?? ""),
      csvEscape(rating ?? ""),
      csvEscape(text),
      csvEscape(tags),
      csvEscape(url),
      csvEscape(pathname),
      csvEscape(metadata),
    ].join(",");
  });

  return [header, ...rows].join("\n");
}

export async function toMockExcelBase64(
  items: typeof mockFeedbackItems,
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Export");

  sheet.columns = [
    { header: "submittedAt", key: "submittedAt", width: 22 },
    { header: "id", key: "id", width: 18 },
    { header: "app", key: "app", width: 16 },
    { header: "surveyId", key: "surveyId", width: 18 },
    { header: "deviceType", key: "deviceType", width: 12 },
    { header: "rating", key: "rating", width: 8 },
    { header: "text", key: "text", width: 40 },
    { header: "tags", key: "tags", width: 24 },
    { header: "url", key: "url", width: 40 },
    { header: "pathname", key: "pathname", width: 28 },
    { header: "metadata", key: "metadata", width: 40 },
  ];

  const sanitize = (v: string) => (isPotentialCsvFormula(v) ? `'${v}` : v);

  for (const item of items) {
    const submittedAt = item.submittedAt;
    const id = item.id;
    const app = item.app ?? "";
    const surveyId = item.surveyId;
    const deviceType = item.context?.deviceType ?? "";
    const rating = String(getFirstRating(item) ?? "");
    const text = getFirstText(item);
    const tags = item.tags?.join("|") ?? "";
    const url = item.context?.url ?? "";
    const pathname = item.context?.pathname ?? "";
    const metadata = item.metadata ? JSON.stringify(item.metadata) : "";

    sheet.addRow({
      submittedAt: sanitize(submittedAt),
      id: sanitize(id),
      app: sanitize(app),
      surveyId: sanitize(surveyId),
      deviceType: sanitize(deviceType),
      rating: sanitize(rating),
      text: sanitize(text),
      tags: sanitize(tags),
      url: sanitize(url),
      pathname: sanitize(pathname),
      metadata: sanitize(metadata),
    });
  }

  const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
  return Buffer.from(buffer).toString("base64");
}

function transformToBackendParams(data: ExportParams) {
  const tag = data.tag
    ?.split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return {
    format: data.format,
    team: data.team,
    app: data.app,
    surveyId: data.surveyId,
    fromDate: data.fromDate,
    toDate: data.toDate,
    hasText: data.hasText === "true" ? "true" : undefined,
    lowRating: data.lowRating === "true" ? "true" : undefined,
    query: data.query,
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

      const filtered = applyFeedbackFilters(
        mockFeedbackItems,
        toMockSearchParams(data),
      ).slice(0, 10_000);

      const extension = data.format === "excel" ? "xlsx" : data.format;
      const filename = `lumi-export-mock.${extension}`;

      if (data.format === "json") {
        const json = JSON.stringify(filtered, null, 2);
        return {
          data: Buffer.from(json, "utf-8").toString("base64"),
          filename,
          contentType: "application/json",
        };
      }

      if (data.format === "excel") {
        return {
          data: await toMockExcelBase64(filtered),
          filename,
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        };
      }

      const csv = toMockCsv(filtered);
      return {
        data: Buffer.from(csv, "utf-8").toString("base64"),
        filename,
        contentType: "text/csv; charset=utf-8",
      };
    }

    const backendParams = transformToBackendParams(data);
    const url = buildUrl(backendUrl, "/api/v1/intern/export", backendParams);
    const response = await fetch(url, {
      headers: getHeaders(oboToken),
    });

    await handleApiResponse(response);

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const contentType =
      response.headers.get("Content-Type") || "application/octet-stream";
    const extension = data.format === "excel" ? "xlsx" : data.format;
    const filename = `lumi-export-${new Date().toISOString().split("T")[0]}.${extension}`;

    return { data: base64, filename, contentType };
  });
