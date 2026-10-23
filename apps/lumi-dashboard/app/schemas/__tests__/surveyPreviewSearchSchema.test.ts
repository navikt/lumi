import { describe, expect, it } from "vitest";
import { surveyPreviewSearchSchema } from "../surveyPreviewSearchSchema";

const projectId = "6f1c2b0e-8a4d-4c6b-9f3e-2d7a1b5c9e04";

describe("surveyPreviewSearchSchema", () => {
  it("keeps a link from Surveyverksted as it is", () => {
    expect(
      surveyPreviewSearchSchema.parse({
        team: "team-esyfo",
        projectId,
        version: "3",
      }),
    ).toEqual({ team: "team-esyfo", projectId, version: 3 });
  });

  it.each([
    ["missing", {}],
    ["empty", { team: "", projectId: "", version: "" }],
  ])("treats %s values as missing", (_name, search) => {
    expect(surveyPreviewSearchSchema.parse(search)).toEqual({});
  });

  it.each([
    ["a projectId that is not a UUID", { team: "team-esyfo", projectId: "x" }],
    ["a version that is not a number", { team: "t", projectId, version: "x" }],
  ])("rejects %s", (_name, search) => {
    expect(() => surveyPreviewSearchSchema.parse(search)).toThrow();
  });
});
