import {
  ArrowDownIcon,
  ArrowUpIcon,
  BranchingIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FilesIcon,
  TrashIcon,
} from "@navikt/aksel-icons";
import {
  BodyShort,
  Button,
  Detail,
  HStack,
  Switch,
  TextField,
  ToggleGroup,
  Tooltip,
  VStack,
} from "@navikt/ds-react";
import type { SurveyQuestionV1 } from "@navikt/lumi-survey";
import { memo, useEffect, useRef } from "react";
import type {
  ConditionValueSuggestion,
  MoveDirection,
  QuestionTypeId,
  ReferenceableQuestion,
  VisibleIfConditionV1,
} from "~/utils/surveyDocument";
import { ConditionEditor } from "./ConditionEditor";
import { OptionsEditor, type OptionsEditorProps } from "./OptionsEditor";
import { QuestionMiniPreview } from "./QuestionMiniPreview";
import {
  describeQuestion,
  questionTypeMeta,
  RATING_VARIANTS,
} from "./questionTypeMeta";
import { TypeGallery } from "./TypeGallery";
import styles from "./verksted.module.css";

export interface QuestionCardProps {
  question: SurveyQuestionV1;
  index: number;
  expanded: boolean;
  /** Focus the prompt right away, for cards born from "Legg til spørsmål" */
  focusOnMount?: boolean;
  canDelete: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onChange: (updater: (question: SurveyQuestionV1) => SurveyQuestionV1) => void;
  onChangeType: (type: QuestionTypeId) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (direction: MoveDirection) => void;
  optionHandlers?: Omit<OptionsEditorProps, "questionId" | "options">;
  referenceable?: ReferenceableQuestion[];
  suggestionsFor?: (referencedId: string) => ConditionValueSuggestion[];
  onChangeVisibleIf?: (condition: VisibleIfConditionV1 | undefined) => void;
}

export const QuestionCard = memo(function QuestionCard({
  question,
  index,
  expanded,
  focusOnMount = false,
  canDelete,
  canMoveUp,
  canMoveDown,
  onExpand,
  onCollapse,
  onChange,
  onChangeType,
  onDuplicate,
  onDelete,
  onMove,
  optionHandlers,
  referenceable,
  suggestionsFor,
  onChangeVisibleIf,
}: QuestionCardProps) {
  const collapsedButtonRef = useRef<HTMLButtonElement>(null);
  const promptRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef(false);
  const previousExpanded = useRef(expanded);

  useEffect(() => {
    if (expanded && !previousExpanded.current) {
      promptRef.current?.focus();
    }
    if (!expanded && previousExpanded.current && restoreFocusRef.current) {
      collapsedButtonRef.current?.focus();
      restoreFocusRef.current = false;
    }
    previousExpanded.current = expanded;
  }, [expanded]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only by design — focusOnMount marks a freshly added question
  useEffect(() => {
    if (focusOnMount && expanded) promptRef.current?.focus();
  }, []);

  const meta = questionTypeMeta(question.type);

  if (!expanded) {
    return (
      <article className={styles.card} data-expanded="false">
        <button
          ref={collapsedButtonRef}
          type="button"
          className={styles.cardTrigger}
          aria-expanded="false"
          onClick={onExpand}
        >
          <span className={styles.cardNumber}>{index + 1}</span>
          <span className={styles.cardTriggerBody}>
            <Detail as="span" className={styles.cardType}>
              <meta.Icon aria-hidden />
              {describeQuestion(question)}
            </Detail>
            <BodyShort
              as="span"
              weight="semibold"
              className={styles.cardPrompt}
            >
              {question.prompt.trim() || "Spørsmål uten tekst"}
            </BodyShort>
          </span>
          <span className={styles.cardTriggerMeta}>
            {question.visibleIf ? (
              <Detail as="span" className={styles.cardConditional}>
                <BranchingIcon aria-hidden />
                Vises betinget
              </Detail>
            ) : null}
            {question.required ? (
              <Detail as="span" className={styles.cardRequired}>
                Må besvares
              </Detail>
            ) : null}
          </span>
        </button>
        <QuestionMiniPreview question={question} />
      </article>
    );
  }

  return (
    <article
      className={styles.card}
      data-expanded="true"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          restoreFocusRef.current = true;
          onCollapse();
        }
      }}
    >
      <div className={styles.cardHeader}>
        <span className={styles.cardNumber}>{index + 1}</span>
        <TypeGallery
          label="Bytt spørsmålstype"
          currentType={question.type}
          onSelect={onChangeType}
          trigger={
            <Button
              type="button"
              variant="tertiary-neutral"
              size="small"
              icon={<meta.Icon aria-hidden />}
              iconPosition="left"
              className={styles.cardTypeButton}
            >
              {meta.label}
              <ChevronDownIcon aria-hidden className={styles.cardTypeCaret} />
            </Button>
          }
        />
        <Tooltip content="Lukk redigering">
          <Button
            type="button"
            variant="tertiary-neutral"
            size="small"
            aria-expanded="true"
            aria-label="Lukk redigering"
            icon={<ChevronUpIcon aria-hidden />}
            onClick={() => {
              restoreFocusRef.current = true;
              onCollapse();
            }}
          />
        </Tooltip>
      </div>

      <VStack gap="space-16" className={styles.cardFields}>
        <TextField
          ref={promptRef}
          label="Spørsmålstekst"
          value={question.prompt}
          onChange={(event) =>
            onChange((current) => ({ ...current, prompt: event.target.value }))
          }
        />
        <TextField
          label="Hjelpetekst"
          description="Valgfri støttetekst under spørsmålet"
          value={question.description ?? ""}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              description: event.target.value || undefined,
            }))
          }
        />

        {question.type === "rating" ? (
          <RatingSettings question={question} onChange={onChange} />
        ) : null}

        {question.type === "text" ? (
          <TextSettings question={question} onChange={onChange} />
        ) : null}

        {(question.type === "singleChoice" ||
          question.type === "multiChoice") &&
        optionHandlers ? (
          <OptionsEditor
            questionId={question.id}
            options={question.options}
            {...optionHandlers}
          />
        ) : null}

        {referenceable && suggestionsFor && onChangeVisibleIf ? (
          <ConditionEditor
            condition={question.visibleIf}
            referenceable={referenceable}
            suggestionsFor={suggestionsFor}
            onChange={onChangeVisibleIf}
          />
        ) : null}
      </VStack>

      <div className={styles.cardFooter}>
        <Switch
          size="small"
          checked={question.required ?? false}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              required: event.target.checked,
            }))
          }
        >
          Må besvares
        </Switch>
        <HStack gap="space-4" align="center">
          <Tooltip content="Flytt opp">
            <Button
              type="button"
              variant="tertiary-neutral"
              size="small"
              icon={<ArrowUpIcon aria-hidden />}
              aria-label="Flytt spørsmålet opp"
              disabled={!canMoveUp}
              onClick={() => onMove("up")}
            />
          </Tooltip>
          <Tooltip content="Flytt ned">
            <Button
              type="button"
              variant="tertiary-neutral"
              size="small"
              icon={<ArrowDownIcon aria-hidden />}
              aria-label="Flytt spørsmålet ned"
              disabled={!canMoveDown}
              onClick={() => onMove("down")}
            />
          </Tooltip>
          <Tooltip content="Dupliser spørsmålet">
            <Button
              type="button"
              variant="tertiary-neutral"
              size="small"
              icon={<FilesIcon aria-hidden />}
              aria-label="Dupliser spørsmålet"
              onClick={onDuplicate}
            />
          </Tooltip>
          <Tooltip content="Slett spørsmålet">
            <Button
              type="button"
              variant="tertiary-neutral"
              size="small"
              data-color="danger"
              icon={<TrashIcon aria-hidden />}
              aria-label="Slett spørsmålet"
              disabled={!canDelete}
              onClick={onDelete}
            />
          </Tooltip>
        </HStack>
      </div>
    </article>
  );
});

