import { CheckmarkIcon, TrashIcon } from "@navikt/aksel-icons";
import {
  Alert,
  BodyShort,
  Box,
  Button,
  UNSAFE_Combobox as Combobox,
  HStack,
  Label,
  Modal,
  Pagination,
  Select,
  Tabs,
  TextField,
  VStack,
} from "@navikt/ds-react";
import { useEffect, useRef, useState } from "react";
import type {
  CreateThemeInput,
  TextTheme,
  UpdateThemeInput,
} from "~/types/api";

/** Context example for peek context feature */
export interface ContextExample {
  text: string;
  submittedAt: string;
}

interface ThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    data: CreateThemeInput | (UpdateThemeInput & { themeId: string }),
  ) => void;
  onDelete?: (themeId: string) => void;
  isSubmitting?: boolean;
  /** If provided, we're editing. Otherwise creating. */
  theme?: TextTheme;
  /** Pre-fill keywords (e.g., from word cloud click) */
  initialKeywords?: string[];
  /** List of available words for autocomplete */
  availableWords?: string[];
  /** List of all defined themes for autocomplete */
  allThemes?: TextTheme[];
  /** Context examples containing the clicked word */
  contextExamples?: ContextExample[];
}

// Preset colors for themes
const THEME_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
];

/**
 * Modal for creating or editing a text theme.
 * Supports keyword management with chips.
 */
