import type {
  BigQueryExportProblem,
  BigQueryExportProblemCode,
  BigQueryExportRowCounts,
} from "~/types/bigQueryExport";

export const BIGQUERY_GUIDE_URL =
  "https://navikt.github.io/lumi/dashboard/bigquery";
export const MARKETPLACE_NEW_PRODUCT_URL =
  "https://data.ansatt.nav.no/dataproduct/new";
export const METABASE_GUIDE_URL = "https://docs.knada.io/analyse/metabase/";
export const LUMI_SLACK_URL = "https://nav-it.slack.com/archives/C0AG2FKSSMD";

export const RATE_LIMIT_TEXT =
  "Det er gjort mange forsøk på kort tid. Vent et minutt og prøv igjen.";

/** The description the setup SQL gives the dataset. */
const DATASET_DESCRIPTION =
  "Svar fra Lumi. Lumi oppdaterer tabellene hver natt.";

const timestampFormat = new Intl.DateTimeFormat("nb-NO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Oslo",
});

const clockFormat = new Intl.DateTimeFormat("nb-NO", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/Oslo",
});

export function formatTimestamp(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : timestampFormat.format(date);
}

/** The time of day in Norwegian time, as HH:MM. */
export function formatClock(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = clockFormat.formatToParts(date);
  const part = (type: "hour" | "minute") =>
    parts.find((candidate) => candidate.type === type)?.value ?? "00";
  return `${part("hour")}:${part("minute")}`;
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
 * A queued run waits until a few minutes after the previous run started.
 * Says when it starts if that is more than a minute away, otherwise null.
 */
export function queuedText(
  iso: string | null | undefined,
  now: number = Date.now(),
): string | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  if (Number.isNaN(at) || at - now <= 60_000) return null;
  return `Kjøringen starter rundt kl. ${formatClock(iso)}`;
}

export interface SetupSqlTarget {
  projectId: string;
  datasetId: string;
  team: string;
  serviceAccount: string;
  location: string;
}

/**
 * The SQL the team runs in its own project. It creates the dataset in Nav's
 * region if it is missing, marks it for the team, shortens time travel to
 * the minimum and gives Lumi's service account write access to this dataset
 * only. Every statement can run again, so the same SQL fixes access, label
 * and time travel on an existing dataset.
 */
export function setupSql({
  projectId,
  datasetId,
  team,
  serviceAccount,
  location,
}: SetupSqlTarget): string {
  const dataset = `\`${projectId}.${datasetId}\``;
  return [
    `SET @@location = '${location}';`,
    "",
    `CREATE SCHEMA IF NOT EXISTS ${dataset}`,
    `  OPTIONS (location = '${location}');`,
    "",
    `ALTER SCHEMA ${dataset}`,
    "  SET OPTIONS (",
    `    labels = [('lumi-team', '${team}')],`,
    "    max_time_travel_hours = 48,",
    `    description = '${DATASET_DESCRIPTION}'`,
    "  );",
    "",
    "GRANT `roles/bigquery.dataEditor`",
    `  ON SCHEMA ${dataset}`,
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

const FIXED_BY_SQL: ReadonlySet<BigQueryExportProblemCode> = new Set([
  "DATASET_NOT_FOUND",
  "DATASET_ACCESS_DENIED",
  "DATASET_TEAM_LABEL_MISSING",
  "TABLE_WRITE_DENIED",
  "DATASET_TIME_TRAVEL_TOO_LONG",
]);

/** Problems the team fixes by running the setup SQL again. */
export function fixedBySql(code: BigQueryExportProblemCode): boolean {
  return FIXED_BY_SQL.has(code);
}

export interface ProblemText {
  title: string;
  hint: string;
}

const RUN_SQL_AGAIN = "Kjør SQL-en på nytt i BigQuery.";

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
          : "Prosjektet hører ikke til teamet i Nais. Sjekk prosjekt-ID-en under Innstillinger.",
      };
    case "DATASET_NOT_FOUND":
      return {
        title: "Lumi finner ikke datasettet",
        hint: "Kjør SQL-en i BigQuery, og sjekk at prosjekt og datasett er skrevet likt her og der.",
      };
    case "DATASET_ACCESS_DENIED":
      return {
        title: "Lumi har ikke tilgang til datasettet",
        hint: `Lumis tjenestekonto trenger rollen BigQuery Data Editor på datasettet. ${RUN_SQL_AGAIN}`,
      };
    case "DATASET_WRONG_LOCATION":
      return {
        title: "Datasettet ligger i feil region",
        hint: `Datasettet ligger i ${detail ?? "en annen region"}. Lag et nytt datasett i ${location} med SQL-en.`,
      };
    case "DATASET_TEAM_LABEL_MISSING":
      return {
        title: "Datasettet mangler label for teamet",
        hint: `Datasettet trenger labelen lumi-team med verdien ${team}. ${RUN_SQL_AGAIN}`,
      };
    case "DATASET_TEAM_LABEL_MISMATCH":
      return {
        title: "Datasettet er merket for et annet team",
        hint: `Labelen lumi-team er ${detail ?? "et annet team"}. Endre den til ${team}, eller bruk et annet datasett.`,
      };
    case "TABLE_WRITE_DENIED":
      return {
        title: "Lumi får ikke lage tabeller i datasettet",
        hint: `Lumi trenger rollen BigQuery Data Editor på datasettet. ${RUN_SQL_AGAIN}`,
      };
    case "TABLE_NOT_CREATED_BY_LUMI":
      return {
        title: `Datasettet har allerede en tabell som heter ${detail ?? "det samme som Lumis tabeller"}`,
        hint: "Lumi overskriver ikke tabeller den ikke har laget selv. Bruk et eget datasett for Lumi.",
      };
    case "DATASET_NOT_DEDICATED":
      return {
        title: "Datasettet har andre tabeller",
        hint: `${
          detail
            ? `Datasettet har tabellen ${detail}, som Lumi ikke har laget.`
            : "Datasettet har tabeller som Lumi ikke har laget."
        } Lumi får skrivetilgang til hele datasettet, så bruk et eget datasett bare for Lumi. Views går fint.`,
      };
    case "DATASET_TIME_TRAVEL_TOO_LONG":
      return {
        title: "Datasettet tar vare på slettede data for lenge",
        hint: `BigQuery tar vare på slettede rader i ${
          detail ? `${detail} timer` : "mer enn 48 timer"
        } i dette datasettet. Kjør SQL-en på nytt i BigQuery, så blir det 48 timer.`,
      };
    case "TEAM_PROJECT_UNKNOWN":
      return {
        title: "Lumi fikk ikke sjekket prosjektet",
        hint: "Lumi fikk ikke slått opp teamets GCP-prosjekt i Nais. Prøv igjen om litt.",
      };
    case "EXPORT_JOB_DENIED":
      return {
        title: "Lumi fikk ikke kjøre eksporten",
        hint: "Lumi mangler tilgang til å kjøre jobber i BigQuery. Feilen er hos Lumi. Skriv i #lumi hvis den ikke går over.",
      };
    case "FREE_TEXT_NOT_REMOVED":
      return {
        title: "Lumi fikk ikke slettet tabellen fritekst",
        hint: "Fritekst er ikke lenger med i eksporten, men tabellen ligger fortsatt i datasettet. De andre tabellene er oppdatert. Lumi prøver igjen automatisk, og team eSyfo får varsel. Vil du ikke vente, slett tabellen i BigQuery og velg Oppdater tabellene nå.",
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