function RatingSettings({
  question,
  onChange,
}: {
  question: Extract<SurveyQuestionV1, { type: "rating" }>;
  onChange: QuestionCardProps["onChange"];
}) {
  const variant = question.variant ?? "emoji";
  return (
    <VStack gap="space-16">
      <ToggleGroup
        label="Skala"
        size="small"
        value={variant}
        onChange={(next) =>
          onChange((current) =>
            current.type === "rating"
              ? { ...current, variant: next as typeof variant }
              : current,
          )
        }
      >
        {RATING_VARIANTS.map((candidate) => (
          <ToggleGroup.Item
            key={candidate.id}
            value={candidate.id}
            icon={<candidate.Icon aria-hidden />}
            label={candidate.label}
          />
        ))}
      </ToggleGroup>
      {question.variant === "nps" ? (
        <HStack gap="space-16" wrap>
          <TextField
            label="Etikett for lav ende"
            size="small"
            value={question.lowLabel ?? ""}
            placeholder="Lite sannsynlig"
            onChange={(event) =>
              onChange((current) =>
                current.type === "rating" && current.variant === "nps"
                  ? { ...current, lowLabel: event.target.value || undefined }
                  : current,
              )
            }
          />
          <TextField
            label="Etikett for høy ende"
            size="small"
            value={question.highLabel ?? ""}
            placeholder="Svært sannsynlig"
            onChange={(event) =>
              onChange((current) =>
                current.type === "rating" && current.variant === "nps"
                  ? { ...current, highLabel: event.target.value || undefined }
                  : current,
              )
            }
          />
        </HStack>
      ) : null}
    </VStack>
  );
}

function TextSettings({
  question,
  onChange,
}: {
  question: Extract<SurveyQuestionV1, { type: "text" }>;
  onChange: QuestionCardProps["onChange"];
}) {
  return (
    <HStack gap="space-16" wrap>
      <TextField
        label="Ledetekst i feltet"
        size="small"
        value={question.placeholder ?? ""}
        onChange={(event) =>
          onChange((current) =>
            current.type === "text"
              ? { ...current, placeholder: event.target.value || undefined }
              : current,
          )
        }
      />
      <TextField
        label="Maks antall tegn"
        size="small"
        inputMode="numeric"
        value={String(question.maxLength ?? 1000)}
        onChange={(event) => {
          const parsed = Number.parseInt(event.target.value, 10);
          onChange((current) =>
            current.type === "text"
              ? {
                  ...current,
                  maxLength:
                    Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
                }
              : current,
          );
        }}
      />
    </HStack>
  );
}
