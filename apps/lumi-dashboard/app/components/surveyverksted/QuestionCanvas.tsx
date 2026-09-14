import { BranchingIcon, PlusIcon } from "@navikt/aksel-icons";
import { Detail, VStack } from "@navikt/ds-react";
import type {
  SurveyDocumentV1,
  SurveyPageV1,
  SurveyQuestionV1,
} from "@navikt/lumi-survey";
import { SPECIALIZED_SURVEY_FIELD_IDS } from "@navikt/lumi-survey";
import {
  type CSSProperties,
  Fragment,
  memo,
  useCallback,
  useMemo,
  useRef,
} from "react";
import type {
  ConditionValueSuggestion,
  FollowUpBranch,
  MoveDirection,
  QuestionTypeId,
  ReferenceableQuestion,
  VisibleIfConditionV1,
} from "~/utils/surveyDocument";
import {
  isRequiredSpecializedQuestion,
  isSpecializedQuestionContractValid,
} from "~/utils/surveyDocument";
import type { OptionsEditorProps } from "./OptionsEditor";
import { PageGroupHeader } from "./PageGroupHeader";
import { QuestionCard } from "./QuestionCard";
import {
  buildQuestionTree,
  drawnGuides,
  type QuestionTreeNode,
  reuseStableNodes,
} from "./questionTree";
import { type ScreenUndo, SurveyScreenCard } from "./SurveyScreenCard";
import { SortableList, useSortableItem } from "./sortable";
import { TypeGallery } from "./TypeGallery";
import { UndoNotice } from "./UndoNotice";
import styles from "./verksted.module.css";

export interface CanvasUndo {
  label: string;
  /** Question index the notice replaces, or null for a page-level notice */
  index: number | null;
}

type OptionHandlers = Omit<OptionsEditorProps, "questionId" | "options">;

export interface QuestionCanvasProps {
  page: SurveyPageV1;
  pageNumber: number;
  totalPages: number;
  surveyType: SurveyDocumentV1["type"];
  expandedIds: ReadonlySet<string>;
  focusQuestionId: string | null;
  /** Bumped to refocus an already-mounted target card (flow jumps) */
  focusNonce: number;
  undo: CanvasUndo | null;
  onUndo: () => void;
  onUndoExpire: () => void;
  onExpand: (questionId: string) => void;
  onCollapse: (questionId: string) => void;
  onUpdatePage: (updater: (page: SurveyPageV1) => SurveyPageV1) => void;
  onQuestionChange: (
    questionId: string,
    updater: (question: SurveyQuestionV1) => SurveyQuestionV1,
  ) => void;
  onChangeType: (questionId: string, type: QuestionTypeId) => void;
  onDuplicate: (questionId: string) => void;
  onDelete: (questionId: string) => void;
  onMoveQuestion: (questionId: string, direction: MoveDirection) => void;
  onReorderQuestion: (questionId: string, toIndex: number) => void;
  intro: SurveyDocumentV1["intro"];
  success: SurveyDocumentV1["success"];
  introUndo: ScreenUndo | null;
  successUndo: ScreenUndo | null;
  onChangeIntro: (intro: SurveyDocumentV1["intro"]) => void;
  onChangeSuccess: (success: SurveyDocumentV1["success"]) => void;
  optionHandlersFor: (questionId: string) => OptionHandlers;
  referenceableByQuestion: ReadonlyMap<string, ReferenceableQuestion[]>;
  suggestionsFor: (referencedId: string) => ConditionValueSuggestion[];
  onChangeVisibleIf: (
    questionId: string,
    condition: VisibleIfConditionV1 | undefined,
  ) => void;
  onAddQuestion: (type: QuestionTypeId) => void;
  conditionSummaries: ReadonlyMap<string, string>;
  onAddFollowUp: (questionId: string, branch: FollowUpBranch) => void;
  /** Per conditional question: visible with the preview's answers right now */
  liveVisibility: ReadonlyMap<string, boolean>;
}

