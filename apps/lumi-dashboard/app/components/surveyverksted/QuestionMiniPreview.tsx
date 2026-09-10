import { BodyShort } from "@navikt/ds-react";
import type {
  ChoiceQuestion,
  LumiSurveyQuestion,
  SurveyQuestionV1,
} from "@navikt/lumi-survey";
import {
  DefaultQuestionRenderer,
  MultiChoiceField,
  RatingQuestionField,
  SingleChoiceField,
  TextQuestionField,
} from "@navikt/lumi-survey";
import styles from "./verksted.module.css";

const noop = () => {};

const MAX_VISIBLE_OPTIONS = 4;

function stablePreviewOptions(question: ChoiceQuestion) {
  const options = [...question.options];
  if (!question.randomize) return options.slice(0, MAX_VISIBLE_OPTIONS);

  // A compact preview should not jump on every editor render, but it must
  // sample the complete option list when the real widget will randomize it.
  const hash = (value: string) => {
    let result = 2166136261;
    for (const character of value) {
      result ^= character.charCodeAt(0);
      result = Math.imul(result, 16777619);
    }
    return result >>> 0;
  };
  return options
    .sort(
      (left, right) =>
        hash(`${question.id}:${left.value}`) -
        hash(`${question.id}:${right.value}`),
    )
    .slice(0, MAX_VISIBLE_OPTIONS);
}

/**
 * The V1 authoring question narrows `visibleIf`/`logic`; the field
 * components take the core question shape. Rendering ignores both, so a
 * stripped cast is safe here.
 */
function toCoreQuestion(question: SurveyQuestionV1): LumiSurveyQuestion {
  const { visibleIf: _visibleIf, logic: _logic, ...core } = question;
  return core as LumiSurveyQuestion;
}

/**
 * Renders the question with the real widget field components, inert and
 * hidden from assistive technology. The collapsed card's button carries the
 * accessible description; this is the faithful visual echo.
 */
export function QuestionMiniPreview({
  question,
}: {
  question: SurveyQuestionV1;
}) {
  return (
    <div
      data-mini-preview
      inert
      aria-hidden="true"
      className={styles.miniPreview}
    >
      <MiniField question={question} />
    </div>
  );
}

function MiniField({ question }: { question: SurveyQuestionV1 }) {
  const core = toCoreQuestion(question);
  switch (core.type) {
    case "rating":
      return (
        <RatingQuestionField
          question={core}
          value={undefined}
          onChange={noop}
          validationErrorMessage=""
          isMissing={false}
          disabled={false}
          hidePrompt
          hideDescription
          wrap={false}
          fieldsetPaddingBlock="space-0"
          fieldsetPaddingInline="space-0"
        />
      );
    case "text":
      // An empty answer field says nothing about the question; without an
      // authored placeholder, name what the respondent does here.
      return (
        <TextQuestionField
          question={{
            ...core,
            minRows: 2,
            placeholder:
              core.placeholder?.trim() ||
              "Respondenten skriver svaret sitt her",
          }}
          value={undefined}
          onChange={noop}
          validationErrorMessage=""
          isMissing={false}
          disabled={false}
          hideLabel
        />
      );
    case "singleChoice":
    case "multiChoice": {
      const visible = stablePreviewOptions(core);
      const hidden = core.options.length - visible.length;
      return (
        <>
          {core.type === "singleChoice" ? (
            <SingleChoiceField
              question={{ ...core, options: visible, randomize: false }}
              value={undefined}
              onChange={noop}
              validationErrorMessage=""
              isMissing={false}
              disabled={false}
              hideLabel
            />
          ) : core.variant === "combobox" ? (
            <DefaultQuestionRenderer
              question={{ ...core, options: visible, randomize: false }}
              value={undefined}
              onChange={noop}
              validationErrorMessage=""
              isMissing={false}
              disabled={false}
              hideLabel
            />
          ) : (
            <MultiChoiceField
              question={{ ...core, options: visible, randomize: false }}
              value={undefined}
              onChange={noop}
              validationErrorMessage=""
              isMissing={false}
              disabled={false}
              hideLabel
            />
          )}
          {hidden > 0 ? (
            <BodyShort size="small" textColor="subtle">
              +{hidden} til
            </BodyShort>
          ) : null}
        </>
      );
    }
    default:
      return null;
  }
}
