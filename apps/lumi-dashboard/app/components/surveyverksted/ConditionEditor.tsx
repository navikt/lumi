import { BranchingIcon, PlusIcon, XMarkIcon } from "@navikt/aksel-icons";
import {
  BodyShort,
  Button,
  Detail,
  Select,
  TextField,
  ToggleGroup,
  Tooltip,
} from "@navikt/ds-react";
import { useEffect, useRef } from "react";
import { describeVisibleIf } from "~/utils/conditionSummary";
import {
  allowedConditionOperators,
  buildVisibleIf,
  type ConditionCombinator,
  type ConditionLeafV1,
  type ConditionValueSuggestion,
  conditionCombinator,
  isMetadataCondition,
  type ReferenceableQuestion,
  type VisibleIfConditionV1,
  visibleIfLeaves,
} from "~/utils/surveyDocument";
import { LiveVisibilityChip } from "./LiveVisibilityChip";
import styles from "./verksted.module.css";

/**
 * Stable editor-local row identities. Never serialized into visibleIf —
 * they only keep React keys and focus tied to the RIGHT row when rows
 * are removed from the middle of the list.
 */
function useStableRowIds(count: number) {
  const nextRef = useRef(0);
  const idsRef = useRef<number[]>([]);
  if (idsRef.current.length !== count) {
    // External shape change (add, undo, question switch): keep existing
    // positions, mint ids for new rows.
    idsRef.current = Array.from({ length: count }, (_, index) => {
      const existing = idsRef.current[index];
      return existing === undefined ? nextRef.current++ : existing;
    });
  }
  return {
    ids: idsRef.current,
    removeAt(index: number) {
      idsRef.current = idsRef.current.filter((_, i) => i !== index);
    },
  };
}

type AnswerLeaf = Exclude<ConditionLeafV1, { field: "METADATA" }>;

type ValuedOperator = "EQ" | "NEQ" | "GT" | "LT" | "CONTAINS";

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
  /** Page number of the question owning the condition, for «på side N». */
  ownPageNumber?: number;
  /** Whether the condition holds with the preview's answers right now */
  liveVisible?: boolean;
}

/**
 * Condition builder for question visibility ("Vis bare hvis …").
 * Several conditions combine with all/any in the same one-level model as
 * the runtime; a single condition stays a plain leaf. Mirrors the runtime
 * rule that only earlier questions can be referenced. METADATA conditions
 * authored in code are shown read-only but can be removed.
 */
