import type { SurveyPageV1 } from "@navikt/lumi-survey";
import { isMetadataCondition, visibleIfLeaves } from "~/utils/surveyDocument";

/** Deepest level the canvas indents; deeper nodes draw only their last levels. */
export const MAX_DRAWN_DEPTH = 4;

export interface QuestionTreeNode {
  id: string;
  /** 0 = top level; each nested dependant sits one deeper than its driver */
  depth: number;
  parentId: string | null;
  /**
   * Conditional, but not drawable as a nested child: the driver is on
   * another page, there are several targets, the condition is metadata, a
   * forward reference — or the driver is a same-page question that is no
   * longer on the open chain (a non-descendant sits between them, so the
   * subtree would be split). Drawn at top level with a detached marker.
   */
  externalDependency: boolean;
  /** Ancestor ids from the root down to the direct parent */
  ancestors: string[];
  /**
   * One flag per ancestor (same order as `ancestors`): whether that
   * ancestor still has dependants further down the page after this node's
   * own subtree — i.e. whether its trunk line continues past this node.
   */
  guides: boolean[];
}

/**
 * Dependency tree for the canvas, derived purely from the page's visibility
 * conditions. Document order stays the runtime order; the tree only
 * visualizes who drives whom.
 *
 * Subtrees are kept contiguous in document order: a question nests under
 * its driver only while that driver is still on the open chain (the
 * previous question and its ancestors). This is what lets trunk lines be
 * drawn straight through the rows between a driver and its last dependant
 * without ever crossing an unrelated card.
 */
export function buildQuestionTree(page: SurveyPageV1): QuestionTreeNode[] {
  const questions = page.questions;
  const indexById = new Map<string, number>();
  questions.forEach((question, index) => {
    // First occurrence wins; duplicate ids are rejected by validation anyway.
    if (!indexById.has(question.id)) indexById.set(question.id, index);
  });

  const parentIndex: (number | null)[] = [];
  const external: boolean[] = [];
  const depth: number[] = [];
  // The open chain: ancestors of the previous question plus itself.
  let chain: number[] = [];

  questions.forEach((question, index) => {
    const leaves = visibleIfLeaves(question.visibleIf);
    let target: number | undefined;
    let unresolvable = leaves.length === 0;
    if (!unresolvable) {
      const targets = new Set<string>();
      for (const leaf of leaves) {
        if (isMetadataCondition(leaf) || !leaf.questionId) {
          unresolvable = true;
          break;
        }
        targets.add(leaf.questionId);
      }
      if (!unresolvable && targets.size === 1) {
        const [only] = targets;
        const candidate = only === undefined ? undefined : indexById.get(only);
        if (candidate !== undefined && candidate < index) target = candidate;
      }
    }

    const chainPosition = target === undefined ? -1 : chain.indexOf(target);
    if (target !== undefined && chainPosition !== -1) {
      parentIndex.push(target);
      external.push(false);
      depth.push(depth[target] + 1);
      chain = [...chain.slice(0, chainPosition + 1), index];
    } else {
      parentIndex.push(null);
      // Unconditional questions are plain top-level; every conditional one
      // that could not nest is marked, whatever the reason.
      external.push(leaves.length > 0);
      depth.push(0);
      chain = [index];
    }
  });

  // With contiguous subtrees, a node's subtree is the run of deeper nodes
  // that follows it — one backward pass gives every subtree's last index.
  const subtreeEnd: number[] = new Array(questions.length);
  for (let index = questions.length - 1; index >= 0; index--) {
    let end = index;
    let cursor = index + 1;
    while (cursor < questions.length && depth[cursor] > depth[index]) {
      end = subtreeEnd[cursor];
      cursor = end + 1;
    }
    subtreeEnd[index] = end;
  }

  return questions.map((question, index) => {
    const ancestors: number[] = [];
    let cursor = parentIndex[index];
    while (cursor !== null) {
      ancestors.unshift(cursor);
      cursor = parentIndex[cursor];
    }
    const guides = ancestors.map((ancestor, level) => {
      // The next node down the chain (or this node itself for the direct
      // parent) owns the subtree that does not count as "further down".
      const branchRoot = ancestors[level + 1] ?? index;
      return subtreeEnd[ancestor] > subtreeEnd[branchRoot];
    });
    const parent = parentIndex[index];
    return {
      id: question.id,
      depth: depth[index],
      parentId: parent === null ? null : questions[parent].id,
      externalDependency: external[index],
      ancestors: ancestors.map((ancestor) => questions[ancestor].id),
      guides,
    };
  });
}

/**
 * The guide levels the canvas actually draws for a node: at most the last
 * MAX_DRAWN_DEPTH ancestors, since indentation is clamped to that depth.
 */
export function drawnGuides(
  node: QuestionTreeNode,
): { ancestorId: string; continues: boolean; isParent: boolean }[] {
  const start = Math.max(0, node.ancestors.length - MAX_DRAWN_DEPTH);
  return node.ancestors.slice(start).map((ancestorId, offset) => {
    const level = start + offset;
    return {
      ancestorId,
      continues: node.guides[level] ?? false,
      isParent: level === node.ancestors.length - 1,
    };
  });
}

/**
 * Nodes are rebuilt on every document change; hand back the previous object
 * when nothing about a node changed so memoized cards keep their props.
 */
export function reuseStableNodes(
  previous: ReadonlyMap<string, QuestionTreeNode>,
  next: QuestionTreeNode[],
): QuestionTreeNode[] {
  return next.map((node) => {
    const before = previous.get(node.id);
    if (
      before &&
      before.depth === node.depth &&
      before.parentId === node.parentId &&
      before.externalDependency === node.externalDependency &&
      before.ancestors.length === node.ancestors.length &&
      before.ancestors.every((id, index) => id === node.ancestors[index]) &&
      before.guides.every((flag, index) => flag === node.guides[index])
    ) {
      return before;
    }
    return node;
  });
}
