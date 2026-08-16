import { PlusIcon } from "@navikt/aksel-icons";
import { Detail, TextField, VStack } from "@navikt/ds-react";
import type { SurveyPageV1, SurveyQuestionV1 } from "@navikt/lumi-survey";
import { Fragment, memo, useCallback, useMemo } from "react";
import type { MoveDirection, QuestionTypeId } from "~/utils/surveyDocument";
import type { OptionsEditorProps } from "./OptionsEditor";
import { QuestionCard } from "./QuestionCard";
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
  expandedIds: ReadonlySet<string>;
  focusQuestionId: string | null;
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
  optionHandlersFor: (questionId: string) => OptionHandlers;
  onAddQuestion: (type: QuestionTypeId) => void;
}

export const QuestionCanvas = memo(function QuestionCanvas({
  page,
  pageNumber,
  totalPages,
  expandedIds,
  focusQuestionId,
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
  optionHandlersFor,
  onAddQuestion,
}: QuestionCanvasProps) {
  const pad = (value: number) => String(value).padStart(2, "0");

  return (
    <VStack gap="space-24">
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
        <VStack gap="space-2">
          <TextField
            label="Sidetittel"
            hideLabel
            placeholder="Gi siden en tittel"
            className={styles.ghostTitle}
            value={page.title ?? ""}
            onChange={(event) =>
              onUpdatePage((current) => ({
                ...current,
                title: event.target.value || undefined,
              }))
            }
          />
          <TextField
            label="Beskrivelse"
            hideLabel
            placeholder="Legg til en kort felles innledning (valgfritt)"
            className={styles.ghostDescription}
            value={page.description ?? ""}
            onChange={(event) =>
              onUpdatePage((current) => ({
                ...current,
                description: event.target.value || undefined,
              }))
            }
          />
        </VStack>
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
                expanded={expandedIds.has(question.id)}
                focusOnMount={focusQuestionId === question.id}
                canDelete={page.questions.length > 1}
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
  expanded,
  focusOnMount,
  canDelete,
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
}: {
  question: SurveyQuestionV1;
  index: number;
  expanded: boolean;
  focusOnMount: boolean;
  canDelete: boolean;
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

  return (
    <div
      ref={sortable.setNodeRef}
      className={sortable.className}
      style={sortable.style}
      data-dragging={sortable.isDragging}
      data-draggable={!expanded}
      {...sortable.listeners}
    >
      <QuestionCard
        question={question}
        index={index}
        expanded={expanded}
        focusOnMount={focusOnMount}
        canDelete={canDelete}
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
      />
    </div>
  );
});
