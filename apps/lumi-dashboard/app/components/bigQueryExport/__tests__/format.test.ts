import { describe, expect, it } from "vitest";
import { BigQueryExportProblemCodeSchema } from "~/types/bigQueryExport";
import {
  bigQueryConsoleUrl,
  formatTimestamp,
  nextRunText,
  problemText,
  rowSummary,
  setupSql,
} from "../format";

describe("BigQuery export formatting", () => {
  it("builds setup SQL for the team's dataset with Lumi's service account", () => {
    const sql = setupSql({
      projectId: "team-esyfo-prod-1a2b",
      datasetId: "lumi",
      team: "team-esyfo",
      serviceAccount: "lumi-api@nais-prod.iam.gserviceaccount.com",
      location: "europe-north1",
    });

    expect(sql).toContain("CREATE SCHEMA `team-esyfo-prod-1a2b.lumi`");
    expect(sql).toContain("location = 'europe-north1'");
    expect(sql).toContain("labels = [('lumi-team', 'team-esyfo')]");
    expect(sql).toContain("max_time_travel_hours = 48");
    expect(sql).toContain("GRANT `roles/bigquery.dataEditor`");
    expect(sql).toContain(
      'TO "serviceAccount:lumi-api@nais-prod.iam.gserviceaccount.com";',
    );
    expect(sql).not.toContain("dataOwner");
  });

  it("links to the dataset in the BigQuery console", () => {
    expect(bigQueryConsoleUrl("team-esyfo-prod-1a2b", "lumi")).toBe(
      "https://console.cloud.google.com/bigquery?project=team-esyfo-prod-1a2b&p=team-esyfo-prod-1a2b&d=lumi&page=dataset",
    );
  });

  it("formats times in Norwegian time and says when a run is near", () => {
    expect(formatTimestamp("2026-10-19T23:00:00Z")).toMatch(/20\. okt\. 2026/);
    expect(formatTimestamp(null)).toBeNull();
    expect(formatTimestamp("not a date")).toBeNull();
    const now = Date.parse("2026-10-20T12:00:00Z");
    expect(nextRunText("2026-10-20T12:01:00Z", now)).toBe("Om litt");
    expect(nextRunText("2026-10-20T23:00:00Z", now)).toMatch(/21\. okt\. 2026/);
  });

  it("summarizes row counts with Norwegian number format", () => {
    expect(rowSummary({ svar: 12345, innsendinger: 512, fritekst: null })).toBe(
      "12 345 svar · 512 innsendinger",
    );
    expect(rowSummary({ svar: 1, innsendinger: 1, fritekst: 0 })).toContain(
      "0 fritekstsvar",
    );
  });

  it("has a title and a hint for every problem code", () => {
    for (const code of BigQueryExportProblemCodeSchema.options) {
      const text = problemText(
        { code, detail: "detalj" },
        { team: "team-esyfo", location: "europe-north1" },
      );
      expect(text.title.length).toBeGreaterThan(5);
      expect(text.hint.length).toBeGreaterThan(5);
    }
    expect(
      problemText(
        { code: "PROJECT_NOT_TEAM_PROJECT", detail: "team-esyfo-prod-1a2b" },
        { team: "team-esyfo", location: "europe-north1" },
      ).hint,
    ).toContain("team-esyfo-prod-1a2b");
  });
});
