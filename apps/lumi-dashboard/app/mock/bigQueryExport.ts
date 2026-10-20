import { MOCK_EMPTY_TEAM } from "~/mock/mockData";
import {
  BIGQUERY_DATASET_ID_PATTERN,
  type BigQueryExportDestination,
  type BigQueryExportProblem,
  type BigQueryExportStatus,
  GCP_PROJECT_ID_PATTERN,
} from "~/types/bigQueryExport";

/**
 * In-memory BigQuery export for local development, tests and the public demo.
 *
 * `team-esyfo` can set up an export and may export free text. The local empty
 * team shows the pilot state. Tests can close free text for a team with
 * `setMockBigQueryFreeText`.
 *
 * A queued run starts after about a second and finishes a few seconds later,
 * so the page's polling can be seen working. Like the API, a new run waits
 * until five minutes after the previous run started.
 *
 * Datasets named `mangler_tilgang`, `annet_team`, `andre_tabeller`,
 * `lang_tidsreise` and `nais_nede` give the problems a team meets most often.
 */
const SERVICE_ACCOUNT =
  "lumi-api-team-esyfo-1a2b3c4d@nais-dev-2e7b.iam.gserviceaccount.com";
const QUEUE_DELAY_MS = 1_000;
const RUN_DURATION_MS = 3_000;
const COOLDOWN_MS = 5 * 60_000;
const DEFAULT_FREE_TEXT_TEAMS = ["team-esyfo"];

interface MockDestination {
  projectId: string;
  datasetId: string;
  includeFreeText: boolean;
  createdAt: string;
  updatedAt: string;
  queuedAt: number | null;
  lastStartedAt: number | null;
  lastSuccessAt: string | null;
}

const destinations = new Map<string, MockDestination>();
const freeTextTeams = new Set(DEFAULT_FREE_TEXT_TEAMS);

export function resetMockBigQueryExport(): void {
  destinations.clear();
  freeTextTeams.clear();
  for (const team of DEFAULT_FREE_TEXT_TEAMS) freeTextTeams.add(team);
}

/** Opens or closes free text for a team, as Lumi does per team. */
export function setMockBigQueryFreeText(team: string, available: boolean) {
  if (available) freeTextTeams.add(team);
  else freeTextTeams.delete(team);
}

function projectFor(team: string): string {
  return `${team}-dev-1a2b`;
}

function availability(team: string): BigQueryExportStatus["availability"] {
  if (team === "team-esyfo") return "AVAILABLE";
  if (team === MOCK_EMPTY_TEAM) return "PILOT_ONLY";
  return "DISABLED";
}

const DATASET_PROBLEMS: Record<string, BigQueryExportProblem[]> = {
  mangler_tilgang: [{ code: "DATASET_ACCESS_DENIED" }],
  annet_team: [{ code: "DATASET_TEAM_LABEL_MISMATCH", detail: "team-annet" }],
  andre_tabeller: [{ code: "DATASET_NOT_DEDICATED", detail: "rapport" }],
  lang_tidsreise: [{ code: "DATASET_TIME_TRAVEL_TOO_LONG", detail: "168" }],
  nais_nede: [{ code: "TEAM_PROJECT_UNKNOWN" }],
};

function problemsFor(
  team: string,
  projectId: unknown,
  datasetId: unknown,
): BigQueryExportProblem[] | null {
  if (
    typeof projectId !== "string" ||
    typeof datasetId !== "string" ||
    !GCP_PROJECT_ID_PATTERN.test(projectId) ||
    !BIGQUERY_DATASET_ID_PATTERN.test(datasetId)
  )
    return null;
  if (projectId !== projectFor(team))
    return [{ code: "PROJECT_NOT_TEAM_PROJECT", detail: projectFor(team) }];
  return DATASET_PROBLEMS[datasetId] ?? [];
}

/** When the queued run starts: after the queue delay and the cooldown. */
function startOf(destination: MockDestination): number | null {
  if (destination.queuedAt === null) return null;
  const queued = destination.queuedAt + QUEUE_DELAY_MS;
  return destination.lastStartedAt === null
    ? queued
    : Math.max(queued, destination.lastStartedAt + COOLDOWN_MS);
}

function advance(destination: MockDestination, now: number): void {
  const start = startOf(destination);
  if (start === null || now < start + RUN_DURATION_MS) return;
  destination.lastStartedAt = start;
  destination.lastSuccessAt = new Date(start).toISOString();
  destination.queuedAt = null;
}

