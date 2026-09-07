import {
  Alert,
  BodyShort,
  Button,
  Checkbox,
  CheckboxGroup,
  Heading,
  Radio,
  RadioGroup,
  Select,
  VStack,
} from "@navikt/ds-react";
import type { SurveyDocumentV1, SurveyQuestionV1 } from "@navikt/lumi-survey";
import { useState } from "react";
import { buildConditionSummaries } from "~/utils/conditionSummary";
import {
  isSimpleCondition,
  ruleLeaves,
  sources,
} from "~/utils/questionEditorModel";
import {
  conditionValueSuggestions,
  listReferenceableQuestions,
} from "~/utils/surveyDocument";
import { ConditionEditor } from "../ConditionEditor";

export function QuestionAudience({
  document,
  question,
  onChange,
  locked = false,
}: {
  document: SurveyDocumentV1;
  question: SurveyQuestionV1;
  onChange: (question: SurveyQuestionV1) => void;
  locked?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const questions = document.pages.flatMap((page) => page.questions);
  const index = questions.findIndex((q) => q.id === question.id);
  const source = questions.find((q) => q.id === sources(question)[0]);
  const leaves = ruleLeaves(question);
  const mode = !question.visibleIf
    ? "all"
    : leaves[0]?.operator === "EXISTS"
      ? "answered"
      : "answers";
  const simple = isSimpleCondition(question, questions);
  const earlier = questions.slice(0, index);
  const options = earlier.filter((q) => "options" in q);
  const summary = buildConditionSummaries(document).get(question.id);
  const values = leaves.flatMap((leaf) =>
    "value" in leaf && typeof leaf.value === "string" ? [leaf.value] : [],
  );
  function changeMode(mode: string, id?: string) {
    if (mode === "all") {
      onChange({ ...question, visibleIf: undefined });
      return;
    }
    const candidates = mode === "answers" ? options : earlier;
    const target =
      candidates.find((q) => q.id === (id ?? source?.id)) ?? candidates.at(-1);
    if (!target) return;
    onChange({
      ...question,
      visibleIf:
        mode === "answered"
          ? { questionId: target.id, operator: "EXISTS" }
          : {
              questionId: target.id,
              operator: target.type === "multiChoice" ? "CONTAINS" : "EQ",
              value: "",
            },
    });
  }
  function choose(values: string[]) {
    if (!source) return;
    const rules = values.map((value) => ({
      questionId: source.id,
      operator:
        source.type === "multiChoice" ? ("CONTAINS" as const) : ("EQ" as const),
      value,
    }));
    onChange({
      ...question,
      visibleIf:
        rules.length > 1
          ? { any: rules }
          : (rules[0] ?? {
              questionId: source.id,
              operator: source.type === "multiChoice" ? "CONTAINS" : "EQ",
              value: "",
            }),
    });
  }
  return (
    <VStack gap="space-12">
      <Heading size="xsmall" level="3">
        Hvem skal få spørsmålet?
      </Heading>
      {(!editing || !simple || locked) && (
        <BodyShort size="small">
          {question.visibleIf
            ? (summary ?? "Har en tilpasset svarregel")
            : "Alle som deltar"}
        </BodyShort>
      )}
      {mode === "answered" && source && !source.required && (
        <Alert variant="info" size="small">
          Spørsmål {questions.indexOf(source) + 1} er valgfritt. Hopper
          respondenten over det, vises ikke dette spørsmålet.
        </Alert>
      )}
      {!editing && !locked && (index > 0 || question.visibleIf) && (
        <Button
          size="small"
          variant="tertiary"
          onClick={() => setEditing(true)}
        >
          Endre hvem
        </Button>
      )}
      {editing &&
        !locked &&
        (simple ? (
          <>
            <RadioGroup
              legend="Vis spørsmålet til"
              value={mode}
              onChange={changeMode}
            >
              <Radio value="all">Alle som deltar</Radio>
              {options.length > 0 && (
                <Radio value="answers">De som velger bestemte svar</Radio>
              )}
              <Radio value="answered">
                De som har svart på et tidligere spørsmål
              </Radio>
            </RadioGroup>
            {mode !== "all" && (
              <Select
                label="Hvilket spørsmål?"
                value={source?.id ?? ""}
                onChange={(event) => changeMode(mode, event.target.value)}
              >
                {(mode === "answers" ? options : earlier).map((q) => (
                  <option key={q.id} value={q.id}>
                    {questions.indexOf(q) + 1}.{" "}
                    {q.prompt || "Uten spørsmålstekst"}
                  </option>
                ))}
              </Select>
            )}
            {mode === "answers" && source && "options" in source && (
              <CheckboxGroup
                legend="Hvilke svar skal gi oppfølgingsspørsmålet?"
                description="Ett av de valgte svarene er nok."
                value={values.filter(Boolean)}
                onChange={choose}
                error={
                  values.some(Boolean) ? undefined : "Velg minst ett svar."
                }
              >
                {source.options.map((option) => (
                  <Checkbox key={option.value} value={option.value}>
                    {option.label || "Uten svartekst"}
                  </Checkbox>
                ))}
              </CheckboxGroup>
            )}
          </>
        ) : (
          <>
            <Alert variant="info" size="small">
              Dette spørsmålet har en tilpasset svarregel. Den er beholdt og kan
              redigeres her.
            </Alert>
            <ConditionEditor
              condition={question.visibleIf}
              referenceable={listReferenceableQuestions(document, question.id)}
              suggestionsFor={(id) => conditionValueSuggestions(document, id)}
              onChange={(visibleIf) => onChange({ ...question, visibleIf })}
            />
          </>
        ))}
      {editing && !locked && (
        <Button
          size="small"
          variant="secondary"
          disabled={simple && mode === "answers" && !values.some(Boolean)}
          onClick={() => setEditing(false)}
        >
          Ferdig
        </Button>
      )}
    </VStack>
  );
}
