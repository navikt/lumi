import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties, ReactNode } from "react";
import styles from "./verksted.module.css";

/**
 * Pointer-only drag reordering. Keyboard and screen reader users reorder
 * with the explicit move buttons (the WCAG 2.5.7 single-pointer
 * alternative), so sortable items deliberately carry no ARIA of their own.
 */
export function SortableList({
  ids,
  onReorder,
  announceLabel,
  children,
}: {
  ids: string[];
  onReorder: (id: string, toIndex: number) => void;
  announceLabel: string;
  children: ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{
        announcements: {
          onDragStart: () => `Flytter ${announceLabel}.`,
          onDragOver: () => undefined,
          onDragEnd: ({ active, over }) =>
            over && active.id !== over.id
              ? `${announceLabel} flyttet til plass ${ids.indexOf(String(over.id)) + 1}.`
              : `${announceLabel} ble ikke flyttet.`,
          onDragCancel: () => `Flytting avbrutt.`,
        },
        screenReaderInstructions: {
          draggable: `Bruk flytt opp- og flytt ned-knappene for å endre rekkefølgen.`,
        },
      }}
      onDragEnd={({ active, over }) => {
        if (!over || active.id === over.id) return;
        const toIndex = ids.indexOf(String(over.id));
        if (toIndex !== -1) onReorder(String(active.id), toIndex);
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

export function useSortableItem(id: string, disabled = false) {
  const { setNodeRef, listeners, transform, transition, isDragging } =
    useSortable({ id, disabled });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: transition ?? undefined,
  };

  return {
    setNodeRef,
    listeners: disabled ? undefined : listeners,
    style,
    isDragging,
    className: styles.sortable,
  };
}
