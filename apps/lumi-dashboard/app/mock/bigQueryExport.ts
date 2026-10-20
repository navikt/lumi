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
 * `team-esyfo` can set up an export. The local empty team shows the pilot
 * state. A queued run starts after about a second and finishes a few seconds
 * later, so the page's polling can be seen working.
 *
 * Datasets named `mangler_tilgang` or `annet_team` give the problems a team
 * meets most often.
 */
const SERVICE_ACCOUNT =
  "lumi-api-team-esyfo-1a2b3c4d@nais-dev-2e7b.iam.gserviceaccount.com";
const QUEUE_DELAY_MS = 1_000;
const RUN_DURATION_MS = 3_000;

interface MockDestination {
  projectId: string;
  datasetId: string;
  includeFreeText: boolean;
  createdAt: string;
  updatedAt: string;
  queuedAt: number | null;
  lastSuccessAt: string | null;
}

const destinations = new Map<string, MockDestination>();

export function resetMockBigQueryExport(): void {
  destinations.clear();
}

function projectFor(team: string): string {
  return `${team}-dev-1a2b`;
}

function availability(team: string): BigQueryExportStatus["availability"] {
  if (team === "team-esyfo") return "AVAILABLE";
  if (team === MOCK_EMPTY_TEAM) return "PILOT_ONLY";
  return "DISABLED";
}

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
  if (datasetId === "mangler_tilgang")
    return [{ code: "DATASET_ACCESS_DENIED" }];
  if (datasetId === "annet_team")
    return [{ code: "DATASET_TEAM_LABEL_MISMATCH", detail: "team-annet" }];
  return [];
}

function advance(destination: MockDestination, now: number): void {
  if (destination.queuedAt === null) return;
  if (now - destination.queuedAt >= QUEUE_DELAY_MS + RUN_DURATION_MS) {
    destination.lastSuccessAt = new Date(
      destination.queuedAt + QUEUE_DELAY_MS,
    ).toISOString();
    destination.queuedAt = null;
  }
}

function toDto(
  destination: MockDestination,
  now: number,
): BigQueryExportDestination {
  advance(destination, now);
  const running =
    destination.queuedAt !== null &&
    now - destination.queuedAt >= QUEUE_DELAY_MS;
  const startedAt =
    destination.queuedAt !== null
      ? new Date(destination.queuedAt + QUEUE_DELAY_MS).toISOString()
      : destination.lastSuccessAt;
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
    runState: running ? "RUNNING" : destination.queuedAt ? "QUEUED" : "IDLE",
    lastRun: running
      ? { status: "RUNNING", startedAt: startedAt ?? destination.createdAt }
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
    nextScheduledRunAt: destination.queuedAt
      ? new Date(now).toISOString()
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
    if (problems === null || typeof input.includeFreeText !== "boolean")
      return json({ message: "Bad request" }, 400);
    if (problems.length > 0) return json({ ok: false, problems }, 422);
    const existing = destinations.get(team);
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
      queuedAt: changed ? now : (existing?.queuedAt ?? null),
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
