import { CheckmarkIcon, TrashIcon } from "@navikt/aksel-icons";
import {
  Alert,
  BodyShort,
  Button,
  DatePicker,
  HStack,
  Label,
  Modal,
  Textarea,
  TextField,
  useDatepicker,
  VStack,
} from "@navikt/ds-react";
import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CreateMarkerInput,
  RatingMarker,
  UpdateMarkerInput,
} from "~/types/api";
import {
  THEME_COLOR_GRAY,
  THEME_COLOR_ORANGE,
  THEME_COLORS,
} from "~/utils/colors";
import styles from "./MarkerModal.module.css";

const DEFAULT_MARKER_COLOR = "#1C64F2";
const MARKER_COLORS = Array.from(
  new Set([
    DEFAULT_MARKER_COLOR,
    ...THEME_COLORS,
    THEME_COLOR_ORANGE,
    THEME_COLOR_GRAY,
  ]),
);

interface MarkerModalProps {
  isOpen: boolean;
  mode: "create" | "edit";
  marker?: RatingMarker;
  fromDate?: string;
  toDate?: string;
  isSubmitting?: boolean;
  isDeleting?: boolean;
  error?: Error | null;
  onClose: () => void;
  onSave: (
    input: CreateMarkerInput | ({ id: string } & UpdateMarkerInput),
  ) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
}

interface FormErrors {
  markerDate?: string;
  label?: string;
  description?: string;
}

function normalizeColor(value: string): string {
  return value.toUpperCase();
}

function normalizeOptionalColor(value: string | null | undefined): string {
  return value?.trim() ? normalizeColor(value.trim()) : "";
}

function formatDateForApi(date: Date): string {
  return dayjs(date).format("YYYY-MM-DD");
}

