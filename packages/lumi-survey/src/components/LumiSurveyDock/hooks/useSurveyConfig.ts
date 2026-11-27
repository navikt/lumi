import { useMemo } from "react";
import type {
  LumiSurveyDefinition,
  SurveyDocumentV1,
} from "../../surveyTypes.js";
import type {
  LumiSurveyBehavior,
  LumiSurveyIntroConfig,
  LumiSurveyLabels,
  LumiSurveyStyle,
  LumiSurveySuccessConfig,
} from "../propTypes.js";
import { type ResolvedConfig, resolveConfig } from "../resolveConfig.js";

export interface UseSurveyConfigOptions {
  survey: LumiSurveyDefinition;
  labels?: LumiSurveyLabels;
  success?: LumiSurveySuccessConfig;
  style?: LumiSurveyStyle;
  behavior?: LumiSurveyBehavior;
  intro?: LumiSurveyIntroConfig;
}

/**
 * Resolves the props of a survey component with defaults. The intro and
 * receipt come from the survey document, adjusted per field by the props.
 */
export function useSurveyConfig({
  survey,
  labels,
  success,
  style,
  behavior,
  intro,
}: UseSurveyConfigOptions): ResolvedConfig {
  // Intro/success authored in a V1 survey document act as defaults; explicit
  // embed props override them. Blank titles (lenient drafts) read as absent.
  const documentScreens = useMemo(() => {
    if (!survey || typeof survey !== "object" || !("pages" in survey)) {
      return { intro: undefined, success: undefined };
    }
    const document = survey as SurveyDocumentV1;
    const documentIntro =
      document.intro && document.intro.title.trim().length > 0
        ? {
            title: document.intro.title,
            body: document.intro.body,
            // Blank labels never reach the button; runtime falls back to
            // "Start" so it always has an accessible name.
            startLabel: document.intro.startLabel?.trim()
              ? document.intro.startLabel
              : undefined,
          }
        : undefined;
    const documentSuccess =
      document.success && document.success.title.trim().length > 0
        ? { title: document.success.title, body: document.success.body }
        : undefined;
    return { intro: documentIntro, success: documentSuccess };
  }, [survey]);
  // Field-level merge: the document authors the content, embed props adjust
  // individual fields — a partial `success={{ primaryLabel }}` must never
  // throw away the authored title/body.
  const { effectiveIntro, effectiveSuccess } = useMemo(() => {
    const mergedIntro =
      intro || documentScreens.intro
        ? ({
            ...documentScreens.intro,
            ...intro,
          } as LumiSurveyIntroConfig)
        : undefined;
    const mergedSuccess =
      success || documentScreens.success
        ? { ...documentScreens.success, ...success }
        : undefined;
    return { effectiveIntro: mergedIntro, effectiveSuccess: mergedSuccess };
  }, [intro, success, documentScreens]);

  return useMemo(
    () =>
      resolveConfig(labels, effectiveSuccess, style, behavior, effectiveIntro),
    [labels, effectiveSuccess, style, behavior, effectiveIntro],
  );
}
