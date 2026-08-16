import { BranchingIcon, XMarkIcon } from "@navikt/aksel-icons";
import {
  BodyShort,
  Button,
  Detail,
  Select,
  TextField,
  Tooltip,
} from "@navikt/ds-react";
import {
  allowedConditionOperators,
  type ConditionValueSuggestion,
  isMetadataCondition,
  type ReferenceableQuestion,
  type VisibleIfConditionV1,
} from "~/utils/surveyDocument";
import styles from "./verksted.module.css";

type LeafCondition = Exclude<
  VisibleIfConditionV1,
  { any: unknown } | { all: unknown }
>;

type AnswerLeaf = Exclude<LeafCondition, { field: "METADATA" }>;

type ValuedOperator = "EQ" | "NEQ" | "GT" | "LT" | "CONTAINS";

function isGroup(
  condition: VisibleIfConditionV1,
): condition is Exclude<VisibleIfConditionV1, LeafCondition> {
  return "any" in condition || "all" in condition;
}

function isAnswerLeaf(
  condition: VisibleIfConditionV1,
): condition is AnswerLeaf {
  // Field-based like runtime and API: a stray `key` on an ANSWER leaf
  // must not demote it to a read-only code condition.
  return !isGroup(condition) && !isMetadataCondition(condition);
}

/**
 * DOM option values are type-prefixed so the string "3" can never
 * masquerade as the number 3 across a type change.
 */
function encodeValue(value: string | number | boolean | undefined): string {
  return `${typeof value}:${String(value ?? "")}`;
}

const OPERATOR_LABELS: Record<string, string> = {
  EXISTS: "har fått svar",
  EQ: "er lik",
  NEQ: "er ikke lik",
  GT: "er større enn",
  LT: "er mindre enn",
  CONTAINS: "inneholder",
};

export interface ConditionEditorProps {
  condition: VisibleIfConditionV1 | undefined;
  referenceable: ReferenceableQuestion[];
  suggestionsFor: (referencedId: string) => ConditionValueSuggestion[];
  onChange: (condition: VisibleIfConditionV1 | undefined) => void;
}

/**
 * Single-condition builder for question visibility ("Vis bare hvis …").
 * Mirrors the runtime rule that only earlier questions can be referenced.
 * Groups and METADATA conditions authored in code are shown read-only.
 */
