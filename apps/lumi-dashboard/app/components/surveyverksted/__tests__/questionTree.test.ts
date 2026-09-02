import type { SurveyPageV1, SurveyQuestionV1 } from "@navikt/lumi-survey";
import { describe, expect, it } from "vitest";
import {
  buildQuestionTree,
  drawnGuides,
  MAX_DRAWN_DEPTH,
  reuseStableNodes,
} from "../questionTree";

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

  it("detaches a dependant whose driver has left the open chain", () => {
    // q4 → q2, but q3 (a sibling of q2) sits in between: nesting q4 under
    // q2 would need a trunk drawn through q3's card, so q4 is drawn
    // detached at the top level instead — never as a child of q3.
    const tree = buildQuestionTree(
      page(
        text("q1"),
        text("q2", on("q1")),
        text("q3", on("q1")),
        text("q4", on("q2")),
      ),
    );
    expect(tree.map((node) => node.depth)).toEqual([0, 1, 1, 0]);
    expect(tree[3]).toMatchObject({
      parentId: null,
      externalDependency: true,
      ancestors: [],
    });
    // q1's trunk ends at q3, the last node of its contiguous subtree.
    expect(tree[1].guides).toEqual([true]);
    expect(tree[2].guides).toEqual([false]);
  });

  it("detaches a dependant separated from its driver by an unconditional question", () => {
    // q4 → q1 with an unrelated q3 in between: q1's trunk stops at q2 and
    // q4 must not look like a child of q3.
    const tree = buildQuestionTree(
      page(text("q1"), text("q2", on("q1")), text("q3"), text("q4", on("q1"))),
    );
    expect(tree.map((node) => node.depth)).toEqual([0, 1, 0, 0]);
    expect(tree[1].guides).toEqual([false]);
    expect(tree[3]).toMatchObject({ parentId: null, externalDependency: true });
  });

  it("marks cross-page, multi-target, metadata, self and forward references as external", () => {
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
        text("self", on("self")),
        text("forward", on("later")),
        text("later"),
      ),
    );
    const byId = new Map(tree.map((node) => [node.id, node]));
    for (const id of ["cross", "multi", "meta", "self", "forward"]) {
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

describe("drawnGuides", () => {
  it("draws every level up to the clamp", () => {
    const tree = buildQuestionTree(
      page(text("q1"), text("q2", on("q1")), text("q3", on("q2"))),
    );
    expect(drawnGuides(tree[2])).toEqual([
      { ancestorId: "q1", continues: false, isParent: false },
      { ancestorId: "q2", continues: false, isParent: true },
    ]);
  });

  it("keeps only the last levels for nodes deeper than the indent clamp", () => {
    // A chain deeper than the clamp: the elbow must still attach to the
    // direct parent at the outermost drawn level, never behind the card.
    const chain = [text("q1")];
    for (let index = 2; index <= MAX_DRAWN_DEPTH + 3; index++) {
      chain.push(text(`q${index}`, on(`q${index - 1}`)));
    }
    const tree = buildQuestionTree(page(...chain));
    const deepest = tree[tree.length - 1];
    expect(deepest.depth).toBe(MAX_DRAWN_DEPTH + 2);
    const guides = drawnGuides(deepest);
    expect(guides).toHaveLength(MAX_DRAWN_DEPTH);
    expect(guides.at(-1)).toEqual({
      ancestorId: `q${MAX_DRAWN_DEPTH + 2}`,
      continues: false,
      isParent: true,
    });
    expect(
      guides.every(
        (guide, index) => index === guides.length - 1 || !guide.isParent,
      ),
    ).toBe(true);
  });
});

describe("reuseStableNodes", () => {
  it("hands back the previous object when a node is unchanged", () => {
    const before = buildQuestionTree(page(text("q1"), text("q2", on("q1"))));
    const previous = new Map(before.map((node) => [node.id, node]));
    const after = reuseStableNodes(
      previous,
      buildQuestionTree(page(text("q1"), text("q2", on("q1")))),
    );
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);
  });

  it("returns a fresh object when the tree position changed", () => {
    const before = buildQuestionTree(page(text("q1"), text("q2", on("q1"))));
    const previous = new Map(before.map((node) => [node.id, node]));
    const after = reuseStableNodes(
      previous,
      buildQuestionTree(page(text("q1"), text("q2"))),
    );
    expect(after[0]).toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);
    expect(after[1].depth).toBe(0);
  });
});
