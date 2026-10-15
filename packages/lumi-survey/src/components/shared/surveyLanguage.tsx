import { createContext, type ReactNode, useContext } from "react";
import type { LumiSurveyQuestion } from "../../core/types.js";
import { formatQuestionPrompt } from "../questions/utils/formatQuestionPrompt.js";

/** Language of the widget's built-in copy. */
export const BUILT_IN_COPY_LANGUAGE = "nb";

/**
 * Language of the text authored in the survey. Undefined unless the app sets
 * `lang`, so the survey inherits the page language as before 2.3.0.
 */
const SurveyLanguageContext = createContext<string | undefined>(undefined);

export const SurveyLanguageProvider = SurveyLanguageContext.Provider;

/** `lang` for an element that holds only authored survey text. */
export const useSurveyLang = (): string | undefined =>
  useContext(SurveyLanguageContext);

/**
 * `lang` for an element that holds only built-in copy. Copy the app has
 * replaced, for example through `labels`, inherits the page language.
 */
export const builtInCopyLang = (isDefault: boolean): string | undefined =>
  isDefault ? BUILT_IN_COPY_LANGUAGE : undefined;

/** Authored survey text next to other text. */
export const SurveyText = ({ children }: { children?: ReactNode }) => {
  const lang = useSurveyLang();
  if (!lang || children == null || children === false || children === "") {
    return <>{children}</>;
  }
  return <span lang={lang}>{children}</span>;
};

/** Built-in copy next to other text, marked as Bokmål while not replaced. */
export const BuiltInText = ({
  children,
  isDefault = true,
}: {
  children?: ReactNode;
  isDefault?: boolean;
}) => {
  const lang = builtInCopyLang(isDefault);
  if (!lang || children == null || children === false || children === "") {
    return <>{children}</>;
  }
  return <span lang={lang}>{children}</span>;
};

/**
 * The authored prompt, followed by the built-in "(valgfritt)" suffix in
 * Bokmål where `formatQuestionPrompt` adds it.
 */
export const QuestionPrompt = ({
  question,
}: {
  question: Pick<LumiSurveyQuestion, "prompt" | "required">;
}) => {
  const formatted = formatQuestionPrompt(question);
  const suffix = formatted.startsWith(question.prompt)
    ? formatted.slice(question.prompt.length).trim()
    : "";

  return (
    <>
      <SurveyText>{question.prompt}</SurveyText>
      {suffix && (
        <>
          {" "}
          <BuiltInText>{suffix}</BuiltInText>
        </>
      )}
    </>
  );
};