export function ConditionEditor({
  condition,
  referenceable,
  suggestionsFor,
  onChange,
}: ConditionEditorProps) {
  if (condition === undefined) {
    const disabled = referenceable.length === 0;
    const addButton = (
      <Button
        type="button"
        variant="tertiary"
        size="small"
        icon={<BranchingIcon aria-hidden />}
        disabled={disabled}
        onClick={() =>
          onChange({ questionId: referenceable[0].id, operator: "EXISTS" })
        }
      >
        Vis bare hvis …
      </Button>
    );
    return disabled ? (
      <div className={styles.conditionAddWrap}>
        {addButton}
        <Detail as="span" className={styles.conditionHint}>
          Ingen tidligere spørsmål å referere til
        </Detail>
      </div>
    ) : (
      addButton
    );
  }

  if (!isAnswerLeaf(condition)) {
    return (
      <div className={styles.conditionSection}>
        <div className={styles.conditionHeader}>
          <Detail as="span" className={styles.eyebrow}>
            BETINGELSE
          </Detail>
          <Tooltip content="Fjern betingelsen">
            <Button
              type="button"
              variant="tertiary-neutral"
              size="xsmall"
              icon={<XMarkIcon aria-hidden />}
              aria-label="Fjern betingelsen"
              onClick={() => onChange(undefined)}
            />
          </Tooltip>
        </div>
        <BodyShort size="small" textColor="subtle">
          Sammensatt betingelse satt i kode. Den beholdes som den er, eller kan
          fjernes her.
        </BodyShort>
      </div>
    );
  }

  const referenced = referenceable.find(
    (candidate) => candidate.id === condition.questionId,
  );
  const suggestions = condition.questionId
    ? suggestionsFor(condition.questionId)
    : [];
  const operators = referenced
    ? allowedConditionOperators(referenced.type)
    : ["EXISTS"];
  const needsValue = condition.operator !== "EXISTS";

  // Stale states render EXPLICITLY as dead, disabled options with a warning
  // — a native select must never pretend the condition was repaired.
  const referenceMissing = condition.questionId !== undefined && !referenced;
  const operatorStale =
    !referenceMissing && !operators.includes(condition.operator);
  const valueStale =
    needsValue &&
    !referenceMissing &&
    suggestions.length > 0 &&
    !suggestions.some((candidate) => candidate.value === condition.value);
  const valueTypeInvalid =
    needsValue &&
    !referenceMissing &&
    suggestions.length === 0 &&
    condition.value !== undefined &&
    typeof condition.value !== "string";
  // Blank text answers never reach runtime answer state, so a blank value
  // makes the condition misleading; the release gates reject it.
  const valueBlank =
    needsValue &&
    !referenceMissing &&
    suggestions.length === 0 &&
    typeof condition.value === "string" &&
    condition.value.trim().length === 0;
  // Repair guidance renders as Aksel field errors: linked to the control
  // via aria-describedby and announced via the built-in polite live region.
  const questionError = referenceMissing
    ? "Spørsmålet betingelsen peker på finnes ikke lenger her — velg et annet spørsmål eller fjern betingelsen."
    : undefined;
  const operatorError = operatorStale
    ? "Vilkåret passer ikke spørsmålet det peker på lenger — velg et annet vilkår."
    : undefined;
  const valueError = valueStale
    ? "Verdien finnes ikke blant alternativene lenger — velg en gyldig verdi."
    : valueTypeInvalid
      ? "Verdien må være tekst når den peker på et tekstspørsmål — skriv den på nytt."
      : valueBlank
        ? "Verdien kan ikke være tom — skriv inn teksten svaret skal sammenlignes med."
        : undefined;

  const firstValueFor = (referencedId: string): string | number => {
    const [first] = suggestionsFor(referencedId);
    return first ? first.value : "";
  };

  const changeReferenced = (referencedId: string) => {
    const nextType = referenceable.find(
      (candidate) => candidate.id === referencedId,
    )?.type;
    const allowed = nextType ? allowedConditionOperators(nextType) : ["EXISTS"];
    const operator = allowed.includes(condition.operator)
      ? condition.operator
      : "EXISTS";
    if (operator === "EXISTS") {
      onChange({ questionId: referencedId, operator: "EXISTS" });
    } else {
      onChange({
        questionId: referencedId,
        operator: operator as ValuedOperator,
        value: firstValueFor(referencedId),
      });
    }
  };

  const changeOperator = (operator: string) => {
    if (operator === "EXISTS") {
      onChange({ questionId: condition.questionId, operator: "EXISTS" });
      return;
    }
    onChange({
      questionId: condition.questionId,
      operator: operator as ValuedOperator,
      value: condition.value ?? firstValueFor(condition.questionId ?? ""),
    });
  };

  const changeValue = (raw: string) => {
    const suggestion = suggestions.find(
      (candidate) => encodeValue(candidate.value) === raw,
    );
    onChange({
      questionId: condition.questionId,
      operator: condition.operator as ValuedOperator,
      value: suggestion ? suggestion.value : raw,
    });
  };

  return (
    <div className={styles.conditionSection}>
      <div className={styles.conditionHeader}>
        <Detail as="span" className={styles.eyebrow}>
          VISES BARE HVIS
        </Detail>
        <Tooltip content="Fjern betingelsen">
          <Button
            type="button"
            variant="tertiary-neutral"
            size="xsmall"
            icon={<XMarkIcon aria-hidden />}
            aria-label="Fjern betingelsen"
            onClick={() => onChange(undefined)}
          />
        </Tooltip>
      </div>
      <div className={styles.conditionRow}>
        <Select
          label="Spørsmål"
          size="small"
          value={condition.questionId ?? ""}
          error={questionError}
          onChange={(event) => changeReferenced(event.target.value)}
        >
          {referenceMissing ? (
            <option value={condition.questionId} disabled>
              Finnes ikke lenger ({condition.questionId})
            </option>
          ) : null}
          {referenceable.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.pageNumber}.{candidate.questionNumber}{" "}
              {candidate.prompt.trim() || "Uten tekst"}
            </option>
          ))}
        </Select>
        <Select
          label="Vilkår"
          size="small"
          value={condition.operator}
          error={operatorError}
          onChange={(event) => changeOperator(event.target.value)}
        >
          {operatorStale ? (
            <option value={condition.operator} disabled>
              {OPERATOR_LABELS[condition.operator] ?? condition.operator}{" "}
              (passer ikke lenger)
            </option>
          ) : null}
          {operators.map((operator) => (
            <option key={operator} value={operator}>
              {OPERATOR_LABELS[operator]}
            </option>
          ))}
        </Select>
        {needsValue ? (
          suggestions.length > 0 ? (
            <Select
              label="Verdi"
              size="small"
              value={encodeValue(condition.value)}
              error={valueError}
              onChange={(event) => changeValue(event.target.value)}
            >
              {valueStale ? (
                <option value={encodeValue(condition.value)} disabled>
                  «{String(condition.value ?? "")}» (finnes ikke)
                </option>
              ) : null}
              {suggestions.map((suggestion) => (
                <option
                  key={encodeValue(suggestion.value)}
                  value={encodeValue(suggestion.value)}
                >
                  {suggestion.label}
                </option>
              ))}
            </Select>
          ) : (
            <TextField
              label="Verdi"
              size="small"
              value={String(condition.value ?? "")}
              error={valueError}
              onChange={(event) => changeValue(event.target.value)}
            />
          )
        ) : null}
      </div>
    </div>
  );
}
