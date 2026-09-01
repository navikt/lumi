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
  ActionMenu,
  BodyShort,
  Button,
  Detail,
  HStack,
  Radio,
  RadioGroup,
  Switch,
  TextField,
  Tooltip,
  VStack,
} from "@navikt/ds-react";
import {
  SPECIALIZED_SURVEY_FIELD_IDS,
  type SurveyQuestionV1,
} from "@navikt/lumi-survey";
import { memo, useEffect, useRef } from "react";
import {
  type ConditionValueSuggestion,
  type FollowUpBranch,
  followUpBranches,
  isSurveyTemplatePlaceholderValue,
  type MoveDirection,
  type QuestionTypeId,
  type ReferenceableQuestion,
  type VisibleIfConditionV1,
  visibleIfLeaves,
} from "~/utils/surveyDocument";
import { ConditionEditor } from "./ConditionEditor";
import { LiveVisibilityChip } from "./LiveVisibilityChip";
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
  /** Re-triggers the focus for an already-mounted target (flow jumps) */
  focusNonce?: number;
  canDelete: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  contractLocked?: boolean;
  minOptions?: number;
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
  /** Plain-language reading of the question's own condition, if any */
  conditionSummary?: string;
  /** Renders the card indented under the question that drives it */
  followUp?: boolean;
  /** Page number the card lives on, for «på side N» in condition text */
  pageNumber?: number;
  /** Whether the condition holds with the preview's answers right now */
  liveVisible?: boolean;
  onAddFollowUp?: (branch: FollowUpBranch) => void;
}

