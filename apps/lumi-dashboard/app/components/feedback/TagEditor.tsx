import { PlusIcon, XMarkIcon } from "@navikt/aksel-icons";
import {
  Button,
  Chips,
  UNSAFE_Combobox as Combobox,
  HStack,
  Tooltip,
} from "@navikt/ds-react";
import { useState } from "react";
import { useAddTag, useRemoveTag, useTags } from "~/hooks/useTags";

interface TagEditorProps {
  id: string;
  currentTags: string[];
  compact?: boolean;
}

// Predefined tag suggestions - these are the actual values stored
const TAG_SUGGESTIONS = [
  "🐛 Bug",
  "✨ Feature",
  "🎨 UX",
  "🔥 Kritisk",
  "👀 Til vurdering",
  "✅ Løst",
  "🚫 Fikses ikke",
  "🗑️ Spam",
  "⚠️ Personopplysninger",
];

// Determine chip variant based on emoji prefix
function getChipsVariant(tag: string): "neutral" | "action" {
  // Use "action" (highlighted) for important/warning tags
  if (tag.startsWith("🐛") || tag.startsWith("🔥") || tag.startsWith("👀")) {
    return "action";
  }
  return "neutral";
}

export function TagEditor({
  id,
  currentTags,
  compact = false,
}: TagEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const { data: allTags = [] } = useTags();
  const addTagMutation = useAddTag();
  const removeTagMutation = useRemoveTag();

  // Combine suggested tags with existing tags from the system
  const availableTags = [...new Set([...TAG_SUGGESTIONS, ...allTags])];
  const suggestedTags = availableTags.filter(
    (tag) => !currentTags.includes(tag),
  );

  const handleAddTag = (tag: string) => {
    if (tag && !currentTags.includes(tag)) {
      addTagMutation.mutate({ id, tag });
      setInputValue("");
      setIsAdding(false);
    }
  };

  const handleRemoveTag = (tag: string) => {
    removeTagMutation.mutate({ id, tag });
  };

  if (compact && currentTags.length === 0 && !isAdding) {
    return (
      <Tooltip content="Legg til tag">
        <Button
          variant="tertiary"
          size="xsmall"
          icon={<PlusIcon aria-hidden />}
          onClick={() => setIsAdding(true)}
        />
      </Tooltip>
    );
  }

  return (
    <HStack gap="space-8" align="center" wrap>
      {/* Existing tags as removable chips */}
      {currentTags.length > 0 && (
        <Chips size="small">
          {currentTags.map((tag) => (
            <Chips.Removable
              key={tag}
              variant={getChipsVariant(tag)}
              onDelete={() => handleRemoveTag(tag)}
            >
              {tag}
            </Chips.Removable>
          ))}
        </Chips>
      )}

      {/* Add tag button/input */}
      {isAdding ? (
        <HStack gap="space-4" align="center">
          <Combobox
            size="small"
            label="Legg til tag"
            hideLabel
            options={suggestedTags}
            allowNewValues
            value={inputValue}
            onChange={(value) => setInputValue(value || "")}
            onToggleSelected={(option, isSelected) => {
              if (isSelected) {
                handleAddTag(option);
              }
            }}
            style={{ minWidth: 150 }}
          />
          <Button
            variant="tertiary"
            size="xsmall"
            icon={<XMarkIcon aria-hidden />}
            onClick={() => {
              setIsAdding(false);
              setInputValue("");
            }}
          />
        </HStack>
      ) : (
        <Tooltip content="Legg til tag">
          <Button
            variant="tertiary"
            size="xsmall"
            icon={<PlusIcon aria-hidden />}
            onClick={() => setIsAdding(true)}
          >
            {!compact && "Tag"}
          </Button>
        </Tooltip>
      )}
    </HStack>
  );
}

// Simple tag display (read-only)
export function TagDisplay({ tags }: { tags: string[] }) {
  if (!tags || tags.length === 0) return null;

  return (
    <Chips size="small">
      {tags.map((tag) => (
        <Chips.Toggle
          key={tag}
          variant={getChipsVariant(tag)}
          selected={false}
          checkmark={false}
        >
          {tag}
        </Chips.Toggle>
      ))}
    </Chips>
  );
}
