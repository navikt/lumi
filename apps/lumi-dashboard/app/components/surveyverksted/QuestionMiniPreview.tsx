import { BodyShort } from "@navikt/ds-react";
import type { LumiSurveyQuestion, SurveyQuestionV1 } from "@navikt/lumi-survey";
import {
  MultiChoiceField,
  RatingQuestionField,
  SingleChoiceField,
  TextQuestionField,
} from "@navikt/lumi-survey";
import styles from "./verksted.module.css";

const noop = () => {};

const MAX_VISIBLE_OPTIONS = 4;

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
      return (
        <TextQuestionField
          question={{ ...core, minRows: 2 }}
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
      const visible = core.options.slice(0, MAX_VISIBLE_OPTIONS);
      const hidden = core.options.length - visible.length;
      return (
        <>
          {core.type === "singleChoice" ? (
            <SingleChoiceField
              question={{ ...core, options: visible }}
              value={undefined}
              onChange={noop}
              validationErrorMessage=""
              isMissing={false}
              disabled={false}
              hideLabel
            />
          ) : (
            <MultiChoiceField
              question={{ ...core, options: visible }}
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
