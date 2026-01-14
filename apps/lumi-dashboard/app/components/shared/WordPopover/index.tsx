import { PencilIcon, TrashIcon } from "@navikt/aksel-icons";
import { BodyShort, Button, HStack, Popover, VStack } from "@navikt/ds-react";
import type { TextTheme } from "~/types/api";

interface WordPopoverProps {
  /** The word that was clicked */
  word: string;
  /** The theme this word belongs to */
  theme: TextTheme;
  /** Anchor element (the word button) */
  anchorEl: HTMLElement | null;
  /** Whether popover is open */
  isOpen: boolean;
  /** Called when popover should close */
  onClose: () => void;
  /** Called when user wants to remove word from theme */
  onRemoveWord: (themeId: string, word: string) => void;
  /** Called when user wants to edit the theme */
  onEditTheme: (theme: TextTheme) => void;
}

/**
 * Popover shown when clicking a word that's already categorized.
 * Offers options to remove the word from its theme or edit the theme.
 */
export function WordPopover({
  word,
  theme,
  anchorEl,
  isOpen,
  onClose,
  onRemoveWord,
  onEditTheme,
}: WordPopoverProps) {
  if (!anchorEl) return null;

  return (
    <Popover
      open={isOpen}
      onClose={onClose}
      anchorEl={anchorEl}
      placement="bottom"
    >
      <Popover.Content>
        <VStack gap="space-12" style={{ minWidth: "220px" }}>
          <BodyShort size="small">
            Ordet <strong>"{word}"</strong> tilhører temaet{" "}
            <strong>{theme.name}</strong>.
          </BodyShort>

          <HStack gap="space-8">
            <Button
              variant="secondary"
              size="small"
              icon={<TrashIcon aria-hidden />}
              onClick={() => {
                onRemoveWord(theme.id, word);
                onClose();
              }}
            >
              Fjern fra tema
            </Button>
            <Button
              variant="tertiary"
              size="small"
              icon={<PencilIcon aria-hidden />}
              onClick={() => {
                onEditTheme(theme);
                onClose();
              }}
            >
              Rediger tema
            </Button>
          </HStack>
        </VStack>
      </Popover.Content>
    </Popover>
  );
}