export function ThemeModal({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  isSubmitting = false,
  theme,
  initialKeywords = [],
  availableWords = [],
  allThemes = [],
  contextExamples = [],
}: ThemeModalProps) {
  const isEditing = !!theme;

  // "existing" | "new". If editing, we don't use tabs.
  const [activeTab, setActiveTab] = useState<string>("existing");

  // Form state for "Create New" / "Edit"
  const [name, setName] = useState(theme?.name ?? "");
  const [keywords, setKeywords] = useState<string[]>(
    theme?.keywords ?? initialKeywords,
  );

  const [color, setColor] = useState(theme?.color ?? THEME_COLORS[0]);

  // State for "Add to Existing"
  const [selectedExistingThemeId, setSelectedExistingThemeId] =
    useState<string>("");

  const [errors, setErrors] = useState<{
    name?: string;
    keywords?: string;
    existingTheme?: string;
  }>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [examplesPage, setExamplesPage] = useState(1);
  const EXAMPLES_PER_PAGE = 3;

  // Track previous state to determine if we should reset
  const prevIsOpen = useRef(isOpen);
  const prevThemeId = useRef(theme?.id);

  // Reset state when modal opens or theme changes
  useEffect(() => {
    const hasOpened = isOpen && !prevIsOpen.current;
    const themeChanged = theme?.id !== prevThemeId.current;

    if (hasOpened || themeChanged) {
      setName(theme?.name ?? "");
      setKeywords(theme?.keywords ?? initialKeywords);
      setColor(theme?.color ?? THEME_COLORS[0]);

      // Default to "existing" tab only if we are creating AND have initial keywords (clicked a word)
      // Otherwise default to "new"
      const shouldDefaultToExisting = !theme && initialKeywords.length > 0;
      setActiveTab(shouldDefaultToExisting ? "existing" : "new");

      setSelectedExistingThemeId("");
      setErrors({});
      setConfirmDelete(false);
      setExamplesPage(1); // Reset pagination
    }

    prevIsOpen.current = isOpen;
    prevThemeId.current = theme?.id;
  }, [isOpen, theme, initialKeywords]);

  const validateNew = (): boolean => {
    const newErrors: { name?: string; keywords?: string } = {};
    if (!name.trim()) newErrors.name = "Tema-navn er påkrevd";
    if (keywords.length === 0)
      newErrors.keywords = "Minst ett nøkkelord er påkrevd";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateExisting = (): boolean => {
    const newErrors: { existingTheme?: string } = {};
    if (!selectedExistingThemeId)
      newErrors.existingTheme = "Du må velge et tema";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    // CASE 1: Add to Existing (Tab 1)
    if (!isEditing && activeTab === "existing") {
      if (!validateExisting()) return;

      const existingTheme = allThemes.find(
        (t) => t.id === selectedExistingThemeId,
      );
      if (!existingTheme) return;

      // Merge keywords
      const mergedKeywords = Array.from(
        new Set([...existingTheme.keywords, ...initialKeywords]),
      );

      onSubmit({
        themeId: existingTheme.id,
        keywords: mergedKeywords,
      });
      return;
    }

    // CASE 2: Create New or Edit (Tab 2 / Default)
    if (!validateNew()) return;

    if (isEditing && theme) {
      onSubmit({
        themeId: theme.id,
        name: name !== theme.name ? name : undefined,
        keywords:
          JSON.stringify(keywords) !== JSON.stringify(theme.keywords)
            ? keywords
            : undefined,
        color: color !== theme.color ? color : undefined,
      });
    } else {
      onSubmit({
        name,
        keywords,
        color,
      });
    }
  };

  const handleDelete = () => {
    if (theme && onDelete) {
      if (confirmDelete) {
        onDelete(theme.id);
      } else {
        setConfirmDelete(true);
      }
    }
  };

  const themeOptions = allThemes
    .filter((t) => t.name !== "Annet")
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Modal
      open={isOpen}
      onClose={() => {
        setConfirmDelete(false);
        onClose();
      }}
      header={{
        heading: isEditing
          ? "Rediger tema"
          : initialKeywords.length > 0
            ? "Kategoriser ord"
            : "Opprett nytt tema",
        closeButton: true,
      }}
      width="medium"
    >
      <Modal.Body>
        {/* TABS only when we have a word to categorize */}
        {!isEditing && initialKeywords.length > 0 && (
          <Tabs
            value={activeTab}
            onChange={setActiveTab}
            style={{ marginBottom: "1.5rem" }}
          >
            <Tabs.List>
              <Tabs.Tab value="existing" label="Legg til i eksisterende tema" />
              <Tabs.Tab value="new" label="Opprett nytt tema" />
            </Tabs.List>
          </Tabs>
        )}

        {/* TAB 1: ADD TO EXISTING (only when we have a word) */}
        {!isEditing &&
          initialKeywords.length > 0 &&
          activeTab === "existing" && (
            <VStack gap="space-24">
              <Alert variant="info" size="small">
                Du legger til følgende ord:{" "}
                <strong>{initialKeywords.join(", ")}</strong>
              </Alert>

              <Select
                label="Velg tema"
                description={`Velg hvilket tema du vil legge ${initialKeywords.length > 1 ? "ordene" : "ordet"} til i.`}
                value={selectedExistingThemeId}
                onChange={(e) => {
                  setSelectedExistingThemeId(e.target.value);
                  setErrors((err) => ({ ...err, existingTheme: undefined }));
                }}
                error={errors.existingTheme}
              >
                <option value="">Velg...</option>
                {themeOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </VStack>
          )}

        {/* TAB 2 / EDIT MODE / NO-WORD CREATE: FORM */}
        {(isEditing || activeTab === "new" || initialKeywords.length === 0) && (
          <VStack gap="space-24">
            <TextField
              label="Tema-navn"
              description="Et beskrivende navn for temaet"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((e) => ({ ...e, name: undefined }));
              }}
              error={errors.name}
              autoFocus={activeTab === "new"}
            />

            <div>
              <Label>Nøkkelord</Label>
              <BodyShort
                size="small"
                textColor="subtle"
                style={{ marginBottom: "0.5rem" }}
              >
                Tekster som inneholder disse ordene blir gruppert under dette
                temaet. Vi bruker smart søk – "søknad" treffer også "søknaden"
                og "søknader".
              </BodyShort>

              <HStack
                gap="space-8"
                style={{ marginBottom: "0.5rem" }}
                align="end"
              >
                <Combobox
                  label="Legg til nøkkelord"
                  hideLabel
                  placeholder="Skriv et nøkkelord..."
                  options={availableWords}
                  selectedOptions={keywords}
                  onToggleSelected={(option, isSelected) => {
                    if (isSelected) {
                      const trimmed = option.trim().toLowerCase();
                      if (trimmed) {
                        setKeywords([...keywords, trimmed]);
                        setErrors((e) => ({ ...e, keywords: undefined }));
                      }
                    } else {
                      setKeywords(keywords.filter((k) => k !== option));
                    }
                  }}
                  allowNewValues
                  isMultiSelect
                  shouldAutocomplete={true}
                  style={{ flex: 1 }}
                />
              </HStack>

              {errors.keywords && (
                <BodyShort
                  size="small"
                  style={{ color: "var(--ax-text-danger)" }}
                >
                  {errors.keywords}
                </BodyShort>
              )}
            </div>

            <div>
              <Label>Farge</Label>
              <HStack gap="space-8" style={{ marginTop: "0.5rem" }}>
                {THEME_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{
                      width: "2rem",
                      height: "2rem",
                      borderRadius: "4px",
                      backgroundColor: c,
                      border:
                        color === c
                          ? "3px solid var(--ax-border-focus)"
                          : "1px solid var(--ax-border-divider)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    aria-label={`Velg farge ${c}`}
                  >
                    {color === c && (
                      <CheckmarkIcon
                        title="Valgt farge"
                        style={{
                          color: "white",
                          filter: "drop-shadow(0px 0px 2px rgba(0,0,0,0.5))",
                        }}
                      />
                    )}
                  </button>
                ))}
              </HStack>
            </div>
          </VStack>
        )}

        {/* Context Examples Section */}
        {contextExamples.length > 0 && initialKeywords.length > 0 && (
          <Box.New
            marginBlock="space-24 0"
            paddingBlock="space-16"
            borderWidth="1 0 0 0"
            borderColor="neutral-subtle"
          >
            <Label size="small" style={{ marginBottom: "0.5rem" }}>
              📝 Slik brukes "{initialKeywords[0]}" i svarene (
              {contextExamples.length} treff)
            </Label>
            <VStack gap="space-8">
              {contextExamples
                .slice(
                  (examplesPage - 1) * EXAMPLES_PER_PAGE,
                  examplesPage * EXAMPLES_PER_PAGE,
                )
                .map((example, idx) => {
                  // Highlight keyword using cumulative position as key
                  const keyword = initialKeywords[0];
                  const regex = new RegExp(`(${keyword})`, "gi");
                  const parts = example.text.split(regex);
                  let pos = 0;
                  return (
                    <Box.New
                      key={`${example.submittedAt}-${idx}`}
                      padding="space-12"
                      background="neutral-soft"
                      borderRadius="medium"
                    >
                      <BodyShort size="small">
                        "
                        {parts.map((part) => {
                          const key = `${pos}`;
                          pos += part.length;
                          return part.toLowerCase() ===
                            keyword.toLowerCase() ? (
                            <strong
                              key={key}
                              style={{ color: "var(--ax-text-action)" }}
                            >
                              {part}
                            </strong>
                          ) : (
                            <span key={key}>{part}</span>
                          );
                        })}
                        "
                      </BodyShort>
                    </Box.New>
                  );
                })}
            </VStack>

            {/* Pagination */}
            {contextExamples.length > EXAMPLES_PER_PAGE && (
              <HStack justify="center" style={{ marginTop: "0.75rem" }}>
                <Pagination
                  page={examplesPage}
                  onPageChange={setExamplesPage}
                  count={Math.ceil(contextExamples.length / EXAMPLES_PER_PAGE)}
                  size="xsmall"
                  siblingCount={0}
                  boundaryCount={1}
                />
              </HStack>
            )}
          </Box.New>
        )}
      </Modal.Body>

      <Modal.Footer>
        <HStack
          justify="space-between"
          align="center"
          style={{ width: "100%" }}
        >
          <HStack gap="space-12">
            <Button onClick={handleSubmit} loading={isSubmitting}>
              {isEditing
                ? "Lagre endringer"
                : activeTab === "existing"
                  ? "Legg til i tema"
                  : "Opprett tema"}
            </Button>
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Avbryt
            </Button>
          </HStack>

          {isEditing && onDelete && (
            <Button
              variant="danger"
              icon={<TrashIcon aria-hidden />}
              onClick={handleDelete}
              loading={isSubmitting}
            >
              {confirmDelete ? "Bekreft sletting" : "Slett tema"}
            </Button>
          )}
        </HStack>
      </Modal.Footer>
    </Modal>
  );
}