export const QuestionCanvas = memo(function QuestionCanvas({
  page,
  pageNumber,
  totalPages,
  surveyType,
  expandedIds,
  focusQuestionId,
  focusNonce,
  undo,
  onUndo,
  onUndoExpire,
  onExpand,
  onCollapse,
  onUpdatePage,
  onQuestionChange,
  onChangeType,
  onDuplicate,
  onDelete,
  onMoveQuestion,
  onReorderQuestion,
  intro,
  success,
  introUndo,
  successUndo,
  onChangeIntro,
  onChangeSuccess,
  optionHandlersFor,
  referenceableByQuestion,
  suggestionsFor,
  onChangeVisibleIf,
  onAddQuestion,
  conditionSummaries,
  onAddFollowUp,
  liveVisibility,
}: QuestionCanvasProps) {
  const pad = (value: number) => String(value).padStart(2, "0");

  // Dependency tree: dependants nest under the same-page question that
  // drives them, with trunk lines reaching the actual driver.
  // Nodes keep their identity across keystrokes that don't change the tree,
  // so the per-question memo boundary below still holds.
  const nodeCacheRef = useRef<ReadonlyMap<string, QuestionTreeNode>>(new Map());
  const tree = useMemo(() => {
    const nodes = reuseStableNodes(
      nodeCacheRef.current,
      buildQuestionTree(page),
    );
    nodeCacheRef.current = new Map(nodes.map((node) => [node.id, node]));
    return nodes;
  }, [page]);

  const pageFullyConditional =
    page.questions.length > 0 &&
    page.questions.every((question) => question.visibleIf !== undefined);

  return (
    <VStack gap="space-24">
      {pageNumber === 1 ? (
        <SurveyScreenCard
          regionLabel="Velkomstside"
          eyebrow="VELKOMSTSIDE"
          description="Vises før det første spørsmålet. Uten en velkomstside starter surveyen rett på spørsmålene."
          addLabel="Legg til velkomstside"
          removeLabel="Fjern velkomstsiden"
          startLabelField={{
            label: "Tekst på startknappen (valgfri)",
            placeholder: "Start",
          }}
          value={intro}
          undo={introUndo}
          onChange={onChangeIntro}
        />
      ) : null}
      <div>
        <Detail as="p" className={styles.eyebrow}>
          SIDE {pad(pageNumber)} AV {pad(totalPages)}
        </Detail>
        {undo && undo.index === null ? (
          <UndoNotice
            label={undo.label}
            onUndo={onUndo}
            onExpire={onUndoExpire}
          />
        ) : null}
        <PageGroupHeader
          key={page.id}
          title={page.title}
          description={page.description}
          onChangeTitle={(title) =>
            onUpdatePage((current) => ({ ...current, title }))
          }
          onChangeDescription={(description) =>
            onUpdatePage((current) => ({ ...current, description }))
          }
        />
        {pageFullyConditional ? (
          <Detail as="p" className={styles.pageConditional}>
            <BranchingIcon aria-hidden />
            Hele siden er betinget — i surveyen hoppes den over når ingen av
            spørsmålene skal vises.
          </Detail>
        ) : null}
      </div>

      <SortableList
        ids={page.questions.map((question) => question.id)}
        onReorder={onReorderQuestion}
        announceLabel="spørsmålet"
      >
        <VStack gap="space-12">
          {page.questions.map((question, index) => (
            <Fragment key={question.id}>
              {undo && undo.index === index ? (
                <UndoNotice
                  label={undo.label}
                  onUndo={onUndo}
                  onExpire={onUndoExpire}
                />
              ) : null}
              <CanvasQuestion
                question={question}
                index={index}
                pageNumber={pageNumber}
                node={tree[index]}
                conditionSummary={conditionSummaries.get(question.id)}
                liveVisible={
                  question.visibleIf
                    ? liveVisibility.get(question.id)
                    : undefined
                }
                onAddFollowUp={onAddFollowUp}
                expanded={expandedIds.has(question.id)}
                focusOnMount={focusQuestionId === question.id}
                focusNonce={focusNonce}
                canDelete={
                  page.questions.length > 1 &&
                  !isRequiredSpecializedQuestion(surveyType, question.id)
                }
                contractLocked={isSpecializedQuestionContractValid(
                  surveyType,
                  question,
                )}
                minOptions={
                  surveyType === "taskPriority" &&
                  question.id === SPECIALIZED_SURVEY_FIELD_IDS.priority
                    ? 2
                    : 1
                }
                canMoveUp={index > 0}
                canMoveDown={index < page.questions.length - 1}
                onExpand={onExpand}
                onCollapse={onCollapse}
                onQuestionChange={onQuestionChange}
                onChangeType={onChangeType}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                onMoveQuestion={onMoveQuestion}
                optionHandlersFor={optionHandlersFor}
                referenceable={
                  expandedIds.has(question.id)
                    ? referenceableByQuestion.get(question.id)
                    : undefined
                }
                suggestionsFor={suggestionsFor}
                onChangeVisibleIf={onChangeVisibleIf}
              />
            </Fragment>
          ))}
          {undo && undo.index === page.questions.length ? (
            <UndoNotice
              label={undo.label}
              onUndo={onUndo}
              onExpire={onUndoExpire}
            />
          ) : null}
          <TypeGallery
            label="Legg til spørsmål"
            onSelect={onAddQuestion}
            trigger={
              <button type="button" className={styles.addQuestion}>
                <PlusIcon aria-hidden fontSize="1.25rem" />
                Legg til spørsmål
              </button>
            }
          />
        </VStack>
      </SortableList>
      {pageNumber === totalPages ? (
        <SurveyScreenCard
          regionLabel="Bekreftelse etter innsending"
          eyebrow="ETTER INNSENDING"
          description="Vises etter at brukeren har sendt inn svarene. Uten tilpasning brukes standardteksten."
          addLabel="Tilpass bekreftelsen"
          removeLabel="Bruk standardbekreftelsen"
          value={success}
          undo={successUndo}
          onChange={onChangeSuccess}
        />
      ) : null}
    </VStack>
  );
});

