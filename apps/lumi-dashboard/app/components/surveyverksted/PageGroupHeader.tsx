import { PlusIcon } from "@navikt/aksel-icons";
import { BodyShort, Button, TextField, VStack } from "@navikt/ds-react";
import { useEffect, useRef, useState } from "react";
import styles from "./verksted.module.css";

export interface PageGroupHeaderProps {
  title: string | undefined;
  description: string | undefined;
  onChangeTitle: (value: string | undefined) => void;
  onChangeDescription: (value: string | undefined) => void;
}

/**
 * Optional group heading for a page's questions.
 *
 * A heading earns its place when it gives the questions shared context or
 * gathers them under one theme. On a page with a single question it just
 * paraphrases the question, and the widget then shows two competing lines
 * of near-identical text. So the fields stay behind an add button rather
 * than greeting every author with an empty title box.
 *
 * Mount it with `key={page.id}` so switching pages resets the reveal.
 */
export function PageGroupHeader({
  title,
  description,
  onChangeTitle,
  onChangeDescription,
}: PageGroupHeaderProps) {
  const hasContent = Boolean(title || description);
  const [revealed, setRevealed] = useState(hasContent);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const wasRevealedRef = useRef(revealed);

  // Revealing focuses the title field so keyboard users land in the content
  // they just asked for. Mounting on a page that already has one must not
  // steal focus.
  useEffect(() => {
    if (revealed && !wasRevealedRef.current) {
      titleRef.current?.focus();
    }
    wasRevealedRef.current = revealed;
  }, [revealed]);

  if (!revealed && !hasContent) {
    return (
      <div className={styles.screenCardAbsent}>
        <BodyShort size="small" className={styles.screenCardDescription}>
          Uten en felles overskrift er det første spørsmålet overskriften i
          widgeten.
        </BodyShort>
        <div>
          <Button
            type="button"
            variant="tertiary"
            size="small"
            icon={<PlusIcon aria-hidden />}
            onClick={() => setRevealed(true)}
          >
            Legg til felles overskrift
          </Button>
        </div>
      </div>
    );
  }

  return (
    // No eyebrow and no landmark: the page eyebrow sits directly above, and a
    // second uppercase micro-label stacked under it is noise for two fields
    // the author just asked for.
    <div className={styles.screenCardAbsent}>
      <VStack gap="space-12">
        <TextField
          ref={titleRef}
          label="Felles overskrift"
          hideLabel
          placeholder="Samler spørsmålene under ett tema"
          className={styles.ghostTitle}
          value={title ?? ""}
          onChange={(event) => onChangeTitle(event.target.value || undefined)}
        />
        <TextField
          label="Felles innledning"
          hideLabel
          placeholder="Legg til en kort felles innledning (valgfritt)"
          className={styles.ghostDescription}
          value={description ?? ""}
          onChange={(event) =>
            onChangeDescription(event.target.value || undefined)
          }
        />
      </VStack>
    </div>
  );
}