export function ConditionEditor({
  condition,
  referenceable,
  suggestionsFor,
  onChange,
  ownPageNumber,
  liveVisible,
}: ConditionEditorProps) {
  const leaves = visibleIfLeaves(condition);
  const sentence = describeVisibleIf(condition, {
    resolveRef: (questionId) => {
      const match = referenceable.find(
        (candidate) => candidate.id === questionId,
      );
      return match
        ? {
            prompt: match.prompt,
            pageNumber: match.pageNumber,
            type: match.type,
          }
        : null;
    },
    suggestionsFor,
    ownPageNumber,
  });
  const rowIds = useStableRowIds(leaves.length);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  // `row:<id>` / "add" — resolved to a focus() after the removal renders,
  // so focus moves with an announcement instead of silently via DOM reuse.
  const pendingFocusRef = useRef<string | null>(null);
  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending) return;
    pendingFocusRef.current = null;
    const root = sectionRef.current;
    if (!root) return;
    // Resolve against what actually remains: the requested row, then the
    // add button, then the header remove button — a collapsed metadata
    // branch has no add button, and a disabled control cannot take focus.
    const selectors =
      pending === "add"
        ? ["[data-condition-add]", "[data-condition-remove-all]"]
        : [
            `[data-condition-remove="${pending}"]`,
            "[data-condition-add]",
            "[data-condition-remove-all]",
          ];
    for (const selector of selectors) {
      const target = root.querySelector<HTMLButtonElement>(selector);
      if (target && !target.disabled) {
        target.focus();
        return;
      }
    }
  });

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

  const combinator = conditionCombinator(condition);

  if (leaves.length === 1 && isMetadataCondition(leaves[0])) {
    return (
      <div ref={sectionRef} className={styles.conditionSection}>
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
              data-condition-remove-all=""
              onClick={() => onChange(undefined)}
            />
          </Tooltip>
        </div>
        <BodyShort size="small" textColor="subtle">
          Metadatabetingelse satt i kode. Den beholdes som den er, eller kan
          fjernes her.
        </BodyShort>
      </div>
    );
  }

  const emit = (
    nextLeaves: readonly ConditionLeafV1[],
    nextCombinator: ConditionCombinator = combinator,
  ) => onChange(buildVisibleIf(nextLeaves, nextCombinator));

  const updateLeaf = (index: number, leaf: ConditionLeafV1) =>
    emit(leaves.map((current, i) => (i === index ? leaf : current)));
  const removeLeaf = (index: number) => {
    pendingFocusRef.current =
      leaves.length <= 2
        ? "add"
        : String(rowIds.ids[index + 1] ?? rowIds.ids[index - 1]);
    rowIds.removeAt(index);
    emit(leaves.filter((_, i) => i !== index));
  };
  const addLeaf = () =>
    emit([...leaves, { questionId: referenceable[0].id, operator: "EXISTS" }]);

  return (
    <div ref={sectionRef} className={styles.conditionSection}>
      <div className={styles.conditionHeader}>
        <Detail as="span" className={styles.eyebrow}>
          VISES BARE HVIS
        </Detail>
        <span className={styles.conditionHeaderMeta}>
          {liveVisible !== undefined ? (
            <LiveVisibilityChip visible={liveVisible} />
          ) : null}
          <Tooltip content="Fjern betingelsen">
            <Button
              type="button"
              variant="tertiary-neutral"
              size="xsmall"
              icon={<XMarkIcon aria-hidden />}
              aria-label="Fjern betingelsen"
              data-condition-remove-all=""
              onClick={() => onChange(undefined)}
            />
          </Tooltip>
        </span>
      </div>
      {sentence ? (
        <BodyShort
          size="small"
          className={styles.conditionSentence}
          aria-hidden
        >
          {sentence}
        </BodyShort>
      ) : null}
      {leaves.length >= 2 ? (
        <ToggleGroup
          label="Kombiner betingelsene"
          size="small"
          value={combinator}
          onChange={(next) => emit(leaves, next as ConditionCombinator)}
        >
          <ToggleGroup.Item value="all" label="Alle må stemme" />
          <ToggleGroup.Item value="any" label="Minst én må stemme" />
        </ToggleGroup>
      ) : null}
      {leaves.map((leaf, index) => {
        const rowId = rowIds.ids[index];
        const onRemove =
          leaves.length > 1 ? () => removeLeaf(index) : undefined;
        const groupLabel =
          leaves.length > 1 ? `Betingelse ${index + 1}` : undefined;
        return isMetadataCondition(leaf) ? (
          <MetadataConditionRow
            key={rowId}
            leaf={leaf}
            rowId={rowId}
            index={index}
            groupLabel={groupLabel}
            onRemove={onRemove}
          />
        ) : (
          <AnswerConditionRow
            key={rowId}
            leaf={leaf}
            rowId={rowId}
            index={index}
            groupLabel={groupLabel}
            referenceable={referenceable}
            suggestionsFor={suggestionsFor}
            onLeafChange={(next) => updateLeaf(index, next)}
            onRemove={onRemove}
          />
        );
      })}
      <div>
        <Button
          type="button"
          variant="tertiary"
          size="small"
          icon={<PlusIcon aria-hidden />}
          disabled={referenceable.length === 0}
          data-condition-add=""
          onClick={addLeaf}
        >
          Legg til betingelse
        </Button>
      </div>
      <Detail as="p" className={styles.conditionHint}>
        Se grenen skje: gi svaret betingelsen krever i forhåndsvisningen, så
        dukker spørsmålet opp der.
      </Detail>
    </div>
  );
}

function RemoveRowButton({
  index,
  rowId,
  onRemove,
}: {
  index: number;
  rowId: number;
  onRemove: () => void;
}) {
  const label = `Fjern betingelse ${index + 1}`;
  return (
    <Tooltip content={label}>
      <Button
        type="button"
        variant="tertiary-neutral"
        size="xsmall"
        className={styles.conditionRowRemove}
        icon={<XMarkIcon aria-hidden />}
        aria-label={label}
        data-condition-remove={rowId}
        onClick={onRemove}
      />
    </Tooltip>
  );
}

function MetadataConditionRow({
  leaf,
  rowId,
  index,
  groupLabel,
  onRemove,
}: {
  leaf: Extract<ConditionLeafV1, { field: "METADATA" }>;
  rowId: number;
  index: number;
  groupLabel: string | undefined;
  onRemove: (() => void) | undefined;
}) {
  return (
    <div
      className={styles.conditionRowWrap}
      {...(groupLabel ? { role: "group", "aria-label": groupLabel } : {})}
    >
      <BodyShort
        size="small"
        textColor="subtle"
        className={styles.conditionMetadataRow}
      >
        Metadatabetingelse satt i kode (<code>{leaf.key}</code>)
      </BodyShort>
      {onRemove ? (
        <RemoveRowButton index={index} rowId={rowId} onRemove={onRemove} />
      ) : null}
    </div>
  );
}

