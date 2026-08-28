import { describe, expect, it } from "vitest";
import { validateSurveyDocumentV1 } from "../../components/shared/canonicalSurvey.js";
import { buildSurveySource } from "../SurveyCodePreview.js";
import {
  CONDITIONAL_FLOW_DOCUMENT,
  GROUPED_PAGE_DOCUMENT,
  LEGACY_SURVEY_CONFIG,
  MULTI_CHOICE_DOCUMENT,
  ONE_QUESTION_PER_PAGE_DOCUMENT,
  RECOMMENDED_SURVEY_DOCUMENT,
  SEARCHABLE_MULTI_CHOICE_DOCUMENT,
  SINGLE_CHOICE_DOCUMENT,
  TEXT_QUESTION_DOCUMENT,
} from "../surveyExamples.js";

const currentDocuments = [
  RECOMMENDED_SURVEY_DOCUMENT,
  ONE_QUESTION_PER_PAGE_DOCUMENT,
  GROUPED_PAGE_DOCUMENT,
  CONDITIONAL_FLOW_DOCUMENT,
  TEXT_QUESTION_DOCUMENT,
  SINGLE_CHOICE_DOCUMENT,
  MULTI_CHOICE_DOCUMENT,
  SEARCHABLE_MULTI_CHOICE_DOCUMENT,
];

describe("Storybook survey examples", () => {
  it.each(
    currentDocuments,
  )("uses a valid SurveyDocumentV1 with explicit pages", (document) => {
    expect(validateSurveyDocumentV1(document)).toBe(document);
    expect(document.authoringSchemaVersion).toBe(1);
    expect(document.pages.length).toBeGreaterThan(0);
  });

  it("generates copy-ready SurveyDocumentV1 source", () => {
    const source = buildSurveySource({
      survey: RECOMMENDED_SURVEY_DOCUMENT,
      context: { tags: { app: "eksempel-app" } },
      behavior: { storageStrategy: "consent" },
    });

    expect(source).toContain(
      "import type { SurveyDocumentV1, LumiSurveyContext, LumiSurveyBehavior }",
    );
    expect(source).toContain("authoringSchemaVersion");
    expect(source).toContain('"pages"');
    expect(source).toContain("satisfies SurveyDocumentV1");
    expect(source).toContain("satisfies LumiSurveyContext");
    expect(source).toContain("satisfies LumiSurveyBehavior");
    expect(source).not.toContain("LumiSurveyConfig");
  });

  it("labels the compatibility example as LumiSurveyConfig source", () => {
    const source = buildSurveySource({ survey: LEGACY_SURVEY_CONFIG });

    expect(source).toContain("import type { LumiSurveyConfig }");
    expect(source).toContain('"questions"');
    expect(source).toContain("satisfies LumiSurveyConfig");
    expect(source).not.toContain("authoringSchemaVersion");
  });
});