export function MarkerModal({
  isOpen,
  mode,
  marker,
  fromDate,
  toDate,
  isSubmitting = false,
  isDeleting = false,
  error,
  onClose,
  onSave,
  onDelete,
}: MarkerModalProps) {
  const isEditing = mode === "edit";

  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState(DEFAULT_MARKER_COLOR);
  const [didChangeColor, setDidChangeColor] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const minDate = useMemo(
    () => (fromDate ? dayjs(fromDate).startOf("day").toDate() : undefined),
    [fromDate],
  );
  const maxDate = useMemo(
    () => (toDate ? dayjs(toDate).startOf("day").toDate() : undefined),
    [toDate],
  );

  const swatchColors = useMemo(() => {
    const colorSet = new Set(
      MARKER_COLORS.map((color) => normalizeColor(color)),
    );
    const markerColor = normalizeOptionalColor(marker?.color);
    if (markerColor) {
      colorSet.add(markerColor);
    }
    return Array.from(colorSet);
  }, [marker?.color]);

  const {
    datepickerProps,
    inputProps: markerDateInputProps,
    setSelected: setDatepickerSelected,
  } = useDatepicker({
    defaultSelected: selectedDate,
    fromDate: minDate,
    toDate: maxDate,
    inputFormat: "dd.MM.yyyy",
    onDateChange: (date) => {
      setSelectedDate(date);
      if (date) {
        setErrors((previous) =>
          previous.markerDate
            ? { ...previous, markerDate: undefined }
            : previous,
        );
      }
    },
    onValidate: (validation) => {
      const isValidAndInRange =
        validation.isValidDate &&
        !validation.isBefore &&
        !validation.isAfter &&
        !validation.isInvalid;

      setErrors((previous) => {
        if (validation.isEmpty || isValidAndInRange) {
          return previous.markerDate
            ? { ...previous, markerDate: undefined }
            : previous;
        }

        return {
          ...previous,
          markerDate: "Velg en dato i valgt periode",
        };
      });
    },
  });
  const datepickerSelectedRef = useRef(setDatepickerSelected);
  datepickerSelectedRef.current = setDatepickerSelected;

  useEffect(() => {
    if (!isOpen) return;

    const defaultDate = maxDate ?? dayjs().startOf("day").toDate();
    const existingColor = normalizeOptionalColor(marker?.color);

    if (!marker) {
      setSelectedDate(defaultDate);
      datepickerSelectedRef.current(defaultDate);
      setLabel("");
      setDescription("");
      setSelectedColor(DEFAULT_MARKER_COLOR);
      setDidChangeColor(false);
      setErrors({});
      setConfirmDelete(false);
      return;
    }

    const markerDate = dayjs(marker.markerDate).toDate();

    setSelectedDate(markerDate);
    datepickerSelectedRef.current(markerDate);
    setLabel(marker.label);
    setDescription(marker.description ?? "");
    setSelectedColor(existingColor || DEFAULT_MARKER_COLOR);
    setDidChangeColor(false);
    setErrors({});
    setConfirmDelete(false);
  }, [isOpen, marker, maxDate]);

  const resolvedColor = useMemo(
    () => normalizeOptionalColor(selectedColor),
    [selectedColor],
  );

  const handleSave = async () => {
    const nextErrors: FormErrors = {};
    const normalizedMarkerDate = selectedDate
      ? formatDateForApi(selectedDate)
      : "";
    const trimmedLabel = label.trim();
    const trimmedDescription = description.trim();
    const normalizedColor = resolvedColor;

    if (!normalizedMarkerDate) {
      nextErrors.markerDate = "Velg en dato";
    }
    if (!trimmedLabel) {
      nextErrors.label = "Tittel er påkrevd";
    } else if (trimmedLabel.length > 80) {
      nextErrors.label = "Tittel kan maks være 80 tegn";
    }
    if (trimmedDescription.length > 500) {
      nextErrors.description = "Beskrivelse kan maks være 500 tegn";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    if (isEditing && marker) {
      const updatePayload: { id: string } & UpdateMarkerInput = {
        id: marker.id,
      };

      if (normalizedMarkerDate !== marker.markerDate) {
        updatePayload.markerDate = normalizedMarkerDate;
      }

      if (trimmedLabel !== marker.label) {
        updatePayload.label = trimmedLabel;
      }

      const originalDescription = marker.description?.trim() ?? "";
      if (trimmedDescription !== originalDescription) {
        if (trimmedDescription === "") {
          updatePayload.clearDescription = true;
        } else {
          updatePayload.description = trimmedDescription;
        }
      }

      const originalColor = normalizeOptionalColor(marker.color);
      if (
        didChangeColor &&
        normalizedColor &&
        normalizedColor !== originalColor
      ) {
        updatePayload.color = normalizedColor;
      }

      if (Object.keys(updatePayload).length === 1) {
        closeAndReset();
        return;
      }

      await onSave(updatePayload);
      return;
    }

    await onSave({
      markerDate: normalizedMarkerDate,
      label: trimmedLabel,
      description: trimmedDescription || undefined,
      color: normalizedColor || undefined,
    });
  };

  const handleDelete = async () => {
    if (!marker || !onDelete) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await onDelete(marker.id);
  };

  const closeAndReset = () => {
    setConfirmDelete(false);
    setErrors({});
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onClose={closeAndReset}
      header={{
        heading: isEditing ? "Rediger markør" : "Ny markør",
        closeButton: true,
      }}
      width="medium"
    >
      <Modal.Body>
        <VStack gap="space-16">
          <DatePicker {...datepickerProps}>
            <DatePicker.Input
              {...markerDateInputProps}
              label="Dato"
              size="small"
              error={errors.markerDate}
            />
          </DatePicker>
          {(fromDate || toDate) && (
            <BodyShort size="small" textColor="subtle">
              Dato må være innen valgt periode.
            </BodyShort>
          )}

          <TextField
            label="Tittel"
            value={label}
            error={errors.label}
            onChange={(event) => setLabel(event.target.value)}
          />
          <BodyShort size="small" textColor="subtle">
            {label.length}/80 tegn
          </BodyShort>

          <Textarea
            label="Beskrivelse (valgfri)"
            minRows={3}
            value={description}
            error={errors.description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <BodyShort size="small" textColor="subtle">
            {description.length}/500 tegn
          </BodyShort>

          <VStack gap="space-8">
            <Label size="small">Farge</Label>
            <HStack gap="space-8" className={styles.swatches}>
              {swatchColors.map((color) => {
                const selected =
                  normalizeColor(selectedColor) === normalizeColor(color);

                return (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Velg farge ${color}`}
                    className={`${styles.swatch} ${selected ? styles.swatchSelected : ""}`}
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      setSelectedColor(normalizeColor(color));
                      setDidChangeColor(true);
                    }}
                  >
                    {selected && (
                      <CheckmarkIcon aria-hidden className={styles.checkmark} />
                    )}
                  </button>
                );
              })}
            </HStack>
          </VStack>

          {confirmDelete && (
            <Alert variant="warning" size="small">
              Klikk "Slett markør" en gang til for å bekrefte.
            </Alert>
          )}

          {error && (
            <Alert variant="error" size="small">
              Noe gikk galt. Prøv igjen.
            </Alert>
          )}
        </VStack>
      </Modal.Body>

      <Modal.Footer>
        <HStack
          justify="space-between"
          gap="space-8"
          className={styles.footerRow}
        >
          <div>
            {isEditing && onDelete && marker && (
              <Button
                data-color="danger"
                variant="tertiary"
                icon={<TrashIcon aria-hidden />}
                onClick={() => {
                  void handleDelete();
                }}
                loading={isDeleting}
              >
                Slett markør
              </Button>
            )}
          </div>

          <HStack gap="space-8">
            <Button variant="secondary" onClick={closeAndReset}>
              Avbryt
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                void handleSave();
              }}
              loading={isSubmitting}
            >
              {isEditing ? "Lagre endringer" : "Opprett markør"}
            </Button>
          </HStack>
        </HStack>
      </Modal.Footer>
    </Modal>
  );
}