export const QuestionCard = memo(function QuestionCard({
  question,
  index,
  expanded,
  focusOnMount = false,
  focusNonce = 0,
  canDelete,
  canMoveUp,
  canMoveDown,
  contractLocked = false,
  minOptions = 1,
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
  conditionSummary,
  followUp = false,
  pageNumber,
  liveVisible,
  onAddFollowUp,
}: QuestionCardProps) {
  const conditionCount = visibleIfLeaves(question.visibleIf).length;
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: focusOnMount marks the target; the user-initiated triggers are mounting (add question/page) and the nonce (flow jumps to a card already on screen)
  useEffect(() => {
    if (focusOnMount && expanded) promptRef.current?.focus();
  }, [focusNonce]);

  const meta = questionTypeMeta(question.type);

  if (!expanded) {
    return (
      <article
        className={styles.card}
        data-expanded="false"
        data-follow-up={followUp ? "true" : undefined}
      >
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
            {question.visibleIf ? (
              <Detail as="span" className={styles.cardBranchLine}>
                <BranchingIcon aria-hidden />
                <span className={styles.cardBranchText}>
                  {conditionSummary ??
                    (conditionCount > 1
                      ? `Vises betinget · ${conditionCount}`
                      : "Vises betinget")}
                </span>
              </Detail>
            ) : null}
          </span>
          <span className={styles.cardTriggerMeta}>
            {liveVisible !== undefined ? (
              <LiveVisibilityChip visible={liveVisible} />
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
      data-follow-up={followUp ? "true" : undefined}
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
        {contractLocked ? (
          <HStack
            as="span"
            gap="space-4"
            align="center"
            className={styles.cardTypeButton}
          >
            <meta.Icon aria-hidden />
            <BodyShort as="span" size="small">
              {meta.label}
            </BodyShort>
          </HStack>
        ) : (
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
        )}
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
        {contractLocked ? (
          <Detail>
            Dette spørsmålet må være med for at analysen skal virke. Du kan
            endre teksten, men ikke typen, kravet om svar eller når spørsmålet
            vises.
          </Detail>
        ) : null}
        <TextField
          ref={promptRef}
          label="Spørsmålstekst"
          value={question.prompt}
          placeholder="Skriv spørsmålet slik respondenten skal se det"
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
            lockValues={
              (contractLocked &&
                question.id === SPECIALIZED_SURVEY_FIELD_IDS.success) ||
              question.options.some((option) =>
                isSurveyTemplatePlaceholderValue(option.value),
              )
            }
            lockStructure={
              contractLocked &&
              question.id === SPECIALIZED_SURVEY_FIELD_IDS.success
            }
            minOptions={minOptions}
          />
        ) : null}

        {question.type === "singleChoice" || question.type === "multiChoice" ? (
          <ChoiceSettings
            question={question}
            contractLocked={contractLocked}
            onChange={onChange}
          />
        ) : null}

        {!contractLocked &&
        referenceable &&
        suggestionsFor &&
        onChangeVisibleIf ? (
          <ConditionEditor
            condition={question.visibleIf}
            referenceable={referenceable}
            suggestionsFor={suggestionsFor}
            onChange={onChangeVisibleIf}
            ownPageNumber={pageNumber}
            liveVisible={liveVisible}
          />
        ) : null}

        {onAddFollowUp ? (
          <div>
            <ActionMenu>
              <ActionMenu.Trigger>
                <Button
                  type="button"
                  variant="tertiary"
                  size="small"
                  icon={<BranchingIcon aria-hidden />}
                >
                  Legg til oppfølging
                </Button>
              </ActionMenu.Trigger>
              <ActionMenu.Content align="start">
                <ActionMenu.Group label="Nytt spørsmål som bare vises …">
                  {followUpBranches(question).map((branch) => (
                    <ActionMenu.Item
                      key={branch.key}
                      onSelect={() => onAddFollowUp(branch)}
                    >
                      {branch.label}
                    </ActionMenu.Item>
                  ))}
                </ActionMenu.Group>
              </ActionMenu.Content>
            </ActionMenu>
          </div>
        ) : null}
      </VStack>

      <div className={styles.cardFooter}>
        <Switch
          size="small"
          checked={question.required ?? false}
          disabled={contractLocked}
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
          <Tooltip
            content={
              contractLocked
                ? "Spørsmålet brukes i analysen og kan ikke slettes"
                : "Slett spørsmålet"
            }
          >
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
      <RadioGroup
        legend="Skala"
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
          <Radio key={candidate.id} value={candidate.id}>
            <HStack as="span" gap="space-4" align="center">
              <candidate.Icon aria-hidden />
              {candidate.label}
            </HStack>
          </Radio>
        ))}
      </RadioGroup>
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

function ChoiceSettings({
  question,
  contractLocked,
  onChange,
}: {
  question:
    | Extract<SurveyQuestionV1, { type: "singleChoice" }>
    | Extract<SurveyQuestionV1, { type: "multiChoice" }>;
  contractLocked: boolean;
  onChange: QuestionCardProps["onChange"];
}) {
  const orderLocked =
    contractLocked && question.id === SPECIALIZED_SURVEY_FIELD_IDS.success;

  return (
    <VStack gap="space-16">
      {!orderLocked ? (
        <Switch
          size="small"
          checked={question.randomize ?? false}
          description="Reduserer sjansen for at alternativene øverst får flere svar."
          onChange={(event) => {
            const randomize = event.target.checked;
            onChange((current) => {
              if (
                current.type !== "singleChoice" &&
                current.type !== "multiChoice"
              ) {
                return current;
              }
              if (randomize) return { ...current, randomize: true };
              const { randomize: _randomize, ...withoutRandomize } = current;
              return withoutRandomize;
            });
          }}
        >
          Bland rekkefølgen
        </Switch>
      ) : null}

      {question.type === "multiChoice" ? (
        <>
          <RadioGroup
            legend="Slik vises svaralternativene"
            description="Avkryssing passer best med opptil 6 alternativer. Velg søkbart felt når listen er lengre."
            size="small"
            value={question.variant ?? "checkbox"}
            onChange={(next) =>
              onChange((current) => {
                if (current.type !== "multiChoice") return current;
                if (next === "combobox") {
                  return { ...current, variant: "combobox" };
                }
                const { variant: _variant, ...withoutVariant } = current;
                return withoutVariant;
              })
            }
          >
            <Radio value="checkbox">Avkryssing</Radio>
            <Radio value="combobox">Søkbart felt</Radio>
          </RadioGroup>

          <TextField
            type="number"
            label="Maks antall alternativer brukeren kan velge"
            description={
              contractLocked
                ? `Velg et tall mellom 1 og ${question.options.length}.`
                : `Velg et tall mellom 1 og ${question.options.length}, eller la feltet stå tomt uten en grense.`
            }
            min={1}
            max={question.options.length}
            value={
              question.maxSelections === undefined
                ? ""
                : String(question.maxSelections)
            }
            error={
              question.maxSelections === undefined && contractLocked
                ? "Velg hvor mange oppgaver brukeren kan krysse av."
                : question.maxSelections !== undefined &&
                    question.maxSelections > question.options.length
                  ? `Tallet kan ikke være høyere enn ${question.options.length}.`
                  : undefined
            }
            onChange={(event) => {
              const value = Number(event.target.value);
              onChange((current) =>
                current.type === "multiChoice"
                  ? {
                      ...current,
                      maxSelections:
                        Number.isInteger(value) && value > 0
                          ? value
                          : undefined,
                    }
                  : current,
              );
            }}
          />
        </>
      ) : null}
    </VStack>
  );
}