function toDto(
  destination: MockDestination,
  now: number,
): BigQueryExportDestination {
  advance(destination, now);
  const start = startOf(destination);
  const running = start !== null && now >= start;
  // 01:00 Norwegian summer time, close enough for a mock.
  const nextNight = new Date(now);
  nextNight.setUTCHours(23, 0, 0, 0);
  if (nextNight.getTime() <= now)
    nextNight.setUTCDate(nextNight.getUTCDate() + 1);
  return {
    projectId: destination.projectId,
    datasetId: destination.datasetId,
    includeFreeText: destination.includeFreeText,
    createdAt: destination.createdAt,
    updatedAt: destination.updatedAt,
    runState: running ? "RUNNING" : start !== null ? "QUEUED" : "IDLE",
    lastRun: running
      ? { status: "RUNNING", startedAt: new Date(start).toISOString() }
      : destination.lastSuccessAt
        ? {
            status: "SUCCEEDED",
            startedAt: destination.lastSuccessAt,
            finishedAt: new Date(
              Date.parse(destination.lastSuccessAt) + RUN_DURATION_MS,
            ).toISOString(),
          }
        : null,
    lastSuccessAt: destination.lastSuccessAt,
    lastSuccessRows: destination.lastSuccessAt
      ? {
          svar: 1_284,
          innsendinger: 512,
          fritekst: destination.includeFreeText ? 197 : null,
        }
      : null,
    nextScheduledRunAt:
      start !== null && !running
        ? new Date(start).toISOString()
        : nextNight.toISOString(),
  };
}

function status(team: string, now: number): BigQueryExportStatus {
  const state = availability(team);
  const available = state === "AVAILABLE";
  const destination = destinations.get(team);
  return {
    team,
    available,
    availability: state,
    location: "europe-north1",
    serviceAccount: available ? SERVICE_ACCOUNT : null,
    suggestedProjectId: available ? projectFor(team) : null,
    freeTextAvailable: freeTextTeams.has(team),
    destination: destination ? toDto(destination, now) : null,
  };
}

export function mockBigQueryExportRequest(
  team: string,
  path: string,
  method: string,
  body: unknown,
  now: number = Date.now(),
): Response {
  const json = (value: unknown, code = 200) =>
    Response.json(value, { status: code });
  if (team !== "team-esyfo" && team !== MOCK_EMPTY_TEAM)
    return json({ message: "Forbidden" }, 403);

  if (path === "" && method === "GET") return json(status(team, now));
  if (availability(team) !== "AVAILABLE" && method !== "DELETE")
    return json({ message: "Unavailable" }, 409);

  const input = (body ?? {}) as Record<string, unknown>;
  if (path === "/verify" && method === "POST") {
    const problems = problemsFor(team, input.projectId, input.datasetId);
    if (problems === null) return json({ message: "Bad request" }, 400);
    return json({ ok: problems.length === 0, problems });
  }
  if (path === "" && method === "PUT") {
    const problems = problemsFor(team, input.projectId, input.datasetId);
    if (
      problems === null ||
      typeof input.includeFreeText !== "boolean" ||
      (input.includeFreeText && !freeTextTeams.has(team))
    )
      return json({ message: "Bad request" }, 400);
    if (problems.length > 0) return json({ ok: false, problems }, 422);
    const existing = destinations.get(team);
    if (existing) advance(existing, now);
    const timestamp = new Date(now).toISOString();
    const changed =
      !existing ||
      existing.projectId !== input.projectId ||
      existing.datasetId !== input.datasetId ||
      existing.includeFreeText !== input.includeFreeText;
    destinations.set(team, {
      projectId: input.projectId as string,
      datasetId: input.datasetId as string,
      includeFreeText: input.includeFreeText,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      queuedAt: changed
        ? (existing?.queuedAt ?? now)
        : (existing?.queuedAt ?? null),
      lastStartedAt: existing?.lastStartedAt ?? null,
      lastSuccessAt: existing?.lastSuccessAt ?? null,
    });
    return json(status(team, now));
  }
  if (path === "/run" && method === "POST") {
    const existing = destinations.get(team);
    if (!existing) return json({ message: "Not found" }, 404);
    advance(existing, now);
    existing.queuedAt ??= now;
    return json(status(team, now), 202);
  }
  if (path === "" && method === "DELETE") {
    if (!destinations.delete(team)) return json({ message: "Not found" }, 404);
    return json({ tablesRemoved: true });
  }
  return json({ message: "Not found" }, 404);
}