function AnswerConditionRow({
  leaf,
  rowId,
  index,
  groupLabel,
  referenceable,
  suggestionsFor,
  onLeafChange,
  onRemove,
}: {
  leaf: AnswerLeaf;
  rowId: number;
  index: number;
  groupLabel: string | undefined;
  referenceable: ReferenceableQuestion[];
  suggestionsFor: (referencedId: string) => ConditionValueSuggestion[];
  onLeafChange: (leaf: ConditionLeafV1) => void;
  onRemove: (() => void) | undefined;
}) {
  const referenced = referenceable.find(
    (candidate) => candidate.id === leaf.questionId,
  );
  const suggestions = leaf.questionId ? suggestionsFor(leaf.questionId) : [];
  const operators = referenced
    ? allowedConditionOperators(referenced.type)
    : ["EXISTS"];
  const needsValue = leaf.operator !== "EXISTS";

  // Stale states render EXPLICITLY as dead, disabled options with a warning
  // — a native select must never pretend the condition was repaired.
  const referenceMissing = leaf.questionId !== undefined && !referenced;
  const operatorStale = !referenceMissing && !operators.includes(leaf.operator);
  const valueStale =
    needsValue &&
    !referenceMissing &&
    suggestions.length > 0 &&
    !suggestions.some((candidate) => candidate.value === leaf.value);
  const valueTypeInvalid =
    needsValue &&
    !referenceMissing &&
    suggestions.length === 0 &&
    leaf.value !== undefined &&
    typeof leaf.value !== "string";
  // Blank text answers never reach runtime answer state, so a blank value
  // makes the condition misleading; the release gates reject it.
  const valueBlank =
    needsValue &&
    !referenceMissing &&
    suggestions.length === 0 &&
    typeof leaf.value === "string" &&
    leaf.value.trim().length === 0;
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
    const operator = allowed.includes(leaf.operator) ? leaf.operator : "EXISTS";
    if (operator === "EXISTS") {
      onLeafChange({ questionId: referencedId, operator: "EXISTS" });
    } else {
      onLeafChange({
        questionId: referencedId,
        operator: operator as ValuedOperator,
        value: firstValueFor(referencedId),
      });
    }
  };

  const changeOperator = (operator: string) => {
    if (operator === "EXISTS") {
      onLeafChange({ questionId: leaf.questionId, operator: "EXISTS" });
      return;
    }
    onLeafChange({
      questionId: leaf.questionId,
      operator: operator as ValuedOperator,
      value: leaf.value ?? firstValueFor(leaf.questionId ?? ""),
    });
  };

  const changeValue = (raw: string) => {
    const suggestion = suggestions.find(
      (candidate) => encodeValue(candidate.value) === raw,
    );
    onLeafChange({
      questionId: leaf.questionId,
      operator: leaf.operator as ValuedOperator,
      value: suggestion ? suggestion.value : raw,
    });
  };

  return (
    <div
      className={styles.conditionRowWrap}
      {...(groupLabel ? { role: "group", "aria-label": groupLabel } : {})}
    >
      <div className={styles.conditionRow}>
        <Select
          label="Spørsmål"
          size="small"
          value={leaf.questionId ?? ""}
          error={questionError}
          onChange={(event) => changeReferenced(event.target.value)}
        >
          {referenceMissing ? (
            <option value={leaf.questionId} disabled>
              Finnes ikke lenger ({leaf.questionId})
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
          value={leaf.operator}
          error={operatorError}
          onChange={(event) => changeOperator(event.target.value)}
        >
          {operatorStale ? (
            <option value={leaf.operator} disabled>
              {OPERATOR_LABELS[leaf.operator] ?? leaf.operator} (passer ikke
              lenger)
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
              value={encodeValue(leaf.value)}
              error={valueError}
              onChange={(event) => changeValue(event.target.value)}
            >
              {valueStale ? (
                <option value={encodeValue(leaf.value)} disabled>
                  «{String(leaf.value ?? "")}» (finnes ikke)
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
              value={String(leaf.value ?? "")}
              error={valueError}
              onChange={(event) => changeValue(event.target.value)}
            />
          )
        ) : null}
      </div>
      {onRemove ? (
        <RemoveRowButton index={index} rowId={rowId} onRemove={onRemove} />
      ) : null}
    </div>
  );
}
