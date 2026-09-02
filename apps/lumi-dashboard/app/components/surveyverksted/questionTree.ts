import type { SurveyPageV1 } from "@navikt/lumi-survey";
import { isMetadataCondition, visibleIfLeaves } from "~/utils/surveyDocument";

export interface QuestionTreeNode {
  id: string;
  /** 0 = top level; each same-page driver nests its dependants one deeper */
  depth: number;
  parentId: string | null;
  /**
   * Conditional, but not on a single earlier question on this page (cross-
   * page, several targets, metadata, or a forward reference) — drawn at top
   * level with an external marker instead of a tree connector.
   */
  externalDependency: boolean;
  /** Ancestor ids from the root down to the direct parent */
  ancestors: string[];
  /**
   * One flag per ancestor (same order as `ancestors`): whether that
   * ancestor still has dependants further down the page that are not
   * inside this node's own subtree — i.e. whether its trunk line continues
   * past this node.
   */
  guides: boolean[];
}

/**
 * Dependency tree for the canvas, derived purely from the page's visibility
 * conditions. Document order stays the runtime order; the tree only
 * visualizes who drives whom. Works for any order the runtime accepts,
 * including dependants that follow a sibling's subtree.
 */
export function buildQuestionTree(page: SurveyPageV1): QuestionTreeNode[] {
  const questions = page.questions;
  const indexById = new Map(
    questions.map((question, index) => [question.id, index]),
  );

  const parentIndex: (number | null)[] = [];
  const external: boolean[] = [];
  questions.forEach((question, index) => {
    const leaves = visibleIfLeaves(question.visibleIf);
    if (leaves.length === 0) {
      parentIndex.push(null);
      external.push(false);
      return;
    }
    const targets = new Set<string>();
    let unresolvable = false;
    for (const leaf of leaves) {
      if (isMetadataCondition(leaf) || !leaf.questionId) {
        unresolvable = true;
        break;
      }
      targets.add(leaf.questionId);
    }
    const [target] = targets;
    const targetIndex =
      !unresolvable && targets.size === 1 && target !== undefined
        ? indexById.get(target)
        : undefined;
    if (targetIndex !== undefined && targetIndex < index) {
      parentIndex.push(targetIndex);
      external.push(false);
    } else {
      parentIndex.push(null);
      external.push(true);
    }
  });

  const depth: number[] = [];
  questions.forEach((_, index) => {
    const parent = parentIndex[index];
    depth.push(parent === null ? 0 : depth[parent] + 1);
  });

  const isDescendant = (candidate: number, ancestor: number): boolean => {
    let cursor = parentIndex[candidate];
    while (cursor !== null) {
      if (cursor === ancestor) return true;
      cursor = parentIndex[cursor];
    }
    return false;
  };

  return questions.map((question, index) => {
    // Ancestor chain from the root down to the direct parent.
    const chain: number[] = [];
    let cursor = parentIndex[index];
    while (cursor !== null) {
      chain.unshift(cursor);
      cursor = parentIndex[cursor];
    }
    const guides = chain.map((ancestor, level) => {
      // The node at the next level down the chain (or this node itself for
      // the direct parent) owns the subtree that must be excluded.
      const branchRoot = chain[level + 1] ?? index;
      for (let later = index + 1; later < questions.length; later++) {
        if (
          isDescendant(later, ancestor) &&
          later !== branchRoot &&
          !isDescendant(later, branchRoot)
        ) {
          return true;
        }
      }
      return false;
    });
    const parent = parentIndex[index];
    return {
      id: question.id,
      depth: depth[index],
      parentId: parent === null ? null : questions[parent].id,
      externalDependency: external[index],
      ancestors: chain.map((ancestor) => questions[ancestor].id),
      guides,
    };
  });
}
