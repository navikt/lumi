import { describe, expect, it } from "vitest";
import { BigQueryExportProblemCodeSchema } from "~/types/bigQueryExport";
import {
  bigQueryConsoleUrl,
  fixedBySql,
  formatClock,
  formatTimestamp,
  nextRunText,
  problemText,
  queuedText,
  rowSummary,
  setupSql,
} from "../format";

const context = { team: "team-esyfo", location: "europe-north1" };

describe("BigQuery export formatting", () => {
  it("builds setup SQL that can run again on an existing dataset", () => {
    const sql = setupSql({
      projectId: "team-esyfo-prod-1a2b",
      datasetId: "lumi",
      team: "team-esyfo",
      serviceAccount: "lumi-api@nais-prod.iam.gserviceaccount.com",
      location: "europe-north1",
    });

    expect(sql).toBe(
      [
        "SET @@location = 'europe-north1';",
        "",
        "CREATE SCHEMA IF NOT EXISTS `team-esyfo-prod-1a2b.lumi`",
        "  OPTIONS (location = 'europe-north1');",
        "",
        "ALTER SCHEMA `team-esyfo-prod-1a2b.lumi`",
        "  SET OPTIONS (",
        "    labels = [('lumi-team', 'team-esyfo')],",
        "    max_time_travel_hours = 48,",
        "    description = 'Svar fra Lumi. Lumi oppdaterer tabellene hver natt.'",
        "  );",
        "",
        "GRANT `roles/bigquery.dataEditor`",
        "  ON SCHEMA `team-esyfo-prod-1a2b.lumi`",
        '  TO "serviceAccount:lumi-api@nais-prod.iam.gserviceaccount.com";',
      ].join("\n"),
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
    expect(formatClock("2026-10-20T12:05:00Z")).toBe("14:05");
    expect(formatClock("2026-12-20T07:30:00Z")).toBe("08:30");
    const now = Date.parse("2026-10-20T12:00:00Z");
    expect(nextRunText("2026-10-20T12:01:00Z", now)).toBe("Om litt");
    expect(nextRunText("2026-10-20T23:00:00Z", now)).toMatch(/21\. okt\. 2026/);
  });

  it("says when a queued run starts if it waits more than a minute", () => {
    const now = Date.parse("2026-10-20T12:00:00Z");
    expect(queuedText("2026-10-20T12:04:30Z", now)).toBe(
      "Kjøringen starter rundt kl. 14:04",
    );
    expect(queuedText("2026-10-20T12:00:50Z", now)).toBeNull();
    expect(queuedText(null, now)).toBeNull();
    expect(queuedText("not a date", now)).toBeNull();
  });

  it("summarizes row counts with Norwegian number format", () => {
    expect(rowSummary({ svar: 12345, innsendinger: 512, fritekst: null })).toBe(
      "12\u00A0345 svar · 512 innsendinger",
    );
    expect(rowSummary({ svar: 1, innsendinger: 1, fritekst: 0 })).toContain(
      "0 fritekstsvar",
    );
  });

  it("has a title and a hint for every problem code, with and without detail", () => {
    for (const code of BigQueryExportProblemCodeSchema.options) {
      for (const detail of ["detalj", null]) {
        const text = problemText({ code, detail }, context);
        expect(text.title.length).toBeGreaterThan(5);
        expect(text.hint.length).toBeGreaterThan(5);
        expect(`${text.title} ${text.hint}`).not.toMatch(/[—–]/);
      }
    }
  });

  it("names the team's project, or points to the settings without it", () => {
    expect(
      problemText(
        { code: "PROJECT_NOT_TEAM_PROJECT", detail: "team-esyfo-prod-1a2b" },
        context,
      ).hint,
    ).toContain("team-esyfo-prod-1a2b");
    expect(
      problemText({ code: "PROJECT_NOT_TEAM_PROJECT" }, context).hint,
    ).toBe(
      "Prosjektet hører ikke til teamet i Nais. Sjekk prosjekt-ID-en under Innstillinger.",
    );
  });

  it("explains the new dataset checks with their detail", () => {
    expect(
      problemText(
        { code: "DATASET_NOT_DEDICATED", detail: "rapport" },
        context,
      ),
    ).toEqual({
      title: "Datasettet har andre tabeller",
      hint: "Datasettet har tabellen rapport, som Lumi ikke har laget. Lumi får skrivetilgang til hele datasettet, så bruk et eget datasett bare for Lumi. Views går fint.",
    });
    expect(
      problemText(
        { code: "DATASET_TIME_TRAVEL_TOO_LONG", detail: "168" },
        context,
      ).hint,
    ).toBe(
      "BigQuery tar vare på slettede rader i 168 timer i dette datasettet. Kjør SQL-en på nytt i BigQuery, så blir det 48 timer.",
    );
    expect(problemText({ code: "TEAM_PROJECT_UNKNOWN" }, context).title).toBe(
      "Lumi fikk ikke sjekket prosjektet",
    );
    expect(problemText({ code: "EXPORT_JOB_DENIED" }, context).title).toBe(
      "Lumi fikk ikke kjøre eksporten",
    );
  });

  it("says that free text is still in the dataset when Lumi could not delete it", () => {
    const text = problemText({ code: "FREE_TEXT_NOT_REMOVED" }, context);
    expect(text.title).toBe("Lumi fikk ikke slettet tabellen fritekst");
    expect(text.hint).toContain("tabellen ligger fortsatt i datasettet");
    expect(text.hint).toContain("De andre tabellene er oppdatert.");
    expect(text.hint).toContain(
      "slett tabellen i BigQuery og velg Oppdater tabellene nå",
    );
  });

  it("offers the SQL for the problems it fixes", () => {
    const fixed = BigQueryExportProblemCodeSchema.options.filter(fixedBySql);
    expect(fixed).toEqual([
      "DATASET_NOT_FOUND",
      "DATASET_ACCESS_DENIED",
      "DATASET_TEAM_LABEL_MISSING",
      "TABLE_WRITE_DENIED",
      "DATASET_TIME_TRAVEL_TOO_LONG",
    ]);
    for (const code of fixed)
      expect(problemText({ code }, context).hint).toContain("Kjør SQL-en");
  });
});
