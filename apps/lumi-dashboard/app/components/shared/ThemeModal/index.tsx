import { CheckmarkIcon, TrashIcon } from "@navikt/aksel-icons";
import {
  Alert,
  Button,
  UNSAFE_Combobox as Combobox,
  Fieldset,
  HStack,
  Modal,
  TextField,
  VStack,
} from "@navikt/ds-react";
import { useEffect, useRef, useState } from "react";
import type {
  CreateThemeInput,
  TextTheme,
  UpdateThemeInput,
} from "~/types/api";
import {
  THEME_COLOR_BLUE,
  THEME_COLOR_GRAY,
  THEME_COLOR_ORANGE,
  THEME_COLORS,
} from "~/utils/colors";
import styles from "./ThemeModal.module.css";

interface ThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    data: CreateThemeInput | (UpdateThemeInput & { themeId: string }),
  ) => void;
  onDelete?: (themeId: string) => void;
  isSubmitting?: boolean;
  mutationError?: string;
  nameError?: string;
  onClearNameError?: () => void;
  /** If provided, we're editing. Otherwise creating. */
  theme?: TextTheme;
  /** List of available words for autocomplete */
  availableWords?: string[];
}

const COLOR_CLASS_BY_HEX: Record<string, string> = {
  [THEME_COLORS[0]]: styles.colorBlue,
  [THEME_COLORS[1]]: styles.colorEmerald,
  [THEME_COLORS[2]]: styles.colorAmber,
  [THEME_COLORS[3]]: styles.colorRed,
  [THEME_COLORS[4]]: styles.colorViolet,
  [THEME_COLORS[5]]: styles.colorPink,
  [THEME_COLORS[6]]: styles.colorCyan,
  [THEME_COLORS[7]]: styles.colorLime,
  [THEME_COLOR_ORANGE]: styles.colorOrange,
  [THEME_COLOR_GRAY]: styles.colorGray,
};

const COLOR_NAME_BY_HEX: Record<string, string> = {
  [THEME_COLORS[0]]: "Blå",
  [THEME_COLORS[1]]: "Grønn",
  [THEME_COLORS[2]]: "Gul",
  [THEME_COLORS[3]]: "Rød",
  [THEME_COLORS[4]]: "Lilla",
  [THEME_COLORS[5]]: "Rosa",
  [THEME_COLORS[6]]: "Turkis",
  [THEME_COLORS[7]]: "Limegrønn",
  [THEME_COLOR_ORANGE]: "Oransje",
  [THEME_COLOR_GRAY]: "Grå",
};

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
  mutationError,
  nameError,
  onClearNameError,
  theme,
  availableWords = [],
}: ThemeModalProps) {
  const isEditing = !!theme;
  const [name, setName] = useState(theme?.name ?? "");
  const [keywords, setKeywords] = useState<string[]>(theme?.keywords ?? []);

  const [color, setColor] = useState(theme?.color ?? THEME_COLOR_BLUE);

  const [errors, setErrors] = useState<{
    name?: string;
    keywords?: string;
  }>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const mutationInFlightRef = useRef(false);

  // Track previous state to determine if we should reset
  const prevIsOpen = useRef(isOpen);
  const prevThemeId = useRef(theme?.id);

  // Reset state when modal opens or theme changes
  useEffect(() => {
    const hasOpened = isOpen && !prevIsOpen.current;
    const themeChanged = theme?.id !== prevThemeId.current;

    if (hasOpened || themeChanged) {
      setName(theme?.name ?? "");
      setKeywords(theme?.keywords ?? []);
      setColor(theme?.color ?? THEME_COLOR_BLUE);
      setErrors({});
      setConfirmDelete(false);
    }

    prevIsOpen.current = isOpen;
    prevThemeId.current = theme?.id;
  }, [isOpen, theme]);

  useEffect(() => {
    if (!isSubmitting) mutationInFlightRef.current = false;
  }, [isSubmitting]);

  const validateNew = (): boolean => {
    const newErrors: { name?: string; keywords?: string } = {};
    if (!name.trim()) newErrors.name = "Skriv inn et navn på temaet";
    else if (name.trim().toLocaleLowerCase("nb") === "annet")
      newErrors.name = "Velg et annet navn. «Annet» brukes for svar uten tema.";
    if (keywords.length === 0)
      newErrors.keywords = "Minst ett nøkkelord er påkrevd";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isMutationLocked = () => isSubmitting || mutationInFlightRef.current;

  const requestClose = () => {
    if (isMutationLocked()) return;
    setConfirmDelete(false);
    onClose();
  };

  const handleSubmit = () => {
    if (isMutationLocked()) return;
    if (!validateNew()) return;
    mutationInFlightRef.current = true;

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
    if (isMutationLocked()) return;
    if (theme && onDelete) {
      if (confirmDelete) {
        mutationInFlightRef.current = true;
        onDelete(theme.id);
      } else {
        setConfirmDelete(true);
      }
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={requestClose}
      onBeforeClose={() => !isMutationLocked()}
      header={{
        heading: isEditing ? "Rediger tema" : "Opprett nytt tema",
        closeButton: true,
      }}
      width="medium"
    >
      <Modal.Body>
        <VStack gap="space-24">
          {mutationError && (
            <Alert variant="error" size="small" role="status">
              {mutationError}
            </Alert>
          )}
          <TextField
            label="Navn på temaet"
            description="Et beskrivende navn for temaet"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((e) => ({ ...e, name: undefined }));
              onClearNameError?.();
            }}
            error={errors.name ?? nameError}
            autoFocus={!isEditing}
          />

          <Combobox
            label="Nøkkelord"
            description="Tekster som inneholder disse ordene blir gruppert under temaet. Vi finner også bøyde former av ordet – «søknad» treffer «søknaden» og «søknader»."
            error={errors.keywords}
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
            className={styles.combobox}
          />

          <Fieldset legend="Farge" size="small">
            <HStack gap="space-8" className={styles.colorSwatches}>
              {THEME_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={[
                    styles.colorButton,
                    COLOR_CLASS_BY_HEX[c] ?? styles.colorGray,
                    color === c ? styles.colorButtonSelected : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-label={COLOR_NAME_BY_HEX[c] ?? "Farge"}
                  aria-pressed={color === c}
                >
                  {color === c && (
                    <CheckmarkIcon
                      title="Valgt farge"
                      className={styles.checkmark}
                    />
                  )}
                </button>
              ))}
            </HStack>
          </Fieldset>
        </VStack>
      </Modal.Body>
      <Modal.Footer>
        <HStack
          justify="space-between"
          align="center"
          className={styles.footerRow}
        >
          <HStack gap="space-12" className={styles.footerActions}>
            <Button onClick={handleSubmit} loading={isSubmitting}>
              {isEditing ? "Lagre endringer" : "Opprett tema"}
            </Button>
            <Button
              variant="secondary"
              onClick={requestClose}
              disabled={isSubmitting}
            >
              Avbryt
            </Button>
          </HStack>

          {isEditing && onDelete && (
            <Button
              data-color="danger"
              variant="primary"
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
