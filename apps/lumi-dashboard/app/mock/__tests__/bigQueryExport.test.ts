import { beforeEach, describe, expect, it } from "vitest";
import {
  mockBigQueryExportRequest,
  resetMockBigQueryExport,
} from "~/mock/bigQueryExport";

const team = "team-esyfo";
const project = "team-esyfo-dev-1a2b";

async function call(
  path: string,
  method: string,
  body?: unknown,
  now = 1_000_000,
) {
  const response = mockBigQueryExportRequest(team, path, method, body, now);
  return { status: response.status, body: await response.json() };
}

beforeEach(() => resetMockBigQueryExport());

describe("mock BigQuery export", () => {
  it("explains problems before it saves anything", async () => {
    expect(
      (
        await call("/verify", "POST", {
          projectId: "annet-prosjekt-1",
          datasetId: "lumi",
        })
      ).body.problems,
    ).toEqual([{ code: "PROJECT_NOT_TEAM_PROJECT", detail: project }]);
    expect(
      (
        await call("", "PUT", {
          projectId: project,
          datasetId: "mangler_tilgang",
          includeFreeText: false,
        })
      ).status,
    ).toBe(422);
    expect((await call("", "GET")).body.destination).toBeNull();
  });

  it("queues, runs and finishes an export over time", async () => {
    await call("", "PUT", {
      projectId: project,
      datasetId: "lumi",
      includeFreeText: true,
    });
    expect(
      (await call("", "GET", undefined, 1_000_100)).body.destination.runState,
    ).toBe("QUEUED");
    expect(
      (await call("", "GET", undefined, 1_001_500)).body.destination.runState,
    ).toBe("RUNNING");
    const done = (await call("", "GET", undefined, 1_005_000)).body.destination;
    expect(done.runState).toBe("IDLE");
    expect(done.lastRun.status).toBe("SUCCEEDED");
    expect(done.lastSuccessRows.fritekst).toBeGreaterThan(0);
  });

  it("stops and reports a missing export", async () => {
    await call("", "PUT", {
      projectId: project,
      datasetId: "lumi",
      includeFreeText: false,
    });
    expect((await call("", "DELETE")).body).toEqual({ tablesRemoved: true });
    expect((await call("", "DELETE")).status).toBe(404);
    expect((await call("/run", "POST")).status).toBe(404);
  });

  it("refuses teams the user cannot access and shows the pilot state", async () => {
    expect(
      mockBigQueryExportRequest("another-team", "", "GET", undefined).status,
    ).toBe(403);
    const pilot = await mockBigQueryExportRequest(
      "team-ny",
      "",
      "GET",
      undefined,
    ).json();
    expect(pilot.availability).toBe("PILOT_ONLY");
    expect(pilot.available).toBe(false);
  });
});
