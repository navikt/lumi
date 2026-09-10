import { describe, expect, it } from "vitest";
import { projectStatus } from "../surveyverksted.index";

const base = {
  id: "p1",
  team: "team-a",
  name: "Kvitteringsside",
  surveyId: "kvittering-v1",
  createdAt: "2026-09-01T08:00:00Z",
  updatedAt: "2026-09-02T08:00:00Z",
};

describe("projectStatus", () => {
  it("is a draft until something has been shared", () => {
    expect(projectStatus({ ...base, draftVersion: 3 })).toEqual({
      kind: "draft",
    });
    expect(
      projectStatus({ ...base, draftVersion: 3, latestRevision: null }),
    ).toEqual({ kind: "draft" });
  });

  it("is shared while the draft still equals the frozen version", () => {
    const latestRevision = {
      id: "r2",
      revisionNumber: 2,
      draftVersion: 3,
      createdAt: "2026-09-02T09:00:00Z",
    };
    expect(projectStatus({ ...base, draftVersion: 3, latestRevision })).toEqual(
      { kind: "shared", revision: latestRevision },
    );
  });

  it("flags newer draft edits after the last share", () => {
    const latestRevision = {
      id: "r2",
      revisionNumber: 2,
      draftVersion: 3,
      createdAt: "2026-09-02T09:00:00Z",
    };
    expect(
      projectStatus({ ...base, draftVersion: 4, latestRevision }).kind,
    ).toBe("shared-with-changes");
  });
});
