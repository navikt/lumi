import type {
  BigQueryExportProblem,
  BigQueryExportRowCounts,
} from "~/types/bigQueryExport";

export const BIGQUERY_GUIDE_URL =
  "https://navikt.github.io/lumi/dashboard/bigquery";
export const MARKETPLACE_NEW_PRODUCT_URL =
  "https://data.ansatt.nav.no/dataproduct/new";
export const METABASE_GUIDE_URL = "https://docs.knada.io/analyse/metabase/";

const timestampFormat = new Intl.DateTimeFormat("nb-NO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Oslo",
});

export function formatTimestamp(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : timestampFormat.format(date);
}

export function formatCount(value: number): string {
  return value.toLocaleString("no-NO");
}

export function rowSummary(rows: BigQueryExportRowCounts): string {
  const parts = [
    `${formatCount(rows.svar)} svar`,
    `${formatCount(rows.innsendinger)} innsendinger`,
  ];
  if (rows.fritekst !== null && rows.fritekst !== undefined)
    parts.push(`${formatCount(rows.fritekst)} fritekstsvar`);
  return parts.join(" · ");
}

/** The next run as the team reads it: soon, or the planned time. */
export function nextRunText(
  iso: string | null | undefined,
  now: number = Date.now(),
): string | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return null;
  if (at - now < 2 * 60_000) return "Om litt";
  return formatTimestamp(iso);
}

/**
 * The SQL the team runs in its own project. It creates the dataset in Nav's
 * region, marks it for the team, shortens time travel to the minimum and gives
 * Lumi's service account write access to this dataset only.
 */
export function setupSql({
  projectId,
  datasetId,
  team,
  serviceAccount,
  location,
}: {
  projectId: string;
  datasetId: string;
  team: string;
  serviceAccount: string;
  location: string;
}): string {
  return [
    `CREATE SCHEMA \`${projectId}.${datasetId}\``,
    "  OPTIONS (",
    `    location = '${location}',`,
    `    labels = [('lumi-team', '${team}')],`,
    "    max_time_travel_hours = 48,",
    "    description = 'Svar fra Lumi. Lumi oppdaterer tabellene hver natt.'",
    "  );",
    "",
    "GRANT `roles/bigquery.dataEditor`",
    `  ON SCHEMA \`${projectId}.${datasetId}\``,
    `  TO "serviceAccount:${serviceAccount}";`,
  ].join("\n");
}

export function bigQueryConsoleUrl(
  projectId: string,
  datasetId?: string,
): string {
  const url = new URL("https://console.cloud.google.com/bigquery");
  url.searchParams.set("project", projectId);
  if (datasetId) {
    url.searchParams.set("p", projectId);
    url.searchParams.set("d", datasetId);
    url.searchParams.set("page", "dataset");
  }
  return url.toString();
}

export interface ProblemText {
  title: string;
  hint: string;
}

/** What went wrong and what the team can do, for every problem code. */
export function problemText(
  problem: BigQueryExportProblem,
  { team, location }: { team: string; location: string },
): ProblemText {
  const detail = problem.detail ?? undefined;
  switch (problem.code) {
    case "PROJECT_NOT_TEAM_PROJECT":
      return {
        title: "Prosjektet er ikke teamets eget",
        hint: detail
          ? `Bruk ${detail}, som er prosjektet teamet har i Nais.`
          : "Lumi fant ikke noe GCP-prosjekt for teamet i Nais. Sjekk teamet i Nais Console.",
      };
    case "DATASET_NOT_FOUND":
      return {
        title: "Lumi finner ikke datasettet",
        hint: "Kjør SQL-en i BigQuery, og sjekk at prosjekt og datasett er skrevet likt her og der.",
      };
    case "DATASET_ACCESS_DENIED":
      return {
        title: "Lumi har ikke tilgang til datasettet",
        hint: "Kjør GRANT-setningen i SQL-en, slik at Lumis tjenestekonto får rollen BigQuery Data Editor på datasettet.",
      };
    case "DATASET_WRONG_LOCATION":
      return {
        title: "Datasettet ligger i feil region",
        hint: `Datasettet ligger i ${detail ?? "en annen region"}. Lag et nytt datasett i ${location} med SQL-en.`,
      };
    case "DATASET_TEAM_LABEL_MISSING":
      return {
        title: "Datasettet mangler label for teamet",
        hint: `Legg til labelen lumi-team med verdien ${team}, slik SQL-en gjør.`,
      };
    case "DATASET_TEAM_LABEL_MISMATCH":
      return {
        title: "Datasettet er merket for et annet team",
        hint: `Labelen lumi-team er ${detail ?? "et annet team"}. Endre den til ${team}, eller bruk et annet datasett.`,
      };
    case "TABLE_WRITE_DENIED":
      return {
        title: "Lumi får ikke lage tabeller i datasettet",
        hint: "Lumi trenger rollen BigQuery Data Editor på datasettet. Kjør GRANT-setningen i SQL-en.",
      };
    case "TABLE_NOT_CREATED_BY_LUMI":
      return {
        title: `Datasettet har allerede en tabell som heter ${detail ?? "det samme som Lumis tabeller"}`,
        hint: "Lumi overskriver ikke tabeller den ikke har laget selv. Bruk et eget datasett for Lumi.",
      };
    case "BIGQUERY_UNAVAILABLE":
      return {
        title: "BigQuery svarte ikke",
        hint: "Prøv igjen om litt.",
      };
    case "LOAD_FAILED":
      return {
        title: "Lumi fikk ikke skrevet tabellene",
        hint: "Lumi prøver igjen automatisk, og team eSyfo får varsel om feilen.",
      };
    case "INTERNAL_ERROR":
      return {
        title: "Noe gikk galt i Lumi",
        hint: "Lumi prøver igjen automatisk, og team eSyfo får varsel om feilen.",
      };
  }
}
