import type {
  LumiSurveyAnswerValue,
  SurveyDocumentV1,
} from "@navikt/lumi-survey";
import {
  classifyDeviceTypeByViewport,
  resolveDocumentVisibility,
} from "@navikt/lumi-survey";
import type { SurveyPresentation } from "~/types/surveyAuthoring";
import { previewContextTags } from "~/utils/surveyRevision";

/** The size of the page the preview shows the survey on. */
export interface PreviewViewport {
  width: number;
  height: number;
}

/**
 * What the preview's survey has for its visibility rules: the tags of the
 * preview, and what the survey collects itself, as `getVisibilityMetadata` in
 * the package builds it. The preview sets the viewport, and the device type
 * follows from its width. The browser and the screen are the author's.
 */
export function previewMetadata(
  environment: string,
  presentation: SurveyPresentation,
  viewport?: PreviewViewport,
): Record<string, unknown> {
  return {
    ...previewContextTags(environment, presentation),
    ...(viewport
      ? { viewport, deviceType: classifyDeviceTypeByViewport(viewport.width) }
      : {}),
    ...(typeof navigator === "undefined"
      ? {}
      : { userAgent: navigator.userAgent }),
    ...(typeof screen === "undefined"
      ? {}
      : { screenResolution: { width: screen.width, height: screen.height } }),
  };
}

/**
 * Which conditional questions the preview shows with its answers now,
 * resolved by the package as the survey resolves them, so editor and
 * runtime can never drift apart. A question hidden by its own condition
 * hides the questions that depend on its answer, also when the answer is
 * still kept.
 */
export function computeLiveVisibility(
  document: SurveyDocumentV1,
  answers: Record<string, LumiSurveyAnswerValue>,
  environment: string,
  presentation: SurveyPresentation,
  viewport?: PreviewViewport,
): Map<string, boolean> {
  const questions = document.pages.flatMap((page) => page.questions);
  const { visibleQuestionIds } = resolveDocumentVisibility(
    questions,
    answers,
    previewMetadata(environment, presentation, viewport),
  );
  const visibility = new Map<string, boolean>();
  for (const question of questions) {
    if (question.visibleIf) {
      visibility.set(question.id, visibleQuestionIds.has(question.id));
    }
  }
  return visibility;
}
