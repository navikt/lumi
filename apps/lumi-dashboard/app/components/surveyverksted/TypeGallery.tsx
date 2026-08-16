import { ActionMenu, BodyShort } from "@navikt/ds-react";
import type { ReactElement } from "react";
import type { QuestionTypeId } from "~/utils/surveyDocument";
import { QUESTION_TYPES } from "./questionTypeMeta";
import styles from "./verksted.module.css";

/**
 * The question type gallery, reused for both "add question" and "change type".
 * Trigger must be a focusable element (ActionMenu.Trigger uses asChild).
 */
export function TypeGallery({
  trigger,
  onSelect,
  currentType,
  label,
}: {
  trigger: ReactElement;
  onSelect: (type: QuestionTypeId) => void;
  currentType?: QuestionTypeId;
  label: string;
}) {
  return (
    <ActionMenu>
      <ActionMenu.Trigger>{trigger}</ActionMenu.Trigger>
      <ActionMenu.Content align="start" className={styles.typeGallery}>
        <ActionMenu.Group label={label}>
          {QUESTION_TYPES.map((type) => (
            <ActionMenu.Item
              key={type.id}
              disabled={type.id === currentType}
              onSelect={() => onSelect(type.id)}
              className={styles.typeGalleryItem}
              icon={<type.Icon aria-hidden fontSize="1.5rem" />}
            >
              <div>
                <BodyShort as="span" size="small" weight="semibold">
                  {type.label}
                </BodyShort>
                <BodyShort as="span" size="small" textColor="subtle">
                  {type.description}
                </BodyShort>
              </div>
            </ActionMenu.Item>
          ))}
        </ActionMenu.Group>
      </ActionMenu.Content>
    </ActionMenu>
  );
}
