import type { SurveyPageV1, SurveyQuestionV1 } from "@navikt/lumi-survey";
import { describe, expect, it } from "vitest";
import { buildQuestionTree } from "../questionTree";

function text(
  id: string,
  visibleIf?: SurveyQuestionV1["visibleIf"],
): SurveyQuestionV1 {
  return { id, type: "text", prompt: id, ...(visibleIf ? { visibleIf } : {}) };
}

function page(...questions: SurveyQuestionV1[]): SurveyPageV1 {
  return { id: "side", questions: questions as SurveyPageV1["questions"] };
}

const on = (questionId: string): SurveyQuestionV1["visibleIf"] => ({
  questionId,
  operator: "EXISTS",
});

describe("buildQuestionTree", () => {
  it("keeps unconditional questions at the top level", () => {
    const tree = buildQuestionTree(page(text("a"), text("b")));
    expect(tree.map((node) => node.depth)).toEqual([0, 0]);
    expect(tree.every((node) => !node.externalDependency)).toBe(true);
  });

  it("nests dependants under their driver, siblings at the same depth", () => {
    const tree = buildQuestionTree(
      page(text("q1"), text("q2", on("q1")), text("q3", on("q1"))),
    );
    expect(tree.map((node) => [node.depth, node.parentId])).toEqual([
      [0, null],
      [1, "q1"],
      [1, "q1"],
    ]);
    // q1's trunk continues past q2 (q3 still hangs off it), ends at q3.
    expect(tree[1].guides).toEqual([true]);
    expect(tree[2].guides).toEqual([false]);
  });

  it("nests a dependant of a dependant one level deeper", () => {
    const tree = buildQuestionTree(
      page(text("q1"), text("q2", on("q1")), text("q3", on("q2"))),
    );
    expect(tree.map((node) => node.depth)).toEqual([0, 1, 2]);
    expect(tree[2].ancestors).toEqual(["q1", "q2"]);
    // q3 is inside q2's subtree, so neither trunk continues past it — and
    // q1's trunk must not continue past q2 either (q3 belongs to q2).
    expect(tree[1].guides).toEqual([false]);
    expect(tree[2].guides).toEqual([false, false]);
  });

  it("continues an ancestor's trunk past a nested subtree when more dependants follow", () => {
    // q1 → [q2 → [q3], q4]: at q3, q1's trunk must keep going to reach q4.
    const tree = buildQuestionTree(
      page(
        text("q1"),
        text("q2", on("q1")),
        text("q3", on("q2")),
        text("q4", on("q1")),
      ),
    );
    expect(tree[2].guides).toEqual([true, false]);
    expect(tree[3]).toMatchObject({ depth: 1, guides: [false] });
  });

  it("handles a dependant placed after a sibling's subtree", () => {
    // Runtime-valid order that is not depth-first: q1, q2→q1, q3→q1, q4→q2.
    const tree = buildQuestionTree(
      page(
        text("q1"),
        text("q2", on("q1")),
        text("q3", on("q1")),
        text("q4", on("q2")),
      ),
    );
    expect(tree.map((node) => node.depth)).toEqual([0, 1, 1, 2]);
    // q2's trunk continues past q3 to reach q4; q1's trunk continues past
    // q2 and q3 for the same reason, and ends at q4.
    expect(tree[1].guides).toEqual([true]);
    expect(tree[2].guides).toEqual([true]);
    expect(tree[3].guides).toEqual([false, false]);
  });

  it("marks cross-page, multi-target, metadata and forward references as external", () => {
    const tree = buildQuestionTree(
      page(
        text("q1"),
        text("cross", on("annen-side")),
        text("multi", {
          all: [
            { questionId: "q1", operator: "EXISTS" },
            { questionId: "cross", operator: "EXISTS" },
          ],
        }),
        text("meta", { field: "METADATA", key: "flow", operator: "EXISTS" }),
        text("forward", on("later")),
        text("later"),
      ),
    );
    const byId = new Map(tree.map((node) => [node.id, node]));
    for (const id of ["cross", "multi", "meta", "forward"]) {
      expect(byId.get(id)).toMatchObject({
        depth: 0,
        parentId: null,
        externalDependency: true,
      });
    }
    expect(byId.get("later")).toMatchObject({
      depth: 0,
      externalDependency: false,
    });
  });

  it("treats a same-question group as a single driver", () => {
    const tree = buildQuestionTree(
      page(
        text("q1"),
        text("q2", {
          all: [
            { questionId: "q1", operator: "GT", value: 6 },
            { questionId: "q1", operator: "LT", value: 9 },
          ],
        }),
      ),
    );
    expect(tree[1]).toMatchObject({ depth: 1, parentId: "q1" });
  });
});
