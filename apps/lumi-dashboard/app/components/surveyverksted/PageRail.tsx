import {
  ArrowDownIcon,
  ArrowUpIcon,
  BranchingIcon,
  FilesIcon,
  MenuElipsisVerticalIcon,
  PlusIcon,
  TrashIcon,
} from "@navikt/aksel-icons";
import { ActionMenu, BodyShort, Button, Detail } from "@navikt/ds-react";
import type { SurveyPageV1 } from "@navikt/lumi-survey";
import { memo } from "react";
import type { MoveDirection } from "~/utils/surveyDocument";
import { questionTypeMeta } from "./questionTypeMeta";
import { SortableList, useSortableItem } from "./sortable";
import styles from "./verksted.module.css";

export interface PageRailProps {
  pages: readonly SurveyPageV1[];
  selectedPageId: string;
  protectedPageIds?: ReadonlySet<string>;
  onSelect: (pageId: string) => void;
  onAdd: () => void;
  onMove: (pageId: string, direction: MoveDirection) => void;
  onReorder: (pageId: string, toIndex: number) => void;
  onDuplicate: (pageId: string) => void;
  onDelete: (pageId: string) => void;
}

export const PageRail = memo(function PageRail({
  pages,
  selectedPageId,
  protectedPageIds = new Set(),
  onSelect,
  onAdd,
  onMove,
  onReorder,
  onDuplicate,
  onDelete,
}: PageRailProps) {
  return (
    <nav aria-label="Sider i surveyen" className={styles.rail}>
      <div className={styles.railHeader}>
        <Detail as="span" className={styles.eyebrow}>
          SIDER · {String(pages.length).padStart(2, "0")}
        </Detail>
        <Button
          type="button"
          variant="tertiary"
          size="xsmall"
          icon={<PlusIcon aria-hidden />}
          onClick={onAdd}
        >
          Ny side
        </Button>
      </div>
      <SortableList
        ids={pages.map((page) => page.id)}
        onReorder={onReorder}
        announceLabel="siden"
      >
        <ol className={styles.railList}>
          {pages.map((page, index) => (
            <RailItem
              key={page.id}
              page={page}
              index={index}
              totalPages={pages.length}
              selected={page.id === selectedPageId}
              protectedFromDeletion={protectedPageIds.has(page.id)}
              onSelect={onSelect}
              onMove={onMove}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          ))}
        </ol>
      </SortableList>
    </nav>
  );
});

const RailItem = memo(function RailItem({
  page,
  index,
  totalPages,
  selected,
  protectedFromDeletion,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
}: {
  page: SurveyPageV1;
  index: number;
  totalPages: number;
  selected: boolean;
  protectedFromDeletion: boolean;
  onSelect: (pageId: string) => void;
  onMove: (pageId: string, direction: MoveDirection) => void;
  onDuplicate: (pageId: string) => void;
  onDelete: (pageId: string) => void;
}) {
  const sortable = useSortableItem(page.id);
  const conditionalCount = page.questions.filter(
    (question) => question.visibleIf,
  ).length;

  return (
    <li
      ref={sortable.setNodeRef}
      className={`${styles.railItem} ${sortable.className}`}
      style={sortable.style}
      data-dragging={sortable.isDragging}
      {...sortable.listeners}
    >
      <button
        type="button"
        className={styles.railButton}
        data-selected={selected}
        aria-pressed={selected}
        onClick={() => onSelect(page.id)}
      >
        <span className={styles.railNumber}>
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className={styles.railBody}>
          <BodyShort as="span" size="small" weight="semibold">
            {page.title?.trim() ||
              page.questions[0]?.prompt.trim() ||
              `Side ${index + 1}`}
          </BodyShort>
          {conditionalCount > 0 ? (
            <span className={styles.srOnly}>
              {conditionalCount === 1
                ? "1 betinget spørsmål"
                : `${conditionalCount} betingede spørsmål`}
            </span>
          ) : null}
          <span className={styles.railIcons} aria-hidden>
            {page.questions.map((question) => {
              const meta = questionTypeMeta(question.type);
              return (
                <span key={question.id} className={styles.railIconPair}>
                  <meta.Icon aria-hidden />
                  {question.visibleIf ? <BranchingIcon aria-hidden /> : null}
                </span>
              );
            })}
          </span>
        </span>
      </button>
      <ActionMenu>
        <ActionMenu.Trigger>
          <Button
            type="button"
            variant="tertiary-neutral"
            size="xsmall"
            className={styles.railMenu}
            icon={<MenuElipsisVerticalIcon aria-hidden />}
            aria-label={`Handlinger for side ${index + 1}`}
            onPointerDown={(event) => event.stopPropagation()}
          />
        </ActionMenu.Trigger>
        <ActionMenu.Content align="start">
          <ActionMenu.Item
            disabled={index === 0}
            onSelect={() => onMove(page.id, "up")}
            icon={<ArrowUpIcon aria-hidden />}
          >
            Flytt opp
          </ActionMenu.Item>
          <ActionMenu.Item
            disabled={index === totalPages - 1}
            onSelect={() => onMove(page.id, "down")}
            icon={<ArrowDownIcon aria-hidden />}
          >
            Flytt ned
          </ActionMenu.Item>
          <ActionMenu.Item
            onSelect={() => onDuplicate(page.id)}
            icon={<FilesIcon aria-hidden />}
          >
            Dupliser
          </ActionMenu.Item>
          <ActionMenu.Divider />
          <ActionMenu.Item
            variant="danger"
            disabled={totalPages === 1 || protectedFromDeletion}
            onSelect={() => onDelete(page.id)}
            icon={<TrashIcon aria-hidden />}
          >
            {protectedFromDeletion
              ? "Kan ikke slettes – brukes i analysen"
              : "Slett side"}
          </ActionMenu.Item>
        </ActionMenu.Content>
      </ActionMenu>
    </li>
  );
});