/**
 * The memo boundary per question: binds the card's closures to the stable
 * id-based handlers locally, so a keystroke in one card leaves every other
 * card's props untouched and their memo intact.
 */
const CanvasQuestion = memo(function CanvasQuestion({
  question,
  index,
  pageNumber,
  node,
  conditionSummary,
  liveVisible,
  onAddFollowUp,
  expanded,
  focusOnMount,
  focusNonce,
  canDelete,
  contractLocked,
  minOptions,
  canMoveUp,
  canMoveDown,
  onExpand,
  onCollapse,
  onQuestionChange,
  onChangeType,
  onDuplicate,
  onDelete,
  onMoveQuestion,
  optionHandlersFor,
  referenceable,
  suggestionsFor,
  onChangeVisibleIf,
}: {
  question: SurveyQuestionV1;
  index: number;
  pageNumber: number;
  node: QuestionTreeNode;
  conditionSummary: string | undefined;
  liveVisible: boolean | undefined;
  onAddFollowUp: QuestionCanvasProps["onAddFollowUp"];
  expanded: boolean;
  focusOnMount: boolean;
  focusNonce: number;
  canDelete: boolean;
  contractLocked: boolean;
  minOptions: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onExpand: (questionId: string) => void;
  onCollapse: (questionId: string) => void;
  onQuestionChange: QuestionCanvasProps["onQuestionChange"];
  onChangeType: (questionId: string, type: QuestionTypeId) => void;
  onDuplicate: (questionId: string) => void;
  onDelete: (questionId: string) => void;
  onMoveQuestion: (questionId: string, direction: MoveDirection) => void;
  optionHandlersFor: (questionId: string) => OptionHandlers;
  referenceable: ReferenceableQuestion[] | undefined;
  suggestionsFor: (referencedId: string) => ConditionValueSuggestion[];
  onChangeVisibleIf: QuestionCanvasProps["onChangeVisibleIf"];
}) {
  const questionId = question.id;
  const sortable = useSortableItem(questionId, expanded);

  const optionHandlers = useMemo(
    () =>
      question.type === "singleChoice" || question.type === "multiChoice"
        ? optionHandlersFor(questionId)
        : undefined,
    [question.type, optionHandlersFor, questionId],
  );

  const handleExpand = useCallback(
    () => onExpand(questionId),
    [onExpand, questionId],
  );
  const handleCollapse = useCallback(
    () => onCollapse(questionId),
    [onCollapse, questionId],
  );
  const handleChange = useCallback(
    (updater: (question: SurveyQuestionV1) => SurveyQuestionV1) =>
      onQuestionChange(questionId, updater),
    [onQuestionChange, questionId],
  );
  const handleChangeType = useCallback(
    (type: QuestionTypeId) => onChangeType(questionId, type),
    [onChangeType, questionId],
  );
  const handleDuplicate = useCallback(
    () => onDuplicate(questionId),
    [onDuplicate, questionId],
  );
  const handleDelete = useCallback(
    () => onDelete(questionId),
    [onDelete, questionId],
  );
  const handleMove = useCallback(
    (direction: MoveDirection) => onMoveQuestion(questionId, direction),
    [onMoveQuestion, questionId],
  );
  const handleVisibleIf = useCallback(
    (condition: VisibleIfConditionV1 | undefined) =>
      onChangeVisibleIf(questionId, condition),
    [onChangeVisibleIf, questionId],
  );
  const handleAddFollowUp = useCallback(
    (branch: FollowUpBranch) => onAddFollowUp(questionId, branch),
    [onAddFollowUp, questionId],
  );

  return (
    <div
      ref={sortable.setNodeRef}
      className={sortable.className}
      style={
        {
          ...sortable.style,
          "--tree-depth": node.depth,
        } as CSSProperties
      }
      data-dragging={sortable.isDragging}
      data-draggable={!expanded}
      data-depth={node.depth}
      data-external={node.externalDependency || undefined}
      {...sortable.listeners}
    >
      {node.depth > 0 ? (
        <span className={styles.treeGuides} aria-hidden>
          {drawnGuides(node).map((guide, level) => {
            const kind = guide.isParent
              ? guide.continues
                ? "elbow-continue"
                : "elbow"
              : guide.continues
                ? "line"
                : "none";
            return (
              <span
                key={guide.ancestorId}
                className={styles.treeGuide}
                data-kind={kind}
                style={{ "--tree-level": level } as CSSProperties}
              />
            );
          })}
        </span>
      ) : node.externalDependency ? (
        <span className={styles.treeExternal} aria-hidden />
      ) : null}
      <QuestionCard
        question={question}
        index={index}
        pageNumber={pageNumber}
        conditionSummary={conditionSummary}
        liveVisible={liveVisible}
        onAddFollowUp={expanded ? handleAddFollowUp : undefined}
        expanded={expanded}
        focusOnMount={focusOnMount}
        focusNonce={focusNonce}
        canDelete={canDelete}
        contractLocked={contractLocked}
        minOptions={minOptions}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onExpand={handleExpand}
        onCollapse={handleCollapse}
        onChange={handleChange}
        onChangeType={handleChangeType}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onMove={handleMove}
        optionHandlers={optionHandlers}
        referenceable={referenceable}
        suggestionsFor={expanded ? suggestionsFor : undefined}
        onChangeVisibleIf={expanded ? handleVisibleIf : undefined}
      />
    </div>
  );
});
